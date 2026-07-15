import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../app/LibrarySurface.tsx", import.meta.url),
  "utf8"
);
const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  expect(match, `Missing CSS rule for ${selector}`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("featured Library reading", () => {
  it("uses one native continuation target and the shared cover origin", () => {
    expect(source).toContain('data-library-featured="true"');
    expect(source).toContain('type="button"');
    expect(source.match(/className=\{styles\.libraryFeaturedButton\}/g)).toHaveLength(1);
    expect(source).toContain('`library-${view.mode}-${featuredBook.id}`');
    expect(source).toContain("UI_TEXT.CONTINUE_READING");
    expect(source).toContain("UI_TEXT.OTHER_BOOKS");
    expect(source).toContain("<MotionBookCover");
    expect(source).toContain("actions.pressBook(featuredBook, featuredOriginId)");
    expect(source).not.toContain("ReactBits");
    expect(source).not.toContain("gsap");
  });

  it("bounds state motion and keeps a reduced-motion branch", () => {
    expect(source).toContain("<AnimatePresence initial={false}");
    expect(source).toContain("{ opacity: 0, y: 8 }");
    expect(source).toContain("duration: MOTION_DURATION.state");
    expect(source).toContain("duration: MOTION_DURATION.reduced");
  });

  it("uses theme tokens, readable geometry, and visible focus", () => {
    const feature = rule(".libraryFeaturedButton");
    const cover = rule(".libraryFeaturedButton .motionBookCover");
    const focus = rule(".libraryFeaturedButton:focus-visible");
    expect(feature).toContain("background: color-mix");
    expect(feature).toContain("min-height: 44px");
    expect(cover).toContain("width: 104px");
    expect(focus).toContain("outline: 3px solid var(--focus-ring)");
    expect(focus).toContain("outline-offset: 2px");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".libraryFeaturedButton:not(:disabled):active");
  });
});
