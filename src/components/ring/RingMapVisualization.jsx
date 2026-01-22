import { useState, useMemo } from "react";
import { MapContainer, TileLayer, Circle, Popup, CircleMarker } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, AlertTriangle, Clock, Package } from "lucide-react";

export default function RingMapVisualization({ rings = [], alerts = [] }) {
  const [selectedStore, setSelectedStore] = useState("all");

  // Get unique stores
  const stores = useMemo(() => {
    const storeSet = new Set(rings.map(r => r.store).filter(Boolean));
    return ["all", ...Array.from(storeSet)];
  }, [rings]);

  // Filter rings by selected store
  const filteredRings = useMemo(() => {
    if (selectedStore === "all") return rings;
    return rings.filter(r => r.store === selectedStore);
  }, [rings, selectedStore]);

  // Determine ring color based on active alerts in the area
  const getRingAlertStatus = (ring) => {
    if (!ring.latitude || !ring.longitude || !alerts.length) {
      return { severity: 'none', color: '#10B981' }; // Green - no alerts
    }

    // Simple state-based matching (could be enhanced with actual geographic matching)
    const stateMap = {
      'New York': 'NY',
      'Los Angeles': 'CA',
      'Chicago': 'IL',
      'Houston': 'TX',
      'Miami': 'FL',
      'Boston': 'MA',
      'Seattle': 'WA',
      'Denver': 'CO',
      'Atlanta': 'GA',
      'Phoenix': 'AZ'
    };

    const ringState = stateMap[ring.store];
    if (!ringState) return { severity: 'none', color: '#10B981' };

    const ringAlerts = alerts.filter(alert => 
      alert.is_active && alert.affected_states?.includes(ringState)
    );

    if (ringAlerts.length === 0) {
      return { severity: 'none', color: '#10B981' }; // Green
    }

    // Find highest severity
    const severityLevels = { minor: 1, moderate: 2, severe: 3, extreme: 4 };
    const maxSeverity = ringAlerts.reduce((max, alert) => {
      const level = severityLevels[alert.severity] || 0;
      return level > max.level ? { severity: alert.severity, level } : max;
    }, { severity: 'none', level: 0 });

    const severityColors = {
      extreme: '#DC2626',  // Red
      severe: '#EA580C',   // Orange
      moderate: '#F59E0B', // Amber
      minor: '#3B82F6',    // Blue
      none: '#10B981'      // Green
    };

    return {
      severity: maxSeverity.severity,
      color: severityColors[maxSeverity.severity] || '#10B981',
      alertCount: ringAlerts.length
    };
  };

  // Calculate center point (US center)
  const mapCenter = filteredRings.length > 0 && filteredRings[0].latitude && filteredRings[0].longitude
    ? [filteredRings[0].latitude, filteredRings[0].longitude]
    : [39.8283, -98.5795];

  // Calculate appropriate zoom level based on number of rings
  const mapZoom = filteredRings.length === 1 ? 10 : 4;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-600" />
            Delivery Zone Coverage Map
          </CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5"
            >
              {stores.map(store => (
                <option key={store} value={store}>
                  {store === "all" ? "All Stores" : store}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-600"></div>
            <span className="text-slate-600">Extreme Alert</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-orange-600"></div>
            <span className="text-slate-600">Severe Alert</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-slate-600">Moderate Alert</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-slate-600">Minor Alert</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-slate-600">No Alerts</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredRings.filter(r => r.latitude && r.longitude).length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
            <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium mb-2">No Ring Coordinates Available</p>
            <p className="text-sm text-slate-500">
              Import rings with latitude and longitude data to visualize them on the map
            </p>
          </div>
        ) : (
          <div className="h-[600px] w-full rounded-lg overflow-hidden border border-slate-200">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {filteredRings.map((ring) => {
                if (!ring.latitude || !ring.longitude) return null;

                const alertStatus = getRingAlertStatus(ring);
                
                // Draw coverage circle for each ring
                return (
                  <Circle
                    key={ring.id}
                    center={[ring.latitude, ring.longitude]}
                    radius={ring.delivery_time_days === 2 ? 30000 : 20000} // 30km for 2D, 20km for 1D
                    pathOptions={{
                      color: alertStatus.color,
                      fillColor: alertStatus.color,
                      fillOpacity: 0.2,
                      weight: 3,
                      opacity: 0.8
                    }}
                  >
                    <Popup>
                      <div className="p-2 min-w-[200px]">
                        <p className="font-bold text-slate-900 mb-2">{ring.ring_id}</p>
                        
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center gap-1.5">
                            <Package className="w-3 h-3 text-purple-600" />
                            <span className="text-slate-600">Store:</span>
                            <span className="font-medium">{ring.store}</span>
                          </div>
                          
                          {ring.region_name && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3 h-3 text-blue-600" />
                              <span className="text-slate-600">Region:</span>
                              <span className="font-medium">{ring.region_name}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-orange-600" />
                            <span className="text-slate-600">Delivery:</span>
                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                              {ring.delivery_time_days}D
                            </Badge>
                          </div>

                          {ring.zipcodes && ring.zipcodes.length > 0 && (
                            <div className="pt-1 border-t border-slate-200">
                              <span className="text-slate-600">Coverage:</span>
                              <span className="font-medium ml-1">{ring.zipcodes.length} zipcodes</span>
                            </div>
                          )}

                          {alertStatus.severity !== 'none' && (
                            <div className="pt-1 border-t border-slate-200">
                              <div className="flex items-center gap-1.5">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <Badge 
                                  className="text-xs capitalize"
                                  style={{ 
                                    backgroundColor: alertStatus.color,
                                    color: 'white'
                                  }}
                                >
                                  {alertStatus.severity} Alert
                                </Badge>
                              </div>
                              <p className="text-slate-600 mt-1">
                                {alertStatus.alertCount} active alert(s)
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Circle>
                );
              })}

              {/* Center markers for each ring */}
              {filteredRings.map((ring) => {
                if (!ring.latitude || !ring.longitude) return null;

                const alertStatus = getRingAlertStatus(ring);

                return (
                  <CircleMarker
                    key={`marker-${ring.id}`}
                    center={[ring.latitude, ring.longitude]}
                    radius={6}
                    pathOptions={{
                      color: 'white',
                      fillColor: alertStatus.color,
                      fillOpacity: 1,
                      weight: 2
                    }}
                  />
                );
              })}
            </MapContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}