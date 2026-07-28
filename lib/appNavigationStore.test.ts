import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createAppNavigationState,
  reduceAppNavigation,
  type AppNavigationAction,
} from "./appNavigation";
import { createAppNavigationStore } from "./appNavigationStore";
import { dismissSheetStackWithHistory } from "../app/useAppNavigation";
import {
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

  it("exposes full navigation state through the navigation provider", () => {
    expect(providerSource).toContain("export function useNavigationState");
    expect(providerSource).toContain("const value = useNavigation()");
    expect(providerSource).toContain("value.subscribe");
    expect(providerSource).toContain("value.getState");
  });
});
