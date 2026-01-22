import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, Clock, AlertTriangle, Filter } from "lucide-react";
import { format, addDays, isSameDay, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";

export default function RingDetailSheet({ ring, alerts, open, onOpenChange }) {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  
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

  // Get ALL active alerts affecting this ring
  const getAllRingAlerts = () => {
    return alerts.filter(alert => {
      if (!alert.is_active) return false;
      
      // Check if alert affects this ring's state/zones
      const affectsRing = alert.affected_states?.includes(ring.state) || 
                         alert.affected_zones?.some(zone => ring.zones?.includes(zone));
      
      return affectsRing;
    });
  };

  const allRingAlerts = getAllRingAlerts();

  // Filter alerts based on user selections
  const getFilteredAlerts = () => {
    let filtered = [...allRingAlerts];

    // Severity filter
    if (severityFilter !== "all") {
      filtered = filtered.filter(alert => alert.severity === severityFilter);
    }

    // Date range filter
    const now = new Date();
    if (dateRange === "today") {
      filtered = filtered.filter(alert => {
        const start = alert.start_time ? parseISO(alert.start_time) : null;
        const end = alert.end_time ? parseISO(alert.end_time) : null;
        const today = startOfDay(now);
        const todayEnd = endOfDay(now);
        
        if (start && end) {
          return (isBefore(start, todayEnd) && isAfter(end, today));
        }
        return true;
      });
    } else if (dateRange === "week") {
      const weekEnd = addDays(now, 7);
      filtered = filtered.filter(alert => {
        const start = alert.start_time ? parseISO(alert.start_time) : null;
        if (start) {
          return isBefore(start, weekEnd);
        }
        return true;
      });
    } else if (dateRange === "month") {
      const monthEnd = addDays(now, 30);
      filtered = filtered.filter(alert => {
        const start = alert.start_time ? parseISO(alert.start_time) : null;
        if (start) {
          return isBefore(start, monthEnd);
        }
        return true;
      });
    }

    return filtered;
  };

  const filteredAlerts = getFilteredAlerts();

  // Match alerts to delivery dates
  const getAlertsForDeliveryDates = () => {
    const deliveryDates = getNextDeliveryDates();
    
    return deliveryDates.map(date => {
      const deliveryStartOfDay = startOfDay(date);
      const deliveryEndOfDay = endOfDay(date);
      
      const relevantAlerts = allRingAlerts.filter(alert => {
        // Check if alert overlaps with the delivery day
        const alertStart = alert.start_time ? parseISO(alert.start_time) : null;
        const alertEnd = alert.end_time ? parseISO(alert.end_time) : null;
        
        if (alertStart && alertEnd) {
          // Alert overlaps if: (alert starts before day ends) AND (alert ends after day starts)
          return isBefore(alertStart, deliveryEndOfDay) && isAfter(alertEnd, deliveryStartOfDay);
        }
        return false;
      });

      const severityRank = { minor: 1, moderate: 2, severe: 3, extreme: 4 };
      const highestSeverity = relevantAlerts.reduce((max, alert) => {
        const alertRank = severityRank[alert.severity] || 0;
        return alertRank > max ? alertRank : max;
      }, 0);

      const severityNames = ['minor', 'moderate', 'severe', 'extreme'];

      return {
        date,
        alerts: relevantAlerts,
        severity: highestSeverity > 0 ? severityNames[highestSeverity - 1] : 'none'
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
          {/* Alert Summary */}
          <Card className="p-4 bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-900">Active Weather Alerts</p>
                <p className="text-2xl font-bold text-red-700 mt-1">{allRingAlerts.length}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            {allRingAlerts.some(a => a.severity === 'severe' || a.severity === 'extreme') && (
              <Badge className="mt-2 bg-red-600">
                {allRingAlerts.filter(a => a.severity === 'severe' || a.severity === 'extreme').length} Severe/Extreme
              </Badge>
            )}
          </Card>

          {/* Ring Details */}
          <Card className="p-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">Store</p>
                <p className="font-semibold text-slate-900">{ring.store}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">State</p>
                <p className="text-slate-900">{ring.state || 'N/A'}</p>
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
              <div>
                <p className="text-sm text-slate-500">Zipcodes Covered</p>
                <p className="text-slate-900">{ring.zipcodes?.length || 0} zipcodes</p>
              </div>
            </div>
          </Card>

          {/* All Active Alerts Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              All Active Weather Alerts
            </h3>

            {/* Filters */}
            <div className="mb-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Filter by Severity</p>
                <Tabs value={severityFilter} onValueChange={setSeverityFilter}>
                  <TabsList>
                    <TabsTrigger value="all">All ({allRingAlerts.length})</TabsTrigger>
                    <TabsTrigger value="minor">Minor</TabsTrigger>
                    <TabsTrigger value="moderate">Moderate</TabsTrigger>
                    <TabsTrigger value="severe">Severe</TabsTrigger>
                    <TabsTrigger value="extreme">Extreme</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Filter by Date Range</p>
                <Tabs value={dateRange} onValueChange={setDateRange}>
                  <TabsList>
                    <TabsTrigger value="all">All Time</TabsTrigger>
                    <TabsTrigger value="today">Today</TabsTrigger>
                    <TabsTrigger value="week">Next 7 Days</TabsTrigger>
                    <TabsTrigger value="month">Next 30 Days</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {/* Alerts List */}
            <div className="space-y-3">
              {filteredAlerts.length === 0 ? (
                <p className="text-slate-500 text-sm">No alerts match your filters</p>
              ) : (
                filteredAlerts.map((alert, idx) => (
                  <Card 
                    key={idx}
                    className={`p-4 border-2 ${
                      alert.severity === 'extreme' ? 'border-red-500 bg-red-50' :
                      alert.severity === 'severe' ? 'border-orange-500 bg-orange-50' :
                      alert.severity === 'moderate' ? 'border-yellow-500 bg-yellow-50' :
                      'border-blue-500 bg-blue-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                        alert.severity === 'extreme' ? 'text-red-600' :
                        alert.severity === 'severe' ? 'text-orange-600' :
                        alert.severity === 'moderate' ? 'text-yellow-600' :
                        'text-blue-600'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="font-semibold text-slate-900">{alert.event}</p>
                          <Badge variant="outline" className={`${
                            alert.severity === 'extreme' ? 'border-red-600 text-red-700' :
                            alert.severity === 'severe' ? 'border-orange-600 text-orange-700' :
                            alert.severity === 'moderate' ? 'border-yellow-600 text-yellow-700' :
                            'border-blue-600 text-blue-700'
                          }`}>
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-700 mb-2">{alert.headline}</p>
                        {alert.description && (
                          <p className="text-xs text-slate-600 mb-2 line-clamp-2">{alert.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                          {alert.start_time && (
                            <span>Starts: {format(parseISO(alert.start_time), 'MMM d, h:mm a')}</span>
                          )}
                          {alert.end_time && (
                            <span>• Ends: {format(parseISO(alert.end_time), 'MMM d, h:mm a')}</span>
                          )}
                        </div>
                        {alert.affected_states && (
                          <p className="text-xs text-slate-500 mt-1">
                            States: {alert.affected_states.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

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