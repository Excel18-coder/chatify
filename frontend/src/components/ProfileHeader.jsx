import {
  BellIcon,
  BellOffIcon,
  HashIcon,
  LogOutIcon,
  Volume2Icon,
  VolumeOffIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { notify, requestNotificationPermission } from "../lib/notifications";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import SetContactId from "./SetContactId";

const mouseClickSound = new Audio("/sounds/mouse-click.mp3");

function ProfileHeader() {
  const { logout, authUser, updateProfile } = useAuthStore();
  const { isSoundEnabled, toggleSound } = useChatStore();
  const [selectedImg, setSelectedImg] = useState(null);
  const [showSetContactId, setShowSetContactId] = useState(false);
  const [notifStatus, setNotifStatus] = useState(() => {
    if (typeof Notification !== "undefined") return Notification.permission;
    return "default";
  });

  useEffect(() => {
    // keep in sync if permission changes elsewhere
    const handle = () => {
      if (typeof Notification !== "undefined")
        setNotifStatus(Notification.permission);
    };
    window.addEventListener("focus", handle);
    return () => window.removeEventListener("focus", handle);
  }, []);

  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onloadend = async () => {
      const base64Image = reader.result;
      setSelectedImg(base64Image);
      await updateProfile({ profilePic: base64Image });
    };
  };

  return (
    <div className="p-6 border-b border-slate-700/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* AVATAR */}
          <div className="avatar online">
            <button
              className="size-14 rounded-full overflow-hidden relative group"
              onClick={() => fileInputRef.current.click()}>
              <img
                src={selectedImg || authUser.profilePic || "/avatar.png"}
                alt="User image"
                className="size-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-white text-xs">Change</span>
              </div>
            </button>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* USERNAME & ONLINE TEXT */}
          <div>
            <h3 className="text-slate-200 font-medium text-base max-w-[180px] truncate">
              {authUser.fullName}
            </h3>
            {authUser.contactId ? (
              <p className="text-cyan-400 text-xs font-mono">
                #{authUser.contactId}
              </p>
            ) : (
              <button
                onClick={() => setShowSetContactId(true)}
                className="text-xs text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-1">
                <HashIcon className="w-3 h-3" />
                <span>Set Contact ID</span>
              </button>
            )}
          </div>
        </div>

        {/* BUTTONS */}
        <div className="flex gap-4 items-center">
          {/* CONTACT ID */}
          <button
            onClick={() => setShowSetContactId(true)}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            title={
              authUser.contactId
                ? `Your Contact ID: ${authUser.contactId}`
                : "Set your Contact ID"
            }>
            <HashIcon className="size-5" />
          </button>

          {/* NOTIFICATIONS */}
          <button
            onClick={async () => {
              // request permission from inside user gesture
              const granted = await requestNotificationPermission();
              if (granted) {
                setNotifStatus("granted");
                try {
                  await notify(
                    "Notifications enabled",
                    "You'll receive chat alerts."
                  );
                } catch (e) {}
              } else {
                setNotifStatus("denied");
              }
            }}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            title={
              notifStatus === "granted"
                ? "Notifications enabled"
                : "Enable notifications"
            }>
            {notifStatus === "granted" ? (
              <BellIcon className="size-5" />
            ) : (
              <BellOffIcon className="size-5" />
            )}
          </button>
          {/* LOGOUT BTN */}
          <button
            className="text-slate-400 hover:text-slate-200 transition-colors"
            onClick={logout}>
            <LogOutIcon className="size-5" />
          </button>

          {/* SOUND TOGGLE BTN */}
          <button
            className="text-slate-400 hover:text-slate-200 transition-colors"
            onClick={() => {
              // play click sound before toggling
              mouseClickSound.currentTime = 0; // reset to start
              mouseClickSound
                .play()
                .catch((error) => console.log("Audio play failed:", error));
              toggleSound();
            }}>
            {isSoundEnabled ? (
              <Volume2Icon className="size-5" />
            ) : (
              <VolumeOffIcon className="size-5" />
            )}
          </button>
        </div>
      </div>

      {/* Set Contact ID Modal */}
      {showSetContactId && (
        <SetContactId
          onClose={() => setShowSetContactId(false)}
          onSuccess={(updatedUser) => {
            // Update auth user with new contact ID
            // The setContactId already handles this through the store
          }}
        />
      )}
    </div>
  );
}
export default ProfileHeader;
