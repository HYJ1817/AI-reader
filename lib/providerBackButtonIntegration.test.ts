import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const surfaceSource = readFileSync(
  new URL("../app/AiSettingsSurface.tsx", import.meta.url),
  "utf8"
);
const stylesSource = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

describe("AI provider arrow back button", () => {
  it("renders an icon-only route-aware accessible back button", () => {
    const buttonStart = surfaceSource.indexOf(
      "className={styles.providerNavButton}"
    );
    const buttonEnd = surfaceSource.indexOf("</button>", buttonStart);
    const buttonSource = surfaceSource.slice(buttonStart, buttonEnd);

    expect(buttonSource).toContain(
      'aria-label={mode === "list" ? "返回设置" : "返回服务商"}'
    );
    expect(buttonSource).toContain("className={styles.providerNavIcon}");
    expect(buttonSource).toContain('viewBox="0 0 24 24"');
    expect(buttonSource).toContain('aria-hidden="true"');
    expect(buttonSource).not.toContain(
      'mode === "list" ? "设置" : "服务商"'
    );
  });

  it("gives the arrow button a stable hit target and accessible motion states", () => {
    expect(stylesSource).toMatch(
      /\.providerNavButton\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*border-radius:\s*50%;/s
    );
    expect(stylesSource).toMatch(
      /\.providerNavButton\s*\{[^}]*border:[^;]+;[^}]*background:[^;]+;/s
    );
    expect(stylesSource).toMatch(
      /\.providerNavButton:focus-visible\s*\{[^}]*outline:[^}]*var\(--focus-ring\)/s
    );
    expect(stylesSource).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.providerNavButton,[\s\S]*?\.providerNavIcon[\s\S]*?transition:\s*none;/s
    );
  });
});
