"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { extractEpubCoverImage } from "@/lib/epubCover";
import {
  listBookMetadata,
  listReadingPositions,
  loadMissingBookCover,
  type BookMetadata,
} from "@/lib/db";
import {
  createBookCoverBackfillRunner,
  mergeBookCoverMetadata,
  runBookCoverBackfill,
} from "@/lib/bookCoverBackfill";
import { hasIndexedDbSupport } from "@/lib/browserStorage";
import { requestPersistentStorage } from "@/lib/storagePersistence";
import {
  buildReadingProgressMap,
  type ReadingProgressMap,
} from "@/lib/libraryProgress";
import { UI_TEXT } from "@/lib/uiText";

type BackfillWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions
  ) => number;
  cancelIdleCallback?: (id: number) => void;
};

function waitForBackfillWindow(signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    let frameId: number | null = null;
    let idleId: number | null = null;
    let timeoutId: number | null = null;
    let settled = false;

    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      resolve(ready);
    };
    const abort = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      const browserWindow = window as BackfillWindow;
      if (idleId !== null) browserWindow.cancelIdleCallback?.(idleId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      finish(false);
    };

    if (signal.aborted) {
      finish(false);
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    frameId = window.requestAnimationFrame(() => {
      frameId = null;
      if (signal.aborted) {
        finish(false);
        return;
      }
      const browserWindow = window as BackfillWindow;
      if (typeof browserWindow.requestIdleCallback === "function") {
        idleId = browserWindow.requestIdleCallback(() => finish(true), {
          timeout: 1000,
        });
      } else {
        timeoutId = window.setTimeout(() => finish(true), 0);
      }
    });
  });
}

type BookCoverBackfillState = {
  setBooks: Dispatch<SetStateAction<BookMetadata[]>>;
  setReadingProgressMap: Dispatch<SetStateAction<ReadingProgressMap>>;
  setImportError: Dispatch<SetStateAction<string | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
};

type BookCoverBackfillRun = {
  books: BookMetadata[];
  getVisibleBookIds: () => readonly string[];
};

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timer));
  });
}

export default function useBookCoverBackfill({
  setBooks,
  setReadingProgressMap,
  setImportError,
  setLoading,
}: BookCoverBackfillState) {
  const visibleBookIdsRef = useRef<readonly string[]>([]);
  const runner = useMemo(
    () =>
      createBookCoverBackfillRunner<BookCoverBackfillRun>(async (
        { books, getVisibleBookIds },
        signal
      ) => {
        if (!(await waitForBackfillWindow(signal))) return;
        await runBookCoverBackfill({
          books,
          getVisibleBookIds,
          loadCover: async (bookId) =>
            (
              await loadMissingBookCover(bookId, extractEpubCoverImage)
            )?.blob,
          onCover: (bookId, coverImageBlob) => {
            setBooks((currentBooks) =>
              mergeBookCoverMetadata(
                currentBooks,
                bookId,
                coverImageBlob
              )
            );
          },
          signal,
        });
      }),
    [setBooks]
  );

  useEffect(() => () => runner.cancel(), [runner]);

  const startBookCoverBackfill = useCallback(
    (books: BookMetadata[]) => {
      void runner
        .start({
          books,
          getVisibleBookIds: () => visibleBookIdsRef.current,
        })
        .catch(() => undefined);
    },
    [runner]
  );

  const cancelBookCoverBackfillAndDrain = useCallback(
    () => runner.cancelAndDrain(),
    [runner]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadLibrary() {
      if (!hasIndexedDbSupport(window)) {
        setImportError(UI_TEXT.ERROR_READ_FILE);
        setLoading(false);
        return;
      }

      try {
        void requestPersistentStorage();
        const [storedBooks, storedPositions] = await withTimeout(
          Promise.all([listBookMetadata(), listReadingPositions()]),
          15000,
          "Local library storage timed out."
        );
        if (!cancelled) {
          setBooks(storedBooks);
          startBookCoverBackfill(storedBooks);
          setReadingProgressMap(buildReadingProgressMap(storedPositions));
        }
      } catch {
        if (!cancelled) setImportError(UI_TEXT.ERROR_READ_FILE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadLibrary();
    return () => {
      cancelled = true;
    };
  }, [
    setBooks,
    setImportError,
    setLoading,
    setReadingProgressMap,
    startBookCoverBackfill,
  ]);

  const setVisibleBookIds = useCallback((bookIds: readonly string[]) => {
    visibleBookIdsRef.current = bookIds;
  }, []);

  return {
    setVisibleBookIds,
    startBookCoverBackfill,
    cancelBookCoverBackfillAndDrain,
  };
}
