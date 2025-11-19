import toast from "react-hot-toast";
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { notify } from "../lib/notifications";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  allContacts: [],
  chats: [],
  messages: [],
  activeTab: "chats",
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isSoundEnabled: JSON.parse(localStorage.getItem("isSoundEnabled")) === true,

  toggleSound: () => {
    localStorage.setItem("isSoundEnabled", !get().isSoundEnabled);
    set({ isSoundEnabled: !get().isSoundEnabled });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedUser: (selectedUser) => set({ selectedUser }),

  getAllContacts: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/contacts");
      set({ allContacts: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },
  getMyChatPartners: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/chats");
      set({ chats: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessagesByUserId: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    const { authUser } = useAuthStore.getState();

    const tempId = `temp-${Date.now()}`;

    const optimisticMessage = {
      _id: tempId,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: messageData.text,
      image: messageData.image,
      createdAt: new Date().toISOString(),
      isOptimistic: true, // flag to identify optimistic messages (optional)
    };
    // immidetaly update the ui by adding the message
    set({ messages: [...messages, optimisticMessage] });

    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        messageData
      );
      set({ messages: messages.concat(res.data) });
    } catch (error) {
      // remove optimistic message on failure
      set({ messages: messages });
      toast.error(error.response?.data?.message || "Something went wrong");
    }
  },

  deleteMessage: async (messageId, scope = "me") => {
    try {
      const { messages } = get();
      await axiosInstance.delete(`/messages/${messageId}?scope=${scope}`);

      if (scope === "everyone") {
        // replace the message with a deleted-for-everyone placeholder
        set({
          messages: messages.map((m) =>
            m._id === messageId
              ? { ...m, text: null, image: null, deletedForEveryone: true }
              : m
          ),
        });
      } else {
        // delete for me -> remove from local messages
        set({ messages: messages.filter((m) => m._id !== messageId) });
      }
    } catch (error) {
      console.log("Error deleting message:", error);
      toast.error(error?.response?.data?.message || "Could not delete message");
    }
  },

  updateMessage: async (messageId, text) => {
    try {
      const { messages } = get();
      const res = await axiosInstance.put(`/messages/${messageId}`, { text });
      // update local messages array
      set({
        messages: messages.map((m) =>
          m._id === messageId
            ? { ...m, text: res.data.text, updatedAt: res.data.updatedAt }
            : m
        ),
      });
    } catch (error) {
      console.error("Error updating message:", error);
      toast.error(error?.response?.data?.message || "Could not update message");
    }
  },

  subscribeToMessages: () => {
    const { selectedUser, isSoundEnabled } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    socket.on("newMessage", async (newMessage) => {
      const isMessageSentFromSelectedUser =
        newMessage.senderId === selectedUser._id;

      // if message belongs to current chat, append it
      if (isMessageSentFromSelectedUser) {
        const currentMessages = get().messages;
        set({ messages: [...currentMessages, newMessage] });

        if (isSoundEnabled) {
          const notificationSound = new Audio("/sounds/notification.mp3");
          notificationSound.currentTime = 0; // reset to start
          notificationSound
            .play()
            .catch((e) => console.log("Audio play failed:", e));
        }
        return;
      }

      // message for another chat -> show notification and optionally update chats list
      const { authUser } = useAuthStore.getState();
      const title = "New message";
      const senderName = newMessage.senderName || "Someone";
      const body = newMessage.text || "Sent an image";

      // schedule in-app notification (mobile) or browser notification
      notify(`${senderName}`, body).catch((e) =>
        console.log("notify failed", e)
      );
    });

    socket.on("messageDeleted", (payload) => {
      const { messageId, scope, userId } = payload || {};
      const { messages } = get();

      if (scope === "everyone") {
        set({
          messages: messages.map((m) =>
            m._id === messageId
              ? { ...m, text: null, image: null, deletedForEveryone: true }
              : m
          ),
        });
      } else if (scope === "me") {
        // if delete for me for this user, remove if the user is the current user
        const me = useAuthStore.getState().authUser;
        if (me && userId && me._id === userId) {
          set({ messages: messages.filter((m) => m._id !== messageId) });
        }
      }
    });

    socket.on("messageUpdated", (updated) => {
      const { messages } = get();
      if (!updated || !updated._id) return;
      set({
        messages: messages.map((m) =>
          m._id === updated._id
            ? { ...m, text: updated.text, updatedAt: updated.updatedAt }
            : m
        ),
      });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
    socket.off("messageDeleted");
  },
}));
