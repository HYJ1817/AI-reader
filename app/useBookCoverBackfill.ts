"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { extractEpubCoverImage } from "@/lib/epubCover";
import {
  loadMissingBookCover,
  type BookMetadata,
} from "@/lib/db";
import {
  mergeBookCoverMetadata,
  runBookCoverBackfill,
} from "@/lib/bookCoverBackfill";

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

export default function useBookCoverBackfill(
  visibleBookIdsRef: RefObject<readonly string[]>,
  setBooks: Dispatch<SetStateAction<BookMetadata[]>>
) {
  const currentRunRef = useRef<AbortController | null>(null);
  const scheduledRunRef = useRef<ScheduledRun | null>(null);

  const cancelCurrentRun = useCallback(() => {
    currentRunRef.current?.abort();
    currentRunRef.current = null;
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

  return useCallback(
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
    },
    [cancelCurrentRun, setBooks, visibleBookIdsRef]
  );
}
