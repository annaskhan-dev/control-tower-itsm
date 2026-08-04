import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/layout/Layout";

// Import Pages
import { Login } from "../pages/Login";
import { Register } from "../pages/Register"; // Added Register
import { DashboardPage } from "../pages/DashboardPage";
import { TicketList } from "../pages/TicketList";
import { TicketDetail } from "../pages/TicketDetail";
import { CreateTicket } from "../pages/CreateTicket";
import { UserManagement } from "../pages/UserManagement";
import SlaSettings from "../pages/SlaSettings"; // Adjust path if necessary based on your file tree

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, user } = useAuth(); // Ensure user is available from AuthContext

  if (isLoading) {
    return <div className="p-8 text-slate-500">Loading session...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role-based access if allowedRoles are specified
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user?.role || '';
    const isAuthorized = allowedRoles.some(
      r => r.toLowerCase() === userRole.toLowerCase() || 
           r.replace(/\s+/g, '_').toLowerCase() === userRole.replace(/\s+/g, '_').toLowerCase()
    );

    if (!isAuthorized) {
      // Redirect unauthorized roles back to dashboard/tickets instead of looping or blocking
      return <Navigate to="/tickets" replace />;
    }
  }
  
  // Wrapping in Layout here means every protected page gets the sidebar/nav automatically
  return <Layout>{children}</Layout>;
};

export const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  // Define roles allowed for restricted pages like SLA and User Management
  const adminManagerRoles = ['Super Admin', 'Manager'];
  const allRoles = ['Super Admin', 'Manager', 'Operator', 'Agent', 'Transporter', 'Shipper Ops', 'Sales Person'];

  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route path="/register" element={<Register />} />

      {/* Protected Routes with Role Guards */}
      <Route path="/dashboard" element={<ProtectedRoute allowedRoles={allRoles}><DashboardPage /></ProtectedRoute>} />
      <Route path="/tickets" element={<ProtectedRoute allowedRoles={allRoles}><TicketList /></ProtectedRoute>} />
      <Route path="/tickets/new" element={<ProtectedRoute allowedRoles={allRoles}><CreateTicket /></ProtectedRoute>} />
      <Route path="/tickets/:id" element={<ProtectedRoute allowedRoles={allRoles}><TicketDetail /></ProtectedRoute>} />
      
      {/* Restricted Admin/Manager Routes */}
      <Route path="/sla" element={<ProtectedRoute allowedRoles={adminManagerRoles}><SlaSettings /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute allowedRoles={adminManagerRoles}><UserManagement /></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};