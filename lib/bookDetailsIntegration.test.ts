import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const pushSurfaces = readFileSync(
  new URL("../app/AppPushSurfaces.tsx", import.meta.url),
  "utf8"
);
const details = readFileSync(
  new URL("../app/BookDetailsSurface.tsx", import.meta.url),
  "utf8"
);
const epub = readFileSync(new URL("../app/EpubReader.tsx", import.meta.url), "utf8");
const integrationHook = readFileSync(
  new URL("../app/useBookDetailsIntegration.ts", import.meta.url),
  "utf8"
);

describe("book details app integration", () => {
  it("routes a library press to details without hydrating reader bytes", () => {
    expect(page).toContain('navigation.push("book-details"');
    const handler = page.slice(
      page.indexOf("function handleBookPress"),
      page.indexOf("function handleSelectAllVisible")
    );
    expect(handler).not.toContain("openBookForReading");
    expect(pushSurfaces).toContain('case "book-details"');
  });

  it("keeps details in the ambient and Dock visibility rules", () => {
    expect(integrationHook).toContain('topPushRoute === "book-details"');
    expect(integrationHook).toContain("detailBook ?? latestBook ?? null");
    expect(integrationHook).toContain('topPushRoute === "library-search" || bookDetailsOpen');
  });

  it("opens the reader from the detail cover transition source", () => {
    expect(details).toContain("onRead(detailOriginId)");
    expect(page).toContain("openBookForReading(detailBook, originId)");
  });

  it("waits for the matching EPUB TOC before presenting the sheet", () => {
    const tocChange = epub.indexOf("onTocChangeRef.current?.(");
    const tocReady = epub.indexOf("onTocReadyRef.current?.(bookId)", tocChange);
    expect(tocChange).toBeGreaterThan(-1);
    expect(tocReady).toBeGreaterThan(tocChange);
    expect(integrationHook).toContain("pendingTocBookIdRef.current !== bookId");
    expect(integrationHook).toContain("navigation.getState().reader?.bookId !== bookId");
  });

  it("keeps metadata controls accessible", () => {
    expect(details).toContain('role="menu"');
    expect(details).toContain('aria-live="polite"');
    expect(details.match(/<h1>/g)).toHaveLength(1);
  });
});
