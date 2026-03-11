/**
 * Database indexing utility
 * Ensures optimal query performance for high concurrent load
 */

import { getCollections } from "./collections";

export async function ensureIndexes() {
  const { teams, milestones, submissions } = await getCollections();

  try {
    // Teams collection indexes
    await teams.createIndex({ xp: -1, lastXpAt: 1 }); // For leaderboard sorting
    await teams.createIndex({ frozen: 1 }); // For filtering frozen teams
    await teams.createIndex({ "repo.owner": 1, "repo.repo": 1 }); // For repo lookups
    
    // Milestones collection indexes
    await milestones.createIndex({ active: 1, sortOrder: 1 }); // For fetching active milestones
    await milestones.createIndex({ code: 1 }); // For milestone lookups
    
    // Submissions collection indexes
    await submissions.createIndex({ teamId: 1, status: 1 }); // For team submissions
    await submissions.createIndex({ teamId: 1, milestoneId: 1 }); // For duplicate checks
    await submissions.createIndex({ status: 1, createdAt: -1 }); // For admin dashboard
    await submissions.createIndex({ teamId: 1, milestoneCode: 1 }); // For milestone code lookups
    
    console.log("✅ Database indexes created successfully");
    return { success: true };
  } catch (error) {
    console.error("❌ Error creating indexes:", error);
    return { success: false, error };
  }
}
