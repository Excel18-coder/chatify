import ffmpegStatic from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs/promises";
import os from "os";
import path from "path";
import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

// Ensure fluent-ffmpeg uses the static binary
if (ffmpegStatic) {
  try {
    ffmpeg.setFfmpegPath(ffmpegStatic);
  } catch (e) {
    console.warn("Could not set ffmpeg path:", e.message || e);
  }
}

export const getAllContacts = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUserId },
    }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.log("Error in getAllContacts:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMessagesByUserId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: userToChatId } = req.params;

    // fetch the conversation (including messages marked deletedForEveryone)
    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 });

    // filter out messages that the requesting user deleted for themselves
    const filtered = messages
      .filter((m) => {
        if (!m.deletedFor || m.deletedFor.length === 0) return true;
        return !m.deletedFor.some((uId) => uId.toString() === myId.toString());
      })
      .map((m) => {
        // if message was deleted for everyone, normalize the payload so clients
        // can render a 'message deleted' placeholder
        if (m.deletedForEveryone) {
          return {
            _id: m._id,
            senderId: m.senderId,
            receiverId: m.receiverId,
            text: null,
            image: null,
            deletedForEveryone: true,
            createdAt: m.createdAt,
            updatedAt: m.updatedAt,
          };
        }

        return m;
      });

    res.status(200).json(filtered);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, audio } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!text && !image) {
      return res.status(400).json({ message: "Text or image is required." });
    }
    if (senderId.equals(receiverId)) {
      return res
        .status(400)
        .json({ message: "Cannot send messages to yourself." });
    }
    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) {
      return res.status(404).json({ message: "Receiver not found." });
    }

    let imageUrl;
    if (image) {
      // upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    let audioUrl;
    if (audio) {
      // if audio is a data URL (base64), convert to a normalized mp3 using ffmpeg
      try {
        let uploadTarget = audio;

        // helper to write base64 dataURL to temp file
        const writeBase64ToFile = async (dataUrl, outPath) => {
          const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
          if (!match) throw new Error("Invalid data URL");
          const b64 = match[2];
          const buf = Buffer.from(b64, "base64");
          await fs.writeFile(outPath, buf);
        };

        // If it's a data URL - convert it
        if (typeof audio === "string" && audio.startsWith("data:")) {
          const tmpDir = await fs.mkdtemp(
            path.join(os.tmpdir(), "chat-audio-")
          );
          const inPath = path.join(tmpDir, "in_audio");
          // guess extension from mime
          const mimeMatch = audio.match(/^data:(.+);base64,/);
          const mime = mimeMatch ? mimeMatch[1] : "audio/webm";
          const ext = mime.includes("ogg")
            ? "ogg"
            : mime.includes("wav")
            ? "wav"
            : "webm";
          const inFile = inPath + "." + ext;
          const outFile = path.join(tmpDir, "out.mp3");
          await writeBase64ToFile(audio, inFile);

          // run ffmpeg to convert to mp3 (widely compatible)
          await new Promise((resolve, reject) => {
            ffmpeg(inFile)
              .noVideo()
              .audioCodec("libmp3lame")
              .format("mp3")
              .on("end", resolve)
              .on("error", (err) => {
                console.error("ffmpeg error:", err);
                reject(err);
              })
              .save(outFile);
          });

          // upload converted file
          const uploadResponse = await cloudinary.uploader.upload(outFile, {
            resource_type: "video",
          });
          audioUrl = uploadResponse.secure_url;

          // cleanup temp files
          try {
            await fs.rm(tmpDir, { recursive: true, force: true });
          } catch (e) {}
        } else {
          // non-data URL (already a remote URL or Cloudinary link) - upload directly
          const uploadResponse = await cloudinary.uploader.upload(audio, {
            resource_type: "video",
          });
          audioUrl = uploadResponse.secure_url;
        }
      } catch (err) {
        console.error("Audio processing/upload failed:", err.message || err);
      }
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      audio: audioUrl,
    });

    const saved = await newMessage.save();

    // enrich payload with sender fullName for client notifications
    const sender = await User.findById(senderId).select("fullName");
    const payload = {
      _id: saved._id,
      senderId: saved.senderId,
      receiverId: saved.receiverId,
      text: saved.text,
      image: saved.image,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
      senderName: sender?.fullName || null,
    };

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", payload);
    }

    // also notify sender's own connected sockets so they can update if needed
    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("newMessage", payload);
    }

    res.status(201).json(payload);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getChatPartners = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    // find all the messages where the logged-in user is either sender or receiver
    const messages = await Message.find({
      $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
    });

    const chatPartnerIds = [
      ...new Set(
        messages.map((msg) =>
          msg.senderId.toString() === loggedInUserId.toString()
            ? msg.receiverId.toString()
            : msg.senderId.toString()
        )
      ),
    ];

    const chatPartners = await User.find({
      _id: { $in: chatPartnerIds },
    }).select("-password");

    res.status(200).json(chatPartners);
  } catch (error) {
    console.error("Error in getChatPartners: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const { scope } = req.query; // 'me' or 'everyone'
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    // only participants can delete
    if (
      message.senderId.toString() !== userId.toString() &&
      message.receiverId.toString() !== userId.toString()
    ) {
      return res
        .status(403)
        .json({ message: "Not allowed to delete this message" });
    }

    if (scope === "everyone") {
      // only sender can delete for everyone (common rule)
      if (message.senderId.toString() !== userId.toString()) {
        return res
          .status(403)
          .json({ message: "Only sender can delete for everyone" });
      }

      message.deletedForEveryone = true;
      message.text = null;
      message.image = null;
      await message.save();

      // inform both participants
      io.to(getReceiverSocketId(message.receiverId)).emit("messageDeleted", {
        messageId: message._id,
        scope: "everyone",
      });
      io.to(getReceiverSocketId(message.senderId)).emit("messageDeleted", {
        messageId: message._id,
        scope: "everyone",
      });

      return res.status(200).json({ message: "Deleted for everyone" });
    }

    // default: delete for me
    if (!message.deletedFor) message.deletedFor = [];
    if (!message.deletedFor.some((u) => u.toString() === userId.toString())) {
      message.deletedFor.push(userId);
      await message.save();
    }

    // inform only the requesting user's sockets to update UI
    io.to(getReceiverSocketId(userId)).emit("messageDeleted", {
      messageId: message._id,
      scope: "me",
      userId,
    });

    return res.status(200).json({ message: "Deleted for you" });
  } catch (error) {
    console.error("Error in deleteMessage: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text || typeof text !== "string")
      return res.status(400).json({ message: "Text is required to edit" });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    // only sender can edit
    if (message.senderId.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Only sender can edit the message" });
    }

    message.text = text;
    await message.save();

    const payload = {
      _id: message._id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      text: message.text,
      image: message.image,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };

    // notify both participants
    io.to(getReceiverSocketId(message.receiverId)).emit(
      "messageUpdated",
      payload
    );
    io.to(getReceiverSocketId(message.senderId)).emit(
      "messageUpdated",
      payload
    );

    res.status(200).json(payload);
  } catch (error) {
    console.error("Error in updateMessage:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
