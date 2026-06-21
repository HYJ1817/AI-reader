import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AI_API_FORMATS,
  DEFAULT_AI_PROVIDER_SETTINGS,
  createEmptyAiProvider,
  createAiProviderFromPreset,
  getActiveAiProvider,
  hasUsableAiProvider,
  loadAiProviderSettings,
  providerToAiClientSettings,
  resolveAiProviderBaseUrl,
  sanitizeAiProviderSettings,
  saveAiProviderSettingsToStorage,
} from "./aiProviders";

const store = new Map<string, string>();

const localStorageMock: Storage = {
  get length() {
    return store.size;
  },
  clear() {
    store.clear();
  },
  getItem(key: string) {
    return store.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    store.set(key, value);
  },
  removeItem(key: string) {
    store.delete(key);
  },
  key(index: number) {
    return [...store.keys()][index] ?? null;
  },
};

vi.stubGlobal("localStorage", localStorageMock);

describe("AI provider API formats", () => {
  it("includes the supported API formats", () => {
    expect(AI_API_FORMATS.map((format) => format.protocol)).toEqual([
      "openai-compatible",
      "anthropic-compatible",
      "gemini",
    ]);
  });

  it("creates a usable provider only after API details and model are configured", () => {
    const provider = createEmptyAiProvider({
      protocol: "openai-compatible",
      label: "DeepSeek",
      apiKey: "sk-test",
      model: "deepseek-chat",
      baseUrl: "https://api.deepseek.com",
    });

    expect(provider.protocol).toBe("openai-compatible");
    expect(provider.label).toContain("DeepSeek");
    expect(provider.model).toBe("deepseek-chat");
    expect(hasUsableAiProvider(provider)).toBe(true);
  });
});

describe("AI provider URL handling", () => {
  it("appends /v1 for OpenAI-compatible providers when enabled", () => {
    const provider = createAiProviderFromPreset("openai", {
      baseUrl: "https://api.deepseek.com/",
      apiKey: "key",
      model: "deepseek-chat",
      appendDefaultPath: true,
    });

    expect(resolveAiProviderBaseUrl(provider)).toBe("https://api.deepseek.com/v1");
  });

  it("does not duplicate the default path", () => {
    const provider = createAiProviderFromPreset("openrouter", {
      baseUrl: "https://openrouter.ai/api/v1/",
      apiKey: "key",
      model: "openai/gpt-4o-mini",
      appendDefaultPath: true,
    });

    expect(resolveAiProviderBaseUrl(provider)).toBe("https://openrouter.ai/api/v1");
  });

  it("uses Gemini v1beta as its default path", () => {
    const provider = createEmptyAiProvider({
      protocol: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com",
      apiKey: "key",
      model: "gemini-1.5-flash",
    });

    expect(resolveAiProviderBaseUrl(provider)).toBe(
      "https://generativelanguage.googleapis.com/v1beta"
    );
  });
});

describe("AI provider settings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty defaults for invalid settings", () => {
    expect(sanitizeAiProviderSettings({})).toEqual(DEFAULT_AI_PROVIDER_SETTINGS);
  });

  it("keeps only valid providers and active ids", () => {
    const provider = createAiProviderFromPreset("anthropic", {
      id: "anthropic-1",
      protocol: "anthropic-compatible",
      baseUrl: "https://api.anthropic.com",
      apiKey: "sk-ant",
      model: "claude-3-5-haiku-latest",
    });

    expect(
      sanitizeAiProviderSettings({
        activeProviderId: "anthropic-1",
        providers: [provider, { id: "", label: "" }],
      }).activeProviderId
    ).toBe("anthropic-1");
  });

  it("falls back to first provider when active id is missing", () => {
    const provider = createAiProviderFromPreset("gemini", {
      id: "gemini-1",
      protocol: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com",
      apiKey: "key",
      model: "gemini-1.5-flash",
    });

    const settings = sanitizeAiProviderSettings({
      activeProviderId: "missing",
      providers: [provider],
    });

    expect(settings.activeProviderId).toBe("gemini-1");
    expect(getActiveAiProvider(settings)?.id).toBe("gemini-1");
  });

  it("migrates legacy ai settings into an OpenAI-compatible provider", () => {
    localStorage.setItem(
      "ai-reader-ai-settings",
      JSON.stringify({
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: "legacy-key",
        model: "deepseek-chat",
      })
    );

    const settings = loadAiProviderSettings();
    const active = getActiveAiProvider(settings);

    expect(active?.protocol).toBe("openai-compatible");
    expect(active?.apiKey).toBe("legacy-key");
    expect(active?.model).toBe("deepseek-chat");
  });

  it("saves and loads provider settings from localStorage", () => {
    const provider = createAiProviderFromPreset("openai", {
      id: "provider-1",
      apiKey: "key",
      model: "gpt-4o-mini",
    });

    saveAiProviderSettingsToStorage({
      activeProviderId: "provider-1",
      providers: [provider],
    });

    expect(getActiveAiProvider(loadAiProviderSettings())?.id).toBe("provider-1");
  });

  it("converts a provider to legacy client settings for backup compatibility", () => {
    const provider = createAiProviderFromPreset("openai", {
      baseUrl: "https://api.deepseek.com",
      apiKey: "key",
      model: "deepseek-chat",
    });

    expect(providerToAiClientSettings(provider)).toEqual({
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "key",
      model: "deepseek-chat",
    });
  });
});
