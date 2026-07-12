"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
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
  decodeNavigationHistory,
  encodeNavigationHistory,
} from "@/lib/navigationHistory";
import type { NavigationTab } from "@/lib/navigationMotion";

type PushOptions = Omit<PushEntry, "key" | "kind" | "route">;
type ReaderOptions = Omit<ReaderEntry, "key" | "kind" | "bookId">;
type SheetOptions = Omit<SheetEntry, "key" | "kind" | "route">;
type HistoryWrite = "push" | "replace";

export type UseAppNavigationResult = {
  state: AppNavigationState;
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
  const [state, dispatch] = useReducer(
    reduceAppNavigation,
    createAppNavigationState()
  );
  const stateRef = useRef(state);
  const historyInitializedRef = useRef(false);
  const keyCounterRef = useRef(0);
  const keyPrefix = useId();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const nextKey = useCallback((kind: "push" | "reader" | "sheet") => {
    keyCounterRef.current =
      Math.max(keyCounterRef.current, stateRef.current.revision) + 1;
    return `${keyPrefix}-${kind}-${keyCounterRef.current}`;
  }, [keyPrefix]);

  const restore = useCallback(
    (restoredState: AppNavigationState): AppNavigationState => {
      const action: AppNavigationAction = {
        type: "restore",
        state: restoredState,
      };
      const nextState = reduceAppNavigation(stateRef.current, action);
      stateRef.current = nextState;
      dispatch(action);
      return nextState;
    },
    []
  );

  useEffect(() => {
    if (!historyInitializedRef.current) {
      const restoredState = decodeNavigationHistory(window.history.state);

      if (restoredState) {
        restore(restoredState);
      } else {
        window.history.replaceState(
          encodeNavigationHistory(stateRef.current),
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
          encodeNavigationHistory(nextState),
          ""
        );
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [restore]);

  const commit = useCallback(
    (action: AppNavigationAction, historyWrite: HistoryWrite) => {
      const nextState = reduceAppNavigation(stateRef.current, action);
      if (nextState === stateRef.current) return;

      if (typeof window !== "undefined") {
        const payload = encodeNavigationHistory(nextState);
        if (historyWrite === "push") {
          window.history.pushState(payload, "");
        } else {
          window.history.replaceState(payload, "");
        }
      }

      stateRef.current = nextState;
      dispatch(action);
    },
    []
  );

  const traverseBack = useCallback((action: AppNavigationAction) => {
    const nextState = reduceAppNavigation(stateRef.current, action);
    if (nextState === stateRef.current) return;

    if (
      typeof window !== "undefined" &&
      decodeNavigationHistory(window.history.state)
    ) {
      window.history.back();
      return;
    }

    stateRef.current = nextState;
    if (typeof window !== "undefined") {
      window.history.replaceState(
        encodeNavigationHistory(nextState),
        ""
      );
    }
    dispatch(action);
  }, []);

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
        "push"
      );
    },
    [commit, nextKey]
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
    ]
  );
}
