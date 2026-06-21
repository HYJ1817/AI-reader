import type { AiClientSettings } from "./aiSettings";

export type AiProviderKind =
  | "custom"
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "xai";

export type AiProviderProtocol =
  | "openai-compatible"
  | "anthropic-compatible"
  | "gemini";

export interface AiApiFormatOption {
  protocol: AiProviderProtocol;
  label: string;
  description: string;
  defaultBaseUrl: string;
  defaultPath: string;
}

export interface AiProviderModel {
  id: string;
  label: string;
  source: "remote" | "manual";
}

export interface AiProviderConfig {
  id: string;
  kind: AiProviderKind;
  protocol: AiProviderProtocol;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  models: AiProviderModel[];
  appendDefaultPath: boolean;
  defaultPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiProviderSettings {
  activeProviderId: string | null;
  providers: AiProviderConfig[];
}

export const AI_API_FORMATS: AiApiFormatOption[] = [
  {
    protocol: "openai-compatible",
    label: "OpenAI-compatible",
    description: "适合 DeepSeek、OpenRouter、xAI、本地模型和大多数 /chat/completions 兼容服务。",
    defaultBaseUrl: "https://api.openai.com",
    defaultPath: "/v1",
  },
  {
    protocol: "anthropic-compatible",
    label: "Anthropic Messages",
    description: "适合 Claude 官方接口或兼容 /messages 的第三方服务。",
    defaultBaseUrl: "https://api.anthropic.com",
    defaultPath: "/v1",
  },
  {
    protocol: "gemini",
    label: "Google Gemini",
    description: "适合 Gemini generateContent API。",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    defaultPath: "/v1beta",
  },
];

export const DEFAULT_AI_PROVIDER_SETTINGS: AiProviderSettings = {
  activeProviderId: null,
  providers: [],
};

const STORAGE_KEY = "ai-reader-ai-provider-settings";
const LEGACY_STORAGE_KEY = "ai-reader-ai-settings";

function nowIso(): string {
  return new Date().toISOString();
}

function fallbackId(prefix: string = "provider"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getAiApiFormat(protocol: AiProviderProtocol): AiApiFormatOption {
  return (
    AI_API_FORMATS.find((item) => item.protocol === protocol) ??
    AI_API_FORMATS[0]
  );
}

export function createEmptyAiProvider(
  overrides: Partial<AiProviderConfig> = {}
): AiProviderConfig {
  const protocol = overrides.protocol ?? "openai-compatible";
  const format = getAiApiFormat(protocol);
  const createdAt = overrides.createdAt ?? nowIso();
  const model = overrides.model?.trim() ?? "";
  const models = normalizeProviderModels(overrides.models ?? [], model);
  return {
    id: overrides.id ?? fallbackId("ai-provider"),
    kind: overrides.kind ?? "custom",
    protocol,
    label: overrides.label ?? "自定义服务商",
    baseUrl: overrides.baseUrl ?? "",
    apiKey: overrides.apiKey ?? "",
    model,
    models,
    appendDefaultPath: overrides.appendDefaultPath ?? true,
    defaultPath: overrides.defaultPath ?? format.defaultPath,
    createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
  };
}

export function createAiProviderFromPreset(
  kind: AiProviderKind,
  overrides: Partial<AiProviderConfig> = {}
): AiProviderConfig {
  const provider = createEmptyAiProvider({
    ...overrides,
    kind,
  });
  if (overrides.label) return provider;
  if (kind === "openai") return { ...provider, label: "OpenAI / Compatible API" };
  if (kind === "anthropic") return { ...provider, label: "Anthropic / Compatible API" };
  if (kind === "gemini") return { ...provider, label: "Google Gemini" };
  if (kind === "openrouter") return { ...provider, label: "OpenRouter" };
  if (kind === "xai") return { ...provider, label: "xAI" };
  return provider;
}

function normalizeProviderModels(
  value: unknown,
  selectedModel?: string
): AiProviderModel[] {
  const models = Array.isArray(value)
    ? value
        .map((item) => {
          if (typeof item === "string") {
            const id = item.trim();
            return id ? { id, label: id, source: "manual" as const } : null;
          }
          if (item === null || typeof item !== "object") return null;
          const obj = item as Partial<AiProviderModel>;
          const id = typeof obj.id === "string" ? obj.id.trim() : "";
          const label = typeof obj.label === "string" && obj.label.trim()
            ? obj.label.trim()
            : id;
          const source = obj.source === "remote" ? "remote" : "manual";
          return id ? { id, label, source } : null;
        })
        .filter((item): item is AiProviderModel => item !== null)
    : [];

  const seen = new Set<string>();
  const deduped = models.filter((model) => {
    if (seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  });

  const selected = selectedModel?.trim();
  if (selected && !seen.has(selected)) {
    deduped.push({ id: selected, label: selected, source: "manual" });
  }
  return deduped;
}

export function sanitizeAiProvider(value: unknown): AiProviderConfig | null {
  if (value === null || typeof value !== "object") return null;
  const obj = value as Partial<AiProviderConfig>;
  const id = typeof obj.id === "string" ? obj.id.trim() : "";
  const label = typeof obj.label === "string" ? obj.label.trim() : "";
  const baseUrl = typeof obj.baseUrl === "string" ? obj.baseUrl.trim() : "";
  const apiKey = typeof obj.apiKey === "string" ? obj.apiKey.trim() : "";
  const model = typeof obj.model === "string" ? obj.model.trim() : "";
  const candidateProtocol = obj.protocol;
  const protocol: AiProviderProtocol =
    candidateProtocol &&
    AI_API_FORMATS.some((format) => format.protocol === candidateProtocol)
      ? candidateProtocol
      : "openai-compatible";
  const format = getAiApiFormat(protocol);
  if (!id || !label) return null;

  return {
    id,
    kind: obj.kind ?? "custom",
    protocol,
    label,
    baseUrl,
    apiKey,
    model,
    models: normalizeProviderModels(obj.models, model),
    appendDefaultPath:
      typeof obj.appendDefaultPath === "boolean" ? obj.appendDefaultPath : true,
    defaultPath:
      typeof obj.defaultPath === "string" && obj.defaultPath.trim()
        ? obj.defaultPath.trim()
        : format.defaultPath,
    createdAt:
      typeof obj.createdAt === "string" && obj.createdAt.trim()
        ? obj.createdAt
        : nowIso(),
    updatedAt:
      typeof obj.updatedAt === "string" && obj.updatedAt.trim()
        ? obj.updatedAt
        : nowIso(),
  };
}

export function sanitizeAiProviderSettings(value: unknown): AiProviderSettings {
  if (value === null || typeof value !== "object") {
    return DEFAULT_AI_PROVIDER_SETTINGS;
  }
  const obj = value as Partial<AiProviderSettings>;
  const providers = Array.isArray(obj.providers)
    ? obj.providers
        .map((provider) => sanitizeAiProvider(provider))
        .filter((provider): provider is AiProviderConfig => provider !== null)
    : [];

  if (providers.length === 0) {
    return DEFAULT_AI_PROVIDER_SETTINGS;
  }

  const activeProviderId =
    typeof obj.activeProviderId === "string" &&
    providers.some((provider) => provider.id === obj.activeProviderId)
      ? obj.activeProviderId
      : providers[0].id;

  return { activeProviderId, providers };
}

export function resolveAiProviderBaseUrl(provider: AiProviderConfig): string {
  const trimmed = provider.baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("Base URL must not be empty");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Invalid base URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URL must start with http:// or https://");
  }
  const defaultPath = provider.defaultPath.startsWith("/")
    ? provider.defaultPath
    : `/${provider.defaultPath}`;
  if (!provider.appendDefaultPath || trimmed.endsWith(defaultPath)) {
    return trimmed;
  }
  return `${trimmed}${defaultPath}`;
}

export function hasUsableAiProvider(provider: AiProviderConfig | null | undefined): boolean {
  if (!provider) return false;
  return (
    provider.baseUrl.trim().length > 0 &&
    provider.apiKey.trim().length > 0 &&
    provider.model.trim().length > 0
  );
}

export function getActiveAiProvider(settings: AiProviderSettings): AiProviderConfig | null {
  if (!settings.activeProviderId) return null;
  return (
    settings.providers.find((provider) => provider.id === settings.activeProviderId) ??
    null
  );
}

export function providerToAiClientSettings(provider: AiProviderConfig): AiClientSettings {
  return {
    baseUrl: resolveAiProviderBaseUrl(provider),
    apiKey: provider.apiKey,
    model: provider.model,
  };
}

function loadLegacyProvider(): AiProviderSettings {
  if (typeof localStorage === "undefined") return DEFAULT_AI_PROVIDER_SETTINGS;
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return DEFAULT_AI_PROVIDER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AiClientSettings>;
    if (
      typeof parsed.apiKey !== "string" ||
      typeof parsed.model !== "string" ||
      !parsed.apiKey.trim() ||
      !parsed.model.trim()
    ) {
      return DEFAULT_AI_PROVIDER_SETTINGS;
    }
    const provider = createEmptyAiProvider({
      id: "legacy-openai-compatible",
      label: "OpenAI / Compatible API",
      baseUrl:
        typeof parsed.baseUrl === "string" && parsed.baseUrl.trim()
          ? parsed.baseUrl.trim()
          : "https://api.openai.com/v1",
      apiKey: parsed.apiKey.trim(),
      model: parsed.model.trim(),
      models: [{ id: parsed.model.trim(), label: parsed.model.trim(), source: "manual" }],
      appendDefaultPath: false,
    });
    return { activeProviderId: provider.id, providers: [provider] };
  } catch {
    return DEFAULT_AI_PROVIDER_SETTINGS;
  }
}

export function loadAiProviderSettings(): AiProviderSettings {
  if (typeof localStorage === "undefined") return DEFAULT_AI_PROVIDER_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return sanitizeAiProviderSettings(JSON.parse(raw));
    }
  } catch {
    return DEFAULT_AI_PROVIDER_SETTINGS;
  }
  return loadLegacyProvider();
}

export function saveAiProviderSettingsToStorage(settings: AiProviderSettings): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeAiProviderSettings(settings)));
}

export function clearAiProviderSettingsFromStorage(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
