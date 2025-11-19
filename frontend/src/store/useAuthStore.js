import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";

// Backend URL used for socket.io connection. Allow override with VITE_BACKEND_URL.
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.MODE === "development"
    ? "http://localhost:3000"
    : "https://clevery.sevalla.app");

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: true,
  isSigningUp: false,
  isLoggingIn: false,
  socket: null,
  onlineUsers: [],

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log("Error in authCheck:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      // Persist token for WebView/mobile fallback and attach to axios
      if (res.data?.token) {
        try {
          localStorage.setItem("token", res.data.token);
        } catch (err) {
          // ignore localStorage errors
        }
        axiosInstance.defaults.headers.common.Authorization = `Bearer ${res.data.token}`;
      }

      set({ authUser: res.data });

      toast.success("Account created successfully!");
      get().connectSocket();
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Something went wrong";
      toast.error(msg);
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      // Persist token for WebView/mobile fallback and attach to axios
      if (res.data?.token) {
        try {
          localStorage.setItem("token", res.data.token);
        } catch (err) {}
        axiosInstance.defaults.headers.common.Authorization = `Bearer ${res.data.token}`;
      }

      set({ authUser: res.data });

      toast.success("Logged in successfully");

      get().connectSocket();
    } catch (error) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Something went wrong";
      toast.error(msg);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      try {
        localStorage.removeItem("token");
      } catch (err) {}
      if (axiosInstance.defaults.headers?.common)
        delete axiosInstance.defaults.headers.common.Authorization;
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error("Error logging out");
      console.log("Logout error:", error);
    }
  },

  updateProfile: async (data) => {
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("Error in update profile:", error);
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Something went wrong";
      toast.error(msg);
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser || get().socket?.connected) return;

    // Prefer cookie-based auth, but also send token in auth payload for mobile
    // WebViews which sometimes do not persist cookies.
    const token =
      authUser?.token ||
      (typeof window !== "undefined" && localStorage.getItem("token"));

    const socket = io(BACKEND_URL, {
      auth: token ? { token } : undefined,
      withCredentials: true, // ensures cookies are sent with the connection
      transports: ["websocket", "polling"],
    });

    socket.connect();

    set({ socket });

    // listen for online users event
    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });
  },

  disconnectSocket: () => {
    if (get().socket?.connected) get().socket.disconnect();
  },
}));
