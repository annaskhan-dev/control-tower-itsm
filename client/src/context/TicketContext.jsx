import React, { 
  createContext, 
  useContext, 
  useState, 
  useCallback, 
  useMemo, 
  useRef 
} from "react";
import { useAuth } from "./AuthContext";
import axiosInstance from "../api/axiosInstance";

const TicketContext = createContext();

export const TicketProvider = ({ children }) => {
  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const { token } = useAuth(); 
  const fetchingRef = useRef({});

  const fetchTickets = useCallback(async (queue = 'all-work', force = false) => {
    if (!token) {
      console.warn("No auth token found. Skipping fetch.");
      return;
    }

    if (fetchingRef.current[queue] && !force) {
      return;
    }

    fetchingRef.current[queue] = true;
    setIsLoading(true);
    
    try {
      const response = await axiosInstance.get('/tickets', {
        params: { queue }
      });
      const data = Array.isArray(response.data) ? response.data : (response.data?.tickets || response.data?.data || []);
      setTickets(data);
    } catch (error) {
      console.error("Error fetching tickets:", error.response?.status, error.response?.data);
    } finally {
      setIsLoading(false);
      fetchingRef.current[queue] = false;
    }
  }, [token]);

  const updateLocalTicket = useCallback((id, updatedFields) => {
    setTickets((prevTickets) =>
      prevTickets.map((t) =>
        String(t._id) === String(id) || String(t.ticketId) === String(id) 
          ? { ...t, ...updatedFields } 
          : t
      )
    );
  }, []);

  const addLocalTicket = useCallback((newTicket) => {
    setTickets((prevTickets) => [newTicket, ...prevTickets]);
  }, []);

  const updateTicket = useCallback(async (id, updatedFields) => {
    try {
      const response = await axiosInstance.patch(`/tickets/${id}`, updatedFields);
      const updatedTicket = response.data.ticket || response.data;
      updateLocalTicket(id, updatedTicket);
      return updatedTicket;
    } catch (error) {
      console.error("Error updating ticket:", error.response?.status, error.response?.data);
      throw error;
    }
  }, [updateLocalTicket]);

  // ✅ Fixed: Removed `tickets` and `isLoading` from dependency array to stabilize context reference
  const value = useMemo(() => ({
    tickets, 
    setTickets,
    fetchTickets, 
    updateTicket,
    updateLocalTicket, 
    addLocalTicket,
    isLoading,
    setIsLoading
  }), [fetchTickets, updateTicket, updateLocalTicket, addLocalTicket]);

  return (
    <TicketContext.Provider value={value}>
      {children}
    </TicketContext.Provider>
  );
};

export const useTickets = () => useContext(TicketContext);