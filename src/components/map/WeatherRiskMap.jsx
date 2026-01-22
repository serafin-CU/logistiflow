import { MapContainer, TileLayer, CircleMarker, Popup, Polygon } from 'react-leaflet';
import { motion } from "framer-motion";
import { AlertTriangle, Package, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import RiskBadge from "../dashboard/RiskBadge";

// US State boundaries (simplified coordinates for major states)
const stateBoundaries = {
  NY: [[-79.76, 40.49], [-71.85, 40.49], [-71.85, 45.01], [-79.76, 45.01]],
  CA: [[-124.48, 32.53], [-114.13, 32.53], [-114.13, 42.01], [-124.48, 42.01]],
  TX: [[-106.65, 25.84], [-93.51, 25.84], [-93.51, 36.50], [-106.65, 36.50]],
  FL: [[-87.63, 24.52], [-80.03, 24.52], [-80.03, 31.00], [-87.63, 31.00]],
  PA: [[-80.52, 39.72], [-74.69, 39.72], [-74.69, 42.27], [-80.52, 42.27]],
  IL: [[-91.51, 36.97], [-87.02, 36.97], [-87.02, 42.51], [-91.51, 42.51]],
  OH: [[-84.82, 38.40], [-80.52, 38.40], [-80.52, 41.98], [-84.82, 41.98]],
  MI: [[-90.42, 41.70], [-82.12, 41.70], [-82.12, 48.31], [-90.42, 48.31]],
  NC: [[-84.32, 33.84], [-75.46, 33.84], [-75.46, 36.59], [-84.32, 36.59]],
  GA: [[-85.61, 30.36], [-80.84, 30.36], [-80.84, 35.00], [-85.61, 35.00]],
  MA: [[-73.51, 41.24], [-69.93, 41.24], [-69.93, 42.89], [-73.51, 42.89]],
  WA: [[-124.85, 45.54], [-116.92, 45.54], [-116.92, 49.00], [-124.85, 49.00]],
  TN: [[-90.31, 34.98], [-81.65, 34.98], [-81.65, 36.68], [-90.31, 36.68]],
  VA: [[-83.68, 36.54], [-75.24, 36.54], [-75.24, 39.47], [-83.68, 39.47]],
  CO: [[-109.06, 36.99], [-102.04, 36.99], [-102.04, 41.00], [-109.06, 41.00]]
};

// Zipcode to coordinates mapping (major cities)
const zipcodeCoords = {
  "10001": [40.7506, -73.9971], // NYC
  "90210": [34.0901, -118.4065], // Beverly Hills
  "60601": [41.8857, -87.6210], // Chicago
  "77001": [29.7498, -95.3594], // Houston
  "02101": [42.3582, -71.0636], // Boston
  "37201": [36.1622, -86.7744], // Nashville
  "85001": [33.4484, -112.0740], // Phoenix
  "98101": [47.6062, -122.3321], // Seattle
  "80202": [39.7539, -104.9910], // Denver
  "33101": [25.7907, -80.1300], // Miami
  "94102": [37.7793, -122.4193], // SF
  "19101": [39.9526, -75.1652], // Philadelphia
  "30301": [33.7490, -84.3880], // Atlanta
  "48201": [42.3314, -83.0458], // Detroit
  "55401": [44.9778, -93.2650], // Minneapolis
  "63101": [38.6270, -90.1994], // St Louis
  "20001": [38.9072, -77.0369], // DC
  "97201": [45.5152, -122.6784], // Portland
  "28201": [35.2271, -80.8431], // Charlotte
  "32801": [28.5383, -81.3792]  // Orlando
};

const severityColors = {
  extreme: { color: "#DC2626", opacity: 0.4 },
  severe: { color: "#EA580C", opacity: 0.35 },
  moderate: { color: "#F59E0B", opacity: 0.3 },
  minor: { color: "#3B82F6", opacity: 0.25 }
};

const riskColors = {
  critical: "#DC2626",
  high: "#EA580C",
  medium: "#F59E0B",
  low: "#10B981"
};

export default function WeatherRiskMap({ alerts = [], deliveries = [] }) {
  // Get affected state polygons
  const getAffectedRegions = () => {
    const regions = [];
    alerts.forEach(alert => {
      alert.affected_states?.forEach(state => {
        if (stateBoundaries[state]) {
          const coords = stateBoundaries[state];
          // Convert to [lat, lng] format for Leaflet
          const polygon = [
            [coords[0][1], coords[0][0]],
            [coords[1][1], coords[1][0]],
            [coords[2][1], coords[2][0]],
            [coords[3][1], coords[3][0]]
          ];
          regions.push({
            polygon,
            alert,
            state
          });
        }
      });
    });
    return regions;
  };

  const affectedRegions = getAffectedRegions();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
    >
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">US Weather Risk Map</h3>
            <p className="text-sm text-slate-500">Real-time alert coverage & delivery locations</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-slate-600">Extreme</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-slate-600">Severe</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-slate-600">Moderate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-slate-600">Minor</span>
            </div>
          </div>
        </div>
      </div>

      <div className="h-[500px] w-full">
        <MapContainer
          center={[39.8283, -98.5795]}
          zoom={4}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Weather Alert Regions */}
          {affectedRegions.map((region, idx) => (
            <Polygon
              key={`region-${idx}`}
              positions={region.polygon}
              pathOptions={{
                color: severityColors[region.alert.severity]?.color || "#3B82F6",
                fillColor: severityColors[region.alert.severity]?.color || "#3B82F6",
                fillOpacity: severityColors[region.alert.severity]?.opacity || 0.3,
                weight: 2
              }}
            >
              <Popup>
                <div className="p-2 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <span className="font-semibold text-slate-900">{region.state}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-700 mb-1">{region.alert.event}</p>
                  <p className="text-xs text-slate-600 mb-2">{region.alert.headline}</p>
                  <Badge className="text-xs capitalize">
                    {region.alert.severity}
                  </Badge>
                </div>
              </Popup>
            </Polygon>
          ))}

          {/* Delivery Markers */}
          {deliveries.map((delivery) => {
            const coords = zipcodeCoords[delivery.zipcode];
            if (!coords) return null;

            const color = riskColors[delivery.risk_level] || riskColors.low;

            return (
              <CircleMarker
                key={delivery.id}
                center={coords}
                radius={8}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: 0.7,
                  weight: 2
                }}
              >
                <Popup>
                  <div className="p-2 min-w-[220px]">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-slate-900">{delivery.tracking_id}</span>
                    </div>
                    
                    <div className="space-y-1 text-sm mb-2">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <MapPin className="w-3 h-3" />
                        {delivery.city}, {delivery.state} {delivery.zipcode}
                      </div>
                      <p className="text-xs text-slate-500">
                        Delivery: {new Date(delivery.delivery_date).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <RiskBadge level={delivery.risk_level || "low"} size="sm" />
                      <span className="text-xs font-semibold text-slate-700">
                        {delivery.risk_score || 0}%
                      </span>
                    </div>

                    {delivery.weather_alerts?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200">
                        <p className="text-xs font-medium text-amber-700">
                          ⚠️ {delivery.weather_alerts.length} Active Alert(s)
                        </p>
                      </div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </motion.div>
  );
}