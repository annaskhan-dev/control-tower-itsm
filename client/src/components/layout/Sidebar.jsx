import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Inbox, 
  UserCheck, 
  InboxIcon, 
  AlertTriangle, 
  Users, 
  ShieldCheck,
  LogOut,
  PlusCircle,
  Clock,
  Menu, 
  X 
} from 'lucide-react';

export const Sidebar = ({ onOpenCreateTicket, onLogout, user, mobileOpen, setMobileOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Helper to generate initials from dynamic user name
  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleLogoutClick = (e) => {
    e.preventDefault();
    localStorage.clear();
    sessionStorage.clear();
    if (onLogout) onLogout();
    navigate ? navigate('/login') : (window.location.href = '/login');
  };

  const handleNewTicketClick = (e) => {
    e.preventDefault();
    if (onOpenCreateTicket) onOpenCreateTicket();
  };

  // Define nav items with allowed roles matching backend permissions
  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['Super Admin', 'Manager', 'Operator', 'Agent', 'Transporter', 'Shipper Ops', 'Sales Person'] },
    { label: 'All Work', path: '/tickets?queue=all', icon: Inbox, roles: ['Super Admin', 'Manager', 'Operator', 'Agent'] },
    { label: 'My Work', path: '/tickets?queue=my-work', icon: UserCheck, roles: ['Super Admin', 'Manager', 'Operator', 'Agent', 'Transporter', 'Shipper Ops', 'Sales Person'] },
    { label: 'Unassigned', path: '/tickets?queue=unassigned', icon: InboxIcon, roles: ['Super Admin', 'Manager', 'Operator', 'Agent'] },
    { label: 'SLA Risk', path: '/tickets?queue=sla-risk', icon: AlertTriangle, roles: ['Super Admin', 'Manager', 'Operator', 'Agent'] },
    { label: 'SLA Settings', path: '/sla', icon: Clock, roles: ['Super Admin', 'Manager'] },
    { label: 'User Management', path: '/users', icon: Users, roles: ['Super Admin', 'Manager'] },
  ];

  // Normalize user role or fallback to empty string
  const userRole = user?.role || '';

  // Filter navigation items based on user role permissions
  const filteredNavItems = navItems.filter(item => {
    if (!item.roles) return true;
    // Case-insensitive / format tolerant role matching
    return item.roles.some(r => r.toLowerCase() === userRole.toLowerCase() || r.replace(/\s+/g, '_').toLowerCase() === userRole.replace(/\s+/g, '_').toLowerCase());
  });

  const checkIsActive = (itemPath) => {
    const currentFull = location.pathname + location.search;
    if (itemPath === '/dashboard' || itemPath === '/users' || itemPath === '/sla') {
      return location.pathname === itemPath;
    }
    return currentFull === itemPath || (itemPath === '/tickets?queue=all' && location.pathname === '/tickets' && !location.search);
  };

  return (
    <>
      <aside className={`w-72 bg-[#13203B] text-slate-200 flex flex-col justify-between p-5 h-screen shrink-0 font-sans border-r border-slate-800 z-40 select-none overflow-hidden fixed inset-y-0 left-0 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Top Section */}
        <div className="shrink-0 space-y-4 mb-6">
          <div className="flex items-center gap-3 px-2 py-2 border-b border-white/15">
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center font-bold text-white text-sm shadow-md">CT</div>
            <div>
              <h1 className="font-bold text-white text-base tracking-wide leading-tight">Control Tower</h1>
              <span className="text-xs text-slate-400 block leading-none mt-1">ITSM Platform</span>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              if (setMobileOpen) setMobileOpen(false);
              handleNewTicketClick(e);
            }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-2xl text-sm font-semibold transition-all shadow-lg shadow-blue-600/30 cursor-pointer"
          >
            <PlusCircle size={18} />
            <span>New Ticket</span>
          </button>
        </div>

        {/* Middle Section: Navigation with hidden scrollbar */}
        <nav className="flex-1 overflow-y-auto space-y-1.5 pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = checkIsActive(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => {
                  if (setMobileOpen) setMobileOpen(false);
                }}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                  isActive ? 'bg-blue-600/30 text-white border-l-4 border-blue-400 font-semibold shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-blue-400' : 'text-slate-400'} />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Section: Footer (Pinned) */}
        <div className="shrink-0 border-t border-white/10 pt-4 mt-3">
          <div className="flex items-center justify-between px-3.5 py-3 rounded-2xl bg-black/40 border border-white/5">
            <div className="flex items-center gap-3 truncate min-w-0">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-md">
                {getInitials(user?.name)}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-sm font-semibold text-white leading-tight truncate">{user?.name || 'User'}</span>
                <span className="text-xs text-blue-300 flex items-center gap-1 truncate mt-0.5">
                  <ShieldCheck size={12} /> {user?.role || 'User'}
                </span>
              </div>
            </div>
            <button type="button" onClick={handleLogoutClick} className="p-2.5 text-slate-300 hover:text-rose-400 rounded-xl hover:bg-white/10 transition cursor-pointer shrink-0">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)} 
          className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-2xs transition-opacity"
        />
      )}
    </>
  );
};