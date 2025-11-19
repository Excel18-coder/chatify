import express from "express";
import http from "http";
import { Server } from "socket.io";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import { ENV } from "./env.js";

const app = express();
const server = http.createServer(app);

// Allow socket.io connections from the same set of allowed origins.
const allowedSocketOrigins = [
  ENV.CLIENT_URL,
  "https://localhost",
  "https://clevery.sevalla.app",
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedSocketOrigins,
    credentials: true,
  },
});

// apply authentication middleware to all socket connections
io.use(socketAuthMiddleware);

// we will use this function to check if the user is online or not
export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// this is for storig online users
const userSocketMap = {}; // {userId:socketId}

io.on("connection", (socket) => {
  console.log("A user connected", socket.user.fullName);

  const userId = socket.userId;
  userSocketMap[userId] = socket.id;

  // io.emit() is used to send events to all connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // with socket.on we listen for events from clients
  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.user.fullName);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { app, io, server };
