import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { 
  RefreshCw, Search, CloudLightning, CloudRain, CloudSnow, 
  Wind, Zap, Thermometer, AlertTriangle, Trash2, Clock
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const WeatherAlert = base44.entities.WeatherAlert;

const severityColors = {
  minor: "bg-blue-100 text-blue-800 border-blue-200",
  moderate: "bg-amber-100 text-amber-800 border-amber-200",
  severe: "bg-orange-100 text-orange-800 border-orange-200",
  extreme: "bg-red-100 text-red-800 border-red-200"
};

const getEventIcon = (event) => {
  const e = event?.toLowerCase() || "";
  if (e.includes("snow") || e.includes("blizzard") || e.includes("ice")) return CloudSnow;
  if (e.includes("rain") || e.includes("flood")) return CloudRain;
  if (e.includes("wind") || e.includes("tornado") || e.includes("hurricane")) return Wind;
  if (e.includes("thunder") || e.includes("storm")) return Zap;
  if (e.includes("heat") || e.includes("cold")) return Thermometer;
  return AlertTriangle;
};

export default function Alerts() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => WeatherAlert.list("-created_date", 100)
  });

  const deleteAlertMutation = useMutation({
    mutationFn: (id) => WeatherAlert.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] })
  });

  const refreshAlerts = async () => {
    setIsRefreshing(true);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Get the current active weather alerts for the United States from the National Weather Service.
        Search for real-time weather alerts, warnings, and watches.
        Include alerts like winter storms, severe thunderstorms, tornados, hurricanes, heat waves, flooding, etc.
        Return up to 15 most significant active alerts covering different regions.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            alerts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  event: { type: "string" },
                  severity: { type: "string", enum: ["minor", "moderate", "severe", "extreme"] },
                  headline: { type: "string" },
                  description: { type: "string" },
                  affected_states: { type: "array", items: { type: "string" } },
                  end_time: { type: "string" }
                }
              }
            }
          }
        }
      });

      // Clear existing alerts
      const existingAlerts = await WeatherAlert.list();
      for (const alert of existingAlerts) {
        await WeatherAlert.delete(alert.id);
      }

      // Create new alerts
      if (response?.alerts) {
        for (const alert of response.alerts) {
          await WeatherAlert.create({
            alert_id: `NWS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            event: alert.event,
            severity: alert.severity,
            headline: alert.headline,
            description: alert.description,
            affected_states: alert.affected_states,
            end_time: alert.end_time,
            is_active: true
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter alerts
  const filteredAlerts = alerts.filter(a => {
    const matchesSearch = !searchQuery ||
      a.event?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.headline?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.affected_states?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesSeverity = severityFilter === "all" || a.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  // Group alerts by severity
  const alertsBySeverity = {
    extreme: filteredAlerts.filter(a => a.severity === "extreme"),
    severe: filteredAlerts.filter(a => a.severity === "severe"),
    moderate: filteredAlerts.filter(a => a.severity === "moderate"),
    minor: filteredAlerts.filter(a => a.severity === "minor")
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
        >
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <CloudLightning className="w-8 h-8 text-amber-500" />
              Weather Alerts
            </h1>
            <p className="text-slate-500 mt-1">
              {alerts.length} active alerts across the United States
            </p>
          </div>
          <Button
            onClick={refreshAlerts}
            disabled={isRefreshing}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Syncing..." : "Sync NWS Alerts"}
          </Button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6"
        >
          {[
            { label: "Extreme", count: alertsBySeverity.extreme.length, color: "bg-red-500" },
            { label: "Severe", count: alertsBySeverity.severe.length, color: "bg-orange-500" },
            { label: "Moderate", count: alertsBySeverity.moderate.length, color: "bg-amber-500" },
            { label: "Minor", count: alertsBySeverity.minor.length, color: "bg-blue-500" }
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3"
            >
              <div className={cn("w-3 h-3 rounded-full", stat.color)} />
              <div>
                <p className="text-2xl font-bold text-slate-900">{stat.count}</p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-xl border border-slate-200 p-4 mb-6"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search alerts by event, headline, or state..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="extreme">Extreme</SelectItem>
                <SelectItem value="severe">Severe</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="minor">Minor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </motion.div>

        {/* Alerts List */}
        {filteredAlerts.length > 0 ? (
          <div className="space-y-4">
            <AnimatePresence>
              {filteredAlerts.map((alert, i) => {
                const Icon = getEventIcon(alert.event);
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: i * 0.03 }}
                    className={cn(
                      "bg-white rounded-xl border-l-4 border shadow-sm overflow-hidden",
                      alert.severity === "extreme" && "border-l-red-500",
                      alert.severity === "severe" && "border-l-orange-500",
                      alert.severity === "moderate" && "border-l-amber-500",
                      alert.severity === "minor" && "border-l-blue-500"
                    )}
                  >
                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "p-3 rounded-xl",
                          alert.severity === "extreme" && "bg-red-100",
                          alert.severity === "severe" && "bg-orange-100",
                          alert.severity === "moderate" && "bg-amber-100",
                          alert.severity === "minor" && "bg-blue-100"
                        )}>
                          <Icon className={cn(
                            "w-6 h-6",
                            alert.severity === "extreme" && "text-red-600",
                            alert.severity === "severe" && "text-orange-600",
                            alert.severity === "moderate" && "text-amber-600",
                            alert.severity === "minor" && "text-blue-600"
                          )} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-slate-900">{alert.event}</h3>
                            <Badge className={severityColors[alert.severity]}>
                              {alert.severity}
                            </Badge>
                          </div>
                          
                          <p className="text-slate-600 mb-3">{alert.headline}</p>
                          
                          {alert.description && (
                            <p className="text-sm text-slate-500 mb-3 line-clamp-2">
                              {alert.description}
                            </p>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                            {alert.affected_states?.length > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium">Affected:</span>
                                <span>{alert.affected_states.join(", ")}</span>
                              </div>
                            )}
                            
                            {alert.end_time && (
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />
                                <span>Until {format(new Date(alert.end_time), "MMM d, h:mm a")}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAlertMutation.mutate(alert.id)}
                        >
                          <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <CloudLightning className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Active Alerts</h3>
            <p className="text-slate-500 mb-4">
              {searchQuery || severityFilter !== "all" 
                ? "No alerts match your filters" 
                : "Click sync to fetch the latest weather alerts"}
            </p>
            <Button onClick={refreshAlerts} disabled={isRefreshing} className="bg-blue-600 hover:bg-blue-700">
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Sync Weather Alerts
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}