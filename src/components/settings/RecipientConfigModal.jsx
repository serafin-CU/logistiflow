import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Store, Save } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

export default function RecipientConfigModal({ recipient, open, onOpenChange, onSave }) {
  const [config, setConfig] = useState({
    severity_levels: [],
    stores: []
  });

  const { data: rings = [] } = useQuery({
    queryKey: ["rings"],
    queryFn: () => base44.entities.Ring.list("-created_date", 500)
  });

  const uniqueStores = [...new Set(rings.map(r => r.store))].filter(Boolean);

  useEffect(() => {
    if (recipient) {
      setConfig({
        severity_levels: recipient.severity_levels || ["severe", "extreme"],
        stores: recipient.stores || []
      });
    }
  }, [recipient]);

  const handleSave = () => {
    onSave({
      ...recipient,
      severity_levels: config.severity_levels,
      stores: config.stores
    });
  };

  const severityLevels = [
    { value: "minor", label: "Minor", color: "bg-blue-100 text-blue-800" },
    { value: "moderate", label: "Moderate", color: "bg-yellow-100 text-yellow-800" },
    { value: "severe", label: "Severe", color: "bg-orange-100 text-orange-800" },
    { value: "extreme", label: "Extreme", color: "bg-red-100 text-red-800" }
  ];

  const toggleSeverity = (level) => {
    setConfig(prev => ({
      ...prev,
      severity_levels: prev.severity_levels.includes(level)
        ? prev.severity_levels.filter(s => s !== level)
        : [...prev.severity_levels, level]
    }));
  };

  const toggleStore = (store) => {
    setConfig(prev => ({
      ...prev,
      stores: prev.stores.includes(store)
        ? prev.stores.filter(s => s !== store)
        : [...prev.stores, store]
    }));
  };

  const toggleAllStores = () => {
    setConfig(prev => ({
      ...prev,
      stores: prev.stores.length === uniqueStores.length ? [] : [...uniqueStores]
    }));
  };

  if (!recipient) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Configure Notifications for {recipient.email}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Severity Levels */}
          <div>
            <Label className="text-base flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              Alert Severity Levels
            </Label>
            <p className="text-sm text-slate-500 mb-3">
              Select which severity levels should trigger notifications
            </p>
            <div className="grid grid-cols-2 gap-3">
              {severityLevels.map(level => (
                <Card
                  key={level.value}
                  className={`p-4 cursor-pointer border-2 transition-all ${
                    config.severity_levels.includes(level.value)
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  onClick={() => toggleSeverity(level.value)}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={config.severity_levels.includes(level.value)}
                      onCheckedChange={() => toggleSeverity(level.value)}
                    />
                    <Badge className={level.color}>{level.label}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Stores */}
          <div>
            <Label className="text-base flex items-center gap-2 mb-3">
              <Store className="w-4 h-4 text-purple-600" />
              Stores
            </Label>
            <p className="text-sm text-slate-500 mb-3">
              Select specific stores (leave empty for all stores)
            </p>
            
            <div className="mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAllStores}
              >
                {config.stores.length === uniqueStores.length ? "Deselect All" : "Select All"}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {uniqueStores.map(store => (
                <Card
                  key={store}
                  className={`p-3 cursor-pointer border transition-all ${
                    config.stores.includes(store)
                      ? "border-purple-500 bg-purple-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                  onClick={() => toggleStore(store)}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={config.stores.includes(store)}
                      onCheckedChange={() => toggleStore(store)}
                    />
                    <span className="text-sm font-medium">{store}</span>
                  </div>
                </Card>
              ))}
            </div>
            {config.stores.length === 0 && (
              <p className="text-sm text-slate-500 mt-2 italic">
                No stores selected - will receive alerts for all stores
              </p>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Save className="w-4 h-4" />
              Save Configuration
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}