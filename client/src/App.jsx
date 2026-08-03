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

function MainLayout() {
  const { user, logout } = useAuth();
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar only shows if logged in, and now receives the 'user' prop */}
      {user && (
        <Sidebar 
          user={user} 
          onOpenCreateTicket={() => setIsTicketModalOpen(true)} 
          onLogout={logout} 
        />
      )}
      
      <main className={`flex-1 ${user ? 'p-4 overflow-y-auto' : ''}`}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute> <Dashboard /> </ProtectedRoute>
          } />
          
          <Route path="/tickets" element={
            <ProtectedRoute> <TicketList onOpenCreateTicket={() => setIsTicketModalOpen(true)} /> </ProtectedRoute>
          } />

          <Route path="/tickets/:id" element={
            <ProtectedRoute> <TicketDetail /> </ProtectedRoute>
          } />

          {/* Role-Restricted Routes */}
          <Route path="/users" element={
            <ProtectedRoute allowedRoles={['Super Admin']}> <UserManagement /> </ProtectedRoute>
          } />

          {/* SLA Settings Route */}
          <Route path="/sla" element={
            <ProtectedRoute allowedRoles={['Super Admin']}> <SlaSettings /> </ProtectedRoute>
          } />
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