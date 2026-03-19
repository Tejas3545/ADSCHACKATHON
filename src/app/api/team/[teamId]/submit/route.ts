import { getCollections } from "@/lib/collections";
import { broadcast } from "@/lib/broadcaster";
import { calculateXPWithTimeBonus, getTimeBonusDescription } from "@/lib/xp-calculator";
import { serverCache, CacheKeys } from "@/lib/cache";
import { ensureDefaultMilestones } from "@/lib/milestone-seed";
import { assertLeaderboardRunning } from "@/lib/leaderboard-state";
import { resolveRepoPolicy, classifyRepoTier } from "@/lib/repo-xp-policy";
import { validateCommitMessageKeywords, validateRequiredPathPrefixes } from "@/lib/milestone-validation";
import { buildGitHubHeaders, fetchGitHubWithTokenFallback } from "@/lib/github-utils";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const runningState = await assertLeaderboardRunning();
  if (!runningState.ok) {
    return Response.json({ ok: false, error: runningState.reason }, { status: 409 });
  }

  await ensureDefaultMilestones();
  const json = await req.json().catch(() => null);
  const milestoneCode = json?.milestoneCode;

  if (!milestoneCode) {
    return Response.json({ ok: false, error: "Missing milestoneCode" }, { status: 400 });
  }

  const { teams, milestones, submissions } = await getCollections();

  const team = await teams.findOne({ _id: teamId });
  if (!team) return Response.json({ ok: false, error: "Team not found" }, { status: 404 });
  if (team.frozen) return Response.json({ ok: false, error: "Team is frozen" }, { status: 403 });

  const milestone = await milestones.findOne({ code: milestoneCode, active: true });
  if (!milestone) return Response.json({ ok: false, error: "Milestone not found or inactive" }, { status: 404 });

  const existingSub = await submissions.findOne({ teamId, milestoneId: milestone._id, status: "verified" });
  if (existingSub) return Response.json({ ok: false, error: "Milestone already verified" }, { status: 400 });

  // Fetch from GitHub
  const { owner, repo, branch } = team.repo;
  const headers = buildGitHubHeaders();

  try {
    // 1. Verify Repo Exists and is Accessible
    const repoRes = await fetchGitHubWithTokenFallback(`https://api.github.com/repos/${owner}/${repo}`, headers);
    if (!repoRes.ok) {
      throw new Error(`Repository not found or is private. Please ensure the repository is public.`);
    }
    const repoData = (await repoRes.json().catch(() => ({} as { created_at?: string }))) as { created_at?: string };
    const repoCreatedAt = team.repoCreatedAt ?? (repoData.created_at ? new Date(repoData.created_at) : null);
    if (!repoCreatedAt) {
      throw new Error("Could not determine repository creation date");
    }
    if (!team.repoCreatedAt) {
      await teams.updateOne(
        { _id: teamId },
        {
          $set: {
            repoCreatedAt,
            repoTier: classifyRepoTier(repoCreatedAt),
          },
        }
      );
    }

    // 2. Get latest commit on branch
    const branchRes = await fetchGitHubWithTokenFallback(`https://api.github.com/repos/${owner}/${repo}/branches/${branch}`, headers);
    if (!branchRes.ok) throw new Error(`Failed to fetch branch '${branch}': ${branchRes.statusText}`);
    const branchData = await branchRes.json();
    const headSha = branchData.commit.sha;

    // 3. Get commit details to check diff
    const commitRes = await fetchGitHubWithTokenFallback(`https://api.github.com/repos/${owner}/${repo}/commits/${headSha}`, headers);
    if (!commitRes.ok) throw new Error(`Failed to fetch commit: ${commitRes.statusText}`);
    const commitData = (await commitRes.json()) as {
      files?: Array<{ additions: number; filename: string }>;
      commit?: {
        message?: string;
        committer?: { date?: string };
      };
    };

    const filesChanged = commitData.files || [];
    const commitMessage = (commitData.commit?.message as string | undefined) ?? "";
    const commitAt = commitData.commit?.committer?.date
      ? new Date(commitData.commit.committer.date)
      : new Date();
    
    // Check diff rules
    if (milestone.rules.diff) {
      const { minFilesChanged = 0, minLinesAdded = 0 } = milestone.rules.diff;
      if (filesChanged.length < minFilesChanged) {
        throw new Error(`Commit must change at least ${minFilesChanged} files`);
      }
      const totalAdditions = filesChanged.reduce((acc, file) => acc + file.additions, 0);
      if (totalAdditions < minLinesAdded) {
        throw new Error(`Commit must add at least ${minLinesAdded} lines`);
      }
    }

    const pathPrefixValidation = validateRequiredPathPrefixes(filesChanged, milestone.rules.requiredPathPrefixes);
    if (!pathPrefixValidation.ok) {
      throw new Error(pathPrefixValidation.reason);
    }

    const messageValidation = validateCommitMessageKeywords(
      [commitMessage],
      milestone.rules.commitMessageKeywords
    );
    if (!messageValidation.ok) {
      throw new Error(messageValidation.reason);
    }

    // 4. Check file rules
    for (const fileRule of milestone.rules.files) {
      const fileRes = await fetchGitHubWithTokenFallback(`https://api.github.com/repos/${owner}/${repo}/contents/${fileRule.path}?ref=${headSha}`, headers);
      if (!fileRes.ok) throw new Error(`Required file ${fileRule.path} not found in repository`);
      
      const fileData = await fileRes.json();
      if (fileData.type !== "file" || !fileData.content) {
        throw new Error(`Path ${fileRule.path} is not a valid file`);
      }

      const content = Buffer.from(fileData.content, "base64").toString("utf-8");
      
      if (content.length < fileRule.minChars) {
        throw new Error(`File ${fileRule.path} must contain at least ${fileRule.minChars} characters`);
      }

      if (fileRule.requiredKeywords && fileRule.requiredKeywords.length > 0) {
        const lowerContent = content.toLowerCase();
        for (const kw of fileRule.requiredKeywords) {
          if (!lowerContent.includes(kw.toLowerCase())) {
            throw new Error(`File ${fileRule.path} is missing required keyword: ${kw}`);
          }
        }
      }
    }

    // Validation passed!
    const now = new Date();
    const subId = nanoid(10);
    
    // If the milestone requires manual review, set status to pending
    const requiresManualReview = milestone.rules.manualReview === true;
    const status = requiresManualReview ? "pending" : "verified";
    
    await submissions.insertOne({
      _id: subId,
      teamId,
      milestoneId: milestone._id,
      milestoneCode: milestone.code,
      createdAt: now,
      validatedAt: now,
      status: status,
      reason: null,
      github: {
        headSha,
        prUrl: null,
      }
    });

    if (status === "verified") {
      // Calculate XP with time-based bonus
      const xpCalculation = calculateXPWithTimeBonus(milestone.xp, now);
      const repoPolicy = resolveRepoPolicy(repoCreatedAt, commitAt);
      const xpToAward = Math.round(xpCalculation.totalXP * repoPolicy.finalMultiplier);
      const policyMessage = `Repository policy: ${repoPolicy.reason} (${repoPolicy.finalMultiplier}x)`;
      
      // Award XP and Coins immediately
      await teams.updateOne(
        { _id: teamId },
        { 
          $inc: { xp: xpToAward, coins: milestone.coins },
          $set: { lastXpAt: now }
        }
      );
      
      // Invalidate caches for this team and leaderboard
      serverCache.invalidate(CacheKeys.TEAM(teamId));
      serverCache.invalidate(CacheKeys.LEADERBOARD);
      
      broadcast("leaderboard-update", { teamId, teamName: team.name });
      
      return Response.json({ 
        ok: true, 
        status: "verified", 
        xpAwarded: xpToAward,
        baseXP: milestone.xp,
        bonusXP: xpCalculation.bonusXP,
        multiplier: xpCalculation.multiplier,
        bonusMessage: `${getTimeBonusDescription(xpCalculation)}\n${policyMessage}`,
        repoMultiplier: repoPolicy.finalMultiplier,
        repoTier: repoPolicy.tier,
        coinsAwarded: milestone.coins 
      });
    } else {
      return Response.json({ ok: true, status: "pending", xpAwarded: 0, coinsAwarded: 0 });
    }

  } catch (err: unknown) {
    // Validation failed
    const now = new Date();
    const subId = nanoid(10);
    const reason = err instanceof Error ? err.message : "Unknown validation error";
    
    await submissions.insertOne({
      _id: subId,
      teamId,
      milestoneId: milestone._id,
      milestoneCode: milestone.code,
      createdAt: now,
      validatedAt: now,
      status: "rejected",
      reason,
      github: {
        headSha: null,
        prUrl: null,
      }
    });

    return Response.json({ ok: false, status: "rejected", reason }, { status: 400 });
  }
}
