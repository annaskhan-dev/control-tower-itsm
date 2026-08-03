import React, { useEffect, useState } from 'react';
import axiosInstance from '../api/axiosInstance';

export default function DriverSupportLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      // FIXED: Removed the /api prefix here. 
      // Because your axiosInstance baseURL already includes /api, 
      // you just need the endpoint path '/driver-support'
      const res = await axiosInstance.get('/driver-support');
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  if (loading) return <div className="p-4 text-gray-400">Loading support logs...</div>;

  return (
    <div className="p-6 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-800">
      <h2 className="text-xl font-bold mb-4 text-slate-100">Driver Support Logs</h2>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800 text-slate-400 uppercase text-xs">
            <tr>
              <th className="p-3">Support ID</th>
              <th className="p-3">Driver Name</th>
              <th className="p-3">Order ID</th>
              <th className="p-3">Category</th>
              <th className="p-3">Status</th>
              <th className="p-3">SLA Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id} className="border-b border-slate-800 hover:bg-slate-800/50">
                <td className="p-3 font-mono text-indigo-400">{log.supportId}</td>
                <td className="p-3 font-medium text-slate-200">{log.driverName}</td>
                <td className="p-3 text-slate-400">{log.orderId}</td>
                <td className="p-3">{log.category}</td>
                <td className="p-3">
                  <span className="px-2 py-1 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {log.status}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs border ${
                    log.slaStatus === 'Breached' 
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}>
                    {log.slaStatus || 'On Track'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}