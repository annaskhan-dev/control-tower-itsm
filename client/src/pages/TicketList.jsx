import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTickets } from "../context/TicketContext";
import { useAuth } from "../context/AuthContext";

export const TicketList = ({ onOpenCreateTicket }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  
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

  const ticketData = useMemo(() => {
    if (!tickets) return [];
    const now = new Date();
    
    return tickets.map((t) => {
      const deadline = new Date(t.slaDeadline || now);
      const diffMinutes = t.slaDeadline ? (deadline.getTime() - now.getTime()) / (1000 * 60) : Infinity;

      let slaStatus = "On Track";
      if (t.status !== "Resolved") {
        if (diffMinutes < 0) slaStatus = "Breached";
        else if (diffMinutes < 30) slaStatus = "At Risk";
      }

      return { ...t, slaStatus };
    });
  }, [tickets]);

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
                <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">Assigned At</th>
                <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">Sub Assignment</th>
                <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">Sub Assigned At</th>
                <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">SLA</th>
                <th className="p-4 font-semibold text-slate-700 uppercase text-xs tracking-wider">Status</th>
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
                  <td className="p-4 font-medium text-slate-900 truncate max-w-[240px]">{t.title}</td>
                  <td className="p-4 text-slate-500">{t.category || "—"}</td>
                  <td className="p-4 text-slate-500">{t.assignee || "Unassigned"}</td>
                  <td className="p-4 text-slate-500 whitespace-nowrap">{formatDate(t.assignedAt)}</td>
                  <td className="p-4 text-slate-500">{t.subAssignment || "—"}</td>
                  <td className="p-4 text-slate-500 whitespace-nowrap">{formatDate(t.subAssignmentAt)}</td>
                  <td className={`p-4 font-bold ${t.slaStatus === "Breached" ? "text-rose-600" : t.slaStatus === "At Risk" ? "text-amber-600" : "text-emerald-600"}`}>
                    {t.slaStatus}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2.5 py-1 font-bold uppercase rounded-full text-xs w-max ${
                          t.status === "Resolved" ? "bg-emerald-100 text-emerald-700" :
                          "bg-blue-100 text-blue-600"
                      }`}>
                        {t.status || "Open"}
                      </span>
                      {t.status === "Resolved" && t.resolvedAt && (
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {formatDate(t.resolvedAt)}
                        </span>
                      )}
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