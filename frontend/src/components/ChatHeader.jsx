import {
  Mic2Icon,
  MicOffIcon,
  PauseCircleIcon,
  PhoneCallIcon,
  PhoneOffIcon,
  PlayIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

function ChatHeader() {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const isOnline = onlineUsers.includes(selectedUser._id);
  const socket = useAuthStore((s) => s.socket);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const timerRef = useRef(null);
  const [callState, setCallState] = useState(null); // 'calling','incoming','in-call'
  const [muted, setMuted] = useState(false);
  const [callTime, setCallTime] = useState(0); // seconds
  const [onHold, setOnHold] = useState(false);
  const incomingFromRef = useRef(null);

  // STUN/TURN servers. You can set VITE_TURN_SERVERS in .env as a JSON array
  // Example: VITE_TURN_SERVERS='[{"urls":"turn:turn.example.com:3478","username":"user","credential":"pass"}]'
  const defaultStun = [{ urls: "stun:stun.l.google.com:19302" }];
  let rtcConfig;
  try {
    const turnEnv = import.meta.env.VITE_TURN_SERVERS;
    if (turnEnv) {
      const parsed = JSON.parse(turnEnv);
      rtcConfig = { iceServers: [...defaultStun, ...parsed] };
    } else {
      rtcConfig = { iceServers: defaultStun };
    }
  } catch (err) {
    rtcConfig = { iceServers: defaultStun };
  }

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === "Escape") setSelectedUser(null);
    };

    window.addEventListener("keydown", handleEscKey);

    // cleanup function
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [setSelectedUser]);

  useEffect(() => {
    if (!socket) return;

    socket.on("call:incoming", async ({ from, sdp }) => {
      // incoming call from 'from'
      console.log("📞 Incoming call from:", from);
      incomingFromRef.current = from;
      setCallState("incoming");
      // store remote sdp until accepted
      socket._incomingSdp = sdp;
    });

    socket.on("call:answered", async ({ from, sdp }) => {
      try {
        console.log("✅ Call answered by:", from);
        if (pcRef.current && sdp) {
          await pcRef.current.setRemoteDescription({ type: "answer", sdp });
          console.log("🔗 Remote description set, call is in progress");
          // when remote answer arrives, connection will proceed — mark as in-call
          setCallState("in-call");
        }
      } catch (err) {
        console.error("❌ Error handling call answer:", err);
      }
    });

    socket.on("call:candidate", async ({ from, candidate }) => {
      try {
        if (pcRef.current && candidate) {
          await pcRef.current.addIceCandidate(candidate);
        }
      } catch (err) {
        console.error(err);
      }
    });

    socket.on("call:hangup", ({ from }) => {
      // remote hung up
      endCall();
    });

    return () => {
      socket.off("call:incoming");
      socket.off("call:answered");
      socket.off("call:candidate");
      socket.off("call:hangup");
    };
  }, [socket]);

  const endCall = () => {
    try {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (remoteAudioRef.current) {
        try {
          remoteAudioRef.current.srcObject = null;
        } catch (e) {}
      }
      setMuted(false);
      setCallTime(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } catch (err) {}
    setCallState(null);
    incomingFromRef.current = null;
  };

  const startCall = async () => {
    if (!socket || !selectedUser) return;
    console.log("📞 Starting call to:", selectedUser.fullName);
    setCallState("calling");
    try {
      console.log("🎤 Requesting microphone for call...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      console.log("✅ Microphone granted for call");
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;
      console.log("🔗 RTCPeerConnection created with config:", rtcConfig);

      // add tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          console.log("🧊 Sending ICE candidate to peer");
          socket.emit("call:candidate", {
            to: selectedUser._id,
            candidate: e.candidate,
          });
        }
      };

      // attach remote audio when track arrives
      pc.ontrack = (event) => {
        try {
          const remoteStream = event.streams && event.streams[0];
          if (remoteAudioRef.current && remoteStream) {
            remoteAudioRef.current.srcObject = remoteStream;
            // start timer when we have remote stream
            setCallState("in-call");
          }
        } catch (e) {
          console.error(e);
        }
      };

      pc.onconnectionstatechange = () => {
        if (!pcRef.current) return;
        const state = pcRef.current.connectionState;
        if (
          state === "disconnected" ||
          state === "failed" ||
          state === "closed"
        ) {
          endCall();
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log("📡 Sending call offer to:", selectedUser._id);

      socket.emit("call:offer", { to: selectedUser._id, sdp: offer.sdp });
    } catch (err) {
      console.error("❌ Error starting call:", err);
      setCallState(null);
    }
  };

  const acceptCall = async () => {
    const from = incomingFromRef.current;
    if (!socket || !from) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      localStreamRef.current = stream;
      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("call:candidate", { to: from, candidate: e.candidate });
        }
      };

      pc.ontrack = (event) => {
        try {
          const remoteStream = event.streams && event.streams[0];
          if (remoteAudioRef.current && remoteStream) {
            remoteAudioRef.current.srcObject = remoteStream;
          }
        } catch (e) {
          console.error(e);
        }
      };

      pc.onconnectionstatechange = () => {
        if (!pcRef.current) return;
        const state = pcRef.current.connectionState;
        if (
          state === "disconnected" ||
          state === "failed" ||
          state === "closed"
        ) {
          endCall();
        }
      };

      // set remote offer
      const incomingSdp = socket._incomingSdp;
      if (incomingSdp)
        await pc.setRemoteDescription({ type: "offer", sdp: incomingSdp });

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call:answer", { to: from, sdp: answer.sdp });
      setCallState("in-call");
    } catch (err) {
      console.error(err);
      endCall();
    }
  };

  const getPeerId = () =>
    incomingFromRef.current || (selectedUser && selectedUser._id);

  const hangup = () => {
    const peer = getPeerId();
    if (socket && peer) socket.emit("call:hangup", { to: peer });
    endCall();
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const tracks = localStreamRef.current.getAudioTracks();
    if (!tracks || !tracks.length) return;
    const enabled = !tracks[0].enabled;
    tracks.forEach((t) => (t.enabled = enabled));
    setMuted(!enabled ? false : !enabled ? false : !tracks[0].enabled);
    // simpler: flip state
    setMuted((m) => !m);
  };

  const toggleHold = () => {
    // hold: mute outgoing and mute incoming playback
    if (localStreamRef.current) {
      localStreamRef.current
        .getAudioTracks()
        .forEach((t) => (t.enabled = onHold));
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !onHold;
    }
    setOnHold((h) => !h);
  };

  // call timer effect
  useEffect(() => {
    if (callState === "in-call") {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setCallTime((t) => t + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (callState === null) setCallTime(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [callState]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <>
      <div
        className="flex justify-between items-center bg-slate-800/50 border-b
   border-slate-700/50 max-h-[84px] px-6 flex-1">
        <div className="flex items-center space-x-3">
          <div className={`avatar ${isOnline ? "online" : "offline"}`}>
            <div className="w-12 rounded-full">
              <img
                src={selectedUser.profilePic || "/avatar.png"}
                alt={selectedUser.fullName}
              />
            </div>
          </div>

          <div>
            <h3 className="text-slate-200 font-medium">
              {selectedUser.fullName}
            </h3>
            <p className="text-slate-400 text-sm">
              {isOnline ? "Online" : "Offline"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => startCall()}
            className="text-slate-400 hover:text-slate-200 transition-colors">
            <PhoneCallIcon className="w-5 h-5" />
          </button>

          <button onClick={() => setSelectedUser(null)}>
            <XIcon className="w-5 h-5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer" />
          </button>
        </div>
      </div>

      {/* remote audio element (attach incoming stream here) */}
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      {/* calling spinner/overlay for outgoing calls */}
      {callState === "calling" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-slate-800 rounded-lg p-4 w-11/12 max-w-sm text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full border border-slate-600 flex items-center justify-center">
                <div className="w-5 h-5 border-4 border-slate-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <h3 className="text-white">Calling {selectedUser.fullName}...</h3>
              <div className="flex gap-3">
                <button
                  onClick={() => hangup()}
                  className="px-3 py-2 bg-red-600 rounded">
                  Hang up
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* in-call controls (small bar) */}
      {callState === "in-call" && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-slate-800/90 text-white rounded-lg px-4 py-2 flex items-center gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="font-medium">{selectedUser.fullName}</span>
                <span className="text-sm text-slate-300">
                  {formatTime(callTime)}
                </span>
              </div>
              <button
                onClick={() => toggleMute()}
                className="flex items-center gap-2 px-2 py-1 bg-slate-700 rounded text-sm">
                {muted ? (
                  <MicOffIcon className="w-4 h-4" />
                ) : (
                  <Mic2Icon className="w-4 h-4" />
                )}{" "}
                <span>{muted ? "Unmute" : "Mute"}</span>
              </button>
              <button
                onClick={() => toggleHold()}
                className="flex items-center gap-2 px-2 py-1 bg-slate-700 rounded text-sm">
                {onHold ? (
                  <PlayIcon className="w-4 h-4" />
                ) : (
                  <PauseCircleIcon className="w-4 h-4" />
                )}{" "}
                <span>{onHold ? "Resume" : "Hold"}</span>
              </button>
              <button
                onClick={() => hangup()}
                className="flex items-center gap-2 px-3 py-1 bg-red-600 rounded">
                <PhoneOffIcon className="w-4 h-4" /> <span>Hang up</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {callState === "incoming" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-slate-800 rounded-lg p-4 w-11/12 max-w-sm">
            <h3 className="text-white mb-2">
              Incoming call from {selectedUser?.fullName || "Unknown"}
            </h3>
            <div className="flex gap-3">
              <button
                onClick={() => acceptCall()}
                className="px-3 py-2 bg-green-600 rounded">
                ✅ Accept
              </button>
              <button
                onClick={() => endCall()}
                className="px-3 py-2 bg-red-600 rounded">
                ❌ Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export default ChatHeader;
