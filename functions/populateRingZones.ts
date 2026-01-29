import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
        }

        // Get all rings
        const rings = await base44.asServiceRole.entities.Ring.list();
        
        let updated = 0;
        let skipped = 0;
        let errors = 0;
        const details = [];

        for (const ring of rings) {
            try {
                // Skip if already has zones
                if (ring.zones && ring.zones.length > 0) {
                    skipped++;
                    details.push({ ring_id: ring.ring_id, status: 'skipped', reason: 'already has zones' });
                    continue;
                }

                // Skip if no zipcodes
                if (!ring.zipcodes || ring.zipcodes.length === 0) {
                    skipped++;
                    details.push({ ring_id: ring.ring_id, status: 'skipped', reason: 'no zipcodes' });
                    continue;
                }

                // Get zone data for first zipcode
                const zipcode = ring.zipcodes[0];
                
                // Call getZipcodeZone directly via HTTP
                const functionUrl = `https://${Deno.env.get('BASE44_APP_ID')}.base44.app/api/functions/getZipcodeZone`;
                const zoneResponse = await fetch(functionUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': req.headers.get('Authorization')
                    },
                    body: JSON.stringify({ zipcode })
                });
                
                if (!zoneResponse.ok) {
                    errors++;
                    details.push({ ring_id: ring.ring_id, status: 'error', error: `HTTP ${zoneResponse.status}` });
                    continue;
                }
                
                const zoneData = await zoneResponse.json();

                if (zoneData.error) {
                    errors++;
                    details.push({ ring_id: ring.ring_id, status: 'error', error: zoneData.error });
                    continue;
                }

                // Update ring with zone data
                const zones = [];
                if (zoneData.zone) zones.push(zoneData.zone);
                if (zoneData.county_zone && zoneData.county_zone !== zoneData.zone) zones.push(zoneData.county_zone);
                if (zoneData.forecast_zone && !zones.includes(zoneData.forecast_zone)) zones.push(zoneData.forecast_zone);
                
                const updateData = {
                    zones: zones,
                    latitude: zoneData.latitude,
                    longitude: zoneData.longitude,
                    state: zoneData.state
                };

                await base44.asServiceRole.entities.Ring.update(ring.id, updateData);
                updated++;
                details.push({ 
                    ring_id: ring.ring_id, 
                    status: 'updated', 
                    zones: updateData.zones,
                    state: updateData.state
                });

            } catch (error) {
                errors++;
                details.push({ ring_id: ring.ring_id, status: 'error', error: error.message });
            }
        }

        return Response.json({
            success: true,
            summary: {
                total_rings: rings.length,
                updated,
                skipped,
                errors
            },
            details
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});