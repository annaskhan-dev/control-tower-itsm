import React, {
  createContext,
   useContext,
   useState,
   useCallback,
  useEffect,
} from "react";
import { useAuth } from "./AuthContext";
import axiosInstance from "../api/axiosInstance";
// Optional: import your socket instance if you use one for real-time gateway broadcasts
// import { socket } from "../api/socket"; 

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

  // Optional: Real-time Socket.io synchronization matching your backend gateway events
  useEffect(() => {
    if (!token) return;

    /* 
    // Uncomment if using socket.io-client
    socket.on("ticketCreated", (newTicket) => {
      addLocalTicket(newTicket);
    });

    socket.on("ticketUpdated", (updatedTicket) => {
      updateLocalTicket(updatedTicket._id || updatedTicket.ticketId, updatedTicket);
    });

    return () => {
      socket.off("ticketCreated");
      socket.off("ticketUpdated");
    };
    */
  }, [token]);

  return (
    <TicketContext.Provider
      value={{ 
        tickets, 
        fetchTickets, 
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