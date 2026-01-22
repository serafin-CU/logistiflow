import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Analyzes weather risk for a specific ring or region
 * Returns affected rings, alerts, and recommendations
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { latitude, longitude, radius = 50 } = await req.json();

        if (!latitude || !longitude) {
            return Response.json({ error: 'Latitude and longitude required' }, { status: 400 });
        }

        // Get all active alerts
        const alerts = await base44.entities.WeatherAlert.filter({ is_active: true });

        // Get rings near this location
        const allRings = await base44.entities.Ring.filter({ is_active: true });
        
        // Simple distance calculation (approximate)
        const nearbyRings = allRings.filter(ring => {
            if (!ring.latitude || !ring.longitude) return false;
            const distance = Math.sqrt(
                Math.pow(ring.latitude - latitude, 2) + 
                Math.pow(ring.longitude - longitude, 2)
            ) * 69; // Convert to approximate miles
            return distance <= radius;
        });

        // Find relevant alerts for this area
        const relevantAlerts = [];
        const affectedRings = [];
        const recommendations = [];

        // Match alerts to rings based on zipcodes and location
        for (const alert of alerts) {
            for (const ring of nearbyRings) {
                // Check if any ring zipcodes are in affected area
                // For now, we'll use state matching
                const ringStates = new Set();
                
                // Try to determine state from ring data or region
                if (ring.store) {
                    const stateMap = {
                        'New York': 'NY',
                        'Los Angeles': 'CA',
                        'Chicago': 'IL',
                        'Houston': 'TX',
                        'Miami': 'FL',
                        'Boston': 'MA',
                        'Seattle': 'WA',
                        'Denver': 'CO',
                        'Atlanta': 'GA',
                        'Phoenix': 'AZ'
                    };
                    const state = stateMap[ring.store];
                    if (state) ringStates.add(state);
                }

                const isAffected = alert.affected_states?.some(state => 
                    ringStates.has(state)
                );

                if (isAffected && !affectedRings.find(r => r.id === ring.id)) {
                    affectedRings.push(ring);
                    if (!relevantAlerts.find(a => a.id === alert.id)) {
                        relevantAlerts.push(alert);
                    }
                }
            }
        }

        // Generate recommendations based on severity
        const extremeAlerts = relevantAlerts.filter(a => a.severity === 'extreme');
        const severeAlerts = relevantAlerts.filter(a => a.severity === 'severe');

        if (extremeAlerts.length > 0) {
            recommendations.push({
                action: 'halt',
                priority: 'critical',
                message: `IMMEDIATE ACTION: ${extremeAlerts.length} extreme weather alert(s) active. Halt all deliveries in affected rings.`,
                affected_rings: affectedRings.filter(r => 
                    r.delivery_time_days === 1
                ).map(r => r.ring_id)
            });
        }

        if (severeAlerts.length > 0) {
            recommendations.push({
                action: 'delay',
                priority: 'high',
                message: `Severe weather detected. Delay deliveries by 24-48 hours for ${affectedRings.length} ring(s).`,
                affected_rings: affectedRings.map(r => r.ring_id)
            });
        }

        if (relevantAlerts.length > 0 && extremeAlerts.length === 0 && severeAlerts.length === 0) {
            recommendations.push({
                action: 'monitor',
                priority: 'medium',
                message: `Weather alerts active in area. Monitor conditions closely.`,
                affected_rings: affectedRings.map(r => r.ring_id)
            });
        }

        if (relevantAlerts.length === 0) {
            recommendations.push({
                action: 'proceed',
                priority: 'low',
                message: 'No weather alerts in this area. Safe to proceed with deliveries.',
                affected_rings: []
            });
        }

        return Response.json({
            success: true,
            location: { latitude, longitude },
            alerts: relevantAlerts.map(a => ({
                event: a.event,
                severity: a.severity,
                headline: a.headline,
                expires: a.end_time
            })),
            affected_rings: affectedRings.map(r => ({
                ring_id: r.ring_id,
                store: r.store,
                region_name: r.region_name,
                delivery_days: r.delivery_days,
                time_slots: r.time_slots,
                delivery_time_days: r.delivery_time_days
            })),
            recommendations,
            summary: {
                total_alerts: relevantAlerts.length,
                rings_affected: affectedRings.length,
                highest_severity: relevantAlerts.length > 0 
                    ? relevantAlerts.reduce((max, a) => {
                        const severities = ['minor', 'moderate', 'severe', 'extreme'];
                        return severities.indexOf(a.severity) > severities.indexOf(max) ? a.severity : max;
                    }, 'minor')
                    : 'none'
            }
        });

    } catch (error) {
        console.error('Error analyzing ring risk:', error);
        return Response.json({ 
            error: error.message,
            success: false
        }, { status: 500 });
    }
});