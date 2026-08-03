import React, { useEffect, useState } from 'react';
import { Dashboard } from './Dashboard'; 
import { useAuth } from '../context/AuthContext';
import axiosInstance from '../api/axiosInstance'; // Import the instance

export const DashboardPage = () => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true); // Added local loading state
  const { user } = useAuth(); 

  useEffect(() => {
    const fetchTickets = async () => {
      // Only fetch if companyID exists
      if (!user?.companyID) {
        setLoading(false);
        return;
      }

      try {
        // Use the instance which automatically attaches your JWT
        const response = await axiosInstance.get('/tickets', {
          params: { companyID: user.companyID } // Cleaner way to pass query params
        });
        setTickets(response.data);
      } catch (error) {
        console.error("Failed to fetch tickets:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [user]);

  // If you want to show a page-level spinner before the Dashboard renders
  if (loading) return <div className="p-8">Loading dashboard data...</div>;

  return <Dashboard tickets={tickets} />;
};