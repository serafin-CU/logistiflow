import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function MetricCard({ title, value, subtitle, icon: Icon, trend, trendUp, className, accentColor = "blue" }) {
  const colorVariants = {
    blue: "from-blue-500/10 to-blue-600/5 border-blue-200/50",
    red: "from-red-500/10 to-red-600/5 border-red-200/50",
    amber: "from-amber-500/10 to-amber-600/5 border-amber-200/50",
    green: "from-emerald-500/10 to-emerald-600/5 border-emerald-200/50",
    purple: "from-purple-500/10 to-purple-600/5 border-purple-200/50"
  };

  const iconColors = {
    blue: "text-blue-600 bg-blue-100",
    red: "text-red-600 bg-red-100",
    amber: "text-amber-600 bg-amber-100",
    green: "text-emerald-600 bg-emerald-100",
    purple: "text-purple-600 bg-purple-100"
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6",
        colorVariants[accentColor],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-500 tracking-wide uppercase">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-4xl font-bold text-slate-900 tracking-tight">
              {value}
            </h3>
            {trend && (
              <span className={cn(
                "text-sm font-semibold",
                trendUp ? "text-emerald-600" : "text-red-600"
              )}>
                {trendUp ? "↑" : "↓"} {trend}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={cn(
            "p-3 rounded-xl",
            iconColors[accentColor]
          )}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </motion.div>
  );
}