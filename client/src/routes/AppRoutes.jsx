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

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth(); // Ensure this matches context props

  if (isLoading) {
    return <div className="p-8 text-slate-500">Loading session...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // Wrapping in Layout here means every protected page gets the sidebar/nav automatically
  return <Layout>{children}</Layout>;
};

export const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
      />
      <Route path="/register" element={<Register />} />

      {/* Protected Routes */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/tickets" element={<ProtectedRoute><TicketList /></ProtectedRoute>} />
      <Route path="/tickets/new" element={<ProtectedRoute><CreateTicket /></ProtectedRoute>} />
      <Route path="/tickets/:id" element={<ProtectedRoute><TicketDetail /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};