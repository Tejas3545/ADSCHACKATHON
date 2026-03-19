import { getCollections } from "@/lib/collections";

const LEADERBOARD_STATE_ID = "leaderboard_state" as const;

export type RuntimeLeaderboardState = {
  isRunning: boolean;
  startedAt: Date | null;
  endedAt: Date | null;
  updatedAt: Date;
};

export async function getLeaderboardState(): Promise<RuntimeLeaderboardState> {
  const { settings } = await getCollections();

  const existing = await settings.findOne({ _id: LEADERBOARD_STATE_ID });
  if (existing) {
    return {
      isRunning: existing.isRunning,
      startedAt: existing.startedAt ?? null,
      endedAt: existing.endedAt ?? null,
      updatedAt: existing.updatedAt,
    };
  }

  const now = new Date();
  const initial: RuntimeLeaderboardState = {
    isRunning: false,
    startedAt: null,
    endedAt: now,
    updatedAt: now,
  };

  await settings.updateOne(
    { _id: LEADERBOARD_STATE_ID },
    {
      $setOnInsert: {
        _id: LEADERBOARD_STATE_ID,
        ...initial,
      },
    },
    { upsert: true }
  );

  return initial;
}

export async function setLeaderboardRunning(isRunning: boolean): Promise<RuntimeLeaderboardState> {
  const { settings } = await getCollections();
  const now = new Date();

  await settings.updateOne(
    { _id: LEADERBOARD_STATE_ID },
    {
      $set: {
        isRunning,
        updatedAt: now,
        ...(isRunning ? { startedAt: now, endedAt: null } : { endedAt: now }),
      },
      $setOnInsert: {
        _id: LEADERBOARD_STATE_ID,
      },
    },
    { upsert: true }
  );

  return getLeaderboardState();
}

export async function assertLeaderboardRunning(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const state = await getLeaderboardState();
  if (!state.isRunning) {
    return {
      ok: false,
      reason: "Leaderboard is not running. Contact admin.",
    };
  }

  return { ok: true };
}
