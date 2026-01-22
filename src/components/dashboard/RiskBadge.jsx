import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle, AlertCircle, XOctagon } from "lucide-react";

const riskConfig = {
  low: {
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircle,
    label: "Low Risk"
  },
  medium: {
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: AlertCircle,
    label: "Medium Risk"
  },
  high: {
    color: "bg-orange-100 text-orange-700 border-orange-200",
    icon: AlertTriangle,
    label: "High Risk"
  },
  critical: {
    color: "bg-red-100 text-red-700 border-red-200",
    icon: XOctagon,
    label: "Critical"
  }
};

export default function RiskBadge({ level, showLabel = true, size = "default" }) {
  const config = riskConfig[level] || riskConfig.low;
  const Icon = config.icon;

  const sizes = {
    sm: "px-2 py-0.5 text-xs gap-1",
    default: "px-3 py-1 text-sm gap-1.5",
    lg: "px-4 py-1.5 text-base gap-2"
  };

  const iconSizes = {
    sm: "w-3 h-3",
    default: "w-4 h-4",
    lg: "w-5 h-5"
  };

  return (
    <span className={cn(
      "inline-flex items-center font-medium rounded-full border",
      config.color,
      sizes[size]
    )}>
      <Icon className={iconSizes[size]} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}