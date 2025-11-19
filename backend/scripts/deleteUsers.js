#!/usr/bin/env node
import { stdin as input, stdout as output } from "node:process";
import readline from "readline/promises";
import { connectDB } from "../src/lib/db.js";
import User from "../src/models/User.js";

async function run() {
  await connectDB();

  const force =
    process.env.FORCE_DELETE === "1" || process.env.FORCE_DELETE === "true";

  if (!force) {
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question(
      "Are you sure you want to DELETE ALL users? This is IRREVERSIBLE. Type 'DELETE' to continue: "
    );
    rl.close();
    if (answer !== "DELETE") {
      console.log("Aborting. No users were deleted.");
      process.exit(0);
    }
  } else {
    console.log(
      "FORCE_DELETE enabled; proceeding without interactive confirmation."
    );
  }

  const res = await User.deleteMany({});
  console.log(`Deleted ${res.deletedCount || 0} users.`);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
