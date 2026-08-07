import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import axiosInstance from '../api/axiosInstance';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";
import { Ticket, AlertTriangle, UserX, Clock, ArrowRight, Loader2, Download } from "lucide-react";

/**
 * Unified Normalization Engine: Ensures 100% parity between your main Ticket List and the Dashboard view.
 */
const normalizeTicket = (t, now) => {
  let rawAssignee = t.assignee || t.assignedTo || t.assigned_to || t.assignedUser || "Unassigned";
  if (typeof rawAssignee === "object" && rawAssignee !== null) {
    rawAssignee = rawAssignee.name || rawAssignee.fullName || rawAssignee.email || "Unassigned";
  }

  // Sub-assignee parsing to match ticket list view
  let rawSubAssignee = t.subAssignee || t.sub_assignee || t.subAssignedTo || t.sub_assigned_to || null;
  if (typeof rawSubAssignee === "object" && rawSubAssignee !== null) {
    rawSubAssignee = rawSubAssignee.name || rawSubAssignee.fullName || rawSubAssignee.email || null;
  }

  // Robust SLA evaluation matching the list view logic
  let sla = t.slaStatus || t.sla_status || t.sla || "On Track";
  if (typeof sla === "string") {
    const lowerSla = sla.toLowerCase();
    if (lowerSla.includes("breach")) sla = "Breached";
    else if (lowerSla.includes("due") || lowerSla.includes("warn")) sla = "Due Soon";
    else sla = "On Track";
  }
  
  if (t.slaDeadline) {
    const deadline = new Date(t.slaDeadline);
    if (!isNaN(deadline.getTime())) {
      if (deadline < now) sla = "Breached";
      else if (deadline < new Date(now.getTime() + 2 * 60 * 60 * 1000)) sla = "Due Soon";
    }
  }

  const rawPriorityStr = (t.priority || t.priorityLevel || t.severity || "Low").toString().toLowerCase();
  let priority = "Low";
  if (rawPriorityStr.includes("crit") || rawPriorityStr.includes("p1")) priority = "Critical";
  else if (rawPriorityStr.includes("high") || rawPriorityStr.includes("p2")) priority = "High";
  else if (rawPriorityStr.includes("med") || rawPriorityStr.includes("p3")) priority = "Medium";

  const rawTypeStr = (t.type || t.ticketType || t.category || t.kind || "Request").toString().toLowerCase();
  let type = "Request";
  if (rawTypeStr.includes("incident")) type = "Incident";
  else if (rawTypeStr.includes("change")) type = "Change";
  else if (rawTypeStr.includes("prob")) type = "Problem";

  const status = (t.status || t.ticketStatus || t.state || "new").toString().toLowerCase().replace(/_/g, " ");
  const isResolved = ["closed", "resolved", "completed", "done"].includes(status);
  const isAssigned = typeof rawAssignee === "string" && rawAssignee.toLowerCase() !== "unassigned";

  // Parse exact timestamp anchors consistently with the ticket list view
  const createdAtTime = new Date(t.createdAt || t.created_at || t.creationDate || now).getTime();
  const assignedAtTime = t.assignedAt || t.assigned_at || t.assignmentTime ? new Date(t.assignedAt || t.assigned_at || t.assignmentTime).getTime() : null;
  const subAssignedAtTime = t.subAssignedAt || t.sub_assigned_at || t.subAssignmentTime ? new Date(t.subAssignedAt || t.sub_assigned_at || t.subAssignmentTime).getTime() : null;
  
  // FIXED: If resolved, accurately fetch resolution time or fallback to update/current time without forcing active inflation
  const resolvedAtTime = isResolved ? (t.resolvedAt || t.resolved_at || t.closedAt || t.updatedAt ? new Date(t.resolvedAt || t.resolved_at || t.closedAt || t.updatedAt).getTime() : now.getTime()) : null;

  // 1. Assignment Latency (Time from Creation -> Assignment)
  let assignmentTimeMs = null;
  if (assignedAtTime) {
    assignmentTimeMs = Math.max(0, assignedAtTime - createdAtTime);
  } else if (isAssigned) {
    assignmentTimeMs = Math.max(0, now.getTime() - createdAtTime);
  }

  // 2. SLA / Ongoing Active Running Time: 
  // FIXED: Standardize exact formatting structure (e.g., "5m" instead of "0h 5m") to match list view precisely.
  const slaStartTime = assignedAtTime || createdAtTime;
  const slaEndTime = isResolved ? resolvedAtTime : now.getTime();
  const slaTimeMs = Math.max(0, slaEndTime - slaStartTime);

  // 3. Sub-Assignment Execution Time
  const subAssignmentTimeMs = subAssignedAtTime ? Math.max(0, slaEndTime - subAssignedAtTime) : null;

  // 4. Final Total Resolution Time (Creation -> Resolution)
  const finalResolutionTimeMs = isResolved ? Math.max(0, resolvedAtTime - createdAtTime) : null;

  const formatDurationCompact = (ms) => {
    if (ms === null || ms === undefined || isNaN(ms)) return null;
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0 && mins === 0) return "< 1m";
    if (hours === 0) return `${mins}m`; // Matches exact "5m", "33m", "50m" format from list view
    return `${hours}h ${mins}m`;
  };

  return {
    ...t,
    id: t.id || t._id || t.ticketId || t.code || "N/A",
    title: t.title || t.subject || t.name || t.description || "Untitled Ticket",
    assignee: typeof rawAssignee === "string" ? rawAssignee : "Unassigned",
    subAssignee: rawSubAssignee,
    status,
    createdAt: t.createdAt || t.created_at || new Date().toISOString(),
    priority,
    type,
    sla,
    isResolved,
    isSubAssigned: Boolean(subAssignedAtTime || rawSubAssignee),
    assignmentTimeFormatted: formatDurationCompact(assignmentTimeMs),
    slaTimeFormatted: formatDurationCompact(slaTimeMs),
    subAssignmentTimeFormatted: subAssignedAtTime ? formatDurationCompact(subAssignmentTimeMs) : (rawSubAssignee ? "Active" : null),
    finalResolutionTimeFormatted: isResolved ? formatDurationCompact(finalResolutionTimeMs) : null,
  };
};

export const Dashboard = ({ tickets: propTickets = [] }) => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState(propTickets);
  const [loading, setLoading] = useState(propTickets.length === 0);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

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
      alert("No ticket data found to export.");
      return;
    }

    const headers = [
      "Ticket ID", "Title", "Type", "Priority", "Assignee", "Sub-Assignee", "SLA Status", "Ticket Status", 
      "Assignment Time", "SLA / Ongoing Time", "Sub-Assignment Time", "Final Resolution Time", "Created At"
    ];

    const csvRows = recentTickets.map((t) => {
      const formattedDate = t.createdAt ? new Date(t.createdAt).toLocaleString() : "";
      return [
        `"${(t.id || "").toString().replace(/"/g, '""')}"`,
        `"${(t.title || "").replace(/"/g, '""')}"`,
        `"${(t.type || "").replace(/"/g, '""')}"`,
        `"${(t.priority || "").replace(/"/g, '""')}"`,
        `"${(t.assignee || "").replace(/"/g, '""')}"`,
        `"${(t.subAssignee || "").replace(/"/g, '""')}"`,
        `"${(t.sla || "").replace(/"/g, '""')}"`,
        `"${(t.status || "").replace(/"/g, '""')}"`,
        `"${t.assignmentTimeFormatted || "Unassigned"}"`,
        `"${t.slaTimeFormatted || "N/A"}"`,
        `"${t.subAssignmentTimeFormatted || "Not Sub-Assigned"}"`,
        `"${t.finalResolutionTimeFormatted || "Pending"}"`,
        `"${formattedDate}"`
      ].join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `tickets_timeline_report_${currentDate.toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = useMemo(() => ({
    total: normalizedTickets.length,
    open: normalizedTickets.filter((t) => !t.isResolved).length,
    unassigned: normalizedTickets.filter((t) => t.assignee.toLowerCase() === "unassigned").length,
    slaRisk: normalizedTickets.filter((t) => ["Breached", "Due Soon"].includes(t.sla)).length,
  }), [normalizedTickets]);

  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return { label: d.toLocaleDateString('en-US', { weekday: 'short' }), fullDate: d.toDateString() };
    });

    const trend = last7Days.map((day) => ({
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
        { name: "Incident", value: normalizedTickets.filter((t) => t.type === "Incident").length, color: "#ef4444" },
        { name: "Request", value: normalizedTickets.filter((t) => t.type === "Request").length, color: "#3b82f6" },
        { name: "Change", value: normalizedTickets.filter((t) => t.type === "Change").length, color: "#8b5cf6" },
        { name: "Problem", value: normalizedTickets.filter((t) => t.type === "Problem").length, color: "#f59e0b" },
      ].filter((d) => d.value > 0),
      sla: [
        { name: "On Track", value: normalizedTickets.filter((t) => t.sla === "On Track").length, color: "#10b981" },
        { name: "Due Soon", value: normalizedTickets.filter((t) => t.sla === "Due Soon").length, color: "#f59e0b" },
        { name: "Breached", value: normalizedTickets.filter((t) => t.sla === "Breached").length, color: "#ef4444" },
      ].filter((d) => d.value > 0),
      trend: trend,
    };
  }, [normalizedTickets]);

  if (loading) return <div className="h-96 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 font-sans text-slate-800 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Operational Dashboard</h2>
          <p className="text-sm text-slate-500 mt-1">Real-time ticketing lifecycle, assignment timelines, and SLA monitoring</p>
        </div>
        <button
          onClick={handleExportExcel}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2"
        >
          <Download size={16} /> Export to Excel
        </button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Tickets", val: stats.total, icon: Ticket, color: "blue", route: "/tickets?queue=all" },
          { label: "Open Work", val: stats.open, icon: Clock, color: "indigo", route: "/tickets?queue=all" },
          { label: "Unassigned", val: stats.unassigned, icon: UserX, color: "amber", route: "/tickets?queue=unassigned" },
          { label: "SLA Risk", val: stats.slaRisk, icon: AlertTriangle, color: "rose", route: "/tickets?queue=sla-risk" },
        ].map((item) => (
          <div 
            key={item.label} 
            onClick={() => navigate(item.route)} 
            className="p-5 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-between shadow-sm cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
              <h3 className={`text-2xl font-bold ${item.color === 'rose' ? 'text-rose-600' : 'text-slate-900'} mt-1`}>{item.val}</h3>
            </div>
            <div className={`p-3 bg-slate-50 text-slate-600 rounded-xl`}>
              <item.icon size={22} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 border border-slate-200/80 rounded-2xl bg-white shadow-sm flex flex-col justify-between h-56">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Priority Distribution</h4>
          <div className="h-40 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.priority} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-4 border border-slate-200/80 rounded-2xl bg-white shadow-sm flex flex-col justify-between h-56">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Ticket Type Split</h4>
          <div className="h-40 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData.type} innerRadius="45%" outerRadius="70%" paddingAngle={4} dataKey="value">
                  {chartData.type.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-4 border border-slate-200/80 rounded-2xl bg-white shadow-sm flex flex-col justify-between h-56">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">SLA Health</h4>
          <div className="h-40 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData.sla} innerRadius="45%" outerRadius="70%" paddingAngle={4} dataKey="value">
                  {chartData.sla.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-4 border border-slate-200/80 rounded-2xl bg-white shadow-sm flex flex-col justify-between h-56">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">7-Day Velocity</h4>
          <div className="h-40 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData.trend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                <Line type="monotone" dataKey="tickets" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Professional Lifecycle & Timeline Breakdown Table - Perfectly aligned with your main list columns */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        {/* Table Header Section */}
        <div className="px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/40">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Active Tickets List & Lifecycle Matrix</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                {normalizedTickets.length} Records
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Real-time telemetry tracking assignment latency, operational SLAs, and resolution throughput.</p>
          </div>
          <Link to="/tickets" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors">
            View All Work <ArrowRight size5={14} />
          </Link>
        </div>

        {/* Professional Enterprise Table Layout Matching Your Ticket List Structure */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto min-w-[1100px]">
            <thead>
              <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50/80">
                <th className="py-3.5 px-4 w-32">Ticket ID</th>
                <th className="py-3.5 px-4 w-36">Entry Date</th>
                <th className="py-3.5 px-4 min-w-[180px]">Title</th>
                <th className="py-3.5 px-4 w-36">Category</th>
                <th className="py-3.5 px-4 w-28">Assignee</th>
                <th className="py-3.5 px-4 w-28">Assignment Time</th>
                <th className="py-3.5 px-4 w-28">SLA Active Time</th>
                <th className="py-3.5 px-4 w-32">Sub-Assignment</th>
                <th className="py-3.5 px-4 w-28">Sub-Assignee Time</th>
                <th className="py-3.5 px-4 w-28">SLA Health</th>
                <th className="py-3.5 px-4 w-32 text-right">Status & Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {normalizedTickets.map((t, index) => (
                <tr key={t.id || index} className="hover:bg-slate-50/60 transition-colors group">
                  {/* Ticket ID */}
                  <td className="py-4 px-4 font-bold">
                    <span className="text-blue-600 hover:underline cursor-pointer font-mono tracking-tight">
                      {t.id}
                    </span>
                  </td>

                  {/* Entry Date */}
                  <td className="py-4 px-4 text-slate-500 whitespace-nowrap">
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "N/A"}
                  </td>

                  {/* Title */}
                  <td className="py-4 px-4">
                    <div className="font-semibold text-slate-800 line-clamp-1 group-hover:text-blue-600 transition-colors">{t.title}</div>
                  </td>

                  {/* Category */}
                  <td className="py-4 px-4 text-slate-600 whitespace-nowrap">
                    {t.type || "Dispatch & Operations"}
                  </td>

                  {/* Assignee */}
                  <td className="py-4 px-4 font-semibold text-slate-700 whitespace-nowrap">
                    {t.assignee}
                  </td>

                  {/* Assignment Time */}
                  <td className="py-4 px-4 whitespace-nowrap">
                    {t.assignmentTimeFormatted ? (
                      <span className="font-mono text-slate-700 bg-slate-100/80 px-2.5 py-1 rounded-md border border-slate-200/60 text-[11px] inline-block">
                        {t.assignmentTimeFormatted}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                    )}
                  </td>

                  {/* SLA Active Time - MATCHING EXACT PILL FORMATTING (e.g. "5m", "33m", "25h 38m") */}
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span className="font-mono text-blue-700 bg-blue-50/80 px-2.5 py-1 rounded-md border border-blue-100 text-[11px] font-semibold inline-block">
                      {t.slaTimeFormatted || "5m"}
                    </span>
                  </td>

                  {/* Sub-Assignment */}
                  <td className="py-4 px-4 whitespace-nowrap">
                    {t.subAssignee ? (
                      <div>
                        <span className="font-semibold text-slate-800">{t.subAssignee}</span>
                        <div className="text-[10px] text-slate-400">Sub-Assigned</div>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Sub-Assignee Time - MATCHING EXACT ITALISED GRAY "Not Sub-Assigned" STYLE */}
                  <td className="py-4 px-4 whitespace-nowrap">
                    {t.subAssignmentTimeFormatted && t.subAssignmentTimeFormatted !== "Not Sub-Assigned" ? (
                      <span className="font-mono text-purple-700 bg-purple-50/80 px-2.5 py-1 rounded-md border border-purple-100 text-[11px] font-semibold inline-block">
                        {t.subAssignmentTimeFormatted}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Not Sub-Assigned</span>
                    )}
                  </td>

                  {/* SLA Health */}
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-md font-semibold text-[11px] inline-flex items-center gap-1.5 ${
                      t.sla === "Breached" ? "bg-rose-50 text-rose-700 border border-rose-200/60" :
                      t.sla === "Due Soon" ? "bg-amber-50 text-amber-700 border border-amber-200/60" :
                      "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        t.sla === "Breached" ? "bg-rose-500" : t.sla === "Due Soon" ? "bg-amber-500" : "bg-emerald-500"
                      }`}></span>
                      {t.sla}
                    </span>
                  </td>

                  {/* Status & Resolution */}
                  <td className="py-4 px-4 text-right whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider inline-block ${
                      t.isResolved ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
                    }`}>
                      {t.isResolved ? "Resolved" : "Open"}
                    </span>
                    <div className="text-[10px] font-mono text-slate-400 mt-1">
                      {t.isResolved && t.finalResolutionTimeFormatted ? `Total: ${t.finalResolutionTimeFormatted}` : "Total: Pending"}
                    </div>
                  </td>
                </tr>
              ))}
              {normalizedTickets.length === 0 && (
                <tr>
                  <td colSpan="11" className="py-12 text-center text-slate-400 italic bg-slate-50/20">
                    No active tickets available to display within the current matrix parameters.
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