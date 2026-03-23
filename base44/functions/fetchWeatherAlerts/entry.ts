import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Fetches live weather alerts from weather.gov National Weather Service API
 * Updates weather alerts in the database with real-time data
 * Implements exponential backoff and rate limit handling
 */

// In-memory cache to prevent redundant API calls (persists during function execution)
const cache = {
    lastFetch: null,
    data: null,
    MIN_INTERVAL_MS: 5 * 60 * 1000 // 5 minutes minimum between fetches
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Check cache to avoid hitting NWS API too frequently
        const now = Date.now();
        if (cache.lastFetch && cache.data && (now - cache.lastFetch) < cache.MIN_INTERVAL_MS) {
            console.log(`Using cached data from ${Math.floor((now - cache.lastFetch) / 1000)}s ago`);
            return Response.json({
                success: true,
                cached: true,
                age_seconds: Math.floor((now - cache.lastFetch) / 1000),
                ...cache.data
            });
        }

        // Fetch all rings to identify zones and states to monitor
        const rings = await base44.asServiceRole.entities.Ring.list();
        const monitoredStates = [...new Set(rings.map(r => r.state).filter(Boolean))];
        const monitoredZones = [...new Set(rings.flatMap(r => r.zones || []))];

        console.log(`Monitoring ${monitoredStates.length} states and ${monitoredZones.length} zones`);

        // Fetch active alerts from NWS API with exponential backoff
        let response;
        let retryCount = 0;
        const maxRetries = 5;
        
        while (retryCount <= maxRetries) {
            try {
                response = await fetch('https://api.weather.gov/alerts/active', {
                    headers: {
                        'User-Agent': 'WeatherShield-Logistics-App/1.0 (contact@weathershield.com)',
                        'Accept': 'application/geo+json'
                    }
                });

                if (response.status === 429) {
                    // Rate limit hit - use exponential backoff
                    const retryAfter = response.headers.get('Retry-After');
                    let waitTime;
                    
                    if (retryAfter) {
                        // Use Retry-After header if provided
                        waitTime = parseInt(retryAfter) * 1000;
                    } else {
                        // Exponential backoff: 2^retry * base delay (30s)
                        waitTime = Math.min(Math.pow(2, retryCount) * 30 * 1000, 5 * 60 * 1000); // Max 5 minutes
                    }
                    
                    if (retryCount < maxRetries) {
                        console.log(`Rate limit hit. Waiting ${Math.floor(waitTime / 1000)}s before retry ${retryCount + 1}/${maxRetries}`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        retryCount++;
                        continue;
                    } else {
                        // Return last successful data from cache if available
                        if (cache.data) {
                            console.log('Max retries exceeded, returning cached data');
                            return Response.json({
                                success: true,
                                cached: true,
                                warning: 'Rate limit exceeded, using cached data',
                                age_seconds: Math.floor((now - cache.lastFetch) / 1000),
                                ...cache.data
                            });
                        }
                        throw new Error('Rate limit exceeded. Please increase automation interval to 30+ minutes.');
                    }
                }

                if (!response.ok) {
                    throw new Error(`NWS API error: ${response.status} - ${response.statusText}`);
                }

                break; // Success, exit retry loop
            } catch (fetchError) {
                if (retryCount < maxRetries && fetchError.message.includes('fetch')) {
                    // Network error - retry with exponential backoff
                    const waitTime = Math.pow(2, retryCount) * 5000; // 5s, 10s, 20s, 40s, 80s
                    console.log(`Network error. Waiting ${Math.floor(waitTime / 1000)}s before retry ${retryCount + 1}/${maxRetries}`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    retryCount++;
                    continue;
                }
                throw fetchError;
            }
        }

        const data = await response.json();
        const alerts = data.features || [];

        console.log(`Fetched ${alerts.length} total alerts from NWS`);

        // Get existing alerts for upsert logic
        const existingAlerts = await base44.asServiceRole.entities.WeatherAlert.list();
        const existingByAlertId = new Map(existingAlerts.map(a => [a.alert_id, a]));
        const seenAlertIds = new Set();

        // Process and categorize alerts
        const toCreate = [];
        const toUpdate = []; // { id, data }
        const processedAlerts = [];
        const upserted = { created: 0, updated: 0, deactivated: 0 };

        const severityMap = {
            'Extreme': 'extreme',
            'Severe': 'severe',
            'Moderate': 'moderate',
            'Minor': 'minor',
            'Unknown': 'minor'
        };
        
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

            // Check if this alert affects any of our monitored zones or states
            const isRelevant = 
                affectedZones.some(zone => monitoredZones.includes(zone)) ||
                affectedStates.some(state => monitoredStates.includes(state)) ||
                monitoredStates.length === 0;

            if (!isRelevant) continue;

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

            seenAlertIds.add(alertData.alert_id);
            processedAlerts.push(alertData);

            const existing = existingByAlertId.get(alertData.alert_id);
            if (existing) {
                // Only update if something actually changed
                const changed = existing.severity !== alertData.severity ||
                    existing.headline !== alertData.headline ||
                    existing.end_time !== alertData.end_time ||
                    existing.is_active !== true;
                if (changed) {
                    toUpdate.push({ id: existing.id, data: alertData });
                }
            } else {
                toCreate.push(alertData);
            }
        }

        // Bulk create new alerts (single API call)
        if (toCreate.length > 0) {
            await base44.asServiceRole.entities.WeatherAlert.bulkCreate(toCreate);
            upserted.created = toCreate.length;
            console.log(`Bulk created ${toCreate.length} new alerts`);
        }

        // Throttled updates — 5 at a time with a small delay to avoid rate limits
        const BATCH_SIZE = 5;
        const BATCH_DELAY_MS = 300;
        for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
            const batch = toUpdate.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(({ id, data }) =>
                base44.asServiceRole.entities.WeatherAlert.update(id, data)
            ));
            upserted.updated += batch.length;
            if (i + BATCH_SIZE < toUpdate.length) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
            }
        }
        console.log(`Updated ${upserted.updated} changed alerts`);

        // Deactivate stale alerts in throttled batches
        const staleAlerts = existingAlerts.filter(a => !seenAlertIds.has(a.alert_id) && a.is_active);
        for (let i = 0; i < staleAlerts.length; i += BATCH_SIZE) {
            const batch = staleAlerts.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(a =>
                base44.asServiceRole.entities.WeatherAlert.update(a.id, { is_active: false })
            ));
            upserted.deactivated += batch.length;
            if (i + BATCH_SIZE < staleAlerts.length) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
            }
        }

        console.log(`Processed ${processedAlerts.length} alerts - Created: ${upserted.created}, Updated: ${upserted.updated}, Deactivated: ${upserted.deactivated}`);

        const result = {
            success: true,
            total_alerts_fetched: alerts.length,
            relevant_alerts_processed: processedAlerts.length,
            created: upserted.created,
            updated: upserted.updated,
            deactivated: upserted.deactivated,
            monitored_states: monitoredStates.length,
            monitored_zones: monitoredZones.length,
            timestamp: new Date().toISOString()
        };

        // Update cache
        cache.lastFetch = now;
        cache.data = result;

        return Response.json(result);

    } catch (error) {
        console.error('Error fetching weather alerts:', error);
        return Response.json({ 
            error: error.message,
            success: false
        }, { status: 500 });
    }
});