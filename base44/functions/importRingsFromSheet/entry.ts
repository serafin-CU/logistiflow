import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the Google Sheet as CSV
    const sheetUrl = 'https://docs.google.com/spreadsheets/d/1po8LhOSISUDBpS08r8TUFB3CTsGykYMXZVVMDnXkcdo/export?format=csv';
    const response = await fetch(sheetUrl);
    const csvText = await response.text();

    // Parse CSV
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    // Map headers
    const storeIdx = headers.indexOf('Store');
    const ringIdIdx = headers.indexOf('Ring ID');
    const postcodeIdx = headers.indexOf('Postcode');
    const cityIdx = headers.indexOf('City');
    const stateIdx = headers.indexOf('State');
    const ringNameIdx = headers.indexOf('Ring Name');
    const deliveryDaysIdx = headers.indexOf('Delivery Days');
    const timeslotsIdx = headers.indexOf('Delivery Timeslots');

    // Group by Ring ID to aggregate zipcodes
    const ringsMap = new Map();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map(v => v.trim());
      
      const store = values[storeIdx] || '';
      const ringId = values[ringIdIdx] || '';
      const postcode = values[postcodeIdx] || '';
      const city = values[cityIdx] || '';
      const state = values[stateIdx] || '';
      const ringName = values[ringNameIdx] || '';
      const deliveryDays = values[deliveryDaysIdx] || '';
      const timeslots = values[timeslotsIdx] || '';

      if (!store || !ringId) continue;

      const key = `${store}-${ringId}`;

      if (!ringsMap.has(key)) {
        // Map store to state abbreviation
        const storeToState = {
          'New York': 'NY',
          'Los Angeles': 'CA',
          'Chicago': 'IL',
          'Houston': 'TX',
          'Miami': 'FL',
          'Boston': 'MA',
          'Seattle': 'WA',
          'Denver': 'CO',
          'Atlanta': 'GA',
          'Phoenix': 'AZ',
          'San Francisco': 'CA',
          'Philadelphia': 'PA',
          'Dallas': 'TX',
          'San Diego': 'CA',
          'San Jose': 'CA'
        };

        ringsMap.set(key, {
          ring_id: `${ringName}-${ringId}`,
          store: store,
          state: storeToState[store] || state || null,
          facility_center: null,
          region_name: ringName,
          delivery_days: deliveryDays ? deliveryDays.split(',').map(d => d.trim()) : [],
          time_slots: timeslots ? timeslots.split(',').map(t => t.trim()) : [],
          zipcodes: [],
          delivery_time_days: 1,
          latitude: null,
          longitude: null,
          is_active: true,
          zones: []
        });
      }

      // Add postcode if not already present
      const ring = ringsMap.get(key);
      if (postcode && !ring.zipcodes.includes(postcode)) {
        ring.zipcodes.push(postcode);
      }
    }

    // Convert to array
    const ringData = Array.from(ringsMap.values());

    // Delete existing rings in batches to avoid rate limits
    const existingRings = await base44.asServiceRole.entities.Ring.list('-created_date', 10000);
    
    // Delete in batches of 50 with delays
    const batchSize = 50;
    for (let i = 0; i < existingRings.length; i += batchSize) {
      const batch = existingRings.slice(i, i + batchSize);
      await Promise.all(batch.map(ring => base44.asServiceRole.entities.Ring.delete(ring.id)));
      
      // Add delay between batches to avoid rate limits
      if (i + batchSize < existingRings.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Bulk create new rings
    await base44.asServiceRole.entities.Ring.bulkCreate(ringData);

    return Response.json({ 
      success: true, 
      imported: ringData.length,
      deleted: existingRings.length
    });

  } catch (error) {
    console.error('Import error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});