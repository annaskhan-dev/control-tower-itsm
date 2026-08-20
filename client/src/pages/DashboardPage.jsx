import React, { useState, useEffect, useRef } from 'react';
import { Dashboard } from './Dashboard'; 
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../api/axiosInstance';
import { Download } from 'lucide-react';

export const DashboardPage = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth(); 

  const companyID = user?.companyID || user?.id || user?._id;
  
  // Use a ref to lock fetches strictly per component lifecycle instance
  const fetchedRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    if (!companyID) {
      if (isMounted) setLoading(false);
      return;
    }

    if (fetchedRef.current === companyID) {
      if (isMounted) setLoading(false);
      return;
    }

    const fetchTickets = async () => {
      fetchedRef.current = companyID;
      try {
        const response = await axiosInstance.get('/tickets', {
          params: { companyID }
        });
        if (isMounted) {
          const data = Array.isArray(response.data) ? response.data : (response.data?.tickets || response.data?.data || []);
          setTickets(data);
        }
      } catch (error) {
        console.error("Failed to fetch tickets:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchTickets();

    return () => {
      isMounted = false;
    };
  }, [companyID]);

  // Function to filter last 1 month and export tickets to Excel (CSV format)
  const handleExportExcel = () => {
    const currentDate = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(currentDate.getMonth() - 1);

    const recentTickets = tickets.filter((t) => {
      const dateValue = t.createdAt || t.created_at;
      if (!dateValue) return false;
      const ticketDate = new Date(dateValue);
      return ticketDate >= oneMonthAgo && ticketDate <= new Date(currentDate.setHours(23, 59, 59, 999));
    });

    if (recentTickets.length === 0) {
      alert("No ticket data found within the last 1 month to export.");
      return;
    }

    const headers = ["Ticket ID", "Title", "Type", "Priority", "Assignee", "SLA", "Status", "Created At"];

    const csvRows = recentTickets.map((t) => {
      const dateValue = t.createdAt || t.created_at;
      const formattedDate = dateValue ? new Date(dateValue).toLocaleString() : "";
      const ticketId = `"${(t.id || t._id || t.ticketId || "").toString().replace(/"/g, '""')}"`;
      const title = `"${(t.title || t.subject || t.name || "").replace(/"/g, '""')}"`;
      const type = `"${(t.type || t.ticketType || t.category || "").replace(/"/g, '""')}"`;
      const priority = `"${(t.priority || t.priorityLevel || "").replace(/"/g, '""')}"`;
      
      let rawAssignee = t.assignee || t.assignedTo || t.assigned_to || "Unassigned";
      if (typeof rawAssignee === "object" && rawAssignee !== null) {
        rawAssignee = rawAssignee.name || rawAssignee.fullName || rawAssignee.email || "Unassigned";
      }
      const assignee = `"${rawAssignee.replace(/"/g, '""')}"`;

      let sla = "On Track";
      if (t.slaDeadline) {
        const deadline = new Date(t.slaDeadline);
        if (!isNaN(deadline.getTime())) {
          if (deadline < new Date()) sla = "Breached";
          else if (deadline < new Date(Date.now() + 2 * 60 * 60 * 1000)) sla = "Due Soon";
        }
      }
      const slaField = `"${sla}"`;

      const status = `"${(t.status || t.ticketStatus || "new").toString().replace(/_/g, " ").replace(/"/g, '""')}"`;
      const createdAt = `"${formattedDate}"`;

      return [ticketId, title, type, priority, assignee, slaField, status, createdAt].join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `tickets_last_1_month_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="p-8 text-xs text-slate-500 font-medium">Loading dashboard data...</div>;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Dashboard Overview</h1>
          <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Company: {user?.companyName || "Active"}</p>
        </div>
        <button
          onClick={handleExportExcel}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-2 cursor-pointer"
        >
          <Download size={16} /> Export to Excel
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Dashboard tickets={tickets} />
      </div>
    </div>
  );
};

export default DashboardPage;