import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Fetches live weather alerts from weather.gov National Weather Service API
 * Updates weather alerts in the database with real-time data
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Fetch all rings to identify zones and states to monitor
        const rings = await base44.asServiceRole.entities.Ring.list();
        const monitoredStates = [...new Set(rings.map(r => r.state).filter(Boolean))];
        const monitoredZones = [...new Set(rings.flatMap(r => r.zones || []))];

        console.log(`Monitoring ${monitoredStates.length} states and ${monitoredZones.length} zones`);

        // Fetch active alerts from NWS API
        const response = await fetch('https://api.weather.gov/alerts/active', {
            headers: {
                'User-Agent': 'WeatherShield-Logistics (contact@weathershield.com)',
                'Accept': 'application/geo+json'
            }
        });

        if (!response.ok) {
            throw new Error(`NWS API error: ${response.status}`);
        }

        const data = await response.json();
        const alerts = data.features || [];

        console.log(`Fetched ${alerts.length} total alerts from NWS`);

        // Get existing alerts for upsert logic
        const existingAlerts = await base44.asServiceRole.entities.WeatherAlert.list();
        const existingAlertIds = new Set(existingAlerts.map(a => a.alert_id));

        // Process and upsert alerts
        const processedAlerts = [];
        const upserted = { created: 0, updated: 0, deactivated: 0 };
        
        for (const feature of alerts) {
            const props = feature.properties;
            
            // Extract zone codes from affectedZones URLs
            const affectedZones = (props.affectedZones || [])
                .map(url => url.split('/').pop())
                .filter(Boolean);

            // Extract state information from areaDesc
            const affectedStates = [];
            if (props.areaDesc) {
                const stateMatches = props.areaDesc.match(/\b[A-Z]{2}\b/g);
                if (stateMatches) {
                    affectedStates.push(...stateMatches);
                }
            }
            console.log(`Alert: "${props.event}" (${props.id}) - Zones: [${affectedZones.join(', ')}], States: [${affectedStates.join(', ')}]`);

            // Check if this alert affects any of our monitored zones or states
            const isRelevant = 
                affectedZones.some(zone => monitoredZones.includes(zone)) ||
                affectedStates.some(state => monitoredStates.includes(state)) ||
                monitoredStates.length === 0; // If no rings yet, keep all alerts

            if (!isRelevant) {
                console.log(`Skipped: "${props.event}" - not relevant to monitored zones/states`);
                continue; // Skip alerts not relevant to our delivery areas
            }
            console.log(`Stored: "${props.event}" as relevant alert`);

            // Map NWS severity to our system
            const severityMap = {
                'Extreme': 'extreme',
                'Severe': 'severe',
                'Moderate': 'moderate',
                'Minor': 'minor',
                'Unknown': 'minor'
            };

            const alertData = {
                alert_id: props.id || `NWS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                event: props.event || 'Weather Alert',
                severity: severityMap[props.severity] || 'minor',
                headline: props.headline || '',
                description: props.description || '',
                affected_states: [...new Set(affectedStates)],
                affected_zones: affectedZones,
                start_time: props.effective || new Date().toISOString(),
                end_time: props.expires || null,
                is_active: true
            };

            // Upsert logic: check if alert already exists
            const existingAlert = existingAlerts.find(a => a.alert_id === alertData.alert_id);
            
            if (existingAlert) {
                // Update existing alert
                await base44.asServiceRole.entities.WeatherAlert.update(existingAlert.id, alertData);
                upserted.updated++;
            } else {
                // Create new alert
                await base44.asServiceRole.entities.WeatherAlert.create(alertData);
                upserted.created++;
            }
            
            processedAlerts.push(alertData);
            existingAlertIds.delete(alertData.alert_id); // Remove from set to track stale alerts
        }

        // Deactivate alerts that are no longer in NWS feed
        for (const staleAlert of existingAlerts) {
            if (existingAlertIds.has(staleAlert.alert_id)) {
                await base44.asServiceRole.entities.WeatherAlert.update(staleAlert.id, { is_active: false });
                upserted.deactivated++;
            }
        }

        console.log(`Processed ${processedAlerts.length} alerts - Created: ${upserted.created}, Updated: ${upserted.updated}, Deactivated: ${upserted.deactivated}`);

        return Response.json({
            success: true,
            total_alerts_fetched: alerts.length,
            relevant_alerts_processed: processedAlerts.length,
            created: upserted.created,
            updated: upserted.updated,
            deactivated: upserted.deactivated,
            monitored_states: monitoredStates.length,
            monitored_zones: monitoredZones.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error fetching weather alerts:', error);
        return Response.json({ 
            error: error.message,
            success: false
        }, { status: 500 });
    }
});