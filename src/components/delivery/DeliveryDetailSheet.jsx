import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { MapPin, Calendar, Package, AlertTriangle, Trash2, RefreshCw } from "lucide-react";
import RiskBadge from "../dashboard/RiskBadge";
import { motion } from "framer-motion";

const statusColors = {
  scheduled: "bg-slate-100 text-slate-700 border-slate-200",
  in_transit: "bg-blue-100 text-blue-700 border-blue-200",
  delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
  delayed: "bg-amber-100 text-amber-700 border-amber-200",
  cancelled: "bg-red-100 text-red-700 border-red-200"
};

export default function DeliveryDetailSheet({ 
  delivery, 
  open, 
  onOpenChange, 
  onDelete, 
  onRefreshRisk,
  isRefreshing 
}) {
  if (!delivery) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <SheetTitle className="text-xl">{delivery.tracking_id}</SheetTitle>
              <SheetDescription>
                {delivery.city}, {delivery.state} {delivery.zipcode}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Risk Assessment */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-slate-50 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-900">Risk Assessment</h4>
              <RiskBadge level={delivery.risk_level || "low"} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Risk Score</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${delivery.risk_score || 0}%` }}
                    className={`h-full rounded-full ${
                      (delivery.risk_score || 0) >= 75 ? "bg-red-500" :
                      (delivery.risk_score || 0) >= 50 ? "bg-orange-500" :
                      (delivery.risk_score || 0) >= 25 ? "bg-amber-500" :
                      "bg-emerald-500"
                    }`}
                  />
                </div>
                <span className="text-sm font-semibold text-slate-900 w-10">
                  {delivery.risk_score || 0}%
                </span>
              </div>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => onRefreshRisk(delivery)}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh Risk Analysis
            </Button>
          </motion.div>

          {/* Delivery Details */}
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900">Delivery Details</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Status</span>
                <Badge variant="outline" className={statusColors[delivery.status] || statusColors.scheduled}>
                  {delivery.status?.replace("_", " ") || "Scheduled"}
                </Badge>
              </div>
              
              <div className="space-y-1">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Delivery Date</span>
                <p className="font-medium text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  {delivery.delivery_date ? format(new Date(delivery.delivery_date), "MMM d, yyyy") : "—"}
                </p>
              </div>
              
              <div className="space-y-1">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Destination</span>
                <p className="font-medium text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {delivery.zipcode}
                </p>
              </div>
              
              <div className="space-y-1">
                <span className="text-xs text-slate-500 uppercase tracking-wide">Location</span>
                <p className="font-medium text-slate-900">
                  {delivery.city}, {delivery.state}
                </p>
              </div>
            </div>
          </div>

          {/* Weather Alerts */}
          {delivery.weather_alerts?.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Active Weather Alerts
                </h4>
                <div className="space-y-2">
                  {delivery.weather_alerts.map((alert, i) => (
                    <div key={i} className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                      {alert}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Notes */}
          {delivery.notes && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-900">Notes</h4>
                <p className="text-sm text-slate-600">{delivery.notes}</p>
              </div>
            </>
          )}

          {/* Actions */}
          <Separator />
          <div className="flex gap-3">
            <Button 
              variant="destructive" 
              className="flex-1"
              onClick={() => {
                onDelete(delivery.id);
                onOpenChange(false);
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Delivery
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}