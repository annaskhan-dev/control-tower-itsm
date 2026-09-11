import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TicketProvider, useTickets } from './context/TicketContext';
import { Sidebar } from './components/layout/Sidebar';
import ProtectedRoute from './components/common/ProtectedRoute'; 
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { TicketList } from './pages/TicketList';
import { TicketDetail } from './pages/TicketDetail';
import { UserManagement } from './pages/UserManagement';
import { SlaSettings } from './components/SlaSettings';
import { CreateTicketModal } from './components/common/CreateTicketModal';
import { Menu, X } from 'lucide-react';

// Dedicated helper component to safely redirect users based on role upon login/root hit
function RootRedirect() {
  const { user, isLoading } = useAuth();

  // Wait for localStorage sync to complete before making redirect decisions
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 text-slate-500 font-medium">
        Loading Control Tower...
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const userRole = (user?.role || '').toLowerCase();
  const isRestrictedRole = ['operator', 'transporter', 'agent', 'shipper ops', 'sales person'].some(
    r => userRole.includes(r)
  );

  return <Navigate to={isRestrictedRole ? "/tickets?queue=all-work" : "/dashboard"} replace />;
}

// Layout wrapper used ONLY for authenticated screens (contains Sidebar & Navbar)
function AuthenticatedLayout() {
  const { user, logout } = useAuth();
  const { fetchTickets } = useTickets();
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-100 relative overflow-x-hidden">
      {/* Mobile Top Header Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#13203B] border-b border-slate-800 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-white text-xs">CT</div>
          <span className="font-bold text-white text-sm tracking-wide">Control Tower</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-slate-200 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
          aria-label="Toggle Menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <Sidebar 
        user={user} 
        onOpenCreateTicket={() => setIsTicketModalOpen(true)} 
        onLogout={logout}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />
      
      {/* Main Content Area */}
      <main className="flex-1 w-full min-w-0 p-4 pt-20 lg:pt-4 overflow-y-auto">
        <Routes>
          {/* Protected Routes - Dashboard restricted to Super Admin / Manager */}
          <Route path="/dashboard" element={
            <ProtectedRoute allowedRoles={['Super Admin', 'Manager']}> <Dashboard /> </ProtectedRoute>
          } />
          
          <Route path="/tickets" element={
            <ProtectedRoute> <TicketList onOpenCreateTicket={() => setIsTicketModalOpen(true)} /> </ProtectedRoute>
          } />

          <Route path="/tickets/:id" element={
            <ProtectedRoute> <TicketDetail /> </ProtectedRoute>
          } />

          {/* Role-Restricted Routes */}
          <Route path="/users" element={
            <ProtectedRoute allowedRoles={['Super Admin', 'Manager']}> <UserManagement /> </ProtectedRoute>
          } />

          {/* SLA Settings Route */}
          <Route path="/sla" element={
            <ProtectedRoute allowedRoles={['Super Admin', 'Manager']}> <SlaSettings /> </ProtectedRoute>
          } />

          {/* Fallback inside dashboard layout */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>

      {isTicketModalOpen && (
        <CreateTicketModal 
          onClose={() => setIsTicketModalOpen(false)} 
          onSubmit={fetchTickets}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TicketProvider> 
        <Router>
          <Routes>
            {/* Public Routes (No Sidebar) */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* All Authenticated/Sidebar Routes handled inside AuthenticatedLayout */}
            <Route path="/*" element={
              <ProtectedRoute>
                <AuthenticatedLayout />
              </ProtectedRoute>
            } />
          </Routes>
        </Router>
      </TicketProvider> 
    </AuthProvider>
  );
}