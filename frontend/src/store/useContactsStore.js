import toast from "react-hot-toast";
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";

export const useContactsStore = create((set, get) => ({
  contacts: [],
  searchResults: [],
  isLoadingContacts: false,
  isSearching: false,

  getContacts: async () => {
    set({ isLoadingContacts: true });
    try {
      const res = await axiosInstance.get("/contacts");
      set({ contacts: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load contacts");
    } finally {
      set({ isLoadingContacts: false });
    }
  },

  searchUsers: async (query) => {
    if (!query || query.trim().length < 2) {
      set({ searchResults: [] });
      return;
    }

    set({ isSearching: true });
    try {
      const res = await axiosInstance.get(
        `/contacts/search?query=${encodeURIComponent(query)}`
      );
      set({ searchResults: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Search failed");
      set({ searchResults: [] });
    } finally {
      set({ isSearching: false });
    }
  },

  addContact: async (contactId) => {
    try {
      const res = await axiosInstance.post("/contacts/add", { contactId });
      toast.success(res.data.message || "Contact added");

      // Add to contacts list
      const { contacts } = get();
      set({ contacts: [...contacts, res.data.contact] });

      // Refresh contacts to ensure sync
      get().getContacts();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add contact");
    }
  },

  removeContact: async (contactId) => {
    try {
      await axiosInstance.delete(`/contacts/${contactId}`);
      toast.success("Contact removed");

      // Remove from contacts list
      const { contacts } = get();
      set({ contacts: contacts.filter((c) => c._id !== contactId) });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove contact");
    }
  },

  clearSearchResults: () => set({ searchResults: [] }),

  setContactId: async (contactId) => {
    try {
      const res = await axiosInstance.post("/contacts/set-id", { contactId });
      toast.success(res.data.message || "Contact ID set successfully");
      return { success: true, user: res.data.user };
    } catch (error) {
      const message =
        error.response?.data?.message || "Failed to set Contact ID";
      toast.error(message);
      return { success: false, message };
    }
  },

  checkContactIdAvailability: async (contactId) => {
    try {
      const res = await axiosInstance.get(
        `/contacts/check-id?contactId=${encodeURIComponent(contactId)}`
      );
      return res.data;
    } catch (error) {
      return {
        available: false,
        message: error.response?.data?.message || "Error checking availability",
      };
    }
  },
}));
