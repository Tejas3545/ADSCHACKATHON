/**
 * Calculate XP with time-based multiplier
 * Earlier completion = higher XP
 */

export interface XPCalculationResult {
  baseXP: number;
  multiplier: number;
  bonusXP: number;
  totalXP: number;
  completionPercentage: number;
}

export const MAX_TEAM_XP = 300;

export function calculateCappedXpAward(currentTeamXP: number, requestedAwardXP: number): {
  awardedXP: number;
  remainingXP: number;
  capped: boolean;
} {
  const safeCurrent = Math.max(0, Math.trunc(currentTeamXP));
  const safeRequested = Math.max(0, Math.trunc(requestedAwardXP));
  const remainingXP = Math.max(0, MAX_TEAM_XP - safeCurrent);
  const awardedXP = Math.min(safeRequested, remainingXP);

  return {
    awardedXP,
    remainingXP,
    capped: awardedXP < safeRequested,
  };
}

export function applyAdditionalMultiplier(
  currentXP: number,
  extraMultiplier: number
): { adjustedXP: number; totalMultiplier: number } {
  return {
    adjustedXP: Math.round(currentXP * extraMultiplier),
    totalMultiplier: extraMultiplier,
  };
}

/**
 * Get hackathon start and end times from environment variables
 */
function getHackathonTimes(): { startTime: Date; endTime: Date } {
  const hackathonDate = process.env.HACKATHON_DATE || "2026-03-15";
  const startHour = parseInt(process.env.HACKATHON_START_HOUR || "8");
  const endHour = parseInt(process.env.HACKATHON_END_HOUR || "17");

  const [year, month, day] = hackathonDate.split("-").map(Number);
  
  const startTime = new Date(year, month - 1, day, startHour, 0, 0);
  const endTime = new Date(year, month - 1, day, endHour, 0, 0);
  
  return { startTime, endTime };
}

/**
 * Calculate XP with time-based bonus
 * 
 * Time-based multipliers:
 * - First 25% of hackathon time: 1.5x XP (50% bonus)
 * - First 50% of hackathon time: 1.3x XP (30% bonus)
 * - First 75% of hackathon time: 1.15x XP (15% bonus)
 * - After 75%: 1.0x XP (no bonus)
 * - After hackathon ends: 0.8x XP (20% penalty for late submission)
 * 
 * @param baseXP - The base XP value for the milestone
 * @param completionTime - When the milestone was completed
 * @returns XP calculation details
 */
export function calculateXPWithTimeBonus(
  baseXP: number,
  completionTime: Date = new Date()
): XPCalculationResult {
  const { startTime, endTime } = getHackathonTimes();
  
  const totalDuration = endTime.getTime() - startTime.getTime();
  const elapsedTime = completionTime.getTime() - startTime.getTime();
  const completionPercentage = Math.max(0, Math.min(100, (elapsedTime / totalDuration) * 100));
  
  let multiplier = 1.0;
  
  // Before hackathon starts
  if (completionTime < startTime) {
    multiplier = 1.0; // No penalty or bonus for early birds
  }
  // Within first 25% (e.g., first 2.25 hours of 9-hour hackathon)
  else if (completionPercentage <= 25) {
    multiplier = 1.5;
  }
  // Within first 50%
  else if (completionPercentage <= 50) {
    multiplier = 1.3;
  }
  // Within first 75%
  else if (completionPercentage <= 75) {
    multiplier = 1.15;
  }
  // Within hackathon time but after 75%
  else if (completionPercentage <= 100) {
    multiplier = 1.0;
  }
  // After hackathon ends
  else {
    multiplier = 0.8;
  }
  
  const totalXP = Math.round(baseXP * multiplier);
  const bonusXP = totalXP - baseXP;
  
  return {
    baseXP,
    multiplier,
    bonusXP,
    totalXP,
    completionPercentage: Math.round(completionPercentage * 10) / 10, // Round to 1 decimal
  };
}

/**
 * Get a human-readable description of the time bonus
 */
export function getTimeBonusDescription(result: XPCalculationResult): string {
  if (result.bonusXP > 0) {
    return `Speed bonus: +${result.bonusXP} XP (${Math.round((result.multiplier - 1) * 100)}% bonus for completing at ${result.completionPercentage}% of hackathon time)`;
  } else if (result.bonusXP < 0) {
    return `Late submission adjustment: ${result.bonusXP} XP (${Math.round((1 - result.multiplier) * 100)}% penalty)`;
  }
  return "Base XP awarded";
}
