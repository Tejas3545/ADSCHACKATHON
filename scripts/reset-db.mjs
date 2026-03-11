/**
 * Database Reset Script (ES Module)
 * 
 * WARNING: This will DELETE ALL DATA from your MongoDB database.
 * Use this to reset the leaderboard to a fresh state.
 * 
 * Usage:
 *   npm run reset-db -- --force
 */

import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const DEFAULT_MILESTONES = [
  {
    _id: "MS1",
    code: "MS1",
    title: "First Valid Commit",
    xp: 50,
    coins: 10,
    rules: {
      files: [],
      diff: { minFilesChanged: 1, minLinesAdded: 1 },
      manualReview: false,
    },
    active: true,
    sortOrder: 1,
  },
  {
    _id: "MS2",
    code: "MS2",
    title: "Meaningful Progress Commit",
    xp: 100,
    coins: 20,
    rules: {
      files: [],
      diff: { minFilesChanged: 2, minLinesAdded: 20 },
      manualReview: false,
    },
    active: true,
    sortOrder: 2,
  },
  {
    _id: "MS3",
    code: "MS3",
    title: "Project README Updated",
    xp: 150,
    coins: 30,
    rules: {
      files: [{ path: "README.md", minChars: 100, requiredKeywords: [] }],
      diff: { minFilesChanged: 1, minLinesAdded: 10 },
      manualReview: false,
    },
    active: true,
    sortOrder: 3,
  },
];

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", ".env.local") });

async function resetDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI environment variable is not set");
    console.error("   Make sure you have a .env.local file with MONGODB_URI");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    console.log("🔗 Connecting to MongoDB...");
    await client.connect();
    
    const dbName = process.env.MONGODB_DB || "hackathon_leaderboard";
    const db = client.db(dbName);

    const teams = db.collection("teams");
    const milestones = db.collection("milestones");
    const submissions = db.collection("submissions");

    console.log("\n⚠️  WARNING: This will DELETE ALL DATA from the following collections:");
    console.log("   - teams");
    console.log("   - submissions");
    console.log("   - milestones");
    console.log("\nThis action cannot be undone!\n");

    // Check if --force flag is provided
    const args = process.argv.slice(2);
    if (!args.includes("--force")) {
      console.log("To proceed with the reset, run this command with the --force flag:");
      console.log("  npm run reset-db -- --force");
      console.log("\n(Note the double dashes before --force)\n");
      process.exit(0);
    }

    console.log("🗑️  Deleting all data...\n");

    const [teamsResult, submissionsResult, milestonesResult] = await Promise.all([
      teams.deleteMany({}),
      submissions.deleteMany({}),
      milestones.deleteMany({}),
    ]);

    const seeded = await milestones.insertMany(DEFAULT_MILESTONES);

    console.log("✅ Database reset complete!");
    console.log(`   - Teams deleted: ${teamsResult.deletedCount}`);
    console.log(`   - Submissions deleted: ${submissionsResult.deletedCount}`);
    console.log(`   - Milestones deleted: ${milestonesResult.deletedCount}`);
    console.log(`   - Default milestones seeded: ${seeded.insertedCount}`);
    console.log("\n💡 Next steps:");
    console.log("   1. Restart your Next.js development server (if running)");
    console.log("   2. Teams can now register fresh!\n");

  } catch (error) {
    console.error("❌ Error resetting database:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

resetDatabase();
