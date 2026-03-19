type RepoTier = "fresh" | "mid" | "old";

type RepoPolicyResult = {
  tier: RepoTier;
  baseTierMultiplier: number;
  commitMultiplier: number;
  finalMultiplier: number;
  reason: string;
};

function parseDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0, 0, 0);
}

export function getPolicyTimes() {
  const eventDate = process.env.HACKATHON_DATE || "2026-03-20";
  const eventStart = process.env.HACKATHON_START_TIME || "07:30";
  const eventEnd = process.env.HACKATHON_END_TIME || "14:30";
  const repoCutoffDate = process.env.REPO_OLD_CUTOFF_DATE || "2026-03-14";
  const repoCutoffTime = process.env.REPO_OLD_CUTOFF_TIME || "12:00";

  return {
    eventStartAt: parseDateTime(eventDate, eventStart),
    eventEndAt: parseDateTime(eventDate, eventEnd),
    oldCutoffAt: parseDateTime(repoCutoffDate, repoCutoffTime),
  };
}

export function classifyRepoTier(repoCreatedAt: Date): RepoTier {
  const { eventStartAt, eventEndAt, oldCutoffAt } = getPolicyTimes();

  if (repoCreatedAt >= eventStartAt && repoCreatedAt <= eventEndAt) {
    return "fresh";
  }

  if (repoCreatedAt >= oldCutoffAt && repoCreatedAt < eventStartAt) {
    return "mid";
  }

  return "old";
}

export function resolveRepoPolicy(repoCreatedAt: Date, commitAt: Date): RepoPolicyResult {
  const { eventStartAt } = getPolicyTimes();
  const tier = classifyRepoTier(repoCreatedAt);

  if (tier === "fresh") {
    return {
      tier,
      baseTierMultiplier: 1,
      commitMultiplier: 1,
      finalMultiplier: 1,
      reason: "Fresh repo created during event window",
    };
  }

  if (tier === "mid") {
    const commitMultiplier = commitAt < eventStartAt ? 0.85 : 1;
    return {
      tier,
      baseTierMultiplier: 0.8,
      commitMultiplier,
      finalMultiplier: commitMultiplier,
      reason:
        commitMultiplier < 1
          ? "Repo created before event start; older commits are penalized"
          : "Repo created before event start, but new event-window commits receive full repo multiplier",
    };
  }

  const commitMultiplier = commitAt < eventStartAt ? 0.75 : 0.9;
  return {
    tier,
    baseTierMultiplier: 0.5,
    commitMultiplier,
    finalMultiplier: commitMultiplier,
    reason:
      commitMultiplier < 0.9
        ? "Legacy repo with pre-event commit history"
        : "Legacy repo continued during event window",
  };
}

export function combineMultipliers(baseXP: number, ...multipliers: number[]) {
  const totalMultiplier = multipliers.reduce((acc, value) => acc * value, 1);
  return {
    finalXP: Math.round(baseXP * totalMultiplier),
    totalMultiplier,
  };
}
