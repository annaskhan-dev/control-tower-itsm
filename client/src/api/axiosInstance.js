import axios from 'axios';

// Logic to determine the base URL
const apiBaseUrl = import.meta.env?.VITE_API_URL || process.env?.REACT_APP_API_URL || 'http://localhost:5000';

const axiosInstance = axios.create({
  // We append /api here
  baseURL: `${apiBaseUrl}/api`,
  timeout: 10000,
});

// DEBUGGING: This will print the actual URL your app is using to your browser console
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

// Response Interceptor
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
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;