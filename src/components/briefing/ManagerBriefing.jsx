import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  AlertTriangle, TrendingUp, Clock, MapPin, CheckCircle, 
  XCircle, PauseCircle, Navigation, FileText, Download,
  ThumbsUp, ThumbsDown, Calendar
} from "lucide-react";
import { format, addDays, isAfter, isBefore, parseISO } from "date-fns";
import RiskBadge from "../dashboard/RiskBadge";
import DetailedReportModal from "./DetailedReportModal";

const RecommendationCard = ({ recommendation, index, onClick }) => {
  const actionIcons = {
    proceed: CheckCircle,
    delay: PauseCircle,
    reroute: Navigation,
    cancel: XCircle
  };

  const actionColors = {
    proceed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    delay: "bg-amber-100 text-amber-700 border-amber-200",
    reroute: "bg-blue-100 text-blue-700 border-blue-200",
    cancel: "bg-red-100 text-red-700 border-red-200"
  };

  const Icon = actionIcons[recommendation.action] || AlertTriangle;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className="border border-slate-200 rounded-xl p-4 hover:border-slate-400 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${actionColors[recommendation.action]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-slate-900">{recommendation.title}</h4>
            <Badge className={actionColors[recommendation.action]}>
              {recommendation.action.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm text-slate-600 mb-3">{recommendation.reason}</p>
          
          <div className="space-y-2">
            {recommendation.deliveries && (
              <div className="text-xs text-slate-500">
                <span className="font-medium">Affected:</span> {recommendation.deliveries.length} deliveries
              </div>
            )}
            {recommendation.alternative && (
              <div className="text-xs text-slate-700 bg-blue-50 border border-blue-200 rounded-lg p-2">
                <span className="font-medium">💡 Alternative:</span> {recommendation.alternative}
              </div>
            )}
            {recommendation.estimated_delay && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Clock className="w-3 h-3" />
                Estimated delay: {recommendation.estimated_delay}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const ImpactSummary = ({ deliveries, alerts }) => {
  const totalDeliveries = deliveries.length;
  const criticalRisk = deliveries.filter(d => d.risk_level === "critical").length;
  const highRisk = deliveries.filter(d => d.risk_level === "high").length;
  const atRisk = criticalRisk + highRisk;
  const safeToShip = totalDeliveries - atRisk;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl p-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Orders</p>
        <p className="text-2xl font-bold text-slate-900">{totalDeliveries}</p>
      </div>
      <div className="bg-gradient-to-br from-red-50 to-white border border-red-200 rounded-xl p-4">
        <p className="text-xs text-red-600 uppercase tracking-wide mb-1">High Risk</p>
        <p className="text-2xl font-bold text-red-700">{atRisk}</p>
        <p className="text-xs text-red-600 mt-1">{((atRisk/totalDeliveries)*100).toFixed(0)}% of total</p>
      </div>
      <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-xl p-4">
        <p className="text-xs text-emerald-600 uppercase tracking-wide mb-1">Safe to Ship</p>
        <p className="text-2xl font-bold text-emerald-700">{safeToShip}</p>
        <p className="text-xs text-emerald-600 mt-1">{((safeToShip/totalDeliveries)*100).toFixed(0)}% of total</p>
      </div>
      <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-xl p-4">
        <p className="text-xs text-amber-600 uppercase tracking-wide mb-1">Active Alerts</p>
        <p className="text-2xl font-bold text-amber-700">{alerts.length}</p>
        <p className="text-xs text-amber-600 mt-1">Monitoring</p>
      </div>
    </div>
  );
};

export default function ManagerBriefing({ deliveries = [], alerts = [], rings = [] }) {
  const [selectedTimeframe, setSelectedTimeframe] = useState("today");
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Generate recommendations based on risk analysis
  const generateRecommendations = () => {
    const recs = [];
    const today = new Date();
    const tomorrow = addDays(today, 1);
    const nextWeek = addDays(today, 7);

    // Group deliveries by risk and region
    const criticalDeliveries = deliveries.filter(d => d.risk_level === "critical");
    const highRiskDeliveries = deliveries.filter(d => d.risk_level === "high");
    const safeDeliveries = deliveries.filter(d => d.risk_level === "low" || d.risk_level === "medium");

    // Recommendation 1: Proceed with low-risk deliveries
    if (safeDeliveries.length > 0) {
      recs.push({
        action: "proceed",
        title: "Proceed with Low-Risk Shipments",
        reason: `${safeDeliveries.length} orders have minimal weather impact. Clear for immediate dispatch.`,
        deliveries: safeDeliveries,
        priority: 1
      });
    }

    // Recommendation 2: Delay critical risk deliveries
    if (criticalDeliveries.length > 0) {
      const affectedStates = [...new Set(criticalDeliveries.map(d => d.state))].join(", ");
      recs.push({
        action: "delay",
        title: "Delay Critical Risk Shipments",
        reason: `${criticalDeliveries.length} orders face severe weather conditions in ${affectedStates}. Recommend 24-48 hour delay.`,
        deliveries: criticalDeliveries,
        estimated_delay: "24-48 hours",
        alternative: "Weather conditions expected to improve by " + format(addDays(today, 2), "MMM d"),
        priority: 3
      });
    }

    // Recommendation 3: Reroute high-risk deliveries
    if (highRiskDeliveries.length > 0) {
      const affectedStates = [...new Set(highRiskDeliveries.map(d => d.state))].join(", ");
      recs.push({
        action: "reroute",
        title: "Consider Alternative Routes",
        reason: `${highRiskDeliveries.length} orders in ${affectedStates} may benefit from route optimization to avoid severe weather zones.`,
        deliveries: highRiskDeliveries,
        alternative: "Use southern routes or delay 12 hours for weather to pass",
        priority: 2
      });
    }

    // Recommendation 4: Monitor specific alerts
    const extremeAlerts = alerts.filter(a => a.severity === "extreme" || a.severity === "severe");
    if (extremeAlerts.length > 0) {
      const affectedStates = [...new Set(extremeAlerts.flatMap(a => a.affected_states || []))];
      const affectedDeliveries = deliveries.filter(d => affectedStates.includes(d.state));
      
      recs.push({
        action: "delay",
        title: "Extreme Weather Advisory",
        reason: `${extremeAlerts.length} severe weather alerts active. ${affectedDeliveries.length} orders in affected regions. Recommend holding all shipments to these areas.`,
        deliveries: affectedDeliveries,
        estimated_delay: "12-36 hours",
        priority: 4
      });
    }

    return recs.sort((a, b) => b.priority - a.priority);
  };

  const recommendations = generateRecommendations();

  // Timeline of next 48 hours
  const getTimeline = () => {
    const timeline = [];
    for (let i = 0; i < 3; i++) {
      const date = addDays(new Date(), i);
      const dateDeliveries = deliveries.filter(d => {
        if (!d.delivery_date) return false;
        const delDate = parseISO(d.delivery_date);
        return format(delDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
      });
      
      const highRisk = dateDeliveries.filter(d => 
        d.risk_level === "high" || d.risk_level === "critical"
      ).length;

      timeline.push({
        date,
        label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : format(date, "MMM d"),
        total: dateDeliveries.length,
        highRisk,
        status: highRisk > dateDeliveries.length * 0.3 ? "warning" : "ok"
      });
    }
    return timeline;
  };

  const timeline = getTimeline();

  // Export briefing report
  const exportReport = () => {
    const report = `LOGISTICS CONTROL TOWER - WEATHER RISK BRIEFING
Generated: ${format(new Date(), "PPpp")}

EXECUTIVE SUMMARY
================
Total Orders: ${deliveries.length}
High Risk Orders: ${deliveries.filter(d => d.risk_level === "critical" || d.risk_level === "high").length}
Active Weather Alerts: ${alerts.length}

RECOMMENDATIONS
===============
${recommendations.map((r, i) => `
${i + 1}. ${r.title}
   Action: ${r.action.toUpperCase()}
   Reason: ${r.reason}
   ${r.alternative ? `Alternative: ${r.alternative}` : ''}
   ${r.estimated_delay ? `Est. Delay: ${r.estimated_delay}` : ''}
`).join('\n')}

48-HOUR OUTLOOK
===============
${timeline.map(t => `${t.label}: ${t.total} deliveries (${t.highRisk} high risk) - ${t.status.toUpperCase()}`).join('\n')}

ACTIVE WEATHER ALERTS
=====================
${alerts.map(a => `- ${a.event} (${a.severity}) - ${a.affected_states?.join(', ') || 'N/A'}`).join('\n')}
`;

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weather-briefing-${format(new Date(), "yyyy-MM-dd-HHmm")}.txt`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            Manager Briefing
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Weather risk analysis & shipping recommendations
          </p>
        </div>
        <Button onClick={exportReport} variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Export Report
        </Button>
      </motion.div>

      {/* Impact Summary */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <ImpactSummary deliveries={deliveries} alerts={alerts} />
      </motion.div>

      {/* 48-Hour Timeline */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              48-Hour Delivery Outlook
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {timeline.map((day, i) => (
                <div
                  key={i}
                  className={`border-2 rounded-xl p-4 ${
                    day.status === "warning" 
                      ? "border-amber-300 bg-amber-50" 
                      : "border-emerald-300 bg-emerald-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-slate-900">{day.label}</p>
                    {day.status === "warning" ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{day.total}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {day.highRisk > 0 && (
                      <span className="text-amber-700 font-medium">
                        ⚠️ {day.highRisk} high risk
                      </span>
                    )}
                    {day.highRisk === 0 && (
                      <span className="text-emerald-700 font-medium">
                        ✓ All clear
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recommendations */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Recommended Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.length > 0 ? (
              recommendations.map((rec, i) => (
                <RecommendationCard 
                  key={i} 
                  recommendation={rec} 
                  index={i}
                  onClick={() => {
                    setSelectedRecommendation(rec);
                    setShowDetailModal(true);
                  }}
                />
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p>All deliveries are low risk. Safe to proceed with all shipments.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Regional Breakdown */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-600" />
              Regional Risk Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(
                deliveries.reduce((acc, d) => {
                  if (!acc[d.state]) {
                    acc[d.state] = { total: 0, high: 0, medium: 0, low: 0 };
                  }
                  acc[d.state].total++;
                  if (d.risk_level === "critical" || d.risk_level === "high") acc[d.state].high++;
                  else if (d.risk_level === "medium") acc[d.state].medium++;
                  else acc[d.state].low++;
                  return acc;
                }, {})
              )
                .sort(([, a], [, b]) => b.high - a.high)
                .slice(0, 8)
                .map(([state, stats]) => (
                  <div key={state} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="font-semibold text-slate-900 text-lg w-8">{state}</div>
                      <div className="text-sm text-slate-600">
                        {stats.total} deliveries
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {stats.high > 0 && (
                        <Badge className="bg-red-100 text-red-700">
                          {stats.high} high risk
                        </Badge>
                      )}
                      {stats.medium > 0 && (
                        <Badge className="bg-amber-100 text-amber-700">
                          {stats.medium} medium
                        </Badge>
                      )}
                      {stats.low > 0 && (
                        <Badge className="bg-emerald-100 text-emerald-700">
                          {stats.low} low
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Detailed Report Modal */}
      <DetailedReportModal
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        recommendation={selectedRecommendation}
        deliveries={deliveries}
        alerts={alerts}
        rings={rings}
      />
    </div>
  );
}