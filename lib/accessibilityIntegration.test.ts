import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globals = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8"
);
const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);
const library = readFileSync(
  new URL("../app/LibrarySurface.tsx", import.meta.url),
  "utf8"
);
const askAi = readFileSync(
  new URL("../app/AskAiPanel.tsx", import.meta.url),
  "utf8"
);
const settings = readFileSync(
  new URL("../app/SettingsSurface.tsx", import.meta.url),
  "utf8"
);

function rule(source: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(
    new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`)
  );
  expect(match, `Missing CSS rule for ${selector}`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("daily-path accessibility contract", () => {
  it("provides one visible keyboard focus language", () => {
    expect(globals).toContain("--focus-ring");
    expect(globals).toContain(":focus-visible");
    expect(globals).toMatch(/:focus-visible[^}]*outline:\s*3px solid var\(--focus-ring\)/s);
    expect(rule(css, ".tab:focus-visible")).not.toContain("outline: none");
  });

  it("uses native, separate Library controls with explicit view state", () => {
    expect(library).toContain('role="group"');
    expect(library).toContain("aria-pressed={view.mode === mode}");
    expect(library).toContain('data-library-book-open="true"');
    expect(library).toContain('data-library-book-more="true"');
    expect(library).toContain("className={styles.bookItemMain}");
  });

  it("names Ask AI actions and announces async state", () => {
    expect(askAi).toContain("className={styles.settingsPrompt}");
    expect(askAi).toContain("<button");
    expect(askAi).toContain('aria-label={UI_TEXT.SEND}');
    expect(askAi).toContain('role="status"');
    expect(askAi).toContain('role="alert"');
    expect(askAi).toContain('aria-busy={loading}');
    expect(settings).toContain('role="status"');
    expect(settings).toContain('role="alert"');
  });

  it("uses scalable tokens on the stabilized daily path", () => {
    for (const token of [
      "--type-caption",
      "--type-footnote",
      "--type-body",
      "--type-headline",
      "--type-title",
    ]) {
      expect(globals).toContain(token);
    }
    expect(rule(css, ".libraryTitle")).toContain("var(--type-title)");
    expect(rule(css, ".bookTitle")).toContain("var(--type-body)");
    expect(rule(css, ".bookMeta")).toContain("var(--type-footnote)");
    expect(rule(css, ".tabLabel")).toContain("var(--type-caption)");
  });

  it("keeps frequent compact controls at least 44px", () => {
    for (const selector of [
      ".iconButton",
      ".libraryViewToggle button",
      ".bookGridMoreButton",
      ".bookMoreButton",
      ".clearSelectionButton",
      ".settingsActionRow button",
      ".groupAction",
      ".groupActionDelete",
      ".providerRefreshButton",
    ]) {
      const value = rule(css, selector);
      expect(value, selector).toMatch(/(?:width|min-width):\s*44px/);
      expect(value, selector).toMatch(/(?:height|min-height):\s*44px/);
    }
  });
});
