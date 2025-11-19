import jwt from "jsonwebtoken";
import { ENV } from "./env.js";

export const generateToken = (userId, res) => {
  const { JWT_SECRET } = ENV;
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  const token = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000, // MS
    httpOnly: true, // prevent XSS attacks: cross-site scripting
    // For cross-site clients (Capacitor WebView uses https://localhost) we must
    // use SameSite='none' in production so the browser will accept/send the
    // cookie across origins. During local development keep a relaxed value.
    sameSite: ENV.NODE_ENV === "development" ? "lax" : "none",
    secure: ENV.NODE_ENV === "development" ? false : true,
  });

  return token;
};

// http://localhost
// https://dsmakmk.com
