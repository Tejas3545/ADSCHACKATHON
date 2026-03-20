import { getCollections } from "@/lib/collections";
import { levelFromXp } from "@/lib/models";
import { serverCache, CacheKeys, CacheTTL } from "@/lib/cache";
import { ensureDefaultMilestones } from "@/lib/milestone-seed";
import { calculateCommitXpPenalty } from "@/lib/commit-warning";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDefaultMilestones();

  // Check cache first
  const cached = serverCache.get(CacheKeys.LEADERBOARD);
  if (cached) {
    return Response.json(cached, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        'X-Cache': 'HIT',
      },
    });
  }

  const { teams, submissions, milestones } = await getCollections();

  const [teamDocs, milestoneDocs] = await Promise.all([
    teams
      .find(
        { frozen: { $ne: true } },
        { projection: { _id: 1, name: 1, xp: 1, coins: 1, lastXpAt: 1, lastCommitAt: 1, commitCount: 1 } }
      )
      .limit(200)
      .toArray(),
    milestones
      .find({ active: true }, { projection: { _id: 1, code: 1, title: 1, xp: 1 } })
      .sort({ sortOrder: 1 })
      .toArray(),
  ]);

  const teamIds = teamDocs.map((t) => t._id);
  const verified = await submissions
    .find(
      { teamId: { $in: teamIds }, status: "verified" },
      { projection: { teamId: 1, milestoneCode: 1 } }
    )
    .toArray();

  const byTeam: Record<string, string[]> = {};
  for (const s of verified) {
    if (!byTeam[s.teamId]) byTeam[s.teamId] = [];
    if (!byTeam[s.teamId].includes(s.milestoneCode)) byTeam[s.teamId].push(s.milestoneCode);
  }

  const scoredTeams = teamDocs
    .map((team) => {
      const rawXP = team.xp;
      const commitCount = team.commitCount ?? 0;
      const penalty = calculateCommitXpPenalty(commitCount);
      const effectiveXP = penalty.effectiveXP(rawXP);

      return {
        ...team,
        rawXP,
        xpPenalty: penalty.penaltyXP,
        effectiveXP,
        commitCount,
      };
    })
    .sort((a, b) => {
      if (b.effectiveXP !== a.effectiveXP) return b.effectiveXP - a.effectiveXP;
      const bCommit = b.lastCommitAt ? +new Date(b.lastCommitAt) : 0;
      const aCommit = a.lastCommitAt ? +new Date(a.lastCommitAt) : 0;
      if (bCommit !== aCommit) return bCommit - aCommit;
      const bXpAt = b.lastXpAt ? +new Date(b.lastXpAt) : 0;
      const aXpAt = a.lastXpAt ? +new Date(a.lastXpAt) : 0;
      if (bXpAt !== aXpAt) return bXpAt - aXpAt;
      return a._id.localeCompare(b._id);
    });

  const rows = scoredTeams.map((t, idx) => ({
    rank: idx + 1,
    teamId: t._id,
    teamName: t.name,
    xp: t.effectiveXP,
    rawXp: t.rawXP,
    xpPenalty: t.xpPenalty,
    commitCount: t.commitCount,
    level: levelFromXp(t.effectiveXP),
    milestones: (byTeam[t._id] ?? []).sort(),
  }));

  const result = {
    generatedAt: new Date().toISOString(),
    milestones: milestoneDocs,
    rows,
  };

  // Cache the result
  serverCache.set(CacheKeys.LEADERBOARD, result, CacheTTL.LEADERBOARD);

  return Response.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
      'X-Cache': 'MISS',
    },
  });
}
