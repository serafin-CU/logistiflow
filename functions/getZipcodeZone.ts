import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Gets NWS zone information for a zipcode
 * Uses weather.gov API to find the zone for precise alert matching
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { zipcode } = await req.json();

        if (!zipcode) {
            return Response.json({ error: 'Zipcode required' }, { status: 400 });
        }

        // Use free zipcode API to get lat/long
        const zipResponse = await fetch(`https://api.zippopotam.us/us/${zipcode}`);
        
        if (!zipResponse.ok) {
            return Response.json({ 
                error: 'Invalid zipcode or zipcode not found',
                zipcode 
            }, { status: 404 });
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

        if (!nwsResponse.ok) {
            return Response.json({
                zipcode,
                latitude: lat,
                longitude: lon,
                county: zipData.places[0]['place name'],
                state: zipData.places[0]['state abbreviation'],
                zone: null
            });
        }

        const nwsData = await nwsResponse.json();
        const zone = nwsData.properties?.county || nwsData.properties?.forecastZone;
        const zoneId = zone ? zone.split('/').pop() : null;

        return Response.json({
            zipcode,
            latitude: lat,
            longitude: lon,
            county: zipData.places[0]['place name'],
            state: zipData.places[0]['state abbreviation'],
            zone: zoneId,
            forecast_zone: nwsData.properties?.forecastZone?.split('/').pop(),
            county_zone: nwsData.properties?.county?.split('/').pop()
        });

    } catch (error) {
        console.error('Error getting zipcode zone:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});