import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Search, RefreshCw, CloudLightning, Package, 
  AlertTriangle, TrendingUp, Upload, Filter
} from "lucide-react";
import { format, addDays } from "date-fns";

import MetricCard from "@/components/dashboard/MetricCard";
import RiskChart from "@/components/dashboard/RiskChart";
import AlertCard from "@/components/dashboard/AlertCard";
import DeliveryRow from "@/components/dashboard/DeliveryRow";
import InteractiveWeatherMap from "@/components/map/InteractiveWeatherMap";
import AddDeliveryModal from "@/components/delivery/AddDeliveryModal";
import DeliveryDetailSheet from "@/components/delivery/DeliveryDetailSheet";
import BulkUploadModal from "@/components/upload/BulkUploadModal";
import ManagerBriefing from "@/components/briefing/ManagerBriefing";

const Delivery = base44.entities.Delivery;
const WeatherAlert = base44.entities.WeatherAlert;
const Ring = base44.entities.Ring;

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [isRefreshingAlerts, setIsRefreshingAlerts] = useState(false);
  const [isRefreshingRisk, setIsRefreshingRisk] = useState(false);

  // Fetch deliveries
  const { data: deliveries = [], isLoading: loadingDeliveries } = useQuery({
    queryKey: ["deliveries"],
    queryFn: () => Delivery.list("-created_date", 100)
  });

  // Fetch weather alerts
  const { data: alerts = [], isLoading: loadingAlerts } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => WeatherAlert.filter({ is_active: true }, "-created_date", 50)
  });

  // Fetch rings
  const { data: rings = [] } = useQuery({
    queryKey: ["rings"],
    queryFn: () => Ring.filter({ is_active: true })
  });

  // Calculate risk using AI
  const calculateRisk = async (delivery) => {
    const relevantAlerts = alerts.filter(alert => {
      if (alert.affected_states?.includes(delivery.state)) return true;
      return false;
    });

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze the delivery risk based on weather conditions:
      
      Delivery Details:
      - Location: ${delivery.city}, ${delivery.state} ${delivery.zipcode}
      - Scheduled Date: ${delivery.delivery_date}
      
      Active Weather Alerts in the area:
      ${relevantAlerts.length > 0 ? relevantAlerts.map(a => `- ${a.event} (${a.severity}): ${a.headline}`).join("\n") : "No active alerts"}
      
      Calculate a risk score from 0-100 and classify as low/medium/high/critical.
      Consider factors like:
      - Severity of weather alerts
      - Impact on road conditions and delivery logistics
      - Timing overlap between alert and delivery date`,
      response_json_schema: {
        type: "object",
        properties: {
          risk_score: { type: "number" },
          risk_level: { type: "string", enum: ["low", "medium", "high", "critical"] },
          weather_alerts: { type: "array", items: { type: "string" } },
          reasoning: { type: "string" }
        },
        required: ["risk_score", "risk_level"]
      }
    });

    return response;
  };

  // Create delivery mutation
  const createDeliveryMutation = useMutation({
    mutationFn: async (data) => {
      const delivery = await Delivery.create(data);
      const risk = await calculateRisk({ ...data, id: delivery.id });
      await Delivery.update(delivery.id, {
        risk_score: risk.risk_score,
        risk_level: risk.risk_level,
        weather_alerts: risk.weather_alerts || []
      });
      return delivery;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      setShowAddModal(false);
    }
  });

  // Bulk create mutation
  const bulkCreateMutation = useMutation({
    mutationFn: async (dataArray) => {
      const deliveries = await Delivery.bulkCreate(dataArray);
      // Calculate risk for each delivery
      for (const delivery of deliveries) {
        const risk = await calculateRisk(delivery);
        await Delivery.update(delivery.id, {
          risk_score: risk.risk_score,
          risk_level: risk.risk_level,
          weather_alerts: risk.weather_alerts || []
        });
      }
      return deliveries;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      setShowBulkModal(false);
    }
  });

  // Delete delivery mutation
  const deleteDeliveryMutation = useMutation({
    mutationFn: (id) => Delivery.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    }
  });

  // Refresh weather alerts from weather.gov
  const refreshWeatherAlerts = async () => {
    setIsRefreshingAlerts(true);
    try {
      await base44.functions.invoke('fetchWeatherAlerts');
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    } finally {
      setIsRefreshingAlerts(false);
    }
  };

  // Refresh risk for a specific delivery
  const refreshDeliveryRisk = async (delivery) => {
    setIsRefreshingRisk(true);
    try {
      const risk = await calculateRisk(delivery);
      await Delivery.update(delivery.id, {
        risk_score: risk.risk_score,
        risk_level: risk.risk_level,
        weather_alerts: risk.weather_alerts || []
      });
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      setSelectedDelivery(prev => prev ? { ...prev, ...risk } : null);
    } finally {
      setIsRefreshingRisk(false);
    }
  };

  // Filter deliveries
  // Filter for upcoming deliveries only (future dates)
  const upcomingDeliveries = deliveries.filter(d => {
    if (!d.delivery_date) return false;
    const deliveryDate = new Date(d.delivery_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return deliveryDate >= today;
  });

  const filteredDeliveries = upcomingDeliveries.filter(d => {
    const matchesSearch = !searchQuery || 
      d.tracking_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.zipcode?.includes(searchQuery);
    
    const matchesRisk = riskFilter === "all" || d.risk_level === riskFilter;
    
    return matchesSearch && matchesRisk;
  });

  // Calculate metrics (upcoming deliveries only)
  const totalDeliveries = upcomingDeliveries.length;
  const highRiskCount = upcomingDeliveries.filter(d => d.risk_level === "high" || d.risk_level === "critical").length;
  const activeAlerts = alerts.length;
  const avgRisk = upcomingDeliveries.length > 0 
    ? Math.round(upcomingDeliveries.reduce((sum, d) => sum + (d.risk_score || 0), 0) / upcomingDeliveries.length)
    : 0;

  // Generate chart data (upcoming deliveries only)
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i);
    const dateStr = format(date, "yyyy-MM-dd");
    const dayDeliveries = upcomingDeliveries.filter(d => d.delivery_date === dateStr);
    const avgDayRisk = dayDeliveries.length > 0
      ? Math.round(dayDeliveries.reduce((sum, d) => sum + (d.risk_score || 0), 0) / dayDeliveries.length)
      : 0;
    
    return {
      date: format(date, "MMM d"),
      risk: avgDayRisk,
      deliveries: dayDeliveries.length
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Weather Risk Intelligence
            </h1>
            <p className="text-slate-500 mt-1">
              Real-time weather alerts & delivery risk forecasting
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={refreshWeatherAlerts}
              disabled={isRefreshingAlerts}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshingAlerts ? "animate-spin" : ""}`} />
              Sync Alerts
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowBulkModal(true)}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              Bulk Upload
            </Button>
            <Button
              onClick={() => setShowAddModal(true)}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Delivery
            </Button>
          </div>
        </motion.div>

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Total Deliveries"
            value={totalDeliveries}
            subtitle="Scheduled"
            icon={Package}
            accentColor="blue"
          />
          <MetricCard
            title="High Risk"
            value={highRiskCount}
            subtitle="Deliveries at risk"
            icon={AlertTriangle}
            accentColor="red"
          />
          <MetricCard
            title="Active Alerts"
            value={activeAlerts}
            subtitle="Weather warnings"
            icon={CloudLightning}
            accentColor="amber"
          />
          <MetricCard
            title="Avg Risk Score"
            value={`${avgRisk}%`}
            subtitle="Across all deliveries"
            icon={TrendingUp}
            accentColor="purple"
          />
        </div>

        {/* Manager Briefing Section */}
        {upcomingDeliveries.length > 0 && (
          <div className="mb-8">
            <ManagerBriefing deliveries={upcomingDeliveries} alerts={alerts} />
          </div>
        )}

        {/* Interactive Map - Full Width */}
        <div className="mb-8">
          <InteractiveWeatherMap rings={rings} alerts={alerts} />
        </div>

        {/* Chart */}
        <div className="mb-8">
          <RiskChart data={chartData} />
        </div>

        {/* Weather Alerts */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <CloudLightning className="w-5 h-5 text-amber-500" />
              Active Weather Alerts
            </h2>
            <span className="text-sm text-slate-500">
              {alerts.length} active alerts
            </span>
          </div>
          
          {alerts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AnimatePresence>
                {alerts.slice(0, 6).map((alert, i) => (
                  <AlertCard key={alert.id} alert={alert} index={i} />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <CloudLightning className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No active weather alerts</p>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshWeatherAlerts}
                className="mt-3"
              >
                Sync Weather Alerts
              </Button>
            </div>
          )}
        </motion.div>

        {/* Deliveries List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-500" />
              Upcoming Deliveries
            </h2>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search deliveries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              
              <Tabs value={riskFilter} onValueChange={setRiskFilter}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="low">Low</TabsTrigger>
                  <TabsTrigger value="medium">Medium</TabsTrigger>
                  <TabsTrigger value="high">High</TabsTrigger>
                  <TabsTrigger value="critical">Critical</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {upcomingDeliveries.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-700 font-medium mb-2">Upload upcoming tasks, with Ring ID, shipping or delivery date, so that we can assess correctly</p>
              <div className="flex items-center justify-center gap-3 mt-4">
                <Button
                  onClick={() => setShowBulkModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Import CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAddModal(true)}
                >
                  Add Manually
                </Button>
              </div>
            </div>
          ) : filteredDeliveries.length > 0 ? (
            <div className="space-y-2">
              <AnimatePresence>
                {filteredDeliveries.map((delivery, i) => (
                  <DeliveryRow
                    key={delivery.id}
                    delivery={delivery}
                    index={i}
                    onClick={() => {
                      setSelectedDelivery(delivery);
                      setShowDetailSheet(true);
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No deliveries match your filters</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Modals */}
      <AddDeliveryModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSubmit={(data) => createDeliveryMutation.mutate(data)}
        isLoading={createDeliveryMutation.isPending}
      />

      <BulkUploadModal
        open={showBulkModal}
        onOpenChange={setShowBulkModal}
        onSubmit={(data) => bulkCreateMutation.mutate(data)}
        isLoading={bulkCreateMutation.isPending}
      />

      <DeliveryDetailSheet
        delivery={selectedDelivery}
        open={showDetailSheet}
        onOpenChange={setShowDetailSheet}
        onDelete={(id) => deleteDeliveryMutation.mutate(id)}
        onRefreshRisk={refreshDeliveryRisk}
        isRefreshing={isRefreshingRisk}
      />
    </div>
  );
}