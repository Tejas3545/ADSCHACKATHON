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
      title: "Project idea & problem statement",
      xp: 50,
      coins: 25,
      sortOrder: 1,
      active: true,
      rules: {
        files: [
          {
            path: "milestones/M1.md",
            minChars: 300,
            requiredKeywords: ["problem", "solution"],
          },
        ],
        diff: { minFilesChanged: 1, minLinesAdded: 20 },
      },
    },
    {
      _id: "m2",
      code: "M2",
      title: "Basic UI / mockup",
      xp: 80,
      coins: 35,
      sortOrder: 2,
      active: true,
      rules: {
        files: [
          {
            path: "milestones/M2.md",
            minChars: 250,
            requiredKeywords: ["ui"],
          },
        ],
        diff: { minFilesChanged: 1, minLinesAdded: 30 },
      },
    },
    {
      _id: "m3",
      code: "M3",
      title: "Initial implementation or deployed page",
      xp: 120,
      coins: 50,
      sortOrder: 3,
      active: true,
      rules: {
        files: [
          {
            path: "milestones/M3.md",
            minChars: 250,
            requiredKeywords: ["demo"],
          },
        ],
        diff: { minFilesChanged: 2, minLinesAdded: 60 },
      },
    },
    {
      _id: "m4",
      code: "M4",
      title: "Final polish & documentation",
      xp: 160,
      coins: 80,
      sortOrder: 4,
      active: true,
      rules: {
        files: [
          {
            path: "milestones/M4.md",
            minChars: 400,
            requiredKeywords: ["setup", "usage"],
          },
        ],
        diff: { minFilesChanged: 2, minLinesAdded: 80 },
        manualReview: true,
      },
    },
  ];

  for (const d of docs) {
    await milestones.updateOne({ _id: d._id }, { $set: d }, { upsert: true });
  }

  return Response.json({ ok: true, upserted: docs.length });
}
