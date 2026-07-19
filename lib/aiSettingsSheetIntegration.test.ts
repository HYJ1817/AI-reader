import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const aiSettingsSource = readFileSync(
  new URL("../app/AiSettingsSurface.tsx", import.meta.url),
  "utf8"
);

describe("AI settings provider surface", () => {
  it("uses provider presets as the single visible protocol chooser", () => {
    expect(aiSettingsSource).toContain("AI_PROVIDER_PRESETS.map");
    expect(aiSettingsSource).toContain("changeProviderKind");
    expect(aiSettingsSource).toContain("preset.iconLabel");
    expect(aiSettingsSource).toContain('aria-pressed={draft.kind === preset.kind}');
    expect(aiSettingsSource).toContain('data-selected={draft.kind === preset.kind ? "true" : undefined}');
    expect(aiSettingsSource).toContain('aria-pressed={draft.model === model.id}');
    expect(aiSettingsSource).toContain('data-selected={draft.model === model.id ? "true" : undefined}');

    expect(aiSettingsSource).not.toContain("AI_API_FORMATS.map");
    expect(aiSettingsSource).not.toContain("changeProtocol");
    expect(aiSettingsSource).not.toContain("slice(0, 1)");
  });
});
