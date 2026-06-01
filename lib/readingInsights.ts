import type { DailyReadingStat } from "./db";

export type ReadingDayInsight = {
  date: string;
  label: string;
  minutes: number;
  progress: number;
  isToday: boolean;
};

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function buildSevenDayReadingInsights(
  stats: DailyReadingStat[],
  todayKey: string,
  targetMinutes: number
): ReadingDayInsight[] {
  const byDate = new Map(stats.map((stat) => [stat.date, stat]));
  const today = parseDateKey(todayKey);
  const safeTarget = Math.max(1, Math.floor(targetMinutes));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = toDateKey(date);
    const seconds = Math.max(0, byDate.get(key)?.secondsRead ?? 0);
    const minutes = Math.floor(seconds / 60);
    return {
      date: key,
      label: key === todayKey ? "今" : WEEKDAY_LABELS[date.getDay()],
      minutes,
      progress: Math.min(minutes / safeTarget, 1),
      isToday: key === todayKey,
    };
  });
}

export function totalReadingMinutes(stats: DailyReadingStat[]): number {
  return stats.reduce((total, stat) => {
    if (!Number.isFinite(stat.secondsRead) || stat.secondsRead <= 0) return total;
    return total + Math.floor(stat.secondsRead / 60);
  }, 0);
}
