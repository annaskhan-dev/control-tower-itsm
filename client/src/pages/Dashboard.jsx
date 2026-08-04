import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import axiosInstance from '../api/axiosInstance';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";
import { Ticket, AlertTriangle, UserX, Clock, ArrowRight, Loader2, Download } from "lucide-react";

/**
 * Normalization Helper
 */
const normalizeTicket = (t, now) => {
  let rawAssignee = t.assignee || t.assignedTo || t.assigned_to || "Unassigned";
  if (typeof rawAssignee === "object" && rawAssignee !== null) {
    rawAssignee = rawAssignee.name || rawAssignee.fullName || rawAssignee.email || "Unassigned";
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

  return {
    ...t,
    id: t.id || t._id || t.ticketId || "N/A",
    title: t.title || t.subject || t.name || "Untitled Ticket",
    assignee: typeof rawAssignee === "string" ? rawAssignee : "Unassigned",
    status: (t.status || t.ticketStatus || "new").toString().toLowerCase().replace(/_/g, " "),
    createdAt: t.createdAt || t.created_at || new Date().toISOString(),
    priority,
    type,
    sla,
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
          setTickets(Array.isArray(response.data) ? response.data : []);
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

  // Function to filter last 1 month and export tickets to Excel (CSV format)
  const handleExportExcel = () => {
    const currentDate = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(currentDate.getMonth() - 1);

    // Filter tickets created within the last 1 month
    const recentTickets = normalizedTickets.filter((t) => {
      if (!t.createdAt) return false;
      const ticketDate = new Date(t.createdAt);
      return ticketDate >= oneMonthAgo && ticketDate <= currentDate;
    });

    if (recentTickets.length === 0) {
      alert("No ticket data found within the last 1 month to export.");
      return;
    }

    // Define CSV headers
    const headers = ["Ticket ID", "Title", "Type", "Priority", "Assignee", "SLA", "Status", "Created At"];

    // Map ticket data to CSV rows
    const csvRows = recentTickets.map((t) => {
      const formattedDate = t.createdAt ? new Date(t.createdAt).toLocaleString() : "";
      const ticketId = `"${(t.id || "").toString().replace(/"/g, '""')}"`;
      const title = `"${(t.title || "").replace(/"/g, '""')}"`;
      const type = `"${(t.type || "").replace(/"/g, '""')}"`;
      const priority = `"${(t.priority || "").replace(/"/g, '""')}"`;
      const assignee = `"${(t.assignee || "").replace(/"/g, '""')}"`;
      const sla = `"${(t.sla || "").replace(/"/g, '""')}"`;
      const status = `"${(t.status || "").replace(/"/g, '""')}"`;
      const createdAt = `"${formattedDate}"`;

      return [ticketId, title, type, priority, assignee, sla, status, createdAt].join(",");
    });

    // Combine headers and rows
    const csvContent = [headers.join(","), ...csvRows].join("\n");

    // Create a downloadable blob and trigger file download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `tickets_last_1_month_${currentDate.toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = useMemo(() => ({
    total: normalizedTickets.length,
    open: normalizedTickets.filter((t) => !["closed", "resolved"].includes(t.status)).length,
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
      tickets: normalizedTickets.filter((t) => new Date(t.createdAt).toDateString() === day.fullDate).length,
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
          <p className="text-sm text-slate-500 mt-1">Real-time ticketing analytics and SLA monitoring</p>
        </div>
        <button
          onClick={handleExportExcel}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2"
        >
          <Download size={16} /> Export Last 1 Month to Excel
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

      {/* Recent Tickets Table */}
      <div className="p-5 border border-slate-200/80 rounded-2xl bg-white shadow-sm">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Recent Tickets</h4>
          <Link to="/tickets" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
            View All Work <ArrowRight size={14} />
          </Link>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100">
                <th className="py-3 px-3">Ticket ID</th>
                <th className="py-3 px-3">Title</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Priority</th>
                <th className="py-3 px-3">Assignee</th>
                <th className="py-3 px-3">SLA</th>
                <th className="py-3 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {normalizedTickets.slice(0, 5).map((t, index) => (
                <tr key={t.id || index} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 font-bold text-blue-600">{t.id.toString().substring(0, 10)}</td>
                  <td className="py-3 px-3 font-semibold text-slate-800">{t.title}</td>
                  <td className="py-3 px-3 text-slate-500">{t.type}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${t.priority === "Critical" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="py-3 px-3">{t.assignee}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${t.sla === "Breached" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {t.sla}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right uppercase font-bold text-slate-500 text-[11px]">{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};