import { getCollections } from "@/lib/collections";
import { broadcast } from "@/lib/broadcaster";
import { classifyRepoTier } from "@/lib/repo-xp-policy";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  teamNumber: z.number().int().min(1).max(92),
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

async function fetchGitHubWithTokenFallback(url: string, headers: Record<string, string>): Promise<Response> {
  const response = await fetch(url, { headers });
  if (response.status !== 401 || !headers.Authorization) {
    return response;
  }

  const retryHeaders = { ...headers };
  delete retryHeaders.Authorization;
  return fetch(url, { headers: retryHeaders });
}

function extractLastPage(linkHeader: string | null): number | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/i);
  if (!match) return null;
  const page = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(page) && page > 0 ? page : null;
}

async function getOldestCommitDate(
  owner: string,
  repo: string,
  branch: string,
  headers: Record<string, string>
): Promise<Date | null> {
  const firstPageRes = await fetchGitHubWithTokenFallback(
    `https://api.github.com/repos/${owner}/${repo}/commits?sha=${branch}&per_page=1&page=1`,
    headers
  );

  if (!firstPageRes.ok) {
    return null;
  }

  const lastPage = extractLastPage(firstPageRes.headers.get("link"));
  if (!lastPage || lastPage <= 1) {
    const latest = (await firstPageRes.json().catch(() => [])) as Array<{ commit?: { committer?: { date?: string } } }>;
    const maybeDate = latest[0]?.commit?.committer?.date;
    return maybeDate ? new Date(maybeDate) : null;
  }

  const oldestRes = await fetchGitHubWithTokenFallback(
    `https://api.github.com/repos/${owner}/${repo}/commits?sha=${branch}&per_page=1&page=${lastPage}`,
    headers
  );

  if (!oldestRes.ok) {
    return null;
  }

  const oldest = (await oldestRes.json().catch(() => [])) as Array<{ commit?: { committer?: { date?: string } } }>;
  const maybeDate = oldest[0]?.commit?.committer?.date;
  return maybeDate ? new Date(maybeDate) : null;
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

    const branch = body.data.branch ?? "main";
    const githubHeaders: Record<string, string> = {
      "User-Agent": "ADSC-Hackathon-Leaderboard",
      Accept: "application/vnd.github.v3+json",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    };

    let repoCreatedAt: Date | null = null;
    let oldestCommitAt: Date | null = null;
    let repoTier: "fresh" | "mid" | "old" | null = null;

    // Verify GitHub Repo exists and is public.
    // We catch network/SSL errors separately — they should not block registration.
    try {
      const ghRes = await fetchGitHubWithTokenFallback(`https://api.github.com/repos/${owner}/${repo}`, githubHeaders);

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
          const data = (await ghRes.json().catch(() => ({} as { message?: string }))) as { message?: string };
          if (data.message?.includes("API rate limit")) {
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
        const repoData = await ghRes.json().catch(() => ({} as Record<string, unknown>));
        if ((repoData as { private?: boolean }).private === true) {
          return Response.json(
            { ok: false, error: "GitHub repository is private. Please make the repository public before registering." },
            { status: 400 }
          );
        }

        const createdAtRaw = (repoData as { created_at?: string }).created_at;
        if (createdAtRaw) {
          repoCreatedAt = new Date(createdAtRaw);
          repoTier = classifyRepoTier(repoCreatedAt);
        }

        oldestCommitAt = await getOldestCommitDate(owner, repo, branch, githubHeaders);
      }
    } catch {
      // Network or TLS error reaching GitHub — allow registration to proceed.
      // The repo will still be validated when milestones are submitted.
      console.warn("Could not reach GitHub API during registration (network/TLS issue). Skipping pre-check.");
    }

    const teamId = `TM${body.data.teamNumber.toString().padStart(3, "0")}`;
    const now = new Date();

    const doc = {
      _id: teamId,
      name: body.data.teamName,
      members: body.data.members.map((name) => ({ name })),
      repo: {
        url: body.data.repoUrl,
        owner,
        repo,
        branch,
      },
      createdAt: now,
      xp: 0,
      coins: 0,
      frozen: false,
      lastXpAt: null,
      lastCommitAt: null,
      commitCount: 0,
      repoCreatedAt,
      oldestCommitAt,
      repoTier,
    };

    try {
      await teams.insertOne(doc);
      broadcast("leaderboard-update", { teamId, teamName: body.data.teamName, newTeam: true });
    } catch (err: unknown) {
      const duplicateError = err as { code?: number; keyPattern?: Record<string, number> };
      if (duplicateError?.code === 11000 && duplicateError?.keyPattern?._id) {
        return Response.json(
          { ok: false, error: `Team ID ${teamId} is already taken. Please choose another team number.` },
          { status: 409 }
        );
      }

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
