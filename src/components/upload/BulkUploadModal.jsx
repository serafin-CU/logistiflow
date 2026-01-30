import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function BulkUploadModal({ open, onOpenChange, onSubmit, isLoading }) {
  const [csvData, setCsvData] = useState("");
  const [parsedData, setParsedData] = useState([]);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const parseCSV = () => {
    setError("");
    const lines = csvData.trim().split("\n");
    if (lines.length < 2) {
      setError("CSV must have at least a header row and one data row");
      return;
    }

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const requiredHeaders = ["order_id", "delivery_date"];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      setError(`Missing required columns: ${missingHeaders.join(", ")}`);
      return;
    }

    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      if (values.length !== headers.length) continue;
      
      const row = {};
      headers.forEach((h, idx) => {
        const value = values[idx];
        if (h === 'order_id') {
          row['order_id'] = value;
          row['tracking_id'] = value;
        } else if (h === 'is_active' || h === 'is_active_subscription') {
          row[h] = value.toLowerCase() === 'true';
        } else {
          row[h] = value;
        }
      });
      data.push(row);
    }

    if (data.length === 0) {
      setError("No valid data rows found");
      return;
    }

    setParsedData(data);
  };

  const handleSubmit = () => {
    onSubmit(parsedData);
  };

  const handleFileUpload = (file) => {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setError("Please upload a CSV file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      setCsvData(text);
      setParsedData([]);
      setError("");
    };
    reader.readAsText(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    handleFileUpload(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFileUpload(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const sampleCSV = `customer_id,current_region_id,store_market,store_name,is_active,is_active_subscription,order_id,delivery_date,expected_delivery_date
CUST001,NYC-R1,New York,Manhattan Store,TRUE,TRUE,ORD-12345,2026-01-30,2026-02-01
CUST002,LA-R2,Los Angeles,Beverly Hills,TRUE,FALSE,ORD-12346,2026-01-31,2026-02-02
CUST003,CHI-R1,Chicago,Downtown,TRUE,TRUE,ORD-12347,2026-02-01,2026-02-03`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            Bulk Upload Deliveries
          </DialogTitle>
          <DialogDescription>
            Upload multiple deliveries using CSV format
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInput}
            accept=".csv"
            className="hidden"
          />
          
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-blue-500 bg-blue-50"
                : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50"
            }`}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? "text-blue-600" : "text-slate-400"}`} />
            <p className="text-sm font-medium text-slate-700 mb-1">
              Drop CSV file here or click to browse
            </p>
            <p className="text-xs text-slate-500">
              Supports CSV files with delivery data
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Or Paste CSV Data
            </label>
            <Textarea
              value={csvData}
              onChange={(e) => {
                setCsvData(e.target.value);
                setParsedData([]);
                setError("");
              }}
              placeholder={sampleCSV}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-slate-500">
              Required: order_id, delivery_date. Optional: customer_id, current_region_id, store_market, store_name, is_active, is_active_subscription, expected_delivery_date
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={parseCSV}
              disabled={!csvData.trim()}
            >
              Preview Data
            </Button>
            <Button 
              variant="outline"
              onClick={() => setCsvData(sampleCSV)}
            >
              Load Sample
            </Button>
          </div>

          <AnimatePresence>
            {parsedData.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle className="w-4 h-4" />
                  {parsedData.length} deliveries ready to upload
                </div>

                <div className="max-h-60 overflow-y-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">Customer ID</TableHead>
                        <TableHead className="text-xs">Region ID</TableHead>
                        <TableHead className="text-xs">Store Market</TableHead>
                        <TableHead className="text-xs">Order ID</TableHead>
                        <TableHead className="text-xs">Delivery Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.slice(0, 10).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{row.customer_id || "—"}</TableCell>
                          <TableCell className="text-sm">{row.current_region_id || "—"}</TableCell>
                          <TableCell className="text-sm">{row.store_market || "—"}</TableCell>
                          <TableCell className="text-sm font-medium">{row.order_id}</TableCell>
                          <TableCell className="text-sm">{row.delivery_date}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {parsedData.length > 10 && (
                    <p className="text-xs text-center text-slate-500 py-2">
                      And {parsedData.length - 10} more...
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={parsedData.length === 0 || isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload {parsedData.length} Deliveries
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}