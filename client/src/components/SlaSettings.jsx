import React, { useState, useEffect } from 'react';
import { Clock, Plus, Settings, Loader2, Trash2 } from 'lucide-react'; // Added Trash2
import { AddCategoryModal } from "./AddCategoryModal"; 
import { fetchSlaConfigs, updateSlaPriority, deleteSlaCategory } from '../api/ticketApi'; 

export const SlaSettings = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [slaConfigs, setSlaConfigs] = useState([]);

  useEffect(() => {
    fetchSlaData();
  }, []);

  const fetchSlaData = async () => {
    try {
      setLoading(true);
      const data = await fetchSlaConfigs();
      console.log("Full Data Received:", data); // DEBUG: Check if 'priority' exists here
      setSlaConfigs(data || []);
    } catch (error) {
      console.error("Error fetching SLA data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this rule?")) return;
    try {
      await deleteSlaCategory(id);
      fetchSlaData(); // Refresh list after deletion
    } catch (error) {
      console.error("Error deleting rule:", error);
      alert("Failed to delete.");
    }
  };

  const handleUpdateHours = async (id, newHours) => {
    setSlaConfigs(slaConfigs.map(s => s._id === id ? { ...s, hours: newHours } : s));
    try {
      await updateSlaPriority(id, newHours);
    } catch (error) {
      fetchSlaData();
    }
  };

  const getPriorityColor = (priority) => {
    // If priority is missing, force a grey 'Not Set' style
    if (!priority || priority === "Not Set") return 'bg-gray-100 text-gray-500';
    
    switch (priority.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-600 rounded-lg text-white">
            <Settings size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">SLA Configuration</h1>
            <p className="text-gray-500 text-xs">Manage response times and priority rules</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Clock size={16} className="text-blue-600" /> SLA Rules
              </h2>
              <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
                <Plus size={14} /> Add Rule
              </button>
            </div>

            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase font-bold">
                <tr>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Priority Level</th>
                  <th className="px-4 py-3 text-left">Hours</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {slaConfigs.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-gray-800">{s.category || "N/A"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getPriorityColor(s.priority)}`}>
                        {s.priority || "Not Set"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="number" 
                        value={s.hours || 0}
                        onChange={(e) => handleUpdateHours(s._id, parseInt(e.target.value))}
                        className="w-16 border border-gray-300 rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleDelete(s._id)} className="text-red-500 hover:text-red-700">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {isModalOpen && <AddCategoryModal onClose={() => setIsModalOpen(false)} onRefresh={fetchSlaData} />}
    </div>
  );
};