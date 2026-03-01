import type { Collection, Db } from "mongodb";
import { getDb } from "@/lib/db";
import type { Milestone, MilestoneSubmission, Team } from "@/lib/models";

export type Collections = {
  teams: Collection<Team>;
  milestones: Collection<Milestone>;
  submissions: Collection<MilestoneSubmission>;
};

export async function getCollections(db?: Db): Promise<Collections> {
  const database = db ?? (await getDb());

  return {
    teams: database.collection<Team>("teams"),
    milestones: database.collection<Milestone>("milestones"),
    submissions: database.collection<MilestoneSubmission>("submissions"),
  };
}

export async function ensureIndexes() {
  const db = await getDb();
  const { teams, milestones, submissions } = await getCollections(db);

  await Promise.all([
    teams.createIndex({ xp: -1, lastXpAt: 1 }),
    teams.createIndex({ name: 1 }, { unique: true }),
    milestones.createIndex({ code: 1 }, { unique: true }),
    milestones.createIndex({ active: 1, sortOrder: 1 }),
    submissions.createIndex({ teamId: 1, milestoneId: 1, createdAt: -1 }),
  ]);
}
