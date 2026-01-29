import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        // Require admin access
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }
        
        // Get all upcoming deliveries (future dates only)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        
        const allDeliveries = await base44.asServiceRole.entities.Delivery.list('-created_date', 1000);
        const upcomingDeliveries = allDeliveries.filter(d => 
            d.delivery_date && d.delivery_date >= todayStr
        );
        
        // Get all active alerts
        const alerts = await base44.asServiceRole.entities.WeatherAlert.filter({ is_active: true });
        
        const results = {
            total: upcomingDeliveries.length,
            updated: 0,
            errors: 0,
            details: []
        };
        
        for (const delivery of upcomingDeliveries) {
            try {
                // Get zone info for zipcode
                let zoneInfo = null;
                try {
                    const zoneResponse = await base44.functions.invoke('getZipcodeZone', { 
                        zipcode: delivery.zipcode 
                    });
                    zoneInfo = zoneResponse.data;
                } catch (error) {
                    console.warn(`Failed to get zone for ${delivery.zipcode}:`, error.message);
                }
                
                // Match alerts using zone or state
                const relevantAlerts = alerts.filter(alert => {
                    if (zoneInfo?.county_zone && alert.affected_zones?.includes(zoneInfo.county_zone)) {
                        return true;
                    }
                    if (zoneInfo?.forecast_zone && alert.affected_zones?.includes(zoneInfo.forecast_zone)) {
                        return true;
                    }
                    if (alert.affected_states?.includes(delivery.state)) {
                        return true;
                    }
                    return false;
                });
                
                // Calculate risk using AI
                const riskResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
                    prompt: `Analyze delivery risk for zipcode ${delivery.zipcode} in ${delivery.city}, ${delivery.state} on ${delivery.delivery_date}.

Location details: ${zoneInfo ? `County: ${zoneInfo.county}, Zone: ${zoneInfo.zone || 'N/A'}` : 'State-level only'}

Active weather alerts: ${relevantAlerts.length > 0 ? relevantAlerts.map(a => `${a.event} (${a.severity})`).join(", ") : "None"}

Return risk score (0-100) and level (low/medium/high/critical).`,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            risk_score: { type: "number" },
                            risk_level: { type: "string", enum: ["low", "medium", "high", "critical"] }
                        },
                        required: ["risk_score", "risk_level"]
                    }
                });
                
                // Update delivery
                await base44.asServiceRole.entities.Delivery.update(delivery.id, {
                    risk_score: riskResponse.risk_score,
                    risk_level: riskResponse.risk_level,
                    weather_alerts: relevantAlerts.map(a => a.event)
                });
                
                results.updated++;
                results.details.push({
                    tracking_id: delivery.tracking_id,
                    status: 'updated',
                    risk_level: riskResponse.risk_level,
                    alerts_count: relevantAlerts.length
                });
                
            } catch (error) {
                results.errors++;
                results.details.push({
                    tracking_id: delivery.tracking_id,
                    status: 'error',
                    error: error.message
                });
            }
        }
        
        return Response.json({
            success: true,
            summary: results
        });
        
    } catch (error) {
        console.error('Recalculate risks error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});