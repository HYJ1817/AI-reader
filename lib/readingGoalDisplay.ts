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

export function getReadingGoalContinueSubtitle(bookTitle?: string | null): string {
  const trimmed = bookTitle?.trim();
  return trimmed ? trimmed : "从书库选择一本书";
}
