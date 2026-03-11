import { getCollections } from "@/lib/collections";
import { checkTeam } from "@/lib/check-team";
import { serverCache, CacheKeys } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const { teams } = await getCollections();

  const team = await teams.findOne({ _id: teamId, frozen: { $ne: true } });
  if (!team) {
    return Response.json({ ok: false, error: "Team not found or frozen" }, { status: 404 });
  }

  const result = await checkTeam(team);

  serverCache.invalidate(CacheKeys.TEAM(teamId));
  serverCache.invalidate(CacheKeys.LEADERBOARD);

  return Response.json({ ok: true, result });
}
