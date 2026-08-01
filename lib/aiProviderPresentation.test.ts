import { describe, expect, it } from "vitest";
import { createAiProviderFromPreset } from "./aiProviders";
import {
  getAiProviderCredentialSummary,
  getAiProviderHealth,
} from "./aiProviderPresentation";

describe("AI provider presentation", () => {
  it("summarizes a configured provider for the provider list", () => {
    const provider = createAiProviderFromPreset("openai", {
      apiKey: "sk-test-1234567890",
      model: "gpt-4o-mini",
      models: [
        { id: "gpt-4o-mini", label: "gpt-4o-mini", source: "remote" },
      ],
    });

    expect(getAiProviderCredentialSummary(provider)).toBe(
      "API Key · sk-t…7890"
    );
    expect(getAiProviderHealth(provider)).toBe("ready");
  });

  it("marks a provider without credentials or models as empty", () => {
    expect(getAiProviderHealth(createAiProviderFromPreset("openai"))).toBe(
      "empty"
    );
    expect(
      getAiProviderCredentialSummary(createAiProviderFromPreset("openai"))
    ).toBe("未配置 API Key");
  });

  it("marks partially configured providers as needing attention", () => {
    const provider = createAiProviderFromPreset("openai", {
      apiKey: "sk-test",
    });

    expect(getAiProviderHealth(provider)).toBe("needs-attention");
  });
});
