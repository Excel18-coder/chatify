import { IdCardIcon, XIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/useAuthStore";
import { useContactsStore } from "../store/useContactsStore";

function SetContactId({ onClose, required = false }) {
  const [contactId, setContactIdInput] = useState("");
  const { setContactId, isSavingContactId } = useContactsStore();
  const { authUser, updateAuthUser } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (contactId.trim().length < 3) {
      toast.error("Contact ID must be at least 3 characters");
      return;
    }

    // Validate format
    const validFormat = /^[a-zA-Z0-9_-]+$/;
    if (!validFormat.test(contactId)) {
      toast.error("Contact ID can only contain letters, numbers, hyphens, and underscores");
      return;
    }

    try {
      const updatedUser = await setContactId(contactId.trim());
      // Update authUser in store
      updateAuthUser(updatedUser);
      onClose();
    } catch (error) {
      // Error already shown by store
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-slate-900 rounded-lg w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Set Your Contact ID</h2>
          {!required && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors">
              <XIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4">
            <IdCardIcon className="w-16 h-16 mx-auto mb-4 text-cyan-500" />
            <p className="text-slate-300 text-center mb-2">
              Choose a unique Contact ID that others can use to add you
            </p>
            <p className="text-slate-400 text-sm text-center mb-4">
              This is like your username. Share it with people you want to chat with.
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Contact ID
            </label>
            <input
              type="text"
              value={contactId}
              onChange={(e) => setContactIdInput(e.target.value.toLowerCase())}
              placeholder="e.g., john_doe_2024"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
              disabled={isSavingContactId}
              autoFocus
            />
            <p className="text-xs text-slate-500 mt-1">
              Only letters, numbers, hyphens (-) and underscores (_) allowed
            </p>
          </div>

          {authUser?.contactId && (
            <div className="mb-4 p-3 bg-slate-800 rounded-lg">
              <p className="text-xs text-slate-400 mb-1">Current Contact ID:</p>
              <p className="text-sm text-cyan-400 font-mono">{authUser.contactId}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSavingContactId || contactId.trim().length < 3}
            className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white py-2.5 px-4 rounded-lg transition-colors font-medium">
            {isSavingContactId ? "Saving..." : authUser?.contactId ? "Update Contact ID" : "Set Contact ID"}
          </button>

          {required && (
            <p className="text-xs text-slate-500 text-center mt-3">
              You must set a Contact ID to use the app
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

export default SetContactId;
