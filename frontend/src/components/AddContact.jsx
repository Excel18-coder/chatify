import { SearchIcon, UserPlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useContactsStore } from "../store/useContactsStore";

function AddContact({ onClose }) {
  const [searchQuery, setSearchQuery] = useState("");
  const {
    searchResults,
    isSearching,
    searchUsers,
    addContact,
    clearSearchResults,
    contacts,
  } = useContactsStore();

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    searchUsers(query);
  };

  const handleAddContact = async (userId) => {
    await addContact(userId);
    setSearchQuery("");
    clearSearchResults();
  };

  const isAlreadyContact = (userId) => {
    return contacts.some((c) => c._id === userId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-900 rounded-lg w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Add New Contact</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-slate-700">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearch}
              placeholder="Enter Contact ID, name or email..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            💡 Tip: Ask your friend for their Contact ID for instant results
          </p>
        </div>

        {/* Search Results */}
        <div className="max-h-96 overflow-y-auto">
          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!isSearching && searchQuery && searchResults.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              <SearchIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No users found</p>
            </div>
          )}

          {!isSearching && searchQuery && searchResults.length > 0 && (
            <div className="divide-y divide-slate-700">
              {searchResults.map((user) => (
                <div
                  key={user._id}
                  className="flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="avatar">
                      <div className="w-10 rounded-full">
                        <img
                          src={user.profilePic || "/avatar.png"}
                          alt={user.fullName}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-white">{user.fullName}</p>
                      {user.contactId && (
                        <p className="text-xs text-cyan-400 font-mono">
                          #{user.contactId}
                        </p>
                      )}
                      <p className="text-xs text-slate-400">{user.email}</p>
                    </div>
                  </div>

                  {isAlreadyContact(user._id) ? (
                    <span className="text-xs text-green-500 font-medium">
                      Already added
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAddContact(user._id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors">
                      <UserPlusIcon className="w-4 h-4" />
                      <span className="text-sm">Add</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {!searchQuery && (
            <div className="text-center py-8 text-slate-400">
              <UserPlusIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium mb-2">
                Add contacts by Contact ID
              </p>
              <p className="text-xs">
                Enter a user's Contact ID for instant results
              </p>
              <p className="text-xs mt-1 text-slate-500">
                Or search by name/email
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddContact;
