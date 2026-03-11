import { getCollections } from "@/lib/collections";
import { assertAdmin } from "@/lib/admin";
import { DEFAULT_MILESTONES } from "@/lib/default-milestones";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!assertAdmin(req)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { teams, milestones, submissions } = await getCollections();

    // Delete all documents from each collection
    const [teamsResult, submissionsResult, milestonesResult] = await Promise.all([
      teams.deleteMany({}),
      submissions.deleteMany({}),
      milestones.deleteMany({}),
    ]);

    const seedResult = await milestones.insertMany(DEFAULT_MILESTONES);

    console.log("🗑️  Database reset complete");
    console.log(`   - Teams deleted: ${teamsResult.deletedCount}`);
    console.log(`   - Submissions deleted: ${submissionsResult.deletedCount}`);
    console.log(`   - Milestones deleted: ${milestonesResult.deletedCount}`);

    return Response.json({
      ok: true,
      deleted: {
        teams: teamsResult.deletedCount,
        submissions: submissionsResult.deletedCount,
        milestones: milestonesResult.deletedCount,
      },
      seededMilestones: seedResult.insertedCount,
      message: "Database reset successfully. Default milestones were recreated.",
    });
  } catch (error) {
    console.error("Error resetting database:", error);
    return Response.json(
      { ok: false, error: "Failed to reset database" },
      { status: 500 }
    );
  }
}
