import { useState, useMemo } from "react";
import { MapContainer, TileLayer, Circle, Popup, CircleMarker, Marker } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, AlertTriangle, Clock, Package, Filter } from "lucide-react";
import { format, parseISO, isAfter, isBefore, addDays, startOfDay, endOfDay } from "date-fns";
import L from 'leaflet';

export default function RingMapVisualization({ rings = [], alerts = [] }) {
  const [selectedStore, setSelectedStore] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState("all");

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

  // Filter alerts by severity and date range
  const filteredAlerts = useMemo(() => {
    let filtered = alerts.filter(a => a.is_active);

    // Severity filter
    if (severityFilter !== "all") {
      filtered = filtered.filter(a => a.severity === severityFilter);
    }

    // Date range filter
    const now = new Date();
    if (dateRangeFilter === "today") {
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
    } else if (dateRangeFilter === "week") {
      const weekEnd = addDays(now, 7);
      filtered = filtered.filter(alert => {
        const start = alert.start_time ? parseISO(alert.start_time) : null;
        if (start) {
          return isBefore(start, weekEnd);
        }
        return true;
      });
    }

    return filtered;
  }, [alerts, severityFilter, dateRangeFilter]);

  // Create custom alert icons
  const createAlertIcon = (severity) => {
    const colorMap = {
      extreme: '#DC2626',
      severe: '#EA580C',
      moderate: '#F59E0B',
      minor: '#3B82F6'
    };
    
    const color = colorMap[severity] || '#3B82F6';
    
    return L.divIcon({
      html: `
        <div style="
          background-color: ${color};
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
      `,
      className: '',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -14]
    });
  };

  // Get geographic center for alerts (simplified - using affected states)
  const getAlertLocations = (alert) => {
    // Map states to approximate center coordinates
    const stateCoordinates = {
      'NY': [42.6526, -73.7562],
      'CA': [36.7783, -119.4179],
      'IL': [40.6331, -89.3985],
      'TX': [31.9686, -99.9018],
      'FL': [27.6648, -81.5158],
      'MA': [42.4072, -71.3824],
      'WA': [47.7511, -120.7401],
      'CO': [39.5501, -105.7821],
      'GA': [32.1656, -82.9001],
      'AZ': [34.0489, -111.0937],
      'PA': [41.2033, -77.1945]
    };

    const locations = [];
    
    if (alert.affected_states) {
      alert.affected_states.forEach(state => {
        if (stateCoordinates[state]) {
          locations.push({
            coordinates: stateCoordinates[state],
            alert: alert
          });
        }
      });
    }

    return locations;
  };

  // Determine ring color based on active alerts in the area
  const getRingAlertStatus = (ring) => {
    if (!ring.latitude || !ring.longitude || !filteredAlerts.length) {
      return { severity: 'none', color: '#10B981', alerts: [] };
    }

    const ringAlerts = filteredAlerts.filter(alert => 
      alert.affected_states?.includes(ring.state) || 
      alert.affected_zones?.some(zone => ring.zones?.includes(zone))
    );

    if (ringAlerts.length === 0) {
      return { severity: 'none', color: '#10B981', alerts: [] };
    }

    // Find highest severity
    const severityLevels = { minor: 1, moderate: 2, severe: 3, extreme: 4 };
    const maxSeverity = ringAlerts.reduce((max, alert) => {
      const level = severityLevels[alert.severity] || 0;
      return level > max.level ? { severity: alert.severity, level } : max;
    }, { severity: 'none', level: 0 });

    const severityColors = {
      extreme: '#DC2626',
      severe: '#EA580C',
      moderate: '#F59E0B',
      minor: '#3B82F6',
      none: '#10B981'
    };

    return {
      severity: maxSeverity.severity,
      color: severityColors[maxSeverity.severity] || '#10B981',
      alertCount: ringAlerts.length,
      alerts: ringAlerts
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
        <div className="flex items-center justify-between mb-4">
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

        {/* Alert Filters */}
        <div className="space-y-3 mb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Filter Alerts:</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-slate-500 mb-1.5">Severity</p>
              <Tabs value={severityFilter} onValueChange={setSeverityFilter}>
                <TabsList className="grid grid-cols-5 w-full">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  <TabsTrigger value="minor" className="text-xs">Minor</TabsTrigger>
                  <TabsTrigger value="moderate" className="text-xs">Mod</TabsTrigger>
                  <TabsTrigger value="severe" className="text-xs">Severe</TabsTrigger>
                  <TabsTrigger value="extreme" className="text-xs">Extreme</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-1.5">Time Range</p>
              <Tabs value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  <TabsTrigger value="today" className="text-xs">Today</TabsTrigger>
                  <TabsTrigger value="week" className="text-xs">7 Days</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
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
                              <div className="flex items-center gap-1.5 mb-2">
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
                              <p className="text-slate-600 mb-1">
                                {alertStatus.alertCount} active alert(s):
                              </p>
                              {alertStatus.alerts.slice(0, 2).map((alert, idx) => (
                                <p key={idx} className="text-xs text-slate-600 truncate">
                                  • {alert.event}
                                </p>
                              ))}
                              {alertStatus.alerts.length > 2 && (
                                <p className="text-xs text-slate-500 mt-1">
                                  +{alertStatus.alerts.length - 2} more
                                </p>
                              )}
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

              {/* Alert markers on map */}
              {filteredAlerts.map((alert) => {
                const locations = getAlertLocations(alert);
                
                return locations.map((location, idx) => (
                  <Marker
                    key={`alert-${alert.id}-${idx}`}
                    position={location.coordinates}
                    icon={createAlertIcon(alert.severity)}
                  >
                    <Popup maxWidth={300}>
                      <div className="p-2 min-w-[250px]">
                        <div className="flex items-start gap-2 mb-2">
                          <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                            alert.severity === 'extreme' ? 'text-red-600' :
                            alert.severity === 'severe' ? 'text-orange-600' :
                            alert.severity === 'moderate' ? 'text-yellow-600' :
                            'text-blue-600'
                          }`} />
                          <div className="flex-1">
                            <p className="font-bold text-slate-900">{alert.event}</p>
                            <Badge 
                              variant="outline" 
                              className={`mt-1 capitalize ${
                                alert.severity === 'extreme' ? 'border-red-600 text-red-700' :
                                alert.severity === 'severe' ? 'border-orange-600 text-orange-700' :
                                alert.severity === 'moderate' ? 'border-yellow-600 text-yellow-700' :
                                'border-blue-600 text-blue-700'
                              }`}
                            >
                              {alert.severity}
                            </Badge>
                          </div>
                        </div>
                        
                        <p className="text-sm text-slate-700 mb-3">{alert.headline}</p>
                        
                        {alert.description && (
                          <p className="text-xs text-slate-600 mb-3 line-clamp-3">
                            {alert.description}
                          </p>
                        )}
                        
                        <div className="space-y-1 text-xs border-t border-slate-200 pt-2">
                          {alert.start_time && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span className="text-slate-600">Starts:</span>
                              <span className="font-medium">
                                {format(parseISO(alert.start_time), 'MMM d, h:mm a')}
                              </span>
                            </div>
                          )}
                          {alert.end_time && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span className="text-slate-600">Ends:</span>
                              <span className="font-medium">
                                {format(parseISO(alert.end_time), 'MMM d, h:mm a')}
                              </span>
                            </div>
                          )}
                          {alert.affected_states && (
                            <div className="flex items-start gap-1.5 mt-2">
                              <MapPin className="w-3 h-3 text-slate-400 mt-0.5" />
                              <div>
                                <span className="text-slate-600">Affected States:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {alert.affected_states.map(state => (
                                    <Badge key={state} variant="outline" className="text-xs">
                                      {state}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ));
              })}
            </MapContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}