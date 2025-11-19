import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

function MessageOptions({ message }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { authUser } = useAuthStore();
  const deleteMessage = useChatStore((s) => s.deleteMessage);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const isSender = message.senderId === authUser._id;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="text-xs opacity-60 hover:opacity-100 px-2 py-1">
        ⋯
      </button>

      {open && (
        <div className="absolute right-0 mt-2 bg-slate-800 rounded shadow-lg z-50 py-1">
          <button
            onClick={() => {
              setOpen(false);
              deleteMessage(message._id, "me");
            }}
            className="block px-3 py-2 text-sm hover:bg-slate-700 w-full text-left">
            Delete for me
          </button>

          {isSender && (
            <button
              onClick={() => {
                setOpen(false);
                if (
                  window.confirm("Delete for everyone? This cannot be undone.")
                ) {
                  deleteMessage(message._id, "everyone");
                }
              }}
              className="block px-3 py-2 text-sm hover:bg-slate-700 w-full text-left text-red-400">
              Delete for everyone
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default MessageOptions;
