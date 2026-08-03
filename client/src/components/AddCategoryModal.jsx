import React, { useState } from 'react';
import { createSlaCategory } from '../api/ticketApi'; // Use the API service we defined

export const AddCategoryModal = ({ onClose, onRefresh }) => {
  const [name, setName] = useState('');
  const [priority, setPriority] = useState('Medium'); // Default to Medium
  const [hours, setHours] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !hours || !priority) return alert("Please fill in all fields");
    
    setSaving(true);
    try {
      // Sending the complete rule object to the backend
      await createSlaCategory({ 
        category: name, 
        priority: priority,
        hours: parseInt(hours) 
      });
      
      onRefresh(); 
      onClose();   
    } catch (error) {
      console.error("Error saving category:", error);
      alert("Failed to save category. Please ensure you have appropriate permissions.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-96">
        <h3 className="text-lg font-bold mb-4">Add SLA Rule</h3>
        <div className="space-y-4">
          
          {/* Category Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Category Name</label>
            <input 
              className="w-full border border-gray-300 rounded-lg p-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder="e.g. Fleet / Vehicle"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Priority Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Priority Level</label>
            <select 
              className="w-full border border-gray-300 rounded-lg p-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          {/* Hours Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700">SLA Time (Hours)</label>
            <input 
              type="number"
              className="w-full border border-gray-300 rounded-lg p-2 mt-1 focus:ring-2 focus:ring-blue-500 outline-none" 
              placeholder="e.g. 24"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>

        </div>

        <div className="flex gap-2 justify-end mt-6">
          <button 
            onClick={onClose} 
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 font-medium"
          >
            {saving ? 'Saving...' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  );
};