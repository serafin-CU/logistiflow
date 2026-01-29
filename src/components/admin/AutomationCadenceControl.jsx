import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AutomationCadenceControl() {
  const [interval, setInterval] = useState("60");
  const [unit, setUnit] = useState("minutes");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadCurrentSetting();
  }, []);

  const loadCurrentSetting = async () => {
    try {
      const settings = await base44.entities.AutomationSetting.filter({
        automation_name: "Fetch Weather Alerts"
      });
      
      if (settings.length > 0) {
        setInterval(settings[0].repeat_interval.toString());
        setUnit(settings[0].repeat_unit);
      }
    } catch (error) {
      console.error("Error loading automation setting:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await base44.functions.invoke("updateAutomationCadence", {
        automation_name: "Fetch Weather Alerts",
        repeat_interval: parseInt(interval),
        repeat_unit: unit
      });

      if (response.data.success) {
        toast.success(response.data.message);
      } else {
        toast.error(response.data.error || "Failed to update cadence");
      }
    } catch (error) {
      toast.error(error.message || "Failed to update automation cadence");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  const intervalOptions = unit === "minutes" 
    ? [
        { value: "5", label: "5 minutes" },
        { value: "15", label: "15 minutes" },
        { value: "30", label: "30 minutes" },
        { value: "60", label: "60 minutes" }
      ]
    : unit === "hours"
    ? [
        { value: "1", label: "1 hour" },
        { value: "2", label: "2 hours" },
        { value: "4", label: "4 hours" },
        { value: "6", label: "6 hours" },
        { value: "12", label: "12 hours" }
      ]
    : [
        { value: "1", label: "1 day" },
        { value: "2", label: "2 days" },
        { value: "7", label: "7 days" }
      ];

  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
      <div>
        <p className="font-medium text-slate-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          Weather Alert Sync Cadence
        </p>
        <p className="text-sm text-slate-500">
          How often to fetch weather alerts from NWS
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Select value={unit} onValueChange={(value) => {
          setUnit(value);
          // Reset interval to safe default when changing units
          if (value === "minutes") setInterval("60");
          else if (value === "hours") setInterval("1");
          else setInterval("1");
        }}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minutes">Minutes</SelectItem>
            <SelectItem value="hours">Hours</SelectItem>
            <SelectItem value="days">Days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={interval} onValueChange={setInterval}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {intervalOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}