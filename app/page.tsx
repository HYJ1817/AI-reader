"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  parseTxtParagraphs,
  progressFromScroll,
  scrollTopFromProgress,
} from "@/lib/txtReader";
import BookCover from "@/app/BookCover";
import EpubReader from "@/app/EpubReader";
import type { EpubReaderHandle } from "@/app/EpubReader";
import {
  DEFAULT_AI_SETTINGS,
  sanitizeAiSettings,
  hasUsableAiSettings,
  loadAiSettings,
  saveAiSettingsToStorage,
  clearAiSettingsFromStorage,
  type AiClientSettings,
} from "@/lib/aiSettings";
import { createBackupPayload, restoreBackupPayload } from "@/lib/backup";
import { createBookFileExport } from "@/lib/bookFileExport";
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
  type AppPreferences,
  type LibraryViewMode,
} from "@/lib/appPreferences";
import { normalizeProgressPercent } from "@/lib/readerProgress";
import type { EpubTocItem } from "@/lib/epubNavigation";
import ReaderControls from "@/app/ReaderControls";
import ReaderSettingsPanel from "@/app/ReaderSettingsPanel";
import TocDrawer from "@/app/TocDrawer";
import AskAiPanel from "@/app/AskAiPanel";
import ReadingGoalSheet from "@/app/ReadingGoalSheet";
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
import { getReaderTapAction, type ReaderTapAction } from "@/lib/readerTapZones";
import { getReaderSwipeAction } from "@/lib/readerSwipe";
import {
  selectFeaturedLibraryBook,
  selectRecentShelfBooks,
} from "@/lib/libraryShelves";
import { buildLibraryDashboard } from "@/lib/libraryDashboard";
import {
  buildReadingProgressMap,
  formatLibraryProgressLabel,
  getBookProgressPercent,
  type ReadingProgressMap,
} from "@/lib/libraryProgress";
import { shouldShowBottomTabs } from "@/lib/navigationVisibility";
import { buildCollectionListItems } from "@/lib/collectionList";
import {
  formatAiStatus,
  formatSettingsBookCount,
  formatSettingsReadingMinutes,
  SETTINGS_APP_VERSION,
} from "@/lib/settingsDisplay";

type Tab = "library" | "reading" | "settings";
type ReaderTurnDirection = Exclude<ReaderTapAction, "chrome">;

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
  const [readingProgressMap, setReadingProgressMap] = useState<ReadingProgressMap>({});
  const [loading, setLoading] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [openBook, setOpenBook] = useState<BookRecord | null>(null);
  const [paragraphs, setParagraphs] = useState<string[]>([]);
  const [readerLoading, setReaderLoading] = useState(false);
  const readerRef = useRef<HTMLDivElement>(null);
  const scrollRestoredRef = useRef(false);

  const [aiSettings, setAiSettings] = useState<AiClientSettings>(DEFAULT_AI_SETTINGS);
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formModel, setFormModel] = useState("");

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
  const epubReaderRef = useRef<EpubReaderHandle>(null);
  const [readerChromeVisible, setReaderChromeVisible] = useState(true);
  const [readerTurnFeedback, setReaderTurnFeedback] = useState<{
    direction: ReaderTurnDirection;
    id: number;
  } | null>(null);
  const readerTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const readerSwipeHandledRef = useRef(false);
  const [askSheetOpen, setAskSheetOpen] = useState(false);

  const [readingGoal, setReadingGoal] = useState(() => loadReadingGoal());
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [readingStats, setReadingStats] = useState<DailyReadingStat[]>([]);
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);
  const [goalInputValue, setGoalInputValue] = useState(readingGoal.targetMinutes);
  const tickRef = useRef<{ date: string; lastVis: boolean }>({ date: "", lastVis: false });

  const [groups, setGroups] = useState<BookGroup[]>([]);
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
      setAiSettings(loadAiSettings());
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
    listBookGroups().then(setGroups);
  }, []);

  useEffect(() => {
    const dateKey = getLocalDateKey();
    getDailyReadingStat(dateKey).then((stat) => {
      setTodaySeconds(stat?.secondsRead ?? 0);
    });
    listDailyReadingStats().then(setReadingStats);
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      const dateKey = getLocalDateKey();
      if (tickRef.current.date !== dateKey) {
        tickRef.current.date = dateKey;
        const stat = await getDailyReadingStat(dateKey);
        setTodaySeconds(stat?.secondsRead ?? 0);
      }
      const isVisible = document.visibilityState === "visible";
      const shouldCount =
        activeTab === "reading" &&
        openBook !== null &&
        isVisible;
      if (shouldCount && tickRef.current.lastVis) {
        await incrementDailyReadingSeconds(dateKey, 1);
        setTodaySeconds((prev) => prev + 1);
        setReadingStats((prev) => {
          const now = new Date().toISOString();
          const existing = prev.find((stat) => stat.date === dateKey);
          if (existing) {
            return prev.map((stat) =>
              stat.date === dateKey
                ? { ...stat, secondsRead: stat.secondsRead + 1, updatedAt: now }
                : stat
            );
          }
          return [...prev, { date: dateKey, secondsRead: 1, updatedAt: now }];
        });
      }
      tickRef.current.lastVis = shouldCount;
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTab, openBook]);

  function switchToSettings() {
    setFormBaseUrl(aiSettings.baseUrl);
    setFormApiKey(aiSettings.apiKey);
    setFormModel(aiSettings.model);
    setActiveTab("settings");
  }

  function handleSaveSettings() {
    const sanitized = sanitizeAiSettings({
      baseUrl: formBaseUrl,
      apiKey: formApiKey,
      model: formModel,
    });
    saveAiSettingsToStorage(sanitized);
    setAiSettings(sanitized);
  }

  function handleClearSettings() {
    clearAiSettingsFromStorage();
    setAiSettings(DEFAULT_AI_SETTINGS);
    setFormBaseUrl("");
    setFormApiKey("");
    setFormModel("");
  }

  function handleReaderPrefsChange(prefs: ReaderPreferences) {
    setReaderPrefs(prefs);
    saveReaderPreferencesToStorage(prefs);
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
      ? books.filter((b) => !b.groupIds || b.groupIds.length === 0)
      : books.filter((b) => b.groupIds?.includes(groupFilter));
  const filteredBooks = filterBooksByQuery(groupFilteredBooks, librarySearchQuery);
  const collectionListItems = buildCollectionListItems(
    books, groups, UI_TEXT.ALL_BOOKS, UI_TEXT.UNGROUPED,
  );
  const activeCollectionName =
    collectionListItems.find((item) => item.filter === groupFilter)?.name ?? UI_TEXT.ALL_BOOKS;
  const selectedVisibleCount = filteredBooks.filter((book) => selectedBookIds.includes(book.id)).length;
  const allVisibleSelected = filteredBooks.length > 0 && selectedVisibleCount === filteredBooks.length;
  const selectedCountLabel = UI_TEXT.SELECTED_COUNT.replace("{count}", String(selectedBookIds.length));
  const latestBook = selectFeaturedLibraryBook(books);
  const recentShelfBooks = selectRecentShelfBooks(books, {
    excludeId: latestBook?.id,
    limit: 8,
  });
  const latestBookProgress = latestBook
    ? getBookProgressPercent(readingProgressMap, latestBook.id)
    : 0;
  const actionSheetBookProgress = bookActionSheetBook
    ? getBookProgressPercent(readingProgressMap, bookActionSheetBook.id)
    : 0;
  const showBottomTabs = shouldShowBottomTabs(activeTab, Boolean(openBook));
  const todayMinutesValue = formatReadingMinutes(todaySeconds);
  const todayGoalProgress = readingGoal.targetMinutes > 0
    ? Math.min(todayMinutesValue / readingGoal.targetMinutes, 1)
    : 0;
  const goalRingBackground = `conic-gradient(var(--ios-tint) ${Math.round(todayGoalProgress * 360)}deg, rgba(120, 130, 160, 0.18) 0deg)`;
  const libraryDashboard = buildLibraryDashboard({
    bookCount: books.length,
    groupCount: groups.length,
    todayMinutes: todayMinutesValue,
    targetMinutes: readingGoal.targetMinutes,
    featuredTitle: latestBook?.title,
  });
  const libraryGoalBackground = `conic-gradient(var(--ios-tint) ${Math.round(libraryDashboard.goalPercent * 3.6)}deg, rgba(120, 130, 160, 0.18) 0deg)`;
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
    setActiveTab("reading");
    scrollRestoredRef.current = false;
    setSelectedText(null);
    setTocItems([]);
    setTocDrawerOpen(false);
    setReaderProgressPercent(0);
    setReaderChromeVisible(true);

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
        setReadingProgressMap((map) => ({ ...map, [openBook.id]: progress }));
      }
      scrollRestoredRef.current = true;
    });
  }, [openBook, paragraphs]);

  const handleReaderScroll = useCallback(() => {
    if (!openBook || !readerRef.current) return;
    const el = readerRef.current;
    const progressPercent = progressFromScroll(
      el.scrollTop,
      el.scrollHeight,
      el.clientHeight
    );
    const updatedAt = new Date().toISOString();
    setReaderProgressPercent(progressPercent);
    setReadingProgressMap((map) => ({ ...map, [openBook.id]: progressPercent }));
    saveReadingPosition({
      bookId: openBook.id,
      locator: "txt-scroll",
      progressPercent,
      updatedAt,
    });
  }, [openBook]);

  const handleTextSelect = useCallback(() => {
    const selection = window.getSelection();
    if (!selection) return;
    const text = selection.toString().trim();
    if (text.length > 0) {
      setSelectedText(text);
      setReaderChromeVisible(true);
    }
  }, []);

  function handleClearSelection() {
    setSelectedText(null);
    const selection = window.getSelection();
    if (selection) selection.removeAllRanges();
  }

  async function handleAsk() {
    if (!question.trim()) return;
    if (!hasUsableAiSettings(aiSettings)) {
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
          baseUrl: aiSettings.baseUrl,
          apiKey: aiSettings.apiKey,
          model: aiSettings.model,
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
      setAiSettings(loadAiSettings());
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

  const handleToolbarPrev = useCallback(async () => {
    if (!openBook) return;
    if (openBook.format === "epub") {
      await epubReaderRef.current?.prev();
    } else if (readerRef.current) {
      const el = readerRef.current;
      el.scrollTop -= el.clientHeight * 0.85;
    }
  }, [openBook]);

  const handleToolbarNext = useCallback(async () => {
    if (!openBook) return;
    if (openBook.format === "epub") {
      await epubReaderRef.current?.next();
    } else if (readerRef.current) {
      const el = readerRef.current;
      el.scrollTop += el.clientHeight * 0.85;
    }
  }, [openBook]);

  const showReaderTurnFeedback = useCallback((direction: ReaderTurnDirection) => {
    const id = Date.now();
    setReaderTurnFeedback({ direction, id });
    window.setTimeout(() => {
      setReaderTurnFeedback((current) => (current?.id === id ? null : current));
    }, 260);
  }, []);

  const turnReaderPage = useCallback((direction: ReaderTurnDirection) => {
    setReaderChromeVisible(false);
    showReaderTurnFeedback(direction);
    if (direction === "prev") {
      void handleToolbarPrev();
      return;
    }
    void handleToolbarNext();
  }, [handleToolbarNext, handleToolbarPrev, showReaderTurnFeedback]);

  const handleTocSelect = useCallback(async (href: string) => {
    setTocDrawerOpen(false);
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

  const handleReaderStageTap = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (readerSwipeHandledRef.current) {
      readerSwipeHandledRef.current = false;
      return;
    }
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("a") ||
      target.closest('[role="button"]') ||
      target.closest(`.${styles.readerTopBar}`) ||
      target.closest(`.${styles.readerBottomPill}`)
    ) {
      return;
    }
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const action = getReaderTapAction({
      clientX: e.clientX,
      left: rect.left,
      width: rect.width,
    });

    if (appPrefs.edgeTapToTurn && action === "prev") {
      turnReaderPage("prev");
      return;
    }
    if (appPrefs.edgeTapToTurn && action === "next") {
      turnReaderPage("next");
      return;
    }

    setReaderChromeVisible((v) => !v);
  }, [appPrefs.edgeTapToTurn, turnReaderPage]);

  const handleReaderTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    readerTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
    readerSwipeHandledRef.current = false;
  }, []);

  const handleReaderTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    handleTextSelect();
    const start = readerTouchStartRef.current;
    readerTouchStartRef.current = null;
    if (!start) return;
    if (!appPrefs.swipeToTurn) return;

    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("a") ||
      target.closest('[role="button"]') ||
      target.closest(`.${styles.readerTopBar}`) ||
      target.closest(`.${styles.readerBottomPill}`)
    ) {
      return;
    }
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) return;

    const touch = e.changedTouches[0];
    if (!touch) return;
    const action = getReaderSwipeAction({
      startX: start.x,
      startY: start.y,
      endX: touch.clientX,
      endY: touch.clientY,
    });
    if (action === "none") return;

    readerSwipeHandledRef.current = true;
    turnReaderPage(action);
  }, [appPrefs.swipeToTurn, handleTextSelect, turnReaderPage]);

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
        {activeTab === "library" && (
          <div className={`${styles.libraryPage} ${styles.pageFade}`}>
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

            <section className={styles.libraryOverviewPanel}>
              <div className={styles.libraryOverviewCopy}>
                <span className={styles.libraryOverviewEyebrow}>本地书库</span>
                <strong>{libraryDashboard.title}</strong>
                <small>{libraryDashboard.subtitle}</small>
              </div>

              <button className={styles.libraryOverviewGoal} onClick={handleOpenGoalSheet}>
                <span
                  className={styles.libraryOverviewGoalRing}
                  style={{ background: libraryGoalBackground }}
                  aria-hidden="true"
                >
                  <span>{todayMinutesValue}</span>
                  <small>{readingGoal.targetMinutes}</small>
                </span>
                <span className={styles.libraryOverviewGoalText}>
                  <strong>{UI_TEXT.READING_GOAL}</strong>
                  <small>{libraryDashboard.goalText}</small>
                </span>
                <span className={styles.continueChevron}>{"\u203a"}</span>
              </button>

              <div className={styles.libraryOverviewStats}>
                {libraryDashboard.stats.map((stat) => (
                  <span key={stat.label}>
                    <strong>{stat.value}</strong>
                    <small>{stat.label}</small>
                  </span>
                ))}
              </div>
            </section>

            <section className={styles.libraryHero}>
              <div className={styles.sectionHeader}>
                <h2>{UI_TEXT.CURRENT_READING}</h2>
              </div>
              {latestBook ? (
                <button
                  className={`${styles.continueCard} ${styles.continueHeroCard}`}
                  onClick={() => openBookForReading(latestBook)}
                >
                  <span className={styles.continueCoverFrame}>
                    <BookCover
                      title={latestBook.title}
                      format={latestBook.format}
                      coverImageBlob={latestBook.coverImageBlob}
                    />
                  </span>
                  <span className={styles.continueCardText}>
                    <span className={styles.continueKicker}>{UI_TEXT.CONTINUE_READING}</span>
                    <strong>{latestBook.title}</strong>
                    <small>{latestBook.format.toUpperCase()}{" \u00b7 "}{formatBookSize(latestBook.size)}</small>
                    <span className={styles.continueMetaRow}>
                      {UI_TEXT.LAST_OPENED_AT}: {formatBookDate(latestBook.lastOpenedAt)}
                    </span>
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
                  className={styles.continueCard}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <span className={styles.emptyCoverMini}>
                    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M5 4h7v18H5V4zm9 0h7v18h-7V4z" />
                      <path d="M12 8h2M12 18h2" />
                    </svg>
                  </span>
                  <span className={styles.continueCardText}>
                    <strong>{UI_TEXT.NO_RECENT_BOOK}</strong>
                    <small>{UI_TEXT.START_READING_HINT}</small>
                  </span>
                  <span className={styles.continueChevron}>{"\u203a"}</span>
                </button>
              )}
            </section>

            {recentShelfBooks.length > 0 && (
              <section className={styles.recentShelf}>
                <div className={styles.sectionHeader}>
                  <h2>{UI_TEXT.RECENTLY_OPENED}</h2>
                  <span>{recentShelfBooks.length}</span>
                </div>
                <div className={styles.recentShelfScroller}>
                  {recentShelfBooks.map((book) => {
                    const progress = getBookProgressPercent(readingProgressMap, book.id);
                    return (
                      <button
                        key={book.id}
                        className={styles.shelfBookButton}
                        onClick={() => openBookForReading(book)}
                      >
                        <span className={styles.shelfCoverFrame}>
                          <BookCover
                            title={book.title}
                            format={book.format}
                            coverImageBlob={book.coverImageBlob}
                          />
                        </span>
                        <span className={styles.shelfBookTitle}>{book.title}</span>
                        <span className={styles.shelfBookProgress} aria-hidden="true">
                          <span style={{ width: `${progress}%` }} />
                        </span>
                        <span className={styles.shelfBookMeta}>{formatLibraryProgressLabel(progress)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {books.length > 0 && (
              <section className={styles.collectionShelf}>
                <div className={styles.sectionHeader}>
                  <h2>{UI_TEXT.COLLECTIONS}</h2>
                </div>
                <div className={styles.collectionList}>
                  {collectionListItems.map((item) => {
                    const isActive = groupFilter === item.filter;
                    return (
                      <button
                        key={item.id}
                        className={`${styles.collectionRow} ${isActive ? styles.collectionRowActive : ""}`}
                        onClick={() => setGroupFilter(item.filter)}
                      >
                        <span className={styles.collectionRowIcon}>
                          {item.icon === "stack" ? (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                              <rect x="3" y="5" width="10" height="13" rx="1.5" />
                              <rect x="7" y="2" width="10" height="13" rx="1.5" />
                            </svg>
                          ) : item.icon === "doc" ? (
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
                          <span className={styles.collectionRowName}>{item.name}</span>
                          <span className={styles.collectionRowMeta}>{item.count} {UI_TEXT.BOOK_COUNT}</span>
                        </span>
                        <span className={styles.collectionRowChevron}>{"\u203a"}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

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
                <div className={styles.emptyIcon}>
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="8" y="8" width="20" height="48" rx="2"/>
                    <rect x="36" y="8" width="20" height="48" rx="2"/>
                    <path d="M28 20h8M28 32h8M28 44h8" strokeLinecap="round"/>
                  </svg>
                </div>
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
                    {filteredBooks.map((book) => {
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
                    {filteredBooks.map((book) => {
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
                              {book.format.toUpperCase()} \u00b7 {formatBookSize(book.size)}
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
              </div>
            )}
          </div>
        )}

        {activeTab === "reading" && (
          openBook ? (
            <div className={`${styles.readerShell} ${readerChromeVisible ? "" : styles.readerChromeHidden}`}>
              <div
                className={styles.readerStage}
                onClick={handleReaderStageTap}
                onTouchStart={handleReaderTouchStart}
                onTouchEnd={handleReaderTouchEnd}
                onMouseUp={() => {
                  handleTextSelect();
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
                    onTocChange={(items) => setTocItems(items)}
                    onProgressChange={(pct) => {
                      const progress = normalizeProgressPercent(pct);
                      setReaderProgressPercent(progress);
                      setReadingProgressMap((map) => ({ ...map, [openBook.id]: progress }));
                    }}
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
                    style={{
                      fontSize: `${readerPrefs.fontSizePx}px`,
                      lineHeight: readerPrefs.lineHeight,
                      maxWidth: `${readerPrefs.contentWidth}px`,
                      margin: "0 auto",
                      width: "100%",
                    }}
                  >
                    {paragraphs.map((p, i) => (
                      <p key={i} className={styles.paragraph}>{p}</p>
                    ))}
                  </div>
                )}
                {readerTurnFeedback && (
                  <div
                    key={readerTurnFeedback.id}
                    className={`${styles.readerTurnFeedback} ${
                      readerTurnFeedback.direction === "prev"
                        ? styles.readerTurnPrev
                        : styles.readerTurnNext
                    }`}
                    aria-hidden="true"
                  />
                )}
              </div>
              <ReaderControls
                onBack={handleToolbarBack}
                onContents={() => setTocDrawerOpen(true)}
                hasToc={tocItems.length > 0 && openBook.format === "epub"}
                onPrev={handleToolbarPrev}
                onNext={handleToolbarNext}
                progressPercent={readerProgressPercent}
                onOpenSettings={() => setReaderSettingsOpen(true)}
                onAsk={() => setAskSheetOpen(true)}
                onOpenGoal={handleOpenGoalSheet}
                bookTitle={openBook.title}
                visible={readerChromeVisible}
                todayMinutes={formatReadingMinutes(todaySeconds)}
                targetMinutes={readingGoal.targetMinutes}
              />
            </div>
          ) : (
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

              <section className={styles.quickActionsGrid}>
                <button onClick={() => fileInputRef.current?.click()}>
                  <strong>{UI_TEXT.IMPORT_BOOKS}</strong>
                  <span>{UI_TEXT.ALL_LOCAL}</span>
                </button>
                <button onClick={() => setReaderSettingsOpen(true)}>
                  <strong>{UI_TEXT.READER_APPEARANCE}</strong>
                  <span>{readerThemeLabel}</span>
                </button>
                <button onClick={switchToSettings}>
                  <strong>{UI_TEXT.AI_SETTINGS_TITLE}</strong>
                  <span>{formatAiStatus(hasUsableAiSettings(aiSettings))}</span>
                </button>
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
          )
        )}

        {activeTab === "settings" && (
          <div className={styles.settingsPage}>
            <h1 className={styles.libraryTitle}>{UI_TEXT.SETTINGS}</h1>

            <section className={styles.settingsProfileCard}>
              <span className={styles.settingsAppIcon}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="M5.5 6.5c3.3-.4 6 .4 8.5 2.2 2.5-1.8 5.2-2.6 8.5-2.2v15c-3.3-.4-6 .4-8.5 2.2-2.5-1.8-5.2-2.6-8.5-2.2v-15Z" />
                  <path d="M14 8.7v15" />
                </svg>
              </span>
              <span className={styles.settingsProfileText}>
                <strong>AI Reader</strong>
                <small>
                  {formatSettingsBookCount(books.length)} · {UI_TEXT.TODAY_READING} {formatSettingsReadingMinutes(todayMinutesValue)}
                </small>
              </span>
            </section>

            <section className={styles.settingsSection}>
              <h2 className={styles.settingsSectionTitle}>{UI_TEXT.APP_PREFERENCES}</h2>
              <div className={styles.settingsNativeList}>
                <label className={styles.settingsSwitchRow}>
                  <span className={`${styles.settingsRowIcon} ${styles.settingsIconBlue}`}>
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                      <path d="M7 4.5h6a3 3 0 0 1 0 6H8" strokeLinecap="round" />
                      <path d="M8.5 7.5 5.5 10l3 2.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M5.5 15.5h9" strokeLinecap="round" />
                    </svg>
                  </span>
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
                  <span className={`${styles.settingsRowIcon} ${styles.settingsIconGreen}`}>
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                      <path d="M10 3.5v4" strokeLinecap="round" />
                      <path d="M6.6 5.2a6 6 0 1 0 6.8 0" strokeLinecap="round" />
                    </svg>
                  </span>
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
                  <span className={`${styles.settingsRowIcon} ${styles.settingsIconGray}`}>
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                      <path d="M5 5h10v10H5z" />
                      <path d="M8 8h4v4H8z" />
                    </svg>
                  </span>
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

                <div className={styles.settingsSegmentRow}>
                  <span className={`${styles.settingsRowIcon} ${styles.settingsIconOrange}`}>
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                      <rect x="3.5" y="4" width="5.2" height="12" rx="1.2" />
                      <rect x="11.3" y="4" width="5.2" height="12" rx="1.2" />
                    </svg>
                  </span>
                  <span className={styles.settingsRowText}>
                    <strong>{UI_TEXT.DEFAULT_LIBRARY_VIEW}</strong>
                    <small>{UI_TEXT.DEFAULT_LIBRARY_VIEW_HINT}</small>
                  </span>
                  <span className={styles.settingsSegmentControl}>
                    <button
                      className={libraryView === "grid" ? styles.settingsSegmentActive : ""}
                      onClick={() => handleLibraryViewChange("grid")}
                    >
                      {UI_TEXT.GRID_VIEW}
                    </button>
                    <button
                      className={libraryView === "list" ? styles.settingsSegmentActive : ""}
                      onClick={() => handleLibraryViewChange("list")}
                    >
                      {UI_TEXT.LIST_VIEW}
                    </button>
                  </span>
                </div>
              </div>
            </section>

            <section className={styles.settingsSection}>
              <h2 className={styles.settingsSectionTitle}>{UI_TEXT.READING_GESTURES}</h2>
              <div className={styles.settingsNativeList}>
                <label className={styles.settingsSwitchRow}>
                  <span className={`${styles.settingsRowIcon} ${styles.settingsIconPurple}`}>
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                      <path d="M5.5 5.5h9v9h-9z" />
                      <path d="m8 10 2-2 2 2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10 8v5" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className={styles.settingsRowText}>
                    <strong>{UI_TEXT.EDGE_TAP_TO_TURN}</strong>
                    <small>{UI_TEXT.EDGE_TAP_TO_TURN_HINT}</small>
                  </span>
                  <input
                    type="checkbox"
                    className={styles.iosSwitch}
                    checked={appPrefs.edgeTapToTurn}
                    onChange={(e) =>
                      handleAppPreferencesChange({ edgeTapToTurn: e.target.checked })
                    }
                  />
                </label>

                <label className={styles.settingsSwitchRow}>
                  <span className={`${styles.settingsRowIcon} ${styles.settingsIconCyan}`}>
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                      <path d="M4 10h12" strokeLinecap="round" />
                      <path d="m7 7-3 3 3 3M13 7l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
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
                <div className={styles.settingsInputRow}>
                  <label htmlFor="ai-base-url">{UI_TEXT.BASE_URL}</label>
                  <input
                    id="ai-base-url"
                    type="text"
                    value={formBaseUrl}
                    onChange={(e) => setFormBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                  />
                </div>
                <div className={styles.settingsInputRow}>
                  <label htmlFor="ai-model">{UI_TEXT.MODEL}</label>
                  <input
                    id="ai-model"
                    type="text"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    placeholder="gpt-4o-mini"
                  />
                </div>
                <div className={styles.settingsInputRow}>
                  <label htmlFor="ai-api-key">{UI_TEXT.API_KEY}</label>
                  <input
                    id="ai-api-key"
                    type="password"
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                    placeholder={UI_TEXT.API_KEY}
                  />
                </div>
                <div className={styles.settingsActionRow}>
                  <button
                    className={styles.secondaryButton}
                    onClick={handleClearSettings}
                  >
                    {UI_TEXT.CLEAR}
                  </button>
                  <button
                    className={styles.primaryButton}
                    onClick={handleSaveSettings}
                  >
                    {UI_TEXT.SAVE}
                  </button>
                </div>
              </div>
            </section>

            <section className={styles.settingsSection}>
              <h2 className={styles.settingsSectionTitle}>{UI_TEXT.BACKUP}</h2>
              <div className={styles.settingsNativeList}>
                <button
                  className={styles.settingsNavRow}
                  onClick={handleExportBackup}
                >
                  <span className={`${styles.settingsRowIcon} ${styles.settingsIconBlue}`}>
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                      <path d="M10 3v9m0 0 3-3m-3 3L7 9" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 16h12" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className={styles.settingsRowText}>
                    <strong>{UI_TEXT.EXPORT_BACKUP}</strong>
                  </span>
                  <span className={styles.continueChevron}>{"\u203a"}</span>
                </button>
                <button
                  className={styles.settingsNavRow}
                  onClick={() => backupInputRef.current?.click()}
                >
                  <span className={`${styles.settingsRowIcon} ${styles.settingsIconGreen}`}>
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                      <path d="M10 12V3m0 0L7 6m3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 16h12" strokeLinecap="round" />
                    </svg>
                  </span>
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
                  <span className={`${styles.settingsRowIcon} ${styles.settingsIconPurple}`}>
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                      <path d="M5 4.5c2-.2 3.6.2 5 1.4v10.6c-1.7-1.1-3.4-1.5-5-1.2V4.5Z" />
                      <path d="M10 5.9c1.4-1.2 3-1.6 5-1.4v10.8c-1.6-.3-3.3.1-5 1.2V5.9Z" />
                    </svg>
                  </span>
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
                  <span className={`${styles.settingsRowIcon} ${styles.settingsIconOrange}`}>
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                      <circle cx="10" cy="10" r="7" />
                      <circle cx="10" cy="10" r="3" />
                      <circle cx="10" cy="10" r="0.5" fill="currentColor" />
                    </svg>
                  </span>
                  <span className={styles.settingsRowText}>
                    <strong>{UI_TEXT.READING_GOAL}</strong>
                    <small>{UI_TEXT.TODAY_READING} {todayMinutesValue}/{readingGoal.targetMinutes} {UI_TEXT.MINUTES}</small>
                  </span>
                  <span className={styles.continueChevron}>{"\u203a"}</span>
                </button>
              </div>
            </section>

            <section className={styles.settingsSection}>
              <h2 className={styles.settingsSectionTitle}>{UI_TEXT.PRIVACY_AND_DATA}</h2>
              <div className={styles.settingsNativeList}>
                <div className={styles.settingsInfoRow}>
                  <span>{UI_TEXT.COLLECTIONS}</span>
                  <strong>{formatSettingsBookCount(books.length)}</strong>
                </div>
                <div className={styles.settingsInfoRow}>
                  <span>{UI_TEXT.READING_STREAK}</span>
                  <strong>{formatSettingsReadingMinutes(totalMinutesValue)}</strong>
                </div>
                <div className={styles.settingsInfoRow}>
                  <span>{UI_TEXT.LOCAL_BACKUP}</span>
                  <strong>{UI_TEXT.ALL_LOCAL}</strong>
                </div>
              </div>
              <p className={styles.settingsFootnote}>{UI_TEXT.LOCAL_STORAGE_ONLY}</p>
              <p className={styles.settingsFootnote}>{UI_TEXT.API_KEY_LOCAL_ONLY}</p>
            </section>

            <section className={styles.settingsSection}>
              <h2 className={styles.settingsSectionTitle}>{UI_TEXT.PWA_INSTALL}</h2>
              <div className={styles.settingsNativeList}>
                <div className={styles.settingsInfoRow}>
                  <span>{UI_TEXT.APP_VERSION}</span>
                  <strong>{SETTINGS_APP_VERSION}</strong>
                </div>
              </div>
              <p className={styles.settingsFootnote}>{UI_TEXT.PWA_INSTALL_HINT}</p>
            </section>
          </div>
        )}
      </main>

      {showBottomTabs && (
        <nav className={styles.tabBar}>
          <button
            className={`${styles.tab} ${activeTab === "library" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("library")}
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
              <path className={styles.tabIconFill} d="M13 4.2 14.8 6l2.4-.6 1.7 2.9-1.8 1.8c.2.6.3 1.2.3 1.9s-.1 1.3-.3 1.9l1.8 1.8-1.7 2.9-2.4-.6L13 19.8 11.2 18l-2.4.6-1.7-2.9 1.8-1.8c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9L7.1 8.3l1.7-2.9 2.4.6L13 4.2Z" />
              <path className={styles.tabIconStroke} d="M13 4.2 14.8 6l2.4-.6 1.7 2.9-1.8 1.8c.2.6.3 1.2.3 1.9s-.1 1.3-.3 1.9l1.8 1.8-1.7 2.9-2.4-.6L13 19.8 11.2 18l-2.4.6-1.7-2.9 1.8-1.8c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9L7.1 8.3l1.7-2.9 2.4.6L13 4.2Z" />
              <circle className={styles.tabIconStroke} cx="13" cy="12" r="3.1" />
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

      {askSheetOpen && (
        <div className={styles.sheetOverlay} onClick={() => setAskSheetOpen(false)}>
          <div className={styles.bottomSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetGrabber} />
            <div className={styles.sheetHeader}>
              <h2 className={styles.sheetTitle}>{UI_TEXT.ASK_AI}</h2>
              <button
                className={styles.iconButton}
                onClick={() => setAskSheetOpen(false)}
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
                  aiSettingsUsable={hasUsableAiSettings(aiSettings)}
                  bookTitle={openBook?.title ?? null}
                  onOpenSettings={() => {
                    setAskSheetOpen(false);
                    switchToSettings();
                  }}
                />
              </div>
            </div>
          </div>
        </div>
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
        <div className={styles.sheetOverlay} onClick={() => setBatchGroupSheetOpen(false)}>
          <div className={styles.bottomSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetGrabber} />
            <div className={styles.sheetHeader}>
              <h2 className={styles.sheetTitle}>{UI_TEXT.ADD_SELECTED_TO_GROUP}</h2>
              <button
                className={styles.iconButton}
                onClick={() => setBatchGroupSheetOpen(false)}
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
                      onClick={() => handleAddSelectedBooksToGroup(group.id)}
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
                  onKeyDown={(e) => { if (e.key === "Enter") void handleCreateBatchGroup(); }}
                  placeholder={UI_TEXT.GROUP_NAME_PLACEHOLDER}
                />
                <button
                  className={styles.groupCreateButton}
                  onClick={handleCreateBatchGroup}
                  disabled={!newGroupName.trim()}
                >
                  {UI_TEXT.NEW_GROUP}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {batchDeleteConfirmOpen && (
        <div className={styles.sheetOverlay} onClick={() => setBatchDeleteConfirmOpen(false)}>
          <div className={styles.bottomSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetGrabber} />
            <div className={styles.sheetHeader}>
              <h2 className={styles.sheetTitle}>{UI_TEXT.BATCH_DELETE_CONFIRM_TITLE}</h2>
              <button
                className={styles.iconButton}
                onClick={() => setBatchDeleteConfirmOpen(false)}
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
                    onClick={() => setBatchDeleteConfirmOpen(false)}
                  >
                    {UI_TEXT.CANCEL}
                  </button>
                  <button
                    className={styles.dangerButton}
                    onClick={handleDeleteSelectedBooks}
                  >
                    {UI_TEXT.BATCH_DELETE}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {bookActionSheetBook && (
        <div className={styles.sheetOverlay} onClick={closeBookActionSheet}>
          <div
            className={`${styles.bottomSheet} ${styles.bookActionSheet}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.sheetGrabber} />
            <div className={styles.sheetHeader}>
              <h2 className={styles.sheetTitle}>{UI_TEXT.BOOK_ACTIONS}</h2>
              <button
                className={styles.iconButton}
                onClick={closeBookActionSheet}
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
                    closeBookActionSheet();
                    void openBookForReading(book);
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
                    closeBookActionSheet();
                    openGroupSheet(book);
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
                  onClick={() => handleExportBook(bookActionSheetBook)}
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
                        onClick={() => handleDeleteBook(bookActionSheetBook)}
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
          </div>
        </div>
      )}

      {groupSheetOpen && groupSheetBook && (
        <div className={styles.sheetOverlay} onClick={() => setGroupSheetOpen(false)}>
          <div className={styles.bottomSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sheetGrabber} />
            <div className={styles.sheetHeader}>
              <h2 className={styles.sheetTitle}>{UI_TEXT.MANAGE_GROUPS}</h2>
              <button
                className={styles.iconButton}
                onClick={() => setGroupSheetOpen(false)}
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
                <button className={styles.primaryButton} onClick={() => setGroupSheetOpen(false)}>
                  {UI_TEXT.DONE}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
