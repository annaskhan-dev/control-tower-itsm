import React, { useState, useEffect, useMemo, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import axiosInstance from '../api/axiosInstance';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";
import { Ticket, AlertTriangle, UserX, Clock, ArrowRight, Loader2, Download } from "lucide-react";

/**
 * Normalization Helper with Accurate Stage-by-Stage Timeline & Sub-Assignment Tracking
 */
const normalizeTicket = (t, now) => {
  let rawAssignee = t.assignee || t.assignedTo || t.assigned_to || "Unassigned";
  if (typeof rawAssignee === "object" && rawAssignee !== null) {
    rawAssignee = rawAssignee.name || rawAssignee.fullName || rawAssignee.email || "Unassigned";
  }

  // Sub-assignee parsing
  let rawSubAssignee = t.subAssignment || t.sub_assignment || t.subAssignedTo || t.sub_assigned_to || t.subAssignee || null;
  if (typeof rawSubAssignee === "object" && rawSubAssignee !== null) {
    rawSubAssignee = rawSubAssignee.name || rawSubAssignee.fullName || rawSubAssignee.email || null;
  }

  let sla = "On Track";
  if (t.slaDeadline) {
    const deadline = new Date(t.slaDeadline);
    if (!isNaN(deadline.getTime())) {
      if (deadline < now) sla = "Breached";
      else if (deadline < new Date(now.getTime() + 2 * 60 * 60 * 1000)) sla = "Due Soon";
    }
  }

  const rawPriorityStr = (t.priority || t.priorityLevel || "Low").toString().toLowerCase();
  let priority = "Low";
  if (rawPriorityStr.includes("crit")) priority = "Critical";
  else if (rawPriorityStr.includes("high")) priority = "High";
  else if (rawPriorityStr.includes("med")) priority = "Medium";

  const rawTypeStr = (t.type || t.ticketType || t.category || "Request").toString().toLowerCase();
  let type = "Request";
  if (rawTypeStr.includes("incident")) type = "Incident";
  else if (rawTypeStr.includes("change")) type = "Change";
  else if (rawTypeStr.includes("prob")) type = "Problem";

  const status = (t.status || t.ticketStatus || "new").toString().toLowerCase().replace(/_/g, " ");
  const isResolved = ["closed", "resolved", "completed", "done"].includes(status);
  const assigneeName = typeof rawAssignee === "string" ? rawAssignee : "Unassigned";
  const isAssigned = assigneeName.toLowerCase() !== "unassigned";

  const subAssignmentName = typeof rawSubAssignee === "string" ? rawSubAssignee.trim() : "";
  const isSubAssigned = subAssignmentName !== "" && subAssignmentName.toLowerCase() !== "unassigned";

  // Timeline anchors pulled directly from ticket database fields if available
  const createdAtTime = new Date(t.createdAt || t.created_at || now).getTime();
  const assignedAtTime = t.assignedAt || t.assigned_at ? new Date(t.assignedAt || t.assigned_at).getTime() : null;
  const subAssignedAtRaw = t.subAssignmentAt || t.sub_assigned_at || t.subAssignedAt || t.sub_assignment_at;
  const subAssignedAtTime = subAssignedAtRaw ? new Date(subAssignedAtRaw).getTime() : null;
  const resolvedAtTime = isResolved ? (t.resolvedAt || t.resolved_at ? new Date(t.resolvedAt || t.resolved_at).getTime() : now.getTime()) : null;
  const currentOrResolveTime = isResolved ? resolvedAtTime : now.getTime();

  let assignmentTimeMs = null;
  if (assignedAtTime) {
    assignmentTimeMs = Math.max(0, assignedAtTime - createdAtTime);
  } else if (isAssigned) {
    assignmentTimeMs = Math.max(0, now.getTime() - createdAtTime);
  }

  const slaStartTime = assignedAtTime || createdAtTime;
  const slaTimeMs = Math.max(0, currentOrResolveTime - slaStartTime);

  const subAssignmentTimeMs = subAssignedAtTime ? Math.max(0, currentOrResolveTime - subAssignedAtTime) : 0;
  const finalResolutionTimeMs = isResolved ? Math.max(0, resolvedAtTime - createdAtTime) : null;

  const formatDuration = (ms) => {
    if (ms === null || ms === undefined) return "Unassigned";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours === 0 && mins === 0) return "< 1m";
    return `${hours}h ${mins}m`;
  };

  return {
    ...t,
    id: t.id || t._id || t.ticketId || "N/A",
    ticketId: t.ticketId || t.id || t._id || "N/A",
    title: t.title || t.subject || t.name || "Untitled Ticket",
    assignee: assigneeName,
    assigneeName,
    subAssignmentName,
    subAssignmentAt: subAssignedAtRaw,
    status,
    createdAt: t.createdAt || t.created_at || new Date().toISOString(),
    priority,
    type,
    category: type,
    sla,
    slaStatus: sla,
    isResolved,
    isSubAssigned: Boolean(subAssignedAtTime) || isSubAssigned,
    assignmentTimeFormatted: formatDuration(assignmentTimeMs),
    slaTimeFormatted: formatDuration(slaTimeMs),
    subAssignmentTimeFormatted: (subAssignedAtTime || isSubAssigned) ? formatDuration(subAssignmentTimeMs) : "Not Sub-Assigned",
    finalResolutionTimeFormatted: isResolved ? formatDuration(finalResolutionTimeMs) : "Pending",
  };
};

/**
 * Isolated Pie Chart Component with animations disabled for zero lag and optimal performance.
 */
const OptimizedPieCard = memo(({ title, data }) => (
  <div className="p-4 border border-slate-200/80 rounded-2xl bg-white shadow-sm flex flex-col justify-between h-56">
    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">{title}</h4>
    <div className="h-40 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%" debounce={100}>
        <PieChart>
          <Pie 
            data={data} 
            innerRadius="45%" 
            outerRadius="70%" 
            paddingAngle={4} 
            dataKey="value"
            isAnimationActive={false}
          >
            {data.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
          </Pie>
          <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  </div>
));

export const Dashboard = ({ tickets: propTickets = [] }) => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState(propTickets);
  const [loading, setLoading] = useState(propTickets.length === 0);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (propTickets.length > 0) {
      setTickets(propTickets);
      setLoading(false);
    }
  }, [propTickets]);

  useEffect(() => {
    if (propTickets.length === 0) {
      const fetchTickets = async () => {
        const token = localStorage.getItem('access_token');
        if (!token) {
          setLoading(false);
          return;
        }

        try {
          const response = await axiosInstance.get('/tickets');
          setTickets(Array.isArray(response.data) ? response.data : (response.data?.tickets || response.data?.data || []));
        } catch (error) {
          console.error("Failed to fetch tickets:", error);
          setTickets([]);
        } finally {
          setLoading(false);
        }
      };
      fetchTickets();
    }
  }, [propTickets.length]);

  const normalizedTickets = useMemo(() => tickets.map((t) => normalizeTicket(t, now)), [tickets, now]);

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
      if (!t.createdAt) return false;
      const ticketDate = new Date(t.createdAt);
      return ticketDate >= oneMonthAgo && ticketDate <= currentDate;
    });

    if (recentTickets.length === 0) {
      alert("No ticket data found within the last 1 month to export.");
      return;
    }

    const headers = [
      "Ticket ID", "Title", "Type", "Priority", "Assignee", "Sub-Assignee", "SLA Status", "Ticket Status", 
      "Assignment Time", "SLA / Ongoing Time", "Sub-Assignment Time", "Final Resolution Time", "Created At"
    ];

    const csvRows = recentTickets.map((t) => {
      const formattedDate = t.createdAt ? new Date(t.createdAt).toLocaleString() : "";
      return [
        `"${(t.ticketId || "").toString().replace(/"/g, '""')}"`,
        `"${(t.title || "").replace(/"/g, '""')}"`,
        `"${(t.type || "").replace(/"/g, '""')}"`,
        `"${(t.priority || "").replace(/"/g, '""')}"`,
        `"${(t.assignee || "").replace(/"/g, '""')}"`,
        `"${(t.subAssignmentName || "").replace(/"/g, '""')}"`,
        `"${(t.sla || "").replace(/"/g, '""')}"`,
        `"${(t.status || "").replace(/"/g, '""')}"`,
        `"${t.assignmentTimeFormatted}"`,
        `"${t.slaTimeFormatted}"`,
        `"${t.subAssignmentTimeFormatted}"`,
        `"${t.finalResolutionTimeFormatted}"`,
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
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer"
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
            <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
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
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
              <BarChart data={chartData.priority} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <OptimizedPieCard title="Ticket Type Split" data={chartData.type} />
        <OptimizedPieCard title="SLA Health" data={chartData.sla} />

        <div className="p-4 border border-slate-200/80 rounded-2xl bg-white shadow-sm flex flex-col justify-between h-56">
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">7-Day Velocity</h4>
          <div className="h-40 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
              <LineChart data={chartData.trend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                <Line type="monotone" dataKey="tickets" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Unified Ticket List Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/40">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ticket Lifecycle & Timeline Matrix</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                {normalizedTickets.length} Records
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Tracking initial assignment delay, ongoing SLA duration, sub-assignment execution, and final resolution time.</p>
          </div>
          <Link to="/tickets" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 transition-colors">
            View All Work <ArrowRight size={14} />
          </Link>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 border-collapse min-w-[1100px]">
            <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 uppercase text-[10px] tracking-wider font-bold">
              <tr>
                <th className="p-4">Ticket ID</th>
                <th className="p-4">Entry</th>
                <th className="p-4">Title / Assignee</th>
                <th className="p-4">Assignment Time</th>
                <th className="p-4">SLA / Ongoing Time</th>
                <th className="p-4">Sub-Assignment</th>
                <th className="p-4">Sub-Assignment Time</th>
                <th className="p-4">SLA Health</th>
                <th className="p-4">Status & Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {normalizedTickets.slice(0, 5).map((t, index) => (
                <tr key={t.id || index} className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-4 font-bold text-blue-600 whitespace-nowrap">
                    <div>{t.id.toString().substring(0, 10)}</div>
                    <span className="text-[10px] font-normal text-slate-400 uppercase">{t.type}</span>
                  </td>
                  <td className="p-4 text-slate-500 whitespace-nowrap text-xs">{formatDate(t.createdAt)}</td>
                  <td className="p-4">
                    <div className="font-semibold text-slate-900 max-w-[200px] truncate">{t.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Assignee: {t.assignee}</div>
                  </td>
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
                  <td className="p-4 text-xs whitespace-nowrap">
                    <div className="font-semibold text-slate-700">{t.subAssignmentName || "—"}</div>
                    {t.subAssignmentAt && (
                      <div className="text-[10px] text-slate-400 mt-0.5">{formatDate(t.subAssignmentAt)}</div>
                    )}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      t.subAssignmentTimeFormatted !== "Not Sub-Assigned" ? "bg-purple-50 text-purple-700 border border-purple-100" : "bg-slate-50 text-slate-400 italic"
                    }`}>
                      {t.subAssignmentTimeFormatted}
                    </span>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                      t.sla === "Breached" ? "bg-rose-100 text-rose-700 border border-rose-200" : 
                      t.sla === "Due Soon" ? "bg-amber-100 text-amber-700 border border-amber-200" : 
                      "bg-emerald-100 text-emerald-700 border border-emerald-200"
                    }`}>
                      {t.sla}
                    </span>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`px-3 py-1 font-bold uppercase rounded-full text-[10px] tracking-wider shadow-2xs ${
                        t.isResolved ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
                      }`}>
                        {t.status}
                      </span>
                      <span className={`text-[11px] font-medium ${t.isResolved ? "text-emerald-700 font-bold" : "text-slate-400 italic"}`}>
                        Total: {t.finalResolutionTimeFormatted}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {normalizedTickets.length === 0 && (
                <tr>
                  <td colSpan="9" className="p-16 text-center text-sm text-slate-400 italic">
                    No tickets available to display within the current matrix parameters.
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