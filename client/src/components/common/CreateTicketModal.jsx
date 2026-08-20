import React, { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { createTicket, fetchSlaConfigs } from "../../api/ticketApi";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

const TICKET_TITLES = [
  "Cross Docking Report",
  "Road Blockage & Upcoming Events",
  "Halting Verification",
  "Tracker Fault Pareto",
  "Live Tracking of In-Transit Orders",
  "OTD Report Monitoring"
];

const ISSUE_TYPES = [
  "Vehicle Crossdock",
  "Public Holiday",
  "Vehicle Stoppages",
  "Tracker Faulty",
  "Order Stuck"
];

export const CreateTicketModal = ({ onClose, onSubmit }) => {
  const { token, user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slaConfigs, setSlaConfigs] = useState([]);
  const [users, setUsers] = useState([]);

  const [formData, setFormData] = useState({
    title: "",
    type: "Incident",
    category: "",
    priority: "Medium",
    slaDeadline: "",
    issueType: "",
    assignee: "Unassigned",
    description: "",
  });

  useEffect(() => {
    const loadConfigsAndUsers = async () => {
      try {
        const [slaData, usersResponse] = await Promise.all([
          fetchSlaConfigs(),
          api.get("/users", { headers: { Authorization: `Bearer ${token}` } })
        ]);
        
        setSlaConfigs(slaData || []);
        const userData = usersResponse.data?.users || usersResponse.data || usersResponse;
        setUsers(Array.isArray(userData) ? userData : []);
      } catch (error) {
        console.error("Failed to fetch initial modal data:", error);
      }
    };
    loadConfigsAndUsers();
  }, [token]);

  const handleCategoryChange = (categoryName) => {
    const config = slaConfigs.find((c) => c.category === categoryName);
    
    setFormData((prev) => ({
      ...prev,
      category: categoryName,
      priority: config ? config.priority : "Medium",
      slaDeadline: config ? `${config.hours} hours` : "", 
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation: Ensure required fields are filled
    if (!formData.title.trim()) return alert("Please select a title");
    if (!formData.issueType) return alert("Please select an issue type");
    if (!formData.category) return alert("Please select a category");
    if (isSubmitting) return;

    setIsSubmitting(true);

    // Build clean payload without hardcoded generator/source.
    // The NestJS backend will automatically inject the authenticated user identity and role.
    const payload = {
      ...formData,
    };

    // Remove UI-only fields that the backend doesn't expect
    delete payload.slaDeadline;

    try {
      await createTicket(payload, token);
      if (onSubmit) onSubmit();
      onClose();
    } catch (error) {
      console.error("Failed to create ticket:", error);
      alert("Error creating ticket. Please check console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-slate-800">Create New Ticket</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2 text-xs">
          <div>
            <label className="block text-slate-600 font-semibold mb-0.5">Ticket Title</label>
            <select
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
            >
              <option value="">Select a title...</option>
              {TICKET_TITLES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-semibold mb-0.5">Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
              >
                {["Incident", "Service Request", "Problem"].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-0.5">Issue Type</label>
              <select
                value={formData.issueType}
                onChange={(e) => setFormData({ ...formData, issueType: e.target.value })}
                required
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
              >
                <option value="">Select issue type...</option>
                {ISSUE_TYPES.map((it) => (
                  <option key={it} value={it}>{it}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-0.5">Category</label>
              <select
                value={formData.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
              >
                <option value="">Select a category</option>
                {slaConfigs.map((c) => (
                  <option key={c._id || c.category} value={c.category}>
                    {c.category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-0.5">Priority</label>
              <div className="flex items-center gap-2 w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500">
                <span className="font-medium flex-1">{formData.priority}</span>
                <span className="text-red-500 font-semibold text-[11px] whitespace-nowrap">
                  SLA: {formData.slaDeadline || "---"}
                </span>
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-slate-600 font-semibold mb-0.5">Assignee</label>
              <select
                value={formData.assignee}
                onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
              >
                <option value="Unassigned">Unassigned</option>
                {users.map((u) => {
                  const userName = u.name || u.username;
                  const userRole = u.role || 'Member';
                  const displayLabel = `${userName} (${userRole})`;
                  return (
                    <option key={u._id || u.id || userName} value={userName}>
                      {displayLabel}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-600 font-semibold mb-0.5">Description</label>
            <textarea
              placeholder="Provide details..."
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting && <Loader2 size={12} className="animate-spin" />}
              {isSubmitting ? "Creating..." : "Create Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};