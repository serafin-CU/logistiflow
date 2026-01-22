import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Fetches live weather alerts from weather.gov National Weather Service API
 * Updates weather alerts in the database with real-time data
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

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

        console.log(`Fetched ${alerts.length} active alerts from NWS`);

        // Clear existing alerts
        const existingAlerts = await base44.asServiceRole.entities.WeatherAlert.list();
        for (const alert of existingAlerts) {
            await base44.asServiceRole.entities.WeatherAlert.delete(alert.id);
        }

        // Process and store new alerts
        const processedAlerts = [];
        for (const feature of alerts) {
            const props = feature.properties;
            
            // Extract affected states from affected zones
            const affectedStates = new Set();
            if (props.areaDesc) {
                // Extract state abbreviations from area description
                const stateMatches = props.areaDesc.match(/\b[A-Z]{2}\b/g);
                if (stateMatches) {
                    stateMatches.forEach(state => affectedStates.add(state));
                }
            }

            // Map NWS severity to our system
            const severityMap = {
                'Extreme': 'extreme',
                'Severe': 'severe',
                'Moderate': 'moderate',
                'Minor': 'minor',
                'Unknown': 'minor'
            };

            const alert = {
                alert_id: props.id || `NWS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                event: props.event || 'Weather Alert',
                severity: severityMap[props.severity] || 'minor',
                headline: props.headline || '',
                description: props.description || '',
                affected_states: Array.from(affectedStates),
                affected_zones: props.affectedZones || [],
                start_time: props.effective || new Date().toISOString(),
                end_time: props.expires || null,
                is_active: true
            };

            const created = await base44.asServiceRole.entities.WeatherAlert.create(alert);
            processedAlerts.push(created);
        }

        console.log(`Stored ${processedAlerts.length} alerts in database`);

        return Response.json({
            success: true,
            alerts_fetched: alerts.length,
            alerts_stored: processedAlerts.length,
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