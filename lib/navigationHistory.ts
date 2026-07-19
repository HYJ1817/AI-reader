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

const NAVIGATION_TABS = ["library", "reading", "settings"] as const satisfies readonly NavigationTab[];
const NAVIGATION_DIRECTIONS = ["forward", "backward", "replace"] as const satisfies readonly NavigationDirection[];
const PUSH_ROUTES = [
  "collections",
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
  "book-delete",
  "book-groups",
  "batch-groups",
  "batch-delete",
  "collection-create",
] as const satisfies readonly SheetRoute[];

type HistoryV1 = {
  app: typeof HISTORY_APP;
  version: typeof HISTORY_VERSION;
  state: AppNavigationState;
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

export function encodeNavigationHistory(
  state: AppNavigationState
): HistoryV1 {
  return {
    app: HISTORY_APP,
    version: HISTORY_VERSION,
    state,
  };
}

export function mergeNavigationHistory(
  current: unknown,
  state: AppNavigationState
): HistoryV1 & Record<string, unknown> {
  const payload = encodeNavigationHistory(state);
  return isRecord(current) ? { ...current, ...payload } : payload;
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
