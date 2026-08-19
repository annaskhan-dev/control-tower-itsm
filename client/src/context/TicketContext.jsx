import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useAuth } from "./AuthContext";
import axiosInstance from "../api/axiosInstance";

const TicketContext = createContext();

// Global module-level session lock to prevent ANY component from looping requests
let hasFetchedGlobal = false;

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

    // HARD LOCK: If already fetched globally this session and not forced, completely block duplicate requests
    if (hasFetchedGlobal && !force && tickets.length > 0) {
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
      hasFetchedGlobal = true; // Mark as fetched globally
    } catch (error) {
      console.error("Error fetching tickets:", error.response?.status, error.response?.data);
    } finally {
      setIsLoading(false);
      fetchingRef.current[queue] = false;
    }
  }, [token, tickets.length]);

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

  const value = useMemo(() => ({
    tickets, 
    setTickets,
    fetchTickets, 
    updateTicket,
    updateLocalTicket, 
    addLocalTicket,
    isLoading,
    setIsLoading
  }), [tickets, isLoading, fetchTickets, updateTicket, updateLocalTicket, addLocalTicket]);

  return (
    <TicketContext.Provider value={value}>
      {children}
    </TicketContext.Provider>
  );
};

export const useTickets = () => useContext(TicketContext);