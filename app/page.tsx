"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import styles from "./page.module.css";
import {
  listBooks,
  saveBook,
  saveReadingPosition,
  getReadingPosition,
  listReadingPositions,
  listBookGroups,
  saveBookGroup,
  deleteBook,
  deleteBookGroup,
  updateBookGroupName,
  updateBookGroupMembership,
  type BookRecord,
  type BookGroup,
  type DailyReadingStat,
} from "@/lib/db";
import { createBookRecordFromFile } from "@/lib/importBook";
import { extractEpubCoverImage } from "@/lib/epubCover";
import { backfillMissingBookCovers } from "@/lib/bookCoverBackfill";
import {
  chunkParagraphs,
  parseTxtParagraphs,
  progressFromScroll,
  scrollTopFromProgress,
} from "@/lib/txtReader";
import BookCover from "@/app/BookCover";
import EpubReader from "@/app/EpubReader";
import type { EpubReaderHandle } from "@/app/EpubReader";
import {
  DEFAULT_AI_PROVIDER_SETTINGS,
  getActiveAiProvider,
  hasUsableAiProvider,
  loadAiProviderSettings,
  saveAiProviderSettingsToStorage,
  type AiProviderSettings,
} from "@/lib/aiProviders";
import { createBackupPayload, restoreBackupPayload } from "@/lib/backup";
import { createBookFileExport } from "@/lib/bookFileExport";
import { hasIndexedDbSupport } from "@/lib/browserStorage";
import {
  DEFAULT_READER_PREFERENCES,
  loadReaderPreferences,
  readerPreferenceChangeNeedsMotion,
  saveReaderPreferencesToStorage,
  type ReaderPreferences,
} from "@/lib/readerPreferences";
import {
  DEFAULT_APP_PREFERENCES,
  loadAppPreferences,
  saveAppPreferencesToStorage,
  type AppPreferences,
  type LibraryViewMode,
} from "@/lib/appPreferences";
import {
  normalizeProgressPercent,
  shouldPublishProgressPercent,
} from "@/lib/readerProgress";
import type { EpubTocItem } from "@/lib/epubNavigation";
import ReaderControls from "@/app/ReaderControls";
import ReaderSettingsPanel from "@/app/ReaderSettingsPanel";
import TocDrawer from "@/app/TocDrawer";
import AskAiPanel from "@/app/AskAiPanel";
import AiSettingsSheet from "@/app/AiSettingsSheet";
import ReadingGoalSheet from "@/app/ReadingGoalSheet";
import BottomSheet from "@/app/BottomSheet";
import { UI_TEXT } from "@/lib/uiText";
import { filterBooksByQuery } from "@/lib/libraryFilters";
import {
  getDailyReadingStat,
  incrementDailyReadingSeconds,
  listDailyReadingStats,
} from "@/lib/db";
import {
  loadReadingGoal,
  saveReadingGoalToStorage,
  getLocalDateKey,
  formatReadingMinutes,
  shouldPublishReadingSeconds,
} from "@/lib/readingGoal";
import {
  buildSevenDayReadingInsights,
  totalReadingMinutes,
} from "@/lib/readingInsights";
import {
  pruneSelectedBookIds,
  selectAllBookIds,
  toggleBookSelection,
} from "@/lib/librarySelection";
import {
  getReaderSwipeAction,
  getReaderSwipeSettleOffset,
  getReaderSwipeVisualOffset,
  hasActiveReaderSwipeOffset,
  isReaderSwipeSettleTransition,
} from "@/lib/readerSwipe";
import { selectFeaturedLibraryBook } from "@/lib/libraryShelves";
import {
  buildReadingProgressMap,
  formatLibraryProgressLabel,
  getBookProgressPercent,
  type ReadingProgressMap,
} from "@/lib/libraryProgress";
import { shouldShowBottomTabs } from "@/lib/navigationVisibility";
import { buildCollectionListItems } from "@/lib/collectionList";
import {
  getInitialVisibleItemCount,
  getNextVisibleItemCount,
} from "@/lib/incrementalList";
import {
  isTapGesture,
  shouldReduceReaderMotion,
} from "@/lib/motionInteractions";
import {
  createReaderChromeState,
  reduceReaderChromeState,
} from "@/lib/readerChromeState";

type Tab = "library" | "reading" | "settings";
type ReaderTurnDirection = "prev" | "next";
type ReaderPageInfo = { current: number; total: number };
const LIBRARY_RENDER_BATCH = 30;

type WakeLockSentinelLike = {
  release: () => Promise<void>;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
};

function formatBookSize(size: number): string {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function formatBookDate(value?: string): string {
  if (!value) return "\u4ece\u672a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u672a\u77e5";
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function pageInfoFromProgress(progressPercent: number, totalPages = 100): ReaderPageInfo {
  const total = Math.max(1, Math.round(totalPages));
  const progress = normalizeProgressPercent(progressPercent);
  const current = progress <= 0 ? 1 : Math.ceil((progress / 100) * total);
  return { current: Math.min(total, Math.max(1, current)), total };
}

function pageInfoFromScroll(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number
): ReaderPageInfo {
  const total = Math.max(1, Math.ceil(scrollHeight / Math.max(1, clientHeight)));
  const current = Math.floor(Math.max(0, scrollTop) / Math.max(1, clientHeight)) + 1;
  return { current: Math.min(total, Math.max(1, current)), total };
}

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

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("library");
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [libraryRenderWindow, setLibraryRenderWindow] = useState({
    key: "",
    count: LIBRARY_RENDER_BATCH,
  });
  const libraryLoadSentinelRef = useRef<HTMLDivElement>(null);
  const [readingProgressMap, setReadingProgressMap] = useState<ReadingProgressMap>({});
  const [loading, setLoading] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [openBook, setOpenBook] = useState<BookRecord | null>(null);
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [readerLoading, setReaderLoading] = useState(false);
  const readerRef = useRef<HTMLDivElement>(null);
  const scrollRestoredRef = useRef(false);

  const [aiProviderSettings, setAiProviderSettings] = useState<AiProviderSettings>(
    DEFAULT_AI_PROVIDER_SETTINGS
  );
  const [aiSettingsSheetOpen, setAiSettingsSheetOpen] = useState(false);

  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const backupInputRef = useRef<HTMLInputElement>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const [readerPrefs, setReaderPrefs] = useState<ReaderPreferences>(DEFAULT_READER_PREFERENCES);
  const [appPrefs, setAppPrefs] = useState<AppPreferences>(DEFAULT_APP_PREFERENCES);
  const [readerSettingsOpen, setReaderSettingsOpen] = useState(false);
  const [tocItems, setTocItems] = useState<EpubTocItem[]>([]);
  const [tocDrawerOpen, setTocDrawerOpen] = useState(false);
  const [readerProgressPercent, setReaderProgressPercent] = useState(0);
  const [readerPageInfo, setReaderPageInfo] = useState<ReaderPageInfo>({ current: 1, total: 1 });
  const epubReaderRef = useRef<EpubReaderHandle>(null);
  const [readerChromeState, dispatchReaderChrome] = useReducer(
    reduceReaderChromeState,
    false,
    createReaderChromeState
  );
  const readerChromeVisible = readerChromeState.visible;
  const readerPointerDownRef = useRef<{
    x: number;
    y: number;
    time: number;
    target: EventTarget | null;
    axis: "pending" | "horizontal" | "vertical";
    baseOffset: number;
  } | null>(null);
  const readerSwipeSettleTimerRef = useRef<number | null>(null);
  const readerSwipeGenerationRef = useRef(0);
  const pendingReaderSwipeSettleRef = useRef<{
    generation: number;
    action: ReturnType<typeof getReaderSwipeAction>;
  } | null>(null);
  const readerScrollFrameRef = useRef<number | null>(null);
  const readerSaveTimerRef = useRef<number | null>(null);
  const epubProgressFrameRef = useRef<number | null>(null);
  const pendingEpubProgressRef = useRef<number | null>(null);
  const readerPresentFrameRef = useRef<number | null>(null);
  const readerPrefsFrameRef = useRef<number | null>(null);
  const readerPrefsSaveTimerRef = useRef<number | null>(null);
  const readerPrefsMotionTimerRef = useRef<number | null>(null);
  const readerPrefsRestoreFrameRef = useRef<number | null>(null);
  const pendingReaderPrefsRef = useRef<ReaderPreferences | null>(null);
  const readerPrefsGenerationRef = useRef(0);
  const readerShellRef = useRef<HTMLDivElement>(null);
  const [askSheetOpen, setAskSheetOpen] = useState(false);

  const [readingGoal, setReadingGoal] = useState(() => loadReadingGoal());
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [readingStats, setReadingStats] = useState<DailyReadingStat[]>([]);
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const [goalInputValue, setGoalInputValue] = useState(readingGoal.targetMinutes);
  const tickRef = useRef<{
    date: string;
    lastVis: boolean;
    secondsRead: number;
    publishedSeconds: number;
  }>({
    date: "",
    lastVis: false,
    secondsRead: 0,
    publishedSeconds: 0,
  });

  const [groups, setGroups] = useState<BookGroup[]>([]);
  const [libraryScreen, setLibraryScreen] = useState<"library" | "collections">("library");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [libraryView, setLibraryView] = useState<LibraryViewMode>(
    DEFAULT_APP_PREFERENCES.libraryView
  );
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [groupSheetBook, setGroupSheetBook] = useState<BookRecord | null>(null);
  const [bookActionSheetBook, setBookActionSheetBook] = useState<BookRecord | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [libraryEditing, setLibraryEditing] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [batchGroupSheetOpen, setBatchGroupSheetOpen] = useState(false);
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [collectionsEditing, setCollectionsEditing] = useState(false);
  const [collectionCreateSheetOpen, setCollectionCreateSheetOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const autoOpenAttemptedRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLibrary() {
      if (!hasIndexedDbSupport(window)) {
        setImportError(UI_TEXT.ERROR_READ_FILE);
        setLoading(false);
        return;
      }

      try {
        const [storedBooks, storedPositions] = await withTimeout(
          Promise.all([listBooks(), listReadingPositions()]),
          2000,
          "Local library storage timed out."
        );
        if (!cancelled) {
          setBooks(storedBooks);
          setReadingProgressMap(buildReadingProgressMap(storedPositions));
          void backfillMissingBookCovers(storedBooks, {
            extractCoverImage: extractEpubCoverImage,
            saveBook,
          })
            .then((result) => {
              if (!cancelled && result.updatedCount > 0) {
                setBooks(result.books);
              }
            })
            .catch(() => {
              // Cover backfill is opportunistic; unreadable EPUB covers keep fallback covers.
            });
        }
      } catch {
        if (!cancelled) setImportError(UI_TEXT.ERROR_READ_FILE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadLibrary();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setAiProviderSettings(loadAiProviderSettings());
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setReaderPrefs(loadReaderPreferences());
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const stored = loadAppPreferences();
      setAppPrefs(stored);
      setLibraryView(stored.libraryView);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!hasIndexedDbSupport(window)) return;
    listBookGroups().then(setGroups).catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    if (!hasIndexedDbSupport(window)) return;
    const dateKey = getLocalDateKey();
    getDailyReadingStat(dateKey)
      .then((stat) => {
        const secondsRead = stat?.secondsRead ?? 0;
        tickRef.current.date = dateKey;
        tickRef.current.secondsRead = secondsRead;
        tickRef.current.publishedSeconds = secondsRead;
        setTodaySeconds(secondsRead);
      })
      .catch(() => {
        tickRef.current.date = dateKey;
        tickRef.current.secondsRead = 0;
        tickRef.current.publishedSeconds = 0;
        setTodaySeconds(0);
      });
    listDailyReadingStats().then(setReadingStats).catch(() => setReadingStats([]));
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!hasIndexedDbSupport(window)) {
        tickRef.current.lastVis = false;
        return;
      }
      try {
        const dateKey = getLocalDateKey();
        if (tickRef.current.date !== dateKey) {
          tickRef.current.date = dateKey;
          const stat = await getDailyReadingStat(dateKey);
          const secondsRead = stat?.secondsRead ?? 0;
          tickRef.current.secondsRead = secondsRead;
          tickRef.current.publishedSeconds = secondsRead;
          setTodaySeconds(secondsRead);
        }
        const isVisible = document.visibilityState === "visible";
        const shouldCount =
          activeTab === "reading" &&
          openBook !== null &&
          isVisible;
        if (shouldCount && tickRef.current.lastVis) {
          await incrementDailyReadingSeconds(dateKey, 1);
          const secondsRead = tickRef.current.secondsRead + 1;
          tickRef.current.secondsRead = secondsRead;
          if (
            shouldPublishReadingSeconds(
              tickRef.current.publishedSeconds,
              secondsRead
            )
          ) {
            tickRef.current.publishedSeconds = secondsRead;
            setTodaySeconds(secondsRead);
            setReadingStats((prev) => {
              const now = new Date().toISOString();
              const existing = prev.find((stat) => stat.date === dateKey);
              if (existing) {
                return prev.map((stat) =>
                  stat.date === dateKey
                    ? { ...stat, secondsRead, updatedAt: now }
                    : stat
                );
              }
              return [...prev, { date: dateKey, secondsRead, updatedAt: now }];
            });
          }
        }
        tickRef.current.lastVis = shouldCount;
      } catch {
        tickRef.current.lastVis = false;
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTab, openBook]);

  function switchToSettings() {
    setActiveTab("settings");
  }

  function handleAiProviderSettingsSave(next: AiProviderSettings) {
    saveAiProviderSettingsToStorage(next);
    setAiProviderSettings(next);
  }

  function handleReaderPrefsChange(prefs: ReaderPreferences) {
    if (
      !appPrefs.reduceMotion &&
      readerPreferenceChangeNeedsMotion(readerPrefs, prefs)
    ) {
      const readerShell = readerShellRef.current;
      readerShell?.classList.add(styles.readerPreferencesAdjusting);
      if (readerPrefsMotionTimerRef.current !== null) {
        window.clearTimeout(readerPrefsMotionTimerRef.current);
      }
      readerPrefsMotionTimerRef.current = window.setTimeout(() => {
        readerPrefsMotionTimerRef.current = null;
        readerShell?.classList.remove(styles.readerPreferencesAdjusting);
      }, 160);
    }
    pendingReaderPrefsRef.current = prefs;

    if (readerPrefsSaveTimerRef.current !== null) {
      window.clearTimeout(readerPrefsSaveTimerRef.current);
    }
    readerPrefsSaveTimerRef.current = window.setTimeout(() => {
      readerPrefsSaveTimerRef.current = null;
      const latest = pendingReaderPrefsRef.current;
      if (latest) saveReaderPreferencesToStorage(latest);
    }, 180);

    if (readerPrefsFrameRef.current !== null) return;
    readerPrefsFrameRef.current = window.requestAnimationFrame(() => {
      readerPrefsFrameRef.current = null;
      const next = pendingReaderPrefsRef.current;
      if (!next) return;

      const txtReader = readerRef.current;
      const progressBeforeChange =
        openBook?.format === "txt" && txtReader
          ? progressFromScroll(
              txtReader.scrollTop,
              txtReader.scrollHeight,
              txtReader.clientHeight
            )
          : null;
      const generation = ++readerPrefsGenerationRef.current;
      setReaderPrefs(next);

      if (progressBeforeChange === null) return;
      if (readerPrefsRestoreFrameRef.current !== null) {
        window.cancelAnimationFrame(readerPrefsRestoreFrameRef.current);
      }
      readerPrefsRestoreFrameRef.current = window.requestAnimationFrame(() => {
        readerPrefsRestoreFrameRef.current = window.requestAnimationFrame(() => {
          readerPrefsRestoreFrameRef.current = null;
          if (readerPrefsGenerationRef.current !== generation) return;
          const reader = readerRef.current;
          if (!reader) return;
          reader.scrollTop = scrollTopFromProgress(
            progressBeforeChange,
            reader.scrollHeight,
            reader.clientHeight
          );
        });
      });
    });
  }

  function presentReader() {
    if (readerPresentFrameRef.current !== null) {
      window.cancelAnimationFrame(readerPresentFrameRef.current);
    }
    readerPresentFrameRef.current = window.requestAnimationFrame(() => {
      readerPresentFrameRef.current = null;
      setActiveTab("reading");
    });
  }

  function handleAppPreferencesChange(next: Partial<AppPreferences>) {
    const merged = { ...appPrefs, ...next };
    setAppPrefs(merged);
    saveAppPreferencesToStorage(merged);
    if (next.libraryView) {
      setLibraryView(next.libraryView);
    }
  }

  function handleLibraryViewChange(view: LibraryViewMode) {
    setLibraryView(view);
    handleAppPreferencesChange({ libraryView: view });
  }

  function enterLibraryEditing() {
    setLibraryEditing(true);
    setBookActionSheetBook(null);
  }

  function exitLibraryEditing() {
    setLibraryEditing(false);
    setSelectedBookIds([]);
    setBatchGroupSheetOpen(false);
    setBatchDeleteConfirmOpen(false);
  }

  function handleBookPress(book: BookRecord) {
    if (libraryEditing) {
      setSelectedBookIds((ids) => toggleBookSelection(ids, book.id));
      return;
    }
    void openBookForReading(book);
  }

  function handleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedBookIds((ids) =>
        ids.filter((id) => !filteredBooks.some((book) => book.id === id))
      );
      return;
    }
    setSelectedBookIds((ids) => selectAllBookIds(ids, filteredBooks.map((book) => book.id)));
  }

  function openBatchGroupSheet() {
    if (selectedBookIds.length === 0) return;
    setNewGroupName("");
    setBatchGroupSheetOpen(true);
  }

  function openBookActionSheet(book: BookRecord) {
    if (libraryEditing) {
      setSelectedBookIds((ids) => toggleBookSelection(ids, book.id));
      return;
    }
    setBookActionSheetBook(book);
    setDeleteConfirmOpen(false);
  }

  function closeBookActionSheet() {
    setBookActionSheetBook(null);
    setDeleteConfirmOpen(false);
  }

  function openGroupSheet(book: BookRecord) {
    setGroupSheetBook(book);
    setNewGroupName("");
    setEditingGroupId(null);
    setEditingGroupName("");
    setGroupSheetOpen(true);
  }

  async function handleCreateGroup() {
    const trimmed = newGroupName.trim();
    if (!trimmed || !groupSheetBook) return;
    const group: BookGroup = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveBookGroup(group);
    const updatedGroups = await listBookGroups();
    setGroups(updatedGroups);
    const currentIds = groupSheetBook.groupIds ?? [];
    await updateBookGroupMembership(groupSheetBook.id, [...currentIds, group.id]);
    const updatedBook = (await listBooks()).find((b) => b.id === groupSheetBook.id);
    if (updatedBook) setGroupSheetBook(updatedBook);
    setBooks(await listBooks());
    setNewGroupName("");
  }

  async function handleToggleGroup(groupId: string) {
    if (!groupSheetBook) return;
    const currentIds = groupSheetBook.groupIds ?? [];
    const newIds = currentIds.includes(groupId)
      ? currentIds.filter((id) => id !== groupId)
      : [...currentIds, groupId];
    await updateBookGroupMembership(groupSheetBook.id, newIds);
    const updatedBook = (await listBooks()).find((b) => b.id === groupSheetBook.id);
    if (updatedBook) setGroupSheetBook(updatedBook);
    setBooks(await listBooks());
  }

  async function handleDeleteGroup(groupId: string) {
    await deleteBookGroup(groupId);
    const updatedGroups = await listBookGroups();
    setGroups(updatedGroups);
    if (groupSheetBook) {
      const updatedBook = (await listBooks()).find((b) => b.id === groupSheetBook.id);
      if (updatedBook) setGroupSheetBook(updatedBook);
    }
    setBooks(await listBooks());
    if (groupFilter === groupId) setGroupFilter(null);
  }

  async function handleRenameGroup(groupId: string) {
    const trimmed = editingGroupName.trim();
    if (!trimmed) return;
    await updateBookGroupName(groupId, trimmed);
    const updatedGroups = await listBookGroups();
    setGroups(updatedGroups);
    setEditingGroupId(null);
    setEditingGroupName("");
  }

  async function handleExportBook(book: BookRecord) {
    try {
      const exported = await createBookFileExport(book);
      const url = URL.createObjectURL(exported.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exported.fileName;
      link.click();
      URL.revokeObjectURL(url);
      closeBookActionSheet();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : UI_TEXT.EXPORT_FAILED);
    }
  }

  async function handleDeleteBook(book: BookRecord) {
    await deleteBook(book.id);
    const updatedBooks = await listBooks();
    setBooks(updatedBooks);
    setReadingProgressMap((map) => {
      const next = { ...map };
      delete next[book.id];
      return next;
    });
    if (openBook?.id === book.id) {
      setOpenBook(null);
      setParagraphs([]);
      setReaderProgressPercent(0);
      setReaderPageInfo({ current: 1, total: 1 });
      setSelectedText(null);
      setActiveTab("library");
    }
    closeBookActionSheet();
  }

  async function handleAddSelectedBooksToGroup(groupId: string) {
    if (selectedBookIds.length === 0) return;
    const selectedSet = new Set(selectedBookIds);
    const selected = books.filter((book) => selectedSet.has(book.id));
    for (const book of selected) {
      const nextGroupIds = [...new Set([...(book.groupIds ?? []), groupId])];
      await updateBookGroupMembership(book.id, nextGroupIds);
    }
    setBooks(await listBooks());
    setBatchGroupSheetOpen(false);
    exitLibraryEditing();
  }

  async function handleCreateBatchGroup() {
    const trimmed = newGroupName.trim();
    if (!trimmed || selectedBookIds.length === 0) return;
    const group: BookGroup = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveBookGroup(group);
    setGroups(await listBookGroups());
    await handleAddSelectedBooksToGroup(group.id);
    setNewGroupName("");
  }

  async function handleCreateCollectionGroup() {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    const group: BookGroup = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveBookGroup(group);
    setGroups(await listBookGroups());
    setNewGroupName("");
    setCollectionCreateSheetOpen(false);
  }

  async function handleDeleteSelectedBooks() {
    if (selectedBookIds.length === 0) return;
    const idsToDelete = [...selectedBookIds];
    for (const id of idsToDelete) {
      await deleteBook(id);
    }
    const updatedBooks = await listBooks();
    setBooks(updatedBooks);
    setReadingProgressMap((map) => {
      const next = { ...map };
      for (const id of idsToDelete) delete next[id];
      return next;
    });
    if (openBook && idsToDelete.includes(openBook.id)) {
      setOpenBook(null);
      setParagraphs([]);
      setReaderProgressPercent(0);
      setReaderPageInfo({ current: 1, total: 1 });
      setSelectedText(null);
      setActiveTab("library");
    }
    exitLibraryEditing();
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    if (!hasIndexedDbSupport(window)) {
      setImportError(UI_TEXT.ERROR_READ_FILE);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    try {
      const record = await createBookRecordFromFile(file);
      await saveBook(record);
      await openBookForReading(record);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : UI_TEXT.IMPORT_FAILED
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const groupFilteredBooks = groupFilter === null
    ? books
    : groupFilter === "__ungrouped"
      ? books.filter((book) => !book.groupIds || book.groupIds.length === 0)
      : books.filter((book) => book.groupIds?.includes(groupFilter));
  const filteredBooks = filterBooksByQuery(
    groupFilteredBooks,
    librarySearchQuery
  );
  const libraryRenderKey = `${groupFilter ?? "__all"}\u0000${librarySearchQuery}\u0000${libraryView}`;
  const visibleBookCount = Math.min(
    filteredBooks.length,
    libraryRenderWindow.key === libraryRenderKey
      ? libraryRenderWindow.count
      : getInitialVisibleItemCount(
          filteredBooks.length,
          LIBRARY_RENDER_BATCH
        )
  );
  const visibleBooks = filteredBooks.slice(0, visibleBookCount);
  const collectionListItems = buildCollectionListItems(
    books, groups, UI_TEXT.ALL_BOOKS, UI_TEXT.UNGROUPED,
  );
  const activeCollectionName =
    collectionListItems.find((item) => item.filter === groupFilter)?.name ?? UI_TEXT.ALL_BOOKS;
  const selectedVisibleCount = filteredBooks.filter((book) => selectedBookIds.includes(book.id)).length;
  const allVisibleSelected = filteredBooks.length > 0 && selectedVisibleCount === filteredBooks.length;
  const selectedCountLabel = UI_TEXT.SELECTED_COUNT.replace("{count}", String(selectedBookIds.length));
  const latestBook = selectFeaturedLibraryBook(books);
  const latestBookProgress = latestBook
    ? getBookProgressPercent(readingProgressMap, latestBook.id)
    : 0;
  const actionSheetBookProgress = bookActionSheetBook
    ? getBookProgressPercent(readingProgressMap, bookActionSheetBook.id)
    : 0;
  const showBottomTabs = shouldShowBottomTabs(activeTab, Boolean(openBook));
  const activeAiProvider = useMemo(
    () => getActiveAiProvider(aiProviderSettings),
    [aiProviderSettings]
  );
  const aiProviderUsable = hasUsableAiProvider(activeAiProvider);
  const todayMinutesValue = formatReadingMinutes(todaySeconds);
  const todayGoalProgress = readingGoal.targetMinutes > 0
    ? Math.min(todayMinutesValue / readingGoal.targetMinutes, 1)
    : 0;
  const goalRingBackground = `conic-gradient(var(--ios-tint) ${Math.round(todayGoalProgress * 360)}deg, rgba(120, 130, 160, 0.18) 0deg)`;
  const readerThemeLabel =
    readerPrefs.theme === "system"
      ? "\u8ddf\u968f\u7cfb\u7edf"
      : readerPrefs.theme === "light"
        ? "\u6d45\u8272"
        : readerPrefs.theme === "sepia"
          ? "\u62a4\u773c"
          : "\u6df1\u8272";
  const todayKey = getLocalDateKey();
  const readingStatsWithToday = readingStats.some((stat) => stat.date === todayKey)
    ? readingStats.map((stat) =>
        stat.date === todayKey ? { ...stat, secondsRead: todaySeconds } : stat
      )
    : [...readingStats, { date: todayKey, secondsRead: todaySeconds, updatedAt: new Date().toISOString() }];
  const weeklyReadingInsights = buildSevenDayReadingInsights(
    readingStatsWithToday,
    todayKey,
    readingGoal.targetMinutes
  );
  const totalMinutesValue = totalReadingMinutes(readingStatsWithToday);
  const paragraphChunks = useMemo(
    () => chunkParagraphs(paragraphs),
    [paragraphs]
  );

  useEffect(() => {
    if (
      activeTab !== "library" ||
      libraryScreen !== "library" ||
      visibleBookCount >= filteredBooks.length
    ) {
      return;
    }
    const target = libraryLoadSentinelRef.current;
    if (!target) return;
    const Observer = (
      window as Window & {
        IntersectionObserver?: typeof IntersectionObserver;
      }
    ).IntersectionObserver;
    if (!Observer) {
      const frame = window.requestAnimationFrame(() => {
        setLibraryRenderWindow({
          key: libraryRenderKey,
          count: filteredBooks.length,
        });
      });
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new Observer(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setLibraryRenderWindow({
          key: libraryRenderKey,
          count: getNextVisibleItemCount(
            visibleBookCount,
            filteredBooks.length,
            LIBRARY_RENDER_BATCH
          ),
        });
      },
      { rootMargin: "480px 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [
    activeTab,
    filteredBooks.length,
    libraryRenderKey,
    libraryScreen,
    visibleBookCount,
  ]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSelectedBookIds((ids) => pruneSelectedBookIds(ids, books.map((book) => book.id)));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [books]);

  const openBookForReading = useCallback(async (book: BookRecord) => {
    const now = new Date().toISOString();
    await saveBook({ ...book, lastOpenedAt: now });
    setBooks(await listBooks());

    setOpenBook(book);
    presentReader();
    scrollRestoredRef.current = false;
    setSelectedText(null);
    setTocItems([]);
    setTocDrawerOpen(false);
    setReaderProgressPercent(0);
    setReaderPageInfo({ current: 1, total: 1 });
    dispatchReaderChrome({ type: "hide" });

    if (book.format === "txt") {
      setReaderLoading(true);
      try {
        const text = await book.fileBlob.text();
        setParagraphs(parseTxtParagraphs(text));
      } catch {
        setParagraphs([UI_TEXT.ERROR_READ_FILE]);
      } finally {
        setReaderLoading(false);
      }
    } else {
      setParagraphs([]);
    }
  }, []);

  useEffect(() => {
    if (autoOpenAttemptedRef.current) return;
    if (!appPrefs.autoOpenLastBook || loading || openBook || books.length === 0) return;

    autoOpenAttemptedRef.current = true;
    const bookToOpen = books[0];
    const timeout = window.setTimeout(() => {
      void openBookForReading(bookToOpen);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [appPrefs.autoOpenLastBook, books, loading, openBook, openBookForReading]);

  useEffect(() => {
    let cancelled = false;

    async function releaseCurrentLock() {
      const current = wakeLockRef.current;
      wakeLockRef.current = null;
      if (current) await current.release().catch(() => undefined);
    }

    async function syncWakeLock() {
      const shouldLock =
        appPrefs.keepScreenAwake &&
        activeTab === "reading" &&
        openBook !== null &&
        document.visibilityState === "visible";

      if (!shouldLock) {
        await releaseCurrentLock();
        return;
      }

      const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock;
      if (!wakeLock) return;

      try {
        await releaseCurrentLock();
        const lock = await wakeLock.request("screen");
        if (cancelled) {
          await lock.release().catch(() => undefined);
          return;
        }
        wakeLockRef.current = lock;
      } catch {
        // Wake Lock is optional browser behavior; unsupported or denied requests stay quiet.
      }
    }

    void syncWakeLock();
    document.addEventListener("visibilitychange", syncWakeLock);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", syncWakeLock);
      void releaseCurrentLock();
    };
  }, [activeTab, appPrefs.keepScreenAwake, openBook]);

  useEffect(() => {
    if (!openBook || openBook.format !== "txt" || paragraphs.length === 0) return;
    if (scrollRestoredRef.current) return;

    const el = readerRef.current;
    if (!el) return;

    getReadingPosition(openBook.id).then((pos) => {
      if (pos && el.scrollHeight > el.clientHeight) {
        el.scrollTop = scrollTopFromProgress(
          pos.progressPercent,
          el.scrollHeight,
          el.clientHeight
        );
        const progress = normalizeProgressPercent(pos.progressPercent);
        setReaderProgressPercent(progress);
        setReaderPageInfo(pageInfoFromScroll(el.scrollTop, el.scrollHeight, el.clientHeight));
        setReadingProgressMap((map) => ({ ...map, [openBook.id]: progress }));
      }
      setReaderPageInfo(pageInfoFromScroll(el.scrollTop, el.scrollHeight, el.clientHeight));
      scrollRestoredRef.current = true;
    });
  }, [openBook, paragraphs]);

  useEffect(() => {
    return () => {
      if (readerScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(readerScrollFrameRef.current);
      }
      if (epubProgressFrameRef.current !== null) {
        window.cancelAnimationFrame(epubProgressFrameRef.current);
      }
      if (readerSaveTimerRef.current !== null) {
        window.clearTimeout(readerSaveTimerRef.current);
      }
      if (readerPresentFrameRef.current !== null) {
        window.cancelAnimationFrame(readerPresentFrameRef.current);
      }
      if (readerPrefsFrameRef.current !== null) {
        window.cancelAnimationFrame(readerPrefsFrameRef.current);
      }
      if (readerPrefsRestoreFrameRef.current !== null) {
        window.cancelAnimationFrame(readerPrefsRestoreFrameRef.current);
      }
      if (readerPrefsSaveTimerRef.current !== null) {
        window.clearTimeout(readerPrefsSaveTimerRef.current);
      }
      if (readerPrefsMotionTimerRef.current !== null) {
        window.clearTimeout(readerPrefsMotionTimerRef.current);
      }
      if (readerSwipeSettleTimerRef.current !== null) {
        window.clearTimeout(readerSwipeSettleTimerRef.current);
      }
      pendingReaderSwipeSettleRef.current = null;
    };
  }, []);

  const handleReaderScroll = useCallback(() => {
    if (!openBook || !readerRef.current) return;
    dispatchReaderChrome({ type: "scroll", at: performance.now() });
    if (readerScrollFrameRef.current !== null) return;

    readerScrollFrameRef.current = window.requestAnimationFrame(() => {
      readerScrollFrameRef.current = null;
      const el = readerRef.current;
      if (!el) return;

      const progressPercent = progressFromScroll(
        el.scrollTop,
        el.scrollHeight,
        el.clientHeight
      );
      const pageInfo = pageInfoFromScroll(el.scrollTop, el.scrollHeight, el.clientHeight);
      setReaderProgressPercent((current) =>
        shouldPublishProgressPercent(current, progressPercent)
          ? progressPercent
          : current
      );
      setReaderPageInfo((current) =>
        current.current === pageInfo.current && current.total === pageInfo.total
          ? current
          : pageInfo
      );
      setReadingProgressMap((map) =>
        shouldPublishProgressPercent(map[openBook.id] ?? 0, progressPercent)
          ? { ...map, [openBook.id]: progressPercent }
          : map
      );

      if (readerSaveTimerRef.current !== null) {
        window.clearTimeout(readerSaveTimerRef.current);
      }
      readerSaveTimerRef.current = window.setTimeout(() => {
        readerSaveTimerRef.current = null;
        void saveReadingPosition({
          bookId: openBook.id,
          locator: "txt-scroll",
          progressPercent,
          updatedAt: new Date().toISOString(),
        });
      }, 180);
    });
  }, [openBook]);

  const handleEpubProgressChange = useCallback(
    (progressValue: number) => {
      pendingEpubProgressRef.current = normalizeProgressPercent(progressValue);
      if (epubProgressFrameRef.current !== null) return;

      epubProgressFrameRef.current = window.requestAnimationFrame(() => {
        epubProgressFrameRef.current = null;
        const progress = pendingEpubProgressRef.current;
        pendingEpubProgressRef.current = null;
        if (progress === null || !openBook) return;

        const pageInfo = pageInfoFromProgress(progress);
        setReaderProgressPercent((current) =>
          shouldPublishProgressPercent(current, progress)
            ? progress
            : current
        );
        setReaderPageInfo((current) =>
          current.current === pageInfo.current && current.total === pageInfo.total
            ? current
            : pageInfo
        );
        setReadingProgressMap((map) =>
          shouldPublishProgressPercent(map[openBook.id] ?? 0, progress)
            ? { ...map, [openBook.id]: progress }
            : map
        );
      });
    },
    [openBook]
  );

  const handleTextSelect = useCallback((): boolean => {
    const selection = window.getSelection();
    if (!selection) return false;
    const text = selection.toString().trim();
    if (text.length > 0) {
      setSelectedText(text);
      dispatchReaderChrome({ type: "selection" });
      return true;
    }
    return false;
  }, []);

  function handleClearSelection() {
    setSelectedText(null);
    const selection = window.getSelection();
    if (selection) selection.removeAllRanges();
  }

  async function handleAsk() {
    if (!question.trim()) return;
    if (!activeAiProvider || !aiProviderUsable) {
      setAskError(UI_TEXT.CONFIGURE_AI_PROMPT);
      return;
    }

    setAskLoading(true);
    setAskError(null);
    setAnswer(null);

    const context: Record<string, string> = {};
    if (openBook) {
      context.bookTitle = openBook.title;
      context.bookFormat = openBook.format;
    }
    if (selectedText) {
      context.selectedText = selectedText;
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: activeAiProvider,
          question: question.trim(),
          context,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `${UI_TEXT.REQUEST_FAILED} (${res.status})`);
      }

      const data = await res.json();
      setAnswer(data.answer);
    } catch (err) {
      setAskError(
        err instanceof Error ? err.message : UI_TEXT.REQUEST_FAILED
      );
    } finally {
      setAskLoading(false);
    }
  }

  async function handleExportBackup() {
    setBackupStatus(null);
    setBackupError(null);
    try {
      const payload = await createBackupPayload();
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ai-reader-backup.json";
      a.click();
      URL.revokeObjectURL(url);
      setBackupStatus(UI_TEXT.BACKUP_EXPORTED);
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : UI_TEXT.EXPORT_FAILED);
    }
  }

  async function handleImportBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupStatus(null);
    setBackupError(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await restoreBackupPayload(data);
      const restoredBooks = await listBooks();
      const restoredPositions = await listReadingPositions();
      setBooks(restoredBooks);
      setReadingProgressMap(buildReadingProgressMap(restoredPositions));
      void backfillMissingBookCovers(restoredBooks, {
        extractCoverImage: extractEpubCoverImage,
        saveBook,
      })
        .then((result) => {
          if (result.updatedCount > 0) {
            setBooks(result.books);
          }
        })
        .catch(() => {
          // Restored EPUBs still work even when cover extraction is unavailable.
        });
      setGroups(await listBookGroups());
      setGroupFilter(null);
      setAiProviderSettings(loadAiProviderSettings());
      setBackupStatus(UI_TEXT.BACKUP_RESTORED);
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : UI_TEXT.IMPORT_FAILED);
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = "";
    }
  }

  function handleToolbarBack() {
    setActiveTab("library");
  }

  const turnReaderPage = useCallback(async (
    direction: ReaderTurnDirection,
    options: { instant?: boolean } = {}
  ) => {
    dispatchReaderChrome({ type: "hide" });
    if (!openBook) return;
    if (openBook.format === "epub") {
      if (direction === "prev") {
        await epubReaderRef.current?.prev();
      } else {
        await epubReaderRef.current?.next();
      }
      return;
    }

    const reader = readerRef.current;
    if (!reader) return;
    const reduceMotion = shouldReduceReaderMotion({
      appPreference: appPrefs.reduceMotion,
      systemPreference: window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches,
    });
    reader.scrollBy({
      top: reader.clientHeight * (direction === "prev" ? -0.85 : 0.85),
      behavior: options.instant || reduceMotion ? "auto" : "smooth",
    });
  }, [appPrefs.reduceMotion, openBook]);

  const toggleReaderChrome = useCallback(() => {
    dispatchReaderChrome({ type: "tap", at: performance.now() });
  }, []);

  const handleTocSelect = useCallback(async (href: string) => {
    await epubReaderRef.current?.goTo(href);
  }, []);

  function handleOpenGoalSheet() {
    setGoalInputValue(readingGoal.targetMinutes);
    setGoalSheetOpen(true);
  }

  function handleSaveGoal() {
    const sanitized = { targetMinutes: goalInputValue };
    saveReadingGoalToStorage(sanitized);
    const saved = loadReadingGoal();
    setReadingGoal(saved);
    setGoalInputValue(saved.targetMinutes);
  }

  const handleReaderPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const reader = readerRef.current;
    let baseOffset = 0;
    if (reader) {
      const transform = window.getComputedStyle(reader).transform;
      if (transform !== "none") {
        try {
          baseOffset = new DOMMatrixReadOnly(transform).m41;
        } catch {
          baseOffset = 0;
        }
      }
      readerSwipeGenerationRef.current += 1;
      if (readerSwipeSettleTimerRef.current !== null) {
        window.clearTimeout(readerSwipeSettleTimerRef.current);
        readerSwipeSettleTimerRef.current = null;
      }
      pendingReaderSwipeSettleRef.current = null;
      reader.classList.remove(styles.readerSwipeSettling);
      reader.style.setProperty("--reader-swipe-x", `${baseOffset}px`);
    }
    readerPointerDownRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
      target: e.target,
      axis: "pending",
      baseOffset,
    };
  }, []);

  const finishReaderSwipeSettle = useCallback(async (generation: number) => {
    const pending = pendingReaderSwipeSettleRef.current;
    if (
      !pending ||
      pending.generation !== generation ||
      generation !== readerSwipeGenerationRef.current
    ) {
      return;
    }
    pendingReaderSwipeSettleRef.current = null;
    if (readerSwipeSettleTimerRef.current !== null) {
      window.clearTimeout(readerSwipeSettleTimerRef.current);
      readerSwipeSettleTimerRef.current = null;
    }
    if (pending.action !== "none") {
      await turnReaderPage(pending.action, { instant: true });
    }
    if (generation !== readerSwipeGenerationRef.current) return;
    const reader = readerRef.current;
    if (!reader) return;
    reader.classList.remove(styles.readerSwipeSettling);
    reader.style.setProperty("--reader-swipe-x", "0px");
  }, [turnReaderPage]);

  const settleReaderSwipe = useCallback((
    action: ReturnType<typeof getReaderSwipeAction>,
    currentOffset: number,
    viewportWidth: number
  ) => {
    const reader = readerRef.current;
    if (!reader) return;
    const generation = ++readerSwipeGenerationRef.current;
    const reduceMotion = shouldReduceReaderMotion({
      appPreference: appPrefs.reduceMotion,
      systemPreference: window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches,
    });
    const duration = reduceMotion ? 0 : action === "none" ? 180 : 160;
    const targetOffset = getReaderSwipeSettleOffset(
      action,
      currentOffset,
      viewportWidth
    );
    reader.classList.remove(styles.readerSwipeTracking);
    reader.classList.add(styles.readerSwipeSettling);
    reader.style.setProperty("--reader-swipe-duration", `${duration}ms`);
    void reader.offsetWidth;
    reader.style.setProperty("--reader-swipe-x", `${targetOffset}px`);
    pendingReaderSwipeSettleRef.current = { generation, action };
    if (readerSwipeSettleTimerRef.current !== null) {
      window.clearTimeout(readerSwipeSettleTimerRef.current);
    }
    if (duration === 0) {
      void finishReaderSwipeSettle(generation);
      return;
    }
    readerSwipeSettleTimerRef.current = window.setTimeout(() => {
      void finishReaderSwipeSettle(generation);
    }, duration + 120);
  }, [appPrefs.reduceMotion, finishReaderSwipeSettle]);

  const handleReaderSwipeTransitionEnd = useCallback(
    (event: React.TransitionEvent<HTMLDivElement>) => {
      if (
        !isReaderSwipeSettleTransition({
          propertyName: event.propertyName,
          targetIsReader: event.target === event.currentTarget,
        })
      ) {
        return;
      }
      const pending = pendingReaderSwipeSettleRef.current;
      if (pending) void finishReaderSwipeSettle(pending.generation);
    },
    [finishReaderSwipeSettle]
  );

  const handleReaderPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const pointerDown = readerPointerDownRef.current;
    const reader = readerRef.current;
    if (!pointerDown || !reader || !appPrefs.swipeToTurn) return;

    const dx = e.clientX - pointerDown.x;
    const dy = e.clientY - pointerDown.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (pointerDown.axis === "pending" && (absX >= 13 || absY >= 13)) {
      pointerDown.axis = absX > absY * 1.25 ? "horizontal" : "vertical";
      if (pointerDown.axis === "horizontal") {
        e.currentTarget.setPointerCapture(e.pointerId);
        reader.classList.remove(styles.readerSwipeSettling);
        reader.classList.add(styles.readerSwipeTracking);
        dispatchReaderChrome({ type: "hide" });
      } else if (hasActiveReaderSwipeOffset(pointerDown.baseOffset)) {
        settleReaderSwipe(
          "none",
          pointerDown.baseOffset,
          e.currentTarget.clientWidth
        );
        pointerDown.baseOffset = 0;
      }
      if (pointerDown.axis === "vertical") {
        dispatchReaderChrome({ type: "scroll", at: performance.now() });
      }
    }

    if (pointerDown.axis !== "horizontal") return;
    e.preventDefault();
    const offset = getReaderSwipeVisualOffset(
      pointerDown.baseOffset + dx,
      e.currentTarget.clientWidth
    );
    reader.style.setProperty("--reader-swipe-x", `${offset}px`);
  }, [appPrefs.swipeToTurn, settleReaderSwipe]);

  const handleReaderPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const pointerDown = readerPointerDownRef.current;
    readerPointerDownRef.current = null;
    if (!pointerDown) return;

    const elapsed = Date.now() - pointerDown.time;
    const dx = e.clientX - pointerDown.x;
    const dy = e.clientY - pointerDown.y;

    if (pointerDown.axis === "horizontal") {
      const swipeAction = getReaderSwipeAction({
        startX: pointerDown.x,
        startY: pointerDown.y,
        endX: e.clientX,
        endY: e.clientY,
      });
      const viewportWidth = e.currentTarget.clientWidth;
      const currentOffset = getReaderSwipeVisualOffset(
        pointerDown.baseOffset + dx,
        viewportWidth
      );
      settleReaderSwipe(swipeAction, currentOffset, viewportWidth);
      return;
    }

    if (pointerDown.axis === "vertical") return;

    if (hasActiveReaderSwipeOffset(pointerDown.baseOffset)) {
      settleReaderSwipe(
        "none",
        pointerDown.baseOffset,
        e.currentTarget.clientWidth
      );
    }

    const target = pointerDown.target;
    if (!(target instanceof HTMLElement)) return;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("select") ||
      target.closest("a") ||
      target.closest('[role="button"]') ||
      target.closest(`.${styles.readerTopBar}`) ||
      target.closest(`.${styles.readerBottomPill}`) ||
      target.closest(`.${styles.readerBottomProgress}`) ||
      target.closest(`.${styles.readerOverlayClose}`) ||
      target.closest(`.${styles.readerTopHint}`) ||
      target.closest(`.${styles.readerPageBadge}`) ||
      target.closest(`.${styles.readerCornerMenuButton}`) ||
      target.closest(`.${styles.readerActionPanel}`) ||
      target.closest(`.${styles.readerGoalMini}`)
    ) {
      return;
    }

    if (handleTextSelect()) return;

    if (appPrefs.swipeToTurn) {
      const swipeAction = getReaderSwipeAction({
        startX: pointerDown.x,
        startY: pointerDown.y,
        endX: e.clientX,
        endY: e.clientY,
      });
      if (swipeAction !== "none") {
        void turnReaderPage(swipeAction);
        return;
      }
    }

    if (
      !isTapGesture({
        durationMs: elapsed,
        deltaX: dx,
        deltaY: dy,
      })
    ) {
      return;
    }

    toggleReaderChrome();
  }, [appPrefs.swipeToTurn, handleTextSelect, settleReaderSwipe, toggleReaderChrome, turnReaderPage]);

  return (
    <div
      className={styles.app}
      {...(readerPrefs.theme !== "system" ? { "data-reader-theme": readerPrefs.theme } : {})}
      {...(appPrefs.reduceMotion ? { "data-reduce-motion": "true" } : {})}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".epub,.txt"
        className={styles.hiddenInput}
        onChange={handleImport}
      />

      <main
        className={`${styles.content} ${
          activeTab === "reading" && openBook ? styles.readingContent : ""
        } ${activeTab === "library" && libraryEditing ? styles.libraryEditingContent : ""}`}
      >
        <div
          className={`${styles.libraryPage} ${
            activeTab === "library"
              ? styles.tabPageActive
              : styles.tabPageInactive
          }`}
          aria-hidden={activeTab !== "library"}
        >
            <div className={styles.pageHeader}>
              <h1 className={styles.libraryTitle}>{UI_TEXT.LIBRARY}</h1>
              <div className={styles.pageHeaderActions}>
                {books.length > 0 && (
                  <button
                    className={styles.libraryTextButton}
                    onClick={libraryEditing ? exitLibraryEditing : enterLibraryEditing}
                  >
                    {libraryEditing ? UI_TEXT.DONE : UI_TEXT.EDIT}
                  </button>
                )}
                {!libraryEditing && (
                  <button
                    className={styles.libraryActionButton}
                    title={UI_TEXT.IMPORT}
                    aria-label={UI_TEXT.IMPORT}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M10 3v10m0 0l-3-3m3 3l3-3M3 17h14" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {UI_TEXT.IMPORT}
                  </button>
                )}
              </div>
            </div>

            {libraryScreen === "collections" ? (
              <div className={styles.collectionsScreen}>
                <div className={styles.collectionsTopBar}>
                  <button
                    className={styles.collectionBackButton}
                    onClick={() => {
                      setLibraryScreen("library");
                      setCollectionsEditing(false);
                      setEditingGroupId(null);
                      setEditingGroupName("");
                    }}
                  >
                    <span aria-hidden="true">‹</span>
                    {UI_TEXT.LIBRARY}
                  </button>
                  <button
                    className={styles.libraryTextButton}
                    onClick={() => {
                      setCollectionsEditing((editing) => !editing);
                      setEditingGroupId(null);
                      setEditingGroupName("");
                    }}
                  >
                    {collectionsEditing ? UI_TEXT.DONE : UI_TEXT.EDIT}
                  </button>
                </div>
                <h2 className={styles.collectionsTitle}>{UI_TEXT.COLLECTIONS}</h2>
                <div className={styles.collectionList}>
                  {collectionListItems.map((item) => {
                    const isActive = groupFilter === item.filter;
                    const customGroupId =
                      typeof item.filter === "string" && item.filter !== "__ungrouped"
                        ? item.filter
                        : null;
                    const isEditingGroup = customGroupId !== null && editingGroupId === customGroupId;
                    return (
                      <div
                        key={item.id}
                        className={`${styles.collectionRow} ${isActive ? styles.collectionRowActive : ""}`}
                      >
                        <button
                          className={styles.collectionRowMain}
                          onClick={() => {
                            if (collectionsEditing) return;
                            setGroupFilter(item.filter);
                            setLibrarySearchQuery("");
                            setLibraryScreen("library");
                          }}
                        >
                          <span className={styles.collectionRowIcon}>
                            {item.filter === null ? (
                              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                                <path d="M4 5.5c2.2-.3 4 .3 6 1.6 2-1.3 3.8-1.9 6-1.6v10.7c-2.2-.3-4 .3-6 1.6-2-1.3-3.8-1.9-6-1.6V5.5Z" />
                                <path d="M10 7.1v10.7" />
                              </svg>
                            ) : item.filter === "__ungrouped" ? (
                              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                                <path d="M5 2.5h7.5L15 5v12.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" />
                                <path d="M12.5 2.5V5h2.5" />
                              </svg>
                            ) : (
                              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                                <path d="M2.5 4.5h5l2 2h8a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1h-14a1 1 0 0 1-1-1v-10.5a1 1 0 0 1 1-1Z" />
                              </svg>
                            )}
                          </span>
                          <span className={styles.collectionRowBody}>
                            {isEditingGroup ? (
                              <input
                                className={styles.collectionRenameInput}
                                value={editingGroupName}
                                onChange={(e) => setEditingGroupName(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && customGroupId) {
                                    void handleRenameGroup(customGroupId);
                                  }
                                }}
                                autoFocus
                              />
                            ) : (
                              <span className={styles.collectionRowName}>{item.name}</span>
                            )}
                            <span className={styles.collectionRowMeta}>{item.count} {UI_TEXT.BOOK_COUNT}</span>
                          </span>
                          {!collectionsEditing && (
                            <span className={styles.collectionRowChevron}>{"\u203a"}</span>
                          )}
                        </button>
                        {collectionsEditing && customGroupId && (
                          <span className={styles.collectionEditActions}>
                            {isEditingGroup ? (
                              <button
                                className={styles.groupEditSave}
                                onClick={() => handleRenameGroup(customGroupId)}
                              >
                                {UI_TEXT.SAVE}
                              </button>
                            ) : (
                              <button
                                className={styles.groupAction}
                                onClick={() => {
                                  setEditingGroupId(customGroupId);
                                  setEditingGroupName(item.name);
                                }}
                              >
                                {UI_TEXT.RENAME}
                              </button>
                            )}
                            <button
                              className={styles.groupActionDelete}
                              onClick={() => handleDeleteGroup(customGroupId)}
                            >
                              {UI_TEXT.DELETE_GROUP}
                            </button>
                          </span>
                        )}
                      </div>
                    );
                  })}
                  <button
                    className={styles.collectionRow}
                    onClick={() => {
                      setNewGroupName("");
                      setCollectionCreateSheetOpen(true);
                    }}
                  >
                    <span className={styles.collectionRowIcon}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                        <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                      </svg>
                    </span>
                    <span className={styles.collectionRowBody}>
                      <span className={styles.collectionRowName}>新建藏书...</span>
                    </span>
                    <span className={styles.collectionRowChevron}>{"\u203a"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
            <button
              className={styles.collectionEntryRow}
              onClick={() => {
                setLibraryScreen("collections");
                setLibraryEditing(false);
                setSelectedBookIds([]);
              }}
            >
              <span className={styles.collectionEntryIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                  <path d="M4 6.5h6.5c1.1 0 2 .9 2 2v9.5H6a2 2 0 0 1-2-2V6.5Z" />
                  <path d="M12.5 8.5c0-1.1.9-2 2-2H21V16a2 2 0 0 1-2 2h-6.5V8.5Z" />
                </svg>
              </span>
              <span className={styles.collectionEntryText}>
                <strong>{UI_TEXT.COLLECTIONS}</strong>
                <small>{books.length} {UI_TEXT.BOOK_COUNT}</small>
              </span>
              <span className={styles.continueChevron}>{"\u203a"}</span>
            </button>

            {books.length > 0 && (
              <div className={styles.librarySearchRow}>
                <label className={styles.librarySearchBox}>
                  <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <circle cx="9" cy="9" r="5.5" />
                    <path d="m13 13 3.5 3.5" strokeLinecap="round" />
                  </svg>
                  <input
                    type="search"
                    value={librarySearchQuery}
                    onChange={(e) => setLibrarySearchQuery(e.target.value)}
                    placeholder={UI_TEXT.SEARCH_LIBRARY_PLACEHOLDER}
                    aria-label={UI_TEXT.SEARCH}
                  />
                </label>
                <div className={styles.libraryViewToggle} aria-label={UI_TEXT.GRID_VIEW}>
                  <button
                    className={libraryView === "grid" ? styles.libraryViewActive : ""}
                    onClick={() => handleLibraryViewChange("grid")}
                    aria-label={UI_TEXT.GRID_VIEW}
                    title={UI_TEXT.GRID_VIEW}
                  >
                    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                      <rect x="3" y="3" width="5" height="5" rx="1" />
                      <rect x="12" y="3" width="5" height="5" rx="1" />
                      <rect x="3" y="12" width="5" height="5" rx="1" />
                      <rect x="12" y="12" width="5" height="5" rx="1" />
                    </svg>
                  </button>
                  <button
                    className={libraryView === "list" ? styles.libraryViewActive : ""}
                    onClick={() => handleLibraryViewChange("list")}
                    aria-label={UI_TEXT.LIST_VIEW}
                    title={UI_TEXT.LIST_VIEW}
                  >
                    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                      <path d="M4 5h12M4 10h12M4 15h12" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className={styles.emptyStateCompact}>
                <p className={styles.emptyText}>{UI_TEXT.LOADING}</p>
              </div>
            ) : books.length === 0 ? (
              <div className={styles.emptyStateCompact}>
                {importError && (
                  <p className={styles.importError}>{importError}</p>
                )}
                <h2 className={styles.emptyTitle}>{UI_TEXT.NO_BOOKS}</h2>
                <p className={styles.emptyText}>
                  {UI_TEXT.NO_BOOKS_HINT}
                </p>
                <button
                  className={styles.primaryButton}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {UI_TEXT.IMPORT}
                </button>
              </div>
            ) : (
              <div className={styles.bookList}>
                {importError && (
                  <p className={styles.importError}>{importError}</p>
                )}
                <div className={styles.sectionHeader}>
                  <h2>{UI_TEXT.RECENT_BOOKS}</h2>
                  {libraryEditing ? (
                    <button className={styles.libraryTextButton} onClick={handleSelectAllVisible}>
                      {allVisibleSelected ? UI_TEXT.CLEAR_SELECTION : UI_TEXT.SELECT_ALL}
                    </button>
                  ) : (
                    <span>{activeCollectionName} · {filteredBooks.length}</span>
                  )}
                </div>
                {libraryEditing && (
                  <p className={styles.selectionSummary}>{selectedCountLabel}</p>
                )}
                {filteredBooks.length === 0 ? (
                  <div className={styles.emptyStateCompact}>
                    <h2 className={styles.emptyTitle}>{UI_TEXT.NO_MATCHING_BOOKS}</h2>
                    <p className={styles.emptyText}>{librarySearchQuery || UI_TEXT.UNGROUPED}</p>
                  </div>
                ) : libraryView === "grid" ? (
                  <div className={styles.bookGrid}>
                    {visibleBooks.map((book) => {
                      const isSelected = selectedBookIds.includes(book.id);
                      const progress = getBookProgressPercent(readingProgressMap, book.id);
                      return (
                        <div
                          key={book.id}
                          className={`${styles.bookGridCell} ${libraryEditing ? styles.bookSelectable : ""} ${
                            isSelected ? styles.bookSelected : ""
                          }`}
                        >
                          <button
                            className={styles.bookGridItem}
                            onClick={() => handleBookPress(book)}
                            aria-pressed={libraryEditing ? isSelected : undefined}
                          >
                            <BookCover
                              title={book.title}
                              format={book.format}
                              coverImageBlob={book.coverImageBlob}
                            />
                            <span className={styles.bookGridTitle}>{book.title}</span>
                            <span className={styles.bookGridProgress} aria-hidden="true">
                              <span style={{ width: `${progress}%` }} />
                            </span>
                            <span className={styles.bookGridMeta}>{formatLibraryProgressLabel(progress)}</span>
                          </button>
                          {libraryEditing ? (
                            <span className={styles.selectionBadge} aria-hidden="true">
                              {isSelected && (
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3.5 8.3 6.7 11.5 12.8 4.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                          ) : (
                            <button
                              className={styles.bookGridMoreButton}
                              title={UI_TEXT.MORE}
                              aria-label={UI_TEXT.MORE_OPTIONS}
                              onClick={() => openBookActionSheet(book)}
                            >
                              <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <circle cx="10" cy="4" r="1.5"/>
                                <circle cx="10" cy="10" r="1.5"/>
                                <circle cx="10" cy="16" r="1.5"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <ul className={styles.bookItems}>
                    {visibleBooks.map((book) => {
                      const isSelected = selectedBookIds.includes(book.id);
                      const progress = getBookProgressPercent(readingProgressMap, book.id);
                      return (
                        <li
                          key={book.id}
                          className={`${styles.bookItem} ${libraryEditing ? styles.bookSelectable : ""} ${
                            isSelected ? styles.bookSelected : ""
                          }`}
                          onClick={() => handleBookPress(book)}
                        >
                          {libraryEditing && (
                            <span className={styles.selectionBadgeInline} aria-hidden="true">
                              {isSelected && (
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3.5 8.3 6.7 11.5 12.8 4.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                          )}
                          <BookCover
                            title={book.title}
                            format={book.format}
                            coverImageBlob={book.coverImageBlob}
                          />
                          <div className={styles.bookInfo}>
                            <span className={styles.bookTitle}>{book.title}</span>
                            <span className={styles.bookMeta}>
                              {book.format.toUpperCase()}{" \u00b7 "}{formatBookSize(book.size)}
                            </span>
                            <span className={styles.bookListProgressRow}>
                              <span className={styles.bookListProgressTrack} aria-hidden="true">
                                <span style={{ width: `${progress}%` }} />
                              </span>
                              <span>{formatLibraryProgressLabel(progress)}</span>
                            </span>
                            {book.groupIds && book.groupIds.length > 0 && (
                              <span className={styles.bookGroupLabels}>
                                {book.groupIds
                                  .map((gid) => groups.find((g) => g.id === gid)?.name)
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            )}
                          </div>
                          {!libraryEditing && (
                            <button
                              className={styles.bookMoreButton}
                              title={UI_TEXT.MORE}
                              aria-label={UI_TEXT.MORE_OPTIONS}
                              onClick={(e) => {
                                e.stopPropagation();
                                openBookActionSheet(book);
                              }}
                            >
                              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                <circle cx="10" cy="4" r="1.5"/>
                                <circle cx="10" cy="10" r="1.5"/>
                                <circle cx="10" cy="16" r="1.5"/>
                              </svg>
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {visibleBookCount < filteredBooks.length && (
                  <div
                    ref={libraryLoadSentinelRef}
                    className={styles.libraryLoadSentinel}
                    aria-hidden="true"
                  />
                )}
              </div>
            )}
              </>
            )}
        </div>

        {openBook && (
            <div
              ref={readerShellRef}
              className={`${styles.readerShell} ${
                activeTab === "reading" ? styles.readerSessionActive : styles.readerSessionInactive
              } ${readerChromeVisible ? "" : styles.readerChromeHidden}`}
              aria-hidden={activeTab !== "reading"}
            >
              <div
                className={styles.readerStage}
                onPointerDown={handleReaderPointerDown}
                onPointerMove={handleReaderPointerMove}
                onPointerUp={handleReaderPointerUp}
                onPointerCancel={() => {
                  const pointerDown = readerPointerDownRef.current;
                  readerPointerDownRef.current = null;
                  const reader = readerRef.current;
                  const viewportWidth = reader?.clientWidth ?? 0;
                  settleReaderSwipe(
                    "none",
                    pointerDown?.baseOffset ?? 0,
                    viewportWidth
                  );
                }}
              >
                {openBook.format === "epub" ? (
                  <EpubReader
                    ref={epubReaderRef}
                    bookId={openBook.id}
                    fileBlob={openBook.fileBlob}
                    getReadingPosition={getReadingPosition}
                    saveReadingPosition={saveReadingPosition}
                    onTextSelect={(text) => setSelectedText(text)}
                    onReaderTap={() => dispatchReaderChrome({ type: "tap", at: performance.now() })}
                    onReaderScrollStart={() => dispatchReaderChrome({ type: "scroll", at: performance.now() })}
                    onSwipeTurn={(direction) =>
                      turnReaderPage(direction, { instant: true })
                    }
                    onTocChange={(items) => setTocItems(items)}
                    onProgressChange={handleEpubProgressChange}
                    preferences={readerPrefs}
                  />
                ) : readerLoading ? (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyText}>{UI_TEXT.LOADING}</p>
                  </div>
                ) : (
                  <div
                    ref={readerRef}
                    className={styles.readerBody}
                    onScroll={handleReaderScroll}
                    onTransitionEnd={handleReaderSwipeTransitionEnd}
                    style={{
                      fontSize: `${readerPrefs.fontSizePx}px`,
                      lineHeight: readerPrefs.lineHeight,
                      maxWidth: `${readerPrefs.contentWidth}px`,
                      margin: "0 auto",
                      width: "100%",
                    }}
                  >
                    {paragraphChunks.map((chunk, chunkIndex) => (
                      <section
                        key={chunkIndex}
                        className={styles.paragraphChunk}
                      >
                        {chunk.map((paragraph, paragraphIndex) => (
                          <p
                            key={`${chunkIndex}-${paragraphIndex}`}
                            className={styles.paragraph}
                          >
                            {paragraph}
                          </p>
                        ))}
                      </section>
                    ))}
                  </div>
                )}
              </div>
              <ReaderControls
                onBack={handleToolbarBack}
                onContents={() => setTocDrawerOpen(true)}
                hasToc={tocItems.length > 0 && openBook.format === "epub"}
                progressPercent={readerProgressPercent}
                currentPage={readerPageInfo.current}
                totalPages={readerPageInfo.total}
                onOpenSettings={() => setReaderSettingsOpen(true)}
                onAsk={() => setAskSheetOpen(true)}
                onOpenGoal={handleOpenGoalSheet}
                bookTitle={openBook.title}
                visible={readerChromeVisible}
                todayMinutes={formatReadingMinutes(todaySeconds)}
                targetMinutes={readingGoal.targetMinutes}
              />
            </div>
        )}

        {activeTab === "reading" && !openBook && (
            <div className={`${styles.readingDashboard} ${styles.pageFade}`}>
              <div className={styles.pageHeader}>
                <h1 className={styles.libraryTitle}>{UI_TEXT.READING}</h1>
              </div>

              <button className={styles.readingGoalCard} onClick={handleOpenGoalSheet}>
                <span
                  className={styles.dashboardGoalRing}
                  style={{ background: goalRingBackground }}
                >
                  <span>{todayMinutesValue}</span>
                  <small>{readingGoal.targetMinutes}</small>
                </span>
                <span className={styles.readingGoalText}>
                  <strong>{UI_TEXT.TODAY_READING}</strong>
                  <small>
                    {UI_TEXT.TODAY_READING_PROGRESS} · {todayMinutesValue}/{readingGoal.targetMinutes} {UI_TEXT.MINUTES}
                  </small>
                </span>
                <span className={styles.continueChevron}>{"\u203a"}</span>
              </button>

              <section className={styles.dashboardSection}>
                <div className={styles.sectionHeader}>
                  <h2>{UI_TEXT.CONTINUE_READING}</h2>
                </div>
                {latestBook ? (
                  <button
                    className={styles.featureBookCard}
                    onClick={() => openBookForReading(latestBook)}
                  >
                    <BookCover
                      title={latestBook.title}
                      format={latestBook.format}
                      coverImageBlob={latestBook.coverImageBlob}
                    />
                    <span className={styles.featureBookText}>
                      <strong>{latestBook.title}</strong>
                      <small>{latestBook.format.toUpperCase()}{" \u00b7 "}{formatBookSize(latestBook.size)}</small>
                      <span className={styles.libraryProgressRow}>
                        <span className={styles.libraryProgressTrack} aria-hidden="true">
                          <span style={{ width: `${latestBookProgress}%` }} />
                        </span>
                        <span>{formatLibraryProgressLabel(latestBookProgress)}</span>
                      </span>
                    </span>
                    <span className={styles.continueChevron}>{"\u203a"}</span>
                  </button>
                ) : (
                  <button
                    className={styles.featureBookCard}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className={styles.emptyCoverMini}>
                      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M5 4h7v18H5V4zm9 0h7v18h-7V4z" />
                        <path d="M12 8h2M12 18h2" />
                      </svg>
                    </span>
                    <span className={styles.featureBookText}>
                      <strong>{UI_TEXT.NO_BOOK_OPEN}</strong>
                      <small>{UI_TEXT.SELECT_BOOK_HINT}</small>
                    </span>
                    <span className={styles.continueChevron}>{"\u203a"}</span>
                  </button>
                )}
              </section>

              <section className={styles.readingWeekCard}>
                <div className={styles.sectionHeader}>
                  <h2>{UI_TEXT.LAST_SEVEN_DAYS}</h2>
                  <span>{UI_TEXT.TOTAL_READING}: {totalMinutesValue} {UI_TEXT.MINUTES}</span>
                </div>
                <div className={styles.weekBars}>
                  {weeklyReadingInsights.map((day) => (
                    <div key={day.date} className={day.isToday ? styles.weekBarToday : ""}>
                      <span className={styles.weekBarTrack}>
                        <span style={{ height: `${Math.max(day.progress * 100, day.minutes > 0 ? 10 : 0)}%` }} />
                      </span>
                      <small>{day.label}</small>
                    </div>
                  ))}
                </div>
              </section>
            </div>
        )}

        {activeTab === "settings" && (
          <div className={styles.settingsPage}>
            <h1 className={styles.libraryTitle}>{UI_TEXT.SETTINGS}</h1>

            <section className={styles.settingsSection}>
              <h2 className={styles.settingsSectionTitle}>{UI_TEXT.APP_PREFERENCES}</h2>
              <div className={styles.settingsNativeList}>
                <label className={styles.settingsSwitchRow}>
                  <span className={styles.settingsRowText}>
                    <strong>{UI_TEXT.AUTO_OPEN_LAST_BOOK}</strong>
                    <small>{UI_TEXT.AUTO_OPEN_LAST_BOOK_HINT}</small>
                  </span>
                  <input
                    type="checkbox"
                    className={styles.iosSwitch}
                    checked={appPrefs.autoOpenLastBook}
                    onChange={(e) =>
                      handleAppPreferencesChange({ autoOpenLastBook: e.target.checked })
                    }
                  />
                </label>

                <label className={styles.settingsSwitchRow}>
                  <span className={styles.settingsRowText}>
                    <strong>{UI_TEXT.KEEP_SCREEN_AWAKE}</strong>
                    <small>{UI_TEXT.KEEP_SCREEN_AWAKE_HINT}</small>
                  </span>
                  <input
                    type="checkbox"
                    className={styles.iosSwitch}
                    checked={appPrefs.keepScreenAwake}
                    onChange={(e) =>
                      handleAppPreferencesChange({ keepScreenAwake: e.target.checked })
                    }
                  />
                </label>

                <label className={styles.settingsSwitchRow}>
                  <span className={styles.settingsRowText}>
                    <strong>{UI_TEXT.REDUCE_MOTION}</strong>
                    <small>{UI_TEXT.REDUCE_MOTION_HINT}</small>
                  </span>
                  <input
                    type="checkbox"
                    className={styles.iosSwitch}
                    checked={appPrefs.reduceMotion}
                    onChange={(e) =>
                      handleAppPreferencesChange({ reduceMotion: e.target.checked })
                    }
                  />
                </label>
              </div>
            </section>

            <section className={styles.settingsSection}>
              <h2 className={styles.settingsSectionTitle}>{UI_TEXT.READING_GESTURES}</h2>
              <div className={styles.settingsNativeList}>
                <label className={styles.settingsSwitchRow}>
                  <span className={styles.settingsRowText}>
                    <strong>{UI_TEXT.SWIPE_TO_TURN}</strong>
                    <small>{UI_TEXT.SWIPE_TO_TURN_HINT}</small>
                  </span>
                  <input
                    type="checkbox"
                    className={styles.iosSwitch}
                    checked={appPrefs.swipeToTurn}
                    onChange={(e) =>
                      handleAppPreferencesChange({ swipeToTurn: e.target.checked })
                    }
                  />
                </label>
              </div>
            </section>

            <section className={styles.settingsSection}>
              <h2 className={styles.settingsSectionTitle}>{UI_TEXT.AI_SETTINGS_TITLE}</h2>
              <div className={styles.settingsNativeList}>
                <button
                  className={styles.settingsNavRow}
                  onClick={() => setAiSettingsSheetOpen(true)}
                >
                  <span className={styles.settingsRowText}>
                    <strong>AI 服务商</strong>
                    <small>
                      {activeAiProvider
                        ? `${activeAiProvider.label} · ${activeAiProvider.model}`
                        : "未配置"}
                    </small>
                  </span>
                  <span className={styles.continueChevron}>{"\u203a"}</span>
                </button>
              </div>
            </section>

            <section className={styles.settingsSection}>
              <h2 className={styles.settingsSectionTitle}>{UI_TEXT.BACKUP}</h2>
              <div className={styles.settingsNativeList}>
                <button
                  className={styles.settingsNavRow}
                  onClick={handleExportBackup}
                >
                  <span className={styles.settingsRowText}>
                    <strong>{UI_TEXT.EXPORT_BACKUP}</strong>
                  </span>
                  <span className={styles.continueChevron}>{"\u203a"}</span>
                </button>
                <button
                  className={styles.settingsNavRow}
                  onClick={() => backupInputRef.current?.click()}
                >
                  <span className={styles.settingsRowText}>
                    <strong>{UI_TEXT.IMPORT_BACKUP}</strong>
                  </span>
                  <span className={styles.continueChevron}>{"\u203a"}</span>
                </button>
                <input
                  ref={backupInputRef}
                  type="file"
                  accept=".json"
                  className={styles.hiddenInput}
                  onChange={handleImportBackup}
                />
              </div>
              {backupStatus && (
                <p className={`${styles.settingsStatusText} ${styles.settingsStatusOk}`}>{backupStatus}</p>
              )}
              {backupError && (
                <p className={`${styles.settingsStatusText} ${styles.settingsStatusErr}`}>{backupError}</p>
              )}
            </section>

            <section className={styles.settingsSection}>
              <h2 className={styles.settingsSectionTitle}>{UI_TEXT.READING}</h2>
              <div className={styles.settingsNativeList}>
                <button
                  className={styles.settingsNavRow}
                  onClick={() => setReaderSettingsOpen(true)}
                >
                  <span className={styles.settingsRowText}>
                    <strong>{UI_TEXT.READER_APPEARANCE}</strong>
                    <small>{readerThemeLabel}</small>
                  </span>
                  <span className={styles.continueChevron}>{"\u203a"}</span>
                </button>
                <button
                  className={styles.settingsNavRow}
                  onClick={handleOpenGoalSheet}
                >
                  <span className={styles.settingsRowText}>
                    <strong>{UI_TEXT.READING_GOAL}</strong>
                    <small>{UI_TEXT.TODAY_READING} {todayMinutesValue}/{readingGoal.targetMinutes} {UI_TEXT.MINUTES}</small>
                  </span>
                  <span className={styles.continueChevron}>{"\u203a"}</span>
                </button>
              </div>
            </section>

          </div>
        )}
      </main>

      {showBottomTabs && (
        <nav className={styles.tabBar}>
          <button
            className={`${styles.tab} ${activeTab === "library" ? styles.activeTab : ""}`}
            onClick={() => {
              setActiveTab("library");
              setLibraryScreen("library");
              setCollectionsEditing(false);
            }}
          >
            <svg className={styles.tabIcon} viewBox="0 0 26 26" aria-hidden="true">
              <rect className={styles.tabIconFill} x="3.5" y="5.2" width="4.6" height="16" rx="1.5" />
              <rect className={styles.tabIconFill} x="10.4" y="4.2" width="4.8" height="17" rx="1.5" />
              <rect className={styles.tabIconFill} x="17.7" y="6.6" width="4.2" height="14.2" rx="1.4" transform="rotate(-7 19.8 13.7)" />
              <rect className={styles.tabIconStroke} x="3.5" y="5.2" width="4.6" height="16" rx="1.5" />
              <rect className={styles.tabIconStroke} x="10.4" y="4.2" width="4.8" height="17" rx="1.5" />
              <rect className={styles.tabIconStroke} x="17.7" y="6.6" width="4.2" height="14.2" rx="1.4" transform="rotate(-7 19.8 13.7)" />
              <path className={styles.tabIconStroke} d="M5.8 9.2v7.6M12.8 8.1v9.2M19.9 10.4l.8 6.1" />
            </svg>
            <span>{UI_TEXT.LIBRARY}</span>
          </button>
          <button
            className={`${styles.tab} ${activeTab === "reading" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("reading")}
          >
            <svg className={styles.tabIcon} viewBox="0 0 26 26" aria-hidden="true">
              <path className={styles.tabIconFill} d="M4.4 5.6c3.3-.4 6 .3 8.6 2.1v14.1c-2.4-1.6-5.2-2.3-8.6-1.8V5.6Z" />
              <path className={styles.tabIconFill} d="M13 7.7c2.6-1.8 5.3-2.5 8.6-2.1V20c-3.4-.5-6.2.2-8.6 1.8V7.7Z" />
              <path className={styles.tabIconStroke} d="M4.4 5.6c3.3-.4 6 .3 8.6 2.1v14.1c-2.4-1.6-5.2-2.3-8.6-1.8V5.6Z" />
              <path className={styles.tabIconStroke} d="M21.6 5.6c-3.3-.4-6 .3-8.6 2.1v14.1c2.4-1.6 5.2-2.3 8.6-1.8V5.6Z" />
              <path className={styles.tabIconStroke} d="M13 7.7v14.1" />
            </svg>
            <span>{UI_TEXT.READING}</span>
          </button>
          <button
            className={`${styles.tab} ${activeTab === "settings" ? styles.activeTab : ""}`}
            onClick={switchToSettings}
          >
            <svg className={styles.tabIcon} viewBox="0 0 26 26" aria-hidden="true">
              <path className={styles.tabIconStroke} d="M5.2 7.4h15.6M5.2 13h15.6M5.2 18.6h15.6" />
              <circle className={styles.tabIconFill} cx="10" cy="7.4" r="2.2" />
              <circle className={styles.tabIconFill} cx="16.2" cy="13" r="2.2" />
              <circle className={styles.tabIconFill} cx="11.8" cy="18.6" r="2.2" />
              <circle className={styles.tabIconStroke} cx="10" cy="7.4" r="2.2" />
              <circle className={styles.tabIconStroke} cx="16.2" cy="13" r="2.2" />
              <circle className={styles.tabIconStroke} cx="11.8" cy="18.6" r="2.2" />
            </svg>
            <span>{UI_TEXT.SETTINGS}</span>
          </button>
        </nav>
      )}

      {activeTab === "library" && libraryEditing && books.length > 0 && (
        <div className={styles.libraryBatchBar}>
          <button className={styles.batchTextButton} onClick={handleSelectAllVisible}>
            {allVisibleSelected ? UI_TEXT.CLEAR_SELECTION : UI_TEXT.SELECT_ALL}
          </button>
          <span>{selectedCountLabel}</span>
          <button
            className={styles.batchTextButton}
            onClick={openBatchGroupSheet}
            disabled={selectedBookIds.length === 0}
          >
            {UI_TEXT.BATCH_ADD_TO_GROUP}
          </button>
          <button
            className={styles.batchDangerButton}
            onClick={() => setBatchDeleteConfirmOpen(true)}
            disabled={selectedBookIds.length === 0}
          >
            {UI_TEXT.BATCH_DELETE}
          </button>
        </div>
      )}

      {readerSettingsOpen && (
        <ReaderSettingsPanel
          preferences={readerPrefs}
          onChange={handleReaderPrefsChange}
          onClose={() => setReaderSettingsOpen(false)}
        />
      )}

      {tocDrawerOpen && (
        <TocDrawer
          items={tocItems}
          onSelect={handleTocSelect}
          onClose={() => setTocDrawerOpen(false)}
        />
      )}

      {aiSettingsSheetOpen && (
        <AiSettingsSheet
          settings={aiProviderSettings}
          onSave={handleAiProviderSettingsSave}
          onClose={() => setAiSettingsSheetOpen(false)}
        />
      )}

      {askSheetOpen && (
        <BottomSheet
          onClose={() => setAskSheetOpen(false)}
          ariaLabel={UI_TEXT.ASK_AI}
        >
          {(close) => (
            <>
            <div className={styles.sheetHeader}>
              <h2 className={styles.sheetTitle}>{UI_TEXT.ASK_AI}</h2>
              <button
                className={styles.iconButton}
                onClick={() => close()}
                title={UI_TEXT.CLOSE}
                aria-label={UI_TEXT.CLOSE}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className={styles.sheetBody}>
              <div className={styles.askSheetInner}>
                <AskAiPanel
                  selectedText={selectedText}
                  question={question}
                  onQuestionChange={setQuestion}
                  answer={answer}
                  loading={askLoading}
                  error={askError}
                  onAsk={handleAsk}
                  onClearSelection={handleClearSelection}
                  aiSettingsUsable={aiProviderUsable}
                  bookTitle={openBook?.title ?? null}
                  onOpenSettings={() => {
                    close(() => {
                      switchToSettings();
                      setAiSettingsSheetOpen(true);
                    });
                  }}
                />
              </div>
            </div>
            </>
          )}
        </BottomSheet>
      )}

      {goalSheetOpen && (
        <ReadingGoalSheet
          todayMinutes={formatReadingMinutes(todaySeconds)}
          targetMinutes={readingGoal.targetMinutes}
          goalInputValue={goalInputValue}
          bookTitle={openBook?.title ?? null}
          onGoalInputChange={setGoalInputValue}
          onSaveGoal={handleSaveGoal}
          onClose={() => setGoalSheetOpen(false)}
          onContinue={() => setGoalSheetOpen(false)}
        />
      )}

      {batchGroupSheetOpen && (
        <BottomSheet
          onClose={() => setBatchGroupSheetOpen(false)}
          ariaLabel={UI_TEXT.ADD_SELECTED_TO_GROUP}
        >
          {(close) => (
            <>
            <div className={styles.sheetHeader}>
              <h2 className={styles.sheetTitle}>{UI_TEXT.ADD_SELECTED_TO_GROUP}</h2>
              <button
                className={styles.iconButton}
                onClick={() => close()}
                title={UI_TEXT.CLOSE}
                aria-label={UI_TEXT.CLOSE}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className={styles.sheetBody}>
              <div className={styles.groupSheetBookTitle}>
                {selectedCountLabel}
              </div>

              {groups.length === 0 ? (
                <div className={styles.groupEmpty}>
                  <p className={styles.emptyText}>{UI_TEXT.NO_GROUPS_YET}</p>
                  <p className={styles.groupEmptyHint}>{UI_TEXT.CREATE_FIRST_GROUP_HINT}</p>
                </div>
              ) : (
                <div className={styles.actionListGroup}>
                  {groups.map((group) => (
                    <button
                      key={group.id}
                      className={styles.actionListRow}
                      onClick={() => close(() => void handleAddSelectedBooksToGroup(group.id))}
                    >
                      <span className={styles.actionIcon}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                          <path d="M4 5h12M4 10h12M4 15h12" strokeLinecap="round" />
                        </svg>
                      </span>
                      <span>{group.name}</span>
                      <small>{UI_TEXT.ADD_TO_THIS_GROUP}</small>
                    </button>
                  ))}
                </div>
              )}

              <div className={styles.groupCreateRow}>
                <input
                  type="text"
                  className={styles.groupCreateInput}
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") close(() => void handleCreateBatchGroup());
                  }}
                  placeholder={UI_TEXT.GROUP_NAME_PLACEHOLDER}
                />
                <button
                  className={styles.groupCreateButton}
                  onClick={() => close(() => void handleCreateBatchGroup())}
                  disabled={!newGroupName.trim()}
                >
                  {UI_TEXT.NEW_GROUP}
                </button>
              </div>
            </div>
            </>
          )}
        </BottomSheet>
      )}

      {batchDeleteConfirmOpen && (
        <BottomSheet
          onClose={() => setBatchDeleteConfirmOpen(false)}
          ariaLabel={UI_TEXT.BATCH_DELETE_CONFIRM_TITLE}
        >
          {(close) => (
            <>
            <div className={styles.sheetHeader}>
              <h2 className={styles.sheetTitle}>{UI_TEXT.BATCH_DELETE_CONFIRM_TITLE}</h2>
              <button
                className={styles.iconButton}
                onClick={() => close()}
                title={UI_TEXT.CLOSE}
                aria-label={UI_TEXT.CLOSE}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className={styles.sheetBody}>
              <div className={styles.deleteConfirmBox}>
                <strong>{selectedCountLabel}</strong>
                <p>{UI_TEXT.BATCH_DELETE_CONFIRM_HINT}</p>
                <div>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => close()}
                  >
                    {UI_TEXT.CANCEL}
                  </button>
                  <button
                    className={styles.dangerButton}
                    onClick={() => close(() => void handleDeleteSelectedBooks())}
                  >
                    {UI_TEXT.BATCH_DELETE}
                  </button>
                </div>
              </div>
            </div>
            </>
          )}
        </BottomSheet>
      )}

      {collectionCreateSheetOpen && (
        <BottomSheet
          onClose={() => setCollectionCreateSheetOpen(false)}
          ariaLabel="新建藏书"
        >
          {(close) => (
            <>
            <div className={styles.sheetHeader}>
              <h2 className={styles.sheetTitle}>新建藏书</h2>
              <button
                className={styles.iconButton}
                onClick={() => close()}
                title={UI_TEXT.CLOSE}
                aria-label={UI_TEXT.CLOSE}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className={styles.sheetBody}>
              <div className={styles.groupCreateRow}>
                <input
                  type="text"
                  className={styles.groupCreateInput}
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") close(() => void handleCreateCollectionGroup());
                  }}
                  placeholder={UI_TEXT.GROUP_NAME_PLACEHOLDER}
                  autoFocus
                />
                <button
                  className={styles.groupCreateButton}
                  onClick={() => close(() => void handleCreateCollectionGroup())}
                  disabled={!newGroupName.trim()}
                >
                  {UI_TEXT.NEW_GROUP}
                </button>
              </div>
            </div>
            </>
          )}
        </BottomSheet>
      )}

      {bookActionSheetBook && (
        <BottomSheet
          onClose={closeBookActionSheet}
          ariaLabel={UI_TEXT.BOOK_ACTIONS}
          className={styles.bookActionSheet}
        >
          {(close) => (
            <>
            <div className={styles.sheetHeader}>
              <h2 className={styles.sheetTitle}>{UI_TEXT.BOOK_ACTIONS}</h2>
              <button
                className={styles.iconButton}
                onClick={() => close()}
                title={UI_TEXT.CLOSE}
                aria-label={UI_TEXT.CLOSE}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className={styles.sheetBody}>
              <div className={styles.bookActionHero}>
                <BookCover
                  title={bookActionSheetBook.title}
                  format={bookActionSheetBook.format}
                  coverImageBlob={bookActionSheetBook.coverImageBlob}
                />
                <div className={styles.bookActionHeroText}>
                  <strong>{bookActionSheetBook.title}</strong>
                  <span>
                    {bookActionSheetBook.format.toUpperCase()} · {formatBookSize(bookActionSheetBook.size)}
                  </span>
                  <span>{formatLibraryProgressLabel(actionSheetBookProgress)}</span>
                </div>
              </div>

              <div className={styles.actionListGroup}>
                <button
                  className={styles.actionListRow}
                  onClick={() => {
                    const book = bookActionSheetBook;
                    close(() => void openBookForReading(book));
                  }}
                >
                  <span className={styles.actionIcon}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                      <path d="M5 4.5c2-.2 3.6.2 5 1.4v10.6c-1.7-1.1-3.4-1.5-5-1.2V4.5Z" />
                      <path d="M10 5.9c1.4-1.2 3-1.6 5-1.4v10.8c-1.6-.3-3.3.1-5 1.2V5.9Z" />
                    </svg>
                  </span>
                  <span>{UI_TEXT.OPEN_BOOK}</span>
                  <span className={styles.continueChevron}>{"\u203a"}</span>
                </button>

                <button
                  className={styles.actionListRow}
                  onClick={() => {
                    const book = bookActionSheetBook;
                    close(() => openGroupSheet(book));
                  }}
                >
                  <span className={styles.actionIcon}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                      <path d="M4 5h12M4 10h12M4 15h12" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span>{UI_TEXT.MANAGE_GROUPS}</span>
                  <span className={styles.continueChevron}>{"\u203a"}</span>
                </button>

                <button
                  className={styles.actionListRow}
                  onClick={() => {
                    const book = bookActionSheetBook;
                    close(() => void handleExportBook(book));
                  }}
                >
                  <span className={styles.actionIcon}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                      <path d="M10 3v9m0 0 3-3m-3 3L7 9" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 16h12" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span>{UI_TEXT.EXPORT_BOOK}</span>
                  <span className={styles.continueChevron}>{"\u203a"}</span>
                </button>
              </div>

              <div className={styles.bookDetailGroup}>
                <h3>{UI_TEXT.BOOK_DETAILS}</h3>
                <div className={styles.bookDetailRow}>
                  <span>{UI_TEXT.FORMAT}</span>
                  <strong>{bookActionSheetBook.format.toUpperCase()}</strong>
                </div>
                <div className={styles.bookDetailRow}>
                  <span>{UI_TEXT.FILE_SIZE}</span>
                  <strong>{formatBookSize(bookActionSheetBook.size)}</strong>
                </div>
                <div className={styles.bookDetailRow}>
                  <span>{UI_TEXT.ADDED_AT}</span>
                  <strong>{formatBookDate(bookActionSheetBook.createdAt)}</strong>
                </div>
                <div className={styles.bookDetailRow}>
                  <span>{UI_TEXT.LAST_OPENED_AT}</span>
                  <strong>{formatBookDate(bookActionSheetBook.lastOpenedAt)}</strong>
                </div>
              </div>

              <div className={styles.actionListGroup}>
                {deleteConfirmOpen ? (
                  <div className={styles.deleteConfirmBox}>
                    <strong>{UI_TEXT.DELETE_BOOK_CONFIRM_TITLE}</strong>
                    <p>{UI_TEXT.DELETE_BOOK_CONFIRM_HINT}</p>
                    <div>
                      <button
                        className={styles.secondaryButton}
                        onClick={() => setDeleteConfirmOpen(false)}
                      >
                        {UI_TEXT.CANCEL}
                      </button>
                      <button
                        className={styles.dangerButton}
                        onClick={() => {
                          const book = bookActionSheetBook;
                          close(() => void handleDeleteBook(book));
                        }}
                      >
                        {UI_TEXT.DELETE_BOOK}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className={`${styles.actionListRow} ${styles.actionListDanger}`}
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    <span className={styles.actionIcon}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <path d="M5 6h10M8 6V4h4v2m-6 0 .7 10h6.6L14 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span>{UI_TEXT.DELETE_BOOK}</span>
                  </button>
                )}
              </div>
            </div>
            </>
          )}
        </BottomSheet>
      )}

      {groupSheetOpen && groupSheetBook && (
        <BottomSheet
          onClose={() => setGroupSheetOpen(false)}
          ariaLabel={UI_TEXT.MANAGE_GROUPS}
        >
          {(close) => (
            <>
            <div className={styles.sheetHeader}>
              <h2 className={styles.sheetTitle}>{UI_TEXT.MANAGE_GROUPS}</h2>
              <button
                className={styles.iconButton}
                onClick={() => close()}
                title={UI_TEXT.CLOSE}
                aria-label={UI_TEXT.CLOSE}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className={styles.sheetBody}>
              <div className={styles.groupSheetBookTitle}>{groupSheetBook.title}</div>

              {groups.length === 0 ? (
                <div className={styles.groupEmpty}>
                  <p className={styles.emptyText}>{UI_TEXT.NO_GROUPS_YET}</p>
                  <p className={styles.groupEmptyHint}>{UI_TEXT.CREATE_FIRST_GROUP_HINT}</p>
                </div>
              ) : (
                <ul className={styles.groupList}>
                  {groups.map((g) => {
                    const isChecked = groupSheetBook.groupIds?.includes(g.id) ?? false;
                    const isEditing = editingGroupId === g.id;
                    return (
                      <li key={g.id} className={styles.groupListItem}>
                        {isEditing ? (
                          <div className={styles.groupEditRow}>
                            <input
                              type="text"
                              className={styles.groupEditInput}
                              value={editingGroupName}
                              onChange={(e) => setEditingGroupName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleRenameGroup(g.id); }}
                              autoFocus
                            />
                            <button
                              className={styles.groupEditSave}
                              onClick={() => handleRenameGroup(g.id)}
                            >
                              {UI_TEXT.SAVE}
                            </button>
                            <button
                              className={styles.groupEditCancel}
                              onClick={() => { setEditingGroupId(null); setEditingGroupName(""); }}
                            >
                              {UI_TEXT.CANCEL}
                            </button>
                          </div>
                        ) : (
                          <div className={styles.groupItemRow}>
                            <label className={styles.groupCheckLabel}>
                              <input
                                type="checkbox"
                                className={styles.groupCheckbox}
                                checked={isChecked}
                                onChange={() => handleToggleGroup(g.id)}
                              />
                              <span className={styles.groupName}>{g.name}</span>
                            </label>
                            <div className={styles.groupItemActions}>
                              <button
                                className={styles.groupAction}
                                onClick={() => {
                                  setEditingGroupId(g.id);
                                  setEditingGroupName(g.name);
                                }}
                                title={UI_TEXT.RENAME}
                                aria-label={UI_TEXT.RENAME}
                              >
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.5 8.5-3.5 1 1-3.5 8.172-8.828z" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                              <button
                                className={styles.groupActionDelete}
                                onClick={() => handleDeleteGroup(g.id)}
                                title={UI_TEXT.DELETE_GROUP}
                                aria-label={UI_TEXT.DELETE_GROUP}
                              >
                                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className={styles.groupCreateRow}>
                <input
                  type="text"
                  className={styles.groupCreateInput}
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateGroup(); }}
                  placeholder={UI_TEXT.GROUP_NAME_PLACEHOLDER}
                />
                <button
                  className={styles.groupCreateButton}
                  onClick={handleCreateGroup}
                  disabled={!newGroupName.trim()}
                >
                  {UI_TEXT.NEW_GROUP}
                </button>
              </div>

              <div className={styles.groupSheetActions}>
                <button className={styles.primaryButton} onClick={() => close()}>
                  {UI_TEXT.DONE}
                </button>
              </div>
            </div>
            </>
          )}
        </BottomSheet>
      )}
    </div>
  );
}
