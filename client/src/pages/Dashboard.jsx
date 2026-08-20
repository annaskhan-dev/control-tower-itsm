import React, { useState, useEffect, useMemo, memo, useRef } from "react";
import { Link } from "react-router-dom";
import { fetchTicketStats } from '../api/axiosInstance';
import { useTickets } from "../context/TicketContext";
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend
} from "recharts";
import { Ticket, AlertTriangle, UserX, Clock, ArrowRight, Loader2, Download, Layers, CheckCircle2, ShieldAlert } from "lucide-react";

/**
 * Normalization Engine: Robust source/generator field extraction mapping.
 */
const normalizeTicket = (t, now) => {
  let rawAssignee = t.assignee || t.assignedTo || t.assigned_to || t.assignedUser || "Unassigned";
  if (typeof rawAssignee === "object" && rawAssignee !== null) {
    rawAssignee = rawAssignee.name || rawAssignee.fullName || rawAssignee.email || "Unassigned";
  }

  let rawSubAssignee = t.subAssignment || t.sub_assignment || t.subAssignedTo || t.sub_assigned_to || t.subAssignee || null;
  if (typeof rawSubAssignee === "object" && rawSubAssignee !== null) {
    rawSubAssignee = rawSubAssignee.name || rawSubAssignee.fullName || rawSubAssignee.email || null;
  }

  const status = (t.status || t.ticketStatus || t.state || "open").toString().toLowerCase();
  const isResolved = ["closed", "resolved", "completed", "done"].includes(status);

  let sla = t.slaStatus || t.sla_status || t.sla || "On Track";
  if (typeof sla === "string" && !t.slaDeadline) {
    const lowerSla = sla.toLowerCase();
    if (lowerSla.includes("breach")) sla = "Breached";
    else if (lowerSla.includes("due") || lowerSla.includes("warn") || lowerSla.includes("risk")) sla = "At Risk";
    else sla = "On Track";
  }
  
  const deadlineRaw = t.slaDeadline || t.sla_deadline || t.dueDate || t.due_date;
  if (deadlineRaw) {
    const deadline = new Date(deadlineRaw);
    if (!isNaN(deadline.getTime())) {
      const evaluationTime = isResolved ? new Date(t.resolvedAt || t.resolved_at || t.closedAt || now).getTime() : now.getTime();
      const diffMinutes = (deadline.getTime() - evaluationTime) / (1000 * 60);
      
      if (diffMinutes < 0) {
        sla = "Breached";
      } else if (diffMinutes <= 30 && !isResolved) {
        sla = "At Risk";
      } else if (!isResolved) {
        sla = "On Track";
      }
    }
  }

  const rawPriorityStr = (t.priority || t.priorityLevel || t.severity || "Low").toString().toLowerCase();
  let priority = "Low";
  if (rawPriorityStr.includes("crit") || rawPriorityStr.includes("p1")) priority = "Critical";
  else if (rawPriorityStr.includes("high") || rawPriorityStr.includes("p2")) priority = "High";
  else if (rawPriorityStr.includes("med") || rawPriorityStr.includes("p3")) priority = "Medium";

  const rawCategoryStr = (t.category || t.type || t.ticketType || t.kind || "General").toString();
  
  let rawSourceStr = "";
  const candidateSources = [
    t.generator, t.source, t.origin, t.channel, t.createdByRole, 
    t.creator, t.created_by, t.type, t.role, t.department, t.sourceChannel
  ];

  for (const candidate of candidateSources) {
    if (!candidate) continue;
    if (typeof candidate === "string" && candidate.trim() !== "" && candidate !== "undefined" && candidate !== "null") {
      rawSourceStr = candidate.trim();
      break;
    }
    if (typeof candidate === "object") {
      const subVal = candidate.name || candidate.title || candidate.role || candidate.type || candidate.label || candidate.username;
      if (subVal && typeof subVal === "string" && subVal.trim() !== "") {
        rawSourceStr = subVal.trim();
        break;
      }
    }
  }

  if (!rawSourceStr && t.metadata) {
    const metaObj = t.metadata;
    const metaSource = metaObj.source || metaObj.generator || metaObj.channel || metaObj.origin;
    if (metaSource) rawSourceStr = String(metaSource).trim();
  }

  if (!rawSourceStr) {
    rawSourceStr = t.companyId ? "Company Portal" : "Direct System";
  }

  const assigneeName = typeof rawAssignee === "string" ? rawAssignee : "Unassigned";
  const isAssigned = assigneeName.toLowerCase() !== "unassigned" && assigneeName !== "";
  
  const subAssignmentName = typeof rawSubAssignee === "string" ? rawSubAssignee.trim() : "";
  const isSubAssigned = subAssignmentName !== "" && subAssignmentName.toLowerCase() !== "unassigned";

  const createdAtTime = new Date(t.createdAt || t.created_at || t.timestamp || now).getTime();
  const assignedAtRaw = t.assignedAt || t.assigned_at || t.assignmentTime;
  const assignedAtTime = assignedAtRaw ? new Date(assignedAtRaw).getTime() : createdAtTime;

  const subAssignedAtRaw = t.subAssignmentAt || t.sub_assigned_at || t.subAssignedAt || t.sub_assignment_at || (isSubAssigned ? (t.updatedAt || t.createdAt) : null);
  const subAssignedAtTime = subAssignedAtRaw ? new Date(subAssignedAtRaw).getTime() : null;

  const resolvedAtRaw = t.resolvedAt || t.resolved_at || t.closedAt;
  const resolvedAtTime = isResolved ? (resolvedAtRaw ? new Date(resolvedAtRaw).getTime() : now.getTime()) : null;
  
  const currentOrResolveTime = isResolved ? resolvedAtTime : now.getTime();

  let primaryAssignmentMs = 0;
  if (isAssigned) {
    const primaryEndTime = (isSubAssigned && subAssignedAtTime) ? subAssignedAtTime : currentOrResolveTime;
    primaryAssignmentMs = Math.max(0, primaryEndTime - assignedAtTime);
  }

  const slaTimeMs = isAssigned ? Math.max(0, currentOrResolveTime - assignedAtTime) : 0;

  let subAssignmentTimeMs = 0;
  if (isSubAssigned && subAssignedAtTime) {
    subAssignmentTimeMs = Math.max(0, currentOrResolveTime - subAssignedAtTime);
  }

  const finalResolutionTimeMs = isResolved ? Math.max(0, resolvedAtTime - createdAtTime) : null;

  const formatDuration = (ms) => {
    if (ms === null || ms === undefined || isNaN(ms)) return "—";
    if (ms < 60000) return "Just now";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours === 0 && mins === 0) return "Just now";
    return `${hours}h ${mins}m`;
  };

  return {
    ...t,
    id: t._id || t.id || t.ticketId || t.code || "N/A",
    ticketId: t.ticketId || t.id || t._id || t.code || "N/A",
    title: t.title || t.subject || t.name || t.description || "Untitled Ticket",
    source: rawSourceStr,
    assigneeName,
    subAssignmentName,
    subAssignmentAt: subAssignedAtRaw,
    status: t.status || "Open",
    createdAt: t.createdAt || t.created_at || new Date().toISOString(),
    priority,
    category: rawCategoryStr,
    slaStatus: sla,
    isResolved,
    isSubAssigned,
    assignmentTimeFormatted: isAssigned ? formatDuration(primaryAssignmentMs) : "Unassigned",
    slaTimeFormatted: isAssigned ? formatDuration(slaTimeMs) : "N/A",
    subAssignmentTimeFormatted: isSubAssigned ? formatDuration(subAssignmentTimeMs) : "Not Sub-Assigned",
    finalResolutionTimeFormatted: isResolved ? formatDuration(finalResolutionTimeMs) : "Pending",
  };
};

/**
 * Custom Styled Tooltip Component for Charts
 */
const CustomTooltip = memo(({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-xl shadow-xl border border-slate-700/65">
        {label && <p className="font-bold text-slate-300 mb-1">{label}</p>}
        {payload.map((entry, index) => (
          <div key={`tooltip-${index}`} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
            <span className="text-slate-300 capitalize">{entry.name || entry.dataKey}:</span>
            <span className="font-bold text-white">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
});
CustomTooltip.displayName = "CustomTooltip";

/**
 * List-based Card for Creators & Sources
 */
const GeneratorListCard = memo(({ title, data, totalLabel = "total" }) => {
  const totalValue = useMemo(() => data.reduce((acc, curr) => acc + (Number(curr.count) || 0), 0), [data]);

  return (
    <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs hover:shadow-md transition-shadow duration-200 flex flex-col justify-between h-72">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-emerald-600" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{title}</h4>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
            Total: {totalValue}
          </span>
        </div>
      </div>

      <div className="my-2 flex-1 overflow-y-auto space-y-2 pr-1">
        {data.length > 0 ? (
          data.map((item, idx) => (
            <div key={`gen-row-${idx}`} className="flex items-center justify-between py-1">
              <span className="text-sm font-medium text-slate-700 truncate pr-2">{item.name}</span>
              <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100/60 whitespace-nowrap">
                {item.count} {totalLabel}
              </span>
            </div>
          ))
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
            No metrics available
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-slate-100">
        <p className="text-[11px] text-slate-400 italic">
          Breakdown tracked across roles and operational parameters.
        </p>
      </div>
    </div>
  );
});
GeneratorListCard.displayName = "GeneratorListCard";

export const Dashboard = ({ tickets: propTickets }) => {
  const { tickets: contextTickets, isLoading: contextLoading, fetchTickets } = useTickets();
  
  const tickets = (propTickets && propTickets.length > 0) ? propTickets : contextTickets;
  const loading = contextLoading && (!tickets || tickets.length === 0);

  const [backendStats, setBackendStats] = useState(null);
  const [now] = useState(() => new Date());
  
  // New UI controls state
  const [velocityDays, setVelocityDays] = useState(7);
  const [selectedTab, setSelectedTab] = useState("all");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState("all");

  const hasFetchedTicketsRef = useRef(false);
  const hasFetchedStatsRef = useRef(false);

  useEffect(() => {
    if (!propTickets && fetchTickets && !hasFetchedTicketsRef.current) {
      hasFetchedTicketsRef.current = true;
      fetchTickets('all-work');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const getStatsData = async () => {
      if (hasFetchedStatsRef.current) return;
      hasFetchedStatsRef.current = true;

      try {
        const data = await fetchTicketStats();
        if (data && isMounted) {
          setBackendStats(data);
        }
      } catch (err) {
        console.error("Failed to load backend stats:", err);
      }
    };
    getStatsData();
    return () => {
      isMounted = false;
    };
  }, []);

  const normalizedTickets = useMemo(() => (Array.isArray(tickets) ? tickets : []).map((t) => normalizeTicket(t, now)), [tickets, now]);

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const d = new Date(dateString);
    return isNaN(d.getTime()) 
      ? "Invalid" 
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleExportExcel = () => {
    const currentDate = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(currentDate.getMonth() - 1);

    const recentTickets = normalizedTickets.filter((t) => {
      if (!t.createdAt) return true;
      const ticketDate = new Date(t.createdAt);
      return isNaN(ticketDate.getTime()) || ticketDate >= oneMonthAgo;
    });

    if (recentTickets.length === 0) {
      alert("No ticket data found to export for the last month.");
      return;
    }

    const headers = [
      "Ticket ID", "Title", "Description", "Source", "Category", "Priority", 
      "Ticket Status", "SLA Health", "SLA Deadline", "Assignee", "Assigned At", 
      "Assignment Duration", "SLA Active Duration", "Sub-Assignee", "Sub-Assigned At", 
      "Sub-Assignment Duration", "Resolved At", "Final Resolution Duration", "Company ID", "Created At"
    ];

    const csvRows = recentTickets.map((t) => {
      const createdAtFormatted = t.createdAt ? new Date(t.createdAt).toLocaleString() : "";
      const assignedAtFormatted = t.assignedAt ? new Date(t.assignedAt).toLocaleString() : "";
      const subAssignmentAtFormatted = t.subAssignmentAt ? new Date(t.subAssignmentAt).toLocaleString() : "";
      const resolvedAtFormatted = t.resolvedAt ? new Date(t.resolvedAt).toLocaleString() : "";
      const slaDeadlineFormatted = t.slaDeadline ? new Date(t.slaDeadline).toLocaleString() : "";

      return [
        `"${(t.ticketId || "").toString().replace(/"/g, '""')}"`,
        `"${(t.title || "").replace(/"/g, '""')}"`,
        `"${(t.description || "").replace(/"/g, '""')}"`,
        `"${(t.source || "").replace(/"/g, '""')}"`,
        `"${(t.category || "").replace(/"/g, '""')}"`,
        `"${(t.priority || "").replace(/"/g, '""')}"`,
        `"${(t.status || "").replace(/"/g, '""')}"`,
        `"${(t.slaStatus || "").replace(/"/g, '""')}"`,
        `"${slaDeadlineFormatted}"`,
        `"${(t.assigneeName || "").replace(/"/g, '""')}"`,
        `"${assignedAtFormatted}"`,
        `"${t.assignmentTimeFormatted || "Unassigned"}"`,
        `"${t.slaTimeFormatted || "N/A"}"`,
        `"${(t.subAssignmentName || "").replace(/"/g, '""')}"`,
        `"${subAssignmentAtFormatted}"`,
        `"${t.subAssignmentTimeFormatted || "Not Sub-Assigned"}"`,
        `"${resolvedAtFormatted}"`,
        `"${t.finalResolutionTimeFormatted || "Pending"}"`,
        `"${(t.companyId || "").toString().replace(/"/g, '""')}"`,
        `"${createdAtFormatted}"`
      ].join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `comprehensive_tickets_report_last_month_${currentDate.toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Comprehensive Metrics Calculation
  const stats = useMemo(() => {
    let generatorMap = {};
    let operatorResolvedMap = {};
    let priorityMap = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    let priorityResolvedMap = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    let slaHealthMap = { "On Track": 0, "At Risk": 0, "Breached": 0 };

    let openCount = 0;
    let assignedCount = 0;
    let closedCount = 0;
    let unassignedCount = 0;

    normalizedTickets.forEach(t => {
      // Creator / Generator
      const src = t.source || "Direct System";
      generatorMap[src] = (generatorMap[src] || 0) + 1;

      // Status filters count
      const isClosed = t.isResolved || ["closed", "resolved", "completed", "done"].includes(t.status.toLowerCase());
      const isAssigned = t.assigneeName.toLowerCase() !== "unassigned" && t.assigneeName !== "";

      if (isClosed) {
        closedCount++;
        // Track operator resolution
        if (isAssigned) {
          operatorResolvedMap[t.assigneeName] = (operatorResolvedMap[t.assigneeName] || 0) + 1;
        }
      } else {
        openCount++;
      }

      if (isAssigned) {
        assignedCount++;
      } else {
        unassignedCount++;
      }

      // Priority counts & resolutions
      const prio = t.priority || "Low";
      if (priorityMap[prio] !== undefined) {
        priorityMap[prio]++;
        if (isClosed) priorityResolvedMap[prio]++;
      }

      // SLA Health
      const sla = t.slaStatus || "On Track";
      if (slaHealthMap[sla] !== undefined) {
        slaHealthMap[sla]++;
      } else {
        slaHealthMap["On Track"] = (slaHealthMap["On Track"] || 0) + 1;
      }
    });

    return {
      total: backendStats?.total || backendStats?.count || normalizedTickets.length,
      open: openCount,
      assigned: assignedCount,
      closed: closedCount,
      unassigned: unassignedCount,
      slaRisk: (slaHealthMap["Breached"] || 0) + (slaHealthMap["At Risk"] || 0),
      byGenerator: generatorMap,
      byOperatorResolved: operatorResolvedMap,
      byPriority: priorityMap,
      byPriorityResolved: priorityResolvedMap,
      slaHealth: slaHealthMap
    };
  }, [normalizedTickets, backendStats]);

  // Dynamic Chart & Trend Data
  const chartData = useMemo(() => {
    const daysCount = Math.max(1, Math.min(30, Number(velocityDays) || 7));
    const velocityDaysArr = Array.from({ length: daysCount }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - ((daysCount - 1) - i));
      return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), fullDate: d.toDateString() };
    });

    const trend = velocityDaysArr.map((day) => ({
      day: day.label,
      tickets: normalizedTickets.filter((t) => {
        const d = new Date(t.createdAt);
        return !isNaN(d.getTime()) && d.toDateString() === day.fullDate;
      }).length,
    }));

    const generatorEntries = Object.entries(stats.byGenerator || {}).map(([name, count]) => ({
      name,
      count: Number(count) || 0,
    })).filter(d => d.count > 0);

    const operatorResolvedEntries = Object.entries(stats.byOperatorResolved || {}).map(([name, count]) => ({
      name,
      count: Number(count) || 0,
    })).filter(d => d.count > 0);

    const slaPieEntries = [
      { name: "On Track", value: stats.slaHealth["On Track"] || 0, color: "#10b981" },
      { name: "At Risk", value: stats.slaHealth["At Risk"] || 0, color: "#f59e0b" },
      { name: "Breached", value: stats.slaHealth["Breached"] || 0, color: "#f43f5e" },
    ].filter(d => d.value > 0);

    return {
      generator: generatorEntries,
      operatorResolved: operatorResolvedEntries,
      trend,
      slaPie: slaPieEntries,
    };
  }, [normalizedTickets, stats, velocityDays]);

  // Filtered tickets based on active tab and priority filter
  const filteredTickets = useMemo(() => {
    return normalizedTickets.filter(t => {
      const isClosed = t.isResolved || ["closed", "resolved", "completed", "done"].includes(t.status.toLowerCase());
      const isAssigned = t.assigneeName.toLowerCase() !== "unassigned" && t.assigneeName !== "";

      // Tab filter
      if (selectedTab === "open" && isClosed) return false;
      if (selectedTab === "assigned" && !isAssigned) return false;
      if (selectedTab === "closed" && !isClosed) return false;

      // Priority filter
      if (selectedPriorityFilter !== "all" && t.priority.toLowerCase() !== selectedPriorityFilter.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [normalizedTickets, selectedTab, selectedPriorityFilter]);

  if (loading) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 font-sans text-slate-800 p-4 sm:p-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Operational Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">Real-time ticketing lifecycle, creator tracking, operator resolution metrics, and SLA health</p>
        </div>
        <button
          onClick={handleExportExcel}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
        >
          <Download size={16} /> Export to Excel
        </button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Tickets", val: stats.total, icon: Ticket, color: "blue", tab: "all" },
          { label: "Open Work", val: stats.open, icon: Clock, color: "indigo", tab: "open" },
          { label: "Assigned", val: stats.assigned, icon: CheckCircle2, color: "emerald", tab: "assigned" },
          { label: "Closed Tickets", val: stats.closed, icon: CheckCircle2, color: "purple", tab: "closed" },
        ].map((item) => (
          <div 
            key={item.label} 
            onClick={() => setSelectedTab(item.tab)}
            className={`p-5 bg-white border rounded-2xl flex items-center justify-between shadow-xs hover:shadow-md transition cursor-pointer ${
              selectedTab === item.tab ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200/80'
            }`}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{item.val}</h3>
            </div>
            <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
              <item.icon size={22} />
            </div>
          </div>
        ))}
      </div>

      {/* Widgets Grid: Generators, Operators, and SLA Donut */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Creators / Generators Breakdown */}
        <GeneratorListCard title="TICKETS CREATED BY ROLE / SOURCE" data={chartData.generator} totalLabel="tickets" />

        {/* Operator Resolution Breakdown */}
        <GeneratorListCard title="RESOLVED TICKETS BY OPERATOR" data={chartData.operatorResolved} totalLabel="resolved" />

        {/* SLA Health Donut Chart */}
        <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs hover:shadow-md transition-shadow duration-200 flex flex-col justify-between h-72">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">SLA Health Distribution</h4>
            <span className="text-xs font-bold px-2.5 py-1 bg-rose-50 text-rose-700 rounded-lg border border-rose-100">
              Risk: {stats.slaRisk}
            </span>
          </div>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData.slaPie}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={62}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {chartData.slaPie.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 italic">
            Proportional breakdown of active and resolved SLAs.
          </div>
        </div>
      </div>

      {/* Velocity Trend Chart with Days Selector (Height decreased to h-32) */}
      <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Ticket Intake Velocity Trend</h4>
          <div className="flex items-center gap-2">
            <label htmlFor="velocity-days-select" className="text-xs text-slate-500 font-medium">View Days (1–30):</label>
            <select
              id="velocity-days-select"
              value={velocityDays}
              onChange={(e) => setVelocityDays(Math.max(1, Math.min(30, Number(e.target.value))))}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
            >
              {[1, 3, 7, 14, 21, 30].map((d) => (
                <option key={d} value={d}>{d} Days</option>
              ))}
            </select>
          </div>
        </div>
        <div className="h-32 w-full mt-3">
          <ResponsiveContainer width="100%" height="100%" debounce={100}>
            <LineChart data={chartData.trend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="tickets" 
                stroke="#10b981" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }} 
                activeDot={{ r: 6, fill: '#059669', strokeWidth: 2, stroke: '#ffffff' }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 italic">
          Daily volume intake pattern over the selected {velocityDays}-day window.
        </div>
      </div>

      {/* Priority Summary & Filter Bar placed right above the table */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-amber-500" />
          <span className="text-xs font-bold uppercase text-slate-700 tracking-wider">Priority Breakdown & Filters:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: "all", label: "All Priorities", count: stats.total },
            { key: "critical", label: "Critical", count: stats.byPriority["Critical"], resolved: stats.byPriorityResolved["Critical"], color: "rose" },
            { key: "high", label: "High", count: stats.byPriority["High"], resolved: stats.byPriorityResolved["High"], color: "amber" },
            { key: "medium", label: "Medium", count: stats.byPriority["Medium"], resolved: stats.byPriorityResolved["Medium"], color: "blue" },
            { key: "low", label: "Low", count: stats.byPriority["Low"], resolved: stats.byPriorityResolved["Low"], color: "slate" },
          ].map(p => (
            <button
              key={p.key}
              onClick={() => setSelectedPriorityFilter(p.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border flex items-center gap-1.5 cursor-pointer ${
                selectedPriorityFilter === p.key 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>{p.label}</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${selectedPriorityFilter === p.key ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
                {p.count || 0} {p.resolved !== undefined ? `(${p.resolved} res)` : ''}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Ticket List Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/40">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tickets Matrix ({selectedTab.toUpperCase()})</h3>
              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                {filteredTickets.length} Records
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Real-time telemetry tracking category, assignee, execution intervals, and SLA health.</p>
          </div>
          
          {/* Status Tab Filters */}
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
            {[
              { key: "all", label: "All Work" },
              { key: "open", label: "Open" },
              { key: "assigned", label: "Assigned" },
              { key: "closed", label: "Closed" }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  selectedTab === tab.key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 border-collapse min-w-[1100px]">
            <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="p-4">ID</th>
                <th className="p-4">Entry</th>
                <th className="p-4">Title</th>
                <th className="p-4">Category</th>
                <th className="p-4">Priority</th>
                <th className="p-4">Assignee</th>
                <th className="p-4">Assignment Time</th>
                <th className="p-4">SLA Active Time</th>
                <th className="p-4">SLA Health</th>
                <th className="p-4">Status & Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTickets.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-4 font-bold text-slate-800 whitespace-nowrap">{t.ticketId}</td>
                  <td className="p-4 text-slate-500 whitespace-nowrap text-xs">{formatDate(t.createdAt)}</td>
                  <td className="p-4 font-semibold text-slate-900 max-w-[200px] truncate">{t.title}</td>
                  <td className="p-4 text-slate-500 whitespace-nowrap text-xs">{t.category || "—"}</td>
                  <td className="p-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                      t.priority === "Critical" ? "bg-rose-100 text-rose-700" :
                      t.priority === "High" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"
                    }`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="p-4 font-medium text-slate-700 whitespace-nowrap text-xs">{t.assigneeName}</td>
                  <td className="p-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      t.assignmentTimeFormatted !== "Unassigned" ? "bg-slate-100 text-slate-700 border border-slate-200/60" : "bg-slate-50 text-slate-400 italic"
                    }`}>
                      {t.assignmentTimeFormatted}
                    </span>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-xs font-semibold">
                      {t.slaTimeFormatted}
                    </span>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      t.slaStatus === "Breached" ? "bg-rose-100 text-rose-700 border border-rose-200" : 
                      t.slaStatus === "At Risk" ? "bg-amber-100 text-amber-700 border border-amber-200" : 
                      "bg-emerald-100 text-emerald-700 border border-emerald-200"
                    }`}>
                      {t.slaStatus}
                    </span>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`px-3 py-1 font-bold uppercase rounded-full text-[10px] tracking-wider shadow-2xs ${
                        t.isResolved ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
                      }`}>
                        {t.status || "Open"}
                      </span>
                      <span className={`text-[11px] font-medium ${t.isResolved ? "text-emerald-700 font-bold" : "text-slate-400 italic"}`}>
                        Total: {t.finalResolutionTimeFormatted}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTickets.length === 0 && (
                <tr>
                  <td colSpan="10" className="p-16 text-center text-sm text-slate-400 italic">
                    No tickets available matching the selected filter parameters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;