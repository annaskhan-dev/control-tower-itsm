import React, { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { createTicket, fetchSlaConfigs } from "../../api/ticketApi";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

// Comprehensive issue type classification mapping categories to relevant subcategories
const ISSUE_CLASSIFICATIONS = {
  "Logistics & Transport": [
    "Delayed Shipment",
    "Route Deviation",
    "Vehicle Breakdown",
    "Missing Cargo",
    "Customs Clearance Delay"
  ],
  "System & Software": [
    "Control Tower UI Bug",
    "Authentication / Login Failure",
    "API Integration Error",
    "Data Sync Delay",
    "Report Generation Error"
  ],
  "Billing & Invoicing": [
    "Incorrect Freight Charges",
    "Delayed Invoice Generation",
    "Payment Gateway Error",
    "Disputed Toll / Extra Fees"
  ],
  "Warehouse & Inventory": [
    "Discrepancy in Stock Count",
    "Damaged Goods on Arrival",
    "Delayed Loading / Unloading",
    "Scanning Error"
  ],
  "General Inquiry": [
    "Service Level Agreement (SLA) Question",
    "Account Permissions / Access Request",
    "Vendor Onboarding Support",
    "Other Support Request"
  ]
};

export const CreateTicketModal = ({ onClose, onSubmit }) => {
  const { token, user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slaConfigs, setSlaConfigs] = useState([]);
  const [users, setUsers] = useState([]);

  const [formData, setFormData] = useState({
    title: "",
    type: "Incident",
    priority: "Medium",
    assignee: "Unassigned",
    category: "", 
    issueCategory: "",    // Parent classification category
    issueSubcategory: "", // Specific subcategory for deep analytics
    description: "",
    slaDeadline: "", 
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

  const handleIssueCategoryChange = (e) => {
    const selectedCategory = e.target.value;
    setFormData((prev) => ({
      ...prev,
      issueCategory: selectedCategory,
      issueSubcategory: "" // Reset subcategory when parent category changes
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || isSubmitting) return;

    setIsSubmitting(true);

    const ticketGenerator = user?.role || user?.name || user?.username || "Operator";

    const payload = {
      ...formData,
      generator: ticketGenerator,
      source: "Control Tower UI"
    };

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

  const availableSubcategories = formData.issueCategory ? ISSUE_CLASSIFICATIONS[formData.issueCategory] || [] : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-4 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-slate-800">Create New Ticket</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5 text-xs">
          <div>
            <label className="block text-slate-600 font-semibold mb-0.5">Ticket Title</label>
            <input
              type="text"
              required
              placeholder="Write the title..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
            />
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
              <label className="block text-slate-600 font-semibold mb-0.5">Priority</label>
              <input
                type="text"
                disabled
                value={formData.priority}
                className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl outline-none text-slate-500 cursor-not-allowed"
              />
              <div className="mt-0.5 pt-0.5 border-t border-red-500 text-red-500 font-medium text-[10px]">
                SLA: {formData.slaDeadline || "---"}
              </div>
            </div>

            <div>
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

            <div>
              <label className="block text-slate-600 font-semibold mb-0.5">Category (SLA Config)</label>
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
          </div>

          {/* Issue Type Classification Section */}
          <div className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-2">
            <span className="font-bold text-slate-700 block tracking-wide uppercase text-[10px]">
              Issue Type Classification
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-semibold mb-0.5">Issue Category</label>
                <select
                  value={formData.issueCategory}
                  onChange={handleIssueCategoryChange}
                  required
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                >
                  <option value="">Select classification...</option>
                  {Object.keys(ISSUE_CLASSIFICATIONS).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-0.5">Issue Subcategory</label>
                <select
                  value={formData.issueSubcategory}
                  onChange={(e) => setFormData({ ...formData, issueSubcategory: e.target.value })}
                  required
                  disabled={!formData.issueCategory}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed text-slate-700"
                >
                  <option value="">Select subcategory...</option>
                  {availableSubcategories.map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
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