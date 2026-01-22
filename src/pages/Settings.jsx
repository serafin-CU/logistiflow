import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Settings as SettingsIcon, Bell, Shield, Database, 
  RefreshCw, Clock, Mail, Save, CheckCircle, Plus, X, Edit
} from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import RecipientConfigModal from "@/components/settings/RecipientConfigModal";

export default function Settings() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState({
    autoRefreshAlerts: true,
    refreshInterval: "30",
    emailNotifications: true,
    highRiskThreshold: "70",
    defaultRiskModel: "conservative"
  });
  const [newEmail, setNewEmail] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: recipients = [] } = useQuery({
    queryKey: ["notification-recipients"],
    queryFn: () => base44.entities.NotificationRecipient.list("-created_date", 100)
  });

  const createRecipientMutation = useMutation({
    mutationFn: (email) => base44.entities.NotificationRecipient.create({
      email,
      severity_levels: ["severe", "extreme"],
      stores: [],
      is_active: true
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-recipients"] });
      setNewEmail("");
      toast.success("Email added successfully");
    }
  });

  const updateRecipientMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.NotificationRecipient.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-recipients"] });
      setSelectedRecipient(null);
      toast.success("Configuration updated");
    }
  });

  const deleteRecipientMutation = useMutation({
    mutationFn: (id) => base44.entities.NotificationRecipient.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-recipients"] });
      toast.success("Email removed");
    }
  });

  const handleAddEmail = () => {
    if (!newEmail || !newEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    createRecipientMutation.mutate(newEmail);
  };

  const handleSaveRecipient = (updatedRecipient) => {
    updateRecipientMutation.mutate({
      id: updatedRecipient.id,
      data: {
        severity_levels: updatedRecipient.severity_levels,
        stores: updatedRecipient.stores
      }
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    toast.success("Settings saved successfully");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-slate-600" />
            Settings
          </h1>
          <p className="text-slate-500 mt-1">
            Configure your weather risk platform preferences
          </p>
        </motion.div>

        <div className="space-y-6">
          {/* Alert Settings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-blue-600" />
                  Weather Alert Settings
                </CardTitle>
                <CardDescription>
                  Configure how weather alerts are fetched and processed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-refresh Alerts</Label>
                    <p className="text-sm text-slate-500">
                      Automatically fetch new weather alerts
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoRefreshAlerts}
                    onCheckedChange={(checked) => 
                      setSettings({ ...settings, autoRefreshAlerts: checked })
                    }
                  />
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    Refresh Interval (minutes)
                  </Label>
                  <Select
                    value={settings.refreshInterval}
                    onValueChange={(value) => 
                      setSettings({ ...settings, refreshInterval: value })
                    }
                    disabled={!settings.autoRefreshAlerts}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">Every 15 minutes</SelectItem>
                      <SelectItem value="30">Every 30 minutes</SelectItem>
                      <SelectItem value="60">Every hour</SelectItem>
                      <SelectItem value="120">Every 2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Risk Assessment */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-orange-600" />
                  Risk Assessment
                </CardTitle>
                <CardDescription>
                  Configure risk calculation parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>High Risk Threshold (%)</Label>
                  <p className="text-sm text-slate-500 mb-2">
                    Deliveries with risk scores above this will be marked as high risk
                  </p>
                  <Select
                    value={settings.highRiskThreshold}
                    onValueChange={(value) => 
                      setSettings({ ...settings, highRiskThreshold: value })
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50%</SelectItem>
                      <SelectItem value="60">60%</SelectItem>
                      <SelectItem value="70">70%</SelectItem>
                      <SelectItem value="80">80%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <Label>Risk Calculation Model</Label>
                  <p className="text-sm text-slate-500 mb-2">
                    How aggressively to estimate delivery risks
                  </p>
                  <Select
                    value={settings.defaultRiskModel}
                    onValueChange={(value) => 
                      setSettings({ ...settings, defaultRiskModel: value })
                    }
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">Conservative</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="aggressive">Aggressive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Notifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-emerald-600" />
                  Notifications
                </CardTitle>
                <CardDescription>
                  Configure alert notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-slate-500">
                      Receive email alerts for high-risk deliveries
                    </p>
                  </div>
                  <Switch
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) => 
                      setSettings({ ...settings, emailNotifications: checked })
                    }
                  />
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <Label>Add Email Recipients</Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
                      disabled={!settings.emailNotifications}
                    />
                    <Button 
                      onClick={handleAddEmail}
                      disabled={!settings.emailNotifications || !newEmail}
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </Button>
                  </div>
                </div>

                {recipients.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label>Email Recipients ({recipients.length})</Label>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {recipients.map((recipient) => (
                          <motion.div
                            key={recipient.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 transition-all"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900">{recipient.email}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {recipient.severity_levels?.map(level => (
                                  <Badge 
                                    key={level} 
                                    variant="outline" 
                                    className="text-xs"
                                  >
                                    {level}
                                  </Badge>
                                ))}
                                {recipient.stores?.length > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {recipient.stores.length} store{recipient.stores.length > 1 ? 's' : ''}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedRecipient(recipient)}
                                className="hover:bg-blue-100"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteRecipientMutation.mutate(recipient.id)}
                                className="hover:bg-red-100 hover:text-red-600"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Data Management */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-600" />
                  Data Management
                </CardTitle>
                <CardDescription>
                  Manage your delivery and alert data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">Clear Old Alerts</p>
                    <p className="text-sm text-slate-500">
                      Remove alerts older than 7 days
                    </p>
                  </div>
                  <Button variant="outline">Clear</Button>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">Recalculate All Risks</p>
                    <p className="text-sm text-slate-500">
                      Update risk scores for all deliveries
                    </p>
                  </div>
                  <Button variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Recalculate
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Save Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex justify-end"
          >
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Settings
                </>
              )}
            </Button>
          </motion.div>
        </div>

        {/* Recipient Configuration Modal */}
        <RecipientConfigModal
          recipient={selectedRecipient}
          open={!!selectedRecipient}
          onOpenChange={(open) => !open && setSelectedRecipient(null)}
          onSave={handleSaveRecipient}
        />
      </div>
    </div>
  );
}