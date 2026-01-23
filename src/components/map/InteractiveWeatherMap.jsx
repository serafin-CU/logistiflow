import { useState, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Circle, Popup, useMapEvents, Marker } from 'react-leaflet';
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, AlertTriangle, CheckCircle, Clock, XCircle, Eye, EyeOff } from "lucide-react";
import { base44 } from "@/api/base44Client";
import 'leaflet/dist/leaflet.css';

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
}

const ActionBadge = ({ action }) => {
  const config = {
    halt: { icon: XCircle, color: "bg-red-100 text-red-700 border-red-300", label: "HALT OPERATIONS" },
    delay: { icon: Clock, color: "bg-amber-100 text-amber-700 border-amber-300", label: "DELAY 24-48H" },
    monitor: { icon: AlertTriangle, color: "bg-blue-100 text-blue-700 border-blue-300", label: "MONITOR" },
    proceed: { icon: CheckCircle, color: "bg-emerald-100 text-emerald-700 border-emerald-300", label: "PROCEED" }
  };
  
  const { icon: Icon, color, label } = config[action] || config.proceed;
  
  return (
    <Badge className={`${color} border font-semibold`}>
      <Icon className="w-3 h-3 mr-1" />
      {label}
    </Badge>
  );
};

export default function InteractiveWeatherMap({ rings = [], alerts = [] }) {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [clickedPosition, setClickedPosition] = useState(null);
  const [selectedRing, setSelectedRing] = useState(null);
  const [showRadar, setShowRadar] = useState(false);
  const [radarOpacity, setRadarOpacity] = useState(0.6);

  // Check if alert affects this ring
  const getRingAlerts = (ring) => {
    if (!ring.zones || !alerts.length) return [];
    
    return alerts.filter(alert => {
      if (!alert.is_active) return false;
      
      // Check if alert affects this ring's zones or state
      const affectsZone = alert.affected_zones?.some(zone => ring.zones.includes(zone));
      const affectsState = alert.affected_states?.some(state => 
        ring.state?.toUpperCase() === state || state.includes(ring.state)
      );
      
      return affectsZone || affectsState;
    });
  };

  // Check if alert affects upcoming delivery days and return affected dates
  const getAffectedDeliveryDays = (alert, ring) => {
    if (!alert.start_time || !alert.end_time || !ring.delivery_days) return [];
    
    const alertStart = new Date(alert.start_time);
    const alertEnd = new Date(alert.end_time);
    const today = new Date();
    const affectedDays = [];
    
    // Check next 14 days for delivery day conflicts
    for (let i = 0; i < 14; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + i);
      
      const dayName = checkDate.toLocaleDateString('en-US', { weekday: 'long' });
      
      if (ring.delivery_days.includes(dayName)) {
        // Check if alert overlaps with this delivery day
        if (checkDate >= alertStart && checkDate <= alertEnd) {
          affectedDays.push({
            date: checkDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            dayName: dayName,
            fullDate: checkDate
          });
        }
      }
    }
    
    return affectedDays;
  };

  // Check if alert affects upcoming delivery days
  const alertAffectsDelivery = (alert, ring) => {
    return getAffectedDeliveryDays(alert, ring).length > 0;
  };

  const handleMapClick = async (latlng) => {
    setClickedPosition(latlng);
    setIsAnalyzing(true);
    setAnalysisData(null);
    setSelectedRing(null);
    
    try {
      const response = await base44.functions.invoke('analyzeRingRisk', {
        latitude: latlng.lat,
        longitude: latlng.lng,
        radius: 100
      });
      
      setAnalysisData(response.data);
      setSelectedLocation(latlng);
    } catch (error) {
      console.error('Error analyzing location:', error);
      setAnalysisData({ error: 'Failed to analyze location' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRingClick = (e, ring) => {
    e.originalEvent.stopPropagation();
    setSelectedRing(ring);
    setClickedPosition(null);
    setAnalysisData(null);
  };

  // Calculate rings with delivery conflicts
  const ringsWithAlerts = rings.map(ring => {
    const ringAlerts = getRingAlerts(ring);
    const hasDeliveryConflict = ringAlerts.some(alert => alertAffectsDelivery(alert, ring));
    const maxSeverity = Math.max(
      ...ringAlerts.map(a => ({ minor: 1, moderate: 2, severe: 3, extreme: 4 }[a.severity] || 0)),
      0
    );
    return { ...ring, ringAlerts, hasDeliveryConflict, maxSeverity };
  });

  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-lg"
      >
        <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Interactive Weather Risk Map
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Click anywhere on the map to analyze weather risks for that area
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-600">{alerts.length} Active Alerts</span>
              </div>
              <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-600">{rings.length} Rings</span>
              </div>
              <div className="px-3 py-1.5 bg-red-50 rounded-lg border border-red-200">
                <span className="text-red-700 font-semibold">
                  {ringsWithAlerts.filter(r => r.hasDeliveryConflict).length} Delivery Conflicts
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200">
                <Switch 
                  id="radar-toggle" 
                  checked={showRadar} 
                  onCheckedChange={setShowRadar}
                />
                <Label htmlFor="radar-toggle" className="cursor-pointer">
                  {showRadar ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  <span className="ml-1">Radar</span>
                </Label>
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="h-[600px] w-full">
            <MapContainer
              center={[39.8283, -98.5795]}
              zoom={4}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {/* NOAA Radar Layer */}
              {showRadar && (
                <TileLayer
                  url="https://mapservices.weather.noaa.gov/eventdriven/rest/services/radar/radar_base_reflectivity/MapServer/tile/{z}/{y}/{x}"
                  attribution='NOAA'
                  opacity={radarOpacity}
                  zIndex={1000}
                />
              )}
              
              <MapClickHandler onMapClick={handleMapClick} />

              {/* Delivery Rings with Alert Integration */}
              {ringsWithAlerts.map((ringData, idx) => {
                if (!ringData.latitude || !ringData.longitude) return null;

                const colorMap = {
                  0: '#3b82f6',  // blue - no alerts
                  1: '#10b981',  // green - minor
                  2: '#f59e0b',  // yellow - moderate
                  3: '#f97316',  // orange - severe
                  4: '#ef4444'   // red - extreme
                };

                const color = ringData.hasDeliveryConflict ? colorMap[ringData.maxSeverity] : colorMap[0];

                return (
                  <Circle
                    key={idx}
                    center={[ringData.latitude, ringData.longitude]}
                    radius={10000}
                    pathOptions={{
                      fillColor: color,
                      fillOpacity: ringData.hasDeliveryConflict ? 0.3 : 0.1,
                      color: color,
                      weight: ringData.hasDeliveryConflict ? 3 : 2
                    }}
                    eventHandlers={{
                      click: (e) => handleRingClick(e, ringData)
                    }}
                  >
                    <Popup>
                      <div className="p-2 min-w-[220px]">
                        <div className="font-semibold text-slate-900 mb-1">{ringData.ring_id}</div>
                        <div className="text-sm text-slate-600">{ringData.store}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          Delivers: {ringData.delivery_days?.join(', ') || 'N/A'}
                        </div>
                        
                        {ringData.ringAlerts.length > 0 && (
                          <div className="mt-2 pt-2 border-t space-y-1">
                            <div className="text-xs font-semibold text-slate-700">
                              {ringData.ringAlerts.length} Active Alert{ringData.ringAlerts.length > 1 ? 's' : ''}
                            </div>
                            {ringData.ringAlerts.slice(0, 2).map((alert, i) => (
                              <div key={i} className="flex items-center gap-1 text-xs">
                                <Badge className={`text-[10px] px-1 py-0 ${
                                  alert.severity === 'extreme' ? 'bg-red-600' :
                                  alert.severity === 'severe' ? 'bg-orange-600' :
                                  alert.severity === 'moderate' ? 'bg-yellow-600' :
                                  'bg-blue-600'
                                }`}>
                                  {alert.severity}
                                </Badge>
                                <span className="text-slate-600">{alert.event}</span>
                                {alertAffectsDelivery(alert, ringData) && (
                                  <AlertTriangle className="w-3 h-3 text-red-600 ml-auto" />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {ringData.hasDeliveryConflict && (
                          <div className="mt-2 pt-2 border-t">
                            <div className="flex items-center gap-1 text-red-600 text-xs font-semibold">
                              <AlertTriangle className="w-3 h-3" />
                              Delivery Day Conflict!
                            </div>
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Circle>
                );
              })}

              {/* Clicked Location Marker */}
              {clickedPosition && (
                <Marker position={[clickedPosition.lat, clickedPosition.lng]} />
              )}
            </MapContainer>
          </div>

          {/* Loading Overlay */}
          <AnimatePresence>
            {isAnalyzing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-[1000]"
              >
                <div className="text-center">
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-3" />
                  <p className="text-slate-700 font-medium">Analyzing weather risks...</p>
                  <p className="text-sm text-slate-500">Checking alerts and affected rings</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Selected Ring Details Panel */}
      <AnimatePresence>
        {selectedRing && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute bottom-4 left-4 z-[1000] w-96"
          >
            <Card className="bg-white/95 backdrop-blur border-2 border-blue-200">
              <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-white">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{selectedRing.ring_id}</h3>
                    <p className="text-sm text-slate-600">{selectedRing.store}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedRing(null)}>×</Button>
                </div>
              </div>
              
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-1">Delivery Days</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedRing.delivery_days?.map((day, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{day}</Badge>
                    )) || <span className="text-xs text-slate-500">None</span>}
                  </div>
                </div>
                
                {selectedRing.ringAlerts?.length > 0 ? (
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-2">
                      Active Weather Alerts ({selectedRing.ringAlerts.length})
                    </div>
                    <div className="space-y-3">
                      {selectedRing.ringAlerts.map((alert, i) => {
                        const affectedDays = getAffectedDeliveryDays(alert, selectedRing);
                        return (
                          <div key={i} className={`p-3 rounded-lg border ${
                            affectedDays.length > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <Badge className={`text-[10px] ${
                                alert.severity === 'extreme' ? 'bg-red-600' :
                                alert.severity === 'severe' ? 'bg-orange-600' :
                                alert.severity === 'moderate' ? 'bg-yellow-600' :
                                'bg-blue-600'
                              }`}>
                                {alert.severity}
                              </Badge>
                              {affectedDays.length > 0 && <AlertTriangle className="w-3 h-3 text-red-600" />}
                            </div>
                            
                            <div className="font-semibold text-slate-900 text-sm mb-1">{alert.event}</div>
                            
                            {alert.headline && (
                              <div className="text-xs text-slate-700 mb-2 font-medium">
                                {alert.headline}
                              </div>
                            )}
                            
                            {alert.description && (
                              <div className="text-xs text-slate-600 mb-2 line-clamp-3">
                                {alert.description}
                              </div>
                            )}
                            
                            <div className="text-xs text-slate-500 mb-2">
                              <div className="font-medium">Active Period:</div>
                              <div>Start: {new Date(alert.start_time).toLocaleString('en-US', { 
                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                              })}</div>
                              <div>End: {new Date(alert.end_time).toLocaleString('en-US', { 
                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                              })}</div>
                            </div>
                            
                            {affectedDays.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-red-300">
                                <div className="text-xs font-semibold text-red-700 mb-1">
                                  ⚠️ Impacted Delivery Days:
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {affectedDays.map((day, idx) => (
                                    <Badge key={idx} className="bg-red-600 text-white text-[10px]">
                                      {day.dayName} ({day.date})
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 text-center py-4">
                    No active alerts for this ring
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analysis Results Panel */}
      <AnimatePresence>
        {analysisData && !isAnalyzing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mt-6"
          >
            <Card className="overflow-hidden border-2 border-blue-200 shadow-xl">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Weather Risk Analysis
                    </h3>
                    <p className="text-sm text-blue-100 mt-1">
                      Location: {selectedLocation?.lat.toFixed(4)}, {selectedLocation?.lng.toFixed(4)}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setAnalysisData(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <p className="text-xs text-slate-500 uppercase mb-1">Total Alerts</p>
                    <p className="text-2xl font-bold text-slate-900">{analysisData.summary?.total_alerts || 0}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <p className="text-xs text-slate-500 uppercase mb-1">Rings Affected</p>
                    <p className="text-2xl font-bold text-slate-900">{analysisData.summary?.rings_affected || 0}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <p className="text-xs text-slate-500 uppercase mb-1">Severity</p>
                    <p className="text-xl font-bold text-slate-900 capitalize">
                      {analysisData.summary?.highest_severity || 'None'}
                    </p>
                  </div>
                </div>

                {/* Recommendations */}
                {analysisData.recommendations && analysisData.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      Recommended Actions
                    </h4>
                    <div className="space-y-3">
                      {analysisData.recommendations.map((rec, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-white">
                          <div className="flex items-start justify-between mb-2">
                            <ActionBadge action={rec.action} />
                            <Badge variant="outline" className="capitalize">{rec.priority} Priority</Badge>
                          </div>
                          <p className="text-sm text-slate-700">{rec.message}</p>
                          {rec.affected_rings?.length > 0 && (
                            <p className="text-xs text-slate-500 mt-2">
                              Affected: {rec.affected_rings.slice(0, 5).join(', ')}
                              {rec.affected_rings.length > 5 && ` +${rec.affected_rings.length - 5} more`}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Alerts */}
                {analysisData.alerts && analysisData.alerts.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Active Weather Alerts ({analysisData.alerts.length})
                    </h4>
                    <div className="space-y-2">
                      {analysisData.alerts.map((alert, idx) => (
                        <div key={idx} className="border-l-4 border-l-amber-500 bg-amber-50 p-3 rounded-r-lg">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-slate-900">{alert.event}</p>
                            <Badge className="capitalize bg-amber-200 text-amber-800">{alert.severity}</Badge>
                          </div>
                          <p className="text-sm text-slate-700">{alert.headline}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Affected Rings */}
                {analysisData.affected_rings && analysisData.affected_rings.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-purple-600" />
                      Affected Delivery Rings ({analysisData.affected_rings.length})
                    </h4>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {analysisData.affected_rings.map((ring, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-lg p-3 bg-white hover:bg-slate-50">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-slate-900">{ring.ring_id}</p>
                            <Badge variant="outline">{ring.store}</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                            <div>Region: {ring.region_name || 'N/A'}</div>
                            <div>Delivery: {ring.delivery_time_days}D</div>
                            <div>Days: {ring.delivery_days?.join(', ') || 'N/A'}</div>
                            <div>Slots: {ring.time_slots?.length || 0}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}