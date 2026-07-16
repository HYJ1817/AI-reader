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
  type BookRecord, type BookGroup, type DailyReadingStat,
} from "@/lib/db";
import { createBookRecordFromFile } from "@/lib/importBook";
import { extractEpubCoverImage } from "@/lib/epubCover";
import { backfillMissingBookCovers } from "@/lib/bookCoverBackfill";
import {
  chunkParagraphs,
  getHorizontalPageInfo,
  progressFromHorizontalScroll,
  progressFromScroll,
  scrollLeftFromProgress,
  scrollTopFromProgress,
} from "@/lib/txtReader";
import AppNavigation from "@/app/AppNavigation";
import AppMotionRoot from "@/app/AppMotionRoot";
import AppPushSurfaces from "@/app/AppPushSurfaces";
import { NavigationProvider } from "@/app/NavigationProvider";
import NavigationStack, { NavigationRoot } from "@/app/NavigationStack";
import AppOverlays from "@/app/AppOverlays";
import AmbientBookBackground from "@/app/AmbientBookBackground";
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
import { triggerBlobDownload } from "@/lib/browserDownload";
import { hasIndexedDbSupport } from "@/lib/browserStorage";
import {
  DEFAULT_READER_PREFERENCES,
  loadReaderPreferences,
  saveReaderPreferencesToStorage,
  type ReaderPreferences,
} from "@/lib/readerPreferences";
import {
  DEFAULT_APP_PREFERENCES,
  loadAppPreferences,
  saveAppPreferencesToStorage,
  type AppPreferences, type LibraryViewMode,
} from "@/lib/appPreferences";
import {
  normalizeProgressPercent,
  shouldPublishProgressPercent,
} from "@/lib/readerProgress";
import {
  getScrollPageInfo,
  type ReaderPageInfo,
} from "@/lib/readerPageInfo";
import type { EpubTocItem } from "@/lib/epubNavigation";
import { resolveEpubSelectionUpdate } from "@/lib/epubTapInteractions";
import ReadingDashboard from "@/app/ReadingDashboard";
import ReadingSession from "@/app/ReadingSession";
import SharedBookTransition from "@/app/SharedBookTransition";
import SettingsSurface from "@/app/SettingsSurface";
import useAppNavigation from "@/app/useAppNavigation";
import useReaderBookState from "@/app/useReaderBookState";
import { UI_TEXT } from "@/lib/uiText";
import {
  DEFAULT_READER_MODE,
  type ReaderMode,
} from "@/lib/readerMode";
import { filterBooksByQuery } from "@/lib/libraryFilters";
import { buildLibraryHomePresentation } from "@/lib/libraryHomePresentation";
import { getDailyReadingStat, incrementDailyReadingSeconds, listDailyReadingStats } from "@/lib/db";
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
  getReaderSwipeSettleDuration,
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
import type { NavigationTab } from "@/lib/navigationMotion";
import { buildCollectionListItems } from "@/lib/collectionList";
import {
  getInitialVisibleItemCount,
  getNextVisibleItemCount,
} from "@/lib/incrementalList";
import { isScrollIntent, isTapGesture, shouldReduceReaderMotion } from "@/lib/motionInteractions";
import { createReaderChromeState, reduceReaderChromeState } from "@/lib/readerChromeState";
import {
  markReaderControlsDiscovered,
  shouldDiscoverReaderControls,
} from "@/lib/readerControlDiscovery";
import useCustomBackground from "@/app/useCustomBackground";
import { requestPersistentStorage } from "@/lib/storagePersistence";
import useAskAi from "@/app/useAskAi";

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
  const navigation = useAppNavigation();
  const activeTab = navigation.state.activeTab;
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
  const readerEntry = navigation.state.reader;
  const readerPresented = readerEntry !== null;
  const pendingReaderTargetRef = useRef<NavigationTab | null>(null);
  const pendingPushAfterReaderRef = useRef<"ai-providers" | null>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const scrollRestoredRef = useRef(false);
  const [aiProviderSettings, setAiProviderSettings] = useState<AiProviderSettings>(
    DEFAULT_AI_PROVIDER_SETTINGS
  );

  const backupInputRef = useRef<HTMLInputElement>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const [readerPrefs, setReaderPrefs] = useState<ReaderPreferences>(DEFAULT_READER_PREFERENCES);
  const [appPrefs, setAppPrefs] = useState<AppPreferences>(DEFAULT_APP_PREFERENCES);
  const [tocItems, setTocItems] = useState<EpubTocItem[]>([]);
  const [readerProgressPercent, setReaderProgressPercent] = useState(0);
  const [readerPageInfo, setReaderPageInfo] = useState<ReaderPageInfo>({
    current: 1,
    total: 1,
  });
  const [readerMode, setReaderMode] = useState<ReaderMode>(DEFAULT_READER_MODE);
  const epubReaderRef = useRef<EpubReaderHandle>(null);
  const [readerChromeState, dispatchReaderChrome] = useReducer(
    reduceReaderChromeState,
    false,
    createReaderChromeState
  );
  const readerChromeVisible = readerChromeState.visible;
  useEffect(() => {
    if (shouldDiscoverReaderControls()) {
      dispatchReaderChrome({ type: "require-discovery" });
    }
  }, []);
  const {
    openBook,
    paragraphs,
    readerLoading,
    readerModeRestoreProgressRef,
    prepareReaderBook,
    clearReaderBook,
  } = useReaderBookState({
    readerEntry,
    books,
    libraryLoading: loading,
    removeInvalid: navigation.removeInvalid,
    setReaderMode,
    setTocItems,
    setReaderProgressPercent,
    setReaderPageInfo,
    dispatchReaderChrome,
  });
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
  const readerPrefsRestoreFrameRef = useRef<number | null>(null);
  const pendingReaderPrefsRef = useRef<ReaderPreferences | null>(null);
  const readerPrefsGenerationRef = useRef(0);

  const [readingGoal, setReadingGoal] = useState(() => loadReadingGoal());
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [readingStats, setReadingStats] = useState<DailyReadingStat[]>([]);
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
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [libraryView, setLibraryView] = useState<LibraryViewMode>(
    DEFAULT_APP_PREFERENCES.libraryView
  );
  const [libraryEditing, setLibraryEditing] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [collectionsEditing, setCollectionsEditing] = useState(false);
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
        void requestPersistentStorage();
        const [storedBooks, storedPositions] = await withTimeout(
          Promise.all([listBooks(), listReadingPositions()]),
          15000,
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
          readerPresented &&
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
  }, [openBook, readerPresented]);

  useEffect(() => {
    const pendingPush = pendingPushAfterReaderRef.current;
    if (pendingPush) {
      if (navigation.state.sheets.length > 0) return;
      if (readerPresented) {
        navigation.dismissReader();
        return;
      }
      pendingPushAfterReaderRef.current = null;
      pendingReaderTargetRef.current = null;
      navigation.selectTab("settings");
      navigation.push(pendingPush);
      return;
    }

    if (readerPresented) return;
    const targetTab = pendingReaderTargetRef.current;
    pendingReaderTargetRef.current = null;
    if (targetTab) navigation.selectTab(targetTab);
  }, [navigation, readerPresented]);

  function openAiSettingsFromAsk() {
    if (!readerPresented && navigation.state.sheets.length === 0) {
      navigation.selectTab("settings");
      navigation.push("ai-providers");
      return;
    }
    pendingPushAfterReaderRef.current = "ai-providers";
    if (navigation.state.sheets.length > 0) {
      navigation.dismissSheet();
    } else {
      navigation.dismissReader();
    }
  }

  function dismissReader(targetTab?: NavigationTab) {
    if (!readerPresented) {
      if (targetTab) navigation.selectTab(targetTab);
      return;
    }
    pendingReaderTargetRef.current = targetTab ?? null;
    navigation.dismissReader();
  }

  function switchToSettings() {
    dismissReader("settings");
  }

  function handleAiProviderSettingsSave(next: AiProviderSettings) {
    saveAiProviderSettingsToStorage(next);
    setAiProviderSettings(next);
  }

  function handleReaderPrefsChange(prefs: ReaderPreferences) {
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

  const background = useCustomBackground(handleAppPreferencesChange);

  function handleLibraryViewChange(view: LibraryViewMode) {
    setLibraryView(view);
    handleAppPreferencesChange({ libraryView: view });
  }

  const activeSheet = navigation.state.sheets.at(-1);
  const groupSheetBook =
    activeSheet?.route === "book-groups" && activeSheet.entityId
      ? books.find((book) => book.id === activeSheet.entityId) ?? null
      : null;

  function enterLibraryEditing() {
    setLibraryEditing(true);
  }

  function exitLibraryEditing() {
    setLibraryEditing(false);
    setSelectedBookIds([]);
  }

  function handleBookPress(book: BookRecord, originId: string) {
    if (libraryEditing) {
      setSelectedBookIds((ids) => toggleBookSelection(ids, book.id));
      return;
    }
    void openBookForReading(book, originId);
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
    navigation.presentSheet("batch-groups");
  }

  function openBookActionSheet(book: BookRecord) {
    if (libraryEditing) {
      setSelectedBookIds((ids) => toggleBookSelection(ids, book.id));
      return;
    }
    navigation.presentSheet("book-actions", { entityId: book.id });
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
    setBooks(await listBooks());
  }

  async function handleDeleteGroup(groupId: string) {
    await deleteBookGroup(groupId);
    const updatedGroups = await listBookGroups();
    setGroups(updatedGroups);
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
      triggerBlobDownload(exported.blob, exported.fileName);
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
      clearReaderBook();
      resetAskAi();
      navigation.selectTab("library");
    }
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
      clearReaderBook();
      resetAskAi();
      navigation.selectTab("library");
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
      void requestPersistentStorage();
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
  const libraryHomePresentation = buildLibraryHomePresentation({
    books,
    filteredBooks,
    searchQuery: librarySearchQuery,
    groupFilter,
    editing: libraryEditing,
  });
  const libraryShelfBooks = libraryHomePresentation.shelfBooks;
  const libraryRenderKey = `${groupFilter ?? "__all"}\u0000${librarySearchQuery}\u0000${libraryView}\u0000${libraryHomePresentation.featuredBook?.id ?? "__none"}`;
  const visibleBookCount = Math.min(
    libraryShelfBooks.length,
    libraryRenderWindow.key === libraryRenderKey
      ? libraryRenderWindow.count
      : getInitialVisibleItemCount(
          libraryShelfBooks.length,
          LIBRARY_RENDER_BATCH
        )
  );
  const visibleBooks = libraryShelfBooks.slice(0, visibleBookCount);
  const collectionListItems = buildCollectionListItems(
    books, groups, UI_TEXT.ALL_BOOKS, UI_TEXT.UNGROUPED,
  );
  const activeCollectionName =
    collectionListItems.find((item) => item.filter === groupFilter)?.name ?? UI_TEXT.ALL_BOOKS;
  const selectedVisibleCount = libraryShelfBooks.filter((book) =>
    selectedBookIds.includes(book.id)
  ).length;
  const allVisibleSelected =
    libraryShelfBooks.length > 0 &&
    selectedVisibleCount === libraryShelfBooks.length;
  const selectedCountLabel = UI_TEXT.SELECTED_COUNT.replace("{count}", String(selectedBookIds.length));
  const latestBook = selectFeaturedLibraryBook(books);
  const latestBookProgress = latestBook
    ? getBookProgressPercent(readingProgressMap, latestBook.id)
    : 0;
  const showBottomTabs =
    navigation.state.pushes.length === 0 &&
    shouldShowBottomTabs(activeTab, readerPresented);
  const activeAiProvider = useMemo(
    () => getActiveAiProvider(aiProviderSettings),
    [aiProviderSettings]
  );
  const aiProviderUsable = hasUsableAiProvider(activeAiProvider);
  const {
    selectedText,
    setSelectedText,
    question,
    setQuestion,
    messages: askMessages,
    loading: askLoading,
    error: askError,
    reset: resetAskAi,
    clearSelection: handleClearSelection,
    ask: handleAsk,
  } = useAskAi({
    openBook,
    activeAiProvider,
    aiProviderUsable,
    textReaderRef: readerRef,
    epubReaderRef,
  });
  const todayMinutesValue = formatReadingMinutes(todaySeconds);
  const todayGoalProgress = readingGoal.targetMinutes > 0
    ? Math.min(todayMinutesValue / readingGoal.targetMinutes, 1)
    : 0;
  const goalPercent = Math.round(todayGoalProgress * 1000) / 10;
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
      visibleBookCount >= libraryShelfBooks.length
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
          count: libraryShelfBooks.length,
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
            libraryShelfBooks.length,
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
    libraryRenderKey,
    libraryShelfBooks.length,
    visibleBookCount,
  ]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSelectedBookIds((ids) => pruneSelectedBookIds(ids, books.map((book) => book.id)));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [books]);

  const openBookForReading = useCallback(async (
    book: BookRecord,
    originId?: string
  ) => {
    const now = new Date().toISOString();
    await saveBook({ ...book, lastOpenedAt: now });
    const [nextBooks, savedPosition] = await Promise.all([
      listBooks(),
      getReadingPosition(book.id),
    ]);
    setBooks(nextBooks);

    scrollRestoredRef.current = false;
    resetAskAi();
    const contentReady = prepareReaderBook(book, savedPosition);
    navigation.presentReader(book.id, { originId });
    await contentReady;
  }, [navigation, prepareReaderBook, resetAskAi]);

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
        readerPresented &&
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
  }, [appPrefs.keepScreenAwake, openBook, readerPresented]);

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
      setReaderPageInfo(
        readerMode === "paged"
          ? getHorizontalPageInfo(el.scrollLeft, el.scrollWidth, el.clientWidth)
          : getScrollPageInfo(el.scrollTop, el.scrollHeight, el.clientHeight)
      );

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
  }, [openBook, paragraphs, readerMode, readerModeRestoreProgressRef]);

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
      setReaderPageInfo(
        readerMode === "paged"
          ? getHorizontalPageInfo(el.scrollLeft, el.scrollWidth, el.clientWidth)
          : getScrollPageInfo(el.scrollTop, el.scrollHeight, el.clientHeight)
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
  }, [setSelectedText]);

  async function handleExportBackup() {
    setBackupStatus(null);
    setBackupError(null);
    try {
      const payload = await createBackupPayload();
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      triggerBlobDownload(blob, "ai-reader-backup.json");
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
      dismissReader();
      clearReaderBook();
      resetAskAi();
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
      setReadingStats(await listDailyReadingStats());
      await background.reloadCustomBackground();
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
    dismissReader();
  }

  function handleOpenReadingTab() {
    navigation.selectTab("reading");
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
    [openBook, readerMode, readerModeRestoreProgressRef, readerProgressPercent]
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
    if (readerChromeState.discoveryPending) {
      markReaderControlsDiscovered();
    }
    dispatchReaderChrome({ type: "tap", at: performance.now() });
  }, [readerChromeState.discoveryPending]);

  const handleTocSelect = useCallback(async (href: string) => {
    await epubReaderRef.current?.goTo(href);
  }, []);

  function handleOpenGoalSheet() {
    setGoalInputValue(readingGoal.targetMinutes);
    navigation.presentSheet("reading-goal");
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
    const duration = getReaderSwipeSettleDuration(action, reduceMotion);
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
    const pointerIsTap = isTapGesture({
      durationMs: elapsed,
      deltaX: dx,
      deltaY: dy,
      maxDistancePx: 32,
    });

    if (pointerDown.axis === "horizontal" && !pointerIsTap) {
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

    if (pointerDown.axis === "horizontal" && pointerIsTap) {
      const reader = readerRef.current;
      reader?.classList.remove(styles.readerSwipeTracking);
      reader?.style.setProperty("--reader-swipe-x", "0px");
    }

    if (pointerDown.axis === "vertical" && !pointerIsTap) return;

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
      target.closest(`.${styles.readerActionMenu}`) ||
      target.closest(`.${styles.readerPagePill}`)
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

    if (!pointerIsTap) {
      return;
    }

    toggleReaderChrome();
  }, [appPrefs.swipeToTurn, handleTextSelect, settleReaderSwipe, toggleReaderChrome, turnReaderPage]);

  const useCustomBackgroundImage =
    appPrefs.backgroundMode === "custom" && background.customBackgroundBlob !== null;

  const readerContent = (
    <ReadingSession
      book={openBook}
      loading={readerLoading}
      mode={readerMode}
      preferences={readerPrefs}
      pageInfo={readerPageInfo}
      paragraphChunks={paragraphChunks}
      chromeVisible={readerChromeVisible}
      tocItems={tocItems}
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
      onTextSelect={(selection) => {
        const selectionUpdate = resolveEpubSelectionUpdate(selection?.text ?? "");
        setSelectedText(selectionUpdate.selectedText);
        if (selectionUpdate.shouldShowChrome) {
          dispatchReaderChrome({ type: "selection" });
        }
      }}
      onReaderTap={toggleReaderChrome}
      onReaderScrollStart={() =>
        dispatchReaderChrome({ type: "scroll", at: performance.now() })
      }
      onSwipeTurn={(direction) =>
        void turnReaderPage(direction, { instant: true })
      }
      onTocChange={setTocItems}
      onProgressChange={handleEpubProgressChange}
      onPageInfoChange={setReaderPageInfo}
      onTextReaderScroll={handleReaderScroll}
      onSwipeTransitionEnd={handleReaderSwipeTransitionEnd}
      onBack={handleToolbarBack}
      onOpenContents={() => navigation.presentSheet("toc")}
      onOpenSettings={() => navigation.presentSheet("reader-settings")}
      onAsk={() => navigation.presentSheet("ask-ai")}
    />
  );

  return (
    <AppMotionRoot reduceMotion={appPrefs.reduceMotion}>
      <NavigationProvider value={navigation}>
      <div
        className={styles.app}
        data-app-shell="true"
        {...(readerPrefs.theme !== "system" ? { "data-reader-theme": readerPrefs.theme } : {})}
        {...(appPrefs.reduceMotion ? { "data-reduce-motion": "true" } : {})}
      >
      <AmbientBookBackground book={useCustomBackgroundImage ? null : latestBook ?? null} customBackgroundBlob={useCustomBackgroundImage ? background.customBackgroundBlob : null} customBackgroundOpacity={appPrefs.customBackgroundOpacity} reduceMotion={appPrefs.reduceMotion} />
      <input
        ref={fileInputRef}
        type="file"
        accept=".epub,.txt"
        className={styles.hiddenInput}
        onChange={handleImport}
      />

      <SharedBookTransition
        readerEntry={readerEntry}
        book={openBook}
        readerContent={readerContent}
      >
      <main
        className={`${styles.content} ${
          activeTab === "library" && libraryEditing
            ? styles.libraryEditingContent
            : ""
        }`}
      >
        <NavigationStack
          activeTab={activeTab}
          pushes={navigation.state.pushes}
          readerPresented={readerPresented}
          renderPush={(entry) => (
            <AppPushSurfaces
              entry={entry}
              data={{
                collections: {
                  collectionItems: collectionListItems,
                  groupFilter,
                  editing: collectionsEditing,
                  editingGroupId,
                  editingGroupName,
                  onToggleEditing: () => {
                    setCollectionsEditing((editing) => !editing);
                    setEditingGroupId(null);
                    setEditingGroupName("");
                  },
                  onSelectCollection: (filter) => {
                    setGroupFilter(filter);
                    setLibrarySearchQuery("");
                    navigation.pop();
                  },
                  onStartRenamingGroup: (id, name) => {
                    setEditingGroupId(id);
                    setEditingGroupName(name);
                  },
                  onEditingGroupNameChange: setEditingGroupName,
                  onRenameGroup: (id) => void handleRenameGroup(id),
                  onDeleteGroup: (id) => void handleDeleteGroup(id),
                  onOpenCreateCollection: () => {
                    setNewGroupName("");
                    navigation.presentSheet("collection-create");
                  },
                },
                ai: {
                  settings: aiProviderSettings,
                  onSave: handleAiProviderSettingsSave,
                },
                background: {
                  appPreferences: appPrefs,
                  backgroundInputRef: background.backgroundInputRef,
                  customBackgroundPreviewUrl:
                    background.customBackgroundPreviewUrl,
                  onPreferencesChange: handleAppPreferencesChange,
                  onClearBackground: background.handleClearCustomBackground,
                },
              }}
              actions={{
                pop: navigation.pop,
                pushAiProvider: (providerId) =>
                  navigation.push("ai-provider-configure", {
                    entityId: providerId,
                  }),
              }}
            />
          )}
        >
        <NavigationRoot tab="library">
        <LibrarySurface
          className={styles.libraryPage}
          ariaHidden={activeTab !== "library"}
          data={{
            books,
            visibleBooks,
            filteredBookCount: libraryShelfBooks.length,
            featuredBook: libraryHomePresentation.featuredBook,
            featuredLayout: libraryHomePresentation.featuredLayout,
            groups,
            progressMap: readingProgressMap,
            loading,
            importError,
          }}
          view={{
            searchQuery: librarySearchQuery,
            mode: libraryView,
            activeCollectionName,
            groupFilter,
            visibleBookCount,
          }}
          editing={{
            library: libraryEditing,
            selectedBookIds,
            selectedCountLabel,
            allVisibleSelected,
          }}
          sentinelRef={libraryLoadSentinelRef}
          actions={{
            importBooks: () => fileInputRef.current?.click(),
            openCollections: () => {
              navigation.push("collections");
              setLibraryEditing(false);
              setSelectedBookIds([]);
            },
            setSearchQuery: setLibrarySearchQuery,
            setViewMode: handleLibraryViewChange,
            toggleLibraryEditing: libraryEditing
              ? exitLibraryEditing
              : enterLibraryEditing,
            selectAllVisible: handleSelectAllVisible,
            pressBook: handleBookPress,
            openBookActions: openBookActionSheet,
          }}
        />
        </NavigationRoot>
        <NavigationRoot tab="reading">
        <ReadingDashboard
          className={styles.readingDashboard}
          ariaHidden={activeTab !== "reading" || readerPresented}
          todayMinutes={todayMinutesValue}
          targetMinutes={readingGoal.targetMinutes}
          goalPercent={goalPercent}
          totalMinutes={totalMinutesValue}
          insights={weeklyReadingInsights}
          latestBook={latestBook ?? null}
          latestBookProgress={latestBookProgress}
          onOpenGoal={handleOpenGoalSheet}
          onOpenBook={(book, originId) =>
            void openBookForReading(book, originId)
          }
          onImport={() => fileInputRef.current?.click()}
        />
        </NavigationRoot>

        <NavigationRoot tab="settings">
        <SettingsSurface
          className={styles.settingsPage}
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
          backgroundInputRef={background.backgroundInputRef}
          customBackgroundAvailable={background.customBackgroundAvailable}
          onPreferencesChange={handleAppPreferencesChange}
          onBackgroundModeChange={background.handleBackgroundModeChange}
          onImportBackground={background.handleCustomBackgroundImport}
          onOpenCustomBackgroundSettings={() =>
            navigation.push("custom-background")
          }
          onOpenAiProviders={() => navigation.push("ai-providers")}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          onOpenReaderSettings={() =>
            navigation.presentSheet("reader-settings")
          }
          onOpenGoal={handleOpenGoalSheet}
        />
        </NavigationRoot>
        </NavigationStack>
      </main>
      </SharedBookTransition>

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
          setCollectionsEditing(false);
        }}
        onOpenReading={handleOpenReadingTab}
        onOpenSettings={switchToSettings}
        onToggleSelectAll={handleSelectAllVisible}
        onOpenBatchGroup={openBatchGroupSheet}
        onOpenBatchDelete={() => navigation.presentSheet("batch-delete")}
      />

      <AppOverlays
        reader={{
          preferences: readerPrefs,
          tocItems,
          selectedText,
          question,
          messages: askMessages,
          askLoading,
          askError,
          aiUsable: aiProviderUsable,
          bookTitle: openBook?.title ?? null,
          mode: readerMode,
          pageInfo: readerPageInfo,
          todayMinutes: formatReadingMinutes(todaySeconds),
          targetMinutes: readingGoal.targetMinutes,
          goalInputValue,
        }}
        library={{
          books,
          booksLoading: loading,
          progressMap: readingProgressMap,
          groups,
          selectedCountLabel,
          newGroupName,
        }}
        group={{
          editingGroupId,
          editingGroupName,
          newGroupName,
        }}
        actions={{
          changeReaderPreferences: handleReaderPrefsChange,
          changeReaderMode: handleReaderModeChange,
          selectTocItem: handleTocSelect,
          setQuestion,
          ask: () => void handleAsk(),
          clearSelection: handleClearSelection,
          openAiSettingsFromAsk,
          setGoalInputValue,
          saveGoal: handleSaveGoal,
          addSelectedBooksToGroup: (groupId) =>
            void handleAddSelectedBooksToGroup(groupId),
          createBatchGroup: () => void handleCreateBatchGroup(),
          deleteSelectedBooks: () => void handleDeleteSelectedBooks(),
          createCollection: () => void handleCreateCollectionGroup(),
          openBook: (book) => void openBookForReading(book),
          exportBook: (book) => void handleExportBook(book),
          deleteBook: (book) => void handleDeleteBook(book),
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
      </NavigationProvider>
    </AppMotionRoot>
  );
}
