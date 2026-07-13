import { describe, expect, it } from "vitest";
import {
  createAppNavigationState,
  reduceAppNavigation,
  type AppNavigationState,
} from "./appNavigation";

describe("app navigation", () => {
  it("selects a root without pushing", () => {
    const state = reduceAppNavigation(createAppNavigationState(), {
      type: "select-tab",
      tab: "settings",
    });

    expect(state.activeTab).toBe("settings");
    expect(state.pushes).toEqual([]);
    expect(state.direction).toBe("replace");
  });

  it("clears transient sheets when selecting a root", () => {
    const withSheet: AppNavigationState = {
      ...createAppNavigationState(),
      sheets: [
        { key: "sheet-1", kind: "sheet", route: "reading-goal" },
      ],
    };

    const selected = reduceAppNavigation(withSheet, {
      type: "select-tab",
      tab: "library",
    });

    expect(selected.sheets).toEqual([]);
    expect(selected.revision).toBe(1);
  });

  it("pushes and pops with direction", () => {
    const pushed = reduceAppNavigation(createAppNavigationState(), {
      type: "push",
      entry: { key: "push-1", kind: "push", route: "collections" },
    });

    expect(pushed.direction).toBe("forward");
    const popped = reduceAppNavigation(pushed, { type: "pop" });
    expect(popped.pushes).toEqual([]);
    expect(popped.direction).toBe("backward");
  });

  it("keeps reader and sheets in separate layers", () => {
    const reader = reduceAppNavigation(createAppNavigationState(), {
      type: "present-reader",
      entry: { key: "reader-1", kind: "reader", bookId: "book-1" },
    });
    const sheet = reduceAppNavigation(reader, {
      type: "present-sheet",
      entry: { key: "sheet-1", kind: "sheet", route: "ask-ai" },
    });

    expect(sheet.reader?.bookId).toBe("book-1");
    expect(sheet.sheets.at(-1)?.route).toBe("ask-ai");
  });

  it("pops sheets before readers and readers before pushed pages", () => {
    const layered: AppNavigationState = {
      activeTab: "library",
      pushes: [
        { key: "push-1", kind: "push", route: "collections" },
      ],
      reader: {
        key: "reader-1",
        kind: "reader",
        bookId: "book-1",
      },
      sheets: [
        { key: "sheet-1", kind: "sheet", route: "reader-settings" },
      ],
      direction: "forward",
      revision: 3,
    };

    const withoutSheet = reduceAppNavigation(layered, { type: "pop" });
    expect(withoutSheet.sheets).toEqual([]);
    expect(withoutSheet.reader?.key).toBe("reader-1");
    expect(withoutSheet.pushes).toHaveLength(1);

    const withoutReader = reduceAppNavigation(withoutSheet, { type: "pop" });
    expect(withoutReader.reader).toBeNull();
    expect(withoutReader.pushes).toHaveLength(1);

    const withoutPush = reduceAppNavigation(withoutReader, { type: "pop" });
    expect(withoutPush.pushes).toEqual([]);
  });

  it("clears transient sheets when presenting or dismissing a reader", () => {
    const withSheet = reduceAppNavigation(createAppNavigationState(), {
      type: "present-sheet",
      entry: { key: "sheet-1", kind: "sheet", route: "book-actions" },
    });
    const reader = reduceAppNavigation(withSheet, {
      type: "present-reader",
      entry: { key: "reader-1", kind: "reader", bookId: "book-1" },
    });

    expect(reader.sheets).toEqual([]);

    const sheetAboveReader = reduceAppNavigation(reader, {
      type: "present-sheet",
      entry: { key: "sheet-2", kind: "sheet", route: "toc" },
    });
    const dismissed = reduceAppNavigation(sheetAboveReader, {
      type: "dismiss-reader",
    });

    expect(dismissed.reader).toBeNull();
    expect(dismissed.sheets).toEqual([]);
  });

  it("restores a snapshot as backward navigation with a fresh revision", () => {
    const current = reduceAppNavigation(createAppNavigationState(), {
      type: "push",
      entry: { key: "push-1", kind: "push", route: "collections" },
    });
    const snapshot: AppNavigationState = {
      ...createAppNavigationState(),
      activeTab: "reading",
      revision: 40,
    };

    const restored = reduceAppNavigation(current, {
      type: "restore",
      state: snapshot,
    });

    expect(restored.activeTab).toBe("reading");
    expect(restored.direction).toBe("backward");
    expect(restored.revision).toBe(current.revision + 1);
  });

  it("removes an invalid entry from every possible layer", () => {
    const state: AppNavigationState = {
      activeTab: "library",
      pushes: [
        { key: "keep", kind: "push", route: "collections" },
        { key: "invalid", kind: "push", route: "custom-background" },
      ],
      reader: {
        key: "invalid",
        kind: "reader",
        bookId: "missing-book",
      },
      sheets: [
        { key: "invalid", kind: "sheet", route: "book-actions" },
        { key: "sheet-keep", kind: "sheet", route: "toc" },
      ],
      direction: "forward",
      revision: 5,
    };

    const recovered = reduceAppNavigation(state, {
      type: "remove-invalid",
      key: "invalid",
    });

    expect(recovered.pushes.map((entry) => entry.key)).toEqual(["keep"]);
    expect(recovered.reader).toBeNull();
    expect(recovered.sheets.map((entry) => entry.key)).toEqual(["sheet-keep"]);
    expect(recovered.direction).toBe("backward");
  });

  it("does not revise an empty stack for a no-op pop or dismiss", () => {
    const state = createAppNavigationState();

    expect(reduceAppNavigation(state, { type: "pop" })).toBe(state);
    expect(reduceAppNavigation(state, { type: "dismiss-reader" })).toBe(state);
    expect(reduceAppNavigation(state, { type: "dismiss-sheet" })).toBe(state);
  });
});
