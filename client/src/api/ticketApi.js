import axiosInstance from './axiosInstance';

// --- Ticket API Calls ---

export const fetchTickets = async (params = {}) => {
  try {
    const response = await axiosInstance.get('/tickets', { params });
    return response.data;
  } catch (error) {
    console.error("Error fetching tickets:", error.response?.status, error.response?.data);
    throw error;
  }
};

export const createTicket = async (ticketData) => {
  try {
    const response = await axiosInstance.post('/tickets', ticketData);
    return response.data;
  } catch (error) {
    console.error("Error creating ticket:", error.response?.status, error.response?.data);
    throw error;
  }
};

export const deleteTicket = async (id) => {
  try {
    const response = await axiosInstance.delete(`/tickets/${id}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting ticket:", error.response?.status, error.response?.data);
    throw error;
  }
};

// --- SLA Configuration API Calls ---

/**
 * Fetches all SLA rules (Category + Priority + Hours)
 */
export const fetchSlaConfigs = async () => {
  try {
    const response = await axiosInstance.get('/tickets/sla-configs');
    return response.data;
  } catch (error) {
    console.error("Error fetching SLA configs:", error.response?.status, error.response?.data);
    throw error;
  }
};

/**
 * Creates a new category entry and default SLA rules
 * @param {Object} categoryData - e.g., { categoryName: "New Category" }
 */
export const createSlaCategory = async (categoryData) => {
  try {
    const response = await axiosInstance.post('/tickets/sla-configs/categories', categoryData);
    return response.data;
  } catch (error) {
    console.error("Error creating SLA category:", error.response?.status, error.response?.data);
    throw error;
  }
};

/**
 * Updates the hours for a specific SLA rule
 * @param {String} id - The MongoDB _id of the config
 * @param {Number} hours - The new duration
 */
export const updateSlaPriority = async (id, hours) => {
  try {
    const response = await axiosInstance.patch(`/tickets/sla-configs/${id}`, { hours });
    return response.data;
  } catch (error) {
    console.error("Error updating priority hours:", error.response?.status, error.response?.data);
    throw error;
  }
};

/**
 * Removes an entire SLA config rule
 * RENAMED from deleteSlaConfig to deleteSlaCategory to match your import
 * @param {String} id - The MongoDB _id of the config
 */
export const deleteSlaCategory = async (id) => {
  try {
    const response = await axiosInstance.delete(`/tickets/sla-configs/${id}`);
    return response.data;
  } catch (error) {
    console.error("Error deleting SLA config:", error.response?.status, error.response?.data);
    throw error;
  }
};