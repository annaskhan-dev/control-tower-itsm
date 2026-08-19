import React, { useState, useEffect, useMemo } from "react";
import axiosInstance from "../api/axiosInstance";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, PieChart, Pie, Cell
} from "recharts";
import { 
  BarChart3, CheckCircle2, Clock, Users, Ticket, 
  AlertCircle, Loader2, Award, Calendar 
} from "lucide-react";

import { Analytics } from './components/Analytics';
/**
 * Custom Tooltip for Recharts
 */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 text-white text-xs px-3 py-2 rounded-xl shadow-xl border border-slate-700">
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
};

export const Analytics = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch real database data on component mount using your axios instance
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        const response = await axiosInstance.get('/tickets');
        const data = Array.isArray(response.data) ? response.data : (response.data?.tickets || response.data?.data || []);
        setTickets(data);
      } catch (error) {
        console.error("Failed to fetch analytics tickets:", error);
        setTickets([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalyticsData();
  }, []);

  // 2. Normalize database tickets to cleanly extract Creators, Assignees, Statuses, and Dates
  const normalizedTickets = useMemo(() => {
    return tickets.map((t) => {
      let rawCreator = t.creator || t.createdBy || t.raisedBy || t.author || t.role || "Unspecified";
      if (typeof rawCreator === "object" && rawCreator !== null) {
        rawCreator = rawCreator.role || rawCreator.name || rawCreator.fullName || "Unspecified";
      }
      const creatorName = typeof rawCreator === "string" ? rawCreator.trim() : "Unspecified";

      let rawAssignee = t.assignee || t.assignedTo || t.assigned_to || "Unassigned";
      if (typeof rawAssignee === "object" && rawAssignee !== null) {
        rawAssignee = rawAssignee.name || rawAssignee.fullName || "Unassigned";
      }
      const assigneeName = typeof rawAssignee === "string" ? rawAssignee.trim() : "Unassigned";

      const status = (t.status || t.ticketStatus || "open").toString().toLowerCase();
      const isResolved = ["closed", "resolved", "completed", "done"].includes(status);

      return {
        ...t,
        creatorName,
        assigneeName,
        status: status.charAt(0).toUpperCase() + status.slice(1),
        isResolved,
        createdAt: t.createdAt || t.created_at || new Date().toISOString(),
      };
    });
  }, [tickets]);

  // 3. Compute 30-Day Creation Trend Data
  const thirtyDayTrend = useMemo(() => {
    const daysMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      daysMap[dateString] = 0;
    }

    normalizedTickets.forEach((t) => {
      const ticketDate = new Date(t.createdAt);
      if (!isNaN(ticketDate.getTime())) {
        const dateString = ticketDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (daysMap[dateString] !== undefined) {
          daysMap[dateString] += 1;
        }
      }
    });

    return Object.keys(daysMap).map((date) => ({
      date,
      ticketsCreated: daysMap[date],
    }));
  }, [normalizedTickets]);

  // 4. Compute Creator Breakdown (e.g., 30 by operator, 20 by sales)
  const creatorBreakdown = useMemo(() => {
    const counts = {};
    normalizedTickets.forEach((t) => {
      const creator = t.creatorName || "Unspecified";
      counts[creator] = (counts[creator] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [normalizedTickets]);

  // 5. Compute Status Breakdown (Resolved, Closed, Open, etc.)
  const statusBreakdown = useMemo(() => {
    const counts = {};
    normalizedTickets.forEach((t) => {
      const status = t.status || "Open";
      counts[status] = (counts[status] || 0) + 1;
    });

    const colors = {
      Resolved: "#10b981",
      Closed: "#64748b",
      Open: "#3b82f6",
      Pending: "#f59e0b",
      InProgress: "#8b5cf6"
    };

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: colors[name] || "#3b82f6"
    }));
  }, [normalizedTickets]);

  // 6. Compute Operator Resolution Performance Leaderboard
  const operatorResolutions = useMemo(() => {
    const stats = {};
    normalizedTickets.forEach((t) => {
      const op = t.assigneeName && t.assigneeName.toLowerCase() !== "unassigned" ? t.assigneeName : "Unassigned / System";
      if (!stats[op]) stats[op] = { totalAssigned: 0, resolvedCount: 0 };
      stats[op].totalAssigned += 1;
      if (t.isResolved) {
        stats[op].resolvedCount += 1;
      }
    });

    return Object.entries(stats)
      .map(([operator, data]) => ({
        operator,
        resolvedCount: data.resolvedCount,
        totalAssigned: data.totalAssigned,
        resolutionRate: data.totalAssigned > 0 ? Math.round((data.resolvedCount / data.totalAssigned) * 100) : 0
      }))
      .sort((a, b) => b.resolvedCount - a.resolvedCount);
  }, [normalizedTickets]);

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 font-sans text-slate-800 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="text-blue-600" size={28} /> Advanced Analytics & Reports
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time telemetry showing 30-day ticket creation volumes, role creator metrics, and operator performance outputs.
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-100 text-blue-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
          <Calendar size={14} /> Live Database Sync Active
        </div>
      </div>

      {/* SECTION A: 30-Day Ticket Creation Trend Chart */}
      <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">30-Day Ticket Creation Volume</h3>
            <p className="text-xs text-slate-500 mt-0.5">Daily breakdown of inbound tickets generated over the last month</p>
          </div>
          <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-lg">
            Total Records: {normalizedTickets.length}
          </span>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={thirtyDayTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="ticketsCreated" 
                name="Tickets Created" 
                stroke="#3b82f6" 
                strokeWidth={3} 
                dot={{ r: 3, fill: '#3b82f6' }} 
                activeDot={{ r: 6, fill: '#1d4ed8' }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION B: Creator Breakdown & Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Creator Breakdown Card */}
        <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Users size={16} className="text-indigo-600" /> Tickets Created By User / Role
              </h3>
              <span className="text-xs text-slate-400 font-medium">Volume Breakdown</span>
            </div>
            
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {creatorBreakdown.map((item, idx) => {
                const percentage = normalizedTickets.length > 0 ? Math.round((item.count / normalizedTickets.length) * 100) : 0;
                return (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                      <span className="capitalize">{item.name}</span>
                      <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md font-bold">
                        {item.count} tickets ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
              {creatorBreakdown.length === 0 && (
                <p className="text-xs text-slate-400 italic text-center py-8">No creator data found.</p>
              )}
            </div>
          </div>
        </div>

        {/* Status Distribution Card */}
        <div className="p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" /> Ticket Status Breakdown
              </h3>
              <span className="text-xs text-slate-400 font-medium">Resolution States</span>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusBreakdown} innerRadius="50%" outerRadius="80%" paddingAngle={5} dataKey="value">
                    {statusBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-4 border-t border-slate-100 text-xs">
            {statusBreakdown.map((statusItem, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: statusItem.color }} />
                <div className="truncate">
                  <p className="text-slate-500 text-[10px] truncate">{statusItem.name}</p>
                  <p className="font-bold text-slate-800">{statusItem.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* SECTION C: Operator Resolution Performance Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Award size={16} className="text-amber-500" /> Operator Resolution Leaderboard
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Tracking closed/resolved numbers and clearance success rates for each operator</p>
          </div>
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-100">
            Real-time Metrics
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-6">Operator Name</th>
                <th className="py-3 px-6">Tickets Resolved Successfully</th>
                <th className="py-3 px-6">Total Assigned Work</th>
                <th className="py-3 px-6">Resolution Success Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {operatorResolutions.map((op, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-4 px-6 font-bold text-slate-900 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                      {op.operator.charAt(0).toUpperCase()}
                    </div>
                    {op.operator}
                  </td>
                  <td className="py-4 px-6 font-bold text-emerald-600 text-sm">
                    {op.resolvedCount} <span className="text-xs text-slate-400 font-normal">resolved</span>
                  </td>
                  <td className="py-4 px-6 font-medium text-slate-600">
                    {op.totalAssigned} assigned
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-28 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${op.resolutionRate}%` }} />
                      </div>
                      <span className="font-bold text-slate-700">{op.resolutionRate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {operatorResolutions.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-12 text-center text-slate-400 italic">
                    No operator resolution records found.
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