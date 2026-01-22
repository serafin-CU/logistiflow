import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Upload, MapPin, Store, Clock, Calendar, Download, Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const Ring = base44.entities.Ring;

export default function RingManagement() {
  const queryClient = useQueryClient();
  const [csvData, setCsvData] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setCsvData(text);
      }
    };
    reader.readAsText(file);
  };

  const { data: rings = [], isLoading } = useQuery({
    queryKey: ["rings"],
    queryFn: () => Ring.list("-created_date", 500)
  });

  const importFromCSV = async () => {
    setIsUploading(true);
    try {
      const lines = csvData.trim().split("\n").filter(line => line.trim());
      
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
        if (!line) continue; // Skip empty lines
        
        const values = line.split(",").map(v => v.trim());
        
        const row = {};
        headers.forEach((h, idx) => {
          // Map store_name to store for consistency
          const fieldName = h === 'store_name' ? 'store' : h;
          row[fieldName] = values[idx] || "";
        });

        // Validate required fields
        if (!row.ring_id || !row.store) {
          console.warn(`Skipping row ${i + 1}: missing ring_id or store`);
          continue;
        }

        // Parse delivery days - handle single day or semicolon-separated
        const deliveryDays = row.delivery_days ? 
          row.delivery_days.split(/[;,]/).map(d => d.trim()).filter(d => d) : [];
        
        // Parse time slots - handle single slot or semicolon-separated  
        const timeSlots = row.time_slots ? 
          row.time_slots.split(/[;,]/).map(t => t.trim()).filter(t => t) : [];
        
        // Parse zipcodes - handle single code or semicolon-separated
        const zipcodes = row.zipcodes ? 
          row.zipcodes.split(/[;,]/).map(z => z.trim()).filter(z => z) : [];
        
        // Determine delivery time from region name
        const deliveryTimeDays = row.region_name?.includes('2D') ? 2 : 1;

        ringData.push({
          ring_id: row.ring_id,
          store: row.store,
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

  // Group rings by store
  const ringsByStore = rings.reduce((acc, ring) => {
    if (!acc[ring.store]) acc[ring.store] = [];
    acc[ring.store].push(ring);
    return acc;
  }, {});

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
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-slate-500 mb-1">Total Rings</p>
              <p className="text-3xl font-bold text-slate-900">{rings.length}</p>
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
                {rings.filter(r => r.delivery_time_days === 1).length}
              </p>
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

        {/* Rings by Store */}
        <div className="space-y-6">
          {Object.entries(ringsByStore).map(([store, storeRings]) => (
            <Card key={store}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-purple-600" />
                  {store} - {storeRings.length} Rings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {storeRings.map((ring) => (
                    <div
                      key={ring.id}
                      className="border border-slate-200 rounded-lg p-4 hover:border-purple-300 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-slate-900">{ring.ring_id}</p>
                          <p className="text-sm text-slate-600">{ring.region_name || 'No region'}</p>
                        </div>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {ring.delivery_time_days}D Delivery
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <p className="text-slate-500 mb-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            Facility
                          </p>
                          <p className="text-slate-700">{ring.facility_center || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Delivery Days
                          </p>
                          <p className="text-slate-700">{ring.delivery_days?.join(', ') || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-1">Time Slots</p>
                          <p className="text-slate-700">{ring.time_slots?.length || 0} slots</p>
                        </div>
                        <div>
                          <p className="text-slate-500 mb-1">Zipcodes</p>
                          <p className="text-slate-700">{ring.zipcodes?.length || 0} codes</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}