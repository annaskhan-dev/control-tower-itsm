import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTickets } from "../context/TicketContext";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement,
  Filler
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement,
  Filler
);

export const Dashboard = ({ onOpenCreateTicket }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [now, setNow] = useState(new Date());
  const [operators, setOperators] = useState([]);
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState("all");
  const [trendDays, setTrendDays] = useState(30);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);
  
  const { tickets, fetchTickets, updateTicket, isLoading } = useTickets();
  const { user, isAdmin, isManager, role } = useAuth();
  
  const userRoleRaw = role || user?.role || user?.userType || user?.type || "";
  
  const currentRole = useMemo(() => {
    return typeof userRoleRaw === 'string' ? userRoleRaw.replace(/\s+/g, "_").toLowerCase() : "";
  }, [userRoleRaw]);
  
  const isUserManagerOrAdmin = useMemo(() => {
    return isAdmin || isManager || currentRole.includes('admin') || currentRole.includes('manager');
  }, [isAdmin, isManager, currentRole]);

  const queue = searchParams.get("queue") || "all-work";

  const fetchedRef = useRef(null);

  useEffect(() => {
    if (fetchedRef.current !== queue) {
      fetchedRef.current = queue;
      fetchTickets(queue);
    }
  }, [queue]);

  useEffect(() => {
    const fetchOperators = async () => {
      try {
        const response = await api.get('/users');
        const allUsers = response.data || [];
        const filteredOps = allUsers.filter(u => {
          const r = (u.role || u.userType || "").replace(/\s+/g, "_").toLowerCase();
          return r.includes('operator') || r.includes('transporter') || !r.includes('admin');
        });
        setOperators(filteredOps);
      } catch (err) {
        console.error("Failed to fetch operators list", err);
      }
    };
    if (isUserManagerOrAdmin) {
      fetchOperators();
    }
  }, [isUserManagerOrAdmin]);

  const handleAssignToMe = useCallback(async (e, mongoId) => {
    e.stopPropagation();
    try {
      const currentUserName = user?.name || user?.username || user?.fullName || "Operator";
      await updateTicket(mongoId, { assignee: currentUserName });
      fetchTickets(queue, true);
    } catch (err) {
      console.error("Failed to assign ticket to self", err);
      alert(err.response?.data?.message || "Failed to assign ticket");
    }
  }, [user, updateTicket, fetchTickets, queue]);

  const handleManagerAssign = useCallback(async (mongoId, selectedOperatorName) => {
    if (!selectedOperatorName) return;
    try {
      await updateTicket(mongoId, { assignee: selectedOperatorName });
      fetchTickets(queue, true);
    } catch (err) {
      console.error("Failed to assign ticket", err);
      alert(err.response?.data?.message || "Failed to assign ticket");
    }
  }, [updateTicket, fetchTickets, queue]);

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const d = new Date(dateString);
    return isNaN(d.getTime()) 
      ? "Invalid" 
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDuration = (ms) => {
    if (ms === null || ms === undefined || isNaN(ms)) return "—";
    if (ms < 60000) return "Just now"; 
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours === 0 && mins === 0) return "Just now";
    return `${hours}h ${mins}m`;
  };

  const ticketData = useMemo(() => {
    if (!tickets) return [];
    
    return tickets.map((t) => {
      const isResolved = ["closed", "resolved", "completed", "done"].includes((t.status || "").toLowerCase());
      const resolvedAtRaw = t.resolvedAt || t.resolved_at || t.closedAt;
      const resolvedAtTime = isResolved ? (resolvedAtRaw ? new Date(resolvedAtRaw).getTime() : now.getTime()) : null;
      const currentOrResolveTime = isResolved ? resolvedAtTime : now.getTime();

      let slaStatus = t.slaStatus || t.sla_status || t.sla || "On Track";
      const deadlineRaw = t.slaDeadline || t.sla_deadline || t.dueDate || t.due_date;
      
      if (deadlineRaw) {
        const deadline = new Date(deadlineRaw);
        if (!isNaN(deadline.getTime())) {
          const evaluationTime = currentOrResolveTime;
          const diffMinutes = (deadline.getTime() - evaluationTime) / (1000 * 60);
          
          if (diffMinutes < 0) {
            slaStatus = "Breached";
          } else if (diffMinutes <= 30 && !isResolved) {
            slaStatus = "At Risk";
          } else if (!isResolved) {
            slaStatus = "On Track";
          }
        }
      }

      let rawAssignee = t.assignee || t.assignedTo || t.assigned_to || "Unassigned";
      if (typeof rawAssignee === "object" && rawAssignee !== null) {
        rawAssignee = rawAssignee.name || rawAssignee.fullName || rawAssignee.email || "Unassigned";
      }
      const assigneeName = typeof rawAssignee === "string" ? rawAssignee : "Unassigned";
      const isAssigned = assigneeName.toLowerCase() !== "unassigned" && assigneeName !== "";
      
      let rawSubAssignee = t.subAssignment || t.sub_assignment || t.subAssignedTo || t.sub_assigned_to || "";
      if (typeof rawSubAssignee === "object" && rawSubAssignee !== null) {
        rawSubAssignee = rawSubAssignee.name || rawSubAssignee.fullName || rawSubAssignee.email || "";
      }
      const subAssignmentName = typeof rawSubAssignee === "string" ? rawSubAssignee.trim() : "";
      const isSubAssigned = subAssignmentName !== "" && subAssignmentName.toLowerCase() !== "unassigned" && subAssignmentName !== null;

      const createdAtTime = new Date(t.createdAt || t.created_at || t.timestamp || now).getTime();
      const assignedAtRaw = t.assignedAt || t.assigned_at || t.assignmentTime;
      const assignedAtTime = assignedAtRaw ? new Date(assignedAtRaw).getTime() : createdAtTime;

      const subAssignedAtRaw = t.subAssignmentAt || t.sub_assigned_at || t.subAssignedAt || t.sub_assignment_at || (isSubAssigned ? (t.updatedAt || t.createdAt) : null);
      const subAssignedAtTime = subAssignedAtRaw ? new Date(subAssignedAtRaw).getTime() : null;

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
      const entrySource = t.generator || t.source || "System / Direct";
      const priority = (t.priority || "Medium").toLowerCase();

      return {
        ...t,
        assigneeName,
        isAssigned,
        subAssignmentName,
        subAssignmentAt: subAssignedAtRaw,
        slaStatus,
        entrySource,
        priority,
        assignmentTimeFormatted: isAssigned ? formatDuration(primaryAssignmentMs) : "Unassigned",
        slaTimeFormatted: isAssigned ? formatDuration(slaTimeMs) : "N/A",
        subAssignmentTimeFormatted: isSubAssigned ? formatDuration(subAssignmentTimeMs) : "Not Sub-Assigned",
        finalResolutionTimeFormatted: isResolved ? formatDuration(finalResolutionTimeMs) : "Pending",
      };
    });
  }, [tickets, now]);

  // Priority metrics counts
  const priorityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, criticalRes: 0, highRes: 0, mediumRes: 0, lowRes: 0 };
    ticketData.forEach(t => {
      const p = t.priority;
      const isRes = ["closed", "resolved", "completed", "done"].includes((t.status || "").toLowerCase());
      if (counts[p] !== undefined) {
        counts[p]++;
        if (isRes) counts[`${p}Res`]++;
      }
    });
    return counts;
  }, [ticketData]);

  const filteredTickets = useMemo(() => {
    return ticketData.filter((t) => {
      if (!isUserManagerOrAdmin) {
        const assigneeLower = t.assigneeName.trim().toLowerCase();
        const subAssigneeLower = t.subAssignmentName.trim().toLowerCase();
        const userName = (user?.name || user?.username || user?.fullName || "").trim().toLowerCase();
        const userEmail = (user?.email || "").split("@")[0].toLowerCase();

        const isAssignedToThem = 
          (userName && assigneeLower.includes(userName)) ||
          (subAssigneeLower && userName && subAssigneeLower.includes(userName)) ||
          (userEmail && assigneeLower.includes(userEmail));

        const isUnassigned = !t.isAssigned;

        if (!isAssignedToThem && !isUnassigned) return false;
      }

      let matchesQueue = true;
      if (queue === "sla-risk") {
        matchesQueue = t.status?.toLowerCase() === "open" && (t.slaStatus === "Breached" || t.slaStatus === "At Risk");
      } else if (queue === "open") {
        matchesQueue = t.status?.toLowerCase() === "open";
      } else if (queue === "unassigned") {
        matchesQueue = !t.isAssigned;
      }

      let matchesPriority = true;
      if (selectedPriorityFilter !== "all") {
        matchesPriority = t.priority === selectedPriorityFilter.toLowerCase();
      }

      const searchStr = searchTerm.toLowerCase();
      return matchesQueue && matchesPriority && (t.title?.toLowerCase().includes(searchStr) || t.ticketId?.toLowerCase().includes(searchStr));
    });
  }, [ticketData, queue, searchTerm, selectedPriorityFilter, isUserManagerOrAdmin, user]);

  // Chart data calculations
  const totalCount = ticketData.length;
  const openCount = ticketData.filter(t => t.status?.toLowerCase() === "open").length;
  const closedCount = ticketData.filter(t => ["closed", "resolved", "completed", "done"].includes(t.status?.toLowerCase())).length;
  const breachedCount = ticketData.filter(t => t.slaStatus === "Breached" || t.slaStatus === "At Risk").length;
  const onTrackCount = totalCount - breachedCount;

  const doughnutData = {
    labels: ['Breached / At Risk', 'On Track'],
    datasets: [{
      data: [breachedCount, Math.max(0, onTrackCount)],
      backgroundColor: ['#f43f5e', '#10b981'],
      borderWidth: 0,
      cutout: '75%',
    }],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
  };

  // Line chart velocity data
  const velocityData = {
    labels: ['Day 1', 'Day 5', 'Day 10', 'Day 15', 'Day 20', 'Day 25', 'Day 30'],
    datasets: [{
      label: 'Ticket Intake',
      data: [4, 7, 3, 8, 5, 9, 6],
      borderColor: '#2563eb',
      backgroundColor: 'rgba(37, 99, 235, 0.08)',
      fill: true,
      tension: 0.35,
      pointRadius: 3,
    }]
  };

  const velocityOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
      x: { grid: { display: false }, ticks: { font: { size: 10 } } }
    }
  };

  return (
    <div className="flex flex-col h-full font-sans bg-slate-50 text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
      {/* Header Bar */}
      <div className="flex justify-between items-center px-8 py-5 bg-white border-b border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Operational Dashboard</h1>
          <p className="text-xs font-medium text-slate-400 mt-0.5">
            Real-time ticketing lifecycle, creator tracking, operator resolution metrics, and SLA health
          </p>
        </div>
        <button 
          onClick={onOpenCreateTicket} 
          className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-all shadow-sm flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          Export to Excel
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex justify-between items-center">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Tickets</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/></svg>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex justify-between items-center">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Open Work</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{openCount}</h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex justify-between items-center">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Assigned</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</h3>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex justify-between items-center">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Closed Tickets</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{closedCount}</h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            </div>
          </div>
        </div>

        {/* Top Summary Cards Grid including SLA Health Graph */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Tickets Created by Role / Source */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span> Tickets Created By Role / Source
              </h4>
              <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">Total: {totalCount}</span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-700">Operator</span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">6 tickets</span>
              </div>
              <div className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-700">Shipper Ops</span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">5 tickets</span>
              </div>
              <div className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-700">Transporter</span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">4 tickets</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 italic mt-4">Breakdown tracked across roles and operational parameters.</p>
          </div>

          {/* Resolved Tickets By Operator */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Resolved Tickets By Operator
              </h4>
              <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">Total: {closedCount}</span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-700">Operator</span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">6 resolved</span>
              </div>
              <div className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-700">Shipper Ops</span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">1 resolved</span>
              </div>
              <div className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-700">Transporter</span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">1 resolved</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 italic mt-4">Breakdown tracked across roles and operational parameters.</p>
          </div>

          {/* SLA Health Distribution (Graph made a little shorter) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span> SLA Health Distribution
              </h4>
              <span className="text-[11px] font-semibold bg-rose-50 text-rose-700 px-2 py-0.5 rounded">Risk: {breachedCount}</span>
            </div>
            <div className="relative h-32 flex items-center justify-center my-1">
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
            <div className="flex justify-center gap-4 text-[11px] font-medium text-slate-600 mt-1">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Breached</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> On Track</span>
            </div>
            <p className="text-[10px] text-slate-400 italic mt-3 text-center">Proportional breakdown of active and resolved SLAs.</p>
          </div>
        </div>

        {/* Priority Breakdown & Filters (Placed right below the graph row) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Priority Breakdown & Filters:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedPriorityFilter("all")}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                selectedPriorityFilter === "all" 
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              All Priorities <span className={`text-[10px] px-1.5 py-0.2 rounded ${selectedPriorityFilter === "all" ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-700"}`}>{totalCount}</span>
            </button>
            <button
              onClick={() => setSelectedPriorityFilter("critical")}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                selectedPriorityFilter === "critical" 
                  ? "bg-rose-600 text-white border-rose-600 shadow-sm" 
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Critical <span className={`text-[10px] px-1.5 py-0.2 rounded ${selectedPriorityFilter === "critical" ? "bg-rose-700 text-white" : "bg-slate-200 text-slate-700"}`}>{priorityCounts.critical} ({priorityCounts.criticalRes} res)</span>
            </button>
            <button
              onClick={() => setSelectedPriorityFilter("high")}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                selectedPriorityFilter === "high" 
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              High <span className={`text-[10px] px-1.5 py-0.2 rounded ${selectedPriorityFilter === "high" ? "bg-slate-700 text-white" : "bg-slate-200 text-slate-700"}`}>{priorityCounts.high} ({priorityCounts.highRes} res)</span>
            </button>
            <button
              onClick={() => setSelectedPriorityFilter("medium")}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                selectedPriorityFilter === "medium" 
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm" 
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Medium <span className={`text-[10px] px-1.5 py-0.2 rounded ${selectedPriorityFilter === "medium" ? "bg-blue-700 text-white" : "bg-slate-200 text-slate-700"}`}>{priorityCounts.medium} ({priorityCounts.mediumRes} res)</span>
            </button>
            <button
              onClick={() => setSelectedPriorityFilter("low")}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                selectedPriorityFilter === "low" 
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm" 
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Low <span className={`text-[10px] px-1.5 py-0.2 rounded ${selectedPriorityFilter === "low" ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-700"}`}>{priorityCounts.low} ({priorityCounts.lowRes} res)</span>
            </button>
          </div>
        </div>

        {/* Ticket Intake Velocity Trend Chart Section */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ticket Intake Velocity Trend</h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">View Days (1–30):</span>
              <select 
                value={trendDays} 
                onChange={(e) => setTrendDays(Number(e.target.value))}
                className="text-xs py-1 px-2 border border-slate-200 rounded-lg bg-white text-slate-700 outline-none"
              >
                <option value={7}>7 Days</option>
                <option value={15}>15 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </div>
          </div>
          <div className="h-44 w-full">
            <Line data={velocityData} options={velocityOptions} />
          </div>
        </div>

        {/* Search & Toolbar matching Ticket Management Pattern */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/75 border-b border-slate-200 flex items-center justify-between gap-4">
            <div className="relative w-full max-w-sm">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </span>
              <input
                type="text"
                placeholder="Search dashboard tickets by ID or Title..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-2xs placeholder:text-slate-400 text-slate-800"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="text-xs font-medium text-slate-500 whitespace-nowrap">
              Showing <span className="font-semibold text-slate-800">{filteredTickets.length}</span> tickets
            </div>
          </div>

          {/* Table matching Ticket Management View Pattern */}
          {isLoading ? (
            <div className="p-16 text-center text-xs font-medium text-slate-400 animate-pulse flex flex-col items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              Loading dashboard tickets database...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-400 italic flex flex-col items-center gap-2">
              <svg className="w-9 h-9 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7m16 0v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5m16 0h-2.586a1 1 0 0 0-.707.293l-2.414 2.414a1 1 0 0 1-.707.293h-3.172a1 1 0 0 1-.707-.293l-2.414-2.414A1 1 0 0 0 6.586 13H4"/></svg>
              No tickets found matching the selected priority/filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 border-collapse min-w-[1100px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">ID</th>
                    <th className="py-3.5 px-4 font-semibold">Entry Source</th>
                    <th className="py-3.5 px-4 font-semibold">Created Date</th>
                    <th className="py-3.5 px-4 font-semibold">Title</th>
                    <th className="py-3.5 px-4 font-semibold">Priority</th>
                    <th className="py-3.5 px-4 font-semibold">Category</th>
                    <th className="py-3.5 px-4 font-semibold">Assignee</th>
                    <th className="py-3.5 px-4 font-semibold">Assignment Time</th>
                    <th className="py-3.5 px-4 font-semibold">SLA Active Time</th>
                    <th className="py-3.5 px-4 font-semibold">Sub-Assignment</th>
                    <th className="py-3.5 px-4 font-semibold">Sub-Assignee Time</th>
                    <th className="py-3.5 px-4 font-semibold">SLA Health</th>
                    <th className="py-3.5 px-4 font-semibold">Status & Resolution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTickets.map((t) => {
                    const mongoId = t._id || t.id;
                    const isResolvedState = ["closed", "resolved", "completed", "done"].includes((t.status || "").toLowerCase());
                    const isRestricted = !isUserManagerOrAdmin;

                    return (
                      <tr 
                        key={mongoId} 
                        onClick={() => navigate(`/tickets/${t.ticketId}`)} 
                        className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                      >
                        <td className="py-3.5 px-4 font-semibold text-blue-600 group-hover:text-blue-700 whitespace-nowrap">{t.ticketId}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-[11px]">
                            {t.entrySource}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{formatDate(t.createdAt)}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-900 max-w-[200px] truncate" title={t.title}>{t.title}</td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                            t.priority === 'critical' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                            t.priority === 'high' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            t.priority === 'low' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{t.category || "—"}</td>
                        
                        <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {t.isAssigned ? (
                            <span className="text-slate-800 font-medium">{t.assigneeName}</span>
                          ) : !isUserManagerOrAdmin ? (
                            <button
                              onClick={(e) => handleAssignToMe(e, mongoId)}
                              className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[11px] px-2.5 py-1 rounded-md font-medium transition-all shadow-2xs cursor-pointer"
                            >
                              Assign to Me
                            </button>
                          ) : (
                            <div className="relative">
                              <select
                                value={t.assignee || t.assignedTo || "Unassigned"}
                                disabled={isRestricted || isResolvedState}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleManagerAssign(mongoId, e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full py-1 px-2 border border-slate-200 rounded-md text-[11px] bg-white text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                              >
                                <option value="Unassigned">Assign to Operator...</option>
                                {operators.map((u) => {
                                  const userName = u.name || u.fullName || u.username;
                                  const userRole = u.role || u.userType || 'Operator';
                                  return (
                                    <option key={u._id || u.id} value={userName}>
                                      {userName} ({userRole})
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-md font-medium ${
                            t.assignmentTimeFormatted !== "Unassigned" ? "bg-slate-100 text-slate-700 border border-slate-200/60" : "bg-slate-50 text-slate-400 italic"
                          }`}>
                            {t.assignmentTimeFormatted}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-md font-medium ${
                            t.slaTimeFormatted !== "N/A" ? "bg-blue-50 text-blue-700 border border-blue-100/80" : "bg-slate-50 text-slate-400 italic"
                          }`}>
                            {t.slaTimeFormatted}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-medium text-slate-700">{t.subAssignmentName || "—"}</div>
                          {t.subAssignmentAt && (
                            <div className="text-[10px] text-slate-400 mt-0.5">{formatDate(t.subAssignmentAt)}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-md font-medium ${
                            t.subAssignmentTimeFormatted !== "Not Sub-Assigned" ? "bg-purple-50 text-purple-700 border border-purple-100/80" : "bg-slate-50 text-slate-400 italic"
                          }`}>
                            {t.subAssignmentTimeFormatted}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                            t.slaStatus === "Breached" ? "bg-rose-50 text-rose-700 border border-rose-200" : 
                            t.slaStatus === "At Risk" ? "bg-amber-50 text-amber-700 border border-amber-200" : 
                            "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}>
                            {t.slaStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`px-2.5 py-0.5 font-bold uppercase rounded-md text-[10px] tracking-wider shadow-2xs ${
                              t.status?.toLowerCase() === "resolved" || t.status?.toLowerCase() === "closed" ? "bg-emerald-600 text-white" :
                              "bg-blue-600 text-white"
                            }`}>
                              {t.status || "Open"}
                            </span>
                            <span className={`text-[10px] font-medium ${t.status?.toLowerCase() === "resolved" || t.status?.toLowerCase() === "closed" ? "text-emerald-700 font-semibold" : "text-slate-400 italic"}`}>
                              Total: {t.finalResolutionTimeFormatted}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};