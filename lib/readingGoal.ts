export const DEFAULT_READING_TARGET_MINUTES = 120;

const STORAGE_KEY = "ai-reader-reading-goal";

export function getLocalDateKey(date?: Date): string {
  const d = date ?? new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatReadingMinutes(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  return Math.floor(seconds / 60);
}

export function shouldPublishReadingSeconds(
  previousPublishedSeconds: number,
  nextSeconds: number
): boolean {
  return (
    formatReadingMinutes(previousPublishedSeconds) !==
    formatReadingMinutes(nextSeconds)
  );
}

function clampTargetMinutes(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_READING_TARGET_MINUTES;
  }
  const int = Math.floor(value);
  if (int < 1) return 1;
  if (int > 1440) return 1440;
  return int;
}

export function loadReadingGoal(): { targetMinutes: number } {
  if (typeof window === "undefined") {
    return { targetMinutes: DEFAULT_READING_TARGET_MINUTES };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { targetMinutes: DEFAULT_READING_TARGET_MINUTES };
    const parsed = JSON.parse(raw);
    return { targetMinutes: clampTargetMinutes(parsed?.targetMinutes) };
  } catch {
    return { targetMinutes: DEFAULT_READING_TARGET_MINUTES };
  }
}

export function saveReadingGoalToStorage(goal: {
  targetMinutes: number;
}): void {
  if (typeof window === "undefined") return;
  const sanitized = { targetMinutes: clampTargetMinutes(goal.targetMinutes) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
}
