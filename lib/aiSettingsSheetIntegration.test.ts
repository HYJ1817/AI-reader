import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const aiSettingsSource = readFileSync(
  new URL("../app/AiSettingsSheet.tsx", import.meta.url),
  "utf8"
);

describe("AI settings provider sheet", () => {
  it("offers provider presets before lower-level API formats", () => {
    expect(aiSettingsSource).toContain("AI_PROVIDER_PRESETS.map");
    expect(aiSettingsSource).toContain("changeProviderKind");

    expect(aiSettingsSource.indexOf("AI_PROVIDER_PRESETS.map")).toBeLessThan(
      aiSettingsSource.indexOf("AI_API_FORMATS.map")
    );
  });
});
