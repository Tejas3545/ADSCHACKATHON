import { getCollections } from "@/lib/collections";
import { broadcast } from "@/lib/broadcaster";
import { nanoid } from "nanoid";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  teamName: z.string().min(2).max(80),
  members: z.array(z.string().min(1).max(80)).min(1).max(4),
  repoUrl: z.string().url(),
  branch: z.string().min(1).optional(),
});

function parseGitHubRepo(url: string) {
  const u = new URL(url);
  const parts = u.pathname.split("/").filter(Boolean);
  if (u.hostname !== "github.com" || parts.length < 2) {
    throw new Error("Repo URL must be a github.com/<owner>/<repo> URL");
  }
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, "");
  return { owner, repo };
}

export async function POST(req: Request) {
  try {
    let json: unknown = null;
    try { json = await req.json(); } catch { /* empty body */ }
    const body = BodySchema.safeParse(json);
    if (!body.success) {
      const firstError = body.error.issues[0];
      return Response.json({ ok: false, error: firstError?.message ?? "Invalid input data" }, { status: 400 });
    }

    const { teams } = await getCollections();

    const { owner, repo } = parseGitHubRepo(body.data.repoUrl);

    // Verify GitHub Repo exists and is public.
    // We catch network/SSL errors separately — they should not block registration.
    try {
      const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          "User-Agent": "ADSC-Hackathon-Leaderboard",
          Accept: "application/vnd.github.v3+json",
          ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
        },
      });

      if (ghRes.status === 404) {
        return Response.json(
          { ok: false, error: "GitHub repository not found. Please check the URL and make sure the repository exists." },
          { status: 400 }
        );
      }

      if (ghRes.status === 403) {
        // Check if it's rate limiting
        const remainingHeader = ghRes.headers.get("x-ratelimit-remaining");
        if (remainingHeader === "0") {
          console.warn("GitHub API rate limit reached during registration");
          // Allow registration to proceed - will be validated later
        } else {
          // Actually a private repo or access issue
          const data = await ghRes.json().catch(() => ({}));
          if ((data as any).message?.includes("API rate limit")) {
            console.warn("GitHub API rate limit reached");
            // Allow registration - skip validation
          } else {
            return Response.json(
              { ok: false, error: "GitHub repository is private or inaccessible. Please make the repository public before registering." },
              { status: 400 }
            );
          }
        }
      }

      if (ghRes.status === 401) {
        console.warn("GitHub API authentication issue during registration");
        // Don't block registration - allow it to proceed
      }

      // Check if the repo data indicates it's private
      if (ghRes.ok) {
        const repoData = await ghRes.json().catch(() => ({}));
        if ((repoData as any).private === true) {
          return Response.json(
            { ok: false, error: "GitHub repository is private. Please make the repository public before registering." },
            { status: 400 }
          );
        }
      }
    } catch {
      // Network or TLS error reaching GitHub — allow registration to proceed.
      // The repo will still be validated when milestones are submitted.
      console.warn("Could not reach GitHub API during registration (network/TLS issue). Skipping pre-check.");
    }

    const teamId = nanoid(10);
    const now = new Date();

    const doc = {
      _id: teamId,
      name: body.data.teamName,
      members: body.data.members.map((name) => ({ name })),
      repo: {
        url: body.data.repoUrl,
        owner,
        repo,
        branch: body.data.branch ?? "main",
      },
      createdAt: now,
      xp: 0,
      coins: 0,
      frozen: false,
      lastXpAt: null,
    };

    try {
      await teams.insertOne(doc);
      broadcast("leaderboard-update", { teamId, teamName: body.data.teamName, newTeam: true });
    } catch {
      return Response.json(
        { ok: false, error: "Team name already exists" },
        { status: 409 }
      );
    }

    return Response.json({ ok: true, teamId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("[register] Unhandled error:", err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
