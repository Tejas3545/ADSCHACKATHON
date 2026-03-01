import { ensureIndexes } from "@/lib/collections";

export const dynamic = "force-dynamic";

export async function POST() {
  await ensureIndexes();
  return Response.json({ ok: true });
}
