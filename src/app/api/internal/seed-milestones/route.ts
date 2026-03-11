import { getCollections } from "@/lib/collections";
import { assertAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!assertAdmin(req)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { milestones } = await getCollections();

  const docs = [
    {
      _id: "m1",
      code: "M1",
      title: "Project Setup & Planning",
      xp: 100,
      coins: 30,
      sortOrder: 1,
      active: true,
      rules: {
        files: [
          {
            path: "milestones/M1.md",
            minChars: 500,
            requiredKeywords: ["problem", "solution", "features", "target"],
          },
          {
            path: "README.md",
            minChars: 200,
            requiredKeywords: ["project", "description"],
          },
        ],
        diff: { minFilesChanged: 3, minLinesAdded: 50 },
      },
    },
    {
      _id: "m2",
      code: "M2",
      title: "Core Feature Implementation",
      xp: 200,
      coins: 60,
      sortOrder: 2,
      active: true,
      rules: {
        files: [
          {
            path: "milestones/M2.md",
            minChars: 400,
            requiredKeywords: ["implemented", "feature", "functionality"],
          },
        ],
        diff: { minFilesChanged: 5, minLinesAdded: 150 },
      },
    },
    {
      _id: "m3",
      code: "M3",
      title: "Complete MVP & Demo",
      xp: 300,
      coins: 100,
      sortOrder: 3,
      active: true,
      rules: {
        files: [
          {
            path: "milestones/M3.md",
            minChars: 400,
            requiredKeywords: ["demo", "working", "mvp", "deployed"],
          },
        ],
        diff: { minFilesChanged: 8, minLinesAdded: 250 },
      },
    },
    {
      _id: "m4",
      code: "M4",
      title: "Final Polish & Documentation",
      xp: 400,
      coins: 150,
      sortOrder: 4,
      active: true,
      rules: {
        files: [
          {
            path: "milestones/M4.md",
            minChars: 600,
            requiredKeywords: ["documentation", "setup", "usage", "features", "complete"],
          },
          {
            path: "README.md",
            minChars: 800,
            requiredKeywords: ["installation", "usage", "demo", "screenshots"],
          },
        ],
        diff: { minFilesChanged: 10, minLinesAdded: 400 },
      },
    },
  ];

  for (const d of docs) {
    await milestones.updateOne({ _id: d._id }, { $set: d }, { upsert: true });
  }

  return Response.json({ ok: true, upserted: docs.length });
}
