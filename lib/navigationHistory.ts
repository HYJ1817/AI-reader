import type {
  AppNavigationState,
  NavigationDirection,
  PushEntry,
  PushRoute,
  ReaderEntry,
  SheetEntry,
  SheetRoute,
} from "./appNavigation";
import type { NavigationTab } from "./navigationMotion";

const HISTORY_APP = "ai-reader";
const HISTORY_VERSION = 1;

export type NavigationHistoryPosition = {
  cursor: number;
  entryCursors: Record<string, number>;
  redirectTargetCursor?: number;
};

const NAVIGATION_TABS = ["library", "reading", "settings"] as const satisfies readonly NavigationTab[];
const NAVIGATION_DIRECTIONS = ["forward", "backward", "replace"] as const satisfies readonly NavigationDirection[];
const PUSH_ROUTES = [
  "collections",
  "library-search",
  "ai-providers",
  "ai-provider-configure",
  "custom-background",
] as const satisfies readonly PushRoute[];
const SHEET_ROUTES = [
  "reader-settings",
  "reader-custom-settings",
  "toc",
  "ask-ai",
  "reading-goal",
  "book-actions",
  "book-rename",
  "book-delete",
  "book-groups",
  "reading-workspace",
  "batch-groups",
  "batch-delete",
  "collection-create",
] as const satisfies readonly SheetRoute[];

type HistoryV1 = {
  app: typeof HISTORY_APP;
  version: typeof HISTORY_VERSION;
  state: AppNavigationState;
  position?: NavigationHistoryPosition;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isPushEntry(value: unknown): value is PushEntry {
  if (!isRecord(value)) return false;

  return (
    isNonEmptyString(value.key) &&
    value.kind === "push" &&
    PUSH_ROUTES.includes(value.route as PushRoute) &&
    isOptionalString(value.entityId) &&
    isOptionalString(value.restoreFocusId) &&
    (value.scrollTop === undefined ||
      (typeof value.scrollTop === "number" &&
        Number.isFinite(value.scrollTop) &&
        value.scrollTop >= 0))
  );
}

function isReaderEntry(value: unknown): value is ReaderEntry {
  if (!isRecord(value)) return false;

  return (
    isNonEmptyString(value.key) &&
    value.kind === "reader" &&
    isNonEmptyString(value.bookId) &&
    isOptionalString(value.originId)
  );
}

function isSheetEntry(value: unknown): value is SheetEntry {
  if (!isRecord(value)) return false;

  return (
    isNonEmptyString(value.key) &&
    value.kind === "sheet" &&
    SHEET_ROUTES.includes(value.route as SheetRoute) &&
    isOptionalString(value.entityId) &&
    isOptionalString(value.restoreFocusId)
  );
}

function isAppNavigationState(value: unknown): value is AppNavigationState {
  if (!isRecord(value)) return false;

  return (
    NAVIGATION_TABS.includes(value.activeTab as NavigationTab) &&
    Array.isArray(value.pushes) &&
    value.pushes.every(isPushEntry) &&
    (value.reader === null || isReaderEntry(value.reader)) &&
    Array.isArray(value.sheets) &&
    value.sheets.every(isSheetEntry) &&
    NAVIGATION_DIRECTIONS.includes(
      value.direction as NavigationDirection
    ) &&
    typeof value.revision === "number" &&
    Number.isSafeInteger(value.revision) &&
    value.revision >= 0
  );
}

function getNavigationEntryKeys(state: AppNavigationState): string[] {
  return [
    ...state.pushes.map((entry) => entry.key),
    ...(state.reader ? [state.reader.key] : []),
    ...state.sheets.map((entry) => entry.key),
  ];
}

function isNavigationHistoryPosition(
  value: unknown,
  state: AppNavigationState
): value is NavigationHistoryPosition {
  if (!isRecord(value)) return false;
  const cursor = value.cursor;
  if (
    typeof cursor !== "number" ||
    !Number.isSafeInteger(cursor) ||
    cursor < 0
  ) {
    return false;
  }
  const entryCursors = value.entryCursors;
  if (!isRecord(entryCursors)) return false;

  const entryKeys = getNavigationEntryKeys(state);
  const cursorKeys = Object.keys(entryCursors);
  if (
    new Set(entryKeys).size !== entryKeys.length ||
    cursorKeys.length !== entryKeys.length ||
    cursorKeys.some((key) => !entryKeys.includes(key))
  ) {
    return false;
  }
  if (
    cursorKeys.some((key) => {
      const entryCursor = entryCursors[key];
      return (
        typeof entryCursor !== "number" ||
        !Number.isSafeInteger(entryCursor) ||
        entryCursor < 0 ||
        entryCursor > cursor
      );
    })
  ) {
    return false;
  }

  const redirectTargetCursor = value.redirectTargetCursor;
  return (
    redirectTargetCursor === undefined ||
    (typeof redirectTargetCursor === "number" &&
      Number.isSafeInteger(redirectTargetCursor) &&
      redirectTargetCursor >= 0 &&
      redirectTargetCursor <= cursor)
  );
}

export function deriveNavigationHistoryPosition(
  state: AppNavigationState
): NavigationHistoryPosition {
  let cursor = 0;
  const entryCursors: Record<string, number> = {};
  for (const key of getNavigationEntryKeys(state)) {
    cursor += 1;
    entryCursors[key] = cursor;
  }
  return { cursor, entryCursors };
}

export function createNavigationHistoryPosition(
  state: AppNavigationState,
  cursor: number,
  previous?: NavigationHistoryPosition
): NavigationHistoryPosition {
  const entryCursors: Record<string, number> = {};
  for (const key of getNavigationEntryKeys(state)) {
    entryCursors[key] = previous?.entryCursors[key] ?? cursor;
  }
  return { cursor, entryCursors };
}

export function encodeNavigationHistory(
  state: AppNavigationState,
  position?: NavigationHistoryPosition
): HistoryV1 {
  return {
    app: HISTORY_APP,
    version: HISTORY_VERSION,
    state,
    ...(position ? { position } : {}),
  };
}

export function mergeNavigationHistory(
  current: unknown,
  state: AppNavigationState,
  position?: NavigationHistoryPosition
): HistoryV1 & Record<string, unknown> {
  const payload = encodeNavigationHistory(state);
  if (!isRecord(current)) {
    return position ? { ...payload, position } : payload;
  }

  const preserved = { ...current };
  delete preserved.position;
  return position ? { ...preserved, ...payload, position } : { ...preserved, ...payload };
}

export function decodeNavigationHistory(
  value: unknown
): AppNavigationState | null {
  if (!isRecord(value)) return null;
  if (value.app !== HISTORY_APP || value.version !== HISTORY_VERSION) {
    return null;
  }

  return isAppNavigationState(value.state) ? value.state : null;
}

export function decodeNavigationHistoryPosition(
  value: unknown
): NavigationHistoryPosition | null {
  const state = decodeNavigationHistory(value);
  if (!state) return null;

  if (hasNavigationHistoryPosition(value)) {
    return value.position;
  }

  return deriveNavigationHistoryPosition(state);
}

export function hasNavigationHistoryPosition(
  value: unknown
): value is Record<string, unknown> & { position: NavigationHistoryPosition } {
  const state = decodeNavigationHistory(value);
  return (
    state !== null &&
    isRecord(value) &&
    isNavigationHistoryPosition(value.position, state)
  );
}
