import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import axiosInstance from '../api/axiosInstance';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";
import { Ticket, AlertTriangle, UserX, Clock, ArrowRight, Loader2, Download } from "lucide-react";

/**
 * Unified Normalization Engine: Ensures 100% telemetry formatting match for the Dashboard ticket list table.
 */
const normalizeTicket = (t, now) => {
  let rawAssignee = t.assignee || t.assignedTo || t.assigned_to || t.assignedUser || "Unassigned";
  if (typeof rawAssignee === "object" && rawAssignee !== null) {
    rawAssignee = rawAssignee.name || rawAssignee.fullName || rawAssignee.email || "Unassigned";
  }

  // Sub-assignee parsing
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

  const rawCategoryStr = (t.category || t.type || t.ticketType || t.kind || "Request").toString();
  
  const status = (t.status || t.ticketStatus || t.state || "new").toString().toLowerCase().replace(/_/g, " ");
  const isResolved = ["closed", "resolved", "completed", "done"].includes(status);
  const isAssigned = typeof rawAssignee === "string" && rawAssignee.toLowerCase() !== "unassigned";

  // Timestamps
  const createdAtTime = new Date(t.createdAt || t.created_at || t.creationDate || now).getTime();
  const assignedAtTime = t.assignedAt || t.assigned_at || t.assignmentTime ? new Date(t.assignedAt || t.assigned_at || t.assignmentTime).getTime() : null;
  const subAssignedAtTime = t.subAssignedAt || t.sub_assigned_at || t.subAssignmentTime ? new Date(t.subAssignedAt || t.sub_assigned_at || t.subAssignmentTime).getTime() : null;
  const resolvedAtTime = isResolved ? (t.resolvedAt || t.resolved_at || t.closedAt || t.updatedAt ? new Date(t.resolvedAt || t.resolved_at || t.closedAt || t.updatedAt).getTime() : now.getTime()) : null;

  // Timelapses in ms
  let assignmentTimeMs = null;
  if (assignedAtTime) {
    assignmentTimeMs = Math.max(0, assignedAtTime - createdAtTime);
  } else if (isAssigned) {
    assignmentTimeMs = Math.max(0, now.getTime() - createdAtTime);
  }

  const slaStartTime = assignedAtTime || createdAtTime;
  const slaEndTime = isResolved ? resolvedAtTime : now.getTime();
  const slaTimeMs = Math.max(0, slaEndTime - slaStartTime);
  const subAssignmentTimeMs = subAssignedAtTime ? Math.max(0, slaEndTime - subAssignedAtTime) : null;
  const finalResolutionTimeMs = isResolved ? Math.max(0, resolvedAtTime - createdAtTime) : null;

  // Smart formatting mirroring your target ticket list component exactly
  const formatDurationSmart = (ms) => {
    if (ms === null || ms === undefined || isNaN(ms)) return null;
    
    if (ms < 60000) {
      return "< 1m";
    }

    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0) {
      return `${mins}m`;
    }
    return `${hours}h ${mins}m`;
  };

  return {
    ...t,
    id: t.id || t._id || t.ticketId || t.code || "N/A",
    title: t.title || t.subject || t.name || t.description || "Untitled Ticket",
    assignee: typeof rawAssignee === "string" ? rawAssignee : "Unassigned",
    subAssignee: rawSubAssignee,
    subAssigneeTimestamp: t.subAssignedAt || t.sub_assigned_at || t.subAssignmentTime || null,
    status,
    createdAt: t.createdAt || t.created_at || new Date().toISOString(),
    priority,
    category: rawCategoryStr,
    sla,
    isResolved,
    isSubAssigned: Boolean(subAssignedAtTime || rawSubAssignee),
    assignmentTimeFormatted: formatDurationSmart(assignmentTimeMs),
    slaTimeFormatted: formatDurationSmart(slaTimeMs),
    subAssignmentTimeFormatted: subAssignmentTimeMs !== null ? formatDurationSmart(subAssignmentTimeMs) : null,
    finalResolutionTimeFormatted: isResolved ? formatDurationSmart(finalResolutionTimeMs) : null,
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
      "Ticket ID", "Title", "Category", "Priority", "Assignee", "Sub-Assignee", "SLA Status", "Ticket Status", 
      "Assignment Time", "SLA Active Time", "Sub-Assignee Time", "Final Resolution Time", "Created At"
    ];

    const csvRows = recentTickets.map((t) => {
      const formattedDate = t.createdAt ? new Date(t.createdAt).toLocaleString() : "";
      return [
        `"${(t.id || "").toString().replace(/"/g, '""')}"`,
        `"${(t.title || "").replace(/"/g, '""')}"`,
        `"${(t.category || "").replace(/"/g, '""')}"`,
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
        { name: "Request", value: normalizedTickets.filter((t) => t.category.toLowerCase().includes("request") || t.category.toLowerCase().includes("dispatch")).length, color: "#3b82f6" },
        { name: "Problem", value: normalizedTickets.filter((t) => t.category.toLowerCase().includes("problem") || t.category.toLowerCase().includes("fleet")).length, color: "#f59e0b" },
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

      {/* Ticket List Table Section styled 100% identically to the Ticket List component */}
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
            <p className="text-xs text-slate-400 mt-1">Real-time telemetry tracking category, assignee, execution intervals, and SLA health.</p>
          </div>
          <Link to="/tickets" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors">
            View All Work <ArrowRight size={14} />
          </Link>
        </div>

        {/* Table Container */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse table-auto min-w-[1100px]">
            <thead>
              <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50/80">
                <th className="py-3.5 px-4 w-44">CATEGORY</th>
                <th className="py-3.5 px-4 w-32">ASSIGNEE</th>
                <th className="py-3.5 px-4 w-32">ASSIGNMENT TIME</th>
                <th className="py-3.5 px-4 w-32">SLA ACTIVE TIME</th>
                <th className="py-3.5 px-4 w-36">SUB-ASSIGNMENT</th>
                <th className="py-3.5 px-4 w-36">SUB-ASSIGNEE TIME</th>
                <th className="py-3.5 px-4 w-32">SLA HEALTH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {normalizedTickets.map((t, index) => (
                <tr key={t.id || index} className="hover:bg-slate-50/60 transition-colors group">
                  {/* Category */}
                  <td className="py-4 px-4 font-semibold text-slate-800 whitespace-nowrap">
                    {t.category}
                  </td>

                  {/* Assignee */}
                  <td className="py-4 px-4 font-semibold text-slate-700 whitespace-nowrap">
                    {t.assignee}
                  </td>

                  {/* Assignment Time */}
                  <td className="py-4 px-4 whitespace-nowrap">
                    {t.assignmentTimeFormatted ? (
                      <span className="font-mono text-slate-700 bg-slate-100/90 px-2.5 py-1 rounded-md border border-slate-200/80 text-[11px] inline-block shadow-2xs">
                        {t.assignmentTimeFormatted}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                    )}
                  </td>

                  {/* SLA Active Time */}
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span className="font-mono text-blue-600 bg-blue-50/80 px-2.5 py-1 rounded-md border border-blue-100 text-[11px] font-semibold inline-block shadow-2xs">
                      {t.slaTimeFormatted || "< 1m"}
                    </span>
                  </td>

                  {/* Sub-Assignment */}
                  <td className="py-4 px-4 whitespace-nowrap">
                    {t.subAssignee ? (
                      <div>
                        <span className="font-semibold text-slate-800">{t.subAssignee}</span>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {t.subAssigneeTimestamp ? new Date(t.subAssigneeTimestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Sub-Assigned"}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>

                  {/* Sub-Assignee Time */}
                  <td className="py-4 px-4 whitespace-nowrap">
                    {t.subAssignee && t.subAssignmentTimeFormatted ? (
                      <span className="font-mono text-purple-700 bg-purple-50/80 px-2.5 py-1 rounded-md border border-purple-100 text-[11px] font-semibold inline-block shadow-2xs">
                        {t.subAssignmentTimeFormatted}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic font-normal text-[11px]">Not Sub-Assigned</span>
                    )}
                  </td>

                  {/* SLA Health */}
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full font-semibold text-[11px] inline-flex items-center gap-1.5 shadow-2xs ${
                      t.sla === "Breached" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                      t.sla === "Due Soon" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                      "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        t.sla === "Breached" ? "bg-rose-500" : t.sla === "Due Soon" ? "bg-amber-500" : "bg-emerald-500"
                      }`}></span>
                      {t.sla}
                    </span>
                  </td>
                </tr>
              ))}
              {normalizedTickets.length === 0 && (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400 italic bg-slate-50/20">
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