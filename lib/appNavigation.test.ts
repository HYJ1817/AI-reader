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

  it("presents library search above the current root and restores it on pop", () => {
    const reading = reduceAppNavigation(createAppNavigationState(), {
      type: "select-tab",
      tab: "reading",
    });
    const searching = reduceAppNavigation(reading, {
      type: "push",
      entry: {
        key: "push-library-search-1",
        kind: "push",
        route: "library-search",
        restoreFocusId: "library-search-button",
      },
    });

    expect(searching.activeTab).toBe("reading");
    expect(searching.pushes.at(-1)?.route).toBe("library-search");
    expect(reduceAppNavigation(searching, { type: "pop" }).activeTab).toBe(
      "reading"
    );
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

  it("presents a book-owned reading workspace as a routed sheet", () => {
    const state = reduceAppNavigation(createAppNavigationState(), {
      type: "present-sheet",
      entry: {
        key: "workspace-sheet",
        kind: "sheet",
        route: "reading-workspace",
        entityId: "book-1",
      },
    });

    expect(state.sheets.at(-1)).toMatchObject({
      route: "reading-workspace",
      entityId: "book-1",
    });
  });

  it("replaces the current sheet without retaining a stale transition source", () => {
    const bookActions = reduceAppNavigation(createAppNavigationState(), {
      type: "present-sheet",
      entry: { key: "actions", kind: "sheet", route: "book-actions", entityId: "book-1" },
    });
    const workspace = reduceAppNavigation(bookActions, {
      type: "replace-sheet",
      entry: { key: "workspace", kind: "sheet", route: "reading-workspace", entityId: "book-1" },
    });
    expect(workspace.sheets).toHaveLength(1);
    expect(workspace.sheets[0]).toMatchObject({ route: "reading-workspace", entityId: "book-1" });
    expect(workspace.direction).toBe("replace");
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

  it("dismisses the complete sheet stack without changing lower layers", () => {
    const state: AppNavigationState = {
      ...createAppNavigationState(),
      pushes: [{ key: "push-1", kind: "push", route: "collections" }],
      reader: { key: "reader-1", kind: "reader", bookId: "book-1" },
      sheets: [
        { key: "sheet-1", kind: "sheet", route: "book-actions" },
        { key: "sheet-2", kind: "sheet", route: "book-rename" },
      ],
    };

    const dismissed = reduceAppNavigation(state, {
      type: "dismiss-sheet-stack",
    });

    expect(dismissed.sheets).toEqual([]);
    expect(dismissed.pushes).toBe(state.pushes);
    expect(dismissed.reader).toBe(state.reader);
    expect(dismissed.direction).toBe("backward");
  });

  it("cascades an invalid push through reader and sheet layers", () => {
    const state: AppNavigationState = {
      activeTab: "library",
      pushes: [
        { key: "keep", kind: "push", route: "collections" },
        { key: "invalid-push", kind: "push", route: "custom-background" },
      ],
      reader: {
        key: "reader-1",
        kind: "reader",
        bookId: "book-1",
      },
      sheets: [
        { key: "sheet-1", kind: "sheet", route: "book-actions" },
        { key: "sheet-2", kind: "sheet", route: "toc" },
      ],
      direction: "forward",
      revision: 5,
    };

    const recovered = reduceAppNavigation(state, {
      type: "remove-invalid",
      key: "invalid-push",
    });

    expect(recovered.pushes.map((entry) => entry.key)).toEqual(["keep"]);
    expect(recovered.reader).toBeNull();
    expect(recovered.sheets).toEqual([]);
    expect(recovered.direction).toBe("backward");
  });

  it("cascades an invalid reader through sheet layers", () => {
    const state: AppNavigationState = {
      ...createAppNavigationState(),
      pushes: [{ key: "push-1", kind: "push", route: "collections" }],
      reader: { key: "invalid-reader", kind: "reader", bookId: "book-1" },
      sheets: [
        { key: "sheet-1", kind: "sheet", route: "book-actions" },
        { key: "sheet-2", kind: "sheet", route: "book-rename" },
      ],
    };

    const recovered = reduceAppNavigation(state, {
      type: "remove-invalid",
      key: "invalid-reader",
    });

    expect(recovered.pushes).toBe(state.pushes);
    expect(recovered.reader).toBeNull();
    expect(recovered.sheets).toEqual([]);
  });

  it("removes an invalid sheet and every sheet above it", () => {
    const state: AppNavigationState = {
      ...createAppNavigationState(),
      pushes: [{ key: "push-1", kind: "push", route: "collections" }],
      reader: { key: "reader-1", kind: "reader", bookId: "book-1" },
      sheets: [
        { key: "sheet-1", kind: "sheet", route: "book-actions" },
        { key: "sheet-2", kind: "sheet", route: "book-rename" },
        { key: "sheet-3", kind: "sheet", route: "book-delete" },
      ],
    };

    const recovered = reduceAppNavigation(state, {
      type: "remove-invalid",
      key: "sheet-2",
    });

    expect(recovered.sheets.map((entry) => entry.key)).toEqual(["sheet-1"]);
    expect(recovered.pushes).toBe(state.pushes);
    expect(recovered.reader).toBe(state.reader);
  });

  it.each([
    ["middle", "push-2", ["push-1"]],
    ["first", "push-1", []],
  ])(
    "removes an invalid %s push and every dependent descendant",
    (_position, invalidKey, expectedKeys) => {
      const state: AppNavigationState = {
        ...createAppNavigationState(),
        pushes: [
          { key: "push-1", kind: "push", route: "collections" },
          { key: "push-2", kind: "push", route: "ai-providers" },
          {
            key: "push-3",
            kind: "push",
            route: "ai-provider-configure",
          },
        ],
      };

      const recovered = reduceAppNavigation(state, {
        type: "remove-invalid",
        key: invalidKey,
      });

      expect(recovered.pushes.map((entry) => entry.key)).toEqual(expectedKeys);
    }
  );

  it("does not change state for a key that is absent from every layer", () => {
    const state: AppNavigationState = {
      ...createAppNavigationState(),
      pushes: [{ key: "push-1", kind: "push", route: "collections" }],
      reader: { key: "reader-1", kind: "reader", bookId: "book-1" },
      sheets: [{ key: "sheet-1", kind: "sheet", route: "book-actions" }],
    };

    expect(
      reduceAppNavigation(state, { type: "remove-invalid", key: "missing" })
    ).toBe(state);
  });

  it("does not revise an empty stack for a no-op pop or dismiss", () => {
    const state = createAppNavigationState();

    expect(reduceAppNavigation(state, { type: "pop" })).toBe(state);
    expect(reduceAppNavigation(state, { type: "dismiss-reader" })).toBe(state);
    expect(reduceAppNavigation(state, { type: "dismiss-sheet" })).toBe(state);
    expect(reduceAppNavigation(state, { type: "dismiss-sheet-stack" })).toBe(
      state
    );
  });
});
