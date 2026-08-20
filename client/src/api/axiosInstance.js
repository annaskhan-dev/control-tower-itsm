import axios from 'axios';

// Logic to determine the base URL with a secure production fallback
const apiBaseUrl = import.meta.env?.VITE_API_URL || process.env?.REACT_APP_API_URL || 'https://control-tower-itsm-production.up.railway.app';

const axiosInstance = axios.create({
  baseURL: `${apiBaseUrl}/api`,
  timeout: 10000,
});

console.log("Axios Base URL is set to:", axiosInstance.defaults.baseURL);

// Request Interceptor
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const userString = localStorage.getItem('user');
  if (userString) {
    try {
      const user = JSON.parse(userString);
      if (user?.companyId) {
        config.headers['x-company-id'] = user.companyId;
      }
    } catch (e) {
      console.error("Interceptor: Error parsing user for x-company-id", e);
    }
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response Interceptor (Safely handles 401 without forcing hard page reloads that cause loops)
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error(`API Error [${error.config?.url}]:`, error.response.status, error.response.data);
    }

    if (error.response?.status === 401) {
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      if (!isLoginRequest) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
      }
    }
    
    return Promise.reject(error);
  }
);

// Added helper function to resolve build error in Dashboard.jsx
export const fetchTicketStats = async () => {
  const response = await axiosInstance.get('/tickets/stats');
  return response.data;
};

export default axiosInstance;