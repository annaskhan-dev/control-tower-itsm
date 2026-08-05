import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTickets } from "../context/TicketContext";
import { useAuth } from "../context/AuthContext";
import { checkPermission, canEditField } from "../config/permissions";
import { fetchSlaConfigs } from "../api/ticketApi";
import axiosInstance from "../api/axiosInstance";
import {
  ArrowLeft,
  Loader2,
  Save,
  ShieldAlert,
  Calendar,
  Trash2,
  AlertCircle,
  UserPlus
} from "lucide-react";

export const TicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tickets, fetchTickets, updateLocalTicket } = useTickets();
  const { user } = useAuth();

  const [description, setDescription] = useState("");
  const [subAssignment, setSubAssignment] = useState("");
  const [customSubAssignment, setCustomSubAssignment] = useState("");
  const [companyUsers, setCompanyUsers] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [slaConfigs, setSlaConfigs] = useState([]);

  useEffect(() => {
    const loadSla = async () => {
      const data = await fetchSlaConfigs();
      setSlaConfigs(data || []);
    };
    loadSla();
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axiosInstance.get("/users");
        setCompanyUsers(res.data || []);
      } catch (err) {
        console.error("Failed to fetch company users", err);
      }
    };
    fetchUsers();
  }, []);

  const categoryOptions = useMemo(() => {
    const unique = [...new Set(slaConfigs.map((c) => c.category))];
    return unique.map((cat) => ({
      label: cat.charAt(0).toUpperCase() + cat.slice(1).replace("-", " "),
      value: cat,
    }));
  }, [slaConfigs]);

  const canDelete = checkPermission(user?.role, "canDelete");
  const canEditDesc = canEditField(user?.role, "description");
  const canEditStatus = canEditField(user?.role, "status");
  const canEditCategory = canEditField(user?.role, "category");

  const ticket = useMemo(() => {
    if (!tickets) return null;
    return tickets.find(
      (t) => String(t._id) === String(id) || String(t.ticketId) === String(id)
    );
  }, [tickets, id]);

  useEffect(() => {
    if (ticket) {
      setDescription(ticket.description || "");
      const val = ticket.subAssignment || "";
      const isExistingUser = companyUsers.some(u => (u.name || u.email) === val);
      if (val && !isExistingUser) {
        setSubAssignment("custom");
        setCustomSubAssignment(val);
      } else {
        setSubAssignment(val);
        setCustomSubAssignment("");
      }
    }
  }, [ticket, companyUsers]);

  const calculateDeadline = (category, priority) => {
    const rule = slaConfigs.find(
      (c) => c.category === category && c.priority === (priority || "Medium")
    );
    const hours = rule ? rule.hours : 24;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  };

  const handleUpdate = async (updatedFields) => {
    if (!ticket) return;
    let payload = { ...updatedFields };

    if (payload.category) {
      const rule = slaConfigs.find((c) => c.category === payload.category);
      if (rule) payload.priority = rule.priority;
    }

    const newCategory = payload.category || ticket.category;
    const newPriority = payload.priority || ticket.priority;
    payload.slaDeadline = calculateDeadline(newCategory, newPriority);

    if ('subAssignment' in payload) {
      const finalVal = payload.subAssignment === "custom" ? customSubAssignment : payload.subAssignment;
      payload.subAssignment = finalVal;
      
      // Calculate subAssignmentAt dynamically depending on state changes
      if (finalVal && !ticket.subAssignment) {
        payload.subAssignmentAt = new Date().toISOString();
      } else if (finalVal && ticket.subAssignment !== finalVal) {
        payload.subAssignmentAt = new Date().toISOString();
      } else if (!finalVal) {
        payload.subAssignmentAt = null;
      }
    }

    setIsUpdating(true);
    updateLocalTicket(ticket._id, payload);
    try {
      await axiosInstance.patch(`/tickets/${ticket._id}`, payload);
      await fetchTickets();
    } catch (err) {
      alert("Update failed. Check your permissions.");
      await fetchTickets();
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this ticket?")) return;
    setIsDeleting(true);
    try {
      await axiosInstance.delete(`/tickets/${ticket._id}`);
      navigate("/tickets");
      await fetchTickets();
    } catch (err) {
      alert("Permission denied or server error.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!ticket) return <div className="p-4 text-center text-slate-500 text-sm">Loading...</div>;

  const isOverdue = ticket.slaDeadline && new Date(ticket.slaDeadline) < new Date() && ticket.status !== "Closed";

  return (
    <div className="h-full bg-slate-50 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        
        {/* Header with Back Button */}
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-100 transition"
          >
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <h2 className="text-lg font-bold text-slate-800">Ticket Details: {ticket.ticketId}</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Description Panel & Sub Assignment */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm">Description</h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting || !canDelete}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 disabled:opacity-50 transition"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                  <button
                    onClick={() => handleUpdate({ description })}
                    disabled={isUpdating || !canEditDesc}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Save
                  </button>
                </div>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canEditDesc}
                rows={8}
                className="w-full p-4 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-slate-50 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                placeholder="No description provided..."
              />
            </div>

            {/* Sub Assignment Panel */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <UserPlus size={16} className="text-blue-600" /> Sub Assignment
                </h3>
                <button
                  onClick={() => handleUpdate({ subAssignment })}
                  disabled={isUpdating}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Assign
                </button>
              </div>
              <div className="space-y-3">
                <select
                  value={subAssignment}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSubAssignment(val);
                    if (val !== "custom") {
                      setCustomSubAssignment("");
                    }
                  }}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Select Company User</option>
                  {companyUsers.map((u) => (
                    <option key={u._id || u.id} value={u.name || u.email}>
                      {u.name} ({u.role || "User"})
                    </option>
                  ))}
                  <option value="custom">Other (Type Custom Text)...</option>
                </select>

                {subAssignment === "custom" && (
                  <input
                    type="text"
                    value={customSubAssignment}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomSubAssignment(val);
                      setSubAssignment(val);
                    }}
                    placeholder="Enter custom sub assignment text..."
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Properties */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
              <h3 className="text-xs font-bold flex items-center gap-2 text-slate-700">
                <ShieldAlert size={14} className="text-blue-600" /> Properties
              </h3>

              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Status</label>
                <select disabled={!canEditStatus} value={ticket.status || ""} onChange={(e) => handleUpdate({ status: e.target.value })} className="w-full p-2 border border-slate-200 rounded-lg text-xs disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed">
                  {["Open", "In Progress", "Resolved", "Closed"].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Priority (Auto)</label>
                <input disabled value={ticket.priority || "Medium"} className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-500 cursor-not-allowed" />
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Category</label>
                <select disabled={!canEditCategory} value={ticket.category || ""} onChange={(e) => handleUpdate({ category: e.target.value })} className="w-full p-2 border border-slate-200 rounded-lg text-xs disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed">
                  <option value="">Select Category</option>
                  {categoryOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block flex items-center gap-1">
                  <Calendar size={10} /> SLA Deadline
                </label>
                <div className={`w-full p-2 border rounded-lg text-xs font-medium flex items-center gap-2 ${isOverdue ? "bg-red-50 text-red-700 border-red-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                  {isOverdue && <AlertCircle size={12} />}
                  {ticket.slaDeadline ? new Date(ticket.slaDeadline).toLocaleString() : "No Deadline Set"}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block flex items-center gap-1">
                  <Calendar size={10} /> Sub Assignment Time
                </label>
                <div className="w-full p-2 border border-slate-200 rounded-lg text-xs font-medium bg-slate-50 text-slate-600">
                  {ticket.subAssignmentAt ? new Date(ticket.subAssignmentAt).toLocaleString() : "Not Sub-assigned Yet"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};