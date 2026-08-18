import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useAuth } from "./AuthContext";
import axiosInstance from "../api/axiosInstance";

const TicketContext = createContext();

export const TicketProvider = ({ children }) => {
  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const { token } = useAuth(); 

  const fetchTickets = useCallback(async (queue = 'all-work') => {
    if (!token) {
      console.warn("No auth token found. Skipping fetch.");
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await axiosInstance.get('/tickets', {
        params: { queue }
      });
      setTickets(response.data);
    } catch (error) {
      console.error("Error fetching tickets:", error.response?.status, error.response?.data);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const updateLocalTicket = (id, updatedFields) => {
    setTickets((prevTickets) =>
      prevTickets.map((t) =>
        String(t._id) === String(id) || String(t.ticketId) === String(id) 
          ? { ...t, ...updatedFields } 
          : t
      )
    );
  };

  const addLocalTicket = (newTicket) => {
    setTickets((prevTickets) => [newTicket, ...prevTickets]);
  };

  // Implemented missing updateTicket function for backend synchronization
  const updateTicket = async (id, updatedFields) => {
    try {
      const response = await axiosInstance.put(`/tickets/${id}`, updatedFields);
      const updatedTicket = response.data.ticket || response.data;
      updateLocalTicket(id, updatedTicket);
      return updatedTicket;
    } catch (error) {
      console.error("Error updating ticket:", error.response?.status, error.response?.data);
      throw error;
    }
  };

  useEffect(() => {
    if (!token) return;
  }, [token]);

  return (
    <TicketContext.Provider
      value={{ 
        tickets, 
        fetchTickets, 
        updateTicket,
        updateLocalTicket, 
        addLocalTicket,
        isLoading 
      }}
    >
      {children}
    </TicketContext.Provider>
  );
};

export const useTickets = () => useContext(TicketContext);