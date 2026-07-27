import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const aiSettingsSource = readFileSync(
  new URL("../app/AiSettingsSurface.tsx", import.meta.url),
  "utf8"
);
const pageCss = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
).replace(/\r\n/g, "\n");

describe("AI settings provider surface", () => {
  it("uses provider presets as the single visible protocol chooser", () => {
    expect(aiSettingsSource).toContain("AI_PROVIDER_PRESETS.map");
    expect(aiSettingsSource).toContain("changeProviderKind");
    expect(aiSettingsSource).toContain("preset.iconLabel");
    expect(aiSettingsSource).toContain("const selected = draft.kind === preset.kind");
    expect(aiSettingsSource).toContain("aria-pressed={selected}");
    expect(aiSettingsSource).toContain(
      'data-selected={selected ? "true" : undefined}'
    );
    expect(aiSettingsSource).toContain('aria-pressed={draft.model === model.id}');
    expect(aiSettingsSource).toContain('data-selected={draft.model === model.id ? "true" : undefined}');

    expect(aiSettingsSource).not.toContain("AI_API_FORMATS.map");
    expect(aiSettingsSource).not.toContain("changeProtocol");
    expect(aiSettingsSource).not.toContain("slice(0, 1)");
  });

  it("uses a compact picker and one labeled connection group", () => {
    expect(aiSettingsSource).toContain("data-provider-preset-grid");
    expect(aiSettingsSource).toContain("providerConnectionCard");
    expect(aiSettingsSource).toContain("providerFieldLabel");
    expect(aiSettingsSource).toContain(">名称</span>");
    expect(aiSettingsSource).toContain(">API Key</span>");
    expect(aiSettingsSource).toContain(">API 地址</span>");
    expect(aiSettingsSource).toContain("providerStickyActions");
    expect(pageCss).toMatch(/\.providerPresetGrid\s*\{[\s\S]*?display:\s*grid/);
    expect(pageCss).toMatch(
      /\.providerStickyActions\s*\{[\s\S]*?position:\s*sticky/
    );
  });

  it("keeps native provider and model selection semantics", () => {
    expect(aiSettingsSource).toContain("aria-pressed={selected}");
    expect(aiSettingsSource).toContain(
      'aria-pressed={draft.model === model.id}'
    );
    expect(aiSettingsSource).toContain('aria-busy={refreshingModels}');
    expect(aiSettingsSource).toContain('role="status"');
  });
});
