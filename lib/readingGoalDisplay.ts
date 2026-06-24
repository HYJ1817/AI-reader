export type ReadingGoalDisplay = {
  remainingMinutes: number;
  completed: boolean;
};

function normalizeMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 0;
  return Math.max(0, Math.floor(minutes));
}

export function formatReadingGoalDuration(minutes: number): string {
  const normalized = normalizeMinutes(minutes);
  const hours = Math.floor(normalized / 60);
  const remainder = normalized % 60;
  return `${hours}:${remainder.toString().padStart(2, "0")}`;
}

export function getReadingGoalDisplay(
  todayMinutes: number,
  targetMinutes: number
): ReadingGoalDisplay {
  const today = normalizeMinutes(todayMinutes);
  const target = normalizeMinutes(targetMinutes);
  const remainingMinutes = Math.max(target - today, 0);

  return {
    remainingMinutes,
    completed: target > 0 && today >= target,
  };
}

export function getReadingGoalArcPercent(
  todayMinutes: number,
  targetMinutes: number
): number {
  if (
    !Number.isFinite(todayMinutes) ||
    !Number.isFinite(targetMinutes) ||
    targetMinutes <= 0
  ) {
    return 0;
  }

  const percent = (todayMinutes / targetMinutes) * 100;
  if (percent <= 0) return 0;
  if (percent >= 100) return 100;
  return Math.round(percent * 10) / 10;
}
