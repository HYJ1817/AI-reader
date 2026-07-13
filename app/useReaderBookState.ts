"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
} from "react";
import type { ReaderEntry } from "@/lib/appNavigation";
import {
  getReadingPosition,
  type BookRecord,
  type ReadingPosition,
} from "@/lib/db";
import type { EpubTocItem } from "@/lib/epubNavigation";
import type { ReaderChromeEvent } from "@/lib/readerChromeState";
import { sanitizeReaderMode, type ReaderMode } from "@/lib/readerMode";
import type { ReaderPageInfo } from "@/lib/readerPageInfo";
import { parseTxtParagraphs } from "@/lib/txtReader";
import { UI_TEXT } from "@/lib/uiText";

type Options = {
  readerEntry: ReaderEntry | null;
  books: BookRecord[];
  libraryLoading: boolean;
  removeInvalid: (key: string) => void;
  setReaderMode: (mode: ReaderMode) => void;
  setTocItems: (items: EpubTocItem[]) => void;
  setReaderProgressPercent: (progress: number) => void;
  setReaderPageInfo: (pageInfo: ReaderPageInfo) => void;
  dispatchReaderChrome: Dispatch<ReaderChromeEvent>;
};

type ReaderBookState = {
  openBook: BookRecord | null;
  paragraphs: string[];
  readerLoading: boolean;
  readerModeRestoreProgressRef: MutableRefObject<number | null>;
  prepareReaderBook: (
    book: BookRecord,
    savedPosition?: ReadingPosition
  ) => Promise<void>;
  clearReaderBook: () => void;
};

export default function useReaderBookState({
  readerEntry,
  books,
  libraryLoading,
  removeInvalid,
  setReaderMode,
  setTocItems,
  setReaderProgressPercent,
  setReaderPageInfo,
  dispatchReaderChrome,
}: Options): ReaderBookState {
  const [openBook, setOpenBook] = useState<BookRecord | null>(null);
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [readerLoading, setReaderLoading] = useState(false);
  const readerLoadTokenRef = useRef(0);
  const readerModeRestoreProgressRef = useRef<number | null>(null);

  const clearReaderBook = useCallback(() => {
    readerLoadTokenRef.current += 1;
    readerModeRestoreProgressRef.current = null;
    setOpenBook(null);
    setParagraphs([]);
    setReaderLoading(false);
    setReaderProgressPercent(0);
    setReaderPageInfo({ current: 1, total: 1 });
    setTocItems([]);
  }, [
    setReaderPageInfo,
    setReaderProgressPercent,
    setTocItems,
  ]);

  const prepareReaderBook = useCallback(async (
    book: BookRecord,
    savedPosition?: ReadingPosition
  ) => {
    const loadToken = readerLoadTokenRef.current + 1;
    readerLoadTokenRef.current = loadToken;
    setOpenBook(book);
    setReaderMode(sanitizeReaderMode(savedPosition?.readingMode));
    readerModeRestoreProgressRef.current = savedPosition?.progressPercent ?? null;
    setTocItems([]);
    setReaderProgressPercent(0);
    setReaderPageInfo({ current: 1, total: 1 });
    dispatchReaderChrome({ type: "hide" });

    if (book.format !== "txt") {
      setReaderLoading(false);
      setParagraphs([]);
      return;
    }

    setReaderLoading(true);
    try {
      const text = await book.fileBlob.text();
      if (readerLoadTokenRef.current !== loadToken) return;
      setParagraphs(parseTxtParagraphs(text));
    } catch {
      if (readerLoadTokenRef.current !== loadToken) return;
      setParagraphs([UI_TEXT.ERROR_READ_FILE]);
    } finally {
      if (readerLoadTokenRef.current === loadToken) setReaderLoading(false);
    }
  }, [
    dispatchReaderChrome,
    setReaderMode,
    setReaderPageInfo,
    setReaderProgressPercent,
    setTocItems,
  ]);

  useEffect(() => {
    if (!readerEntry || libraryLoading || openBook?.id === readerEntry.bookId) {
      return;
    }

    const restoredBook = books.find((book) => book.id === readerEntry.bookId);
    if (!restoredBook) {
      removeInvalid(readerEntry.key);
      return;
    }

    let cancelled = false;
    getReadingPosition(restoredBook.id)
      .then((savedPosition) => {
        if (!cancelled) void prepareReaderBook(restoredBook, savedPosition);
      })
      .catch(() => {
        if (!cancelled) void prepareReaderBook(restoredBook);
      });

    return () => {
      cancelled = true;
    };
  }, [
    books,
    libraryLoading,
    openBook?.id,
    prepareReaderBook,
    readerEntry,
    removeInvalid,
  ]);

  return {
    openBook,
    paragraphs,
    readerLoading,
    readerModeRestoreProgressRef,
    prepareReaderBook,
    clearReaderBook,
  };
}
