import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { MapPin, Calendar, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { addDays, format } from "date-fns";

const getDayOfWeek = (date) => {
  return format(date, 'EEEE');
};

const getNextDeliveryDate = (deliveryDays) => {
  if (!deliveryDays || deliveryDays.length === 0) return null;
  
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const checkDate = addDays(today, i);
    const dayName = getDayOfWeek(checkDate);
    if (deliveryDays.includes(dayName)) {
      return checkDate;
    }
  }
  return null;
};

const RingWeatherCard = ({ ring, alerts }) => {
  const nextDelivery = getNextDeliveryDate(ring.delivery_days);
  
  // Match alerts to this ring
  const relevantAlerts = alerts.filter(alert => {
    // Simple state matching - can be enhanced with zipcode mapping
    const ringState = ring.store === 'New York' ? 'NY' :
                      ring.store === 'Los Angeles' ? 'CA' :
                      ring.store === 'Chicago' ? 'IL' :
                      ring.store === 'Houston' ? 'TX' :
                      ring.store === 'Miami' ? 'FL' : null;
    
    return ringState && alert.affected_states?.includes(ringState);
  });

  const highestSeverity = relevantAlerts.length > 0
    ? relevantAlerts.reduce((max, a) => {
        const severities = ['minor', 'moderate', 'severe', 'extreme'];
        return severities.indexOf(a.severity) > severities.indexOf(max) ? a.severity : max;
      }, 'minor')
    : 'none';

  const severityConfig = {
    extreme: { color: 'border-l-red-500 bg-red-50', badge: 'bg-red-100 text-red-700', icon: AlertTriangle },
    severe: { color: 'border-l-orange-500 bg-orange-50', badge: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
    moderate: { color: 'border-l-yellow-500 bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700', icon: Clock },
    minor: { color: 'border-l-blue-500 bg-blue-50', badge: 'bg-blue-100 text-blue-700', icon: Clock },
    none: { color: 'border-l-green-500 bg-green-50', badge: 'bg-green-100 text-green-700', icon: CheckCircle }
  };

  const config = severityConfig[highestSeverity] || severityConfig.none;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border-l-4 ${config.color} rounded-lg p-4 hover:shadow-md transition-all`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-600" />
            {ring.ring_id}
          </p>
          <p className="text-sm text-slate-600">{ring.region_name || ring.store}</p>
        </div>
        <Badge className={config.badge}>
          <Icon className="w-3 h-3 mr-1" />
          {highestSeverity === 'none' ? 'Clear' : highestSeverity}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
        <div>
          <p className="text-slate-500 flex items-center gap-1 mb-1">
            <Calendar className="w-3 h-3" />
            Next Delivery
          </p>
          <p className="font-semibold text-slate-900">
            {nextDelivery ? format(nextDelivery, 'MMM d, yyyy') : 'No schedule'}
          </p>
        </div>
        <div>
          <p className="text-slate-500 mb-1">Delivery Time</p>
          <p className="font-semibold text-slate-900">{ring.delivery_time_days}D</p>
        </div>
      </div>

      {relevantAlerts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <p className="text-xs text-slate-600 font-medium mb-2">Active Alerts:</p>
          <div className="space-y-1">
            {relevantAlerts.slice(0, 2).map((alert, idx) => (
              <p key={idx} className="text-xs text-slate-700">
                • {alert.event}
              </p>
            ))}
            {relevantAlerts.length > 2 && (
              <p className="text-xs text-slate-500">+{relevantAlerts.length - 2} more</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 text-xs text-slate-500">
        <p>Zipcodes: {ring.zipcodes?.length || 0} covered</p>
        <p>Slots: {ring.time_slots?.join(', ') || 'N/A'}</p>
      </div>
    </motion.div>
  );
};

export default function RingWeatherForecast({ rings, alerts }) {
  // Sort rings by next delivery date
  const ringsWithDates = rings
    .map(ring => ({
      ...ring,
      nextDelivery: getNextDeliveryDate(ring.delivery_days)
    }))
    .filter(ring => ring.nextDelivery)
    .sort((a, b) => a.nextDelivery - b.nextDelivery);

  return (
    <Card className="shadow-lg border-2 border-blue-100">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-white border-b border-blue-100">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-blue-600" />
            <span>Weather Forecast by Ring</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {ringsWithDates.length} Rings with Scheduled Deliveries
          </Badge>
        </CardTitle>
        <p className="text-sm text-slate-600 mt-1">
          Weather analysis by delivery ring, zipcode coverage, and scheduled delivery days
        </p>
      </CardHeader>
      <CardContent className="p-6">
        {ringsWithDates.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ringsWithDates.map((ring) => (
              <RingWeatherCard key={ring.id} ring={ring} alerts={alerts} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <MapPin className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No rings configured with delivery schedules</p>
            <p className="text-sm mt-1">Import rings in Ring Management to see forecasts</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}