import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { format, isPast, parseISO } from "date-fns";
import { MapPin, Calendar, Package, AlertTriangle, Trash2, RefreshCw, Star, CheckCircle } from "lucide-react";
import RiskBadge from "../dashboard/RiskBadge";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [hoveredStar, setHoveredStar] = useState(0);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Failed to load user:", error);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (delivery) {
      setRating(delivery.prediction_accuracy || 0);
      setFeedback(delivery.prediction_feedback || "");
    }
  }, [delivery]);

  const submitRatingMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Delivery.update(delivery.id, {
        prediction_accuracy: rating,
        prediction_feedback: feedback,
        rated_by: user.email,
        rated_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    }
  });

  if (!delivery) return null;

  const deliveryDate = delivery.delivery_date ? parseISO(delivery.delivery_date) : null;
  const isDeliveryPast = deliveryDate ? isPast(deliveryDate) : false;
  const isAdmin = user?.role === "admin";
  const canRate = isAdmin && isDeliveryPast;
  const hasRated = delivery.prediction_accuracy && delivery.rated_by;

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

          {/* Prediction Rating - Admin Only, After Delivery Date */}
          {canRate && (
            <>
              <Separator />
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl space-y-4 border border-blue-200"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-slate-900">Rate AI Prediction</h4>
                  {hasRated && (
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Rated
                    </Badge>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-slate-600 mb-2">How accurate was our risk prediction?</p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoveredStar(star)}
                          onMouseLeave={() => setHoveredStar(0)}
                          className="transition-transform hover:scale-110"
                        >
                          <Star
                            className={`w-8 h-8 ${
                              star <= (hoveredStar || rating)
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-300"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-slate-600 mb-2 block">
                      Feedback (optional)
                    </label>
                    <Textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="What could we improve in our predictions?"
                      rows={3}
                      className="text-sm"
                    />
                  </div>

                  {hasRated && (
                    <div className="text-xs text-slate-500">
                      Rated by {delivery.rated_by} on {format(new Date(delivery.rated_at), "MMM d, yyyy 'at' h:mm a")}
                    </div>
                  )}

                  <Button
                    onClick={() => submitRatingMutation.mutate()}
                    disabled={rating === 0 || submitRatingMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {submitRatingMutation.isPending ? "Saving..." : hasRated ? "Update Rating" : "Submit Rating"}
                  </Button>
                </div>
              </motion.div>
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