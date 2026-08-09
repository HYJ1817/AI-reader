"use client";

import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import {
  getBook, getReadingPosition, listBookMetadata, updateBookLastOpenedAt,
  type BookMetadata, type BookRecord, type ReadingPosition,
} from "@/lib/db";
import { getBookProgressPercent, type ReadingProgressMap } from "@/lib/libraryProgress";
import { shouldShowBottomTabs } from "@/lib/navigationVisibility";
import type { NavigationTab } from "@/lib/navigationMotion";
import type { PushEntry } from "@/lib/appNavigation";
import type { UseAppNavigationResult } from "./useAppNavigation";
import { UI_TEXT } from "@/lib/uiText";

type OpenReader = (book: BookMetadata, originId?: string) => Promise<void>;

type Options = {
  activeTab: NavigationTab;
  topPushRoute?: PushEntry["route"];
  pushes: PushEntry[];
  books: BookMetadata[];
  loading: boolean;
  progressMap: ReadingProgressMap;
  latestBook: BookMetadata | null;
  readerPresented: boolean;
  navigation: UseAppNavigationResult;
  flushReadingPosition: () => Promise<void>;
  prepareReaderBook: (book: BookRecord, position?: ReadingPosition) => Promise<void>;
  stopWorkspaceRequest: () => Promise<void>;
  resetScrollRestoration: () => void;
  setBooks: Dispatch<SetStateAction<BookMetadata[]>>;
  setImportError: Dispatch<SetStateAction<string | null>>;
};

export default function useBookDetailsIntegration({
  activeTab,
  topPushRoute,
  pushes,
  books,
  loading,
  progressMap,
  latestBook,
  readerPresented,
  navigation,
  flushReadingPosition,
  prepareReaderBook,
  stopWorkspaceRequest,
  resetScrollRestoration,
  setBooks,
  setImportError,
}: Options) {
  const pendingTocBookIdRef = useRef<string | null>(null);
  const lastFocusRef = useRef<{ bookId: string; restoreFocusId?: string } | null>(null);
  const bookDetailsOpen = topPushRoute === "book-details";
  const detailEntry = bookDetailsOpen ? pushes.at(-1) : undefined;
  const detailBook = detailEntry?.entityId
    ? books.find((book) => book.id === detailEntry.entityId) ?? null
    : null;
  const detailProgress = detailBook
    ? getBookProgressPercent(progressMap, detailBook.id)
    : 0;

  useEffect(() => {
    if (
      !loading &&
      detailEntry?.entityId &&
      !books.some((book) => book.id === detailEntry.entityId)
    ) navigation.removeInvalid(detailEntry.key);
  }, [books, detailEntry?.entityId, detailEntry?.key, loading, navigation]);

  useEffect(() => {
    if (detailEntry?.entityId) {
      lastFocusRef.current = {
        bookId: detailEntry.entityId,
        restoreFocusId: detailEntry.restoreFocusId,
      };
      return;
    }
    const pending = lastFocusRef.current;
    if (!pending) return;
    lastFocusRef.current = null;
    if (activeTab !== "library" && topPushRoute !== "library-search") return;
    const frame = window.requestAnimationFrame(() => {
      const original = pending.restoreFocusId
        ? document.getElementById(pending.restoreFocusId)
        : null;
      const fallback = document.querySelector<HTMLElement>(
        `[data-book-focus-id="${CSS.escape(pending.bookId)}"]`
      );
      (original ?? fallback)?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, detailEntry?.entityId, detailEntry?.restoreFocusId, topPushRoute]);

  useEffect(() => {
    if (!readerPresented) pendingTocBookIdRef.current = null;
  }, [readerPresented]);

  useEffect(() => () => {
    pendingTocBookIdRef.current = null;
  }, []);

  const clearPendingToc = useCallback(() => {
    pendingTocBookIdRef.current = null;
  }, []);

  const prepareReader = useCallback((bookId: string) => {
    if (pendingTocBookIdRef.current && pendingTocBookIdRef.current !== bookId) {
      pendingTocBookIdRef.current = null;
    }
  }, []);

  const failReader = useCallback((bookId: string) => {
    if (pendingTocBookIdRef.current === bookId) pendingTocBookIdRef.current = null;
  }, []);

  const onTocReady = useCallback((bookId: string) => {
    if (pendingTocBookIdRef.current !== bookId) return;
    if (navigation.getState().reader?.bookId !== bookId) return;
    pendingTocBookIdRef.current = null;
    navigation.presentSheet("toc");
  }, [navigation]);

  const openContents = useCallback((
    book: BookMetadata,
    originId: string,
    openReader: OpenReader
  ) => {
    pendingTocBookIdRef.current = book.id;
    void openReader(book, originId).catch(() => failReader(book.id));
  }, [failReader]);

  const openBookForReading = useCallback(async (
    book: BookMetadata,
    originId?: string
  ) => {
    prepareReader(book.id);
    await flushReadingPosition();
    const fullBook = await getBook(book.id);
    if (!fullBook) {
      failReader(book.id);
      setImportError(UI_TEXT.ERROR_READ_FILE);
      return;
    }
    const now = new Date().toISOString();
    await updateBookLastOpenedAt(book.id, now);
    const [nextBooks, savedPosition] = await Promise.all([
      listBookMetadata(),
      getReadingPosition(book.id),
    ]);
    setBooks(nextBooks);
    resetScrollRestoration();
    await stopWorkspaceRequest();
    const contentReady = prepareReaderBook(fullBook, savedPosition);
    navigation.presentReader(book.id, { originId });
    await contentReady;
  }, [
    failReader, flushReadingPosition, navigation, prepareReader,
    prepareReaderBook, resetScrollRestoration, setBooks, setImportError,
    stopWorkspaceRequest,
  ]);

  return useMemo(() => ({
    bookDetailsOpen,
    detailEntry,
    detailBook,
    detailProgress,
    ambientBook: detailBook ?? latestBook ?? null,
    showBottomTabs:
      (pushes.length === 0 || topPushRoute === "library-search" || bookDetailsOpen) &&
      shouldShowBottomTabs(activeTab, readerPresented),
    clearPendingToc,
    prepareReader,
    failReader,
    onTocReady,
    openContents,
    openBookForReading,
  }), [
    activeTab, bookDetailsOpen, clearPendingToc, detailBook, detailEntry,
    detailProgress, failReader, latestBook, onTocReady, openContents,
    openBookForReading, prepareReader, pushes.length, readerPresented, topPushRoute,
  ]);
}
