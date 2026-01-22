import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { 
  Shield, Upload, Download, Database, RefreshCw, 
  AlertTriangle, Package, Trash2, Settings 
} from "lucide-react";
import { toast } from "sonner";

const Ring = base44.entities.Ring;
const Delivery = base44.entities.Delivery;
const WeatherAlert = base44.entities.WeatherAlert;

export default function Admin() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [csvData, setCsvData] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (currentUser.role !== 'admin') {
          window.location.href = '/';
          return;
        }
        setUser(currentUser);
      } catch (error) {
        window.location.href = '/';
      } finally {
        setLoading(false);
      }
    };
    checkAdmin();
  }, []);

  const { data: rings = [] } = useQuery({
    queryKey: ["rings"],
    queryFn: () => Ring.list("-created_date", 500),
    enabled: !!user
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ["deliveries"],
    queryFn: () => Delivery.list("-created_date", 500),
    enabled: !!user
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => WeatherAlert.list("-created_date", 500),
    enabled: !!user
  });

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setCsvData(text);
        await processCSVImport(text);
      }
    };
    reader.readAsText(file);
  };

  const processCSVImport = async (data) => {
    setIsUploading(true);
    try {
      const lines = data.trim().split("\n").filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error("CSV must have at least a header row and one data row");
        setIsUploading(false);
        return;
      }

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
      
      const hasRingId = headers.includes('ring_id');
      const hasStore = headers.includes('store') || headers.includes('store_name');
      
      if (!hasRingId || !hasStore) {
        toast.error("CSV must include 'ring_id' and 'store' columns");
        setIsUploading(false);
        return;
      }
      
      const ringData = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(",").map(v => v.trim());
        const row = {};
        headers.forEach((h, idx) => {
          const fieldName = h === 'store_name' ? 'store' : h;
          row[fieldName] = values[idx] || "";
        });

        if (!row.ring_id || !row.store) continue;

        const deliveryDays = row.delivery_days ? 
          row.delivery_days.split(/[;,]/).map(d => d.trim()).filter(d => d) : [];
        
        const timeSlots = row.time_slots ? 
          row.time_slots.split(/[;,]/).map(t => t.trim()).filter(t => t) : [];
        
        const zipcodes = row.zipcodes ? 
          row.zipcodes.split(/[;,]/).map(z => z.trim()).filter(z => z) : [];
        
        const deliveryTimeDays = row.region_name?.includes('2D') ? 2 : 1;

        const storeToState = {
          'New York': 'NY', 'Los Angeles': 'CA', 'Chicago': 'IL',
          'Houston': 'TX', 'Miami': 'FL', 'Boston': 'MA',
          'Seattle': 'WA', 'Denver': 'CO', 'Atlanta': 'GA',
          'Phoenix': 'AZ', 'San Francisco': 'CA', 'Philadelphia': 'PA',
          'Dallas': 'TX', 'San Diego': 'CA', 'San Jose': 'CA'
        };

        ringData.push({
          ring_id: row.ring_id,
          store: row.store,
          state: storeToState[row.store] || row.state || null,
          facility_center: row.facility_center || null,
          region_name: row.region_name || null,
          delivery_days: deliveryDays,
          time_slots: timeSlots,
          zipcodes: zipcodes,
          delivery_time_days: deliveryTimeDays,
          latitude: row.latitude ? parseFloat(row.latitude) : null,
          longitude: row.longitude ? parseFloat(row.longitude) : null,
          is_active: true
        });
      }

      if (ringData.length === 0) {
        throw new Error("No valid rings found in CSV data");
      }

      await Ring.bulkCreate(ringData);
      queryClient.invalidateQueries({ queryKey: ["rings"] });
      setCsvData("");
      toast.success(`Successfully imported ${ringData.length} ring(s)`);
    } catch (error) {
      toast.error(`Error importing rings: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["ring_id", "store", "facility_center", "region_name", "delivery_days", "time_slots", "zipcodes", "delivery_time_days", "latitude", "longitude"];
    const rows = rings.map(r => [
      r.ring_id,
      r.store,
      r.facility_center || '',
      r.region_name || '',
      r.delivery_days?.join(';') || '',
      r.time_slots?.join(';') || '',
      r.zipcodes?.join(';') || '',
      r.delivery_time_days || 1,
      r.latitude || '',
      r.longitude || ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rings-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success("Rings exported successfully");
  };

  const clearOldAlerts = async () => {
    if (!confirm('Delete alerts older than 7 days?')) return;
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    try {
      const oldAlerts = alerts.filter(a => new Date(a.created_date) < sevenDaysAgo);
      for (const alert of oldAlerts) {
        await WeatherAlert.delete(alert.id);
      }
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success(`Deleted ${oldAlerts.length} old alerts`);
    } catch (error) {
      toast.error("Error clearing alerts");
    }
  };

  const sampleCSV = `ring_id,store,facility_center,region_name,delivery_days,time_slots,zipcodes,latitude,longitude
NYC-R1,New York,New York Kitchen,Manhattan-1D,Monday;Wednesday;Friday,8-10am;10-12pm;12-2pm,10001;10002;10003,40.7128,-74.0060
NYC-R2,New York,Washington DC Hub,Brooklyn-2D,Tuesday;Thursday,10-12pm;2-4pm,11201;11205;11206,40.6782,-73.9442
LA-R1,Los Angeles,LA Kitchen,Downtown-1D,Monday;Wednesday,8-10am;12-2pm,90012;90013;90014,34.0522,-118.2437`;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-red-600 to-orange-600 rounded-xl">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Admin Panel
            </h1>
          </div>
          <p className="text-slate-500">
            Manage rings, deliveries, alerts, and system settings
          </p>
        </motion.div>

        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Database className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="text-sm text-slate-500">Total Rings</p>
                  <p className="text-3xl font-bold text-slate-900">{rings.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <Package className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-slate-500">Total Deliveries</p>
                  <p className="text-3xl font-bold text-slate-900">{deliveries.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-orange-600" />
                <div>
                  <p className="text-sm text-slate-500">Active Alerts</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {alerts.filter(a => a.is_active).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Tabs */}
        <Tabs defaultValue="rings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="rings">Ring Management</TabsTrigger>
            <TabsTrigger value="data">Data Management</TabsTrigger>
            <TabsTrigger value="system">System Settings</TabsTrigger>
          </TabsList>

          {/* Ring Management Tab */}
          <TabsContent value="rings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-blue-600" />
                  Import/Export Rings
                </CardTitle>
                <CardDescription>
                  Manage delivery ring data via CSV or Google Sheets
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-2">Import from Google Sheets</p>
                  <p className="text-xs text-blue-700 mb-3">
                    This will delete all existing rings and import fresh data from the configured spreadsheet.
                  </p>
                  <Button
                    onClick={async () => {
                      if (!confirm('This will delete ALL existing rings and import new data. Continue?')) return;
                      setIsUploading(true);
                      try {
                        const response = await base44.functions.invoke('importRingsFromSheet');
                        if (response.data.success) {
                          toast.success(`Successfully imported ${response.data.imported} rings`);
                          queryClient.invalidateQueries({ queryKey: ["rings"] });
                        } else {
                          toast.error(`Import failed: ${response.data.error}`);
                        }
                      } catch (error) {
                        toast.error(`Error: ${error.message}`);
                      } finally {
                        setIsUploading(false);
                      }
                    }}
                    disabled={isUploading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isUploading ? "Importing..." : "Import from Google Sheets"}
                  </Button>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Paste CSV Data
                  </label>
                  <Textarea
                    value={csvData}
                    onChange={(e) => setCsvData(e.target.value)}
                    placeholder={sampleCSV}
                    rows={8}
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Required: ring_id, store. Optional: facility_center, region_name, delivery_days, time_slots, zipcodes, latitude, longitude
                  </p>
                </div>

                <div className="flex gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".csv"
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    className="gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload CSV File
                  </Button>
                  <Button
                    onClick={() => processCSVImport(csvData)}
                    disabled={!csvData.trim() || isUploading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isUploading ? "Importing..." : "Import CSV"}
                  </Button>
                  <Button variant="outline" onClick={() => setCsvData(sampleCSV)}>
                    Load Sample
                  </Button>
                  <Button variant="outline" onClick={exportToCSV} className="gap-2">
                    <Download className="w-4 h-4" />
                    Export to CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Management Tab */}
          <TabsContent value="data" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-600" />
                  Data Cleanup
                </CardTitle>
                <CardDescription>
                  Manage and clean up system data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <p className="font-medium text-slate-900">Clear Old Alerts</p>
                    <p className="text-sm text-slate-500">
                      Remove inactive alerts older than 7 days
                    </p>
                  </div>
                  <Button variant="outline" onClick={clearOldAlerts}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <p className="font-medium text-slate-900">Refresh Weather Data</p>
                    <p className="text-sm text-slate-500">
                      Fetch latest weather alerts from NWS
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["alerts"] })}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Settings Tab */}
          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-slate-600" />
                  System Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-slate-600">Admin User</span>
                  <span className="font-medium">{user?.email}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-200">
                  <span className="text-slate-600">Total Database Records</span>
                  <span className="font-medium">{rings.length + deliveries.length + alerts.length}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-600">Last Updated</span>
                  <span className="font-medium">{new Date().toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}