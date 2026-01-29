import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function SheetImportButton({ onSuccess }) {
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const response = await base44.functions.invoke('importDeliveriesFromSheet', {});
      
      if (response.data.success) {
        toast.success(
          `Import Complete`, 
          {
            description: `Created: ${response.data.created}, Updated: ${response.data.updated}`,
            icon: <CheckCircle2 className="w-4 h-4" />
          }
        );
        if (onSuccess) onSuccess();
      } else {
        toast.error('Import failed', {
          description: response.data.error || 'Unknown error',
          icon: <AlertCircle className="w-4 h-4" />
        });
      }
    } catch (error) {
      toast.error('Import failed', {
        description: error.message,
        icon: <AlertCircle className="w-4 h-4" />
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Button
      onClick={handleImport}
      disabled={isImporting}
      variant="outline"
      className="gap-2"
    >
      {isImporting ? (
        <RefreshCw className="w-4 h-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="w-4 h-4" />
      )}
      {isImporting ? 'Importing...' : 'Import from Sheet'}
    </Button>
  );
}