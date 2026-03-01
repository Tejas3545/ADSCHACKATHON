import { getCollections } from "@/lib/collections";
import { assertAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    let isAdmin = false;
    try {
      isAdmin = assertAdmin(req);
    } catch (e) {
      return Response.json({ ok: false, error: "Server misconfiguration: ADMIN_PASSWORD not set" }, { status: 500 });
    }

    if (!isAdmin) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { teams, milestones, submissions } = await getCollections();

    const [allTeams, allMilestones, allSubmissions] = await Promise.all([
      teams.find().sort({ xp: -1 }).toArray(),
      milestones.find().sort({ sortOrder: 1 }).toArray(),
      submissions.find().sort({ createdAt: -1 }).limit(500).toArray(),
    ]);

    return Response.json({
      ok: true,
      teams: allTeams,
      milestones: allMilestones,
      submissions: allSubmissions,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin/dashboard] Error:", err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
