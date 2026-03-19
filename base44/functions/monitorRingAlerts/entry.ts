import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Get all active rings and alerts
        const rings = await base44.asServiceRole.entities.Ring.filter({ is_active: true });
        const alerts = await base44.asServiceRole.entities.WeatherAlert.filter({ is_active: true });
        
        // Get notification recipients
        const recipients = await base44.asServiceRole.entities.NotificationRecipient.filter({ is_active: true });
        
        if (recipients.length === 0) {
            return Response.json({ 
                success: true, 
                message: "No notification recipients configured" 
            });
        }
        
        // Find rings affected by current alerts
        const affectedRings = [];
        
        for (const ring of rings) {
            if (!ring.zones || ring.zones.length === 0) continue;
            
            // Find alerts matching this ring's zones
            const matchingAlerts = alerts.filter(alert => 
                alert.affected_zones?.some(zone => ring.zones.includes(zone)) ||
                alert.affected_states?.includes(ring.state)
            );
            
            if (matchingAlerts.length > 0) {
                const severities = matchingAlerts.map(a => a.severity);
                const hasSevere = severities.includes('severe') || severities.includes('extreme');
                
                affectedRings.push({
                    ring,
                    alerts: matchingAlerts,
                    highestSeverity: hasSevere ? 'severe' : 
                                    severities.includes('moderate') ? 'moderate' : 'minor'
                });
            }
        }
        
        if (affectedRings.length === 0) {
            return Response.json({ 
                success: true, 
                message: "No rings affected by current alerts" 
            });
        }
        
        // Send notifications to relevant recipients
        const notifications = [];
        
        for (const recipient of recipients) {
            // Filter affected rings by recipient's severity levels and stores
            const relevantRings = affectedRings.filter(({ ring, highestSeverity, alerts }) => {
                const severityMatch = recipient.severity_levels.includes(highestSeverity) ||
                                     alerts.some(a => recipient.severity_levels.includes(a.severity));
                const storeMatch = !recipient.stores || recipient.stores.length === 0 || 
                                  recipient.stores.includes(ring.store);
                return severityMatch && storeMatch;
            });
            
            if (relevantRings.length === 0) continue;
            
            // Build email content
            const emailBody = `
<h2>Weather Alert Notification</h2>
<p><strong>${relevantRings.length}</strong> ring(s) are affected by active weather alerts:</p>

${relevantRings.map(({ ring, alerts }) => `
<div style="margin: 20px 0; padding: 15px; border-left: 4px solid #f59e0b; background: #fffbeb;">
    <h3>${ring.ring_id} - ${ring.store}</h3>
    <p><strong>Location:</strong> ${ring.region_name || 'N/A'} (${ring.state})</p>
    <p><strong>Delivery Days:</strong> ${ring.delivery_days?.join(', ') || 'N/A'}</p>
    <h4>Active Alerts:</h4>
    <ul>
        ${alerts.map(alert => `
            <li>
                <strong>${alert.event}</strong> (${alert.severity.toUpperCase()})
                <br>${alert.headline || ''}
                <br><em>Until: ${alert.end_time ? new Date(alert.end_time).toLocaleString() : 'Unknown'}</em>
            </li>
        `).join('')}
    </ul>
</div>
`).join('')}

<p style="margin-top: 20px; color: #64748b;">
    <small>This is an automated notification from WeatherShield. 
    Log in to your dashboard for more details and recommendations.</small>
</p>
            `.trim();
            
            try {
                await base44.asServiceRole.integrations.Core.SendEmail({
                    to: recipient.email,
                    subject: `⚠️ Weather Alert: ${relevantRings.length} Ring(s) Affected`,
                    body: emailBody
                });
                
                notifications.push({
                    recipient: recipient.email,
                    rings_count: relevantRings.length,
                    status: 'sent'
                });
            } catch (error) {
                notifications.push({
                    recipient: recipient.email,
                    status: 'failed',
                    error: error.message
                });
            }
        }
        
        return Response.json({
            success: true,
            summary: {
                affected_rings: affectedRings.length,
                notifications_sent: notifications.filter(n => n.status === 'sent').length,
                notifications_failed: notifications.filter(n => n.status === 'failed').length
            },
            notifications
        });
        
    } catch (error) {
        console.error('Monitor ring alerts error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});