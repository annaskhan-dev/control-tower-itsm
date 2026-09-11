import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading, isAdmin } = useAuth();

  // 1. Wait for auth state to finish loading from localStorage
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100 text-slate-500 font-medium">
        Loading Control Tower...
      </div>
    );
  }

  // 2. If not authenticated, force redirect to Login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Role-Based Access Control (RBAC) with safe normalization & fallback redirection
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = (user?.role || '').toLowerCase().trim();
    
    // Normalize allowed roles for safe comparison
    const normalizedAllowedRoles = allowedRoles.map(r => r.toLowerCase().trim());
    
    // Check authorization (Super Admin can bypass if desired, or stick strictly to allowedRoles)
    const isAuthorized = isAdmin || normalizedAllowedRoles.includes(userRole);
    
    if (!isAuthorized) {
      // Determine correct safe landing page depending on role type to prevent redirect loops
      const isRestrictedRole = ['operator', 'transporter', 'agent', 'shipper ops', 'sales person'].some(
        r => userRole.includes(r)
      );
      const fallbackRoute = isRestrictedRole ? "/tickets?queue=all-work" : "/dashboard";

      return <Navigate to={fallbackRoute} replace />;
    }
  }

  // 4. Otherwise, render the protected content
  return children;
};

export default ProtectedRoute;