import { getCollections } from "@/lib/collections";
import { assertAdmin } from "@/lib/admin";
import { getLeaderboardState } from "@/lib/leaderboard-state";
import { buildGitHubHeaders, fetchGitHubWithTokenFallback } from "@/lib/github-utils";

export const dynamic = "force-dynamic";

type GitHubCommit = {
  sha: string;
  html_url?: string;
  author?: { login?: string };
  commit?: {
    message?: string;
    committer?: { name?: string; date?: string };
  };
};

type TeamCommitSnapshot = {
  teamId: string;
  teamName: string;
  commitCount: number;
  lastCommitAt: string | null;
  lastCommitSha: string | null;
  commits: Array<{
    sha: string;
    message: string;
    url: string | null;
    date: string;
    author: string;
  }>;
};

function hasNextPage(linkHeader: string | null): boolean {
  if (!linkHeader) return false;
  return /rel="next"/i.test(linkHeader);
}

async function fetchTeamCommits(
  owner: string,
  repo: string,
  branch: string,
  sinceIso: string | null,
  headers: Record<string, string>
): Promise<GitHubCommit[]> {
  const collected: GitHubCommit[] = [];
  let page = 1;
  const maxPages = 10;

  while (page <= maxPages) {
    const baseUrl = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=100&page=${page}`;
    const url = sinceIso ? `${baseUrl}&since=${encodeURIComponent(sinceIso)}` : baseUrl;

    const response = await fetchGitHubWithTokenFallback(url, headers);
    if (!response.ok) {
      break;
    }

    const data = (await response.json().catch(() => [])) as GitHubCommit[];
    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    collected.push(...data);

    if (data.length < 100 || !hasNextPage(response.headers.get("link"))) {
      break;
    }

    page += 1;
  }

  return collected;
}

function toTeamCommitSnapshot(
  team: {
    _id: string;
    name: string;
    repo?: { owner?: string; repo?: string; branch?: string };
    lastCommitAt?: Date | null;
    commitCount?: number;
  },
  commits: GitHubCommit[]
): TeamCommitSnapshot {
  const sorted = commits
    .map((commit) => {
      const date = commit.commit?.committer?.date;
      return {
        sha: commit.sha,
        message: (commit.commit?.message ?? "").split("\n")[0] || "No message",
        url: commit.html_url ?? null,
        date: date ?? new Date(0).toISOString(),
        author: commit.author?.login ?? commit.commit?.committer?.name ?? "unknown",
      };
    })
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));

  const top = sorted.slice(0, 5);
  const latest = sorted[0];

  return {
    teamId: team._id,
    teamName: team.name,
    commitCount: sorted.length,
    lastCommitAt: latest?.date ?? (team.lastCommitAt ? team.lastCommitAt.toISOString() : null),
    lastCommitSha: latest?.sha ?? null,
    commits: top,
  };
}

export async function GET(req: Request) {
  try {
    let isAdmin = false;
    try {
      isAdmin = assertAdmin(req);
    } catch {
      return Response.json({ ok: false, error: "Server misconfiguration: ADMIN_PASSWORD not set" }, { status: 500 });
    }

    if (!isAdmin) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { teams, milestones, submissions } = await getCollections();

    const [allTeamsRaw, allMilestones, allSubmissions, leaderboardState] = await Promise.all([
      teams.find().sort({ xp: -1, lastCommitAt: -1, lastXpAt: -1, _id: 1 }).toArray(),
      milestones.find().sort({ sortOrder: 1 }).toArray(),
      submissions.find().sort({ createdAt: -1 }).limit(500).toArray(),
      getLeaderboardState(),
    ]);

    const headers = buildGitHubHeaders();
    const sinceIso = leaderboardState.startedAt ? leaderboardState.startedAt.toISOString() : null;

    const commitSnapshots = await Promise.all(
      allTeamsRaw.map(async (team) => {
        const owner = team.repo?.owner;
        const repo = team.repo?.repo;
        const branch = team.repo?.branch ?? "main";

        if (!owner || !repo) {
          return toTeamCommitSnapshot(team, []);
        }

        const commits = await fetchTeamCommits(owner, repo, branch, sinceIso, headers);
        return toTeamCommitSnapshot(team, commits);
      })
    );

    const commitByTeam = new Map(commitSnapshots.map((snapshot) => [snapshot.teamId, snapshot]));

    const recentCommits = commitSnapshots
      .flatMap((snapshot) =>
        snapshot.commits.map((commit) => ({
          teamId: snapshot.teamId,
          teamName: snapshot.teamName,
          sha: commit.sha,
          message: commit.message,
          url: commit.url,
          date: commit.date,
          author: commit.author,
        }))
      )
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .slice(0, 100);

    const allTeams = allTeamsRaw.map((team) => ({
      ...team,
      commitCount: commitByTeam.get(team._id)?.commitCount ?? team.commitCount ?? 0,
      lastCommitAt: commitByTeam.get(team._id)?.lastCommitAt ?? (team.lastCommitAt ? team.lastCommitAt.toISOString() : null),
      lastCommitSha: commitByTeam.get(team._id)?.lastCommitSha ?? null,
    }));

    return Response.json({
      ok: true,
      teams: allTeams,
      milestones: allMilestones,
      submissions: allSubmissions,
      leaderboardState,
      recentCommits,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin/dashboard] Error:", err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
