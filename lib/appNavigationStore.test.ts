import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createAppNavigationState,
  reduceAppNavigation,
  type AppNavigationAction,
} from "./appNavigation";
import { createAppNavigationStore } from "./appNavigationStore";
import {
  createNavigationTraversalCoordinator,
  dismissSheetStackWithHistory,
  getNavigationTraversalCoordinator,
  redirectNavigationHistoryTombstone,
  removeInvalidWithHistory,
  traverseBackWithHistory,
} from "../app/useAppNavigation";
import {
  createNavigationHistoryPosition,
  decodeNavigationHistory,
  decodeNavigationHistoryPosition,
  deriveNavigationHistoryPosition,
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
  const pushCalls: unknown[] = [];
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
      pushState(nextState: unknown) {
        entries.splice(cursor + 1);
        entries.push(nextState);
        cursor += 1;
        pushCalls.push(nextState);
      },
    },
    cursor: () => cursor,
    ignoreNextGo: () => {
      ignoredGoCalls += 1;
    },
    goCalls,
    pushCalls,
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
    const history = createFakeHistory(
      encodeNavigationHistory(
        initialState,
        deriveNavigationHistoryPosition(initialState)
      )
    );

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

  it("serializes two back intents until each asynchronous target popstate settles", () => {
    const h0 = createAppNavigationState();
    const h1 = reduceAppNavigation(h0, {
      type: "present-sheet",
      entry: { key: "sheet-1", kind: "sheet", route: "book-actions" },
    });
    const h2 = reduceAppNavigation(h1, {
      type: "present-sheet",
      entry: { key: "sheet-2", kind: "sheet", route: "book-rename" },
    });
    const p0 = createNavigationHistoryPosition(h0, 0);
    const p1 = createNavigationHistoryPosition(h1, 1, p0);
    const p2 = createNavigationHistoryPosition(h2, 2, p1);
    const store = createAppNavigationStore(h2);
    const history = createMemoryHistory(
      [
        encodeNavigationHistory(h0, p0),
        encodeNavigationHistory(h1, p1),
        encodeNavigationHistory(h2, p2),
      ],
      2
    );
    const coordinator = createNavigationTraversalCoordinator();
    const observer = {
      start: coordinator.begin,
      cancel: coordinator.cancel,
    };

    coordinator.enqueue(() =>
      traverseBackWithHistory(store, { type: "pop" }, history.history, observer)
    );
    coordinator.enqueue(() =>
      traverseBackWithHistory(store, { type: "pop" }, history.history, observer)
    );

    expect(history.goCalls).toEqual([-1]);
    expect(history.cursor()).toBe(1);

    restoreMemoryHistory(store, history);
    coordinator.settle(
      coordinator.getPending(),
      decodeNavigationHistoryPosition(history.history.state)?.cursor
    );

    expect(history.goCalls).toEqual([-1, -1]);
    expect(history.cursor()).toBe(0);
    restoreMemoryHistory(store, history);
    coordinator.settle(
      coordinator.getPending(),
      decodeNavigationHistoryPosition(history.history.state)?.cursor
    );
    expect(store.getState().sheets).toEqual([]);
    expect(coordinator.isPending()).toBe(false);
  });

  it("queues a push until the preceding back popstate restores its source", () => {
    const h0 = createAppNavigationState();
    const h1 = reduceAppNavigation(h0, {
      type: "present-sheet",
      entry: { key: "sheet-1", kind: "sheet", route: "book-actions" },
    });
    const h2 = reduceAppNavigation(h1, {
      type: "present-sheet",
      entry: { key: "sheet-2", kind: "sheet", route: "book-rename" },
    });
    const p0 = createNavigationHistoryPosition(h0, 0);
    const p1 = createNavigationHistoryPosition(h1, 1, p0);
    const p2 = createNavigationHistoryPosition(h2, 2, p1);
    const store = createAppNavigationStore(h2);
    const history = createMemoryHistory(
      [
        encodeNavigationHistory(h0, p0),
        encodeNavigationHistory(h1, p1),
        encodeNavigationHistory(h2, p2),
      ],
      2
    );
    const coordinator = createNavigationTraversalCoordinator();
    const observer = {
      start: coordinator.begin,
      cancel: coordinator.cancel,
    };
    let pushed = false;

    coordinator.enqueue(() =>
      traverseBackWithHistory(store, { type: "pop" }, history.history, observer)
    );
    coordinator.enqueue(() => {
      const next = reduceAppNavigation(store.getState(), {
        type: "present-sheet",
        entry: { key: "sheet-3", kind: "sheet", route: "book-delete" },
      });
      const position = createNavigationHistoryPosition(
        next,
        2,
        decodeNavigationHistoryPosition(history.history.state) ?? undefined
      );
      store.setState(next);
      history.history.pushState(encodeNavigationHistory(next, position));
      pushed = true;
    });

    expect(pushed).toBe(false);
    expect(history.pushCalls).toEqual([]);
    restoreMemoryHistory(store, history);
    coordinator.settle(
      coordinator.getPending(),
      decodeNavigationHistoryPosition(history.history.state)?.cursor
    );

    expect(pushed).toBe(true);
    expect(history.cursor()).toBe(2);
    expect(store.getState().sheets.map((sheet) => sheet.key)).toEqual([
      "sheet-1",
      "sheet-3",
    ]);
  });

  it("queues a replace until the preceding back popstate restores its source", () => {
    const h0 = createAppNavigationState();
    const h1 = reduceAppNavigation(h0, {
      type: "present-sheet",
      entry: { key: "sheet-1", kind: "sheet", route: "book-actions" },
    });
    const h2 = reduceAppNavigation(h1, {
      type: "present-sheet",
      entry: { key: "sheet-2", kind: "sheet", route: "book-rename" },
    });
    const p0 = createNavigationHistoryPosition(h0, 0);
    const p1 = createNavigationHistoryPosition(h1, 1, p0);
    const p2 = createNavigationHistoryPosition(h2, 2, p1);
    const store = createAppNavigationStore(h2);
    const history = createMemoryHistory(
      [
        encodeNavigationHistory(h0, p0),
        encodeNavigationHistory(h1, p1),
        encodeNavigationHistory(h2, p2),
      ],
      2
    );
    const coordinator = createNavigationTraversalCoordinator();
    const observer = { start: coordinator.begin, cancel: coordinator.cancel };

    coordinator.enqueue(() =>
      traverseBackWithHistory(store, { type: "pop" }, history.history, observer)
    );
    coordinator.enqueue(() => {
      const next = reduceAppNavigation(store.getState(), {
        type: "replace-sheet",
        entry: { key: "sheet-3", kind: "sheet", route: "book-delete" },
      });
      store.setState(next);
      history.history.replaceState(
        encodeNavigationHistory(
          next,
          createNavigationHistoryPosition(
            next,
            1,
            decodeNavigationHistoryPosition(history.history.state) ?? undefined
          )
        ),
        ""
      );
    });

    expect(store.getState().sheets.map((sheet) => sheet.key)).toEqual([
      "sheet-1",
      "sheet-2",
    ]);
    restoreMemoryHistory(store, history);
    coordinator.settle(
      coordinator.getPending(),
      decodeNavigationHistoryPosition(history.history.state)?.cursor
    );
    expect(store.getState().sheets.map((sheet) => sheet.key)).toEqual([
      "sheet-3",
    ]);
    expect(history.cursor()).toBe(1);
  });

  it("holds queued commands while a forward tombstone redirects to safety", () => {
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
    const coordinator = createNavigationTraversalCoordinator();
    const observer = { start: coordinator.begin, cancel: coordinator.cancel };

    removeInvalidWithHistory(store, "sheet-3", history.history, observer);
    restoreMemoryHistory(store, history);
    coordinator.settle(
      coordinator.getPending(),
      decodeNavigationHistoryPosition(history.history.state)?.cursor
    );
    history.history.go(1);
    expect(redirectNavigationHistoryTombstone(history.history, observer)).toBe(
      true
    );
    let executed = false;
    coordinator.enqueue(() => {
      executed = true;
    });

    expect(executed).toBe(false);
    expect(history.cursor()).toBe(2);
    restoreMemoryHistory(store, history);
    coordinator.settle(
      coordinator.getPending(),
      decodeNavigationHistoryPosition(history.history.state)?.cursor
    );
    expect(executed).toBe(true);
  });

  it("drains queued work on cleanup and cancels an explicit go no-op", () => {
    const coordinator = createNavigationTraversalCoordinator();
    const traversal = coordinator.begin(2, 1);
    let executed = false;
    coordinator.enqueue(() => {
      executed = true;
    });
    coordinator.drain();
    coordinator.settle(traversal, 1);
    expect(executed).toBe(false);

    const state = createSheetStackState();
    const store = createAppNavigationStore(state);
    const history = createFakeHistory(
      encodeNavigationHistory(state, deriveNavigationHistoryPosition(state))
    );
    history.history.go = () => false;
    const noOpCoordinator = createNavigationTraversalCoordinator();
    dismissSheetStackWithHistory(store, history.history, {
      start: noOpCoordinator.begin,
      cancel: noOpCoordinator.cancel,
    });
    expect(noOpCoordinator.isPending()).toBe(false);
    expect(traversal.targetCursor).toBe(1);
  });

  it("traverses a legacy v1 single-sheet dismissal and settles at its derived target", () => {
    const h0 = createAppNavigationState();
    const h1 = reduceAppNavigation(h0, {
      type: "present-sheet",
      entry: { key: "sheet-1", kind: "sheet", route: "book-actions" },
    });
    const h2 = reduceAppNavigation(h1, {
      type: "present-sheet",
      entry: { key: "sheet-2", kind: "sheet", route: "book-rename" },
    });
    const store = createAppNavigationStore(h2);
    const history = createMemoryHistory(
      [h0, h1, h2].map(encodeNavigationHistory),
      2
    );
    const coordinator = createNavigationTraversalCoordinator();
    const observer = { start: coordinator.request, cancel: coordinator.cancel };

    traverseBackWithHistory(
      store,
      { type: "dismiss-sheet" },
      history.history,
      observer
    );
    coordinator.enqueue(() =>
      dismissSheetStackWithHistory(store, history.history, observer)
    );

    expect(history.goCalls).toEqual([-1]);
    expect(history.cursor()).toBe(1);
    expect(store.getState()).toBe(h2);
    restoreMemoryHistory(store, history);
    coordinator.settle(
      coordinator.getPending(),
      decodeNavigationHistoryPosition(history.history.state)?.cursor
    );
    expect(history.goCalls).toEqual([-1, -1]);
    expect(history.cursor()).toBe(0);
    restoreMemoryHistory(store, history);
    coordinator.settle(
      coordinator.getPending(),
      decodeNavigationHistoryPosition(history.history.state)?.cursor
    );
    expect(store.getState().sheets).toEqual([]);
    expect(coordinator.isPending()).toBe(false);
  });

  it("traverses a legacy v1 sheet stack by its full derived depth", () => {
    const h0 = createAppNavigationState();
    const h1 = reduceAppNavigation(h0, {
      type: "present-sheet",
      entry: { key: "sheet-1", kind: "sheet", route: "book-actions" },
    });
    const h2 = reduceAppNavigation(h1, {
      type: "present-sheet",
      entry: { key: "sheet-2", kind: "sheet", route: "book-rename" },
    });
    const store = createAppNavigationStore(h2);
    const history = createMemoryHistory(
      [h0, h1, h2].map(encodeNavigationHistory),
      2
    );
    const coordinator = createNavigationTraversalCoordinator();

    dismissSheetStackWithHistory(store, history.history, {
      start: coordinator.request,
      cancel: coordinator.cancel,
    });

    expect(history.goCalls).toEqual([-2]);
    expect(history.cursor()).toBe(0);
  });

  it("upgrades a legacy invalid removal to a tombstone before forward redirect", () => {
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
    const store = createAppNavigationStore(h3);
    const history = createMemoryHistory(
      [h0, h1, h2, h3].map(encodeNavigationHistory),
      3
    );
    const coordinator = createNavigationTraversalCoordinator();
    const observer = { start: coordinator.request, cancel: coordinator.cancel };

    removeInvalidWithHistory(store, "sheet-3", history.history, observer);
    expect(history.goCalls).toEqual([-1]);
    expect(history.cursor()).toBe(2);
    restoreMemoryHistory(store, history);
    coordinator.settle(
      coordinator.getPending(),
      decodeNavigationHistoryPosition(history.history.state)?.cursor
    );

    history.history.go(1);
    expect(redirectNavigationHistoryTombstone(history.history, observer)).toBe(
      true
    );
    expect(history.goCalls).toEqual([-1, 1, -1]);
  });

  it("drains queued commands without replacing an in-flight traversal", () => {
    const coordinator = createNavigationTraversalCoordinator();
    const first = coordinator.begin(2, 1);
    let dropped = false;
    let queuedAfterSetup = false;
    coordinator.enqueue(() => {
      dropped = true;
    });
    coordinator.drain();
    coordinator.enqueue(() => {
      queuedAfterSetup = true;
    });

    expect(coordinator.getPending()).toEqual(first);
    expect(dropped).toBe(false);
    expect(queuedAfterSetup).toBe(false);
    coordinator.settle(first, 1);
    expect(queuedAfterSetup).toBe(true);
  });

  it("disposes an old coordinator without letting its late event settle a new one", () => {
    const oldCoordinator = createNavigationTraversalCoordinator();
    const oldTraversal = oldCoordinator.begin(2, 1);
    oldCoordinator.dispose();
    const newCoordinator = createNavigationTraversalCoordinator();
    const newTraversal = newCoordinator.begin(2, 1);
    let executed = false;
    newCoordinator.enqueue(() => {
      executed = true;
    });

    oldCoordinator.settle(oldTraversal, 1);
    expect(executed).toBe(false);
    expect(newCoordinator.isPending()).toBe(true);
    newCoordinator.settle(newTraversal, 1);
    expect(executed).toBe(true);
  });

  it("rebases an invalid popstate and flushes queued work from the restored root", () => {
    const coordinator = createNavigationTraversalCoordinator();
    coordinator.begin(2, 1);
    const store = createAppNavigationStore(createSheetStackState());
    let queuedFromRoot = false;
    coordinator.enqueue(() => {
      queuedFromRoot = store.getState().sheets.length === 0;
    });

    store.setState(createAppNavigationState());
    coordinator.rebase();

    expect(coordinator.isPending()).toBe(false);
    expect(queuedFromRoot).toBe(true);
  });

  it("only settles a tombstone-retargeted transaction at its final target", () => {
    const coordinator = createNavigationTraversalCoordinator();
    const firstTarget = coordinator.begin(4, 3);
    const finalTarget = coordinator.begin(3, 1);
    let executed = false;
    coordinator.enqueue(() => {
      executed = true;
    });

    coordinator.settle(firstTarget, 3);
    expect(executed).toBe(false);
    expect(coordinator.isPending()).toBe(true);
    coordinator.settle(finalTarget, 1);
    expect(executed).toBe(true);
  });

  it("shares a pending tombstone traversal across remounts without a second go", () => {
    const history = createFakeHistory({});
    const oldCoordinator = getNavigationTraversalCoordinator(history.history);
    const first = oldCoordinator.request(3, 2);
    if (!first) throw new Error("expected an initial traversal request");
    if (first.shouldNavigate) history.history.go(-1);
    oldCoordinator.drain();

    const newCoordinator = getNavigationTraversalCoordinator(history.history);
    const duplicate = newCoordinator.request(3, 2);
    if (!duplicate) throw new Error("expected a duplicate traversal request");
    if (duplicate.shouldNavigate) history.history.go(-1);

    expect(newCoordinator).toBe(oldCoordinator);
    expect(first.shouldNavigate).toBe(true);
    expect(duplicate.shouldNavigate).toBe(false);
    expect(history.goCalls).toEqual([-1]);
    newCoordinator.settle(duplicate.traversal, 2);
    expect(newCoordinator.isPending()).toBe(false);
  });

  it("keeps intermediate tombstone retargets in one generation but isolates histories", () => {
    const firstHistory = createFakeHistory({});
    const secondHistory = createFakeHistory({});
    const firstCoordinator = getNavigationTraversalCoordinator(
      firstHistory.history
    );
    const initial = firstCoordinator.request(4, 3);
    const retarget = firstCoordinator.request(3, 1);
    const secondCoordinator = getNavigationTraversalCoordinator(
      secondHistory.history
    );

    if (!initial || !retarget) throw new Error("expected traversal requests");
    expect(initial.shouldNavigate).toBe(true);
    expect(retarget.shouldNavigate).toBe(true);
    expect(retarget.traversal.generation).toBe(initial.traversal.generation);
    expect(secondCoordinator).not.toBe(firstCoordinator);
  });

  it("keeps SSR-local coordinators isolated without shared history ownership", () => {
    const first = createNavigationTraversalCoordinator();
    const second = createNavigationTraversalCoordinator();

    expect(first).not.toBe(second);
  });

  it("exposes full navigation state through the navigation provider", () => {
    expect(providerSource).toContain("export function useNavigationState");
    expect(providerSource).toContain("const value = useNavigation()");
    expect(providerSource).toContain("value.subscribe");
    expect(providerSource).toContain("value.getState");
  });
});
