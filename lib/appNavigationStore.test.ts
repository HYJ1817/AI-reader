import { describe, expect, it } from "vitest";
import {
  createAppNavigationState,
  reduceAppNavigation,
  type AppNavigationAction,
} from "./appNavigation";
import { createAppNavigationStore } from "./appNavigationStore";

describe("app navigation store", () => {
  it("notifies full subscribers without changing the core snapshot for sheet-only state", () => {
    const initialState = createAppNavigationState();
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

    const nextState = reduceAppNavigation(initialState, {
      type: "present-sheet",
      entry: {
        key: "sheet-1",
        kind: "sheet",
        route: "reading-goal",
      },
    });
    store.setState(nextState);

    expect(store.getState()).toBe(nextState);
    expect(fullNotifications).toBe(1);
    expect(coreNotifications).toBe(0);
    expect(store.getCoreSnapshot()).toBe(initialCoreSnapshot);
  });

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
});
