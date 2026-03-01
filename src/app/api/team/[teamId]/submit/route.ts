import { getCollections } from "@/lib/collections";
import { broadcast } from "@/lib/broadcaster";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
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
  const githubToken = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "ADSC-Leaderboard",
  };
  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  try {
    // 1. Verify Repo Exists and is Accessible
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!repoRes.ok) {
      throw new Error(`Repository not found or is private. Please ensure the repository is public.`);
    }

    // 2. Get latest commit on branch
    const branchRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${branch}`, { headers });
    if (!branchRes.ok) throw new Error(`Failed to fetch branch '${branch}': ${branchRes.statusText}`);
    const branchData = await branchRes.json();
    const headSha = branchData.commit.sha;

    // 3. Get commit details to check diff
    const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${headSha}`, { headers });
    if (!commitRes.ok) throw new Error(`Failed to fetch commit: ${commitRes.statusText}`);
    const commitData = await commitRes.json();

    const filesChanged = commitData.files || [];
    
    // Check diff rules
    if (milestone.rules.diff) {
      const { minFilesChanged = 0, minLinesAdded = 0 } = milestone.rules.diff;
      if (filesChanged.length < minFilesChanged) {
        throw new Error(`Commit must change at least ${minFilesChanged} files`);
      }
      const totalAdditions = filesChanged.reduce((acc: number, f: any) => acc + f.additions, 0);
      if (totalAdditions < minLinesAdded) {
        throw new Error(`Commit must add at least ${minLinesAdded} lines`);
      }
    }

    // 4. Check file rules
    for (const fileRule of milestone.rules.files) {
      const fileRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${fileRule.path}?ref=${headSha}`, { headers });
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
      // Award XP and Coins immediately
      await teams.updateOne(
        { _id: teamId },
        { 
          $inc: { xp: milestone.xp, coins: milestone.coins },
          $set: { lastXpAt: now }
        }
      );
      broadcast("leaderboard-update", { teamId, teamName: team.name });
      return Response.json({ ok: true, status: "verified", xpAwarded: milestone.xp, coinsAwarded: milestone.coins });
    } else {
      return Response.json({ ok: true, status: "pending", xpAwarded: 0, coinsAwarded: 0 });
    }

  } catch (err: any) {
    // Validation failed
    const now = new Date();
    const subId = nanoid(10);
    const reason = err.message || "Unknown validation error";
    
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
