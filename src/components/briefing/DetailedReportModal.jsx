import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { 
  Calendar, MapPin, AlertTriangle, Package, Download, 
  Clock, TrendingUp, CheckCircle, XCircle
} from "lucide-react";
import { format, addDays, parseISO } from "date-fns";
import RiskBadge from "@/components/dashboard/RiskBadge";
import { base44 } from "@/api/base44Client";

export default function DetailedReportModal({ open, onOpenChange, recommendation, deliveries = [], alerts = [], rings = [] }) {
  const [activeTab, setActiveTab] = useState("deliveries");

  if (!recommendation) return null;

  // Get affected deliveries from recommendation
  const affectedDeliveries = recommendation.deliveries || [];

  // Get unique ring IDs from deliveries
  const affectedRingIds = [...new Set(affectedDeliveries.map(d => d.ring_id).filter(Boolean))];
  const affectedRings = rings.filter(r => affectedRingIds.includes(r.ring_id));

  // Group deliveries by delivery date
  const deliveriesByDate = affectedDeliveries.reduce((acc, delivery) => {
    const date = delivery.delivery_date || 'No Date';
    if (!acc[date]) acc[date] = [];
    acc[date].push(delivery);
    return acc;
  }, {});

  // Get next 14 days for calendar view
  const getNext14Days = () => {
    const days = [];
    for (let i = 0; i < 14; i++) {
      const date = addDays(new Date(), i);
      const dateStr = format(date, "yyyy-MM-dd");
      const dayDeliveries = affectedDeliveries.filter(d => d.delivery_date === dateStr);
      
      if (dayDeliveries.length > 0) {
        const highRisk = dayDeliveries.filter(d => d.risk_level === 'high' || d.risk_level === 'critical').length;
        days.push({
          date,
          dateStr,
          deliveries: dayDeliveries,
          count: dayDeliveries.length,
          highRisk,
          status: highRisk > 0 ? 'warning' : 'ok'
        });
      }
    }
    return days;
  };

  const calendar = getNext14Days();

  // Export detailed report
  const exportDetailedReport = () => {
    const report = `DETAILED LOGISTICS REPORT
Generated: ${format(new Date(), "PPpp")}

RECOMMENDATION: ${recommendation.title}
Action: ${recommendation.action.toUpperCase()}
Reason: ${recommendation.reason}
${recommendation.alternative ? `Alternative: ${recommendation.alternative}` : ''}
${recommendation.estimated_delay ? `Estimated Delay: ${recommendation.estimated_delay}` : ''}

AFFECTED DELIVERIES (${affectedDeliveries.length} total)
${'='.repeat(60)}
${affectedDeliveries.map(d => `
Tracking: ${d.tracking_id}
Location: ${d.city}, ${d.state} (${d.zipcode})
Delivery Date: ${d.delivery_date ? format(parseISO(d.delivery_date), 'PPP') : 'N/A'}
Risk: ${d.risk_level?.toUpperCase() || 'N/A'} (Score: ${d.risk_score || 0})
Ring: ${d.ring_id || 'N/A'}
Alerts: ${d.weather_alerts?.join(', ') || 'None'}
${'-'.repeat(60)}
`).join('\n')}

AFFECTED RINGS (${affectedRings.length} total)
${'='.repeat(60)}
${affectedRings.map(r => `
Ring ID: ${r.ring_id}
Store: ${r.store}
State: ${r.state || 'N/A'}
Region: ${r.region_name || 'N/A'}
Facility: ${r.facility_center || 'N/A'}
Delivery Days: ${r.delivery_days?.join(', ') || 'N/A'}
Time Slots: ${r.time_slots?.join(', ') || 'N/A'}
Zipcodes: ${r.zipcodes?.length || 0} covered
${'-'.repeat(60)}
`).join('\n')}

DELIVERY CALENDAR (Next 14 Days)
${'='.repeat(60)}
${calendar.map(day => `
${format(day.date, 'EEEE, MMMM d, yyyy')}
  Total Deliveries: ${day.count}
  High Risk: ${day.highRisk}
  Status: ${day.status.toUpperCase()}
  
  Deliveries:
${day.deliveries.map(d => `    - ${d.tracking_id} (${d.city}, ${d.state}) - ${d.risk_level}`).join('\n')}
${'-'.repeat(60)}
`).join('\n')}
`;

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `detailed-report-${format(new Date(), "yyyy-MM-dd-HHmm")}.txt`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            {recommendation.title}
          </DialogTitle>
        </DialogHeader>

        {/* Action Summary */}
        <Card className="border-2 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-blue-900 mb-2">Action Required: {recommendation.action.toUpperCase()}</p>
                <p className="text-sm text-blue-800">{recommendation.reason}</p>
                {recommendation.alternative && (
                  <div className="mt-3 p-3 bg-white rounded-lg border border-blue-200">
                    <p className="text-xs font-medium text-blue-900">💡 Recommended Alternative</p>
                    <p className="text-sm text-blue-700 mt-1">{recommendation.alternative}</p>
                  </div>
                )}
                {recommendation.estimated_delay && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-blue-700">
                    <Clock className="w-4 h-4" />
                    Estimated Delay: {recommendation.estimated_delay}
                  </div>
                )}
              </div>
              <Button onClick={exportDetailedReport} variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="deliveries">
              Deliveries ({affectedDeliveries.length})
            </TabsTrigger>
            <TabsTrigger value="calendar">
              Calendar ({calendar.length} days)
            </TabsTrigger>
            <TabsTrigger value="rings">
              Rings ({affectedRings.length})
            </TabsTrigger>
          </TabsList>

          {/* Deliveries Tab */}
          <TabsContent value="deliveries" className="space-y-3 mt-4">
            {affectedDeliveries.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No deliveries affected</p>
            ) : (
              affectedDeliveries.map(delivery => (
                <Card key={delivery.id} className="border-l-4" style={{ borderLeftColor: 
                  delivery.risk_level === 'critical' ? '#dc2626' : 
                  delivery.risk_level === 'high' ? '#f59e0b' : 
                  delivery.risk_level === 'medium' ? '#3b82f6' : '#10b981'
                }}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-4 h-4 text-slate-500" />
                          <p className="font-semibold text-slate-900">{delivery.tracking_id}</p>
                          <RiskBadge level={delivery.risk_level} />
                        </div>
                        <div className="space-y-1 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3" />
                            {delivery.city}, {delivery.state} ({delivery.zipcode})
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            {delivery.delivery_date ? format(parseISO(delivery.delivery_date), 'PPP') : 'No date'}
                          </div>
                          {delivery.ring_id && (
                            <p className="text-xs text-slate-500">Ring: {delivery.ring_id}</p>
                          )}
                        </div>
                        {delivery.weather_alerts && delivery.weather_alerts.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {delivery.weather_alerts.map((alert, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {alert}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-500">Risk Score</p>
                        <p className="text-2xl font-bold text-slate-900">{delivery.risk_score || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="space-y-3 mt-4">
            {calendar.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No deliveries scheduled in the next 14 days</p>
            ) : (
              calendar.map((day, idx) => (
                <Card 
                  key={idx}
                  className={`border-2 ${day.status === 'warning' ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}`}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {format(day.date, 'EEEE, MMMM d, yyyy')}
                      </div>
                      <div className="flex items-center gap-2">
                        {day.status === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        )}
                        <Badge className={day.status === 'warning' ? 'bg-amber-600' : 'bg-emerald-600'}>
                          {day.count} deliveries
                        </Badge>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {day.deliveries.map(delivery => (
                        <div key={delivery.id} className="flex items-center justify-between text-sm p-2 bg-white rounded-lg">
                          <div className="flex items-center gap-2">
                            <Package className="w-3 h-3 text-slate-400" />
                            <span className="font-medium">{delivery.tracking_id}</span>
                            <span className="text-slate-500">• {delivery.city}, {delivery.state}</span>
                          </div>
                          <RiskBadge level={delivery.risk_level} />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Rings Tab */}
          <TabsContent value="rings" className="space-y-3 mt-4">
            {affectedRings.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No rings affected</p>
            ) : (
              affectedRings.map(ring => (
                <Card key={ring.id}>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-purple-600" />
                      Ring {ring.ring_id}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-slate-500">Store</p>
                        <p className="font-semibold text-slate-900">{ring.store}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">State</p>
                        <p className="font-semibold text-slate-900">{ring.state || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Region</p>
                        <p className="text-slate-900">{ring.region_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Facility</p>
                        <p className="text-slate-900">{ring.facility_center || 'N/A'}</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-slate-500 mb-1">Delivery Days</p>
                        <div className="flex flex-wrap gap-1">
                          {ring.delivery_days?.map((day, idx) => (
                            <Badge key={idx} variant="outline">{day}</Badge>
                          )) || <span className="text-slate-400">N/A</span>}
                        </div>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-1">Time Slots</p>
                        <div className="flex flex-wrap gap-1">
                          {ring.time_slots?.map((slot, idx) => (
                            <Badge key={idx} variant="outline">{slot}</Badge>
                          )) || <span className="text-slate-400">N/A</span>}
                        </div>
                      </div>
                      <div>
                        <p className="text-slate-500">Zipcodes Covered</p>
                        <p className="text-slate-900">{ring.zipcodes?.length || 0} zipcodes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}