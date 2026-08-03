import React, {
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";
import { useAuth } from "./AuthContext";
import axiosInstance from "../api/axiosInstance";

const TicketContext = createContext();

export const TicketProvider = ({ children }) => {
  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const { token } = useAuth(); 

  const fetchTickets = useCallback(async (queue = 'all-work') => {
    // 1. Check if token exists before making the request
    if (!token) {
      console.warn("No auth token found. Skipping fetch.");
      return;
    }
    
    setIsLoading(true);
    try {
      // 2. Use axiosInstance. It handles the baseURL ('/api') 
      // and the 'Authorization' header automatically.
      const response = await axiosInstance.get('/tickets', {
        params: { queue }
      });

      // 3. Axios automatically parses response.json(), so we use response.data
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
        String(t._id) === String(id) ? { ...t, ...updatedFields } : t
      )
    );
  };

  return (
    <TicketContext.Provider
      value={{ tickets, fetchTickets, updateLocalTicket, isLoading }}
    >
      {children}
    </TicketContext.Provider>
  );
};

export const useTickets = () => useContext(TicketContext);