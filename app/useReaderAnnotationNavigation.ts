"use client";

import { useCallback, type RefObject } from "react";
import type { EpubReaderHandle } from "@/app/EpubReader";
import type { AnnotationRecord, BookRecord, HighlightColor } from "@/lib/db";
import type { ReaderMode } from "@/lib/readerMode";
import { shouldReduceReaderMotion } from "@/lib/motionInteractions";
import { navigateToTxtLocator } from "@/lib/txtAnnotations";

type Options = {
  openBook: BookRecord | null;
  readerMode: ReaderMode;
  reduceMotion: boolean;
  textReaderRef: RefObject<HTMLDivElement | null>;
  epubReaderRef: RefObject<EpubReaderHandle | null>;
  saveHighlight: (color: HighlightColor) => Promise<boolean>;
  clearSelection: () => void;
  reportError: (message: string) => void;
};

export default function useReaderAnnotationNavigation({
  openBook,
  readerMode,
  reduceMotion,
  textReaderRef,
  epubReaderRef,
  saveHighlight,
  clearSelection,
  reportError,
}: Options) {
  const selectAnnotation = useCallback(
    async (record: AnnotationRecord) => {
      if (!openBook || !record.locator) return;
      try {
        if (openBook.format === "epub") {
          await epubReaderRef.current?.goToAnnotation(record.locator);
          return;
        }
        const reader = textReaderRef.current;
        if (!reader) return;
        navigateToTxtLocator(
          reader,
          record.locator,
          readerMode,
          record.progressPercent ?? 0,
          shouldReduceReaderMotion({
            appPreference: reduceMotion,
            systemPreference: window.matchMedia(
              "(prefers-reduced-motion: reduce)"
            ).matches,
          })
        );
      } catch {
        reportError("无法定位原文");
      }
    },
    [epubReaderRef, openBook, readerMode, reduceMotion, reportError, textReaderRef]
  );

  const applyHighlight = useCallback(
    (color: HighlightColor) => {
      void saveHighlight(color).then((saved) => {
        if (!saved) return;
        epubReaderRef.current?.clearNativeSelection();
        clearSelection();
      });
    },
    [clearSelection, epubReaderRef, saveHighlight]
  );

  return { selectAnnotation, applyHighlight };
}
