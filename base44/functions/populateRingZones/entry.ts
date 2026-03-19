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

                // Get zone data for first zipcode - pad with leading zero if needed
                let zipcode = ring.zipcodes[0];
                if (zipcode.length === 4) {
                    zipcode = '0' + zipcode;
                }
                
                // Use free zipcode API to get lat/long
                const zipResponse = await fetch(`https://api.zippopotam.us/us/${zipcode}`);
                
                if (!zipResponse.ok) {
                    errors++;
                    details.push({ ring_id: ring.ring_id, status: 'error', error: `Invalid zipcode: ${zipcode}` });
                    continue;
                }

                const zipData = await zipResponse.json();
                const lat = parseFloat(zipData.places[0].latitude);
                const lon = parseFloat(zipData.places[0].longitude);

                // Get NWS zone from lat/long
                const nwsResponse = await fetch(
                    `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
                    {
                        headers: {
                            'User-Agent': 'WeatherShield Logistics App'
                        }
                    }
                );

                let zoneData = {
                    zipcode,
                    latitude: lat,
                    longitude: lon,
                    county: zipData.places[0]['place name'],
                    state: zipData.places[0]['state abbreviation'],
                    zone: null,
                    forecast_zone: null,
                    county_zone: null
                };

                if (nwsResponse.ok) {
                    const nwsData = await nwsResponse.json();
                    const zone = nwsData.properties?.county || nwsData.properties?.forecastZone;
                    zoneData.zone = zone ? zone.split('/').pop() : null;
                    zoneData.forecast_zone = nwsData.properties?.forecastZone?.split('/').pop();
                    zoneData.county_zone = nwsData.properties?.county?.split('/').pop();
                }

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

        // Trigger weather alerts fetch after successful zone population
        try {
            console.log('Triggering weather alerts fetch...');
            await base44.functions.invoke('fetchWeatherAlerts', {});
        } catch (error) {
            console.warn('Failed to trigger weather alerts fetch:', error.message);
        }
        
        return Response.json({
            success: true,
            summary: {
                total_rings: rings.length,
                updated,
                skipped,
                errors
            },
            details,
            alerts_fetch_triggered: true
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});