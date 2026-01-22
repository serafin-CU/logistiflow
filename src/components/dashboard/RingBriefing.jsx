import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MapPin, AlertTriangle, Calendar, AlertCircle } from "lucide-react";
import { format, addDays, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";

export default function RingBriefing({ rings, alerts }) {
  const [selectedRing, setSelectedRing] = useState(null);

  // Calculate rings affected by alerts in next 7 days
  const affectedRings = useMemo(() => {
    const today = new Date();
    const affectedList = [];

    rings.forEach(ring => {
      if (!ring.delivery_days || ring.delivery_days.length === 0) return;

      // Get upcoming delivery dates for next 7 days
      const upcomingDeliveries = [];
      for (let i = 0; i < 7; i++) {
        const date = addDays(today, i);
        const dayName = format(date, 'EEEE');
        if (ring.delivery_days.includes(dayName)) {
          upcomingDeliveries.push(date);
        }
      }

      // Find alerts that affect this ring AND overlap with delivery days
      const impactingAlerts = new Set();
      const impactedDeliveryDays = new Set();

      upcomingDeliveries.forEach(deliveryDate => {
        const dayStart = startOfDay(deliveryDate);
        const dayEnd = endOfDay(deliveryDate);

        alerts.forEach(alert => {
          if (!alert.is_active) return;

          // Check geographic match
          const affectsRing = alert.affected_states?.includes(ring.state) || 
                             alert.affected_zones?.some(zone => ring.zones?.includes(zone));

          if (!affectsRing) return;

          // Check temporal overlap
          const alertStart = alert.start_time ? parseISO(alert.start_time) : null;
          const alertEnd = alert.end_time ? parseISO(alert.end_time) : null;

          if (alertStart && alertEnd) {
            if (isBefore(alertStart, dayEnd) && isAfter(alertEnd, dayStart)) {
              impactingAlerts.add(alert.id);
              impactedDeliveryDays.add(format(deliveryDate, 'EEEE'));
            }
          }
        });
      });

      if (impactingAlerts.size > 0) {
        const ringAlerts = Array.from(impactingAlerts).map(id =>
          alerts.find(a => a.id === id)
        );

        affectedList.push({
          ring,
          alertCount: impactingAlerts.size,
          alerts: ringAlerts,
          impactedDeliveryDays: Array.from(impactedDeliveryDays),
          hasSevere: ringAlerts.some(a => a.severity === 'severe' || a.severity === 'extreme')
        });
      }
    });

    return affectedList.sort((a, b) => b.alertCount - a.alertCount);
  }, [rings, alerts]);

  if (affectedRings.length === 0) {
    return null;
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-600" />
            Ring Briefing (Next 7 Days)
          </h2>
          <span className="text-sm text-slate-500">
            {affectedRings.length} ring{affectedRings.length > 1 ? 's' : ''} impacted
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {affectedRings.map((item, i) => (
              <motion.div
                key={item.ring.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    item.hasSevere
                      ? 'border-red-300 bg-red-50 hover:border-red-400'
                      : 'border-yellow-300 bg-yellow-50 hover:border-yellow-400'
                  }`}
                  onClick={() => setSelectedRing(item)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-slate-900">{item.ring.ring_id}</p>
                        <p className="text-sm text-slate-600">{item.ring.store}</p>
                      </div>
                      <Badge className={item.hasSevere ? 'bg-red-600' : 'bg-yellow-600'}>
                        {item.alertCount} Alert{item.alertCount > 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-600 mb-2">
                      {item.impactedDeliveryDays.join(', ')}
                    </p>
                    <p className="text-xs text-slate-500">Click for details</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedRing} onOpenChange={(open) => !open && setSelectedRing(null)}>
        <SheetContent side="right" className="w-full sm:w-[600px] overflow-y-auto">
          {selectedRing && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-purple-600" />
                  Ring {selectedRing.ring.ring_id}
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Ring Info */}
                <div>
                  <h3 className="font-semibold text-slate-900 mb-3">Ring Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Store:</span>
                      <span className="font-medium">{selectedRing.ring.store}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Facility:</span>
                      <span className="font-medium">{selectedRing.ring.facility_center || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">State:</span>
                      <span className="font-medium">{selectedRing.ring.state}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Region:</span>
                      <span className="font-medium">{selectedRing.ring.region_name || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Impacted Delivery Days */}
                <div>
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Impacted Delivery Days
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedRing.impactedDeliveryDays.map(day => (
                      <Badge key={day} variant="outline" className="border-yellow-300 text-yellow-700">
                        {day}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Alerts */}
                <div>
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Active Alerts ({selectedRing.alerts.length})
                  </h3>
                  <div className="space-y-3">
                    {selectedRing.alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-lg border ${
                          alert.severity === 'extreme' || alert.severity === 'severe'
                            ? 'bg-red-50 border-red-200'
                            : alert.severity === 'moderate'
                            ? 'bg-yellow-50 border-yellow-200'
                            : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <p className="font-semibold text-slate-900">{alert.event}</p>
                          <Badge
                            className={
                              alert.severity === 'extreme'
                                ? 'bg-red-600'
                                : alert.severity === 'severe'
                                ? 'bg-orange-600'
                                : alert.severity === 'moderate'
                                ? 'bg-yellow-600'
                                : 'bg-blue-600'
                            }
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-700 mb-2">{alert.headline}</p>
                        <div className="text-xs text-slate-600 space-y-1">
                          {alert.start_time && (
                            <p>
                              <strong>Start:</strong> {format(parseISO(alert.start_time), 'MMM d, h:mm a')}
                            </p>
                          )}
                          {alert.end_time && (
                            <p>
                              <strong>End:</strong> {format(parseISO(alert.end_time), 'MMM d, h:mm a')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}