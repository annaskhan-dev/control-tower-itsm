import React from 'react';

export const Badge = ({ type = 'status', value }) => {
  const getStyles = () => {
    if (type === 'priority') {
      switch (value) {
        case 'Critical': return 'bg-rose-50 text-rose-700 border-rose-200';
        case 'High': return 'bg-orange-50 text-orange-700 border-orange-200';
        case 'Medium': return 'bg-amber-50 text-amber-700 border-amber-200';
        default: return 'bg-slate-100 text-slate-600 border-slate-200';
      }
    }

    if (type === 'sla') {
      switch (value) {
        case 'Breached': return 'bg-rose-600 text-white font-semibold';
        case 'Due Soon': return 'bg-amber-500 text-white font-semibold';
        default: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      }
    }

    switch (value) {
      case 'New': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'In Progress': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Pending Approval': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Resolved': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Closed': return 'bg-slate-100 text-slate-600 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] leading-tight font-medium rounded border whitespace-nowrap ${getStyles()}`}>
      {value}
    </span>
  );
};