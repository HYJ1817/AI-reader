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
  progressFromHorizontalScroll,
  progressFromScroll,
  scrollLeftFromProgress,
  scrollTopFromProgress,
} from "@/lib/txtReader";
import AppNavigation from "@/app/AppNavigation";
import AppOverlays from "@/app/AppOverlays";
import type { EpubReaderHandle } from "@/app/EpubReader";
import LibrarySurface from "@/app/LibrarySurface";
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
import ReadingDashboard from "@/app/ReadingDashboard";
import ReadingSession from "@/app/ReadingSession";
import SettingsSurface from "@/app/SettingsSurface";
import useReaderPresentation from "@/app/useReaderPresentation";
import { UI_TEXT } from "@/lib/uiText";
import {
  DEFAULT_READER_MODE,
  sanitizeReaderMode,
  type ReaderMode,
} from "@/lib/readerMode";
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
  getBookProgressPercent,
  type ReadingProgressMap,
} from "@/lib/libraryProgress";
import { shouldShowBottomTabs } from "@/lib/navigationVisibility";
import { getNavigationSurfaceState, type NavigationTab } from "@/lib/navigationMotion";
import { buildCollectionListItems } from "@/lib/collectionList";
import {
  getInitialVisibleItemCount,
  getNextVisibleItemCount,
} from "@/lib/incrementalList";
import { isScrollIntent, isTapGesture, shouldReduceReaderMotion } from "@/lib/motionInteractions";
import {
  createReaderChromeState,
  reduceReaderChromeState,
} from "@/lib/readerChromeState";

type Tab = NavigationTab;
type ReaderTurnDirection = "prev" | "next";
const LIBRARY_RENDER_BATCH = 30;

type WakeLockSentinelLike = {
  release: () => Promise<void>;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinelLike>;
  };
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
  const { dismissReader, presentReader, readerPresented } =
    useReaderPresentation(setActiveTab);
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
  const [readerMode, setReaderMode] = useState<ReaderMode>(DEFAULT_READER_MODE);
  const readerModeRestoreProgressRef = useRef<number | null>(null);
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

  function getNavigationSurfaceClass(tab: Tab): string {
    const state = getNavigationSurfaceState(tab, activeTab);
    const stateClass =
      state === "active"
        ? styles.appSurfaceActive
        : state === "before"
          ? styles.appSurfaceBefore
          : styles.appSurfaceAfter;
    return `${styles.appSurface} ${stateClass}`;
  }

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
    dismissReader("settings");
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
          ? readerMode === "paged"
            ? progressFromHorizontalScroll(
                txtReader.scrollLeft,
                txtReader.scrollWidth,
                txtReader.clientWidth
              )
            : progressFromScroll(
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
          if (readerMode === "paged") {
            reader.scrollLeft = scrollLeftFromProgress(
              progressBeforeChange,
              reader.scrollWidth,
              reader.clientWidth
            );
          } else {
            reader.scrollTop = scrollTopFromProgress(
              progressBeforeChange,
              reader.scrollHeight,
              reader.clientHeight
            );
          }
        });
      });
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
      dismissReader();
      setOpenBook(null);
      setParagraphs([]);
      setReaderProgressPercent(0);
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
      dismissReader();
      setOpenBook(null);
      setParagraphs([]);
      setReaderProgressPercent(0);
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
      autoOpenAttemptedRef.current = true;
      setBooks(await listBooks());
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
  const goalRingBackground = `conic-gradient(var(--tint) ${Math.round(todayGoalProgress * 360)}deg, rgba(120, 130, 160, 0.18) 0deg)`;
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
    const [nextBooks, savedPosition] = await Promise.all([
      listBooks(),
      getReadingPosition(book.id),
    ]);
    setBooks(nextBooks);

    setOpenBook(book);
    setReaderMode(sanitizeReaderMode(savedPosition?.readingMode));
    readerModeRestoreProgressRef.current =
      savedPosition?.progressPercent ?? null;
    presentReader();
    scrollRestoredRef.current = false;
    setSelectedText(null);
    setTocItems([]);
    setTocDrawerOpen(false);
    setReaderProgressPercent(0);
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
  }, [presentReader]);

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
    let cancelled = false;

    getReadingPosition(openBook.id).then((pos) => {
      if (cancelled) return;
      const restoreProgress = normalizeProgressPercent(
        readerModeRestoreProgressRef.current ?? pos?.progressPercent ?? 0
      );
      readerModeRestoreProgressRef.current = null;

      if (readerMode === "paged") {
        el.scrollLeft = scrollLeftFromProgress(
          restoreProgress,
          el.scrollWidth,
          el.clientWidth
        );
      } else {
        el.scrollTop = scrollTopFromProgress(
          restoreProgress,
          el.scrollHeight,
          el.clientHeight
        );
      }

      if (pos || restoreProgress > 0) {
        const progress = restoreProgress;
        setReaderProgressPercent(progress);
        setReadingProgressMap((map) => ({ ...map, [openBook.id]: progress }));
      }
      scrollRestoredRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [openBook, paragraphs, readerMode]);

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
    if (readerScrollFrameRef.current !== null) return;

    readerScrollFrameRef.current = window.requestAnimationFrame(() => {
      readerScrollFrameRef.current = null;
      const el = readerRef.current;
      if (!el) return;

      const progressPercent =
        readerMode === "paged"
          ? progressFromHorizontalScroll(
              el.scrollLeft,
              el.scrollWidth,
              el.clientWidth
            )
          : progressFromScroll(
              el.scrollTop,
              el.scrollHeight,
              el.clientHeight
            );
      setReaderProgressPercent((current) =>
        shouldPublishProgressPercent(current, progressPercent)
          ? progressPercent
          : current
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
          locator: readerMode === "paged" ? "txt-paged" : "txt-scroll",
          progressPercent,
          readingMode: readerMode,
          updatedAt: new Date().toISOString(),
        });
      }, 180);
    });
  }, [openBook, readerMode]);

  const handleEpubProgressChange = useCallback(
    (progressValue: number) => {
      pendingEpubProgressRef.current = normalizeProgressPercent(progressValue);
      if (epubProgressFrameRef.current !== null) return;

      epubProgressFrameRef.current = window.requestAnimationFrame(() => {
        epubProgressFrameRef.current = null;
        const progress = pendingEpubProgressRef.current;
        pendingEpubProgressRef.current = null;
        if (progress === null || !openBook) return;

        setReaderProgressPercent((current) =>
          shouldPublishProgressPercent(current, progress)
            ? progress
            : current
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
    dismissReader("library");
  }

  function handleOpenReadingTab() {
    if (openBook) {
      presentReader();
      return;
    }
    setActiveTab("reading");
  }

  const handleReaderModeChange = useCallback(
    (nextMode: ReaderMode) => {
      if (!openBook || nextMode === readerMode) return;

      let progress = readerProgressPercent;
      const reader = readerRef.current;
      if (openBook.format === "txt" && reader) {
        progress =
          readerMode === "paged"
            ? progressFromHorizontalScroll(
                reader.scrollLeft,
                reader.scrollWidth,
                reader.clientWidth
              )
            : progressFromScroll(
                reader.scrollTop,
                reader.scrollHeight,
                reader.clientHeight
              );
        readerModeRestoreProgressRef.current = progress;
        scrollRestoredRef.current = false;
      }

      setReaderMode(nextMode);
      if (openBook.format === "txt") {
        void saveReadingPosition({
          bookId: openBook.id,
          locator: nextMode === "paged" ? "txt-paged" : "txt-scroll",
          progressPercent: progress,
          readingMode: nextMode,
          updatedAt: new Date().toISOString(),
        });
      }
    },
    [openBook, readerMode, readerProgressPercent]
  );

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
    const behavior = options.instant || reduceMotion ? "auto" : "smooth";
    if (readerMode === "paged") {
      reader.scrollBy({
        left: reader.clientWidth * (direction === "prev" ? -1 : 1),
        behavior,
      });
    } else {
      reader.scrollBy({
        top: reader.clientHeight * (direction === "prev" ? -0.85 : 0.85),
        behavior,
      });
    }
  }, [appPrefs.reduceMotion, openBook, readerMode]);

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
    if (!pointerDown || !reader) return;

    const dx = e.clientX - pointerDown.x;
    const dy = e.clientY - pointerDown.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (
      pointerDown.axis === "pending" &&
      isScrollIntent({ deltaX: dx, deltaY: dy })
    ) {
      pointerDown.axis =
        appPrefs.swipeToTurn && absX > absY * 1.25
          ? "horizontal"
          : "vertical";
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
      target.closest(`.${styles.readerOverlayBack}`) ||
      target.closest(`.${styles.readerFloatingTools}`) ||
      target.closest(`.${styles.readerModeMenu}`)
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
          activeTab === "reading" && readerPresented ? styles.readingContent : ""
        } ${activeTab === "library" && libraryEditing ? styles.libraryEditingContent : ""}`}
      >
        <LibrarySurface
          className={`${styles.libraryPage} ${getNavigationSurfaceClass("library")}`}
          ariaHidden={activeTab !== "library"}
          data={{
            books,
            visibleBooks,
            filteredBookCount: filteredBooks.length,
            groups,
            collectionItems: collectionListItems,
            progressMap: readingProgressMap,
            loading,
            importError,
          }}
          view={{
            screen: libraryScreen,
            searchQuery: librarySearchQuery,
            mode: libraryView,
            activeCollectionName,
            groupFilter,
            visibleBookCount,
          }}
          editing={{
            library: libraryEditing,
            collections: collectionsEditing,
            selectedBookIds,
            selectedCountLabel,
            allVisibleSelected,
            editingGroupId,
            editingGroupName,
          }}
          sentinelRef={libraryLoadSentinelRef}
          actions={{
            importBooks: () => fileInputRef.current?.click(),
            openCollections: () => {
              setLibraryScreen("collections");
              setLibraryEditing(false);
              setSelectedBookIds([]);
            },
            closeCollections: () => {
              setLibraryScreen("library");
              setCollectionsEditing(false);
              setEditingGroupId(null);
              setEditingGroupName("");
            },
            toggleCollectionsEditing: () => {
              setCollectionsEditing((editing) => !editing);
              setEditingGroupId(null);
              setEditingGroupName("");
            },
            selectCollection: (filter) => {
              setGroupFilter(filter);
              setLibrarySearchQuery("");
              setLibraryScreen("library");
            },
            setSearchQuery: setLibrarySearchQuery,
            setViewMode: handleLibraryViewChange,
            toggleLibraryEditing: libraryEditing
              ? exitLibraryEditing
              : enterLibraryEditing,
            selectAllVisible: handleSelectAllVisible,
            pressBook: handleBookPress,
            openBookActions: openBookActionSheet,
            startRenamingGroup: (id, name) => {
              setEditingGroupId(id);
              setEditingGroupName(name);
            },
            setEditingGroupName,
            renameGroup: (id) => void handleRenameGroup(id),
            deleteGroup: (id) => void handleDeleteGroup(id),
            openCreateCollection: () => {
              setNewGroupName("");
              setCollectionCreateSheetOpen(true);
            },
          }}
        />
        <ReadingSession
          active={readerPresented && activeTab === "reading"}
          book={openBook}
          loading={readerLoading}
          mode={readerMode}
          preferences={readerPrefs}
          paragraphChunks={paragraphChunks}
          chromeVisible={readerChromeVisible}
          tocItems={tocItems}
          shellRef={readerShellRef}
          textReaderRef={readerRef}
          epubReaderRef={epubReaderRef}
          getReadingPosition={getReadingPosition}
          saveReadingPosition={saveReadingPosition}
          onPointerDown={handleReaderPointerDown}
          onPointerMove={handleReaderPointerMove}
          onPointerUp={handleReaderPointerUp}
          onPointerCancel={() => {
            const pointerDown = readerPointerDownRef.current;
            readerPointerDownRef.current = null;
            const viewportWidth = readerRef.current?.clientWidth ?? 0;
            settleReaderSwipe(
              "none",
              pointerDown?.baseOffset ?? 0,
              viewportWidth
            );
          }}
          onTextSelect={setSelectedText}
          onReaderTap={() =>
            dispatchReaderChrome({ type: "tap", at: performance.now() })
          }
          onReaderScrollStart={() =>
            dispatchReaderChrome({ type: "scroll", at: performance.now() })
          }
          onSwipeTurn={(direction) =>
            void turnReaderPage(direction, { instant: true })
          }
          onTocChange={setTocItems}
          onProgressChange={handleEpubProgressChange}
          onTextReaderScroll={handleReaderScroll}
          onSwipeTransitionEnd={handleReaderSwipeTransitionEnd}
          onBack={handleToolbarBack}
          onOpenContents={() => setTocDrawerOpen(true)}
          onOpenSettings={() => setReaderSettingsOpen(true)}
          onAsk={() => setAskSheetOpen(true)}
          onModeChange={handleReaderModeChange}
        />

        <ReadingDashboard
          className={`${styles.readingDashboard} ${getNavigationSurfaceClass("reading")} ${
            readerPresented ? styles.readingDashboardReaderOpen : ""
          }`}
          ariaHidden={activeTab !== "reading" || readerPresented}
          todayMinutes={todayMinutesValue}
          targetMinutes={readingGoal.targetMinutes}
          goalRingBackground={goalRingBackground}
          totalMinutes={totalMinutesValue}
          insights={weeklyReadingInsights}
          latestBook={latestBook ?? null}
          latestBookProgress={latestBookProgress}
          onOpenGoal={handleOpenGoalSheet}
          onOpenBook={(book) => void openBookForReading(book)}
          onImport={() => fileInputRef.current?.click()}
        />

        <SettingsSurface
          className={`${styles.settingsPage} ${getNavigationSurfaceClass("settings")}`}
          ariaHidden={activeTab !== "settings"}
          appPreferences={appPrefs}
          activeProviderLabel={
            activeAiProvider
              ? `${activeAiProvider.label} · ${activeAiProvider.model}`
              : null
          }
          readerThemeLabel={readerThemeLabel}
          todayMinutes={todayMinutesValue}
          targetMinutes={readingGoal.targetMinutes}
          backupStatus={backupStatus}
          backupError={backupError}
          backupInputRef={backupInputRef}
          onPreferencesChange={handleAppPreferencesChange}
          onOpenAiSettings={() => setAiSettingsSheetOpen(true)}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          onOpenReaderSettings={() => setReaderSettingsOpen(true)}
          onOpenGoal={handleOpenGoalSheet}
        />
      </main>

      <AppNavigation
        activeTab={activeTab}
        showBottomTabs={showBottomTabs}
        showLibraryBatchBar={
          activeTab === "library" && libraryEditing && books.length > 0
        }
        allVisibleSelected={allVisibleSelected}
        selectedCountLabel={selectedCountLabel}
        hasSelection={selectedBookIds.length > 0}
        onOpenLibrary={() => {
          dismissReader("library");
          setLibraryScreen("library");
          setCollectionsEditing(false);
        }}
        onOpenReading={handleOpenReadingTab}
        onOpenSettings={switchToSettings}
        onToggleSelectAll={handleSelectAllVisible}
        onOpenBatchGroup={openBatchGroupSheet}
        onOpenBatchDelete={() => setBatchDeleteConfirmOpen(true)}
      />

      <AppOverlays
        reader={{
          settingsOpen: readerSettingsOpen,
          preferences: readerPrefs,
          tocOpen: tocDrawerOpen,
          tocItems,
          askOpen: askSheetOpen,
          selectedText,
          question,
          answer,
          askLoading,
          askError,
          aiUsable: aiProviderUsable,
          bookTitle: openBook?.title ?? null,
          goalOpen: goalSheetOpen,
          todayMinutes: formatReadingMinutes(todaySeconds),
          targetMinutes: readingGoal.targetMinutes,
          goalInputValue,
        }}
        ai={{
          settingsOpen: aiSettingsSheetOpen,
          settings: aiProviderSettings,
        }}
        library={{
          groups,
          selectedCountLabel,
          newGroupName,
          batchGroupOpen: batchGroupSheetOpen,
          batchDeleteOpen: batchDeleteConfirmOpen,
          createCollectionOpen: collectionCreateSheetOpen,
        }}
        bookAction={{
          book: bookActionSheetBook,
          progress: actionSheetBookProgress,
          deleteConfirmOpen,
        }}
        group={{
          open: groupSheetOpen,
          book: groupSheetBook,
          groups,
          editingGroupId,
          editingGroupName,
          newGroupName,
        }}
        actions={{
          closeReaderSettings: () => setReaderSettingsOpen(false),
          changeReaderPreferences: handleReaderPrefsChange,
          closeToc: () => setTocDrawerOpen(false),
          selectTocItem: handleTocSelect,
          closeAiSettings: () => setAiSettingsSheetOpen(false),
          saveAiSettings: handleAiProviderSettingsSave,
          closeAsk: () => setAskSheetOpen(false),
          setQuestion,
          ask: () => void handleAsk(),
          clearSelection: handleClearSelection,
          openAiSettingsFromAsk: () => {
            switchToSettings();
            setAiSettingsSheetOpen(true);
          },
          closeGoal: () => setGoalSheetOpen(false),
          setGoalInputValue,
          saveGoal: handleSaveGoal,
          closeBatchGroup: () => setBatchGroupSheetOpen(false),
          addSelectedBooksToGroup: (groupId) =>
            void handleAddSelectedBooksToGroup(groupId),
          createBatchGroup: () => void handleCreateBatchGroup(),
          closeBatchDelete: () => setBatchDeleteConfirmOpen(false),
          deleteSelectedBooks: () => void handleDeleteSelectedBooks(),
          closeCreateCollection: () => setCollectionCreateSheetOpen(false),
          createCollection: () => void handleCreateCollectionGroup(),
          closeBookActions: closeBookActionSheet,
          openBook: (book) => void openBookForReading(book),
          openGroupSheet,
          exportBook: (book) => void handleExportBook(book),
          setDeleteConfirmOpen,
          deleteBook: (book) => void handleDeleteBook(book),
          closeGroupSheet: () => setGroupSheetOpen(false),
          toggleBookGroup: (groupId) => void handleToggleGroup(groupId),
          setEditingGroup: (groupId, name) => {
            setEditingGroupId(groupId);
            setEditingGroupName(name);
          },
          setEditingGroupName,
          renameGroup: (groupId) => void handleRenameGroup(groupId),
          deleteGroup: (groupId) => void handleDeleteGroup(groupId),
          setNewGroupName,
          createGroup: () => void handleCreateGroup(),
        }}
      />
    </div>
  );
}
