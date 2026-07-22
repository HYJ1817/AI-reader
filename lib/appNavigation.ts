import type { NavigationTab } from "./navigationMotion";

export type PushRoute =
  | "collections"
  | "ai-providers"
  | "ai-provider-configure"
  | "custom-background";

export type SheetRoute =
  | "reader-settings"
  | "reader-custom-settings"
  | "toc"
  | "ask-ai"
  | "reading-goal"
  | "book-actions"
  | "book-rename"
  | "book-delete"
  | "book-groups"
  | "batch-groups"
  | "batch-delete"
  | "collection-create";

export type PushEntry = {
  key: string;
  kind: "push";
  route: PushRoute;
  entityId?: string;
  restoreFocusId?: string;
  scrollTop?: number;
};

export type ReaderEntry = {
  key: string;
  kind: "reader";
  bookId: string;
  originId?: string;
};

export type SheetEntry = {
  key: string;
  kind: "sheet";
  route: SheetRoute;
  entityId?: string;
  restoreFocusId?: string;
};

export type NavigationDirection = "forward" | "backward" | "replace";

export type AppNavigationState = {
  activeTab: NavigationTab;
  pushes: PushEntry[];
  reader: ReaderEntry | null;
  sheets: SheetEntry[];
  direction: NavigationDirection;
  revision: number;
};

export type AppNavigationAction =
  | { type: "select-tab"; tab: NavigationTab }
  | { type: "push"; entry: PushEntry }
  | { type: "pop" }
  | { type: "present-reader"; entry: ReaderEntry }
  | { type: "dismiss-reader" }
  | { type: "present-sheet"; entry: SheetEntry }
  | { type: "dismiss-sheet" }
  | { type: "restore"; state: AppNavigationState }
  | { type: "remove-invalid"; key: string };

export function createAppNavigationState(): AppNavigationState {
  return {
    activeTab: "library",
    pushes: [],
    reader: null,
    sheets: [],
    direction: "replace",
    revision: 0,
  };
}

function next(
  state: AppNavigationState,
  patch: Partial<AppNavigationState>,
  direction: NavigationDirection
): AppNavigationState {
  return {
    ...state,
    ...patch,
    direction,
    revision: state.revision + 1,
  };
}

export function reduceAppNavigation(
  state: AppNavigationState,
  action: AppNavigationAction
): AppNavigationState {
  switch (action.type) {
    case "select-tab":
      if (
        state.activeTab === action.tab &&
        state.pushes.length === 0 &&
        state.sheets.length === 0
      ) {
        return state;
      }
      return next(
        state,
        { activeTab: action.tab, pushes: [], sheets: [] },
        "replace"
      );
    case "push":
      return next(
        state,
        { pushes: [...state.pushes, action.entry] },
        "forward"
      );
    case "pop":
      if (state.sheets.length > 0) {
        return next(
          state,
          { sheets: state.sheets.slice(0, -1) },
          "backward"
        );
      }
      if (state.reader) {
        return next(state, { reader: null }, "backward");
      }
      if (state.pushes.length > 0) {
        return next(
          state,
          { pushes: state.pushes.slice(0, -1) },
          "backward"
        );
      }
      return state;
    case "present-reader":
      return next(
        state,
        { reader: action.entry, sheets: [] },
        "forward"
      );
    case "dismiss-reader":
      if (!state.reader && state.sheets.length === 0) return state;
      return next(state, { reader: null, sheets: [] }, "backward");
    case "present-sheet":
      return next(
        state,
        { sheets: [...state.sheets, action.entry] },
        "forward"
      );
    case "dismiss-sheet":
      if (state.sheets.length === 0) return state;
      return next(
        state,
        { sheets: state.sheets.slice(0, -1) },
        "backward"
      );
    case "restore":
      return {
        ...action.state,
        direction: "backward",
        revision: state.revision + 1,
      };
    case "remove-invalid": {
      const pushes = state.pushes.filter(
        (entry) => entry.key !== action.key
      );
      const reader =
        state.reader?.key === action.key ? null : state.reader;
      const sheets = state.sheets.filter(
        (entry) => entry.key !== action.key
      );

      if (
        pushes.length === state.pushes.length &&
        reader === state.reader &&
        sheets.length === state.sheets.length
      ) {
        return state;
      }

      return next(state, { pushes, reader, sheets }, "backward");
    }
  }
}
