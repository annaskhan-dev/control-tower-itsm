import axios from 'axios';

// This logic checks for your Netlify environment variable first.
// If it doesn't find it (like when you run it locally), it defaults to localhost:5001
const apiBaseUrl = import.meta.env?.VITE_API_URL || process.env?.REACT_APP_API_URL || 'http://localhost:5001';

const axiosInstance = axios.create({
  // We append /api here so you don't have to include it in your environment variable
  baseURL: `${apiBaseUrl}/api`,
  timeout: 10000,
});

// Request Interceptor
axiosInstance.interceptors.request.use((config) => {
  // Attach Authorization Header
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Attach Company ID
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

// Response Interceptor
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error(`API Error [${error.config.url}]:`, error.response.status, error.response.data);
    }

    if (error.response?.status === 401) {
      const isLoginRequest = error.config.url.includes('/auth/login');
      if (!isLoginRequest) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;