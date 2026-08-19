import React, { useState, useEffect, useMemo, memo } from "react";
import { Link } from "react-router-dom";
import axiosInstance from '../api/axiosInstance';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";
import { Ticket, AlertTriangle, Clock, Loader2, Download, Search, ChevronRight, CheckCircle2, UserCheck, ShieldAlert } from "lucide-react";

/**
 * Enhanced Normalization Engine: Deeply inspects payload properties to isolate 
 * true creator/generator sources and distinct assignees.
 */
const normalizeTicket = (t, now) => {
  let rawAssignee = t.assignee || t.assignedTo || t.assigned_to || t.assignedUser || "Unassigned";
  if (typeof rawAssignee === "object" && rawAssignee !== null) {
    rawAssignee = rawAssignee.name || rawAssignee.fullName || rawAssignee.username || rawAssignee.email || "Unassigned";
  }

  let rawSubAssignee = t.subAssignment || t.sub_assignment || t.subAssignedTo || t.sub_assigned_to || t.subAssignee || null;
  if (typeof rawSubAssignee === "object" && rawSubAssignee !== null) {
    rawSubAssignee = rawSubAssignee.name || rawSubAssignee.fullName || rawSubAssignee.username || rawSubAssignee.email || null;
  }

  // Expanded search across all possible creator/generator fields
  let rawCreator = 
    t.creator || t.createdBy || t.created_by || 
    t.generator || t.generatedBy || t.generated_by || 
    t.source || t.origin || t.author || t.client || t.role;

  if (typeof rawCreator === "object" && rawCreator !== null) {
    rawCreator = rawCreator.name || rawCreator.fullName || rawCreator.username || rawCreator.role || rawCreator.email;
  }
  
  const creatorName = (typeof rawCreator === "string" && rawCreator.trim() !== "" && rawCreator.toLowerCase() !== "operator") 
    ? rawCreator.trim() 
    : (t.source || t.role || t.origin || "System / Direct");

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

  const rawCategoryStr = (t.category || t.type || t.ticketType || t.kind || "—").toString();
  
  const assigneeName = typeof rawAssignee === "string" && rawAssignee.trim() !== "" ? rawAssignee.trim() : "Unassigned";
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
    assigneeName,
    creatorName,
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
            {entry.payload && entry.payload.percentage !== undefined && (
              <span className="text-slate-400 text-[10px]">({entry.payload.percentage}%)</span>
            )}
          </div>
        ))}
      </div>
    );
  }
  return null;
});

CustomTooltip.displayName = "CustomTooltip";

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
            <Pie 
              data={data} 
              innerRadius="45%" 
              outerRadius="75%" 
              paddingAngle={6} 
              dataKey="value"
              isAnimationActive={false}
            >
              {data.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-1 text-[10px] text-slate-500">
        {data.map((item, idx) => (
          <div key={`fact-${idx}`} className="flex items-center gap-1.5 truncate">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
            <span className="truncate font-medium text-slate-700">{item.name}:</span>
            <span className="font-bold text-slate-900">{item.value} ({totalValue > 0 ? Math.round((item.value / totalValue) * 100) : 0}%)</span>
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
  const [velocityDays, setVelocityDays] = useState(7);
  const [priorityFilterTab, setPriorityFilterTab] = useState("all");

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

  const statusCounts = useMemo(() => {
    const total = normalizedTickets.length;
    const open = normalizedTickets.filter((t) => !t.isResolved).length;
    const closed = normalizedTickets.filter((t) => t.isResolved).length;
    const unassigned = normalizedTickets.filter((t) => t.assigneeName.toLowerCase() === "unassigned").length;
    return { total, open, closed, unassigned };
  }, [normalizedTickets]);

  const filteredTickets = useMemo(() => {
    return normalizedTickets.filter((t) => {
      const matchesSearch = 
        t.ticketId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.assigneeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesStatus = true;
      if (statusFilter === "open") matchesStatus = !t.isResolved;
      else if (statusFilter === "closed") matchesStatus = t.isResolved;
      else if (statusFilter === "unassigned") matchesStatus = t.assigneeName.toLowerCase() === "unassigned";

      const matchesPriority = priorityFilterTab === "all" ? true : t.priority.toLowerCase() === priorityFilterTab.toLowerCase();

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [normalizedTickets, searchQuery, statusFilter, priorityFilterTab]);

const generatorBreakdown = useMemo(() => {
  return Object.entries(stats?.byGenerator || {}).map(([name, count]) => ({
    name,
    count,
  }));
}, [stats?.byGenerator]);
  const operatorResolutionStats = useMemo(() => {
    const resolvedTickets = normalizedTickets.filter(t => t.isResolved);
    const map = {};
    resolvedTickets.forEach((t) => {
      const assignee = (t.assigneeName || "Unassigned").trim();
      map[assignee] = (map[assignee] || 0) + 1;
    });
    return {
      totalResolved: resolvedTickets.length,
      byOperator: Object.entries(map).map(([operator, count]) => ({ operator, count }))
    };
  }, [normalizedTickets]);

  const priorityAnalytics = useMemo(() => {
    const levels = ["Critical", "High", "Medium", "Low"];
    return levels.map(level => {
      const matching = normalizedTickets.filter(t => t.priority === level);
      const resolved = matching.filter(t => t.isResolved).length;
      return {
        level,
        total: matching.length,
        resolved
      };
    });
  }, [normalizedTickets]);

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
      "Ticket Status", "SLA Health", "SLA Deadline", "Assignee", "Creator / Generator", "Assigned At", 
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
        `"${(t.creatorName || "").replace(/"/g, '""')}"`,
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

  const stats = useMemo(() => ({
    total: statusCounts.total,
    open: statusCounts.open,
    closed: statusCounts.closed,
    unassigned: statusCounts.unassigned,
    slaRisk: normalizedTickets.filter((t) => ["Breached", "At Risk"].includes(t.slaStatus)).length,
  }), [normalizedTickets, statusCounts]);

  const chartData = useMemo(() => {
    const daysCount = velocityDays;
    const dateRangeDays = Array.from({ length: daysCount }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (daysCount - 1 - i));
      return { label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), fullDate: d.toDateString() };
    });

    const trend = dateRangeDays.map((day) => ({
      day: day.label,
      tickets: normalizedTickets.filter((t) => {
        const d = new Date(t.createdAt);
        return !isNaN(d.getTime()) && d.toDateString() === day.fullDate;
      }).length,
    }));

    return {
      priority: [
        { name: "Critical", count: normalizedTickets.filter((t) => t.priority === "Critical").length },
        { name: "High", count: normalizedTickets.filter((t) => t.priority === "High").length },
        { name: "Medium", count: normalizedTickets.filter((t) => t.priority === "Medium").length },
        { name: "Low", count: normalizedTickets.filter((t) => t.priority === "Low").length },
      ],
      type: [
        { name: "Request", value: normalizedTickets.filter((t) => t.category.toLowerCase().includes("request") || t.category.toLowerCase().includes("dispatch")).length, color: "#3b82f6", details: "Standard requests & dispatches" },
        { name: "Problem", value: normalizedTickets.filter((t) => t.category.toLowerCase().includes("problem") || t.category.toLowerCase().includes("fleet")).length, color: "#f59e0b", details: "Fleet & operational issues" },
      ].filter((d) => d.value > 0),
      sla: [
        { name: "On Track", value: normalizedTickets.filter((t) => t.slaStatus === "On Track").length, color: "#10b981", details: "Meeting target timelines" },
        { name: "At Risk", value: normalizedTickets.filter((t) => t.slaStatus === "At Risk").length, color: "#f59e0b", details: "Approaching deadline window" },
        { name: "Breached", value: normalizedTickets.filter((t) => t.slaStatus === "Breached").length, color: "#ef4444", details: "Deadline expired uncompleted" },
      ].filter((d) => d.value > 0),
      trend: trend,
    };
  }, [normalizedTickets, velocityDays]);

  if (loading) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 font-sans text-slate-800 p-4 sm:p-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Operational Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">Real-time ticketing lifecycle, assignment timelines, and SLA monitoring</p>
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
          { label: "Total Tickets", val: stats.total, icon: Ticket, color: "blue" },
          { label: "Open Work", val: stats.open, icon: Clock, color: "indigo" },
          { label: "Closed / Resolved", val: stats.closed, icon: CheckCircle2, color: "emerald" },
          { label: "SLA Risk", val: stats.slaRisk, icon: AlertTriangle, color: "rose" },
        ].map((item) => (
          <div 
            key={item.label} 
            className="p-5 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between shadow-xs hover:shadow-md transition-shadow duration-200"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
              <h3 className={`text-2xl font-bold ${item.color === 'rose' ? 'text-rose-600' : item.color === 'emerald' ? 'text-emerald-600' : 'text-slate-900'} mt-1`}>{item.val}</h3>
            </div>
            <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
              <item.icon size={22} />
            </div>
          </div>
        ))}
      </div>

      {/* Visibility Cards Section with True Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tickets Generator Breakdown */}
        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <UserCheck size={16} className="text-blue-600" /> Tickets by Generator / Source
            </h4>
            <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">Total: {stats.total}</span>
          </div>
          <div className="py-3 flex flex-col gap-2 max-h-40 overflow-y-auto">
            {generatorBreakdown.map((gen, idx) => (
              <div key={`gen-${idx}`} className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600 truncate max-w-[170px]">{gen.name}</span>
                <span className="font-bold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full shrink-0">{gen.count} tickets</span>
              </div>
            ))}
            {generatorBreakdown.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-2">No generator data available</p>
            )}
          </div>
          <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 italic">
            Reflecting creation telemetry across distinct creators and sources.
          </div>
        </div>

        {/* Operator Resolution Analytics */}
        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" /> Operator Resolutions
            </h4>
            <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md">Resolved: {operatorResolutionStats.totalResolved}</span>
          </div>
          <div className="py-3 flex flex-col gap-2 max-h-40 overflow-y-auto">
            {operatorResolutionStats.byOperator.map((op, idx) => (
              <div key={`op-${idx}`} className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600 truncate max-w-[150px]">{op.operator}</span>
                <span className="font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full shrink-0">{op.count} resolved</span>
              </div>
            ))}
            {operatorResolutionStats.byOperator.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-2">No resolved tickets by operators yet</p>
            )}
          </div>
          <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 italic">
            Total tickets resolved mapped per individual operator assignee.
          </div>
        </div>

        {/* Priority-Based Breakdown & Resolution Metrics */}
        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-600" /> Priority & Resolution
            </h4>
            <span className="text-xs font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md">Active Tracking</span>
          </div>
          <div className="py-3 flex flex-col gap-2">
            {priorityAnalytics.map((p, idx) => (
              <div key={`p-metric-${idx}`} className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">{p.level}</span>
                <div className="flex items-center gap-1.5">
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold">{p.total} total</span>
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-bold">{p.resolved} resolved</span>
                </div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100 italic">
            Breakdown showing closed vs total items per priority level.
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs hover:shadow-md transition-shadow duration-200 flex flex-col justify-between h-64">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Priority Distribution</h4>
          <div className="h-36 w-full mt-1">
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
              <BarChart data={chartData.priority} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between text-[10px] text-slate-500 font-medium">
            <span>P1/Critical: {chartData.priority.find(p => p.name === "Critical")?.count || 0}</span>
            <span>Total Tracked: {stats.total}</span>
          </div>
        </div>

        <OptimizedPieCard title="Ticket Type Split" data={chartData.type} />
        <OptimizedPieCard title="SLA Health" data={chartData.sla} />

        <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-xs hover:shadow-md transition-shadow duration-200 flex flex-col justify-between h-64">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Velocity Trend</h4>
            <select
              value={velocityDays}
              onChange={(e) => setVelocityDays(Number(e.target.value))}
              className="text-[10px] bg-slate-100 border border-slate-200 rounded-md px-1.5 py-0.5 font-bold text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value={7}>Last 7 Days</option>
              <option value={14}>Last 14 Days</option>
              <option value={21}>Last 21 Days</option>
              <option value={30}>Last 30 Days</option>
            </select>
          </div>
          <div className="h-32 w-full mt-1">
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
              <LineChart data={chartData.trend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="tickets" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  dot={{ r: 3, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }} 
                  activeDot={{ r: 5, fill: '#059669', strokeWidth: 2, stroke: '#ffffff' }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="pt-2 border-t border-slate-100 flex justify-between text-[10px] text-slate-500 font-medium">
            <span>Peak: {Math.max(...chartData.trend.map(d => d.tickets), 0)} tix/day</span>
            <span>Range: {velocityDays} Days</span>
          </div>
        </div>
      </div>

      {/* Ticket List Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/40">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Tickets Directory</h3>
                <span className="px-2 py-0.5 text-xs font-bold bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                  {filteredTickets.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Manage, track, and filter operational support records</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/60 text-xs">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {[
                { id: "all", label: "All Tickets", count: statusCounts.total },
                { id: "open", label: "Open", count: statusCounts.open },
                { id: "closed", label: "Closed / Resolved", count: statusCounts.closed },
                { id: "unassigned", label: "Unassigned", count: statusCounts.unassigned },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-xl font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    statusFilter === tab.id 
                      ? "bg-slate-900 text-white shadow-xs" 
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === tab.id ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Priority:</span>
              <select
                value={priorityFilterTab}
                onChange={(e) => setPriorityFilterTab(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
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
          <table className="w-full text-left border-collapse min-w-[1000px]">
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
                <tr key={t.id} className="hover:bg-slate-50/60 transition-colors group">
                  <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                    <span className="font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded-md text-[11px]">
                      {t.ticketId}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800 max-w-[260px] truncate">
                    {t.title}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                    {t.category || "—"}
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
              {filteredTickets.length === 0 && (
                <tr>
                  <td colSpan="8" className="py-16 text-center text-sm text-slate-400 italic">
                    No matching tickets found. Try adjusting your search query or filter settings.
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