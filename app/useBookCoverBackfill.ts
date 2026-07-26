"use client";

import {
  useCallback,
  useEffect,
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

type ScheduledRun =
  | { kind: "idle"; id: number }
  | { kind: "timeout"; id: number };

type BackfillWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions
  ) => number;
  cancelIdleCallback?: (id: number) => void;
};

type BookCoverBackfillState = {
  setBooks: Dispatch<SetStateAction<BookMetadata[]>>;
  setReadingProgressMap: Dispatch<SetStateAction<ReadingProgressMap>>;
  setImportError: Dispatch<SetStateAction<string | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
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
  const currentRunRef = useRef<AbortController | null>(null);
  const scheduledFrameRef = useRef<number | null>(null);
  const scheduledRunRef = useRef<ScheduledRun | null>(null);

  const cancelCurrentRun = useCallback(() => {
    currentRunRef.current?.abort();
    currentRunRef.current = null;
    if (scheduledFrameRef.current !== null) {
      window.cancelAnimationFrame(scheduledFrameRef.current);
      scheduledFrameRef.current = null;
    }
    const scheduled = scheduledRunRef.current;
    scheduledRunRef.current = null;
    if (!scheduled) return;
    if (scheduled.kind === "idle") {
      (window as BackfillWindow).cancelIdleCallback?.(scheduled.id);
    } else {
      window.clearTimeout(scheduled.id);
    }
  }, []);

  useEffect(() => cancelCurrentRun, [cancelCurrentRun]);

  const startBookCoverBackfill = useCallback(
    (books: BookMetadata[]) => {
      cancelCurrentRun();
      const controller = new AbortController();
      currentRunRef.current = controller;

      const run = () => {
        scheduledRunRef.current = null;
        void runBookCoverBackfill({
          books,
          getVisibleBookIds: () => visibleBookIdsRef.current,
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
          signal: controller.signal,
        }).finally(() => {
          if (currentRunRef.current === controller) {
            currentRunRef.current = null;
          }
        });
      };

      scheduledFrameRef.current = window.requestAnimationFrame(() => {
        scheduledFrameRef.current = null;
        if (controller.signal.aborted) return;
        const browserWindow = window as BackfillWindow;
        if (typeof browserWindow.requestIdleCallback === "function") {
          scheduledRunRef.current = {
            kind: "idle",
            id: browserWindow.requestIdleCallback(run, { timeout: 1000 }),
          };
        } else {
          scheduledRunRef.current = {
            kind: "timeout",
            id: window.setTimeout(run, 0),
          };
        }
      });
    },
    [cancelCurrentRun, setBooks]
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

  return { setVisibleBookIds, startBookCoverBackfill };
}
