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

    console.log("✅ Database reset complete!");
    console.log(`   - Teams deleted: ${teamsResult.deletedCount}`);
    console.log(`   - Submissions deleted: ${submissionsResult.deletedCount}`);
    console.log(`   - Milestones deleted: ${milestonesResult.deletedCount}`);
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
