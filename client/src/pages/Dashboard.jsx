import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import axiosInstance from '../api/axiosInstance';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";
import { Ticket, AlertTriangle, UserX, Clock, ArrowRight, Loader2 } from "lucide-react";

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

  // FIXED: Fetching Logic with Auth Gatekeeper
  useEffect(() => {
    if (propTickets.length === 0) {
      const fetchTickets = async () => {
        // 1. GATEKEEPER: Check if a token actually exists before requesting
        const token = localStorage.getItem('access_token');
        if (!token) {
          setLoading(false);
          return; // Stop execution if not logged in
        }

        try {
          // 2. PATH FIX: Using '/tickets'. Since your axiosInstance baseURL
          // is '.../api', this avoids the double '/api/api' error.
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

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="h-full w-full flex flex-col justify-between overflow-hidden font-sans text-slate-800 p-0.5">
      {/* ... [Rest of your UI code remains exactly the same] ... */}
      <div className="shrink-0 flex justify-between items-center mb-1">
        <div>
          <h2 className="text-xl font-bold text-[#13203B] tracking-tight leading-none">Operational Dashboard</h2>
          <p className="text-[11px] text-slate-500 font-medium mt-1">Real-time ticketing analytics and SLA monitoring</p>
        </div>
      </div>
      {/* Grid items and table remain unchanged */}
      <div className="grid grid-cols-4 gap-2.5 shrink-0">
         {/* ... mapped stats items ... */}
         {[
          { label: "Total Tickets", val: stats.total, icon: Ticket, color: "blue", route: "/tickets?queue=all" },
          { label: "Open Work", val: stats.open, icon: Clock, color: "indigo", route: "/tickets?queue=all" },
          { label: "Unassigned", val: stats.unassigned, icon: UserX, color: "amber", route: "/tickets?queue=unassigned" },
          { label: "SLA Risk", val: stats.slaRisk, icon: AlertTriangle, color: "rose", route: "/tickets?queue=sla-risk" },
        ].map((item) => (
          <div key={item.label} onClick={() => navigate(item.route)} className="p-2.5 bg-white border border-slate-200/90 rounded-xl flex items-center justify-between shadow-2xs cursor-pointer hover:border-blue-300 transition-all">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
              <h3 className={`text-base font-bold ${item.color === 'rose' ? 'text-rose-600' : 'text-slate-800'} mt-0.5`}>{item.val}</h3>
            </div>
            <div className={`p-1.5 bg-${item.color}-50 text-${item.color}-600 rounded-lg`}><item.icon size={16} /></div>
          </div>
        ))}
      </div>
      {/* ... [Rest of your return statement continues as normal] ... */}
      <div className="grid grid-cols-4 gap-2.5 shrink-0 my-1">
        <div className="p-2 border border-slate-200/90 rounded-xl bg-white flex flex-col justify-between">
          <h4 className="text-[11px] font-bold text-slate-800">Priority Distribution</h4>
          <div className="h-[90px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData.priority} margin={{ top: 5, left: -30 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" stroke="#94a3b8" fontSize={8} tickLine={false} /><YAxis stroke="#94a3b8" fontSize={8} tickLine={false} /><Tooltip contentStyle={{ fontSize: "10px", borderRadius: "6px" }} /><Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </div>
        <div className="p-2 border border-slate-200/90 rounded-xl bg-white flex flex-col justify-between">
          <h4 className="text-[11px] font-bold text-slate-800">Ticket Type Split</h4>
          <div className="h-[90px] w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData.type} innerRadius="40%" outerRadius="65%" paddingAngle={3} dataKey="value">{chartData.type.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
        </div>
        <div className="p-2 border border-slate-200/90 rounded-xl bg-white flex flex-col justify-between">
          <h4 className="text-[11px] font-bold text-slate-800">SLA Health</h4>
          <div className="h-[90px] w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData.sla} innerRadius="40%" outerRadius="65%" paddingAngle={3} dataKey="value">{chartData.sla.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
        </div>
        <div className="p-2 border border-slate-200/90 rounded-xl bg-white flex flex-col justify-between">
          <h4 className="text-[11px] font-bold text-slate-800">7-Day Velocity</h4>
          <div className="h-[90px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData.trend} margin={{ top: 5, left: -30 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="day" stroke="#94a3b8" fontSize={8} tickLine={false} /><YAxis stroke="#94a3b8" fontSize={8} tickLine={false} /><Tooltip /><Line type="monotone" dataKey="tickets" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} /></LineChart></ResponsiveContainer></div>
        </div>
      </div>
      <div className="shrink-0 p-1.5 border border-slate-200/80 rounded-xl bg-white shadow-2xs">
        <div className="flex items-center justify-between pb-1.5 mb-1 border-b border-slate-100">
          <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Recent Tickets</h4>
          <Link to="/tickets" className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">View All Work <ArrowRight size={11} /></Link>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100">
                <th className="py-2 px-2 w-[15%]">Ticket ID</th>
                <th className="py-2 px-2 w-[25%]">Title</th>
                <th className="py-2 px-2 w-[10%]">Type</th>
                <th className="py-2 px-2 w-[15%]">Priority</th>
                <th className="py-2 px-2 w-[10%]">Assignee</th>
                <th className="py-2 px-2 w-[10%]">SLA</th>
                <th className="py-2 px-2 w-[15%] text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[9px] font-medium text-slate-700">
              {normalizedTickets.slice(0, 5).map((t, index) => (
                <tr key={t.id || index} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2 px-2 font-bold text-blue-600 truncate">{t.id.toString().substring(0, 10)}</td>
                  <td className="py-2 px-2 font-semibold text-slate-800 truncate">{t.title}</td>
                  <td className="py-2 px-2 text-slate-500 truncate">{t.type}</td>
                  <td className="py-2 px-2"><span className={`px-2 py-0.5 rounded font-bold ${t.priority === "Critical" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{t.priority}</span></td>
                  <td className="py-2 px-2 truncate">{t.assignee}</td>
                  <td className="py-2 px-2"><span className={`px-2 py-0.5 rounded font-bold ${t.sla === "Breached" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>{t.sla}</span></td>
                  <td className="py-2 px-2 text-right uppercase font-bold text-slate-500">{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};