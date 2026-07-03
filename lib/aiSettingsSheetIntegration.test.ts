import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const aiSettingsSource = readFileSync(
  new URL("../app/AiSettingsSheet.tsx", import.meta.url),
  "utf8"
);

describe("AI settings provider sheet", () => {
  it("uses provider presets as the single visible protocol chooser", () => {
    expect(aiSettingsSource).toContain("AI_PROVIDER_PRESETS.map");
    expect(aiSettingsSource).toContain("changeProviderKind");

    expect(aiSettingsSource).not.toContain("AI_API_FORMATS.map");
    expect(aiSettingsSource).not.toContain("changeProtocol");
  });
});
