import axios from 'axios';

const api = axios.create({
  // Make sure this matches your backend URL
  baseURL: 'http://localhost:5001/api', 
});

// Add a request interceptor to attach the JWT token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token'); // Or wherever you store your JWT
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;