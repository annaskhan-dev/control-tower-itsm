import React, { createContext, useContext, useState, useEffect } from 'react';
import axiosInstance from '../api/axiosInstance'; 

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('access_token') || null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync axios header whenever the token changes
  useEffect(() => {
    if (token) {
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axiosInstance.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Sync state on load and validate
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    
    if (savedUser && token) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        logout();
      }
    }
    setIsLoading(false);
  }, [token]); 

  const login = async (email, password) => {
    try {
      // Sending 'password' to match the updated backend expectations
      const res = await axiosInstance.post('/auth/login', { 
        email, 
        password 
      });
      
      const { user, access_token } = res.data;
      
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('access_token', access_token);
      
      setToken(access_token);
      setUser(user);
      return user;
    } catch (error) {
      console.error("Login failed:", error);
      throw error; 
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    
    setUser(null);
    setToken(null);
  };

  const isAuthenticated = !!token;
  const isAdmin = user?.role === 'Super Admin';
  const isManager = user?.role === 'Manager';
  const isOperator = user?.role === 'Operator';
  const companyId = user?.companyId; 

  return (
    <AuthContext.Provider value={{ 
        user, 
        token, 
        login, 
        logout, 
        isLoading, 
        isAuthenticated,
        isAdmin,
        isManager,
        isOperator,
        companyId 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);