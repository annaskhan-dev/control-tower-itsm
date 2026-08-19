import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "./AuthContext";
import axiosInstance from "../api/axiosInstance";

const TicketContext = createContext();

export const TicketProvider = ({ children }) => {
  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false); // Prevents duplicate double-fetches on mount
  
  const { token } = useAuth(); 

  const fetchTickets = useCallback(async (queue = 'all-work', force = false) => {
    if (!token) {
      console.warn("No auth token found. Skipping fetch.");
      return;
    }

    // Prevent redundant fetches if we already have tickets loaded, unless forced
    if (!force && fetchedRef.current && tickets.length > 0) {
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await axiosInstance.get('/tickets', {
        params: { queue }
      });
      const data = Array.isArray(response.data) ? response.data : (response.data?.tickets || response.data?.data || []);
      setTickets(data);
      fetchedRef.current = true;
    } catch (error) {
      console.error("Error fetching tickets:", error.response?.status, error.response?.data);
    } finally {
      setIsLoading(false);
    }
  }, [token, tickets.length]);

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

  return (
    <TicketContext.Provider
      value={{ 
        tickets, 
        setTickets,
        fetchTickets, 
        updateTicket,
        updateLocalTicket, 
        addLocalTicket,
        isLoading,
        setIsLoading
      }}
    >
      {children}
    </TicketContext.Provider>
  );
};

export const useTickets = () => useContext(TicketContext);