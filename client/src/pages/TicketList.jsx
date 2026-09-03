import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTickets } from "../context/TicketContext";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

export const TicketList = ({ onOpenCreateTicket }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [now, setNow] = useState(new Date());
  const [operators, setOperators] = useState([]);
  const [selectedPriority, setSelectedPriority] = useState("all");

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

  const isOperatorOnly = useMemo(() => {
    return currentRole.includes('operator') && 
           !currentRole.includes('shipper') && 
           !currentRole.includes('sales') && 
           !currentRole.includes('transporter');
  }, [currentRole]);

  const queue = searchParams.get("queue") || "all-work";
  const fetchedRef = useRef(null);

  useEffect(() => {
    if (fetchedRef.current !== queue) {
      fetchedRef.current = queue;
      fetchTickets(queue);
    }
  }, [queue, fetchTickets]);

  useEffect(() => {
    const fetchOperators = async () => {
      try {
        const response = await api.get('/users');
        const allUsers = response.data || [];
        const filteredOps = allUsers.filter(u => {
          const r = (u.role || u.userType || u.type || "").replace(/\s+/g, "_").toLowerCase();
          const isShipper = r.includes('shipper');
          const isTransporter = r.includes('transporter');
          const isSales = r.includes('sales');
          const isCustomer = r.includes('customer');
          
          const isValidRole = r.includes('admin') || r.includes('manager') || r.includes('operator');
          
          return isValidRole && !isShipper && !isTransporter && !isSales && !isCustomer;
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
      await updateTicket(mongoId, { 
        assignee: currentUserName,
        assignedAt: new Date().toISOString()
      });
      fetchTickets(queue, true);
    } catch (err) {
      console.error("Failed to assign ticket to self", err);
      alert(err.response?.data?.message || "Failed to assign ticket");
    }
  }, [user, updateTicket, fetchTickets, queue]);

  const handleManagerAssign = useCallback(async (mongoId, selectedOperatorName) => {
    if (!selectedOperatorName) return;
    try {
      const payload = {
        assignee: selectedOperatorName,
        assignedAt: selectedOperatorName === "Unassigned" ? null : new Date().toISOString()
      };
      await updateTicket(mongoId, payload);
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
      ? "—" 
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDuration = useCallback((ms) => {
    if (ms === null || ms === undefined || isNaN(ms)) return "—";
    if (ms < 60000) return "Just now";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours === 0 && mins === 0) return "Just now";
    return `${hours}h ${mins}m`;
  }, []);

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
          const diffMinutes = (deadline.getTime() - currentOrResolveTime) / (1000 * 60);
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

      const subAssignmentFallbackTime = t.subAssignmentAt 
        ? new Date(t.subAssignmentAt).getTime() 
        : (isSubAssigned ? new Date(t.updatedAt || t.createdAt || Date.now()).getTime() : null);

      let primaryAssignmentMs = 0;
      let primaryStartFormatted = isAssigned ? formatDate(assignedAtRaw || t.createdAt) : "—";
      let primaryEndFormatted = isAssigned ? (isResolved ? "Resolved" : "Active") : "—";

      if (isAssigned) {
        const primaryEndTime = (isSubAssigned && subAssignmentFallbackTime) ? subAssignmentFallbackTime : currentOrResolveTime;
        primaryAssignmentMs = Math.max(0, primaryEndTime - assignedAtTime);
        if (isSubAssigned && subAssignmentFallbackTime) {
          primaryEndFormatted = formatDate(subAssignedAtRaw || t.subAssignmentAt || t.updatedAt);
        } else if (isResolved) {
          primaryEndFormatted = formatDate(resolvedAtRaw);
        }
      }

      const slaTimeMs = isAssigned ? Math.max(0, currentOrResolveTime - assignedAtTime) : 0;

      let subAssignmentTimeMs = 0;
      let subStartFormatted = "—";
      let subEndFormatted = "—";

      if (isSubAssigned && subAssignedAtTime) {
        subAssignmentTimeMs = Math.max(0, currentOrResolveTime - subAssignedAtTime);
        subStartFormatted = formatDate(subAssignedAtRaw);
        subEndFormatted = isResolved ? formatDate(resolvedAtRaw) : "Active";
      }

      const finalResolutionTimeMs = isResolved ? Math.max(0, resolvedAtTime - createdAtTime) : null;
      const entrySource = t.generator || t.source || "System / Direct";
      const priority = (t.priority || "medium").toLowerCase();
      const issueType = t.issueType || t.type || t.category || "General";
      const category = t.category || t.department || t.serviceArea || "General";

      return {
        ...t,
        assigneeName,
        isAssigned,
        subAssignmentName,
        slaStatus,
        entrySource,
        priority,
        issueType,
        category,
        isResolved,
        primaryStartFormatted,
        primaryEndFormatted,
        primaryAssignmentTimeFormatted: isAssigned ? formatDuration(primaryAssignmentMs) : "—",
        slaTimeFormatted: isAssigned ? formatDuration(slaTimeMs) : "—",
        subStartFormatted,
        subEndFormatted,
        subAssignmentTimeFormatted: isSubAssigned ? formatDuration(subAssignmentTimeMs) : "—",
        finalResolutionTimeFormatted: isResolved ? formatDuration(finalResolutionTimeMs) : "Pending",
      };
    });
  }, [tickets, now, formatDuration]);

  const priorityCounts = useMemo(() => {
    const base = ticketData.filter((t) => {
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

      if (queue === "sla-risk") {
        return t.status?.toLowerCase() === "open" && (t.slaStatus === "Breached" || t.slaStatus === "At Risk");
      } else if (queue === "open") {
        return t.status?.toLowerCase() === "open";
      } else if (queue === "unassigned") {
        return !t.isAssigned;
      } else if (queue === "assigned") {
        return t.isAssigned;
      } else if (queue === "closed") {
        return t.isResolved;
      }
      return true;
    });

    return {
      all: { total: base.length, resolved: base.filter(t => t.isResolved).length },
      critical: { total: base.filter(t => t.priority === "critical" || t.priority === "urgent").length, resolved: base.filter(t => (t.priority === "critical" || t.priority === "urgent") && t.isResolved).length },
      high: { total: base.filter(t => t.priority === "high").length, resolved: base.filter(t => t.priority === "high" && t.isResolved).length },
      medium: { total: base.filter(t => t.priority === "medium").length, resolved: base.filter(t => t.priority === "medium" && t.isResolved).length },
      low: { total: base.filter(t => t.priority === "low").length, resolved: base.filter(t => t.priority === "low" && t.isResolved).length },
    };
  }, [ticketData, queue, isUserManagerOrAdmin, user]);

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
      if (queue === "sla-risk" || queue === "sla risks") {
        matchesQueue = t.status?.toLowerCase() === "open" && (t.slaStatus === "Breached" || t.slaStatus === "At Risk");
      } else if (queue === "open") {
        matchesQueue = t.status?.toLowerCase() === "open";
      } else if (queue === "unassigned") {
        matchesQueue = !t.isAssigned;
      } else if (queue === "assigned") {
        matchesQueue = t.isAssigned;
      } else if (queue === "closed") {
        matchesQueue = t.isResolved;
      }

      let matchesPriority = true;
      if (selectedPriority !== "all") {
        if (selectedPriority === "critical") {
          matchesPriority = t.priority === "critical" || t.priority === "urgent";
        } else {
          matchesPriority = t.priority === selectedPriority;
        }
      }

      const searchStr = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || t.title?.toLowerCase().includes(searchStr) || t.ticketId?.toLowerCase().includes(searchStr);

      return matchesQueue && matchesPriority && matchesSearch;
    });
  }, [ticketData, queue, searchTerm, isUserManagerOrAdmin, user, selectedPriority]);

  return (
    <div className="flex flex-col h-full font-sans bg-slate-50 text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-4 sm:px-8 py-5 bg-white border-b border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Support Tickets</h1>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-0.5">
            Queue: <span className="text-blue-600 font-semibold capitalize">{queue.replace("-", " ")}</span>
          </p>
        </div>
        <button 
          onClick={onOpenCreateTicket} 
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-all shadow-sm shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          Add Ticket
        </button>
      </div>

      {/* Priority Filters Bar */}
      <div className="px-4 sm:px-8 py-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-3 overflow-x-auto">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 tracking-wider whitespace-nowrap mr-2">
          <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          PRIORITY FILTERS:
        </div>
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "All Priorities", count: priorityCounts.all.total },
            { id: "critical", label: "Critical", count: priorityCounts.critical.total },
            { id: "high", label: "High", count: priorityCounts.high.total },
            { id: "medium", label: "Medium", count: priorityCounts.medium.total },
            { id: "low", label: "Low", count: priorityCounts.low.total }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedPriority(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                selectedPriority === item.id 
                  ? "bg-slate-900 text-white shadow-sm" 
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {item.label} 
              <span className={`px-1.5 py-0.2 rounded text-[10px] ${selectedPriority === item.id ? "bg-slate-800 text-slate-200" : "bg-slate-200 text-slate-600"}`}>
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Search & Queue Nav */}
      <div className="px-4 sm:px-8 py-3 bg-slate-50 border-b border-slate-200 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
        <div className="relative w-full xl:max-w-sm">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </span>
          <input
            type="text"
            placeholder="Search by Ticket ID or Title..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-2xs placeholder:text-slate-400 text-slate-800"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center bg-slate-200/60 p-1 rounded-lg border border-slate-200 overflow-x-auto">
          {[
            { key: "all-work", label: "All Work" },
            { key: "unassigned", label: "Unassigned" },
            { key: "open", label: "Open" },
            { key: "assigned", label: "Assigned" },
            { key: "closed", label: "Closed" },
            { key: "sla-risk", label: "SLA Risks" }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => navigate(`/tickets?queue=${tab.key}`)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap ${
                queue === tab.key ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        {isLoading ? (
          <div className="p-16 text-center text-xs font-medium text-slate-400 animate-pulse flex flex-col items-center gap-3 bg-white rounded-xl border border-slate-200">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            Loading tickets database...
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-16 text-center text-xs text-slate-400 italic flex flex-col items-center gap-2 bg-white rounded-xl border border-slate-200">
            <svg className="w-9 h-9 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7m16 0v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5m16 0h-2.586a1 1 0 0 0-.707.293l-2.414 2.414a1 1 0 0 1-.707.293h-3.172a1 1 0 0 1-.707-.293l-2.414-2.414A1 1 0 0 0 6.586 13H4"/></svg>
            No tickets found matching your active filters.
          </div>
        ) : (
          <>
            {/* Mobile / Tablet Card Layout (Visible on screens smaller than xl) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 xl:hidden">
              {filteredTickets.map((t) => {
                const mongoId = t._id || t.id;
                const isResolvedState = t.isResolved;
                const isRestricted = !isUserManagerOrAdmin;

                return (
                  <div
                    key={mongoId}
                    onClick={() => navigate(`/tickets/${t.ticketId}`)}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-blue-400 cursor-pointer transition-all flex flex-col gap-3"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="text-xs font-bold text-blue-600">{t.ticketId}</span>
                        <h3 className="text-sm font-semibold text-slate-900 mt-0.5 line-clamp-1">{t.title}</h3>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${
                        t.priority === "critical" || t.priority === "urgent" ? "bg-rose-100 text-rose-700" :
                        t.priority === "high" ? "bg-amber-100 text-amber-700" :
                        t.priority === "medium" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                      }`}>
                        {t.priority}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-slate-700">{t.entrySource}</span>
                      <span>•</span>
                      <span>{formatDate(t.createdAt)}</span>
                      <span>•</span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md font-medium">{t.category}</span>
                    </div>

                    <hr className="border-slate-100 my-1" />

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-slate-400 text-[10px] uppercase font-semibold">Primary Assignee</span>
                        {t.isAssigned ? (
                          <span className="text-slate-800 font-semibold truncate">{t.assigneeName}</span>
                        ) : !isUserManagerOrAdmin ? (
                          isOperatorOnly ? (
                            <button
                              onClick={(e) => handleAssignToMe(e, mongoId)}
                              className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[11px] px-2 py-1 rounded-md font-medium transition-all shadow-2xs cursor-pointer w-fit"
                            >
                              Assign to Me
                            </button>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )
                        ) : (
                          <div className="relative">
                            <select
                              value={t.assignee && t.assignee.toLowerCase() !== "unassigned" ? t.assignee : ""}
                              disabled={isRestricted || isResolvedState}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleManagerAssign(mongoId, e.target.value || "Unassigned");
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full py-1.5 pl-2.5 pr-8 border border-slate-300 rounded-lg text-[11px] bg-white text-slate-700 focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 outline-none disabled:bg-slate-100 cursor-pointer shadow-2xs appearance-none font-medium transition-all"
                            >
                              <option value="" disabled>Select</option>
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
                            <span className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-slate-400">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-1 items-end sm:items-start">
                        <span className="text-slate-400 text-[10px] uppercase font-semibold">SLA Health</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                          t.slaStatus === "Breached" ? "bg-rose-50 text-rose-700 border border-rose-200" : 
                          t.slaStatus === "At Risk" ? "bg-amber-50 text-amber-700 border border-amber-200" : 
                          "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}>
                          {t.slaStatus}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100 text-[11px]">
                      <span className={`px-2 py-0.5 font-bold uppercase rounded-md text-[10px] tracking-wider shadow-2xs ${
                        t.status?.toLowerCase() === "resolved" || t.status?.toLowerCase() === "closed" ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
                      }`}>
                        {t.status || "Open"}
                      </span>
                      <span className="text-slate-500 font-medium">
                        Resolution: <span className={t.isResolved ? "text-emerald-700 font-semibold" : "text-slate-400 italic"}>{t.finalResolutionTimeFormatted}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop / Large Screen Table Layout (Visible on xl screens and up) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden hidden xl:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 border-collapse min-w-[1700px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="py-3.5 px-4 font-semibold">ID</th>
                      <th className="py-3.5 px-4 font-semibold">Source</th>
                      <th className="py-3.5 px-4 font-semibold">Created</th>
                      <th className="py-3.5 px-4 font-semibold">Title</th>
                      <th className="py-3.5 px-4 font-semibold">Category</th>
                      <th className="py-3.5 px-4 font-semibold">Priority</th>
                      <th className="py-3.5 px-4 font-semibold">Primary Assignee</th>
                      <th className="py-3.5 px-4 font-semibold">Primary Assignment Timeline</th>
                      <th className="py-3.5 px-4 font-semibold">Primary Duration</th>
                      <th className="py-3.5 px-4 font-semibold">Sub-Assignee</th>
                      <th className="py-3.5 px-4 font-semibold">Sub-Assignment Timeline</th>
                      <th className="py-3.5 px-4 font-semibold">Sub-Assignee Duration</th>
                      <th className="py-3.5 px-4 font-semibold">SLA Health</th>
                      <th className="py-3.5 px-4 font-semibold">Status & Total Resolution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTickets.map((t) => {
                      const mongoId = t._id || t.id;
                      const isResolvedState = t.isResolved;
                      const isRestricted = !isUserManagerOrAdmin;

                      return (
                        <tr 
                          key={mongoId} 
                          onClick={() => navigate(`/tickets/${t.ticketId}`)} 
                          className="hover:bg-slate-50/85 cursor-pointer transition-colors group"
                        >
                          <td className="py-3.5 px-4 font-semibold text-blue-600 group-hover:text-blue-700 whitespace-nowrap">{t.ticketId}</td>
                          <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-[11px]">{t.entrySource}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">{formatDate(t.createdAt)}</td>
                          <td className="py-3.5 px-4 font-medium text-slate-900 max-w-[160px] truncate" title={t.title}>{t.title}</td>
                          
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[11px] font-medium">{t.category}</span>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              t.priority === "critical" || t.priority === "urgent" ? "bg-rose-100 text-rose-700" :
                              t.priority === "high" ? "bg-amber-100 text-amber-700" :
                              t.priority === "medium" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                            }`}>
                              {t.priority}
                            </span>
                          </td>
                          
                          {/* Primary Assignee Column */}
                          <td className="py-3.5 px-4 font-medium text-slate-700 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            {t.isAssigned ? (
                              <span className="text-slate-800 font-semibold">{t.assigneeName}</span>
                            ) : !isUserManagerOrAdmin ? (
                              isOperatorOnly ? (
                                <button
                                  onClick={(e) => handleAssignToMe(e, mongoId)}
                                  className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[11px] px-2.5 py-1 rounded-md font-medium transition-all shadow-2xs cursor-pointer"
                                >
                                  Assign to Me
                                </button>
                              ) : (
                                <span className="text-slate-400 italic">Unassigned</span>
                              )
                            ) : (
                              <div className="relative">
                                <select
                                  value={t.assignee && t.assignee.toLowerCase() !== "unassigned" ? t.assignee : ""}
                                  disabled={isRestricted || isResolvedState}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleManagerAssign(mongoId, e.target.value || "Unassigned");
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full py-1.5 pl-2.5 pr-8 border border-slate-300 rounded-lg text-[11px] bg-white text-slate-700 focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 outline-none disabled:bg-slate-100 cursor-pointer shadow-2xs appearance-none font-medium transition-all"
                                >
                                  <option value="" disabled>Select</option>
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
                                <span className="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none text-slate-400">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Primary Assignment Timeline (Start & End) */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {t.isAssigned ? (
                              <div className="flex flex-col text-[11px] bg-slate-50/80 p-1.5 rounded-md border border-slate-200/60 gap-0.5">
                                <span className="text-slate-700 font-medium">Start: <span className="text-slate-900 font-semibold">{t.primaryStartFormatted}</span></span>
                                <span className="text-slate-500 text-[10px]">End: <span className="text-slate-700 font-medium">{t.primaryEndFormatted}</span></span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">—</span>
                            )}
                          </td>

                          {/* Primary Duration */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="px-2 py-1 rounded-md font-medium bg-slate-100 text-slate-700 border border-slate-200/60">
                              {t.primaryAssignmentTimeFormatted}
                            </span>
                          </td>

                          {/* Sub-Assignee Name */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`font-medium ${t.subAssignmentName ? "text-purple-700 font-semibold" : "text-slate-400 italic"}`}>
                              {t.subAssignmentName || "None"}
                            </span>
                          </td>

                          {/* Sub-Assignment Timeline (Start & End) */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {t.subAssignmentName ? (
                              <div className="flex flex-col text-[11px] bg-purple-50/40 p-1.5 rounded-md border border-purple-100 gap-0.5">
                                <span className="text-purple-900 font-medium">Start: <span className="font-semibold">{t.subStartFormatted}</span></span>
                                <span className="text-purple-700/80 text-[10px]">End: <span className="font-medium">{t.subEndFormatted}</span></span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">—</span>
                            )}
                          </td>

                          {/* Sub-Assignee Duration */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-md font-medium ${
                              t.subAssignmentName ? "bg-purple-50 text-purple-700 border border-purple-100/80" : "bg-slate-50 text-slate-400 italic"
                            }`}>
                              {t.subAssignmentTimeFormatted}
                            </span>
                          </td>

                          {/* SLA Health Indicator */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                              t.slaStatus === "Breached" ? "bg-rose-50 text-rose-700 border border-rose-200" : 
                              t.slaStatus === "At Risk" ? "bg-amber-50 text-amber-700 border border-amber-200" : 
                              "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}>
                              {t.slaStatus}
                            </span>
                          </td>
                          
                          {/* Status & Total Resolution */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`px-2.5 py-0.5 font-bold uppercase rounded-md text-[10px] tracking-wider shadow-2xs ${
                                t.status?.toLowerCase() === "resolved" || t.status?.toLowerCase() === "closed" ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
                              }`}>
                                {t.status || "Open"}
                              </span>
                              <span className={`text-[10px] font-medium ${t.isResolved ? "text-emerald-700 font-semibold" : "text-slate-400 italic"}`}>
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
            </div>
          </>
        )}
      </div>
    </div>
  );
};