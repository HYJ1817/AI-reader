"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  createAppNavigationState,
  reduceAppNavigation,
  type AppNavigationAction,
  type AppNavigationState,
  type PushEntry,
  type PushRoute,
  type ReaderEntry,
  type SheetEntry,
  type SheetRoute,
} from "../lib/appNavigation";
import {
  createAppNavigationStore,
  type AppNavigationCoreState,
  type AppNavigationStore,
} from "../lib/appNavigationStore";
import {
  createNavigationHistoryPosition,
  decodeNavigationHistory,
  decodeNavigationHistoryPosition,
  deriveNavigationHistoryPosition,
  hasNavigationHistoryPosition,
  mergeNavigationHistory,
} from "../lib/navigationHistory";
import type { NavigationTab } from "../lib/navigationMotion";

type PushOptions = Omit<PushEntry, "key" | "kind" | "route">;
type ReaderOptions = Omit<ReaderEntry, "key" | "kind" | "bookId">;
type SheetOptions = Omit<SheetEntry, "key" | "kind" | "route">;
type HistoryWrite = "push" | "replace";

export type NavigationCommandStore = Pick<
  AppNavigationStore,
  "getState" | "setState"
>;

export type NavigationHistoryAdapter = {
  readonly state: unknown;
  go: (delta?: number) => void | boolean;
  replaceState: (data: unknown, title: string) => void;
};

export type NavigationTraversal = {
  sourceCursor: number;
  targetCursor: number;
  generation: number;
};

export type NavigationTraversalObserver = {
  start: (
    sourceCursor: number,
    targetCursor: number
  ) => NavigationTraversal | null;
  cancel: (traversal: NavigationTraversal) => void;
};

export function createNavigationTraversalCoordinator() {
  let pending: NavigationTraversal | null = null;
  let generation = 0;
  let disposed = false;
  let flushing = false;
  const queue: Array<() => void> = [];

  const flush = () => {
    if (flushing || pending) return;
    flushing = true;
    while (!pending && queue.length > 0) {
      queue.shift()?.();
    }
    flushing = false;
  };

  const begin = (sourceCursor: number, targetCursor: number) => {
    if (disposed) return null;
    if (pending) {
      pending = {
        ...pending,
        sourceCursor,
        targetCursor,
      };
      return pending;
    }
    generation += 1;
    const traversal = {
      sourceCursor,
      targetCursor,
      generation,
    };
    pending = traversal;
    return traversal;
  };

  const cancel = (traversal: NavigationTraversal) => {
    if (
      disposed ||
      pending?.generation !== traversal.generation ||
      pending.targetCursor !== traversal.targetCursor
    ) {
      return;
    }
    pending = null;
    generation += 1;
    flush();
  };

  return {
    enqueue(command: () => void) {
      if (disposed) return;
      queue.push(command);
      flush();
    },
    begin,
    cancel,
    settle(traversal: NavigationTraversal | null, cursor: number | undefined) {
      if (
        disposed ||
        !traversal ||
        cursor === undefined ||
        pending?.generation !== traversal.generation ||
        pending.targetCursor !== traversal.targetCursor ||
        cursor !== pending.targetCursor
      ) {
        return;
      }
      pending = null;
      flush();
    },
    drain() {
      queue.splice(0);
    },
    rebase() {
      pending = null;
      generation += 1;
      flush();
    },
    dispose() {
      pending = null;
      queue.splice(0);
      generation += 1;
      disposed = true;
    },
    getPending() {
      return pending;
    },
    isPending() {
      return pending !== null;
    },
  };
}

function getNavigationEntryKeys(state: AppNavigationState): string[] {
  return [
    ...state.pushes.map((entry) => entry.key),
    ...(state.reader ? [state.reader.key] : []),
    ...state.sheets.map((entry) => entry.key),
  ];
}

function getHistoryPosition(
  history: NavigationHistoryAdapter,
  currentState: AppNavigationState
) {
  return (
    decodeNavigationHistoryPosition(history.state) ??
    deriveNavigationHistoryPosition(currentState)
  );
}

function getHistoryTargetCursor(
  currentState: AppNavigationState,
  nextState: AppNavigationState,
  currentCursor: number,
  entryCursors: Record<string, number>
): number {
  const nextKeys = new Set(getNavigationEntryKeys(nextState));
  const removedCursors = getNavigationEntryKeys(currentState)
    .filter((key) => !nextKeys.has(key))
    .map((key) => entryCursors[key])
    .filter((cursor): cursor is number => cursor !== undefined);

  return removedCursors.length > 0
    ? Math.max(0, Math.min(...removedCursors) - 1)
    : currentCursor;
}

function writeNavigationHistory(
  history: NavigationHistoryAdapter,
  state: AppNavigationState,
  position = getHistoryPosition(history, state)
) {
  history.replaceState(mergeNavigationHistory(history.state, state, position), "");
}

function requestHistoryTraversal(
  history: NavigationHistoryAdapter,
  sourceCursor: number,
  targetCursor: number,
  observer?: NavigationTraversalObserver
) {
  const traversal = observer?.start(sourceCursor, targetCursor);
  if (observer && !traversal) return;
  const result = history.go(targetCursor - sourceCursor);
  if (result === false && traversal) {
    observer?.cancel(traversal);
  }
}

export type UseAppNavigationResult = {
  state: AppNavigationCoreState;
  getState: AppNavigationStore["getState"];
  subscribe: AppNavigationStore["subscribe"];
  selectTab: (tab: NavigationTab) => void;
  push: (route: PushRoute, options?: PushOptions) => void;
  pop: () => void;
  presentReader: (bookId: string, options?: ReaderOptions) => void;
  dismissReader: () => void;
  presentSheet: (route: SheetRoute, options?: SheetOptions) => void;
  replaceSheet: (route: SheetRoute, options?: SheetOptions) => void;
  dismissSheet: () => void;
  dismissSheetStack: () => void;
  removeInvalid: (key: string) => void;
};

export function dismissSheetStackWithHistory(
  store: NavigationCommandStore,
  history?: NavigationHistoryAdapter,
  observer?: NavigationTraversalObserver
): void {
  const currentState = store.getState();
  const depth = currentState.sheets.length;
  if (depth === 0) return;

  const nextState = reduceAppNavigation(currentState, {
    type: "dismiss-sheet-stack",
  });

  if (history && hasNavigationHistoryPosition(history.state)) {
    const position = getHistoryPosition(history, currentState);
    const targetCursor = getHistoryTargetCursor(
      currentState,
      nextState,
      position.cursor,
      position.entryCursors
    );
    store.setState(nextState);
    requestHistoryTraversal(history, position.cursor, targetCursor, observer);
    return;
  }

  store.setState(nextState);
  if (history) {
    const previousPosition = deriveNavigationHistoryPosition(currentState);
    writeNavigationHistory(
      history,
      nextState,
      createNavigationHistoryPosition(
        nextState,
        previousPosition.cursor,
        previousPosition
      )
    );
  }
}

export function removeInvalidWithHistory(
  store: NavigationCommandStore,
  key: string,
  history?: NavigationHistoryAdapter,
  observer?: NavigationTraversalObserver
): void {
  const currentState = store.getState();
  const nextState = reduceAppNavigation(currentState, {
    type: "remove-invalid",
    key,
  });
  if (nextState === currentState) return;

  if (history && hasNavigationHistoryPosition(history.state)) {
    const position = getHistoryPosition(history, currentState);
    const targetCursor = getHistoryTargetCursor(
      currentState,
      nextState,
      position.cursor,
      position.entryCursors
    );
    const tombstonePosition = {
      ...createNavigationHistoryPosition(
        nextState,
        position.cursor,
        position
      ),
      redirectTargetCursor: targetCursor,
    };
    store.setState(nextState);
    writeNavigationHistory(history, nextState, tombstonePosition);
    requestHistoryTraversal(history, position.cursor, targetCursor, observer);
    return;
  }

  store.setState(nextState);
  if (history) {
    const previousPosition = deriveNavigationHistoryPosition(currentState);
    const position = createNavigationHistoryPosition(
      nextState,
      previousPosition.cursor,
      previousPosition
    );
    writeNavigationHistory(history, nextState, position);
  }
}

export function redirectNavigationHistoryTombstone(
  history: NavigationHistoryAdapter,
  observer?: NavigationTraversalObserver
): boolean {
  const position = decodeNavigationHistoryPosition(history.state);
  if (
    !hasNavigationHistoryPosition(history.state) ||
    !position ||
    position.redirectTargetCursor === undefined ||
    position.redirectTargetCursor >= position.cursor
  ) {
    return false;
  }

  requestHistoryTraversal(
    history,
    position.cursor,
    position.redirectTargetCursor,
    observer
  );
  return true;
}

export function traverseBackWithHistory(
  store: NavigationCommandStore,
  action: AppNavigationAction,
  history?: NavigationHistoryAdapter,
  observer?: NavigationTraversalObserver
): void {
  const currentState = store.getState();
  const nextState = reduceAppNavigation(currentState, action);
  if (nextState === currentState) return;

  if (history && hasNavigationHistoryPosition(history.state)) {
    const position = getHistoryPosition(history, currentState);
    const targetCursor = getHistoryTargetCursor(
      currentState,
      nextState,
      position.cursor,
      position.entryCursors
    );
    const delta = targetCursor - position.cursor;
    if (delta < 0) {
      requestHistoryTraversal(history, position.cursor, targetCursor, observer);
      return;
    }
  }

  store.setState(nextState);
  if (history) {
    const previousPosition = deriveNavigationHistoryPosition(currentState);
    const position = createNavigationHistoryPosition(
      nextState,
      previousPosition.cursor,
      previousPosition
    );
    writeNavigationHistory(history, nextState, position);
  }
}

export default function useAppNavigation(): UseAppNavigationResult {
  const [store] = useState(() =>
    createAppNavigationStore(createAppNavigationState())
  );
  const [coordinator] = useState(createNavigationTraversalCoordinator);
  const state = useSyncExternalStore(
    store.subscribeCore,
    store.getCoreSnapshot,
    store.getCoreSnapshot
  );
  const historyInitializedRef = useRef(false);
  const keyCounterRef = useRef(0);
  const keyPrefix = useId();
  const traversalObserver = useMemo(
    () => ({ start: coordinator.begin, cancel: coordinator.cancel }),
    [coordinator]
  );
  const scheduleNavigation = useCallback(
    (command: () => void) => {
      coordinator.enqueue(command);
    },
    [coordinator]
  );

  const nextKey = useCallback((kind: "push" | "reader" | "sheet") => {
    keyCounterRef.current =
      Math.max(keyCounterRef.current, store.getState().revision) + 1;
    return `${keyPrefix}-${kind}-${keyCounterRef.current}`;
  }, [keyPrefix, store]);

  const restore = useCallback(
    (restoredState: AppNavigationState): AppNavigationState => {
      const action: AppNavigationAction = {
        type: "restore",
        state: restoredState,
      };
      const nextState = reduceAppNavigation(store.getState(), action);
      store.setState(nextState);
      return nextState;
    },
    [store]
  );

  useEffect(() => {
    if (!historyInitializedRef.current) {
      const restoredState = decodeNavigationHistory(window.history.state);

      if (restoredState) {
        restore(restoredState);
        redirectNavigationHistoryTombstone(window.history, traversalObserver);
      } else {
        window.history.replaceState(
          mergeNavigationHistory(
            window.history.state,
            store.getState(),
            deriveNavigationHistoryPosition(store.getState())
          ),
          ""
        );
      }

      historyInitializedRef.current = true;
    }

    const handlePopState = (event: PopStateEvent) => {
      const restoredState = decodeNavigationHistory(event.state);

      if (restoredState) {
        if (redirectNavigationHistoryTombstone(window.history, traversalObserver)) {
          return;
        }
        restore(restoredState);
        coordinator.settle(
          coordinator.getPending(),
          decodeNavigationHistoryPosition(event.state)?.cursor
        );
      } else {
        const nextState = restore(createAppNavigationState());
        window.history.replaceState(
          mergeNavigationHistory(
            window.history.state,
            nextState,
            deriveNavigationHistoryPosition(nextState)
          ),
          ""
        );
        // One app-issued go has one destination popstate; a later event is
        // external browser navigation and is rebased independently.
        coordinator.rebase();
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      coordinator.drain();
    };
  }, [coordinator, restore, store, traversalObserver]);

  const commit = useCallback(
    (action: AppNavigationAction, historyWrite: HistoryWrite) => {
      const currentState = store.getState();
      const nextState = reduceAppNavigation(currentState, action);
      if (nextState === currentState) return;

      if (typeof window !== "undefined") {
        const currentPosition = getHistoryPosition(window.history, currentState);
        const nextPosition = createNavigationHistoryPosition(
          nextState,
          currentPosition.cursor + (historyWrite === "push" ? 1 : 0),
          currentPosition
        );
        const payload = mergeNavigationHistory(
          window.history.state,
          nextState,
          nextPosition
        );
        if (historyWrite === "push") {
          window.history.pushState(payload, "");
        } else {
          window.history.replaceState(payload, "");
        }
      }

      store.setState(nextState);
    },
    [store]
  );

  const traverseBack = useCallback(
    (action: AppNavigationAction) => {
      scheduleNavigation(() =>
        traverseBackWithHistory(
          store,
          action,
          typeof window === "undefined" ? undefined : window.history,
          traversalObserver
        )
      );
    },
    [scheduleNavigation, store, traversalObserver]
  );

  const selectTab = useCallback(
    (tab: NavigationTab) => {
      scheduleNavigation(() => commit({ type: "select-tab", tab }, "replace"));
    },
    [commit, scheduleNavigation]
  );

  const push = useCallback(
    (route: PushRoute, options?: PushOptions) => {
      scheduleNavigation(() =>
        commit(
          {
            type: "push",
            entry: {
              ...(options ?? {}),
              key: nextKey("push"),
              kind: "push",
              route,
            },
          },
          "push"
        )
      );
    },
    [commit, nextKey, scheduleNavigation]
  );

  const pop = useCallback(() => {
    traverseBack({ type: "pop" });
  }, [traverseBack]);

  const presentReader = useCallback(
    (bookId: string, options?: ReaderOptions) => {
      scheduleNavigation(() => {
        const historyWrite: HistoryWrite =
          store.getState().sheets.length > 0 ? "replace" : "push";
        commit(
          {
            type: "present-reader",
            entry: {
              ...(options ?? {}),
              key: nextKey("reader"),
              kind: "reader",
              bookId,
            },
          },
          historyWrite
        );
      });
    },
    [commit, nextKey, scheduleNavigation, store]
  );

  const dismissReader = useCallback(() => {
    traverseBack({ type: "dismiss-reader" });
  }, [traverseBack]);

  const presentSheet = useCallback(
    (route: SheetRoute, options?: SheetOptions) => {
      scheduleNavigation(() =>
        commit(
          {
            type: "present-sheet",
            entry: {
              ...(options ?? {}),
              key: nextKey("sheet"),
              kind: "sheet",
              route,
            },
          },
          "push"
        )
      );
    },
    [commit, nextKey, scheduleNavigation]
  );

  const dismissSheet = useCallback(() => {
    traverseBack({ type: "dismiss-sheet" });
  }, [traverseBack]);

  const dismissSheetStack = useCallback(() => {
    scheduleNavigation(() =>
      dismissSheetStackWithHistory(
        store,
        typeof window === "undefined" ? undefined : window.history,
        traversalObserver
      )
    );
  }, [scheduleNavigation, store, traversalObserver]);

  const replaceSheet = useCallback(
    (route: SheetRoute, options?: SheetOptions) => {
      scheduleNavigation(() =>
        commit(
          {
            type: "replace-sheet",
            entry: {
              ...(options ?? {}),
              key: nextKey("sheet"),
              kind: "sheet",
              route,
            },
          },
          "replace"
        )
      );
    },
    [commit, nextKey, scheduleNavigation]
  );

  const removeInvalid = useCallback(
    (key: string) => {
      scheduleNavigation(() =>
        removeInvalidWithHistory(
          store,
          key,
          typeof window === "undefined" ? undefined : window.history,
          traversalObserver
        )
      );
    },
    [scheduleNavigation, store, traversalObserver]
  );

  return useMemo(
    () => ({
      state,
      getState: store.getState,
      subscribe: store.subscribe,
      selectTab,
      push,
      pop,
      presentReader,
      dismissReader,
      presentSheet,
      replaceSheet,
      dismissSheet,
      dismissSheetStack,
      removeInvalid,
    }),
    [
      dismissReader,
      dismissSheet,
      dismissSheetStack,
      pop,
      presentReader,
      presentSheet,
      replaceSheet,
      push,
      removeInvalid,
      selectTab,
      state,
      store,
    ]
  );
}
