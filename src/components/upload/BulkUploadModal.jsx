import { useState } from "react";
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

  const parseCSV = () => {
    setError("");
    const lines = csvData.trim().split("\n");
    if (lines.length < 2) {
      setError("CSV must have at least a header row and one data row");
      return;
    }

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    const requiredHeaders = ["order_id", "zipcode", "delivery_date"];
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
        if (h === 'order_id') {
          row['tracking_id'] = values[idx];
        } else {
          row[h] = values[idx];
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

  const sampleCSV = `order_id,zipcode,city,state,delivery_date
DEL-001,10001,New York,NY,2024-02-15
DEL-002,90210,Beverly Hills,CA,2024-02-16
DEL-003,60601,Chicago,IL,2024-02-17`;

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
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Paste CSV Data
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
              Required columns: order_id, zipcode, delivery_date. Optional: city, state, notes
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
                        <TableHead className="text-xs">Order ID</TableHead>
                        <TableHead className="text-xs">Ring ID</TableHead>
                        <TableHead className="text-xs">City</TableHead>
                        <TableHead className="text-xs">State</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.slice(0, 10).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm font-medium">{row.tracking_id}</TableCell>
                          <TableCell className="text-sm">{row.zipcode}</TableCell>
                          <TableCell className="text-sm">{row.city || "—"}</TableCell>
                          <TableCell className="text-sm">{row.state || "—"}</TableCell>
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