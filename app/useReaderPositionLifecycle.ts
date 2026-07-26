"use client";

import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import type { ReaderPositionCoordinator } from "@/lib/readerPositionCoordinator";
import type { ReadingPosition } from "@/lib/db";
import { UI_TEXT } from "@/lib/uiText";

export default function useReaderPositionLifecycle(
  positionCoordinator: ReaderPositionCoordinator,
  setImportError: Dispatch<SetStateAction<string | null>>
) {
  useEffect(() => {
    const flushPendingPosition = () =>
      positionCoordinator.flush().catch(() => {
        setImportError(UI_TEXT.ERROR_READ_FILE);
      });
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void flushPendingPosition();
      }
    };
    const handlePageHide = () => void flushPendingPosition();
    const handleBeforeReload = (event: Event) => {
      const reloadEvent = event as CustomEvent<{
        waitUntil?: (promise: Promise<void>) => void;
      }>;
      reloadEvent.detail?.waitUntil?.(flushPendingPosition());
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("ai-reader-before-reload", handleBeforeReload);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("ai-reader-before-reload", handleBeforeReload);
    };
  }, [positionCoordinator, setImportError]);

  return useCallback((position: ReadingPosition) => {
    positionCoordinator.schedule(position);
  }, [positionCoordinator]);
}
