import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading, isAdmin } = useAuth();

  // 1. Wait for auth state to finish loading
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900 text-white">
        Loading...
      </div>
    );
  }

  // 2. If not authenticated, force redirect to Login
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // 3. Role-Based Access Control (RBAC)
  // If allowedRoles are specified, check if the user is authorized
  if (allowedRoles && !isAdmin) {
    const isAuthorized = allowedRoles.includes(user?.role);
    
    if (!isAuthorized) {
      // Redirect unauthorized users to dashboard or a 403 page
      return <Navigate to="/dashboard" replace />;
    }
  }

  // 4. Otherwise, render the protected children
  return children;
};

export default ProtectedRoute;