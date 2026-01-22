import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { MapPin, Store } from "lucide-react";
import { format, addDays, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import RingMapVisualization from "@/components/ring/RingMapVisualization";
import RingDetailSheet from "@/components/ring/RingDetailSheet";

const Ring = base44.entities.Ring;
const WeatherAlert = base44.entities.WeatherAlert;

export default function RingManagement() {
  const [selectedRing, setSelectedRing] = useState(null);

  const { data: rings = [], isLoading } = useQuery({
    queryKey: ["rings"],
    queryFn: () => Ring.list("-created_date", 500)
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => WeatherAlert.filter({ is_active: true })
  });



  // Calculate unique ring IDs
  const uniqueRingIds = new Set(rings.map(r => r.ring_id));
  const uniqueRings = Array.from(uniqueRingIds).map(ringId => 
    rings.find(r => r.ring_id === ringId)
  );

  // Check which rings have alerts affecting upcoming deliveries
  const getRingSeverity = (ring) => {
    if (!ring.delivery_days || ring.delivery_days.length === 0) {
      return { alertCount: 0, hasSevere: false, affectedDeliveries: 0 };
    }

    // Get upcoming delivery dates for next 14 days
    const today = new Date();
    const upcomingDeliveries = [];
    
    for (let i = 0; i < 14; i++) {
      const date = addDays(today, i);
      const dayName = format(date, 'EEEE');
      if (ring.delivery_days.includes(dayName)) {
        upcomingDeliveries.push(date);
      }
    }

    // Find alerts that affect this ring AND overlap with delivery days
    let affectedDeliveryCount = 0;
    const impactingAlerts = new Set();
    
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
            affectedDeliveryCount++;
          }
        }
      });
    });

    const ringAlerts = Array.from(impactingAlerts).map(id => 
      alerts.find(a => a.id === id)
    );
    
    const hasSevere = ringAlerts.some(a => a.severity === 'severe' || a.severity === 'extreme');
    
    return { 
      alertCount: ringAlerts.length, 
      hasSevere,
      affectedDeliveries: affectedDeliveryCount
    };
  };

  // Group rings by store
  const ringsByStore = uniqueRings.reduce((acc, ring) => {
    if (!acc[ring.store]) acc[ring.store] = [];
    acc[ring.store].push(ring);
    return acc;
  }, {});

  // Detect duplicates
  const duplicateRingIds = rings.reduce((acc, ring) => {
    const count = rings.filter(r => r.ring_id === ring.ring_id).length;
    if (count > 1 && !acc.includes(ring.ring_id)) {
      acc.push(ring.ring_id);
    }
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <MapPin className="w-8 h-8 text-purple-600" />
            Ring Management
          </h1>
          <p className="text-slate-500 mt-1">
            Manage delivery rings, zones, and facility assignments
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-slate-500 mb-1">Unique Ring IDs</p>
              <p className="text-3xl font-bold text-slate-900">{uniqueRingIds.size}</p>
              <p className="text-xs text-slate-400 mt-1">({rings.length} total records)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-slate-500 mb-1">Active Stores</p>
              <p className="text-3xl font-bold text-slate-900">{Object.keys(ringsByStore).length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-slate-500 mb-1">1-Day Delivery</p>
              <p className="text-3xl font-bold text-slate-900">
                {uniqueRings.filter(r => r.delivery_time_days === 1).length}
              </p>
            </CardContent>
          </Card>
          <Card className={duplicateRingIds.length > 0 ? "border-amber-300 bg-amber-50" : ""}>
            <CardContent className="p-6">
              <p className="text-sm text-slate-500 mb-1">Duplicates</p>
              <p className="text-3xl font-bold text-amber-600">{duplicateRingIds.length}</p>
              {duplicateRingIds.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">Ring IDs with duplicates</p>
              )}
            </CardContent>
          </Card>
        </div>



        {/* Map Visualization */}
        <div className="mb-8">
          <RingMapVisualization rings={rings} alerts={alerts} />
        </div>

        {/* Rings by Store */}
        <div className="space-y-6">
          {Object.entries(ringsByStore).map(([store, storeRings]) => (
            <Card key={store}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-purple-600" />
                  {store}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {storeRings.map((ring) => {
                    const severity = getRingSeverity(ring);
                    return (
                      <motion.div
                        key={ring.id}
                        whileHover={{ scale: 1.01 }}
                        className={`border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
                          severity.hasSevere 
                            ? 'border-red-400 bg-red-50 hover:border-red-500' 
                            : severity.alertCount > 0 
                            ? 'border-yellow-300 bg-yellow-50 hover:border-yellow-400'
                            : 'border-slate-200 bg-white hover:border-purple-400'
                        }`}
                        onClick={() => setSelectedRing(ring)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-lg text-slate-900">
                                Ring {ring.ring_id}
                              </p>
                              {severity.alertCount > 0 && (
                                <Badge className={severity.hasSevere ? 'bg-red-600' : 'bg-yellow-600'}>
                                  {severity.alertCount} Alert{severity.alertCount > 1 ? 's' : ''}
                                </Badge>
                              )}
                              {severity.affectedDeliveries > 0 && (
                                <Badge variant="outline" className={severity.hasSevere ? 'border-red-600 text-red-700' : 'border-yellow-600 text-yellow-700'}>
                                  {severity.affectedDeliveries} Delivery{severity.affectedDeliveries > 1 ? ' Days' : ' Day'} Impacted
                                </Badge>
                              )}
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm text-slate-600">
                                {ring.facility_center || 'No facility'} · {ring.region_name || 'No region'}
                              </p>
                              <p className="text-sm text-slate-600">
                                📅 {ring.delivery_days?.join(', ') || 'No delivery days'}
                              </p>
                              {ring.zipcodes && ring.zipcodes.length > 0 && (
                                <p className="text-xs text-slate-500">
                                  {ring.zipcodes.length} zipcodes · {ring.state || 'State N/A'}
                                </p>
                              )}
                            </div>
                          </div>
                          <MapPin className={`w-5 h-5 ${severity.hasSevere ? 'text-red-600' : 'text-slate-400'}`} />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Ring Detail Sheet */}
        <RingDetailSheet 
          ring={selectedRing}
          alerts={alerts}
          open={!!selectedRing}
          onOpenChange={(open) => !open && setSelectedRing(null)}
        />
      </div>
    </div>
  );
}