#!/usr/bin/env node
import fs from "fs";
import { stdin as input, stdout as output } from "node:process";
import path from "path";
import readline from "readline/promises";
import { fileURLToPath } from "url";
import cloudinary from "../src/lib/cloudinary.js";
import { connectDB } from "../src/lib/db.js";
import Message from "../src/models/Message.js";
import User from "../src/models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function publicIdFromUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/");
    const uploadIndex = parts.findIndex((p) => p === "upload");
    if (uploadIndex === -1) return null;
    const after = parts.slice(uploadIndex + 1).join("/");
    const afterParts = after.split("/");
    if (afterParts[0].startsWith("v") && /^v\d+/.test(afterParts[0]))
      afterParts.shift();
    const last = afterParts.join("/");
    const dot = last.lastIndexOf(".");
    return dot === -1 ? last : last.slice(0, dot);
  } catch (err) {
    return null;
  }
}

async function run() {
  await connectDB();

  const force =
    process.env.FORCE_DELETE === "1" || process.env.FORCE_DELETE === "true";

  if (!force) {
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question(
      "Are you sure you want to DELETE ALL users + related messages + Cloudinary assets? Type 'DELETE' to continue: "
    );
    rl.close();
    if (answer !== "DELETE") {
      console.log("Aborting. No changes made.");
      process.exit(0);
    }
  } else {
    console.log(
      "FORCE_DELETE enabled; proceeding without interactive confirmation."
    );
  }

  // build a list of Cloudinary public_ids from existing users/messages
  const users = await User.find().lean();
  const messages = await Message.find().lean();

  const assetUrls = new Set();
  users.forEach((u) => {
    if (u.profilePic) assetUrls.add(u.profilePic);
  });
  messages.forEach((m) => {
    if (m.image) assetUrls.add(m.image);
  });

  const publicIds = [];
  for (const url of assetUrls) {
    const pid = publicIdFromUrl(url);
    if (pid) publicIds.push(pid);
  }

  console.log(
    `Found ${publicIds.length} Cloudinary public_ids to delete (from DB references).`
  );

  let deletedCloud = 0;
  for (const pid of publicIds) {
    try {
      const res = await cloudinary.uploader.destroy(pid, { invalidate: true });
      if (res.result === "ok" || res.result === "not_found") {
        deletedCloud++;
      } else {
        console.warn(`Cloudinary destroy result for ${pid}:`, res);
      }
    } catch (err) {
      console.error(`Failed to delete Cloudinary asset ${pid}:`, err.message);
    }
  }

  // Delete messages and users
  const msgRes = await Message.deleteMany({});
  const userRes = await User.deleteMany({});

  console.log(`Deleted ${msgRes.deletedCount || 0} messages.`);
  console.log(`Deleted ${userRes.deletedCount || 0} users.`);
  console.log(
    `Requested deletion of ${publicIds.length} cloud assets; ${deletedCloud} reported deleted or not_found.`
  );

  // keep a small record of what was deleted in backups folder
  const backupBase = path.join(__dirname, "../backups");
  if (!fs.existsSync(backupBase)) fs.mkdirSync(backupBase, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const record = {
    timestamp: ts,
    deletedUsers: userRes.deletedCount || 0,
    deletedMessages: msgRes.deletedCount || 0,
    cloudinaryAttempted: publicIds.length,
    cloudinaryDeletedOrNotFound: deletedCloud,
  };
  fs.writeFileSync(
    path.join(backupBase, `deletion-record-${ts}.json`),
    JSON.stringify(record, null, 2),
    "utf-8"
  );

  console.log(
    "Deletion complete. A deletion-record JSON was written to backups."
  );
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
