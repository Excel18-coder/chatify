import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageOptions from "./MessageOptions";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";
import NoChatHistoryPlaceholder from "./NoChatHistoryPlaceholder";

function ChatContainer() {
  const {
    selectedUser,
    getMessagesByUserId,
    messages,
    isMessagesLoading,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const [contextMessage, setContextMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const longPressTimer = useRef(null);
  const isTouch =
    typeof navigator !== "undefined" &&
    (navigator.maxTouchPoints || navigator.userAgent.includes("Mobile"));
  const isSmall = typeof window !== "undefined" && window.innerWidth <= 640;

  useEffect(() => {
    if (!selectedUser) return;

    getMessagesByUserId(selectedUser._id);
    subscribeToMessages();

    // clean up
    return () => unsubscribeFromMessages();
  }, [
    selectedUser,
    getMessagesByUserId,
    subscribeToMessages,
    unsubscribeFromMessages,
  ]);

  // listen to window edit events (from MessageOptions modal) to open MessageInput
  useEffect(() => {
    function onEditEvent(e) {
      setEditingMessage(e.detail || null);
    }
    window.addEventListener("message:edit", onEditEvent);
    return () => window.removeEventListener("message:edit", onEditEvent);
  }, []);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-none">
        <ChatHeader />
      </div>
      <div className="flex-1 px-4 md:px-6 overflow-y-auto py-4 md:py-8 min-h-0">
        {Array.isArray(messages) &&
        messages.length > 0 &&
        !isMessagesLoading ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {(Array.isArray(messages) ? messages : []).map((msg) => (
              <div
                key={msg._id}
                className={`chat ${
                  msg.senderId === authUser._id ? "chat-end" : "chat-start"
                }`}>
                <div
                  className={`chat-bubble relative max-w-[80vw] md:max-w-[60%] ${
                    msg.senderId === authUser._id
                      ? "bg-cyan-600 text-white"
                      : "bg-slate-800 text-slate-200"
                  }`}
                  onMouseDown={() => {
                    // start long-press timer for desktop
                    longPressTimer.current = setTimeout(
                      () => setContextMessage(msg),
                      600
                    );
                  }}
                  onMouseUp={() => {
                    clearTimeout(longPressTimer.current);
                  }}
                  onMouseLeave={() => clearTimeout(longPressTimer.current)}
                  onTouchStart={() => {
                    longPressTimer.current = setTimeout(
                      () => setContextMessage(msg),
                      600
                    );
                  }}
                  onTouchEnd={() => {
                    clearTimeout(longPressTimer.current);
                  }}>
                    {/* For desktop: show the regular MessageOptions menu in the corner.
                        For touch/small screens we show options only after a long-press
                        (which sets `contextMessage`) and render a modal for it below. */}
                    {!isTouch && !isSmall && (
                      <div className="absolute top-1 right-1">
                        <MessageOptions
                          message={msg}
                          onEdit={(m) => {
                            setContextMessage(null);
                            setEditingMessage(m);
                          }}
                        />
                      </div>
                    )}
                  {msg.image && (
                    <img
                      src={msg.image}
                      alt="Shared"
                      className="rounded-lg h-48 sm:h-40 object-cover max-w-full"
                    />
                  )}

                  {msg.audio && (
                    <div className="mt-2">
                      <audio controls src={msg.audio} className="w-full" />
                    </div>
                  )}
                  {msg.text && <p className="mt-2 break-words">{msg.text}</p>}
                  <p className="text-xs mt-1 opacity-75 flex items-center gap-1">
                    {new Date(msg.createdAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
            {/* 👇 scroll target */}
            <div ref={messageEndRef} />
          </div>
  
              {/* Modal-style inline actions for touch/small screens (opened by long-press) */}
              {contextMessage && (
                <MessageOptions
                  message={contextMessage}
                  asModal={true}
                  onEdit={(m) => {
                    setEditingMessage(m);
                    setContextMessage(null);
                  }}
                />
              )}
  
        ) : isMessagesLoading ? (
          <MessagesLoadingSkeleton />
        ) : (
          <NoChatHistoryPlaceholder name={selectedUser?.fullName || ""} />
        )}
      </div>

      <div className="flex-none px-4 md:px-6 py-3 bg-slate-900/50">
        <MessageInput />
      </div>
    </div>
  );
}

export default ChatContainer;
