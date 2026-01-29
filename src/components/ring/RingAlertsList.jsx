import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info, AlertOctagon } from "lucide-react";
import { format, parseISO } from "date-fns";

const severityConfig = {
  extreme: { 
    icon: AlertOctagon, 
    color: "text-red-600", 
    bgColor: "bg-red-50", 
    borderColor: "border-red-300",
    badgeClass: "bg-red-600 text-white"
  },
  severe: { 
    icon: AlertTriangle, 
    color: "text-orange-600", 
    bgColor: "bg-orange-50", 
    borderColor: "border-orange-300",
    badgeClass: "bg-orange-600 text-white"
  },
  moderate: { 
    icon: AlertCircle, 
    color: "text-yellow-600", 
    bgColor: "bg-yellow-50", 
    borderColor: "border-yellow-300",
    badgeClass: "bg-yellow-600 text-white"
  },
  minor: { 
    icon: Info, 
    color: "text-blue-600", 
    bgColor: "bg-blue-50", 
    borderColor: "border-blue-300",
    badgeClass: "bg-blue-600 text-white"
  }
};

export default function RingAlertsList({ ring, alerts }) {
  if (!ring || !alerts) return null;
  
  // Filter alerts that affect this ring
  const relevantAlerts = alerts.filter(alert =>
    alert.is_active && (
      alert.affected_zones?.some(zone => ring.zones?.includes(zone)) ||
      alert.affected_states?.includes(ring.state)
    )
  );

  if (relevantAlerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-green-600" />
            Weather Alerts for Ring {ring.ring_id}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-500">
            <p className="font-medium">✓ No active alerts</p>
            <p className="text-sm mt-1">This ring is clear of weather warnings</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          Weather Alerts for Ring {ring.ring_id}
          <Badge variant="destructive" className="ml-auto">
            {relevantAlerts.length} Active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {relevantAlerts.map((alert) => {
            const config = severityConfig[alert.severity] || severityConfig.minor;
            const Icon = config.icon;
            
            return (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${config.borderColor} ${config.bgColor}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 mt-0.5 ${config.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-slate-900">{alert.event}</h4>
                      <Badge className={config.badgeClass}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                    </div>
                    
                    {alert.headline && (
                      <p className="text-sm text-slate-700 mb-2">{alert.headline}</p>
                    )}
                    
                    {alert.description && (
                      <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                        {alert.description}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      {alert.start_time && (
                        <span>
                          <strong>Start:</strong> {format(parseISO(alert.start_time), 'MMM d, h:mm a')}
                        </span>
                      )}
                      {alert.end_time && (
                        <span>
                          <strong>Until:</strong> {format(parseISO(alert.end_time), 'MMM d, h:mm a')}
                        </span>
                      )}
                    </div>
                    
                    {alert.affected_zones && alert.affected_zones.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-slate-500">
                          <strong>Affected Zones:</strong> {
                            ring.zones?.filter(z => alert.affected_zones.includes(z)).join(', ') || 
                            alert.affected_zones.slice(0, 3).join(', ')
                          }
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}