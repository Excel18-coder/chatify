import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

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
    const { text, image } = req.body;
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

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
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
