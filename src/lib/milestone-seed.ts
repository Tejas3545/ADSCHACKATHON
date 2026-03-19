import { getCollections } from "@/lib/collections";
import { DEFAULT_MILESTONES } from "@/lib/default-milestones";

export async function ensureDefaultMilestones(): Promise<void> {
  const { milestones } = await getCollections();
  for (const milestone of DEFAULT_MILESTONES) {
    const { _id, ...rest } = milestone;
    await milestones.updateOne(
      { code: milestone.code },
      {
        $set: { ...rest, active: true },
        $setOnInsert: { _id },
      },
      { upsert: true }
    );
  }
}
