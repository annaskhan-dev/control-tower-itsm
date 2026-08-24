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
      // Automatically track sub-assignment timestamps if sub-assignment fields change
      let payload = { ...updatedFields };
      if (
        (payload.subAssignment !== undefined || payload.sub_assignment !== undefined || 
         payload.subAssignedTo !== undefined || payload.sub_assigned_to !== undefined) &&
        !payload.subAssignmentAt && !payload.sub_assigned_at && !payload.subAssignedAt
      ) {
        const val = payload.subAssignment ?? payload.sub_assignment ?? payload.subAssignedTo ?? payload.sub_assigned_to;
        if (val && val.toLowerCase() !== "unassigned" && val !== "") {
          payload.subAssignmentAt = new Date().toISOString();
        } else {
          payload.subAssignmentAt = null;
        }
      }

      const response = await axiosInstance.patch(`/tickets/${id}`, payload);
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
  }), [tickets, fetchTickets, updateTicket, updateLocalTicket, addLocalTicket, isLoading]);

  return (
    <TicketContext.Provider value={value}>
      {children}
    </TicketContext.Provider>
  );
};

export const useTickets = () => useContext(TicketContext);

export default TicketContext;