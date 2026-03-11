import { getCollections } from "@/lib/collections";
import { broadcast } from "@/lib/broadcaster";
import { serverCache, CacheKeys } from "@/lib/cache";
import { nanoid } from "nanoid";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Verify HMAC signature from GitHub to ensure the request is authentic
function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  // If a webhook secret is configured, validate the signature
  if (webhookSecret) {
    const sig = req.headers.get("x-hub-signature-256");
    if (!verifySignature(rawBody, sig, webhookSecret)) {
      return Response.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }
  }

  const event = req.headers.get("x-github-event");
  if (event !== "push") {
    return Response.json({ ok: true, skipped: true, reason: "Not a push event" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  type GhRepo = { name?: string; owner?: { name?: string; login?: string } };
  const repository = payload.repository as GhRepo | undefined;

  const pushedRepo = repository?.name;
  const pushedOwner = repository?.owner?.name || repository?.owner?.login;
  const pushedBranch = (payload.ref as string | undefined)?.replace("refs/heads/", "");

  if (!pushedRepo || !pushedOwner || !pushedBranch) {
    return Response.json({ ok: false, error: "Missing repo/owner/branch in payload" }, { status: 400 });
  }

  const headSha = payload.after as string;

  const { teams, milestones, submissions } = await getCollections();

  // Find the team that owns this repo + branch
  const team = await teams.findOne({
    "repo.owner": pushedOwner,
    "repo.repo": pushedRepo,
    "repo.branch": pushedBranch,
    frozen: { $ne: true },
  });

  if (!team) {
    // No registered team — but still acknowledge
    return Response.json({ ok: true, skipped: true, reason: "No matching active team" });
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "ADSC-Leaderboard",
  };
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`;

  // Get the commit details to check files changed
  const commitRes = await fetch(
    `https://api.github.com/repos/${pushedOwner}/${pushedRepo}/commits/${headSha}`,
    { headers }
  );
  const commitData = commitRes.ok ? await commitRes.json() : { files: [] };
  const filesChanged: { additions: number; filename: string }[] = (commitData.files as { additions: number; filename: string }[]) || [];

  // Get all active milestones that are not yet verified for this team
  const activeMilestones = await milestones.find({ active: true }).toArray();
  const verifiedSubs = await submissions
    .find({ teamId: team._id, status: "verified" })
    .toArray();
  const verifiedCodes = new Set(verifiedSubs.map((s) => s.milestoneCode));

  const results: Record<string, "verified" | "skipped" | "failed"> = {};
  const now = new Date();

  for (const milestone of activeMilestones) {
    if (verifiedCodes.has(milestone.code)) {
      results[milestone.code] = "skipped";
      continue;
    }

    // Skip milestones that require manual review — admins handle those
    if (milestone.rules?.manualReview) {
      results[milestone.code] = "skipped";
      continue;
    }

    try {
      // Check diff rules
      if (milestone.rules?.diff) {
        const { minFilesChanged = 0, minLinesAdded = 0 } = milestone.rules.diff;
        if (filesChanged.length < minFilesChanged) {
          throw new Error(`Need at least ${minFilesChanged} files changed`);
        }
        const totalAdditions = filesChanged.reduce((acc: number, f) => acc + f.additions, 0);
        if (totalAdditions < minLinesAdded) {
          throw new Error(`Need at least ${minLinesAdded} lines added`);
        }
      }

      // Check required files
      for (const fileRule of milestone.rules?.files ?? []) {
        const fileRes = await fetch(
          `https://api.github.com/repos/${pushedOwner}/${pushedRepo}/contents/${fileRule.path}?ref=${headSha}`,
          { headers }
        );
        if (!fileRes.ok) throw new Error(`Missing file: ${fileRule.path}`);
        const fileData = await fileRes.json();
        if (fileData.type !== "file" || !fileData.content) throw new Error(`Invalid file: ${fileRule.path}`);

        const content = Buffer.from(fileData.content, "base64").toString("utf-8");
        if (content.length < fileRule.minChars) {
          throw new Error(`File ${fileRule.path} too short`);
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

      // All checks passed — mark verified
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
      });

      await teams.updateOne(
        { _id: team._id },
        {
          $inc: { xp: milestone.xp, coins: milestone.coins },
          $set: { lastXpAt: now },
        }
      );

      results[milestone.code] = "verified";
      verifiedCodes.add(milestone.code);
    } catch {
      results[milestone.code] = "failed";
    }
  }

  // Broadcast real-time update to all connected browser clients
  serverCache.invalidate(CacheKeys.TEAM(team._id));
  serverCache.invalidate(CacheKeys.LEADERBOARD);
  broadcast("leaderboard-update", { teamId: team._id, teamName: team.name });

  return Response.json({ ok: true, teamId: team._id, results });
}
