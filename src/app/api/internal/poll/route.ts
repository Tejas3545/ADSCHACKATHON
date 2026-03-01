/**
 * GET /api/internal/poll
 *
 * Called every 2 minutes by Vercel Cron (configured in vercel.json).
 * Loops through every active team, fetches their latest GitHub commit,
 * and automatically awards milestone XP — no webhook setup needed on
 * any team's repo.
 *
 * Security: requests must include  Authorization: Bearer <CRON_SECRET>
 * Vercel injects this header automatically when CRON_SECRET is set.
 */

import { getCollections } from "@/lib/collections";
import { checkTeam } from "@/lib/check-team";

export const dynamic = "force-dynamic";

// Allow up to 60 seconds on Vercel Hobby / 300 s on Pro
export const maxDuration = 60;

export async function GET(req: Request) {
  // ── Auth: only allow Vercel Cron or manual calls with the secret ─────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const { teams } = await getCollections();

  // Get all non-frozen teams
  const allTeams = await teams.find({ frozen: { $ne: true } }).toArray();

  if (allTeams.length === 0) {
    return Response.json({ ok: true, checked: 0, message: "No active teams" });
  }

  const results: Record<string, unknown> = {};
  let newAwards = 0;

  for (const team of allTeams) {
    try {
      const result = await checkTeam(team);
      results[team._id] = result;

      if (!result.skipped) {
        const awarded = Object.values(result.results).filter((r) => r === "verified").length;
        newAwards += awarded;
      }
    } catch (err) {
      results[team._id] = { error: String(err) };
    }
  }

  console.log(`[poll] Checked ${allTeams.length} teams, awarded ${newAwards} new milestone(s)`);

  return Response.json({
    ok: true,
    checked: allTeams.length,
    newAwards,
    results,
  });
}
