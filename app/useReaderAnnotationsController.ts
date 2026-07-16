"use client";

import { useCallback, type RefObject } from "react";
import type { EpubReaderHandle } from "@/app/EpubReader";
import useReaderAnnotationNavigation from "@/app/useReaderAnnotationNavigation";
import useReaderAnnotations from "@/app/useReaderAnnotations";
import type { BookRecord } from "@/lib/db";
import type { ReaderMode } from "@/lib/readerMode";
import {
  captureCurrentTxtLocation,
  captureTxtSelection,
} from "@/lib/txtAnnotations";

type Options = {
  openBook: BookRecord | null;
  readerMode: ReaderMode;
  reduceMotion: boolean;
  textReaderRef: RefObject<HTMLDivElement | null>;
  epubReaderRef: RefObject<EpubReaderHandle | null>;
  setSelectedText: (text: string | null) => void;
  clearSelection: () => void;
  showSelectionChrome: () => void;
};

export default function useReaderAnnotationsController({
  openBook,
  readerMode,
  reduceMotion,
  textReaderRef,
  epubReaderRef,
  setSelectedText,
  clearSelection,
  showSelectionChrome,
}: Options) {
  const annotations = useReaderAnnotations(openBook?.id ?? null);
  const { reportError, saveHighlight, setCurrentSnapshot, setSelection } = annotations;
  const navigation = useReaderAnnotationNavigation({
    openBook,
    readerMode,
    reduceMotion,
    textReaderRef,
    epubReaderRef,
    saveHighlight,
    clearSelection,
    reportError,
  });

  const captureTxtTextSelection = useCallback(
    (progressPercent: number, pageNumber: number): boolean => {
      const selection = captureTxtSelection(
        window.getSelection(),
        textReaderRef.current,
        progressPercent,
        pageNumber
      );
      if (!selection) return false;
      setSelection(selection);
      setSelectedText(selection.text);
      showSelectionChrome();
      return true;
    },
    [setSelectedText, setSelection, showSelectionChrome, textReaderRef]
  );

  const captureTxtSnapshot = useCallback(
    (progressPercent: number, pageNumber: number) => {
      setCurrentSnapshot(
        captureCurrentTxtLocation(
          textReaderRef.current,
          readerMode,
          progressPercent,
          pageNumber
        )
      );
    },
    [readerMode, setCurrentSnapshot, textReaderRef]
  );

  return {
    ...annotations,
    ...navigation,
    captureTxtTextSelection,
    captureTxtSnapshot,
  };
}
