import { z } from "zod";

export const TeamMemberSchema = z.object({
  name: z.string().min(1).max(80),
});

export const RepoSchema = z.object({
  url: z.string().url(),
  owner: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().min(1).default("main"),
});

export const TeamSchema = z.object({
  _id: z.string(),
  name: z.string().min(2).max(80),
  members: z.array(TeamMemberSchema).min(1).max(7),
  repo: RepoSchema,
  createdAt: z.date(),
  xp: z.number().int().nonnegative(),
  coins: z.number().int().nonnegative(),
  frozen: z.boolean().default(false),
  lastXpAt: z.date().nullable().default(null),
  lastCheckedSha: z.string().nullable().optional(),
});

export type Team = z.infer<typeof TeamSchema>;

export type MilestoneFileRule = {
  path: string;
  minChars: number;
  requiredKeywords?: string[];
};

export type MilestoneDiffRule = {
  minFilesChanged?: number;
  minLinesAdded?: number;
};

export type MilestoneRules = {
  files: MilestoneFileRule[];
  diff?: MilestoneDiffRule;
  requireToken?: boolean;
  tokenValue?: string;
  manualReview?: boolean;
};

export const MilestoneSchema = z.object({
  _id: z.string(),
  code: z.string().min(2).max(10),
  title: z.string().min(2).max(120),
  xp: z.number().int().positive(),
  coins: z.number().int().nonnegative(),
  rules: z.any(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().nonnegative().default(0),
});

export type Milestone = Omit<z.infer<typeof MilestoneSchema>, "rules"> & {
  rules: MilestoneRules;
};

export const SubmissionStatusSchema = z.enum([
  "pending",
  "verified",
  "rejected",
]);

export type SubmissionStatus = z.infer<typeof SubmissionStatusSchema>;

export const MilestoneSubmissionSchema = z.object({
  _id: z.string(),
  teamId: z.string(),
  milestoneId: z.string(),
  milestoneCode: z.string(),
  createdAt: z.date(),
  validatedAt: z.date().nullable().default(null),
  status: SubmissionStatusSchema,
  reason: z.string().nullable().default(null),
  github: z
    .object({
      headSha: z.string().nullable().default(null),
      prUrl: z.string().nullable().default(null),
    })
    .default({ headSha: null, prUrl: null }),
  xpAwarded: z.number().int().optional(),
  xpBreakdown: z
    .object({
      baseXP: z.number().int(),
      multiplier: z.number(),
      bonusXP: z.number().int(),
      completionPercentage: z.number(),
    })
    .optional(),
});

export type MilestoneSubmission = z.infer<typeof MilestoneSubmissionSchema>;

export function levelFromXp(xp: number) {
  if (xp >= 500) return 4;
  if (xp >= 250) return 3;
  if (xp >= 100) return 2;
  return 1;
}
