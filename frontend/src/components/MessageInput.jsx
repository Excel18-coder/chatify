import { ImageIcon, Mic2Icon, SendIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import useKeyboardSound from "../hooks/useKeyboardSound";
import { useChatStore } from "../store/useChatStore";

function MessageInput() {
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const fileInputRef = useRef(null);

  const { sendMessage, isSoundEnabled, updateMessage } = useChatStore();

  // support edit mode via window event or prop in future
  const [editingMessage, setEditingMessage] = useState(null);

  useEffect(() => {
    function onEditEvent(e) {
      setEditingMessage(e.detail || null);
      if (e.detail && e.detail.text) setText(e.detail.text);
    }
    window.addEventListener("message:edit", onEditEvent);
    return () => window.removeEventListener("message:edit", onEditEvent);
  }, []);

  useEffect(() => {
    return () => {
      try {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state !== "inactive"
        )
          mediaRecorderRef.current.stop();
      } catch (err) {}
    };
  }, []);

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error("Recording is not supported in this environment");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: "audio/webm",
        });
        setRecordedBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mr.start();
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      toast.error("Could not start recording");
    }
  };

  const stopRecording = () => {
    try {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
    } catch (err) {}
    setIsRecording(false);
  };

  const clearRecording = () => {
    setRecordedBlob(null);
    recordedChunksRef.current = [];
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview && !recordedBlob) return;
    if (isSoundEnabled) playRandomKeyStrokeSound();
    if (editingMessage && editingMessage._id) {
      // update existing message
      await updateMessage(editingMessage._id, text.trim());
      setEditingMessage(null);
    } else {
      // if we have a recorded audio blob, convert to base64 data URL and send as audio
      if (recordedBlob) {
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(recordedBlob);
        });
        sendMessage({ text: text.trim(), image: imagePreview, audio: dataUrl });
        clearRecording();
      } else {
        sendMessage({
          text: text.trim(),
          image: imagePreview,
        });
      }
    }

    setText("");
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setText("");
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="p-4 border-t border-slate-700/50">
      {imagePreview && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-slate-700"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-200 hover:bg-slate-700"
              type="button">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSendMessage}
        className="max-w-3xl mx-auto flex space-x-4">
        {editingMessage && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300">Editing...</span>
            <button
              type="button"
              onClick={cancelEdit}
              className="text-xs text-yellow-300">
              Cancel
            </button>
          </div>
        )}
        <input
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            isSoundEnabled && playRandomKeyStrokeSound();
          }}
          className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-4"
          placeholder="Type your message..."
        />

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`bg-slate-800/50 text-slate-400 hover:text-slate-200 rounded-lg px-4 transition-colors ${
            imagePreview ? "text-cyan-500" : ""
          }`}>
          <ImageIcon className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (isRecording) stopRecording();
            else startRecording();
          }}
          className={`bg-slate-800/50 text-slate-400 hover:text-slate-200 rounded-lg px-4 transition-colors ${
            recordedBlob ? "text-yellow-300" : ""
          }`}>
          <Mic2Icon className="w-5 h-5" />
        </button>
        {recordedBlob && (
          <button
            type="button"
            onClick={() => {
              // play recorded audio
              const url = URL.createObjectURL(recordedBlob);
              const a = new Audio(url);
              a.play().catch((e) => console.log(e));
            }}
            className="bg-slate-800/50 text-slate-400 hover:text-slate-200 rounded-lg px-4">
            ▶︎
          </button>
        )}
        <button
          type="submit"
          disabled={!text.trim() && !imagePreview}
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg px-4 py-2 font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          <SendIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
export default MessageInput;
