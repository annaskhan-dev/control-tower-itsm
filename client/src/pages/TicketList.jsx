import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTickets } from "../context/TicketContext";
import { useAuth } from "../context/AuthContext";

export const TicketList = ({ onOpenCreateTicket }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [now, setNow] = useState(new Date());

  // Update current time every minute for active duration calculations
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);
  
  const { tickets, fetchTickets, isLoading } = useTickets();
  const { isAdmin, isManager } = useAuth();
  
  const queue = searchParams.get("queue") || "all-work";

  useEffect(() => {
    fetchTickets(queue);
  }, [queue, fetchTickets]);

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const d = new Date(dateString);
    return isNaN(d.getTime()) 
      ? "Invalid" 
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDuration = (ms) => {
    if (ms === null || ms === undefined || isNaN(ms)) return "—";
    if (ms < 0) return "< 1m";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours === 0 && mins === 0) return "< 1m";
    return `${hours}h ${mins}m`;
  };

  const ticketData = useMemo(() => {
    if (!tickets) return [];
    
    return tickets.map((t) => {
      // SLA calculations
      const deadline = new Date(t.slaDeadline || now);
      const diffMinutes = t.slaDeadline ? (deadline.getTime() - now.getTime()) / (1000 * 60) : Infinity;

      let slaStatus = "On Track";
      if (t.status !== "Resolved") {
        if (diffMinutes < 0) slaStatus = "Breached";
        else if (diffMinutes < 30) slaStatus = "At Risk";
      }

      // Parse Assignee safely
      let rawAssignee = t.assignee || t.assignedTo || t.assigned_to || "Unassigned";
      if (typeof rawAssignee === "object" && rawAssignee !== null) {
        rawAssignee = rawAssignee.name || rawAssignee.fullName || rawAssignee.email || "Unassigned";
      }
      const assigneeName = typeof rawAssignee === "string" ? rawAssignee : "Unassigned";
      const isAssigned = assigneeName.toLowerCase() !== "unassigned" && assigneeName !== "";
      
      // Check sub-assignment status
      let rawSubAssignee = t.subAssignment || t.sub_assignment || t.subAssignedTo || "";
      if (typeof rawSubAssignee === "object" && rawSubAssignee !== null) {
        rawSubAssignee = rawSubAssignee.name || rawSubAssignee.fullName || rawSubAssignee.email || "";
      }
      const subAssignmentName = typeof rawSubAssignee === "string" ? rawSubAssignee.trim() : "";
      const isSubAssigned = subAssignmentName !== "" && subAssignmentName.toLowerCase() !== "unassigned" && subAssignmentName !== null;

      const isResolved = ["closed", "resolved"].includes((t.status || "").toLowerCase());

      // Flexible timestamp extraction matching backend schema
      const createdAtTime = new Date(t.createdAt || t.created_at || t.timestamp || now).getTime();
      
      const assignedAtRaw = t.assignedAt || t.assigned_at || t.assignmentTime;
      const assignedAtTime = assignedAtRaw ? new Date(assignedAtRaw).getTime() : null;

      const subAssignedAtRaw = t.subAssignmentAt || t.sub_assigned_at || t.subAssignedAt || t.sub_assignment_at;
      const subAssignedAtTime = subAssignedAtRaw ? new Date(subAssignedAtRaw).getTime() : null;

      const resolvedAtRaw = t.resolvedAt || t.resolved_at || t.closedAt;
      const resolvedAtTime = isResolved ? (resolvedAtRaw ? new Date(resolvedAtRaw).getTime() : now.getTime()) : null;
      
      const currentOrResolveTime = isResolved ? resolvedAtTime : now.getTime();

      // 1. Assignment Time Calculation (Fixed: tracks duration since assignment occurred)
      let assignmentTimeMs = null;
      if (isAssigned) {
        const assignStartTime = (assignedAtTime && !isNaN(assignedAtTime)) ? assignedAtTime : createdAtTime;
        assignmentTimeMs = Math.max(0, currentOrResolveTime - assignStartTime);
      }

      // 2. SLA / Ongoing Time Calculation
      const slaStartTime = (assignedAtTime && !isNaN(assignedAtTime)) ? assignedAtTime : createdAtTime;
      const slaTimeMs = Math.max(0, currentOrResolveTime - slaStartTime);

      // 3. Sub-Assignment Execution Time Calculation (Fixed: tracks duration since sub-assignment occurred)
      let subAssignmentTimeMs = null;
      if (isSubAssigned) {
        const subStartTime = (subAssignedAtTime && !isNaN(subAssignedAtTime)) ? subAssignedAtTime : createdAtTime;
        subAssignmentTimeMs = Math.max(0, currentOrResolveTime - subStartTime);
      }

      // 4. Final Total Resolution Time
      const finalResolutionTimeMs = isResolved ? Math.max(0, resolvedAtTime - createdAtTime) : null;

      return {
        ...t,
        assigneeName,
        subAssignmentName,
        slaStatus,
        assignmentTimeFormatted: isAssigned ? formatDuration(assignmentTimeMs) : "Unassigned",
        slaTimeFormatted: formatDuration(slaTimeMs),
        subAssignmentTimeFormatted: isSubAssigned ? formatDuration(subAssignmentTimeMs) : "Not Sub-Assigned",
        finalResolutionTimeFormatted: isResolved ? formatDuration(finalResolutionTimeMs) : "Pending",
      };
    });
  }, [tickets, now]);

  const filteredTickets = useMemo(() => {
    return ticketData.filter((t) => {
      let matchesQueue = true;
      if (queue === "sla-risk") {
        matchesQueue = t.status?.toLowerCase() === "open" && (t.slaStatus === "Breached" || t.slaStatus === "At Risk");
      } else if (queue === "open") {
        matchesQueue = t.status?.toLowerCase() === "open";
      }

      const searchStr = searchTerm.toLowerCase();
      return matchesQueue && (t.title?.toLowerCase().includes(searchStr) || t.ticketId?.toLowerCase().includes(searchStr));
    });
  }, [ticketData, queue, searchTerm]);

  return (
    <div className="flex flex-col h-full font-sans bg-white text-slate-800">
      <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold">Support Tickets</h1>
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mt-0.5">Viewing: {queue.replace("-", " ")}</p>
        </div>
        <button 
          onClick={onOpenCreateTicket} 
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition shadow-sm"
        >
          + Add Ticket
        </button>
      </div>
      
      <div className="px-6 py-3 border-b border-slate-100 bg-slate-50">
        <input
          type="text"
          placeholder="Search by ID or Title..."
          className="w-full max-w-sm px-4 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-base text-slate-500 animate-pulse">Loading tickets...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-8 text-center text-base text-slate-400 italic">No tickets found in this view.</div>
        ) : (
          <table className="w-full text-left text-sm text-slate-600 border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">ID</th>
                <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">Entry</th>
                <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">Title</th>
                <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">Category</th>
                <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">Assignee</th>
                <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">Assignment Time</th>
                <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">SLA / Ongoing Time</th>
                <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">Sub Assignment</th>
                <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">Sub-Assignment Time</th>
                <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">SLA</th>
                <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">Status & Resolution Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((t) => (
                <tr 
                  key={t._id} 
                  onClick={() => navigate(`/tickets/${t.ticketId}`)} 
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition text-sm"
                >
                  <td className="p-4 font-bold text-blue-600">{t.ticketId}</td>
                  <td className="p-4 text-slate-500 whitespace-nowrap">{formatDate(t.createdAt)}</td>
                  <td className="p-4 font-medium text-slate-900 truncate max-w-[200px]">{t.title}</td>
                  <td className="p-4 text-slate-500">{t.category || "—"}</td>
                  <td className="p-4 text-slate-500">{t.assigneeName}</td>
                  <td className="p-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      t.assignmentTimeFormatted !== "Unassigned" ? "bg-slate-100 text-slate-700" : "bg-slate-100 text-slate-400 italic"
                    }`}>
                      {t.assignmentTimeFormatted}
                    </span>
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      {t.slaTimeFormatted}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500">
                    <div>{t.subAssignmentName || "—"}</div>
                    {t.subAssignmentAt && (
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatDate(t.subAssignmentAt)}</span>
                    )}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      t.subAssignmentTimeFormatted !== "Not Sub-Assigned" ? "bg-purple-50 text-purple-700" : "bg-slate-100 text-slate-400 italic"
                    }`}>
                      {t.subAssignmentTimeFormatted}
                    </span>
                  </td>
                  <td className={`p-4 font-bold whitespace-nowrap ${t.slaStatus === "Breached" ? "text-rose-600" : t.slaStatus === "At Risk" ? "text-amber-600" : "text-emerald-600"}`}>
                    {t.slaStatus}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2.5 py-1 font-bold uppercase rounded-full text-xs w-max ${
                        t.status === "Resolved" ? "bg-emerald-100 text-emerald-700" :
                        "bg-blue-100 text-blue-600"
                      }`}>
                        {t.status || "Open"}
                      </span>
                      <span className={`text-[10px] font-semibold ${t.status === "Resolved" ? "text-emerald-600 font-bold" : "text-slate-400 italic"}`}>
                        Total: {t.finalResolutionTimeFormatted}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};