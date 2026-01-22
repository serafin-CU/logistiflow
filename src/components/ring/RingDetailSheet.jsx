import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Calendar, MapPin, Clock, AlertTriangle } from "lucide-react";
import { format, addDays, isSameDay, parseISO } from "date-fns";

export default function RingDetailSheet({ ring, alerts, open, onOpenChange }) {
  if (!ring) return null;

  // Get next 14 days of delivery dates
  const getNextDeliveryDates = () => {
    const dates = [];
    const today = new Date();
    const dayMap = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
      'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };

    for (let i = 0; i < 14; i++) {
      const date = addDays(today, i);
      const dayName = format(date, 'EEEE');
      
      if (ring.delivery_days?.includes(dayName)) {
        dates.push(date);
      }
    }
    return dates;
  };

  // Match alerts to delivery dates
  const getAlertsForDeliveryDates = () => {
    const deliveryDates = getNextDeliveryDates();
    
    return deliveryDates.map(date => {
      const relevantAlerts = alerts.filter(alert => {
        if (!alert.is_active) return false;
        
        // Check if alert affects this ring's state/zones
        const affectsRing = alert.affected_states?.includes(ring.state) || 
                           alert.affected_zones?.some(zone => ring.zones?.includes(zone));
        
        if (!affectsRing) return false;

        // Check if alert is active on delivery date
        const alertStart = alert.start_time ? parseISO(alert.start_time) : null;
        const alertEnd = alert.end_time ? parseISO(alert.end_time) : null;
        
        if (alertStart && alertEnd) {
          return date >= alertStart && date <= alertEnd;
        }
        return true;
      });

      const highestSeverity = relevantAlerts.reduce((max, alert) => {
        const severityRank = { minor: 1, moderate: 2, severe: 3, extreme: 4 };
        const alertRank = severityRank[alert.severity] || 0;
        return alertRank > max ? alertRank : max;
      }, 0);

      return {
        date,
        alerts: relevantAlerts,
        severity: Object.keys({ minor: 1, moderate: 2, severe: 3, extreme: 4 })[highestSeverity - 1] || 'none'
      };
    });
  };

  const deliverySchedule = getAlertsForDeliveryDates();

  const severityColors = {
    none: 'bg-green-100 text-green-800 border-green-200',
    minor: 'bg-blue-100 text-blue-800 border-blue-200',
    moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    severe: 'bg-orange-100 text-orange-800 border-orange-200',
    extreme: 'bg-red-100 text-red-800 border-red-200'
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl flex items-center gap-2">
            <MapPin className="w-6 h-6 text-purple-600" />
            Ring {ring.ring_id}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Ring Details */}
          <Card className="p-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">Store</p>
                <p className="font-semibold text-slate-900">{ring.store}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Facility</p>
                <p className="text-slate-900">{ring.facility_center || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Delivery Days</p>
                <p className="text-slate-900">{ring.delivery_days?.join(', ') || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Time Slots</p>
                <p className="text-slate-900">{ring.time_slots?.join(', ') || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Region</p>
                <p className="text-slate-900">{ring.region_name || 'N/A'}</p>
              </div>
            </div>
          </Card>

          {/* Upcoming Deliveries & Alerts */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              Upcoming Delivery Dates & Weather Alerts
            </h3>

            <div className="space-y-3">
              {deliverySchedule.length === 0 ? (
                <p className="text-slate-500 text-sm">No upcoming deliveries in the next 14 days</p>
              ) : (
                deliverySchedule.map((schedule, idx) => (
                  <Card 
                    key={idx} 
                    className={`p-4 border-2 ${severityColors[schedule.severity]}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {format(schedule.date, 'EEEE, MMMM d, yyyy')}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          {ring.time_slots?.[0] || 'No time specified'}
                        </p>
                      </div>
                      {schedule.alerts.length === 0 ? (
                        <Badge className="bg-green-600">All Clear</Badge>
                      ) : (
                        <Badge className="bg-red-600">
                          {schedule.alerts.length} Alert{schedule.alerts.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>

                    {schedule.alerts.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {schedule.alerts.map((alert, alertIdx) => (
                          <div 
                            key={alertIdx}
                            className="bg-white bg-opacity-50 rounded-lg p-3 border border-slate-200"
                          >
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-slate-900">
                                  {alert.event}
                                </p>
                                <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                                  {alert.headline}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs">
                                    {alert.severity}
                                  </Badge>
                                  {alert.end_time && (
                                    <p className="text-xs text-slate-500">
                                      Until {format(parseISO(alert.end_time), 'MMM d, h:mm a')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}