import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.resolve(process.cwd(), "app/LibrarySurface.tsx"),
  "utf8"
);
const css = readFileSync(
  path.resolve(process.cwd(), "app/page.module.css"),
  "utf8"
);

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  expect(match, `Missing CSS rule for ${selector}`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("book-first library hierarchy", () => {
  it("keeps shelf content ahead of a compact collections action", () => {
    expect(source).toContain("buildLibraryBookPresentation");
    expect(source).toContain('data-library-shelf="true"');
    expect(source).toContain('data-library-collections="true"');
    expect(source).not.toContain("collectionEntryRow");
    expect(source).not.toContain("formatBookSize");

    const shelfIndex = source.indexOf('data-library-shelf="true"');
    const collectionsIndex = source.indexOf('data-library-collections="true"');
    expect(shelfIndex).toBeGreaterThan(0);
    expect(collectionsIndex).toBeGreaterThan(shelfIndex);
  });

  it("uses semantic book state and compact progress geometry", () => {
    expect(source).toContain("data-library-book-state={presentation.state}");
    expect(source).toContain('data-library-book-progress="true"');
    expect(source).toContain("presentation.lastReadLabel");
    expect(source).toContain("presentation.sourceLabel");

    const progressRule = rule(".bookListProgressRow");
    const trackRule = rule(".bookListProgressTrack");
    expect(progressRule).toContain("font-size: var(--type-caption)");
    expect(progressRule).toContain("display: flex");
    expect(trackRule).toContain("height: 4px");
  });
});
