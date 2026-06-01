import axios from 'axios';

/**
 * Pre-configured Axios instance for all API calls.
 * Base URL is read from REACT_APP_API_URL env variable,
 * with a fallback to localhost:8000 for local development.
 */
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60s — Render free tier cold starts can take 50+ seconds
});

// Request interceptor — attach auth tokens here in the future
api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

// Response interceptor — centralised error normalisation
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error.message ||
      'An unexpected error occurred.';
    return Promise.reject(new Error(message));
  }
);

export default api;
