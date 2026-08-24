import axios from 'axios';

// Automatically use Railway in production, or localhost for local development
const apiBaseUrl = import.meta.env?.VITE_API_URL || process.env?.REACT_APP_API_URL || 'https://control-tower-itsm-production.up.railway.app';

const api = axios.create({
  baseURL: `${apiBaseUrl}/api`,
  timeout: 10000,
});

// Add a request interceptor to attach the JWT token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token'); // Fixed key to match your login storage
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Also attach company ID if available
  const userString = localStorage.getItem('user');
  if (userString) {
    try {
      const user = JSON.parse(userString);
      if (user?.companyId) {
        config.headers['x-company-id'] = user.companyId;
      }
    } catch (e) {
      console.error("Error parsing user for x-company-id", e);
    }
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

// --- Auth Logout Helper Function ---
export const logoutUser = async (userId) => {
  const response = await api.post('/auth/logout', { userId });
  return response.data;
};

// --- New Analytics Helper Functions ---
export const fetchActiveTimeStats = async () => {
  const response = await api.get('/analytics/active-time');
  return response.data;
};

export const fetchMonthOnMonthReport = async () => {
  const response = await api.get('/analytics/month-on-month');
  return response.data;
};
// -------------------------------------

export default api;