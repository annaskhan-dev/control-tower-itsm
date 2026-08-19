import React, { useState, useEffect, useMemo, memo } from "react";
import { Link } from "react-router-dom";
import axiosInstance from '../api/axiosInstance';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";
import { Ticket, AlertTriangle, Clock, ArrowRight, Loader2, Download, Search, Filter, ChevronRight, Calendar, CheckCircle2, ShieldCheck, Users } from "lucide-react";

/**
 * Enhanced Normalization Engine: Safely parses backend fields to extract exact ticket 
 * source roles (Sales, Operator, Transporter, Admin, Manager, etc.) preventing "Other" fallbacks.
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

  const creatorObj = t.createdBy || t.creator || t.raisedBy || t.user || {};
  const creatorRoleStr = typeof creatorObj === "object" ? (creatorObj.role || creatorObj.department || creatorObj.type || "") : "";
  
  const rawSource = (
    t.source || t.origin || t.channel || t.department || t.raisedByRole || t.creatorRole || creatorRoleStr || "Other"
  ).toString().trim().toLowerCase();

  let source = "Other";
  if (rawSource.includes("sale")) source = "Sales";
  else if (rawSource.includes("op") || rawSource.includes("agent")) source = "Operator";
  else if (rawSource.includes("trans") || rawSource.includes("driver") || rawSource.includes("logistics")) source = "Transporter";
  else if (rawSource.includes("admin")) source = "Admin";
  else if (rawSource.includes("manag")) source = "Manager";
  else if (rawSource.includes("support")) source = "Support";
  else if (rawSource !== "other" && rawSource !== "") {
    source = rawSource.charAt(0).toUpperCase() + rawSource.slice(1);
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
      
      if (diffMinutes < 0) sla = "Breached";
      else if (diffMinutes <= 30 && !isResolved) sla = "At Risk";
      else if (!isResolved) sla = "On Track";
    }
  }

  const rawPriorityStr = (t.priority || t.priorityLevel || t.severity || "Low").toString().toLowerCase();
  let priority = "Low";
  if (rawPriorityStr.includes("crit") || rawPriorityStr.includes("p1")) priority = "Critical";
  else if (rawPriorityStr.includes("high") || rawPriorityStr.includes("p2")) priority = "High";
  else if (rawPriorityStr.includes("med") || rawPriorityStr.includes("p3")) priority = "Medium";

  const rawCategoryStr = (t.category || t.type || t.ticketType || t.kind || "General").toString();
  const assigneeName = typeof rawAssignee === "string" ? rawAssignee : "Unassigned";
  const isAssigned = assigneeName.toLowerCase() !== "unassigned" && assigneeName !== "";
  
  const subAssignmentName = typeof rawSubAssignee === "string" ? rawSubAssignee.trim() : "";
  const isSubAssigned = subAssignmentName !== "" && subAssignmentName.toLowerCase() !== "unassigned";

  const createdAtTime = new Date(t.createdAt || t.created_at || t.timestamp || now).getTime();
  const assignedAtRaw = t.assignedAt || t.assigned_at || t.assignmentTime;
  const assignedAtTime = assignedAtRaw ? new Date(assignedAtRaw).getTime() : createdAtTime;

  const subAssignedAtRaw = t.subAssignmentAt || t.sub_assigned_at || t.subAssignedAt || t.sub_assignment_at || null;
  const resolvedAtRaw = t.resolvedAt || t.resolved_at || t.closedAt;
  const resolvedAtTime = isResolved ? (resolvedAtRaw ? new Date(resolvedAtRaw).getTime() : now.getTime()) : null;
  
  const currentOrResolveTime = isResolved ? resolvedAtTime : now.getTime();

  let primaryAssignmentMs = 0;
  if (isAssigned) {
    const primaryEndTime = (isSubAssigned && subAssignedAtRaw) ? new Date(subAssignedAtRaw).getTime() : currentOrResolveTime;
    primaryAssignmentMs = Math.max(0, primaryEndTime - assignedAtTime);
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
    assigneeName,
    subAssignmentName,
    source,
    status: t.status || "Open",
    createdAt: t.createdAt || t.created_at || new Date().toISOString(),
    resolvedAt: resolvedAtRaw,
    priority,
    category: rawCategoryStr,
    slaStatus: sla,
    isResolved,
    assignmentTimeFormatted: isAssigned ? formatDuration(primaryAssignmentMs) : "Unassigned",
    finalResolutionTimeFormatted: isResolved ? formatDuration(finalResolutionTimeMs) : "Pending",
    resolutionMs: finalResolutionTimeMs,
  };
};

/**
 * Custom Styled Tooltip Component for Charts
 */
const CustomTooltip = memo(({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-xs text-white text-xs px-3 py-2 rounded-xl shadow-xl border border-slate-700/65">
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
 * Optimized Pie Card Component for SLA Health
 */
const OptimizedPieCard = memo(({ title, data }) => {
  const totalValue = useMemo(() => data.reduce((acc, curr) => acc + curr.value, 0), [data]);

  return (
    <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs hover:shadow-md transition-shadow duration-200 flex flex-col justify-between h-64">
      <div>
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{title}</h4>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">Total: {totalValue}</span>
        </div>
      </div>
      <div className="h-32 w-full mt-1">
        <ResponsiveContainer width="100%" height="100%" debounce={100}>
          <PieChart>
            <Pie data={data} innerRadius="45%" outerRadius="75%" paddingAngle={4} dataKey="value" isAnimationActive={false}>
              {data.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-1 text-[10px] text-slate-500">
        {data.slice(0, 4).map((item, idx) => (
          <div key={`fact-${idx}`} className="flex items-center gap-1.5 truncate">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="truncate font-medium text-slate-700">{item.name}:</span>
            <span className="font-bold text-slate-900">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
OptimizedPieCard.displayName = "OptimizedPieCard";

export const Dashboard = ({ tickets: propTickets = [] }) => {
  const [tickets, setTickets] = useState(propTickets);
  const [loading, setLoading] = useState(propTickets.length === 0);
  const [now] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); 
  const [priorityFilter, setPriorityFilter] = useState("all"); 
  const [velocityDays, setVelocityDays] = useState(7);

  useEffect(() => {
    if (propTickets && propTickets.length > 0) {
      setTickets(propTickets);
      setLoading(false);
    }
  }, [propTickets]);

  useEffect(() => {
    if (!propTickets || propTickets.length === 0) {
      const fetchTickets = async () => {
        const token = localStorage.getItem('access_token');
        if (!token) {
          setLoading(false);
          return;
        }
        try {
          const response = await axiosInstance.get('/tickets');
          const data = Array.isArray(response.data) ? response.data : (response.data?.tickets || response.data?.data || []);
          setTickets(data);
        } catch (error) {
          console.error("Failed to fetch tickets:", error);
          setTickets([]);
        } finally {
          setLoading(false);
        }
      };
      fetchTickets();
    }
  }, [propTickets]);

  const normalizedTickets = useMemo(() => tickets.map((t) => normalizeTicket(t, now)), [tickets, now]);

  const stats = useMemo(() => {
    const total = normalizedTickets.length;
    const openCount = normalizedTickets.filter((t) => !t.isResolved && t.status.toLowerCase() !== "in progress").length;
    const inProgressCount = normalizedTickets.filter((t) => !t.isResolved && t.status.toLowerCase() === "in progress").length;
    const closedCount = normalizedTickets.filter((t) => t.isResolved).length;
    const slaRisk = normalizedTickets.filter((t) => ["Breached", "At Risk"].includes(t.slaStatus)).length;

    return { total, open: openCount, inProgress: inProgressCount, closed: closedCount, slaRisk };
  }, [normalizedTickets]);

  const filteredTickets = useMemo(() => {
    return normalizedTickets.filter((t) => {
      const matchesSearch = 
        t.ticketId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.assigneeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesStatus = true;
      if (statusFilter === "open") {
        matchesStatus = !t.isResolved && t.status.toLowerCase() !== "in progress";
      } else if (statusFilter === "in_progress") {
        matchesStatus = !t.isResolved && t.status.toLowerCase() === "in progress";
      } else if (statusFilter === "closed") {
        matchesStatus = t.isResolved;
      }

      const matchesPriority = priorityFilter === "all" ? true : t.priority.toLowerCase() === priorityFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [normalizedTickets, searchQuery, statusFilter, priorityFilter]);

  const handleExportExcel = () => {
    const headers = ["Ticket ID", "Title", "Category", "Priority", "Status", "SLA Health", "Assignee", "Resolved At", "Created At"];
    const csvRows = normalizedTickets.map((t) => [
      `"${t.ticketId}"`, `"${t.title.replace(/"/g, '""')}"`, `"${t.category}"`, 
      `"${t.priority}"`, `"${t.status}"`, `"${t.slaStatus}"`, `"${t.assigneeName}"`, 
      `"${t.resolvedAt ? new Date(t.resolvedAt).toLocaleString() : ""}"`, `"${new Date(t.createdAt).toLocaleString()}"`
    ].join(","));

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `tickets_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const operatorResolutionMetrics = useMemo(() => {
    const operatorMap = {};
    normalizedTickets.forEach((t) => {
      const op = t.assigneeName;
      if (!operatorMap[op]) {
        operatorMap[op] = { name: op, totalAssigned: 0, resolvedCount: 0, totalResTimeMs: 0 };
      }
      operatorMap[op].totalAssigned += 1;
      if (t.isResolved) {
        operatorMap[op].resolvedCount += 1;
        if (t.resolutionMs) operatorMap[op].totalResTimeMs += t.resolutionMs;
      }
    });

    return Object.values(operatorMap).map((op) => {
      const avgMs = op.resolvedCount > 0 ? op.totalResTimeMs / op.resolvedCount : 0;
      const hours = Math.floor(avgMs / (1000 * 60 * 60));
      const mins = Math.floor((avgMs % (1000 * 60 * 60)) / (1000 * 60));
      return {
        ...op,
        avgResolutionTime: op.resolvedCount > 0 ? `${hours}h ${mins}m` : "N/A",
      };
    }).sort((a, b) => b.resolvedCount - a.resolvedCount);
  }, [normalizedTickets]);

  const priorityBreakdown = useMemo(() => {
    const levels = ["Critical", "High", "Medium", "Low"];
    return levels.map((lvl) => {
      const matching = normalizedTickets.filter((t) => t.priority === lvl);
      const resolved = matching.filter((t) => t.isResolved).length;
      return {
        name: lvl,
        total: matching.length,
        resolved: resolved,
        unresolved: matching.length - resolved,
      };
    });
  }, [normalizedTickets]);

  const chartData = useMemo(() => {
    const timeFrameDays = Math.min(Math.max(Number(velocityDays) || 7, 1), 30);
    const dynamicDaysArray = Array.from({ length: timeFrameDays }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (timeFrameDays - 1 - i));
      const label = timeFrameDays > 14 
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
      return { label, fullDate: d.toDateString() };
    });

    const trend = dynamicDaysArray.map((day) => ({
      day: day.label,
      tickets: normalizedTickets.filter((t) => {
        const d = new Date(t.createdAt);
        return !isNaN(d.getTime()) && d.toDateString() === day.fullDate;
      }).length,
    }));

    const salesCount = normalizedTickets.filter((t) => t.source === "Sales").length;
    const operatorCount = normalizedTickets.filter((t) => t.source === "Operator").length;
    const transporterCount = normalizedTickets.filter((t) => t.source === "Transporter").length;
    const adminCount = normalizedTickets.filter((t) => t.source === "Admin").length;
    const managerCount = normalizedTickets.filter((t) => t.source === "Manager").length;
    const otherCount = normalizedTickets.filter((t) => !["Sales", "Operator", "Transporter", "Admin", "Manager"].includes(t.source)).length;

    const sourceList = [
      { name: "Sales", value: salesCount, color: "bg-purple-500" },
      { name: "Operator", value: operatorCount, color: "bg-sky-500" },
      { name: "Transporter", value: transporterCount, color: "bg-amber-500" },
      { name: "Admin", value: adminCount, color: "bg-emerald-500" },
      { name: "Manager", value: managerCount, color: "bg-pink-500" },
      { name: "Other", value: otherCount, color: "bg-slate-500" },
    ].filter((d) => d.value > 0);

    return {
      sources: sourceList,
      priorityBar: priorityBreakdown.map(p => ({ name: p.name, count: p.total })),
      sla: [
        { name: "On Track", value: normalizedTickets.filter((t) => t.slaStatus === "On Track").length, color: "#10b981" },
        { name: "At Risk", value: normalizedTickets.filter((t) => t.slaStatus === "At Risk").length, color: "#f59e0b" },
        { name: "Breached", value: normalizedTickets.filter((t) => t.slaStatus === "Breached").length, color: "#ef4444" },
      ].filter((d) => d.value > 0),
      trend: trend,
    };
  }, [normalizedTickets, velocityDays, priorityBreakdown]);

  if (loading) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 font-sans text-slate-800 p-4 sm:p-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Operational Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">Real-time ticketing lifecycle, department source visibility, operator resolution metrics, and SLA monitoring</p>
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
        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Tickets</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</h3>
          </div>
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl"><Ticket size={22} /></div>
        </div>
        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Open / In Progress</p>
            <h3 className="text-2xl font-bold text-indigo-600 mt-1">{stats.open + stats.inProgress}</h3>
          </div>
          <div className="p-3 bg-slate-50 text-indigo-600 rounded-xl"><Clock size={22} /></div>
        </div>
        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Closed / Resolved</p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">{stats.closed}</h3>
          </div>
          <div className="p-3 bg-slate-50 text-emerald-600 rounded-xl"><CheckCircle2 size={22} /></div>
        </div>
        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">SLA Risk / Breach</p>
            <h3 className="text-2xl font-bold text-rose-600 mt-1">{stats.slaRisk}</h3>
          </div>
          <div className="p-3 bg-slate-50 text-rose-600 rounded-xl"><AlertTriangle size={22} /></div>
        </div>
      </div>

      {/* Analytics Charts Grid - Replaced Donut Chart with Tickets Raised by Source Listing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Priority Breakdown */}
        <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs flex flex-col justify-between h-64">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Priority Breakdown</h4>
          <div className="h-36 w-full mt-1">
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
              <BarChart data={chartData.priorityBar} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between text-[10px] text-slate-500 font-medium">
            <span>Critical P1: {chartData.priorityBar.find(p => p.name === "Critical")?.count || 0}</span>
            <span>Total Tracked: {stats.total}</span>
          </div>
        </div>

        {/* Tickets Raised By Source Listing Card */}
        <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs flex flex-col justify-between h-64">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tickets Raised by Source</h4>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">Total: {stats.total}</span>
          </div>
          <div className="space-y-2 my-2 overflow-y-auto max-h-36 pr-1">
            {chartData.sources.map((src, idx) => (
              <div key={`src-stat-${idx}`} className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${src.color}`} />
                  <span className="font-semibold text-slate-700">{src.name}</span>
                </div>
                <span className="font-bold text-slate-900">{src.value} tickets</span>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 font-medium flex justify-between">
            <span>Active Sources</span>
            <span>{chartData.sources.length} Categories</span>
          </div>
        </div>

        {/* SLA Health Chart */}
        <OptimizedPieCard title="SLA Health" data={chartData.sla} />

        {/* Velocity Trend Chart */}
        <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs flex flex-col justify-between h-64">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Velocity Trend</h4>
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5">
              <Calendar size={12} className="text-slate-400 shrink-0" />
              <select
                value={velocityDays}
                onChange={(e) => setVelocityDays(Number(e.target.value))}
                className="bg-transparent text-[10px] font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={21}>21 Days</option>
                <option value={30}>30 Days (Max)</option>
              </select>
            </div>
          </div>
          <div className="h-36 w-full mt-1">
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
              <LineChart data={chartData.trend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval={velocityDays > 14 ? 4 : 1} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="tickets" stroke="#10b981" strokeWidth={3} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between text-[10px] text-slate-500 font-medium">
            <span>Range: Last {velocityDays} Days</span>
            <span>Total Window: {chartData.trend.reduce((acc, curr) => acc + curr.tickets, 0)}</span>
          </div>
        </div>
      </div>

      {/* Advanced Operational Insight Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Operator Resolution Tracking</h3>
            </div>
            <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">{operatorResolutionMetrics.length} Operators</span>
          </div>
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {operatorResolutionMetrics.map((op, idx) => (
              <div key={`op-${idx}`} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 text-xs">
                <div>
                  <p className="font-bold text-slate-800">{op.name}</p>
                  <p className="text-[10px] text-slate-500">Assigned: {op.totalAssigned} | Avg: {op.avgResolutionTime}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-[11px]">
                    {op.resolvedCount} Resolved
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Priority Resolution Panel</h3>
            </div>
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">Total Resolved: {stats.closed}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {priorityBreakdown.map((pTier, idx) => (
              <div key={`priority-tier-${idx}`} className="p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/50 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    pTier.name === "Critical" ? "bg-rose-100 text-rose-700 border border-rose-200" :
                    pTier.name === "High" ? "bg-amber-100 text-amber-700 border border-amber-200" :
                    pTier.name === "Medium" ? "bg-blue-100 text-blue-700 border border-blue-100" :
                    "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}>
                    {pTier.name} Priority
                  </span>
                  <span className="text-xs font-bold text-slate-700">Total: {pTier.total}</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden my-1">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${pTier.total > 0 ? (pTier.resolved / pTier.total) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-medium text-slate-600 mt-1">
                  <span className="text-emerald-600 font-bold">Resolved: {pTier.resolved}</span>
                  <span className="text-slate-500">Unresolved: {pTier.unresolved}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ticket List Table Section - Source Column Removed, Category Restored */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-50/40">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Tickets Directory</h3>
              <span className="px-2 py-0.5 text-xs font-bold bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                {filteredTickets.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Manage and inspect support tickets by category, status, and priority</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search ticket, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="text-slate-400 shrink-0" size={16} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer w-full sm:w-auto"
              >
                <option value="all">All Statuses ({stats.total})</option>
                <option value="open">Open ({stats.open})</option>
                <option value="in_progress">In Progress ({stats.inProgress})</option>
                <option value="closed">Closed / Resolved ({stats.closed})</option>
              </select>
            </div>

            <div className="w-full sm:w-auto">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer w-full sm:w-auto"
              >
                <option value="all">All Priorities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-4">Ticket ID</th>
                <th className="py-3 px-4">Subject / Title</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Assignee</th>
                <th className="py-3 px-4">SLA Health</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
              {filteredTickets.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/65 transition-colors group">
                  <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                    <span className="font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded-md text-[11px]">
                      {t.ticketId}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800 max-w-[260px] truncate">
                    {t.title}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                      {t.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      t.priority === "Critical" ? "bg-rose-100 text-rose-700 border border-rose-200" :
                      t.priority === "High" ? "bg-amber-100 text-amber-700 border border-amber-200" :
                      t.priority === "Medium" ? "bg-blue-100 text-blue-700 border border-blue-100" :
                      "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                    {t.assigneeName}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      t.slaStatus === "Breached" ? "bg-rose-100 text-rose-700 border border-rose-200" : 
                      t.slaStatus === "At Risk" ? "bg-amber-100 text-amber-700 border border-amber-200" : 
                      "bg-emerald-100 text-emerald-700 border border-emerald-200"
                    }`}>
                      {t.slaStatus}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      t.isResolved ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <Link 
                      to={`/tickets/${t.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                    >
                      View <ChevronRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};