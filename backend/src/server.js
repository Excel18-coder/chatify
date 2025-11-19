import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import path from "path";

import { connectDB } from "./lib/db.js";
import { ENV } from "./lib/env.js";
import { app, server } from "./lib/socket.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";

const __dirname = path.resolve();

const PORT = ENV.PORT || 3000;

app.use(express.json({ limit: "5mb" })); // req.body
// Allow multiple trusted origins: developer localhost, the Capacitor WebView origin
// (https://localhost), and the production client. Use a dynamic origin callback so
// the Access-Control-Allow-Origin header echoes the requesting origin when it's
// in the allowlist (required when credentials: true).
const allowedOrigins = [
  ENV.CLIENT_URL,
  "https://localhost",
  "https://clevery.sevalla.app",
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      return callback(new Error("CORS not allowed by server"));
    },
    credentials: true,
  })
);
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// make ready for deployment
if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (_, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

server.listen(PORT, () => {
  console.log("Server running on port: " + PORT);
  connectDB();
});
