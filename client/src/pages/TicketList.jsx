import React, { useState, useMemo, useEffect } from "react";
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

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);
  
  const { tickets, fetchTickets, updateTicket, isLoading } = useTickets();
  const { user, isAdmin, isManager, role } = useAuth();
  
  const userRoleRaw = role || user?.role || user?.userType || user?.type || "";
  const currentRole = typeof userRoleRaw === 'string' ? userRoleRaw.replace(/\s+/g, "_").toLowerCase() : "";
  
  const isUserManagerOrAdmin = isAdmin || isManager || currentRole.includes('admin') || currentRole.includes('manager');

  const queue = searchParams.get("queue") || "all-work";

  useEffect(() => {
    fetchTickets(queue);
  }, [queue, fetchTickets]);

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

  const handleAssignToMe = async (e, mongoId) => {
    e.stopPropagation();
    try {
      const currentUserName = user?.name || user?.username || user?.fullName || "Operator";
      await updateTicket(mongoId, { assignee: currentUserName });
      fetchTickets(queue);
    } catch (err) {
      console.error("Failed to assign ticket to self", err);
      alert(err.response?.data?.message || "Failed to assign ticket");
    }
  };

  const handleManagerAssign = async (mongoId, selectedOperatorName) => {
    if (!selectedOperatorName) return;
    try {
      await updateTicket(mongoId, { assignee: selectedOperatorName });
      fetchTickets(queue);
    } catch (err) {
      console.error("Failed to assign ticket", err);
      alert(err.response?.data?.message || "Failed to assign ticket");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const d = new Date(dateString);
    return isNaN(d.getTime()) 
      ? "Invalid" 
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

      return {
        ...t,
        assigneeName,
        isAssigned,
        subAssignmentName,
        subAssignmentAt: subAssignedAtRaw,
        slaStatus,
        assignmentTimeFormatted: isAssigned ? formatDuration(primaryAssignmentMs) : "Unassigned",
        slaTimeFormatted: isAssigned ? formatDuration(slaTimeMs) : "N/A",
        subAssignmentTimeFormatted: isSubAssigned ? formatDuration(subAssignmentTimeMs) : "Not Sub-Assigned",
        finalResolutionTimeFormatted: isResolved ? formatDuration(finalResolutionTimeMs) : "Pending",
      };
    });
  }, [tickets, now]);

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

      const searchStr = searchTerm.toLowerCase();
      return matchesQueue && (t.title?.toLowerCase().includes(searchStr) || t.ticketId?.toLowerCase().includes(searchStr));
    });
  }, [ticketData, queue, searchTerm, isUserManagerOrAdmin, user]);

  return (
    <div className="flex flex-col h-full font-sans bg-slate-50 text-slate-800">
      <div className="flex justify-between items-center px-8 py-5 bg-white border-b border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Support Tickets</h1>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
            Queue: <span className="text-blue-600 font-bold">{queue.replace("-", " ")}</span>
          </p>
        </div>
        <button 
          onClick={onOpenCreateTicket} 
          className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
          Add Ticket
        </button>
      </div>
      
      <div className="px-8 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </span>
          <input
            type="text"
            placeholder="Search by Ticket ID or Title..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-2xs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="text-xs font-medium text-slate-500">
          Showing <span className="font-bold text-slate-700">{filteredTickets.length}</span> tickets
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-16 text-center text-sm font-medium text-slate-400 animate-pulse flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              Loading tickets database...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-16 text-center text-sm text-slate-400 italic flex flex-col items-center gap-2">
              <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7m16 0v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5m16 0h-2.586a1 1 0 0 0-.707.293l-2.414 2.414a1 1 0 0 1-.707.293h-3.172a1 1 0 0 1-.707-.293l-2.414-2.414A1 1 0 0 0 6.586 13H4"/></svg>
              No tickets found in this view queue.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 border-collapse min-w-[1100px]">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-700 uppercase text-[10px] tracking-wider font-bold">
                  <tr>
                    <th className="p-4">ID</th>
                    <th className="p-4">Entry</th>
                    <th className="p-4">Title</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Assignee</th>
                    <th className="p-4">Assignment Time</th>
                    <th className="p-4">SLA Active Time</th>
                    <th className="p-4">Sub-Assignment</th>
                    <th className="p-4">Sub-Assignee Time</th>
                    <th className="p-4">SLA Health</th>
                    <th className="p-4">Status & Resolution</th>
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
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                      >
                        <td className="p-4 font-bold text-blue-600 group-hover:text-blue-700 whitespace-nowrap">{t.ticketId}</td>
                        <td className="p-4 text-slate-500 whitespace-nowrap text-xs">{formatDate(t.createdAt)}</td>
                        <td className="p-4 font-semibold text-slate-900 max-w-[200px] truncate">{t.title}</td>
                        <td className="p-4 text-slate-500 whitespace-nowrap text-xs">{t.category || "—"}</td>
                        
                        <td className="p-4 font-medium text-slate-700 whitespace-nowrap text-xs" onClick={(e) => e.stopPropagation()}>
                          {t.isAssigned ? (
                            <span>{t.assigneeName}</span>
                          ) : !isUserManagerOrAdmin ? (
                            <button
                              onClick={(e) => handleAssignToMe(e, mongoId)}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2.5 py-1 rounded-lg font-semibold transition-all shadow-xs cursor-pointer"
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
                                className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer"
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

                        <td className="p-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            t.assignmentTimeFormatted !== "Unassigned" ? "bg-slate-100 text-slate-700 border border-slate-200/60" : "bg-slate-50 text-slate-400 italic"
                          }`}>
                            {t.assignmentTimeFormatted}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            t.slaTimeFormatted !== "N/A" ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-slate-50 text-slate-400 italic"
                          }`}>
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
                            t.slaStatus === "Breached" ? "bg-rose-100 text-rose-700 border border-rose-200" : 
                            t.slaStatus === "At Risk" ? "bg-amber-100 text-amber-700 border border-amber-200" : 
                            "bg-emerald-100 text-emerald-700 border border-emerald-200"
                          }`}>
                            {t.slaStatus}
                          </span>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`px-3 py-1 font-bold uppercase rounded-full text-[10px] tracking-wider shadow-2xs ${
                              t.status?.toLowerCase() === "resolved" || t.status?.toLowerCase() === "closed" ? "bg-emerald-600 text-white" :
                              "bg-blue-600 text-white"
                            }`}>
                              {t.status || "Open"}
                            </span>
                            <span className={`text-[11px] font-medium ${t.status?.toLowerCase() === "resolved" || t.status?.toLowerCase() === "closed" ? "text-emerald-700 font-bold" : "text-slate-400 italic"}`}>
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