import { getCollections } from "@/lib/collections";
import { assertAdmin } from "@/lib/admin";
import { broadcast } from "@/lib/broadcaster";
import { calculateXPWithTimeBonus } from "@/lib/xp-calculator";
import { setLeaderboardRunning } from "@/lib/leaderboard-state";
import { resolveRepoPolicy } from "@/lib/repo-xp-policy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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

    const body = await req.json().catch(() => ({}));
    const { action, payload } = body;
    const { teams, submissions } = await getCollections();

    if (action === "freezeTeam") {
      await teams.updateOne({ _id: payload.teamId }, { $set: { frozen: true } });
    } else if (action === "unfreezeTeam") {
      await teams.updateOne({ _id: payload.teamId }, { $set: { frozen: false } });
    } else if (action === "adjustXp") {
      await teams.updateOne(
        { _id: payload.teamId },
        { $inc: { xp: payload.amount, coins: payload.coins || 0 } }
      );
    } else if (action === "updateSubmission") {
      await submissions.updateOne(
        { _id: payload.submissionId },
        { $set: { status: payload.status, reason: payload.reason || null } }
      );

      if (payload.status === "verified" && payload.teamId && payload.xp) {
        // Get submission to check creation time for time-based bonus
        const submission = await submissions.findOne({ _id: payload.submissionId });
        const team = await teams.findOne({ _id: payload.teamId });
        const completionTime = submission?.createdAt || new Date();
        const repoCreatedAt = team?.repoCreatedAt ?? team?.createdAt ?? new Date();
        
        // Calculate XP with time-based bonus
        const xpCalculation = calculateXPWithTimeBonus(payload.xp, completionTime);
        const repoPolicy = resolveRepoPolicy(repoCreatedAt, completionTime);
        const xpToAward = Math.round(xpCalculation.totalXP * repoPolicy.finalMultiplier);
        
        await teams.updateOne(
          { _id: payload.teamId },
          {
            $inc: { xp: xpToAward, coins: payload.coins || 0 },
            $set: { lastXpAt: new Date() },
          }
        );
        broadcast("leaderboard-update", { teamId: payload.teamId, teamName: "" });
      }
    } else if (action === "startLeaderboard") {
      const state = await setLeaderboardRunning(true);
      broadcast("leaderboard-update", { teamId: "system", teamName: "", state });
    } else if (action === "endLeaderboard") {
      const state = await setLeaderboardRunning(false);
      broadcast("leaderboard-update", { teamId: "system", teamName: "", state });
    } else {
      return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[admin/action] Error:", err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

