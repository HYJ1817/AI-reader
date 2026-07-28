import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createAppNavigationState,
  reduceAppNavigation,
  type AppNavigationAction,
} from "./appNavigation";
import { createAppNavigationStore } from "./appNavigationStore";
import {
  dismissSheetStackWithHistory,
  redirectNavigationHistoryTombstone,
  removeInvalidWithHistory,
} from "../app/useAppNavigation";
import {
  createNavigationHistoryPosition,
  decodeNavigationHistory,
  encodeNavigationHistory,
} from "./navigationHistory";

const providerUrl = new URL("../app/NavigationProvider.tsx", import.meta.url);
const providerSource = existsSync(providerUrl)
  ? readFileSync(providerUrl, "utf8")
  : "";

function createPushAndReaderState() {
  const pushedState = reduceAppNavigation(createAppNavigationState(), {
    type: "push",
    entry: {
      key: "push-1",
      kind: "push",
      route: "ai-providers",
      entityId: "provider-1",
      restoreFocusId: "settings-link",
      scrollTop: 120,
    },
  });
  return reduceAppNavigation(pushedState, {
    type: "present-reader",
    entry: {
      key: "reader-1",
      kind: "reader",
      bookId: "book-1",
      originId: "book-card-1",
    },
  });
}

function createSheetStackState() {
  return reduceAppNavigation(
    reduceAppNavigation(createAppNavigationState(), {
      type: "present-sheet",
      entry: {
        key: "sheet-1",
        kind: "sheet",
        route: "book-actions",
      },
    }),
    {
      type: "present-sheet",
      entry: {
        key: "sheet-2",
        kind: "sheet",
        route: "book-rename",
      },
    }
  );
}

function createFakeHistory(state: unknown) {
  let currentState = state;
  const goCalls: number[] = [];
  const replaceCalls: Array<[unknown, string]> = [];

  return {
    history: {
      get state() {
        return currentState;
      },
      go(delta?: number) {
        goCalls.push(delta ?? 0);
      },
      replaceState(nextState: unknown, title: string) {
        currentState = nextState;
        replaceCalls.push([nextState, title]);
      },
    },
    getState: () => currentState,
    goCalls,
    replaceCalls,
  };
}

function createMemoryHistory(entries: unknown[], initialCursor: number) {
  let cursor = initialCursor;
  let ignoredGoCalls = 0;
  const goCalls: number[] = [];
  const replaceCalls: Array<[unknown, string]> = [];

  return {
    history: {
      get state() {
        return entries[cursor];
      },
      go(delta?: number) {
        goCalls.push(delta ?? 0);
        if (ignoredGoCalls > 0) {
          ignoredGoCalls -= 1;
          return;
        }
        const requestedCursor = cursor + (delta ?? 0);
        cursor = Math.min(entries.length - 1, Math.max(0, requestedCursor));
      },
      replaceState(nextState: unknown, title: string) {
        entries[cursor] = nextState;
        replaceCalls.push([nextState, title]);
      },
    },
    cursor: () => cursor,
    ignoreNextGo: () => {
      ignoredGoCalls += 1;
    },
    goCalls,
    replaceCalls,
  };
}

function restoreMemoryHistory(
  store: ReturnType<typeof createAppNavigationStore>,
  history: ReturnType<typeof createMemoryHistory>
) {
  while (redirectNavigationHistoryTombstone(history.history)) {
    // A tombstone redirects synchronously in this in-memory history.
  }
  const restoredState = decodeNavigationHistory(history.history.state);
  if (!restoredState) throw new Error("expected a navigation history state");
  store.setState(
    reduceAppNavigation(store.getState(), {
      type: "restore",
      state: restoredState,
    })
  );
}

describe("app navigation store", () => {
  it.each([
    [
      "present-sheet",
      createAppNavigationState(),
      {
        type: "present-sheet",
        entry: {
          key: "sheet-1",
          kind: "sheet",
          route: "reading-goal",
        },
      } satisfies AppNavigationAction,
    ],
    [
      "dismiss-sheet",
      reduceAppNavigation(createAppNavigationState(), {
        type: "present-sheet",
        entry: {
          key: "sheet-1",
          kind: "sheet",
          route: "reading-goal",
        },
      }),
      { type: "dismiss-sheet" } satisfies AppNavigationAction,
    ],
    [
      "dismiss-sheet-stack",
      reduceAppNavigation(
        reduceAppNavigation(createAppNavigationState(), {
          type: "present-sheet",
          entry: {
            key: "sheet-1",
            kind: "sheet",
            route: "reading-goal",
          },
        }),
        {
          type: "present-sheet",
          entry: {
            key: "sheet-2",
            kind: "sheet",
            route: "book-actions",
          },
        }
      ),
      { type: "dismiss-sheet-stack" } satisfies AppNavigationAction,
    ],
    [
      "sheet-only remove-invalid",
      reduceAppNavigation(createAppNavigationState(), {
        type: "present-sheet",
        entry: {
          key: "sheet-1",
          kind: "sheet",
          route: "reading-goal",
        },
      }),
      {
        type: "remove-invalid",
        key: "sheet-1",
      } satisfies AppNavigationAction,
    ],
  ])(
    "notifies only full subscribers for %s",
    (_name, initialState, action) => {
      const store = createAppNavigationStore(initialState);
      const initialCoreSnapshot = store.getCoreSnapshot();
      let fullNotifications = 0;
      let coreNotifications = 0;

      store.subscribe(() => {
        fullNotifications += 1;
      });
      store.subscribeCore(() => {
        coreNotifications += 1;
      });

      const nextState = reduceAppNavigation(initialState, action);
      store.setState(nextState);

      expect(store.getState()).toBe(nextState);
      expect(fullNotifications).toBe(1);
      expect(coreNotifications).toBe(0);
      expect(store.getCoreSnapshot()).toBe(initialCoreSnapshot);
    }
  );

  it("updates the core snapshot and notifies core subscribers for every core field", () => {
    const store = createAppNavigationStore(createAppNavigationState());
    let fullNotifications = 0;
    let coreNotifications = 0;
    store.subscribe(() => {
      fullNotifications += 1;
    });
    store.subscribeCore(() => {
      coreNotifications += 1;
    });

    const actions: AppNavigationAction[] = [
      { type: "select-tab", tab: "settings" },
      {
        type: "push",
        entry: {
          key: "push-1",
          kind: "push",
          route: "ai-providers",
        },
      },
      {
        type: "present-reader",
        entry: {
          key: "reader-1",
          kind: "reader",
          bookId: "book-1",
        },
      },
    ];

    for (const [index, action] of actions.entries()) {
      const previousCoreSnapshot = store.getCoreSnapshot();
      const nextState = reduceAppNavigation(store.getState(), action);

      store.setState(nextState);

      expect(store.getCoreSnapshot()).not.toBe(previousCoreSnapshot);
      expect(coreNotifications).toBe(index + 1);
      expect(fullNotifications).toBe(index + 1);
    }

    store.setState(store.getState());
    expect(coreNotifications).toBe(actions.length);
    expect(fullNotifications).toBe(actions.length);
  });

  it("preserves the core snapshot when popstate restores a cloned state that only dismisses a sheet", () => {
    const historyState = createPushAndReaderState();
    const currentState = reduceAppNavigation(historyState, {
      type: "present-sheet",
      entry: {
        key: "sheet-1",
        kind: "sheet",
        route: "book-actions",
        entityId: "book-1",
      },
    });
    const store = createAppNavigationStore(currentState);
    const initialCoreSnapshot = store.getCoreSnapshot();
    let fullNotifications = 0;
    let coreNotifications = 0;
    store.subscribe(() => {
      fullNotifications += 1;
    });
    store.subscribeCore(() => {
      coreNotifications += 1;
    });

    const clonedHistoryState = structuredClone(historyState);
    const restoredState = reduceAppNavigation(currentState, {
      type: "restore",
      state: clonedHistoryState,
    });
    store.setState(restoredState);

    expect(restoredState.sheets).toEqual([]);
    expect(store.getState()).toBe(restoredState);
    expect(fullNotifications).toBe(1);
    expect(coreNotifications).toBe(0);
    expect(store.getCoreSnapshot()).toBe(initialCoreSnapshot);
  });

  it.each(["push route", "reader book"] as const)(
    "notifies core subscribers when a cloned %s field really changes",
    (field) => {
      const currentState = createPushAndReaderState();
      const store = createAppNavigationStore(currentState);
      const initialCoreSnapshot = store.getCoreSnapshot();
      let coreNotifications = 0;
      store.subscribeCore(() => {
        coreNotifications += 1;
      });

      const nextState = structuredClone(currentState);
      if (field === "push route") {
        nextState.pushes[0] = {
          ...nextState.pushes[0],
          route: "collections",
        };
      } else if (nextState.reader) {
        nextState.reader = { ...nextState.reader, bookId: "book-2" };
      }
      store.setState(nextState);

      expect(coreNotifications).toBe(1);
      expect(store.getCoreSnapshot()).not.toBe(initialCoreSnapshot);
    }
  );

  it("dismisses a valid two-sheet history stack by its exact depth", () => {
    const initialState = createSheetStackState();
    const store = createAppNavigationStore(initialState);
    const history = createFakeHistory(encodeNavigationHistory(initialState));

    dismissSheetStackWithHistory(store, history.history);

    expect(store.getState()).toMatchObject({
      sheets: [],
      direction: "backward",
    });
    expect(history.goCalls).toEqual([-2]);
    expect(history.replaceCalls).toEqual([]);
  });

  it("replaces invalid history with the dismissed stack while retaining history fields", () => {
    const store = createAppNavigationStore(createSheetStackState());
    const history = createFakeHistory({
      __NA: true,
      retained: { scroll: 120 },
    });

    dismissSheetStackWithHistory(store, history.history);

    expect(store.getState()).toMatchObject({
      sheets: [],
      direction: "backward",
    });
    expect(history.goCalls).toEqual([]);
    expect(history.replaceCalls).toHaveLength(1);
    expect(history.replaceCalls[0]?.[1]).toBe("");
    expect(history.getState()).toMatchObject({
      __NA: true,
      retained: { scroll: 120 },
      version: 1,
    });
    expect(decodeNavigationHistory(history.getState())).toMatchObject({
      sheets: [],
    });
  });

  it("does nothing when there are no sheets to dismiss", () => {
    const store = createAppNavigationStore(createAppNavigationState());
    const initialState = store.getState();
    const history = createFakeHistory(encodeNavigationHistory(initialState));
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    dismissSheetStackWithHistory(store, history.history);

    expect(store.getState()).toBe(initialState);
    expect(notifications).toBe(0);
    expect(history.goCalls).toEqual([]);
    expect(history.replaceCalls).toEqual([]);
  });

  it("dismisses sheets without history effects during SSR", () => {
    const store = createAppNavigationStore(createSheetStackState());

    expect(() => dismissSheetStackWithHistory(store)).not.toThrow();
    expect(store.getState()).toMatchObject({
      sheets: [],
      direction: "backward",
    });
  });

  it("aligns sheet invalidation with its retained history prefix", () => {
    const h0 = createAppNavigationState();
    const h1 = reduceAppNavigation(h0, {
      type: "present-sheet",
      entry: { key: "sheet-1", kind: "sheet", route: "book-actions" },
    });
    const h2 = reduceAppNavigation(h1, {
      type: "present-sheet",
      entry: { key: "sheet-2", kind: "sheet", route: "book-rename" },
    });
    const h3 = reduceAppNavigation(h2, {
      type: "present-sheet",
      entry: { key: "sheet-3", kind: "sheet", route: "book-delete" },
    });
    const p0 = createNavigationHistoryPosition(h0, 0);
    const p1 = createNavigationHistoryPosition(h1, 1, p0);
    const p2 = createNavigationHistoryPosition(h2, 2, p1);
    const p3 = createNavigationHistoryPosition(h3, 3, p2);
    const store = createAppNavigationStore(h3);
    const history = createMemoryHistory(
      [
        encodeNavigationHistory(h0, p0),
        encodeNavigationHistory(h1, p1),
        encodeNavigationHistory(h2, p2),
        encodeNavigationHistory(h3, p3),
      ],
      3
    );

    removeInvalidWithHistory(store, "sheet-3", history.history);

    expect(history.goCalls).toEqual([-1]);
    expect(history.cursor()).toBe(2);
    restoreMemoryHistory(store, history);
    expect(store.getState().sheets.map((sheet) => sheet.key)).toEqual([
      "sheet-1",
      "sheet-2",
    ]);

    history.history.go(1);
    expect(history.cursor()).toBe(3);
    restoreMemoryHistory(store, history);
    expect(history.cursor()).toBe(2);
    expect(store.getState().sheets.map((sheet) => sheet.key)).toEqual([
      "sheet-1",
      "sheet-2",
    ]);

    dismissSheetStackWithHistory(store, history.history);
    expect(history.goCalls).toEqual([-1, 1, -1, -2]);
    expect(history.cursor()).toBe(0);
    restoreMemoryHistory(store, history);
    expect(store.getState().sheets).toEqual([]);
  });

  it.each([
    ["reader-1", 2, 1],
    ["push-1", 3, 0],
  ])(
    "moves invalid %s removal to its surviving ancestor",
    (invalidKey, expectedDepth, expectedCursor) => {
      const h0 = createAppNavigationState();
      const h1 = reduceAppNavigation(h0, {
        type: "push",
        entry: { key: "push-1", kind: "push", route: "collections" },
      });
      const h2 = reduceAppNavigation(h1, {
        type: "present-reader",
        entry: { key: "reader-1", kind: "reader", bookId: "book-1" },
      });
      const h3 = reduceAppNavigation(h2, {
        type: "present-sheet",
        entry: { key: "sheet-1", kind: "sheet", route: "book-actions" },
      });
      const p0 = createNavigationHistoryPosition(h0, 0);
      const p1 = createNavigationHistoryPosition(h1, 1, p0);
      const p2 = createNavigationHistoryPosition(h2, 2, p1);
      const p3 = createNavigationHistoryPosition(h3, 3, p2);
      const store = createAppNavigationStore(h3);
      const history = createMemoryHistory(
        [
          encodeNavigationHistory(h0, p0),
          encodeNavigationHistory(h1, p1),
          encodeNavigationHistory(h2, p2),
          encodeNavigationHistory(h3, p3),
        ],
        3
      );

      removeInvalidWithHistory(store, invalidKey, history.history);

      expect(history.goCalls).toEqual([-expectedDepth]);
      expect(history.cursor()).toBe(expectedCursor);
      restoreMemoryHistory(store, history);
      expect(store.getState().sheets).toEqual([]);
      if (invalidKey === "reader-1") {
        expect(store.getState().reader).toBeNull();
        expect(store.getState().pushes.map((push) => push.key)).toEqual([
          "push-1",
        ]);
      } else {
        expect(store.getState().reader).toBeNull();
        expect(store.getState().pushes).toEqual([]);
      }
    }
  );

  it("removes a reader that replaced a sheet stack to the prior sheet cursor", () => {
    const h0 = createAppNavigationState();
    const h1 = reduceAppNavigation(h0, {
      type: "present-sheet",
      entry: { key: "sheet-1", kind: "sheet", route: "book-actions" },
    });
    const h2 = reduceAppNavigation(h1, {
      type: "present-sheet",
      entry: { key: "sheet-2", kind: "sheet", route: "book-rename" },
    });
    const replaced = reduceAppNavigation(h2, {
      type: "present-reader",
      entry: { key: "reader-1", kind: "reader", bookId: "book-1" },
    });
    const p0 = createNavigationHistoryPosition(h0, 0);
    const p1 = createNavigationHistoryPosition(h1, 1, p0);
    const p2 = createNavigationHistoryPosition(h2, 2, p1);
    const replacedPosition = createNavigationHistoryPosition(replaced, 2, p2);
    const store = createAppNavigationStore(replaced);
    const history = createMemoryHistory(
      [
        encodeNavigationHistory(h0, p0),
        encodeNavigationHistory(h1, p1),
        encodeNavigationHistory(replaced, replacedPosition),
      ],
      2
    );

    removeInvalidWithHistory(store, "reader-1", history.history);

    expect(history.goCalls).toEqual([-1]);
    expect(history.cursor()).toBe(1);
    restoreMemoryHistory(store, history);
    expect(store.getState().reader).toBeNull();
    expect(store.getState().sheets.map((sheet) => sheet.key)).toEqual([
      "sheet-1",
    ]);
  });

  it("replaces invalid history and leaves an absent invalid key untouched", () => {
    const initialState = createSheetStackState();
    const store = createAppNavigationStore(initialState);
    const history = createFakeHistory({ retained: true });

    removeInvalidWithHistory(store, "sheet-2", history.history);

    expect(history.goCalls).toEqual([]);
    expect(history.replaceCalls).toHaveLength(1);
    expect(history.replaceCalls[0]?.[1]).toBe("");
    expect(decodeNavigationHistory(history.getState())).toMatchObject({
      sheets: [{ key: "sheet-1" }],
    });

    const recoveredState = store.getState();
    removeInvalidWithHistory(store, "missing", history.history);
    expect(store.getState()).toBe(recoveredState);
    expect(history.goCalls).toEqual([]);
    expect(history.replaceCalls).toHaveLength(1);
  });

  it("uses the absolute cursor after a removal go is ignored", () => {
    const h0 = createAppNavigationState();
    const h1 = reduceAppNavigation(h0, {
      type: "present-sheet",
      entry: { key: "sheet-1", kind: "sheet", route: "book-actions" },
    });
    const h2 = reduceAppNavigation(h1, {
      type: "present-sheet",
      entry: { key: "sheet-2", kind: "sheet", route: "book-rename" },
    });
    const h3 = reduceAppNavigation(h2, {
      type: "present-sheet",
      entry: { key: "sheet-3", kind: "sheet", route: "book-delete" },
    });
    const p0 = createNavigationHistoryPosition(h0, 0);
    const p1 = createNavigationHistoryPosition(h1, 1, p0);
    const p2 = createNavigationHistoryPosition(h2, 2, p1);
    const p3 = createNavigationHistoryPosition(h3, 3, p2);
    const store = createAppNavigationStore(h3);
    const history = createMemoryHistory(
      [
        encodeNavigationHistory(h0, p0),
        encodeNavigationHistory(h1, p1),
        encodeNavigationHistory(h2, p2),
        encodeNavigationHistory(h3, p3),
      ],
      3
    );

    history.ignoreNextGo();
    removeInvalidWithHistory(store, "sheet-3", history.history);
    expect(history.cursor()).toBe(3);
    expect(store.getState().sheets.map((sheet) => sheet.key)).toEqual([
      "sheet-1",
      "sheet-2",
    ]);

    dismissSheetStackWithHistory(store, history.history);
    expect(history.goCalls).toEqual([-1, -3]);
    expect(history.cursor()).toBe(0);
    restoreMemoryHistory(store, history);
    expect(store.getState().sheets).toEqual([]);
  });

  it("exposes full navigation state through the navigation provider", () => {
    expect(providerSource).toContain("export function useNavigationState");
    expect(providerSource).toContain("const value = useNavigation()");
    expect(providerSource).toContain("value.subscribe");
    expect(providerSource).toContain("value.getState");
  });
});
