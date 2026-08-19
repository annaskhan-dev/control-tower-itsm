import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TicketProvider } from './context/TicketContext';
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
import DriverSupportLogs from './components/DriverSupportLogs';
import { Menu, X } from 'lucide-react';

// Dedicated helper component to safely redirect users based on role upon login/root hit
function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  const userRole = (user?.role || '').toLowerCase();
  const isRestrictedRole = ['operator', 'transporter', 'agent', 'shipper ops', 'sales person'].some(
    r => userRole.includes(r)
  );

  return <Navigate to={isRestrictedRole ? "/tickets?queue=all" : "/dashboard"} replace />;
}

function MainLayout() {
  const { user, logout } = useAuth();
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const userRole = (user?.role || '').toLowerCase();
  const isRestrictedRole = ['operator', 'transporter', 'agent', 'shipper ops', 'sales person'].some(
    r => userRole.includes(r)
  );
  const defaultHomeRoute = isRestrictedRole ? "/tickets?queue=all" : "/dashboard";

  return (
    <div className="flex h-screen bg-slate-100 relative overflow-x-hidden">
      
      {/* Mobile Top Header Bar (Only visible on phones/tablets) */}
      {user && (
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
      )}

      {/* Sidebar only shows if logged in, passes mobile props */}
      {user && (
        <Sidebar 
          user={user} 
          onOpenCreateTicket={() => setIsTicketModalOpen(true)} 
          onLogout={logout}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />
      )}
      
      <main className={`flex-1 w-full min-w-0 ${user ? 'p-4 pt-20 lg:pt-4 overflow-y-auto' : ''}`}>
        <Routes>
          {/* Public & Root Smart Routing */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes - Dashboard restricted to Super Admin / Manager */}
          <Route path="/dashboard" element={
            isRestrictedRole ? <Navigate to="/tickets?queue=all" replace /> : (
              <ProtectedRoute allowedRoles={['Super Admin', 'Manager']}> <Dashboard /> </ProtectedRoute>
            )
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

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to={defaultHomeRoute} replace />} />
        </Routes>
      </main>

      {user && isTicketModalOpen && (
        <CreateTicketModal onClose={() => setIsTicketModalOpen(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TicketProvider> 
        <Router>
          <MainLayout />
          <DriverSupportLogs />
        </Router>
      </TicketProvider>
    </AuthProvider>
  );
}