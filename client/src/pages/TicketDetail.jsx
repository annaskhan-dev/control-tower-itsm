import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  UserPlus,
  UserCheck,
  Cpu
} from "lucide-react";

export const TicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tickets, fetchTickets, updateLocalTicket } = useTickets();
  const { user } = useAuth();

  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [subAssignment, setSubAssignment] = useState("");
  const [customSubAssignment, setCustomSubAssignment] = useState("");
  const [companyUsers, setCompanyUsers] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [slaConfigs, setSlaConfigs] = useState([]);
  const [now, setNow] = useState(new Date());

  // Update current time every minute for live duration calculations matching TicketList[cite: 1]
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

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

  // Check if current user is restricted (i.e. not Manager or Super Admin)[cite: 1]
  const userRoleStr = (user?.role || "").toLowerCase();
  const isManagerOrAdmin = ["manager", "super admin", "admin"].some(r => userRoleStr.includes(r));
  const isRestricted = !isManagerOrAdmin;

  const ticket = useMemo(() => {
    if (!tickets) return null;
    return tickets.find(
      (t) => String(t._id) === String(id) || String(t.ticketId) === String(id)
    );
  }, [tickets, id]);

  const isResolvedState = ["closed", "resolved", "completed", "done"].includes((ticket?.status || "").toLowerCase());

  // Compute if primary assignee is present[cite: 1]
  const isPrimaryAssigned = useMemo(() => {
    if (!ticket) return false;
    let rawAssignee = ticket.assignee || ticket.assignedTo || ticket.assigned_to || "Unassigned";
    if (typeof rawAssignee === "object" && rawAssignee !== null) {
      rawAssignee = rawAssignee.name || rawAssignee.fullName || rawAssignee.email || "Unassigned";
    }
    const assigneeName = typeof rawAssignee === "string" ? rawAssignee.trim() : "Unassigned";
    return assigneeName.toLowerCase() !== "unassigned" && assigneeName !== "";
  }, [ticket]);

  // Check if current user is the primary assignee[cite: 1]
  const currentUserName = (user?.name || user?.username || "").trim().toLowerCase();
  
  let rawAssigneeObj = ticket?.assignee || ticket?.assignedTo || ticket?.assigned_to || "";
  if (typeof rawAssigneeObj === "object" && rawAssigneeObj !== null) {
    rawAssigneeObj = rawAssigneeObj.name || rawAssigneeObj.fullName || rawAssigneeObj.email || "";
  }
  const primaryAssigneeName = (typeof rawAssigneeObj === "string" ? rawAssigneeObj : "").trim().toLowerCase();
  const isCurrentUserPrimaryAssigned = primaryAssigneeName !== "" && currentUserName === primaryAssigneeName;

  // Check if ticket has a sub-assignment active[cite: 1]
  const hasSubAssignment = useMemo(() => {
    if (!ticket) return false;
    let rawSub = ticket.subAssignment || ticket.sub_assignment || ticket.subAssignedTo || ticket.sub_assigned_to || "";
    if (typeof rawSub === "object" && rawSub !== null) {
      rawSub = rawSub.name || rawSub.fullName || rawSub.email || "";
    }
    const subName = typeof rawSub === "string" ? rawSub.trim() : "";
    return subName !== "" && subName.toLowerCase() !== "unassigned";
  }, [ticket]);

  // Check if current user is the sub-assignee[cite: 1]
  let rawSubAssigneeObj = ticket?.subAssignment || ticket?.sub_assignment || ticket?.subAssignedTo || ticket?.sub_assigned_to || "";
  if (typeof rawSubAssigneeObj === "object" && rawSubAssigneeObj !== null) {
    rawSubAssigneeObj = rawSubAssigneeObj.name || rawSubAssigneeObj.fullName || rawSubAssigneeObj.email || "";
  }
  const subAssigneeName = (typeof rawSubAssigneeObj === "string" ? rawSubAssigneeObj : "").trim().toLowerCase();
  const isCurrentUserSubAssigned = subAssigneeName !== "" && currentUserName === subAssigneeName;

  // Requirement Check: Lock status if sub-assigned AND the user is NOT the sub-assignee and NOT a manager/admin[cite: 1]
  const isStatusLockedBySubAssignment = hasSubAssignment && !isCurrentUserSubAssigned && !isManagerOrAdmin;

  useEffect(() => {
    if (ticket) {
      setDescription(ticket.description || "");
      
      let rawAssignee = ticket.assignee || ticket.assignedTo || ticket.assigned_to || "Unassigned";
      if (typeof rawAssignee === "object" && rawAssignee !== null) {
        rawAssignee = rawAssignee.name || rawAssignee.fullName || rawAssignee.email || "Unassigned";
      }
      setAssignee(typeof rawAssignee === "string" ? rawAssignee : "Unassigned");

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

  // Duration formatting helper synchronized with TicketList[cite: 1]
  const formatDuration = useCallback((ms) => {
    if (ms === null || ms === undefined || isNaN(ms)) return "—";
    if (ms < 60000) return "Just now";
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours === 0 && mins === 0) return "Just now";
    return `${hours}h ${mins}m`;
  }, []);

  // Computed timing metrics synchronized with backend & TicketList logic[cite: 1]
  const calculatedMetrics = useMemo(() => {
    if (!ticket) return {};

    const isResolved = ["closed", "resolved", "completed", "done"].includes((ticket.status || "").toLowerCase());
    const resolvedAtRaw = ticket.resolvedAt || ticket.resolved_at || ticket.closedAt;
    const resolvedAtTime = isResolved ? (resolvedAtRaw ? new Date(resolvedAtRaw).getTime() : now.getTime()) : null;
    const currentOrResolveTime = isResolved ? resolvedAtTime : now.getTime();

    // Parse Assignee safely[cite: 1]
    let rawAssignee = ticket.assignee || ticket.assignedTo || ticket.assigned_to || "Unassigned";
    if (typeof rawAssignee === "object" && rawAssignee !== null) {
      rawAssignee = rawAssignee.name || rawAssignee.fullName || rawAssignee.email || "Unassigned";
    }
    const assigneeName = typeof rawAssignee === "string" ? rawAssignee : "Unassigned";
    const isAssigned = assigneeName.toLowerCase() !== "unassigned" && assigneeName !== "";

    // Parse Sub-Assignee safely[cite: 1]
    let rawSubAssignee = ticket.subAssignment || ticket.sub_assignment || ticket.subAssignedTo || ticket.sub_assigned_to || "";
    if (typeof rawSubAssignee === "object" && rawSubAssignee !== null) {
      rawSubAssignee = rawSubAssignee.name || rawSubAssignee.fullName || rawSubAssignee.email || "";
    }
    const subAssignmentName = typeof rawSubAssignee === "string" ? rawSubAssignee.trim() : "";
    const isSubAssigned = subAssignmentName !== "" && subAssignmentName.toLowerCase() !== "unassigned" && subAssignmentName !== null;

    const createdAtTime = new Date(ticket.createdAt || ticket.created_at || ticket.timestamp || now).getTime();
    const assignedAtRaw = ticket.assignedAt || ticket.assigned_at || ticket.assignmentTime;
    const assignedAtTime = assignedAtRaw ? new Date(assignedAtRaw).getTime() : createdAtTime;

    const subAssignedAtRaw = ticket.subAssignmentAt || ticket.sub_assigned_at || ticket.subAssignedAt || ticket.sub_assignment_at || (isSubAssigned ? (ticket.updatedAt || ticket.createdAt) : null);
    const subAssignedAtTime = subAssignedAtRaw ? new Date(subAssignedAtRaw).getTime() : null;

    // Primary Assignment Time[cite: 1]
    let primaryAssignmentMs = 0;
    if (isAssigned) {
      const primaryEndTime = (isSubAssigned && subAssignedAtTime) ? subAssignedAtTime : currentOrResolveTime;
      primaryAssignmentMs = Math.max(0, primaryEndTime - assignedAtTime);
    }

    // SLA Active Time (anchored strictly to assignedAt)[cite: 1]
    const slaTimeMs = isAssigned ? Math.max(0, currentOrResolveTime - assignedAtTime) : 0;

    // Sub-Assignment Execution Time[cite: 1]
    let subAssignmentTimeMs = 0;
    if (isSubAssigned && subAssignedAtTime) {
      subAssignmentTimeMs = Math.max(0, currentOrResolveTime - subAssignedAtTime);
    }

    // Total Resolution Time[cite: 1]
    const finalResolutionTimeMs = isResolved ? Math.max(0, resolvedAtTime - createdAtTime) : null;

    return {
      assignmentTimeFormatted: isAssigned ? formatDuration(primaryAssignmentMs) : "Unassigned",
      slaTimeFormatted: isAssigned ? formatDuration(slaTimeMs) : "N/A",
      subAssignmentTimeFormatted: isSubAssigned ? formatDuration(subAssignmentTimeMs) : "Not Sub-Assigned",
      finalResolutionTimeFormatted: isResolved ? formatDuration(finalResolutionTimeMs) : "Pending",
    };
  }, [ticket, now, formatDuration]);

  const calculateDeadline = (category, priority) => {
    const rule = slaConfigs.find(
      (c) => c.category === category && c.priority === (priority || "Medium")
    );
    const hours = rule ? rule.hours : 24;
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  };

  const handleUpdate = async (updatedFields) => {
    if (!ticket) return;

    // Prevent sending requests if status is locked by sub-assignment rules[cite: 1]
    if ('status' in updatedFields && isStatusLockedBySubAssignment) {
      alert("Action blocked: Primary assignees are no longer able to change the ticket status once a ticket is sub-assigned.");
      return;
    }

    let payload = { ...updatedFields };

    if (payload.category) {
      const rule = slaConfigs.find((c) => c.category === payload.category);
      if (rule) payload.priority = rule.priority;
    }

    const newCategory = payload.category || ticket.category;
    const newPriority = payload.priority || ticket.priority;
    payload.slaDeadline = calculateDeadline(newCategory, newPriority);

    // Track Primary Assignee timestamp modifications[cite: 1]
    if ('assignee' in payload) {
      const oldAssignee = ticket.assignee || "Unassigned";
      if (payload.assignee !== oldAssignee && payload.assignee !== "Unassigned") {
        payload.assignedAt = new Date().toISOString();
      } else if (payload.assignee === "Unassigned") {
        payload.assignedAt = null;
      }
    }

    if ('subAssignment' in payload) {
      const finalVal = subAssignment === "custom" ? customSubAssignment : payload.subAssignment;
      payload.subAssignment = finalVal;
      
      if (finalVal && !ticket.subAssignment) {
        payload.subAssignmentAt = new Date().toISOString();
      } else if (finalVal && ticket.subAssignment !== finalVal) {
        payload.subAssignmentAt = new Date().toISOString();
      } else if (!finalVal) {
        payload.subAssignmentAt = null;
      }
    }

    if ('status' in payload) {
      const isNewResolved = ["closed", "resolved", "completed", "done"].includes(payload.status.toLowerCase());
      const isOldResolved = ["closed", "resolved", "completed", "done"].includes((ticket.status || "").toLowerCase());

      if (isNewResolved && !isOldResolved) {
        payload.resolvedAt = new Date().toISOString();
      } else if (!isNewResolved) {
        payload.resolvedAt = null;
      }

      // FIX: Ensure active subAssignment is explicitly carried over on status updates
      // so the backend resolver helper gives resolution credit to the sub-assignee[cite: 1]
      if (!payload.subAssignment && ticket.subAssignment) {
        payload.subAssignment = ticket.subAssignment;
      }
    }

    setIsUpdating(true);
    updateLocalTicket(ticket._id, payload);
    try {
      await axiosInstance.patch(`/tickets/${ticket._id}`, payload);
      await fetchTickets();
    } catch (err) {
      const errorMsg = err.response?.data?.message || "Update failed. Check your permissions.";
      alert(errorMsg);
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

  const isOverdue = ticket.slaDeadline && new Date(ticket.slaDeadline) < new Date() && !isResolvedState;
  const ticketGenerator = ticket.generator || ticket.source || "System / Direct";

  return (
    <div className="h-full bg-slate-50 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        
        {/* Header with Back Button[cite: 1] */}
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-100 transition cursor-pointer"
          >
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <h2 className="text-lg font-bold text-slate-800">Ticket Details: {ticket.ticketId}</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Description Panel & Sub Assignment[cite: 1] */}
          <div className="lg:col-span-2 space-y-6">
            <div 
              className={`bg-white border border-slate-200 rounded-xl shadow-xs p-5 ${!canEditDesc ? 'cursor-not-allowed' : ''}`}
            >
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm">Description</h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting || !canDelete}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 disabled:opacity-50 transition cursor-pointer"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                  <button
                    onClick={() => handleUpdate({ description })}
                    disabled={isUpdating || !canEditDesc}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
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

            {/* Sub Assignment Panel with restriction indicator[cite: 1] */}
            <div 
              className={`bg-white border border-slate-200 rounded-xl shadow-xs p-5 ${isRestricted || !isPrimaryAssigned || isResolvedState ? 'cursor-not-allowed' : ''}`}
              title={
                isResolvedState 
                  ? "Cannot modify sub-assignment for a resolved or closed ticket" 
                  : (!isPrimaryAssigned ? "Please assign a primary assignee before selecting a sub-assignee" : (isRestricted ? "Only Managers and Admins can modify sub-assignments" : ""))
              }
            >
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <UserPlus size={16} className="text-blue-600" /> Sub Assignment
                </h3>
                <button
                  onClick={() => handleUpdate({ subAssignment })}
                  disabled={isUpdating || isRestricted || !isPrimaryAssigned || isResolvedState}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
                >
                  {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Assign
                </button>
              </div>

              {isRestricted && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>Only Managers and Admins can modify sub-assignments.</span>
                </div>
              )}

              {isResolvedState && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>Sub-assignment cannot be changed because this ticket is resolved or closed.</span>
                </div>
              )}

              {!isPrimaryAssigned && !isResolvedState && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>A primary assignee must be selected before a sub-assignee can be assigned.</span>
                </div>
              )}

              <div className="space-y-3">
                <select
                  value={subAssignment}
                  disabled={isRestricted || !isPrimaryAssigned || isResolvedState}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSubAssignment(val);
                    if (val !== "custom") {
                      setCustomSubAssignment("");
                    }
                  }}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  <option value="">Select Company User</option>
                  {companyUsers.map((u) => {
                    const userName = u.name || u.username;
                    const userRole = u.role || 'Member';
                    return (
                      <option key={u._id || u.id} value={userName}>
                        {userName} ({userRole})
                      </option>
                    );
                  })}
                  <option value="custom">Other (Type Custom Text)...</option>
                </select>

                {subAssignment === "custom" && (
                  <input
                    type="text"
                    value={customSubAssignment}
                    disabled={isRestricted || !isPrimaryAssigned || isResolvedState}
                    onChange={(e) => {
                      setCustomSubAssignment(e.target.value);
                    }}
                    placeholder="Enter custom sub assignment text..."
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Properties & Live Durations[cite: 1] */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 space-y-4">
              <h3 className="text-xs font-bold flex items-center gap-2 text-slate-700">
                <ShieldAlert size={14} className="text-blue-600" /> Properties
              </h3>

              {/* Creator / Entry Generator Info[cite: 1] */}
              <div className="pb-2 border-b border-slate-100">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Cpu size={10} /> Created By / Generator
                </label>
                <div className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold bg-slate-50 text-slate-700">
                  {ticketGenerator}
                </div>
              </div>

              {/* Primary Assignee Panel with Manager/Admin Restriction[cite: 1] */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <UserCheck size={10} /> Assignee (Primary)
                  </label>
                  {!isRestricted && (
                    <button
                      onClick={() => handleUpdate({ assignee })}
                      disabled={isUpdating || isResolvedState}
                      className="text-[10px] text-blue-600 font-semibold hover:underline cursor-pointer disabled:opacity-50"
                    >
                      Update
                    </button>
                  )}
                </div>
                <select 
                  disabled={isRestricted || isResolvedState} 
                  value={assignee} 
                  onChange={(e) => setAssignee(e.target.value)}
                  title={isRestricted ? "Only Managers and Admins can change assignees" : ""}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed bg-slate-50"
                >
                  <option value="Unassigned">Unassigned</option>
                  {companyUsers.map((u) => {
                    const userName = u.name || u.username;
                    const userRole = u.role || 'Member';
                    return (
                      <option key={u._id || u.id} value={userName}>
                        {userName} ({userRole})
                      </option>
                    );
                  })}
                </select>
                {isRestricted && (
                  <span className="text-[9px] text-slate-400 mt-0.5 block">Locked: Only Admins/Managers can reassign.</span>
                )}
              </div>

              {/* Status Section with Sub-Assignment Lock[cite: 1] */}
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Status</label>
                <select 
                  disabled={!canEditStatus || isStatusLockedBySubAssignment} 
                  value={ticket.status || "Open"} 
                  onChange={(e) => handleUpdate({ status: e.target.value })} 
                  title={isStatusLockedBySubAssignment ? "Primary assignees cannot change ticket status once sub-assigned" : ""}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  {["Open", "In Progress", "Resolved"].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                {isStatusLockedBySubAssignment && (
                  <span className="text-[9px] text-amber-600 mt-0.5 block">Status change locked because ticket is sub-assigned.</span>
                )}
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Priority (Auto)</label>
                <input disabled value={ticket.priority || "Medium"} className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-500 cursor-not-allowed" />
              </div>

              {/* Category with restriction hover & disabled states[cite: 1] */}
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Category</label>
                <select 
                  disabled={!canEditCategory || isRestricted || isResolvedState} 
                  value={ticket.category || ""} 
                  onChange={(e) => handleUpdate({ category: e.target.value })} 
                  title={
                    isResolvedState 
                      ? "Cannot modify category for a resolved or closed ticket" 
                      : (isRestricted ? "You do not have permission to modify this category" : "")
                  }
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
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

              {/* Synchronized Active Duration Trackers[cite: 1] */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Primary Assignment Duration</span>
                  <div className="text-xs font-semibold text-slate-700 mt-0.5 bg-slate-50 p-2 border border-slate-200 rounded-lg">
                    {calculatedMetrics.assignmentTimeFormatted}
                  </div>
                </div>

                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">SLA Active Time</span>
                  <div className="text-xs font-semibold text-blue-700 mt-0.5 bg-blue-50/50 p-2 border border-blue-100 rounded-lg">
                    {calculatedMetrics.slaTimeFormatted}
                  </div>
                </div>

                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Sub-Assignment Active Time</span>
                  <div className="text-xs font-semibold text-purple-700 mt-0.5 bg-purple-50/50 p-2 border border-purple-100 rounded-lg">
                    {calculatedMetrics.subAssignmentTimeFormatted}
                  </div>
                </div>

                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Resolution Duration</span>
                  <div className="text-xs font-semibold text-emerald-700 mt-0.5 bg-emerald-50/50 p-2 border border-emerald-100 rounded-lg">
                    {calculatedMetrics.finalResolutionTimeFormatted}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block flex items-center gap-1">
                  <Calendar size={10} /> Sub Assignment Timestamp
                </label>
                <div className="w-full p-2 border border-slate-200 rounded-lg text-xs font-medium bg-slate-50 text-slate-600">
                  {ticket.subAssignmentAt ? new Date(ticket.subAssignmentAt).toLocaleString() : "Not Sub-assigned Yet"}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block flex items-center gap-1">
                  <Calendar size={10} /> Resolved Timestamp
                </label>
                <div className="w-full p-2 border border-slate-200 rounded-lg text-xs font-medium bg-slate-50 text-slate-600">
                  {ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleString() : "Not Resolved Yet"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetail;