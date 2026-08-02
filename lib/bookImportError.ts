import { UI_TEXT } from "./uiText";

export function getBookImportErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === "indexeddb-unavailable") {
    return UI_TEXT.ERROR_LOCAL_STORAGE_UNAVAILABLE;
  }

  if (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  ) {
    return UI_TEXT.ERROR_STORAGE_FULL;
  }

  return UI_TEXT.ERROR_INVALID_BOOK_FILE;
}
