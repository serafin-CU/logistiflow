import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function GoogleSheetImportModal({ open, onOpenChange, onSuccess }) {
  const [sheetUrl, setSheetUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleImport = async () => {
    setError("");
    setSuccess("");
    setIsImporting(true);

    try {
      const response = await base44.functions.invoke("importDeliveriesFromSheet", {
        spreadsheetUrl: sheetUrl
      });

      if (response.data.success) {
        setSuccess(`Successfully imported ${response.data.imported} deliveries`);
        setTimeout(() => {
          onSuccess();
          onOpenChange(false);
          setSheetUrl("");
          setSuccess("");
        }, 2000);
      } else {
        setError(response.data.error || "Import failed");
      }
    } catch (err) {
      setError(err.message || "Failed to import from Google Sheet");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            Import from Google Sheets
          </DialogTitle>
          <DialogDescription>
            Paste the URL of your Google Sheet to import delivery data
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Google Sheet URL</Label>
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              Make sure the sheet is publicly accessible or shared with the app
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {success}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!sheetUrl.trim() || isImporting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import Data"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}