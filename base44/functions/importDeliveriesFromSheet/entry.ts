import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Imports delivery data from Google Sheets "Customers affected masterlist" tab
 * Uses orderId as the tracking identifier
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        const accessToken = await base44.asServiceRole.connectors.getAccessToken("googlesheets");

        // Extract spreadsheet ID from URL
        const spreadsheetId = '16drxX5ZfUJp1eqePL9Pojx7_Y6Q7tSQg8fLRWSQPdYI';
        const sheetName = 'Customers affected masterlist';

        // Fetch data from Google Sheets
        const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
        const response = await fetch(sheetsUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Google Sheets API error: ${response.status}`);
        }

        const data = await response.json();
        const rows = data.values || [];

        if (rows.length === 0) {
            return Response.json({ error: 'No data found in sheet' }, { status: 400 });
        }

        // Parse header row
        const headers = rows[0].map(h => h.toLowerCase().trim());
        const dataRows = rows.slice(1);

        console.log(`Found ${dataRows.length} rows with headers:`, headers);

        // Map columns to delivery fields
        const getColumnIndex = (name) => headers.indexOf(name);
        
        const orderIdIdx = getColumnIndex('orderid');
        const zipcodeIdx = getColumnIndex('zipcode') || getColumnIndex('zip code') || getColumnIndex('zip');
        const deliveryDateIdx = getColumnIndex('delivery date') || getColumnIndex('deliverydate') || getColumnIndex('date');
        const cityIdx = getColumnIndex('city');
        const stateIdx = getColumnIndex('state');
        const statusIdx = getColumnIndex('status');
        const notesIdx = getColumnIndex('notes');
        const ringIdIdx = getColumnIndex('ring id') || getColumnIndex('ringid') || getColumnIndex('ring');

        if (orderIdIdx === -1) {
            return Response.json({ error: 'orderId column not found in spreadsheet' }, { status: 400 });
        }

        // Process deliveries
        const deliveries = [];
        const errors = [];

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const orderId = row[orderIdIdx]?.trim();

            if (!orderId) {
                errors.push(`Row ${i + 2}: Missing orderId`);
                continue;
            }

            const deliveryData = {
                tracking_id: orderId,
                zipcode: row[zipcodeIdx]?.trim() || '',
                delivery_date: row[deliveryDateIdx]?.trim() || '',
                city: row[cityIdx]?.trim() || '',
                state: row[stateIdx]?.trim() || '',
                status: row[statusIdx]?.trim()?.toLowerCase() || 'scheduled',
                notes: row[notesIdx]?.trim() || ''
            };

            // Add ring_id if column exists
            if (ringIdIdx !== -1 && row[ringIdIdx]) {
                deliveryData.ring_id = row[ringIdIdx].trim();
            }

            // Validate required fields
            if (!deliveryData.zipcode || !deliveryData.delivery_date) {
                errors.push(`Row ${i + 2}: Missing zipcode or delivery_date for orderId ${orderId}`);
                continue;
            }

            deliveries.push(deliveryData);
        }

        console.log(`Parsed ${deliveries.length} valid deliveries, ${errors.length} errors`);

        // Check for existing deliveries and upsert
        const existingDeliveries = await base44.asServiceRole.entities.Delivery.list();
        const existingTrackingIds = new Set(existingDeliveries.map(d => d.tracking_id));

        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (const delivery of deliveries) {
            const existing = existingDeliveries.find(d => d.tracking_id === delivery.tracking_id);
            
            if (existing) {
                // Update existing delivery
                await base44.asServiceRole.entities.Delivery.update(existing.id, delivery);
                updated++;
            } else {
                // Create new delivery
                await base44.asServiceRole.entities.Delivery.create(delivery);
                created++;
            }
        }

        // Calculate risks for new/updated deliveries
        console.log('Triggering risk calculation...');
        await base44.functions.invoke('recalculateAllDeliveryRisks', {});

        return Response.json({
            success: true,
            total_rows: dataRows.length,
            deliveries_processed: deliveries.length,
            created,
            updated,
            skipped,
            errors: errors.length > 0 ? errors.slice(0, 10) : [],
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error importing deliveries:', error);
        return Response.json({ 
            error: error.message,
            success: false
        }, { status: 500 });
    }
});