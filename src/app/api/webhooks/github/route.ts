import { getCollections } from "@/lib/collections";
import { checkTeam } from "@/lib/check-team";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (webhookSecret) {
    const sig = req.headers.get("x-hub-signature-256");
    if (!verifySignature(rawBody, sig, webhookSecret)) {
      return Response.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }
  }

  const event = req.headers.get("x-github-event");
  if (event !== "push") {
    return Response.json({ ok: true, skipped: true, reason: "Not a push event" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  type GhRepo = { name?: string; owner?: { name?: string; login?: string } };
  const repository = payload.repository as GhRepo | undefined;

  const pushedRepo = repository?.name;
  const pushedOwner = repository?.owner?.name || repository?.owner?.login;
  const pushedBranch = (payload.ref as string | undefined)?.replace("refs/heads/", "");

  if (!pushedRepo || !pushedOwner || !pushedBranch) {
    return Response.json({ ok: false, error: "Missing repo/owner/branch in payload" }, { status: 400 });
  }

  const { teams } = await getCollections();
  const team = await teams.findOne({
    "repo.owner": pushedOwner,
    "repo.repo": pushedRepo,
    "repo.branch": pushedBranch,
    frozen: { $ne: true },
  });

  if (!team) {
    return Response.json({ ok: true, skipped: true, reason: "No matching active team" });
  }

  const result = await checkTeam(team);
  return Response.json({ ok: true, teamId: team._id, result });
}
