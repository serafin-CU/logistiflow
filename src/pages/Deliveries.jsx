import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Search, Filter, Download, Trash2, RefreshCw,
  MapPin, Calendar, Package, ChevronLeft, ChevronRight, FileSpreadsheet
} from "lucide-react";
import { format } from "date-fns";
import RiskBadge from "@/components/dashboard/RiskBadge";
import AddDeliveryModal from "@/components/delivery/AddDeliveryModal";
import DeliveryDetailSheet from "@/components/delivery/DeliveryDetailSheet";
import BulkUploadModal from "@/components/upload/BulkUploadModal";
import GoogleSheetImportModal from "@/components/delivery/GoogleSheetImportModal";

const Delivery = base44.entities.Delivery;
const WeatherAlert = base44.entities.WeatherAlert;

const statusColors = {
  scheduled: "bg-slate-100 text-slate-700",
  in_transit: "bg-blue-100 text-blue-700",
  delivered: "bg-emerald-100 text-emerald-700",
  delayed: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700"
};

export default function Deliveries() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isRefreshingRisk, setIsRefreshingRisk] = useState(false);
  const pageSize = 20;

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ["deliveries"],
    queryFn: () => Delivery.list("-created_date", 500)
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => WeatherAlert.filter({ is_active: true })
  });

  const calculateRisk = async (delivery) => {
    const relevantAlerts = alerts.filter(alert => 
      alert.affected_states?.includes(delivery.state)
    );

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze delivery risk:
      Location: ${delivery.city}, ${delivery.state} ${delivery.zipcode}
      Date: ${delivery.delivery_date}
      Alerts: ${relevantAlerts.map(a => `${a.event} (${a.severity})`).join(", ") || "None"}
      
      Calculate risk score 0-100 and level (low/medium/high/critical).`,
      response_json_schema: {
        type: "object",
        properties: {
          risk_score: { type: "number" },
          risk_level: { type: "string", enum: ["low", "medium", "high", "critical"] },
          weather_alerts: { type: "array", items: { type: "string" } }
        }
      }
    });
    return response;
  };

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

  const bulkCreateMutation = useMutation({
    mutationFn: async (dataArray) => {
      const deliveries = await Delivery.bulkCreate(dataArray);
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

  const deleteDeliveryMutation = useMutation({
    mutationFn: (id) => Delivery.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deliveries"] })
  });

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

  // Filter and paginate
  const filteredDeliveries = deliveries.filter(d => {
    const matchesSearch = !searchQuery || 
      d.order_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.tracking_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.customer_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.store_market?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.store_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    const matchesRisk = riskFilter === "all" || d.risk_level === riskFilter;
    return matchesSearch && matchesStatus && matchesRisk;
  });

  const totalPages = Math.ceil(filteredDeliveries.length / pageSize);
  const paginatedDeliveries = filteredDeliveries.slice((page - 1) * pageSize, page * pageSize);

  // Export to CSV
  const exportCSV = () => {
    const headers = ["Customer ID", "Region ID", "Store Market", "Store Name", "Active", "Subscription", "Order ID", "Delivery Date", "Expected Date"];
    const rows = filteredDeliveries.map(d => [
      d.customer_id, d.current_region_id, d.store_market, d.store_name, d.is_active, d.is_active_subscription, d.order_id || d.tracking_id, d.delivery_date, d.expected_delivery_date
    ]);
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deliveries-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
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
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Deliveries</h1>
            <p className="text-slate-500 mt-1">
              {filteredDeliveries.length} total deliveries
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={exportCSV} className="gap-2">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => setShowSheetModal(true)} className="gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Google Sheets
            </Button>
            <Button variant="outline" onClick={() => setShowBulkModal(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Bulk Upload
            </Button>
            <Button onClick={() => setShowAddModal(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Add Delivery
            </Button>
          </div>
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
                placeholder="Search by order ID, customer ID, store..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <div className="flex gap-3">
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={riskFilter} onValueChange={(v) => { setRiskFilter(v); setPage(1); }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Risk Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Risk Levels</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-xl border border-slate-200 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Customer ID</TableHead>
                  <TableHead>Region ID</TableHead>
                  <TableHead>Store Market</TableHead>
                  <TableHead>Store Name</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Delivery Date</TableHead>
                  <TableHead>Expected Date</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="wait">
                  {paginatedDeliveries.map((delivery, i) => (
                    <motion.tr
                      key={delivery.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => {
                        setSelectedDelivery(delivery);
                        setShowDetailSheet(true);
                      }}
                    >
                      <TableCell className="font-medium">{delivery.customer_id || "—"}</TableCell>
                      <TableCell>{delivery.current_region_id || "—"}</TableCell>
                      <TableCell>{delivery.store_market || "—"}</TableCell>
                      <TableCell>{delivery.store_name || "—"}</TableCell>
                      <TableCell>
                        <Badge className={delivery.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}>
                          {delivery.is_active ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={delivery.is_active_subscription ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"}>
                          {delivery.is_active_subscription ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{delivery.order_id || delivery.tracking_id || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {delivery.delivery_date ? format(new Date(delivery.delivery_date), "MMM d, yyyy") : "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {delivery.expected_delivery_date ? format(new Date(delivery.expected_delivery_date), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDeliveryMutation.mutate(delivery.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <p className="text-sm text-slate-500">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredDeliveries.length)} of {filteredDeliveries.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-slate-600">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </motion.div>

        {filteredDeliveries.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No deliveries found</p>
          </div>
        )}
      </div>

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

      <GoogleSheetImportModal
        open={showSheetModal}
        onOpenChange={setShowSheetModal}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["deliveries"] })}
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