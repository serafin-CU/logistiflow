import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CloudRain, CloudSnow, Wind, Zap, CloudFog, Thermometer, Waves, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

const severityColors = {
  minor: "border-l-blue-400 bg-blue-50/50",
  moderate: "border-l-amber-400 bg-amber-50/50",
  severe: "border-l-orange-500 bg-orange-50/50",
  extreme: "border-l-red-500 bg-red-50/50"
};

const getEventIcon = (event) => {
  const eventLower = event?.toLowerCase() || "";
  if (eventLower.includes("snow") || eventLower.includes("blizzard") || eventLower.includes("ice")) return CloudSnow;
  if (eventLower.includes("rain") || eventLower.includes("flood")) return CloudRain;
  if (eventLower.includes("wind") || eventLower.includes("tornado") || eventLower.includes("hurricane")) return Wind;
  if (eventLower.includes("thunder") || eventLower.includes("storm")) return Zap;
  if (eventLower.includes("fog")) return CloudFog;
  if (eventLower.includes("heat") || eventLower.includes("cold")) return Thermometer;
  if (eventLower.includes("tsunami") || eventLower.includes("coastal")) return Waves;
  return AlertTriangle;
};

export default function AlertCard({ alert, index = 0 }) {
  const Icon = getEventIcon(alert.event);
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "border-l-4 rounded-lg p-4 hover:shadow-md transition-shadow",
        severityColors[alert.severity] || severityColors.minor
      )}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-white rounded-lg shadow-sm">
          <Icon className="w-5 h-5 text-slate-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-slate-900 truncate">{alert.event}</h4>
            <span className={cn(
              "px-2 py-0.5 text-xs font-medium rounded-full capitalize",
              alert.severity === "extreme" && "bg-red-200 text-red-800",
              alert.severity === "severe" && "bg-orange-200 text-orange-800",
              alert.severity === "moderate" && "bg-amber-200 text-amber-800",
              alert.severity === "minor" && "bg-blue-200 text-blue-800"
            )}>
              {alert.severity}
            </span>
          </div>
          <p className="text-sm text-slate-600 line-clamp-2 mb-2">{alert.headline}</p>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            {alert.affected_states?.length > 0 && (
              <span>{alert.affected_states.slice(0, 3).join(", ")}{alert.affected_states.length > 3 ? ` +${alert.affected_states.length - 3}` : ""}</span>
            )}
            {alert.end_time && (
              <span>Until {format(new Date(alert.end_time), "MMM d, h:mm a")}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}