import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Simplified US state positions for visualization
const statePositions = {
  WA: { x: 8, y: 5 }, OR: { x: 7, y: 12 }, CA: { x: 5, y: 28 }, NV: { x: 10, y: 22 },
  ID: { x: 14, y: 12 }, MT: { x: 22, y: 6 }, WY: { x: 24, y: 16 }, UT: { x: 15, y: 26 },
  AZ: { x: 14, y: 38 }, CO: { x: 26, y: 28 }, NM: { x: 22, y: 40 }, ND: { x: 38, y: 6 },
  SD: { x: 38, y: 14 }, NE: { x: 38, y: 22 }, KS: { x: 40, y: 30 }, OK: { x: 42, y: 38 },
  TX: { x: 38, y: 50 }, MN: { x: 48, y: 10 }, IA: { x: 50, y: 20 }, MO: { x: 52, y: 30 },
  AR: { x: 52, y: 40 }, LA: { x: 52, y: 52 }, WI: { x: 56, y: 12 }, IL: { x: 58, y: 24 },
  MS: { x: 58, y: 46 }, MI: { x: 66, y: 14 }, IN: { x: 64, y: 26 }, KY: { x: 66, y: 34 },
  TN: { x: 64, y: 40 }, AL: { x: 64, y: 50 }, OH: { x: 72, y: 26 }, WV: { x: 76, y: 32 },
  VA: { x: 80, y: 36 }, NC: { x: 80, y: 44 }, SC: { x: 78, y: 50 }, GA: { x: 72, y: 52 },
  FL: { x: 78, y: 64 }, PA: { x: 80, y: 24 }, NY: { x: 84, y: 16 }, NJ: { x: 88, y: 28 },
  CT: { x: 92, y: 22 }, RI: { x: 94, y: 20 }, MA: { x: 94, y: 16 }, VT: { x: 88, y: 10 },
  NH: { x: 92, y: 10 }, ME: { x: 96, y: 6 }, MD: { x: 86, y: 34 }, DE: { x: 88, y: 32 },
  AK: { x: 8, y: 60 }, HI: { x: 22, y: 64 }
};

export default function USMapView({ alerts = [], deliveries = [] }) {
  // Calculate state risk based on alerts
  const stateRisk = {};
  alerts.forEach(alert => {
    alert.affected_states?.forEach(state => {
      const severity = alert.severity === "extreme" ? 100 : 
                       alert.severity === "severe" ? 75 :
                       alert.severity === "moderate" ? 50 : 25;
      stateRisk[state] = Math.max(stateRisk[state] || 0, severity);
    });
  });

  // Count deliveries per state
  const stateDeliveries = {};
  deliveries.forEach(d => {
    if (d.state) {
      stateDeliveries[d.state] = (stateDeliveries[d.state] || 0) + 1;
    }
  });

  const getRiskColor = (state) => {
    const risk = stateRisk[state] || 0;
    if (risk >= 75) return "fill-red-400 stroke-red-600";
    if (risk >= 50) return "fill-orange-400 stroke-orange-600";
    if (risk >= 25) return "fill-amber-300 stroke-amber-500";
    return "fill-slate-200 stroke-slate-300";
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-2xl border border-slate-200 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">US Weather Risk Map</h3>
          <p className="text-sm text-slate-500">Real-time alert coverage</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-slate-200 border border-slate-300" />
            <span className="text-slate-600">Clear</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-300 border border-amber-500" />
            <span className="text-slate-600">Minor</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-orange-400 border border-orange-600" />
            <span className="text-slate-600">Moderate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-400 border border-red-600" />
            <span className="text-slate-600">Severe</span>
          </div>
        </div>
      </div>

      <div className="relative aspect-[2/1] bg-slate-50 rounded-xl overflow-hidden">
        <svg viewBox="0 0 100 75" className="w-full h-full">
          {Object.entries(statePositions).map(([state, pos]) => (
            <g key={state}>
              <motion.circle
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: Math.random() * 0.3 }}
                cx={pos.x}
                cy={pos.y}
                r={stateDeliveries[state] ? 3.5 : 2.5}
                className={cn(
                  "transition-colors duration-300",
                  getRiskColor(state)
                )}
                strokeWidth={0.5}
              />
              {stateDeliveries[state] > 0 && (
                <text
                  x={pos.x}
                  y={pos.y + 0.5}
                  textAnchor="middle"
                  className="fill-white text-[2.5px] font-bold"
                >
                  {stateDeliveries[state]}
                </text>
              )}
              <text
                x={pos.x}
                y={pos.y + 5}
                textAnchor="middle"
                className="fill-slate-500 text-[2px]"
              >
                {state}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </motion.div>
  );
}