import axios from "axios";

// Allow overriding the backend URL via Vite env var VITE_BACKEND_URL.
// Fallback to localhost in development, or the Sevalla hosted backend in production.
const DEFAULT_BACKEND =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.MODE === "development"
    ? "http://localhost:3000"
    : "https://clevery.sevalla.app");

export const axiosInstance = axios.create({
  baseURL: `${DEFAULT_BACKEND}/api`,
  withCredentials: true,
});

// Attach Authorization header from localStorage token if present. This ensures
// requests from non-standard webviews (Capacitor) still send the bearer token
// when cookies are not available.
axiosInstance.interceptors.request.use((config) => {
  try {
    const token =
      typeof window !== "undefined" && localStorage.getItem("token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    // ignore (server side or restricted storage)
  }
  return config;
});
