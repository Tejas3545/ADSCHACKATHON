import { getCollections } from "@/lib/collections";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  teamName: z.string().min(2).max(80),
  repoUrl: z.string().url().optional(),
});

function parseGitHubRepo(url: string) {
  const u = new URL(url);
  const parts = u.pathname.split("/").filter(Boolean);
  if (u.hostname !== "github.com" || parts.length < 2) {
    throw new Error("Repo URL must be a github.com/<owner>/<repo> URL");
  }

  return {
    owner: parts[0],
    repo: parts[1].replace(/\.git$/, ""),
  };
}

export async function POST(req: Request) {
  let json: unknown = null;
  try {
    json = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { teams } = await getCollections();
  const { teamName, repoUrl } = parsed.data;

  const nameRegex = new RegExp(`^${teamName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

  const query: Record<string, unknown> = {
    name: nameRegex,
  };

  if (repoUrl) {
    try {
      const { owner, repo } = parseGitHubRepo(repoUrl);
      query["repo.owner"] = owner;
      query["repo.repo"] = repo;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid repo URL";
      return Response.json({ ok: false, error: message }, { status: 400 });
    }
  }

  const team = await teams.findOne(query, { projection: { _id: 1, name: 1, repo: 1 } });
  if (!team) {
    return Response.json(
      { ok: false, error: "No matching team found. Try exact team name and repository URL." },
      { status: 404 }
    );
  }

  return Response.json({
    ok: true,
    teamId: team._id,
    teamName: team.name,
    dashboardUrl: `/team/${team._id}`,
  });
}
