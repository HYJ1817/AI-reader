import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

describe("book rename integration", () => {
  it("registers and renders the rename sheet from book actions", () => {
    const navigation = readSource("lib/appNavigation.ts");
    const history = readSource("lib/navigationHistory.ts");
    const overlays = readSource("app/AppOverlays.tsx");

    expect(navigation).toContain('| "book-rename"');
    expect(history).toContain('"book-rename"');
    expect(overlays).toContain('case "book-rename"');
    expect(overlays).toContain("<BookRenameSheet");
    expect(overlays).toContain('navigation.presentSheet("book-rename"');
  });

  it("persists the display title and refreshes metadata", () => {
    const page = readSource("app/page.tsx");

    expect(page).toContain("await renameBook(bookId, title)");
    expect(page).toContain("setBooks(await listBookMetadata())");
  });

  it("provides localized labels and blank-title validation", () => {
    const uiText = readSource("lib/uiText.ts");
    const overlays = readSource("app/AppOverlays.tsx");

    expect(uiText).toContain('RENAME_BOOK: "\\u91cd\\u547d\\u540d\\u4e66\\u7c4d"');
    expect(uiText).toContain('BOOK_TITLE_REQUIRED: "\\u8bf7\\u8f93\\u5165\\u4e66\\u540d"');
    expect(overlays).toContain("UI_TEXT.BOOK_TITLE_REQUIRED");
    expect(overlays).toContain('event.key === "Enter"');
  });
});
