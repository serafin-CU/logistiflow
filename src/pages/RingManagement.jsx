import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Upload, MapPin, Store, Clock, Calendar, Download, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { format, addDays, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import RingMapVisualization from "@/components/ring/RingMapVisualization";
import RingDetailSheet from "@/components/ring/RingDetailSheet";

const Ring = base44.entities.Ring;
const WeatherAlert = base44.entities.WeatherAlert;

export default function RingManagement() {
  const queryClient = useQueryClient();
  const [csvData, setCsvData] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedRing, setSelectedRing] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setCsvData(text);
        // Auto-import after file is loaded
        await processCSVImport(text);
      }
    };
    reader.readAsText(file);
  };

  const processCSVImport = async (data) => {
    setIsUploading(true);
    try {
      const lines = data.trim().split("\n").filter(line => line.trim());
      
      if (lines.length === 0) {
        alert("⚠️ Please paste CSV data first");
        setIsUploading(false);
        return;
      }
      
      if (lines.length < 2) {
        alert("⚠️ CSV must have at least a header row and one data row");
        setIsUploading(false);
        return;
      }

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
      
      // Validate headers include required fields (accept variations)
      const hasRingId = headers.includes('ring_id');
      const hasStore = headers.includes('store') || headers.includes('store_name');
      
      if (!hasRingId || !hasStore) {
        alert("⚠️ CSV must include 'ring_id' (or 'Ring_ID') and 'store' (or 'STORE_NAME') columns in the header row");
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

        if (!row.ring_id || !row.store) {
          console.warn(`Skipping row ${i + 1}: missing ring_id or store`);
          continue;
        }

        const deliveryDays = row.delivery_days ? 
          row.delivery_days.split(/[;,]/).map(d => d.trim()).filter(d => d) : [];
        
        const timeSlots = row.time_slots ? 
          row.time_slots.split(/[;,]/).map(t => t.trim()).filter(t => t) : [];
        
        const zipcodes = row.zipcodes ? 
          row.zipcodes.split(/[;,]/).map(z => z.trim()).filter(z => z) : [];
        
        const deliveryTimeDays = row.region_name?.includes('2D') ? 2 : 1;

        // Map store to state abbreviation
        const storeToState = {
          'New York': 'NY',
          'Los Angeles': 'CA',
          'Chicago': 'IL',
          'Houston': 'TX',
          'Miami': 'FL',
          'Boston': 'MA',
          'Seattle': 'WA',
          'Denver': 'CO',
          'Atlanta': 'GA',
          'Phoenix': 'AZ',
          'San Francisco': 'CA',
          'Philadelphia': 'PA',
          'Dallas': 'TX',
          'San Diego': 'CA',
          'San Jose': 'CA'
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
      alert(`✅ Successfully imported ${ringData.length} ring(s)`);
    } catch (error) {
      alert(`❌ Error importing rings: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const { data: rings = [], isLoading } = useQuery({
    queryKey: ["rings"],
    queryFn: () => Ring.list("-created_date", 500)
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => WeatherAlert.filter({ is_active: true })
  });

  const importFromCSV = async () => {
    await processCSVImport(csvData);
  };

  const exportToCSV = () => {
    const headers = ["ring_id", "store", "facility_center", "region_name", "delivery_days", "time_slots", "zipcodes", "delivery_time_days", "latitude", "longitude"];
    const rows = rings.map(r => [
      r.ring_id,
      r.store,
      r.facility_center,
      r.region_name,
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
  };

  const sampleCSV = `ring_id,store,facility_center,region_name,delivery_days,time_slots,zipcodes,latitude,longitude
NYC-R1,New York,New York Kitchen,Manhattan-1D,Monday;Wednesday;Friday,8-10am;10-12pm;12-2pm,10001;10002;10003,40.7128,-74.0060
NYC-R2,New York,Washington DC Hub,Brooklyn-2D,Tuesday;Thursday,10-12pm;2-4pm,11201;11205;11206,40.6782,-73.9442
LA-R1,Los Angeles,LA Kitchen,Downtown-1D,Monday;Wednesday,8-10am;12-2pm,90012;90013;90014,34.0522,-118.2437`;

  // Calculate unique ring IDs
  const uniqueRingIds = new Set(rings.map(r => r.ring_id));
  const uniqueRings = Array.from(uniqueRingIds).map(ringId => 
    rings.find(r => r.ring_id === ringId)
  );

  // Check which rings have alerts affecting upcoming deliveries
  const getRingSeverity = (ring) => {
    if (!ring.delivery_days || ring.delivery_days.length === 0) {
      return { alertCount: 0, hasSevere: false, affectedDeliveries: 0 };
    }

    // Get upcoming delivery dates for next 14 days
    const today = new Date();
    const upcomingDeliveries = [];
    
    for (let i = 0; i < 14; i++) {
      const date = addDays(today, i);
      const dayName = format(date, 'EEEE');
      if (ring.delivery_days.includes(dayName)) {
        upcomingDeliveries.push(date);
      }
    }

    // Find alerts that affect this ring AND overlap with delivery days
    let affectedDeliveryCount = 0;
    const impactingAlerts = new Set();
    
    upcomingDeliveries.forEach(deliveryDate => {
      const dayStart = startOfDay(deliveryDate);
      const dayEnd = endOfDay(deliveryDate);
      
      alerts.forEach(alert => {
        if (!alert.is_active) return;
        
        // Check geographic match
        const affectsRing = alert.affected_states?.includes(ring.state) || 
                           alert.affected_zones?.some(zone => ring.zones?.includes(zone));
        
        if (!affectsRing) return;
        
        // Check temporal overlap
        const alertStart = alert.start_time ? parseISO(alert.start_time) : null;
        const alertEnd = alert.end_time ? parseISO(alert.end_time) : null;
        
        if (alertStart && alertEnd) {
          if (isBefore(alertStart, dayEnd) && isAfter(alertEnd, dayStart)) {
            impactingAlerts.add(alert.id);
            affectedDeliveryCount++;
          }
        }
      });
    });

    const ringAlerts = Array.from(impactingAlerts).map(id => 
      alerts.find(a => a.id === id)
    );
    
    const hasSevere = ringAlerts.some(a => a.severity === 'severe' || a.severity === 'extreme');
    
    return { 
      alertCount: ringAlerts.length, 
      hasSevere,
      affectedDeliveries: affectedDeliveryCount
    };
  };

  // Group rings by store
  const ringsByStore = uniqueRings.reduce((acc, ring) => {
    if (!acc[ring.store]) acc[ring.store] = [];
    acc[ring.store].push(ring);
    return acc;
  }, {});

  // Detect duplicates
  const duplicateRingIds = rings.reduce((acc, ring) => {
    const count = rings.filter(r => r.ring_id === ring.ring_id).length;
    if (count > 1 && !acc.includes(ring.ring_id)) {
      acc.push(ring.ring_id);
    }
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <MapPin className="w-8 h-8 text-purple-600" />
            Ring Management
          </h1>
          <p className="text-slate-500 mt-1">
            Manage delivery rings, zones, and facility assignments
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-slate-500 mb-1">Unique Ring IDs</p>
              <p className="text-3xl font-bold text-slate-900">{uniqueRingIds.size}</p>
              <p className="text-xs text-slate-400 mt-1">({rings.length} total records)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-slate-500 mb-1">Active Stores</p>
              <p className="text-3xl font-bold text-slate-900">{Object.keys(ringsByStore).length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-slate-500 mb-1">1-Day Delivery</p>
              <p className="text-3xl font-bold text-slate-900">
                {uniqueRings.filter(r => r.delivery_time_days === 1).length}
              </p>
            </CardContent>
          </Card>
          <Card className={duplicateRingIds.length > 0 ? "border-amber-300 bg-amber-50" : ""}>
            <CardContent className="p-6">
              <p className="text-sm text-slate-500 mb-1">Duplicates</p>
              <p className="text-3xl font-bold text-amber-600">{duplicateRingIds.length}</p>
              {duplicateRingIds.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">Ring IDs with duplicates</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Import/Export */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Import/Export Rings
            </CardTitle>
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
                      alert(`✅ Successfully imported ${response.data.imported} rings (deleted ${response.data.deleted} old records)`);
                      queryClient.invalidateQueries({ queryKey: ["rings"] });
                    } else {
                      alert(`❌ Import failed: ${response.data.error}`);
                    }
                  } catch (error) {
                    alert(`❌ Error: ${error.message}`);
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
                Paste CSV Data (from Google Sheets)
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
                onClick={importFromCSV}
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

        {/* Map Visualization */}
        <div className="mb-8">
          <RingMapVisualization rings={rings} alerts={alerts} />
        </div>

        {/* Rings by Store */}
        <div className="space-y-6">
          {Object.entries(ringsByStore).map(([store, storeRings]) => (
            <Card key={store}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-purple-600" />
                  {store}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {storeRings.map((ring) => {
                    const severity = getRingSeverity(ring);
                    return (
                      <motion.div
                        key={ring.id}
                        whileHover={{ scale: 1.01 }}
                        className={`border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
                          severity.hasSevere 
                            ? 'border-red-400 bg-red-50 hover:border-red-500' 
                            : severity.alertCount > 0 
                            ? 'border-yellow-300 bg-yellow-50 hover:border-yellow-400'
                            : 'border-slate-200 bg-white hover:border-purple-400'
                        }`}
                        onClick={() => setSelectedRing(ring)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-lg text-slate-900">
                                Ring {ring.ring_id}
                              </p>
                              {severity.alertCount > 0 && (
                                <Badge className={severity.hasSevere ? 'bg-red-600' : 'bg-yellow-600'}>
                                  {severity.alertCount} Alert{severity.alertCount > 1 ? 's' : ''}
                                </Badge>
                              )}
                              {severity.affectedDeliveries > 0 && (
                                <Badge variant="outline" className={severity.hasSevere ? 'border-red-600 text-red-700' : 'border-yellow-600 text-yellow-700'}>
                                  {severity.affectedDeliveries} Delivery{severity.affectedDeliveries > 1 ? ' Days' : ' Day'} Impacted
                                </Badge>
                              )}
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm text-slate-600">
                                {ring.facility_center || 'No facility'} · {ring.region_name || 'No region'}
                              </p>
                              <p className="text-sm text-slate-600">
                                📅 {ring.delivery_days?.join(', ') || 'No delivery days'}
                              </p>
                              {ring.zipcodes && ring.zipcodes.length > 0 && (
                                <p className="text-xs text-slate-500">
                                  {ring.zipcodes.length} zipcodes · {ring.state || 'State N/A'}
                                </p>
                              )}
                            </div>
                          </div>
                          <MapPin className={`w-5 h-5 ${severity.hasSevere ? 'text-red-600' : 'text-slate-400'}`} />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Ring Detail Sheet */}
        <RingDetailSheet 
          ring={selectedRing}
          alerts={alerts}
          open={!!selectedRing}
          onOpenChange={(open) => !open && setSelectedRing(null)}
        />
      </div>
    </div>
  );
}