import { UserPlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useContactsStore } from "../store/useContactsStore";
import AddContact from "./AddContact";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";

function ContactList() {
  const { getAllContacts, allContacts, setSelectedUser, isUsersLoading } =
    useChatStore();
  const { onlineUsers } = useAuthStore();
  const { getContacts } = useContactsStore();
  const [showAddContact, setShowAddContact] = useState(false);

  useEffect(() => {
    getAllContacts();
    getContacts(); // Load contacts into contacts store
  }, [getAllContacts, getContacts]);

  if (isUsersLoading) return <UsersLoadingSkeleton />;
  const safeContacts = Array.isArray(allContacts) ? allContacts : [];

  return (
    <>
      {/* Add Contact Button */}
      <button
        onClick={() => setShowAddContact(true)}
        className="w-full mb-3 flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white py-2.5 px-4 rounded-lg transition-colors">
        <UserPlusIcon className="w-5 h-5" />
        <span className="font-medium">Add New Contact</span>
      </button>

      {safeContacts.length === 0 && (
        <div className="text-center py-8 text-slate-400">
          <UserPlusIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No contacts yet</p>
          <p className="text-xs mt-1">Add contacts to start chatting</p>
        </div>
      )}

      {safeContacts.map((contact) => (
        <div
          key={contact._id}
          className="bg-cyan-500/10 p-4 rounded-lg cursor-pointer hover:bg-cyan-500/20 transition-colors"
          onClick={() => setSelectedUser(contact)}>
          <div className="flex items-center gap-3">
            <div
              className={`avatar ${
                (Array.isArray(onlineUsers) ? onlineUsers : []).includes(
                  contact._id
                )
                  ? "online"
                  : "offline"
              }`}>
              <div className="size-12 rounded-full">
                <img src={contact.profilePic || "/avatar.png"} />
              </div>
            </div>
            <h4 className="text-slate-200 font-medium">{contact.fullName}</h4>
          </div>
        </div>
      ))}

      {/* Add Contact Modal */}
      {showAddContact && (
        <AddContact onClose={() => setShowAddContact(false)} />
      )}
    </>
  );
}
export default ContactList;
