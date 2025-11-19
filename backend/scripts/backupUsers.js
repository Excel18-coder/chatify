#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "../src/lib/db.js";
import User from "../src/models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  await connectDB();

  const users = await User.find().lean();
  const backupDir = path.join(__dirname, "../backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = path.join(backupDir, `users-backup-${ts}.json`);

  fs.writeFileSync(filename, JSON.stringify(users, null, 2), "utf-8");

  console.log(`Wrote ${users.length} users to ${filename}`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
