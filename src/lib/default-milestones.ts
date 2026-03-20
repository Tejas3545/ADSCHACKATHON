import type { Milestone } from "@/lib/models";

export const DEFAULT_MILESTONES: Milestone[] = [
  {
    _id: "MS1",
    code: "MS1",
    title: "Create repository and README",
    xp: 80,
    coins: 10,
    rules: {
      files: [
        {
          path: "README.md",
          minChars: 30,
          requiredKeywords: [],
        },
      ],
      diff: {
        minFilesChanged: 1,
        minLinesAdded: 5,
      },
      commitMessageKeywords: ["init", "readme", "repository", "repo"],
      manualReview: false,
    },
    active: true,
    sortOrder: 1,
  },
  {
    _id: "MS2",
    code: "MS2",
    title: "Create frontend/client folder and implement requirements",
    xp: 120,
    coins: 20,
    rules: {
      files: [],
      diff: {
        minFilesChanged: 2,
        minLinesAdded: 30,
      },
      requiredPathPrefixes: ["frontend|client"],
      commitMessageKeywords: ["frontend", "ui", "client", "react", "next"],
      manualReview: false,
    },
    active: true,
    sortOrder: 2,
  },
  {
    _id: "MS3",
    code: "MS3",
    title: "Create backend/server folder and implement requirements",
    xp: 120,
    coins: 30,
    rules: {
      files: [],
      diff: {
        minFilesChanged: 2,
        minLinesAdded: 30,
      },
      requiredPathPrefixes: ["backend|server"],
      commitMessageKeywords: ["backend", "api", "server", "database", "auth"],
      manualReview: false,
    },
    active: true,
    sortOrder: 3,
  },
];
