import { useState, useRef } from "react";
import { MapContainer, TileLayer, Circle, Popup, useMapEvents, Marker } from 'react-leaflet';
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, MapPin, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

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
  const [showWeatherLayer, setShowWeatherLayer] = useState(true);

  const handleMapClick = async (latlng) => {
    setClickedPosition(latlng);
    setIsAnalyzing(true);
    setAnalysisData(null);
    
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

  // Alert coverage circles
  const getAlertCircles = () => {
    const circles = [];
    const stateCoords = {
      'NY': [40.7128, -74.0060], 'CA': [36.7783, -119.4179], 'TX': [31.9686, -99.9018],
      'FL': [27.6648, -81.5158], 'IL': [40.6331, -89.3985], 'PA': [41.2033, -77.1945],
      'OH': [40.4173, -82.9071], 'GA': [32.1656, -82.9001], 'NC': [35.7596, -79.0193],
      'MI': [44.3148, -85.6024], 'NJ': [40.0583, -74.4057], 'VA': [37.4316, -78.6569],
      'WA': [47.7511, -120.7401], 'MA': [42.4072, -71.3824], 'AZ': [34.0489, -111.0937],
      'TN': [35.5175, -86.5804], 'IN': [40.2672, -86.1349], 'MO': [37.9643, -91.8318],
      'MD': [39.0458, -76.6413], 'WI': [43.7844, -88.7879], 'CO': [39.5501, -105.7821],
      'MN': [46.7296, -94.6859], 'SC': [33.8361, -81.1637], 'AL': [32.3182, -86.9023]
    };

    alerts.forEach((alert, idx) => {
      alert.affected_states?.forEach(state => {
        const coords = stateCoords[state];
        if (coords) {
          const severityRadius = {
            extreme: 150000,
            severe: 120000,
            moderate: 100000,
            minor: 80000
          };
          
          const severityColor = {
            extreme: '#DC2626',
            severe: '#EA580C',
            moderate: '#F59E0B',
            minor: '#3B82F6'
          };

          circles.push({
            key: `${alert.id}-${state}`,
            center: coords,
            radius: severityRadius[alert.severity] || 100000,
            color: severityColor[alert.severity] || '#3B82F6',
            alert
          });
        }
      });
    });

    return circles;
  };

  const alertCircles = getAlertCircles();

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
              <Button
                variant={showWeatherLayer ? "default" : "outline"}
                size="sm"
                onClick={() => setShowWeatherLayer(!showWeatherLayer)}
                className="text-xs"
              >
                {showWeatherLayer ? "Hide" : "Show"} Weather Layer
              </Button>
              <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-600">{alerts.length} Active Alerts</span>
              </div>
              <div className="px-3 py-1.5 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-600">{rings.length} Rings</span>
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
              
              {/* Weather Radar Layer - Live Precipitation */}
              {showWeatherLayer && (
                <TileLayer
                  url="https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=439d4b804bc8187953eb36d2a8c26a02"
                  attribution='Weather data &copy; OpenWeatherMap'
                  opacity={0.6}
                />
              )}
              
              <MapClickHandler onMapClick={handleMapClick} />

              {/* Alert Coverage Circles */}
              {alertCircles.map(circle => (
                <Circle
                  key={circle.key}
                  center={circle.center}
                  radius={circle.radius}
                  pathOptions={{
                    color: circle.color,
                    fillColor: circle.color,
                    fillOpacity: 0.15,
                    weight: 2,
                    opacity: 0.6
                  }}
                >
                  <Popup>
                    <div className="p-2">
                      <p className="font-semibold text-sm">{circle.alert.event}</p>
                      <p className="text-xs text-slate-600 capitalize">{circle.alert.severity} severity</p>
                    </div>
                  </Popup>
                </Circle>
              ))}

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