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
  go: (delta?: number) => void;
  replaceState: (data: unknown, title: string) => void;
};

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
  history?: NavigationHistoryAdapter
): void {
  const currentState = store.getState();
  const depth = currentState.sheets.length;
  if (depth === 0) return;

  const nextState = reduceAppNavigation(currentState, {
    type: "dismiss-sheet-stack",
  });

  if (history && decodeNavigationHistory(history.state)) {
    const position = getHistoryPosition(history, currentState);
    const targetCursor = getHistoryTargetCursor(
      currentState,
      nextState,
      position.cursor,
      position.entryCursors
    );
    store.setState(nextState);
    history.go(targetCursor - position.cursor);
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
  history?: NavigationHistoryAdapter
): void {
  const currentState = store.getState();
  const nextState = reduceAppNavigation(currentState, {
    type: "remove-invalid",
    key,
  });
  if (nextState === currentState) return;

  if (history && decodeNavigationHistory(history.state)) {
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
    history.go(targetCursor - position.cursor);
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
  history: NavigationHistoryAdapter
): boolean {
  const position = decodeNavigationHistoryPosition(history.state);
  if (
    !position ||
    position.redirectTargetCursor === undefined ||
    position.redirectTargetCursor >= position.cursor
  ) {
    return false;
  }

  history.go(position.redirectTargetCursor - position.cursor);
  return true;
}

function traverseBackWithHistory(
  store: NavigationCommandStore,
  action: AppNavigationAction,
  history?: NavigationHistoryAdapter
): void {
  const currentState = store.getState();
  const nextState = reduceAppNavigation(currentState, action);
  if (nextState === currentState) return;

  if (history && decodeNavigationHistory(history.state)) {
    const position = getHistoryPosition(history, currentState);
    const targetCursor = getHistoryTargetCursor(
      currentState,
      nextState,
      position.cursor,
      position.entryCursors
    );
    const delta = targetCursor - position.cursor;
    if (delta < 0) {
      history.go(delta);
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
  const state = useSyncExternalStore(
    store.subscribeCore,
    store.getCoreSnapshot,
    store.getCoreSnapshot
  );
  const historyInitializedRef = useRef(false);
  const keyCounterRef = useRef(0);
  const keyPrefix = useId();

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
        redirectNavigationHistoryTombstone(window.history);
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
      const nextState = restore(restoredState ?? createAppNavigationState());

      if (restoredState) {
        redirectNavigationHistoryTombstone(window.history);
      } else {
        window.history.replaceState(
          mergeNavigationHistory(
            window.history.state,
            nextState,
            deriveNavigationHistoryPosition(nextState)
          ),
          ""
        );
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [restore, store]);

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
      traverseBackWithHistory(
        store,
        action,
        typeof window === "undefined" ? undefined : window.history
      );
    },
    [store]
  );

  const selectTab = useCallback(
    (tab: NavigationTab) => {
      commit({ type: "select-tab", tab }, "replace");
    },
    [commit]
  );

  const push = useCallback(
    (route: PushRoute, options?: PushOptions) => {
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
      );
    },
    [commit, nextKey]
  );

  const pop = useCallback(() => {
    traverseBack({ type: "pop" });
  }, [traverseBack]);

  const presentReader = useCallback(
    (bookId: string, options?: ReaderOptions) => {
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
    },
    [commit, nextKey, store]
  );

  const dismissReader = useCallback(() => {
    traverseBack({ type: "dismiss-reader" });
  }, [traverseBack]);

  const presentSheet = useCallback(
    (route: SheetRoute, options?: SheetOptions) => {
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
      );
    },
    [commit, nextKey]
  );

  const dismissSheet = useCallback(() => {
    traverseBack({ type: "dismiss-sheet" });
  }, [traverseBack]);

  const dismissSheetStack = useCallback(() => {
    dismissSheetStackWithHistory(
      store,
      typeof window === "undefined" ? undefined : window.history
    );
  }, [store]);

  const replaceSheet = useCallback(
    (route: SheetRoute, options?: SheetOptions) => {
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
      );
    },
    [commit, nextKey]
  );

  const removeInvalid = useCallback(
    (key: string) => {
      removeInvalidWithHistory(
        store,
        key,
        typeof window === "undefined" ? undefined : window.history
      );
    },
    [store]
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
