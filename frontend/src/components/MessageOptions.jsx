import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

function MessageOptions({ message, asModal = false, onEdit }) {
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
  // heuristics for mobile: either touch-enabled device or small viewport
  const isTouch =
    typeof navigator !== "undefined" &&
    (navigator.maxTouchPoints || navigator.userAgent.includes("Mobile"));
  const isSmall = typeof window !== "undefined" && window.innerWidth <= 640;
  const showInline = isTouch || isSmall;

  return (
    <>
      {!asModal && (
        <div ref={ref} className="relative inline-block">
          {!showInline && (
            <>
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
                          window.confirm(
                            "Delete for everyone? This cannot be undone."
                          )
                        ) {
                          deleteMessage(message._id, "everyone");
                        }
                      }}
                      className="block px-3 py-2 text-sm hover:bg-slate-700 w-full text-left text-red-400">
                      Delete for everyone
                    </button>
                  )}

                  {isSender && (
                    <button
                      onClick={() => {
                        setOpen(false);
                        onEdit && onEdit(message);
                      }}
                      className="block px-3 py-2 text-sm hover:bg-slate-700 w-full text-left text-yellow-300">
                      Edit message
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {showInline && (
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMessage(message._id, "me");
                }}
                className="p-2 rounded-md bg-slate-700 text-xs touch-manipulation">
                Delete
              </button>

              {isSender && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        window.confirm(
                          "Delete for everyone? This cannot be undone."
                        )
                      )
                        deleteMessage(message._id, "everyone");
                    }}
                    className="p-2 rounded-md bg-red-600 text-xs text-white touch-manipulation">
                    Delete all
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit && onEdit(message);
                    }}
                    className="p-2 rounded-md bg-yellow-500 text-xs text-black touch-manipulation">
                    Edit
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {asModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => onEdit && onEdit(null)}
          />
          <div className="relative bg-slate-800 rounded-lg p-4 w-11/12 max-w-sm">
            <h3 className="text-sm mb-2">Message actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  deleteMessage(message._id, "me");
                  onEdit && onEdit(null);
                }}
                className="w-full text-left px-3 py-2 bg-slate-700 rounded">
                Delete for me
              </button>
              {isSender && (
                <>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          "Delete for everyone? This cannot be undone."
                        )
                      ) {
                        deleteMessage(message._id, "everyone");
                      }
                      onEdit && onEdit(null);
                    }}
                    className="w-full text-left px-3 py-2 bg-red-600 rounded text-white">
                    Delete for everyone
                  </button>
                  <button
                    onClick={() => onEdit && onEdit(message)}
                    className="w-full text-left px-3 py-2 bg-yellow-500 rounded text-black">
                    Edit message
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MessageOptions;
