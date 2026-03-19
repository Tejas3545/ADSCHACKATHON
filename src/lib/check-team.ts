/**
 * check-team.ts
 * Shared logic to check a team's latest GitHub commit and automatically
 * award milestone XP/coins. Used by both the webhook handler and the
 * polling endpoint so the two paths stay in sync.
 */

import { getCollections } from "@/lib/collections";
import { broadcast } from "@/lib/broadcaster";
import { quickValidateCommit } from "@/lib/commit-validator";
import { calculateXPWithTimeBonus } from "@/lib/xp-calculator";
import { serverCache, CacheKeys } from "@/lib/cache";
import { ensureDefaultMilestones } from "@/lib/milestone-seed";
import { assertLeaderboardRunning } from "@/lib/leaderboard-state";
import { resolveRepoPolicy } from "@/lib/repo-xp-policy";
import { validateCommitMessageKeywords, validateRequiredPathPrefixes } from "@/lib/milestone-validation";
import { buildGitHubHeaders, fetchGitHubWithTokenFallback } from "@/lib/github-utils";
import { nanoid } from "nanoid";
import type { Team } from "@/lib/models";

type CheckResult =
  | { skipped: true; reason: string }
  | { skipped: false; headSha: string; results: Record<string, "verified" | "skipped" | "failed"> };

export async function checkTeam(team: Team): Promise<CheckResult> {
  const runningState = await assertLeaderboardRunning();
  if (!runningState.ok) {
    return { skipped: true, reason: runningState.reason };
  }

  const { owner, repo, branch } = team.repo;

  // Build GitHub API headers
  const headers = buildGitHubHeaders();

  let repoCreatedAt = team.repoCreatedAt ?? null;
  if (!repoCreatedAt) {
    const repoRes = await fetchGitHubWithTokenFallback(`https://api.github.com/repos/${owner}/${repo}`, headers);
    if (repoRes.ok) {
      const repoData = (await repoRes.json().catch(() => ({} as { created_at?: string }))) as { created_at?: string };
      if (repoData.created_at) {
        repoCreatedAt = new Date(repoData.created_at);
      }
    }
  }

  if (!repoCreatedAt) {
    return { skipped: true, reason: "Could not determine repository creation date" };
  }

  // ── Step 1: Get the latest commit SHA on the team's branch ──────────────
  const branchRes = await fetchGitHubWithTokenFallback(
    `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`,
    headers
  );

  if (!branchRes.ok) {
    return { skipped: true, reason: `GitHub API error ${branchRes.status} for ${owner}/${repo}` };
  }

  const branchData = await branchRes.json() as { sha: string };
  const headSha: string = branchData.sha;

  // ── Step 2: Skip if we already processed this exact commit ──────────────
  if (headSha === (team.lastCheckedSha ?? null)) {
    return { skipped: true, reason: "No new commits since last check" };
  }

  // ── Step 3: Fetch detailed commit info (files changed) ──────────────────
  const commitRes = await fetchGitHubWithTokenFallback(
    `https://api.github.com/repos/${owner}/${repo}/commits/${headSha}`,
    headers
  );
  const commitData = commitRes.ok
    ? (await commitRes.json() as {
        files?: { additions: number; filename: string }[];
        commit?: { message?: string; committer?: { date?: string } };
      })
    : { files: [] };
  const filesChanged = commitData.files ?? [];
  const commitMessage = commitData.commit?.message ?? "";
  const commitAt = commitData.commit?.committer?.date
    ? new Date(commitData.commit.committer.date)
    : new Date();

  // ── Step 3.5: Validate commit quality to filter spam ──────────────────
  const validation = quickValidateCommit(filesChanged, 10, 1);
  if (!validation.isValid) {
    console.log(`[check-team] ${team.name} commit ${headSha.substring(0, 7)} rejected: ${validation.reason} (score: ${validation.qualityScore})`);
    // Update lastCheckedSha to avoid re-checking this spam commit
    await getCollections().then(({ teams: teamsCol }) => 
      teamsCol.updateOne({ _id: team._id }, { $set: { lastCheckedSha: headSha } })
    );
    return { 
      skipped: true, 
      reason: `Commit quality check failed: ${validation.reason}` 
    };
  }

  // ── Step 4: Load active milestones not yet verified for this team ────────
  await ensureDefaultMilestones();
  const { teams, milestones, submissions } = await getCollections();

  const activeMilestones = await milestones.find({ active: true }).toArray();
  const verifiedSubs = await submissions
    .find({ teamId: team._id, status: "verified" })
    .toArray();
  const verifiedCodes = new Set(verifiedSubs.map((s) => s.milestoneCode));

  const results: Record<string, "verified" | "skipped" | "failed"> = {};
  const now = new Date();

  // ── Step 5: Check each milestone ────────────────────────────────────────
  for (const milestone of activeMilestones) {
    if (verifiedCodes.has(milestone.code)) {
      results[milestone.code] = "skipped";
      continue;
    }

    // Skip milestones that need a human judge
    if (milestone.rules?.manualReview) {
      results[milestone.code] = "skipped";
      continue;
    }

    try {
      // Check diff rules (files changed / lines added)
      if (milestone.rules?.diff) {
        const { minFilesChanged = 0, minLinesAdded = 0 } = milestone.rules.diff;
        if (filesChanged.length < minFilesChanged) {
          throw new Error(`Need at least ${minFilesChanged} files changed`);
        }
        const totalAdditions = filesChanged.reduce((acc, f) => acc + f.additions, 0);
        if (totalAdditions < minLinesAdded) {
          throw new Error(`Need at least ${minLinesAdded} lines added`);
        }
      }

      const pathPrefixValidation = validateRequiredPathPrefixes(filesChanged, milestone.rules?.requiredPathPrefixes);
      if (!pathPrefixValidation.ok) {
        throw new Error(pathPrefixValidation.reason);
      }

      const messageValidation = validateCommitMessageKeywords(
        [commitMessage],
        milestone.rules?.commitMessageKeywords
      );
      if (!messageValidation.ok) {
        throw new Error(messageValidation.reason);
      }

      // Check required files exist and contain correct content
      for (const fileRule of milestone.rules?.files ?? []) {
        const fileRes = await fetchGitHubWithTokenFallback(
          `https://api.github.com/repos/${owner}/${repo}/contents/${fileRule.path}?ref=${headSha}`,
          headers
        );
        if (!fileRes.ok) throw new Error(`Missing file: ${fileRule.path}`);
        const fileData = await fileRes.json() as { type: string; content?: string };
        if (fileData.type !== "file" || !fileData.content) {
          throw new Error(`Invalid file: ${fileRule.path}`);
        }

        const content = Buffer.from(fileData.content, "base64").toString("utf-8");
        if (content.length < fileRule.minChars) {
          throw new Error(`File ${fileRule.path} too short (${content.length} < ${fileRule.minChars} chars)`);
        }
        if (fileRule.requiredKeywords?.length) {
          const lower = content.toLowerCase();
          for (const kw of fileRule.requiredKeywords) {
            if (!lower.includes(kw.toLowerCase())) {
              throw new Error(`File ${fileRule.path} missing keyword: ${kw}`);
            }
          }
        }
      }

      // ── All checks passed → award XP with time bonus ─────────────────────
      const xpResult = calculateXPWithTimeBonus(milestone.xp, now);
      const repoPolicy = resolveRepoPolicy(repoCreatedAt, commitAt);
      const xpToAward = Math.round(xpResult.totalXP * repoPolicy.finalMultiplier);
      const subId = nanoid(10);
      
      await submissions.insertOne({
        _id: subId,
        teamId: team._id,
        milestoneId: milestone._id,
        milestoneCode: milestone.code,
        createdAt: now,
        validatedAt: now,
        status: "verified",
        reason: null,
        github: { headSha, prUrl: null },
        xpAwarded: xpToAward,
        xpBreakdown: {
          baseXP: xpResult.baseXP,
          multiplier: xpResult.multiplier,
          bonusXP: xpResult.bonusXP,
          completionPercentage: xpResult.completionPercentage,
          timeMultiplier: xpResult.multiplier,
          repoMultiplier: repoPolicy.finalMultiplier,
          repoTier: repoPolicy.tier,
          policyReason: repoPolicy.reason,
        },
      });

      await teams.updateOne(
        { _id: team._id },
        {
          $inc: { xp: xpToAward, coins: milestone.coins },
          $set: { lastXpAt: now },
        }
      );

      console.log(`[check-team] ${team.name} earned ${xpToAward} XP for ${milestone.code} (time: ${xpResult.multiplier}x, repo: ${repoPolicy.finalMultiplier}x)`);

      results[milestone.code] = "verified";
      verifiedCodes.add(milestone.code);
    } catch {
      results[milestone.code] = "failed";
    }
  }

  // ── Step 6: Save the latest SHA so we don't re-process this commit ───────
  await teams.updateOne(
    { _id: team._id },
    { $set: { lastCheckedSha: headSha } }
  );

  // ── Step 7: Broadcast real-time update if anything was awarded ───────────
  const anyVerified = Object.values(results).some((r) => r === "verified");
  if (anyVerified) {
    serverCache.invalidate(CacheKeys.TEAM(team._id));
    serverCache.invalidate(CacheKeys.LEADERBOARD);
    broadcast("leaderboard-update", { teamId: team._id, teamName: team.name });
  }

  return { skipped: false, headSha, results };
}
