export const SETTINGS_APP_VERSION = "0.4";

export function formatAiStatus(isConfigured: boolean): string {
  return isConfigured ? "\u5df2\u914d\u7f6e" : "\u672a\u914d\u7f6e";
}

export function formatSettingsBookCount(count: number): string {
  if (!Number.isFinite(count) || count < 0) return "0 \u672c\u56fe\u4e66";
  return `${Math.floor(count)} \u672c\u56fe\u4e66`;
}

export function formatSettingsReadingMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "0 \u5206\u949f";
  return `${Math.floor(minutes)} \u5206\u949f`;
}
