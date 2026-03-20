import type { Collection, Db } from "mongodb";
import { getDb } from "@/lib/db";
import type { Milestone, MilestoneSubmission, Team } from "@/lib/models";

export type LeaderboardState = {
  _id: "leaderboard_state";
  isRunning: boolean;
  startedAt: Date | null;
  endedAt: Date | null;
  updatedAt: Date;
};

export type Collections = {
  teams: Collection<Team>;
  milestones: Collection<Milestone>;
  submissions: Collection<MilestoneSubmission>;
  settings: Collection<LeaderboardState>;
};

export async function getCollections(db?: Db): Promise<Collections> {
  const database = db ?? (await getDb());

  return {
    teams: database.collection<Team>("teams"),
    milestones: database.collection<Milestone>("milestones"),
    submissions: database.collection<MilestoneSubmission>("submissions"),
    settings: database.collection<LeaderboardState>("settings"),
  };
}

export async function ensureIndexes() {
  const db = await getDb();
  const { teams, milestones, submissions, settings } = await getCollections(db);

  await Promise.all([
    // Teams indexes
    teams.createIndex({ xp: -1, lastCommitAt: -1, lastXpAt: -1 }), // Primary leaderboard sort
    teams.createIndex({ name: 1 }, { unique: true }),
    teams.createIndex({ frozen: 1 }), // Filter frozen teams
    teams.createIndex({ "repo.owner": 1, "repo.repo": 1 }), // Repo lookups
    
    // Milestones indexes
    milestones.createIndex({ code: 1 }, { unique: true }),
    milestones.createIndex({ active: 1, sortOrder: 1 }), // Active milestones query
    
    // Submissions indexes - optimized for high concurrency
    submissions.createIndex({ teamId: 1, milestoneId: 1, createdAt: -1 }),
    submissions.createIndex({ teamId: 1, status: 1 }), // Team dashboard queries
    submissions.createIndex({ status: 1, createdAt: -1 }), // Admin dashboard
    submissions.createIndex({ teamId: 1, milestoneCode: 1 }), // Fast code lookups
    settings.createIndex({ _id: 1 }, { unique: true }),
  ]);
  
  console.log("✅ All database indexes created for optimal performance");
}
