import { getCollections } from "@/lib/collections";
import { DEFAULT_MILESTONES } from "@/lib/default-milestones";

export async function ensureDefaultMilestones(): Promise<void> {
  const { milestones } = await getCollections();
  const activeCount = await milestones.countDocuments({ active: true });
  if (activeCount > 0) return;

  try {
    await milestones.insertMany(DEFAULT_MILESTONES, { ordered: false });
  } catch {
    // ignore duplicate errors when multiple requests seed simultaneously
  }
}
