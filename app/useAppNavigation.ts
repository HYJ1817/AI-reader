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
} from "@/lib/appNavigation";
import {
  createAppNavigationStore,
  type AppNavigationCoreState,
  type AppNavigationStore,
} from "@/lib/appNavigationStore";
import {
  decodeNavigationHistory,
  mergeNavigationHistory,
} from "@/lib/navigationHistory";
import type { NavigationTab } from "@/lib/navigationMotion";

type PushOptions = Omit<PushEntry, "key" | "kind" | "route">;
type ReaderOptions = Omit<ReaderEntry, "key" | "kind" | "bookId">;
type SheetOptions = Omit<SheetEntry, "key" | "kind" | "route">;
type HistoryWrite = "push" | "replace";

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
  dismissSheet: () => void;
  removeInvalid: (key: string) => void;
};

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
      } else {
        window.history.replaceState(
          mergeNavigationHistory(
            window.history.state,
            store.getState()
          ),
          ""
        );
      }

      historyInitializedRef.current = true;
    }

    const handlePopState = (event: PopStateEvent) => {
      const restoredState = decodeNavigationHistory(event.state);
      const nextState = restore(
        restoredState ?? createAppNavigationState()
      );

      if (!restoredState) {
        window.history.replaceState(
          mergeNavigationHistory(window.history.state, nextState),
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
        const payload = mergeNavigationHistory(
          window.history.state,
          nextState
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

  const traverseBack = useCallback((action: AppNavigationAction) => {
    const currentState = store.getState();
    const nextState = reduceAppNavigation(currentState, action);
    if (nextState === currentState) return;

    if (
      typeof window !== "undefined" &&
      decodeNavigationHistory(window.history.state)
    ) {
      window.history.back();
      return;
    }

    store.setState(nextState);
    if (typeof window !== "undefined") {
      window.history.replaceState(
        mergeNavigationHistory(window.history.state, nextState),
        ""
      );
    }
  }, [store]);

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

  const removeInvalid = useCallback(
    (key: string) => {
      commit({ type: "remove-invalid", key }, "replace");
    },
    [commit]
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
      dismissSheet,
      removeInvalid,
    }),
    [
      dismissReader,
      dismissSheet,
      pop,
      presentReader,
      presentSheet,
      push,
      removeInvalid,
      selectTab,
      state,
      store,
    ]
  );
}
