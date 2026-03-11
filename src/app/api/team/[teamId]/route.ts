import { getCollections } from "@/lib/collections";
import { levelFromXp } from "@/lib/models";
import { serverCache, CacheKeys, CacheTTL } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  
  // Check cache first
  const cacheKey = CacheKeys.TEAM(teamId);
  const cached = serverCache.get(cacheKey);
  if (cached) {
    return Response.json(cached, {
      headers: {
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        'X-Cache': 'HIT',
      },
    });
  }

  const { teams, submissions, milestones } = await getCollections();

  const team = await teams.findOne({ _id: teamId });
  if (!team) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

  const [ms, subs] = await Promise.all([
    milestones.find({ active: true }).sort({ sortOrder: 1 }).toArray(),
    submissions
      .find({ teamId })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray(),
  ]);

  const result = {
    ok: true,
    team: {
      teamId: team._id,
      name: team.name,
      members: team.members,
      repo: team.repo,
      xp: team.xp,
      coins: team.coins,
      level: levelFromXp(team.xp),
      frozen: team.frozen,
    },
    milestones: ms.map((m) => ({
      milestoneId: m._id,
      code: m.code,
      title: m.title,
      xp: m.xp,
      coins: m.coins,
    })),
    submissions: subs,
  };

  // Cache the result
  serverCache.set(cacheKey, result, CacheTTL.TEAM);

  return Response.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
      'X-Cache': 'MISS',
    },
  });
}
