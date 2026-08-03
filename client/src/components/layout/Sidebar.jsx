import React from 'react';
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
  Clock 
} from 'lucide-react';

export const Sidebar = ({ onOpenCreateTicket, onLogout, user }) => {
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

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'All Work', path: '/tickets?queue=all', icon: Inbox },
    { label: 'My Work', path: '/tickets?queue=my-work', icon: UserCheck },
    { label: 'Unassigned', path: '/tickets?queue=unassigned', icon: InboxIcon },
    { label: 'SLA Risk', path: '/tickets?queue=sla-risk', icon: AlertTriangle },
    { label: 'SLA Settings', path: '/sla', icon: Clock },
    { label: 'User Management', path: '/users', icon: Users },
  ];

  const checkIsActive = (itemPath) => {
    const currentFull = location.pathname + location.search;
    if (itemPath === '/dashboard' || itemPath === '/users' || itemPath === '/sla') {
      return location.pathname === itemPath;
    }
    return currentFull === itemPath || (itemPath === '/tickets?queue=all' && location.pathname === '/tickets' && !location.search);
  };

  return (
    <aside className="w-56 bg-[#13203B] text-slate-200 flex flex-col justify-between p-3.5 h-screen shrink-0 font-sans border-r border-slate-800 z-20 select-none overflow-hidden">
      
      {/* Top Section */}
      <div className="shrink-0 space-y-3 mb-4">
        <div className="flex items-center gap-2.5 px-2 py-1 border-b border-white/10">
          <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-white text-xs shadow-sm">CT</div>
          <div>
            <h1 className="font-semibold text-white text-[13px] tracking-wide leading-tight">Control Tower</h1>
            <span className="text-[9px] text-slate-400 block leading-none">ITSM Platform</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleNewTicketClick}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-semibold transition-all shadow-md"
        >
          <PlusCircle size={15} />
          <span>New Ticket</span>
        </button>
      </div>

      {/* Middle Section: Navigation with hidden scrollbar */}
      <nav className="flex-1 overflow-y-auto space-y-1 pr-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = checkIsActive(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive ? 'bg-blue-600/30 text-white border-l-2 border-blue-400 font-semibold shadow-2xs' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={15} className={isActive ? 'text-blue-400' : 'text-slate-400'} />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Section: Footer (Pinned) */}
      <div className="shrink-0 border-t border-white/10 pt-3 mt-2">
        <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-black/40 border border-white/5">
          <div className="flex items-center gap-2 truncate min-w-0">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
              {getInitials(user?.name)}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs font-semibold text-white leading-tight truncate">{user?.name || 'User'}</span>
              <span className="text-[9px] text-blue-300 flex items-center gap-0.5 truncate">
                <ShieldCheck size={9} /> {user?.role || 'User'}
              </span>
            </div>
          </div>
          <button type="button" onClick={handleLogoutClick} className="p-2 text-slate-300 hover:text-rose-400 rounded-lg hover:bg-white/10 transition cursor-pointer shrink-0">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
};