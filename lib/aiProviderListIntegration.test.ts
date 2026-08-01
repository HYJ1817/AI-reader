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

describe("Minis-style provider list contract", () => {
  it("exposes a keyboard-dismissible add-provider menu", () => {
    expect(surface).toContain('data-provider-add-menu="true"');
    expect(surface).toContain('role="menu"');
    expect(surface).toContain('aria-haspopup="menu"');
    expect(surface).toContain('event.key !== "Escape"');
    expect(surface).toContain('document.addEventListener("pointerdown"');
    expect(surface).toContain("addMenuTriggerRef");
    expect(surface).toContain("addMenuRef");
    expect(surface).toContain("导入服务商配置");
  });

  it("renders provider health and model-count metadata in list rows", () => {
    expect(surface).toContain("getAiProviderHealth(provider)");
    expect(surface).toContain("getAiProviderCredentialSummary(provider)");
    expect(surface).toContain('data-provider-status=');
    expect(surface).toContain('data-provider-model-count=');
    expect(surface).toContain('data-provider-list-row="true"');
  });

  it("makes the list edit affordance an actual delete mode", () => {
    expect(surface).toContain("providerListEditing");
    expect(surface).toContain("deleteProviderFromList");
    expect(surface).toContain('data-provider-editing={');
    expect(surface).toContain('data-provider-delete="true"');
    expect(surface).toContain("window.confirm");
  });

  it("keeps the add menu and status dot visually theme-aware", () => {
    expect(css).toMatch(
      /\.providerSheetHeader\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)/
    );
    expect(css).toMatch(/\.providerAddMenu\s*\{[\s\S]*?position:\s*absolute/);
    expect(css).toMatch(/\.providerStatusDot\s*\{[\s\S]*?border-radius:\s*999px/);
    expect(css).toMatch(/\.providerStatusDotReady\s*\{[\s\S]*?var\(--/);
    expect(css).toMatch(/\.providerAddMenuItem\s*\{[\s\S]*?min-height:\s*44px/);
  });
});
