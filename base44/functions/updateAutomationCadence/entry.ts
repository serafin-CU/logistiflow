import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        const { automation_name, repeat_interval, repeat_unit } = await req.json();

        if (!automation_name || !repeat_interval || !repeat_unit) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Validate minimum interval (5 minutes)
        if (repeat_unit === 'minutes' && repeat_interval < 5) {
            return Response.json({ error: 'Minimum interval is 5 minutes' }, { status: 400 });
        }

        // Get the automation ID by listing automations and finding the one with matching name
        const listResponse = await fetch(`${Deno.env.get('BASE44_API_URL')}/automations`, {
            headers: {
                'Authorization': `Bearer ${req.headers.get('authorization')?.replace('Bearer ', '')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!listResponse.ok) {
            throw new Error('Failed to list automations');
        }

        const automations = await listResponse.json();
        const targetAutomation = automations.find(a => a.name === automation_name);

        if (!targetAutomation) {
            return Response.json({ error: `Automation "${automation_name}" not found` }, { status: 404 });
        }

        // Update the automation using the Base44 API
        const updateResponse = await fetch(`${Deno.env.get('BASE44_API_URL')}/automations/${targetAutomation.id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${req.headers.get('authorization')?.replace('Bearer ', '')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                repeat_interval,
                repeat_unit
            })
        });

        if (!updateResponse.ok) {
            const error = await updateResponse.text();
            throw new Error(`Failed to update automation: ${error}`);
        }

        // Save the setting to the database
        const existingSettings = await base44.entities.AutomationSetting.filter({
            automation_name
        });

        const settingData = {
            automation_name,
            automation_id: targetAutomation.id,
            repeat_interval,
            repeat_unit,
            last_updated_by: user.email
        };

        if (existingSettings.length > 0) {
            await base44.entities.AutomationSetting.update(existingSettings[0].id, settingData);
        } else {
            await base44.entities.AutomationSetting.create(settingData);
        }

        return Response.json({
            success: true,
            message: `Automation cadence updated to every ${repeat_interval} ${repeat_unit}`
        });
    } catch (error) {
        console.error('Error updating automation cadence:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});