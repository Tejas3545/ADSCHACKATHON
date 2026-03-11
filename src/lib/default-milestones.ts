import type { Milestone } from "@/lib/models";

export const DEFAULT_MILESTONES: Milestone[] = [
  {
    _id: "MS1",
    code: "MS1",
    title: "First Valid Commit",
    xp: 50,
    coins: 10,
    rules: {
      files: [],
      diff: {
        minFilesChanged: 1,
        minLinesAdded: 1,
      },
      manualReview: false,
    },
    active: true,
    sortOrder: 1,
  },
  {
    _id: "MS2",
    code: "MS2",
    title: "Meaningful Progress Commit",
    xp: 100,
    coins: 20,
    rules: {
      files: [],
      diff: {
        minFilesChanged: 2,
        minLinesAdded: 20,
      },
      manualReview: false,
    },
    active: true,
    sortOrder: 2,
  },
  {
    _id: "MS3",
    code: "MS3",
    title: "Project README Updated",
    xp: 150,
    coins: 30,
    rules: {
      files: [
        {
          path: "README.md",
          minChars: 100,
          requiredKeywords: [],
        },
      ],
      diff: {
        minFilesChanged: 1,
        minLinesAdded: 10,
      },
      manualReview: false,
    },
    active: true,
    sortOrder: 3,
  },
];
