import { describe, it, expect } from "vitest";
import {
  DEFAULT_AI_SETTINGS,
  sanitizeAiSettings,
  hasUsableAiSettings,
} from "./aiSettings";

describe("DEFAULT_AI_SETTINGS", () => {
  it("has a default baseUrl of https://api.openai.com/v1", () => {
    expect(DEFAULT_AI_SETTINGS.baseUrl).toBe("https://api.openai.com/v1");
  });

  it("has an empty default apiKey", () => {
    expect(DEFAULT_AI_SETTINGS.apiKey).toBe("");
  });

  it("has an empty default model", () => {
    expect(DEFAULT_AI_SETTINGS.model).toBe("");
  });
});

describe("sanitizeAiSettings", () => {
  it("returns defaults when given an empty object", () => {
    const result = sanitizeAiSettings({});
    expect(result).toEqual(DEFAULT_AI_SETTINGS);
  });

  it("preserves provided values", () => {
    const result = sanitizeAiSettings({
      baseUrl: "https://custom.api/v1",
      apiKey: "token-abc123",
      model: "gpt-4",
    });
    expect(result.baseUrl).toBe("https://custom.api/v1");
    expect(result.apiKey).toBe("token-abc123");
    expect(result.model).toBe("gpt-4");
  });

  it("trims whitespace from baseUrl", () => {
    const result = sanitizeAiSettings({ baseUrl: "  https://api.openai.com/v1  " });
    expect(result.baseUrl).toBe("https://api.openai.com/v1");
  });

  it("trims whitespace from model", () => {
    const result = sanitizeAiSettings({ model: "  gpt-4  " });
    expect(result.model).toBe("gpt-4");
  });

  it("preserves apiKey except trimming outer whitespace", () => {
    const result = sanitizeAiSettings({ apiKey: "  token-secret-key  " });
    expect(result.apiKey).toBe("token-secret-key");
  });

  it("does not trim inner whitespace of apiKey", () => {
    const result = sanitizeAiSettings({ apiKey: "sk key with spaces" });
    expect(result.apiKey).toBe("sk key with spaces");
  });

  it("fills missing fields from defaults", () => {
    const result = sanitizeAiSettings({ model: "gpt-4" });
    expect(result.baseUrl).toBe(DEFAULT_AI_SETTINGS.baseUrl);
    expect(result.apiKey).toBe("");
    expect(result.model).toBe("gpt-4");
  });

  it("treats undefined fields as missing", () => {
    const result = sanitizeAiSettings({
      baseUrl: undefined,
      apiKey: undefined,
      model: undefined,
    });
    expect(result).toEqual(DEFAULT_AI_SETTINGS);
  });
});

describe("hasUsableAiSettings", () => {
  it("returns false when all fields are empty", () => {
    expect(hasUsableAiSettings(DEFAULT_AI_SETTINGS)).toBe(false);
  });

  it("returns false when apiKey is missing", () => {
    expect(
      hasUsableAiSettings({
        baseUrl: "https://api.openai.com/v1",
        apiKey: "",
        model: "gpt-4",
      })
    ).toBe(false);
  });

  it("returns false when baseUrl is missing", () => {
    expect(
      hasUsableAiSettings({
        baseUrl: "",
        apiKey: "token-abc",
        model: "gpt-4",
      })
    ).toBe(false);
  });

  it("returns false when model is missing", () => {
    expect(
      hasUsableAiSettings({
        baseUrl: "https://api.openai.com/v1",
        apiKey: "token-abc",
        model: "",
      })
    ).toBe(false);
  });

  it("returns true when all fields are non-empty", () => {
    expect(
      hasUsableAiSettings({
        baseUrl: "https://api.openai.com/v1",
        apiKey: "token-abc",
        model: "gpt-4",
      })
    ).toBe(true);
  });

  it("returns false when fields are only whitespace", () => {
    expect(
      hasUsableAiSettings({
        baseUrl: "   ",
        apiKey: "   ",
        model: "   ",
      })
    ).toBe(false);
  });
});
