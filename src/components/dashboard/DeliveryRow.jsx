import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { MapPin, Calendar, Package, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import RiskBadge from "./RiskBadge";

const statusColors = {
  scheduled: "bg-slate-100 text-slate-700",
  in_transit: "bg-blue-100 text-blue-700",
  delivered: "bg-emerald-100 text-emerald-700",
  delayed: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700"
};

export default function DeliveryRow({ delivery, index = 0, onClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      className="group flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex-shrink-0 p-3 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
        <Package className="w-5 h-5 text-slate-600" />
      </div>
      
      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-4">
        <div>
          <p className="font-semibold text-slate-900 truncate">{delivery.tracking_id}</p>
          <p className="text-sm text-slate-500">{delivery.city}, {delivery.state}</p>
        </div>
        
        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="truncate">{delivery.zipcode}</span>
        </div>
        
        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span>{delivery.delivery_date ? format(new Date(delivery.delivery_date), "MMM d, yyyy") : "—"}</span>
        </div>
        
        <div className="flex items-center gap-3">
          <RiskBadge level={delivery.risk_level || "low"} size="sm" />
          <span className={cn(
            "hidden sm:inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize",
            statusColors[delivery.status] || statusColors.scheduled
          )}>
            {delivery.status?.replace("_", " ") || "scheduled"}
          </span>
        </div>
      </div>
      
      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
    </motion.div>
  );
}