import React from 'react';
import { Sidebar } from './Sidebar';
import { useAuth } from '../context/AuthContext'; // Update this path to match your file structure

export const Layout = ({ children }) => {
  // Use the hook to get the user from your AuthContext
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-slate-100/70 text-slate-800 overflow-hidden font-sans p-4 gap-4">
      {/* Sidebar now gets the user directly from Context */}
      <Sidebar user={user} />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-50/60 rounded-3xl border border-slate-200/80 p-6 shadow-sm">
        {children}
      </main>
    </div>
  );
};