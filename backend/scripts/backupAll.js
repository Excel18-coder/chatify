#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cloudinary from "../src/lib/cloudinary.js";
import { connectDB } from "../src/lib/db.js";
import Message from "../src/models/Message.js";
import User from "../src/models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function publicIdFromUrl(url) {
  try {
    const u = new URL(url);
    // path like /<cloud_name>/image/upload/v12345/folder/name.ext or /image/upload/v12345/name.ext
    const parts = u.pathname.split("/");
    const uploadIndex = parts.findIndex((p) => p === "upload");
    if (uploadIndex === -1) return null;
    // everything after upload/ may include version token v12345
    const after = parts.slice(uploadIndex + 1).join("/");
    // remove version prefix if present
    const afterParts = after.split("/");
    if (afterParts[0].startsWith("v") && /^v\d+/.test(afterParts[0]))
      afterParts.shift();
    const last = afterParts.join("/");
    // strip extension
    const dot = last.lastIndexOf(".");
    return dot === -1 ? last : last.slice(0, dot);
  } catch (err) {
    return null;
  }
}

async function downloadUrl(url, dest) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(dest, Buffer.from(buffer));
    return true;
  } catch (err) {
    console.error("download error:", err.message);
    return false;
  }
}

async function run() {
  await connectDB();

  const backupBase = path.join(__dirname, "../backups");
  ensureDir(backupBase);

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(backupBase, `all-backup-${ts}`);
  ensureDir(outDir);

  // export users and messages
  const users = await User.find().lean();
  const messages = await Message.find().lean();

  fs.writeFileSync(
    path.join(outDir, "users.json"),
    JSON.stringify(users, null, 2),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(outDir, "messages.json"),
    JSON.stringify(messages, null, 2),
    "utf-8"
  );

  console.log(
    `Exported ${users.length} users and ${messages.length} messages to ${outDir}`
  );

  // gather asset URLs
  const assets = new Map();
  users.forEach((u) => {
    if (u.profilePic && typeof u.profilePic === "string")
      assets.set(u.profilePic, { url: u.profilePic, reason: "profilePic" });
  });
  messages.forEach((m) => {
    if (m.image && typeof m.image === "string")
      assets.set(m.image, { url: m.image, reason: "messageImage" });
  });

  const assetList = [];
  for (const [url] of assets) {
    const public_id = publicIdFromUrl(url);
    assetList.push({ url, public_id });
  }

  fs.writeFileSync(
    path.join(outDir, "cloudinary-assets.json"),
    JSON.stringify(assetList, null, 2),
    "utf-8"
  );
  console.log(`Found ${assetList.length} Cloudinary assets; manifest written.`);

  // attempt to download assets
  const assetsDir = path.join(outDir, "assets");
  ensureDir(assetsDir);
  let downloaded = 0;
  for (const a of assetList) {
    try {
      const u = new URL(a.url);
      const name = a.public_id || path.basename(u.pathname);
      const extMatch = path.extname(u.pathname) || "";
      const filename = `${name}${extMatch}`.replace(/\//g, "_");
      const dest = path.join(assetsDir, filename);
      const ok = await downloadUrl(a.url, dest);
      if (ok) downloaded++;
    } catch (err) {
      console.error("asset download failed for", a.url, err.message);
    }
  }

  console.log(
    `Downloaded ${downloaded}/${assetList.length} asset files to ${assetsDir}`
  );

  // additionally write a simple cloudinary resources list (remote lookup)
  try {
    const remote = await cloudinary.api.resources({ max_results: 500 });
    fs.writeFileSync(
      path.join(outDir, "cloudinary-remote-resources.json"),
      JSON.stringify(remote, null, 2),
      "utf-8"
    );
    console.log(
      `Fetched ${remote.resources.length} remote Cloudinary resources (first page).`
    );
  } catch (err) {
    console.warn(
      "Could not fetch remote Cloudinary resource list:",
      err.message
    );
  }

  console.log("Backup complete.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
