export interface AiClientSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const DEFAULT_AI_SETTINGS: AiClientSettings = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "",
};

export function sanitizeAiSettings(
  value: Partial<AiClientSettings>
): AiClientSettings {
  return {
    baseUrl:
      typeof value.baseUrl === "string"
        ? value.baseUrl.trim()
        : DEFAULT_AI_SETTINGS.baseUrl,
    apiKey:
      typeof value.apiKey === "string"
        ? value.apiKey.trim()
        : DEFAULT_AI_SETTINGS.apiKey,
    model:
      typeof value.model === "string"
        ? value.model.trim()
        : DEFAULT_AI_SETTINGS.model,
  };
}

export function hasUsableAiSettings(settings: AiClientSettings): boolean {
  return (
    settings.baseUrl.trim().length > 0 &&
    settings.apiKey.trim().length > 0 &&
    settings.model.trim().length > 0
  );
}

const STORAGE_KEY = "ai-reader-ai-settings";

export function loadAiSettings(): AiClientSettings {
  if (typeof window === "undefined") return DEFAULT_AI_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;
    const parsed = JSON.parse(raw);
    return sanitizeAiSettings(parsed);
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAiSettingsToStorage(settings: AiClientSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function clearAiSettingsFromStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
