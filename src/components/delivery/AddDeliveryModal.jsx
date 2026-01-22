import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Package, MapPin, Calendar } from "lucide-react";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

export default function AddDeliveryModal({ open, onOpenChange, onSubmit, isLoading }) {
  const [form, setForm] = useState({
    tracking_id: "",
    zipcode: "",
    city: "",
    state: "",
    delivery_date: "",
    notes: ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const generateTrackingId = () => {
    const prefix = "DEL";
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    setForm({ ...form, tracking_id: `${prefix}-${timestamp}-${random}` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package className="w-5 h-5 text-blue-600" />
            Add New Delivery
          </DialogTitle>
          <DialogDescription>
            Enter delivery details to forecast weather-related risks
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="space-y-2">
            <Label htmlFor="tracking_id">Tracking ID</Label>
            <div className="flex gap-2">
              <Input
                id="tracking_id"
                value={form.tracking_id}
                onChange={(e) => setForm({ ...form, tracking_id: e.target.value })}
                placeholder="DEL-XXXXX-XXXX"
                className="flex-1"
                required
              />
              <Button type="button" variant="outline" onClick={generateTrackingId}>
                Generate
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="New York"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Select
                value={form.state}
                onValueChange={(value) => setForm({ ...form, state: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="zipcode" className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                Zipcode
              </Label>
              <Input
                id="zipcode"
                value={form.zipcode}
                onChange={(e) => setForm({ ...form, zipcode: e.target.value })}
                placeholder="10001"
                pattern="[0-9]{5}"
                maxLength={5}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery_date" className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Delivery Date
              </Label>
              <Input
                id="delivery_date"
                type="date"
                value={form.delivery_date}
                onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
                min={new Date().toISOString().split("T")[0]}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any special instructions or notes..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing Risk...
                </>
              ) : (
                "Add & Analyze"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}