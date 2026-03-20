export const DEFAULT_COMMIT_WARNING_THRESHOLD = 15;
export const DEFAULT_COMMIT_HARD_THRESHOLD = 20;

export function getCommitWarningThreshold(): number {
  const raw = process.env.COMMIT_WARNING_THRESHOLD;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_COMMIT_WARNING_THRESHOLD;
  }
  return parsed;
}

export function getCommitHardThreshold(): number {
  const raw = process.env.COMMIT_HARD_THRESHOLD;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  const warningThreshold = getCommitWarningThreshold();
  if (!Number.isFinite(parsed) || parsed < warningThreshold) {
    return DEFAULT_COMMIT_HARD_THRESHOLD;
  }
  return parsed;
}

export function shouldWarnForCommitCount(commitCount: number, threshold: number): boolean {
  return commitCount >= threshold;
}

export function buildCommitWarningMessage(commitCount: number, threshold: number): string {
  return `Warning: your team has pushed ${commitCount} commits. Limit is around ${threshold}. Please avoid extra commits unless necessary.`;
}

export function calculateCommitXpPenalty(commitCount: number): { penaltyXP: number; effectiveXP: (rawXP: number) => number } {
  const warningThreshold = getCommitWarningThreshold();
  const hardThreshold = Math.max(getCommitHardThreshold(), warningThreshold);

  const softOverLimit = Math.max(0, Math.min(commitCount, hardThreshold) - warningThreshold);
  const hardOverLimit = Math.max(0, commitCount - hardThreshold);

  const penaltyXP = softOverLimit * 2 + hardOverLimit * 5;

  return {
    penaltyXP,
    effectiveXP: (rawXP: number) => Math.max(0, rawXP - penaltyXP),
  };
}
