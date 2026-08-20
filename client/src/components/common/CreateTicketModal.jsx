import React, { useState, useEffect } from "react";

import { X, Loader2 } from "lucide-react";

import { createTicket, fetchSlaConfigs } from "../../api/ticketApi";

import { useAuth } from "../../context/AuthContext";

import api from "../../services/api"; // Ensure this points to your configured axios instance or fetch utility



export const CreateTicketModal = ({ onClose, onSubmit }) => {

  const { token, user } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [slaConfigs, setSlaConfigs] = useState([]);

  const [users, setUsers] = useState([]); // State to hold real user records



  const [formData, setFormData] = useState({

    title: "",

    type: "Incident",

    priority: "Medium",

    assignee: "Unassigned",

    category: "",

    description: "",

    slaDeadline: "",

  });



  useEffect(() => {

    const loadConfigsAndUsers = async () => {

      try {

        // Fetch SLA Configurations and Users list concurrently

        const [slaData, usersResponse] = await Promise.all([

          fetchSlaConfigs(),

          api.get("/users", { headers: { Authorization: `Bearer ${token}` } })

        ]);

       

        setSlaConfigs(slaData || []);

        // Handle different response structures (e.g. usersResponse.data or direct array)

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

    if (!formData.title.trim() || isSubmitting) return;



    setIsSubmitting(true);



    // Prioritize user's role for the generator grouping, falling back to name/username or "Operator"

    const ticketGenerator = user?.role || user?.name || user?.username || "Operator";



    // Combine form state with generator and source tracking metadata

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