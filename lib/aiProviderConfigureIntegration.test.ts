import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const surface = readFileSync(
  new URL("../app/AiSettingsSurface.tsx", import.meta.url),
  "utf8"
);
const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
).replace(/\r\n/g, "\n");

describe("Minis-style provider configure contract", () => {
  it("shows protocol descriptions and keeps custom endpoints editable", () => {
    expect(surface).toContain("AI_API_FORMATS.map");
    expect(surface).toContain("preset.description");
    expect(surface).toContain("preset.vendors.map");
    expect(surface).toContain("data-provider-api-format");
    expect(surface).toContain("changeProtocol");
  });

  it("provides an accessible API key visibility control", () => {
    expect(surface).toContain("showApiKey");
    expect(surface).toContain('data-provider-api-key-toggle="true"');
    expect(surface).toContain('aria-label={showApiKey ? "隐藏密钥" : "显示密钥"}');
  });

  it("labels remote and manual models and exposes typed retry state", () => {
    expect(surface).toContain('data-provider-model-source={model.source}');
    expect(surface).toContain("data.errorCode");
    expect(surface).toContain("data.retryable");
    expect(surface).toContain('data-provider-retry="true"');
    expect(surface).toContain("retryableRefresh");
  });

  it("keeps configure affordances compact and theme-aware", () => {
    expect(css).toMatch(/\.providerProtocolRow\s*\{[\s\S]*?min-height:\s*44px/);
    expect(css).toMatch(/\.providerApiKeyToggle\s*\{[\s\S]*?min-width:\s*44px/);
    expect(css).toMatch(/\.providerModelSource\s*\{[\s\S]*?border-radius:\s*999px/);
    expect(css).toMatch(/\.providerRefreshError\s*\{[\s\S]*?var\(--status-error\)/);
  });
});
