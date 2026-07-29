"use client";

import { useEffect, useReducer } from "react";
import AskAiPanel, { type AiConversationMessage } from "@/app/AskAiPanel";
import MotionSheet, { type CloseSheet } from "@/app/MotionSheet";
import {
  BatchDeletePage,
  BatchGroupPage,
  BookActionPage,
  BookDeletePage,
  BookGroupPage,
  BookRenamePage,
  CollectionCreatePage,
  SheetHeader,
} from "@/app/LibrarySheetPages";
import { ReaderCustomSettingsPage } from "@/app/ReaderCustomSettingsPanel";
import { ReaderSettingsPage } from "@/app/ReaderSettingsPanel";
import { ReadingGoalPage } from "@/app/ReadingGoalSheet";
import { ReadingWorkspacePage } from "@/app/ReadingWorkspaceSheet";
import SheetPageStack, {
  type SheetPageRenderControls,
} from "@/app/SheetPageStack";
import { TocPage } from "@/app/TocDrawer";
import {
  useNavigation,
  useNavigationState,
} from "@/app/NavigationProvider";
import type { SheetEntry, SheetRoute } from "@/lib/appNavigation";
import type { AnnotationRecord, BookGroup, BookMetadata } from "@/lib/db";
import type { EpubTocItem } from "@/lib/epubNavigation";
import {
  getBookProgressPercent,
  type ReadingProgressMap,
} from "@/lib/libraryProgress";
import type { ReaderMode } from "@/lib/readerMode";
import type { ReaderPageInfo } from "@/lib/readerPageInfo";
import type { ReaderPreferences } from "@/lib/readerPreferences";
import type { ReadingSkill, ReadingSkillId } from "@/lib/readingSkills";
import type {
  ReadingWorkspaceRecord,
  WorkspaceArtifactRecord,
  WorkspaceMemoryRecord,
  WorkspaceSessionRecord,
} from "@/lib/readingWorkspace";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

export type AppOverlaysProps = {
  reader: {
    preferences: ReaderPreferences;
    tocItems: EpubTocItem[];
    selectedText: string | null;
    question: string;
    messages: AiConversationMessage[];
    askLoading: boolean;
    askError: string | null;
    aiUsable: boolean;
    bookId: string | null;
    bookTitle: string | null;
    mode: ReaderMode;
    pageInfo: ReaderPageInfo;
    todayMinutes: number;
    targetMinutes: number;
    goalInputValue: number;
    bookmarks: AnnotationRecord[];
    highlights: AnnotationRecord[];
    currentPageBookmarked: boolean;
  };
  library: {
    books: BookMetadata[];
    booksLoading: boolean;
    progressMap: ReadingProgressMap;
    groups: BookGroup[];
    selectedCountLabel: string;
    newGroupName: string;
  };
  workspace: {
    record: ReadingWorkspaceRecord | null;
    sessions: WorkspaceSessionRecord[];
    activeSessionId: string | null;
    messages: AiConversationMessage[];
    artifacts: WorkspaceArtifactRecord[];
    memories: WorkspaceMemoryRecord[];
    loading: boolean;
    online: boolean;
    hasOlderMessages: boolean;
    eligibleSkills: ReadingSkill[];
    canCompactConversation: boolean;
  };
  group: {
    editingGroupId: string | null;
    editingGroupName: string;
    newGroupName: string;
  };
  actions: {
    changeReaderPreferences: (preferences: ReaderPreferences) => void;
    changeReaderMode: (mode: ReaderMode) => void;
    selectTocItem: (href: string) => void;
    toggleBookmark: () => void;
    selectAnnotation: (annotation: AnnotationRecord) => void;
    deleteAnnotation: (id: string) => void;
    setQuestion: (question: string) => void;
    ask: () => void;
    stopAsk: () => void;
    retryAsk: (assistantMessageId?: string) => void;
    clearSelection: () => void;
    openAiSettingsFromAsk: () => void;
    openReadingWorkspace: (bookId: string) => void;
    newWorkspaceSession: (workspaceId: string) => void;
    selectWorkspaceSession: (sessionId: string) => void;
    loadOlderWorkspaceMessages: () => Promise<void> | void;
    runReadingSkill: (skillId: ReadingSkillId) => Promise<void> | void;
    saveMessageToMaterials: (messageId: string) => Promise<void> | void;
    renameWorkspaceArtifact: (id: string, title: string) => Promise<void> | void;
    deleteWorkspaceArtifact: (id: string) => Promise<void> | void;
    rememberWorkspaceMessage: (id: string, content: string) => Promise<void> | void;
    revokeWorkspaceMemory: (id: string) => Promise<void> | void;
    deleteRevokedWorkspaceMemory: (id: string) => Promise<void> | void;
    compactWorkspaceConversation: () => Promise<void> | void;
    setGoalInputValue: (value: number) => void;
    saveGoal: () => void;
    addSelectedBooksToGroup: (groupId: string) => void;
    createBatchGroup: () => void;
    deleteSelectedBooks: () => void;
    createCollection: () => void;
    openBook: (book: BookMetadata) => void;
    exportBook: (book: BookMetadata) => void;
    renameBook: (bookId: string, title: string) => Promise<void>;
    deleteBook: (book: BookMetadata) => void;
    toggleBookGroup: (bookId: string, groupId: string) => void;
    setEditingGroup: (groupId: string | null, name: string) => void;
    setEditingGroupName: (name: string) => void;
    renameGroup: (groupId: string) => void;
    deleteGroup: (groupId: string) => void;
    setNewGroupName: (name: string) => void;
    createGroup: (bookId: string) => void;
  };
};

const BOOK_ROUTES = new Set([
  "book-actions",
  "book-rename",
  "book-delete",
  "book-groups",
  "reading-workspace",
]);

type SheetPresentation = {
  ariaLabel: string;
  className?: string;
  showGrabber: boolean;
  onBeforeDismiss?: () => void;
};

const SHEET_PRESENTATIONS: Record<
  SheetRoute,
  Omit<SheetPresentation, "onBeforeDismiss">
> = {
  "reader-settings": {
    ariaLabel: "主题与设置",
    className: styles.readerSettingsSheet,
    showGrabber: true,
  },
  "reader-custom-settings": {
    ariaLabel: "自定义设置",
    className: styles.readerCustomSettingsSheet,
    showGrabber: false,
  },
  toc: {
    ariaLabel: "目录与标记",
    className: styles.tocSheet,
    showGrabber: true,
  },
  "ask-ai": {
    ariaLabel: UI_TEXT.ASK_AI,
    className: styles.askBottomSheet,
    showGrabber: true,
  },
  "reading-goal": {
    ariaLabel: UI_TEXT.READING_GOAL,
    className: styles.goalMotionSheet,
    showGrabber: false,
  },
  "book-actions": {
    ariaLabel: UI_TEXT.BOOK_ACTIONS,
    className: styles.bookActionSheet,
    showGrabber: true,
  },
  "book-rename": { ariaLabel: UI_TEXT.RENAME_BOOK, showGrabber: true },
  "book-delete": { ariaLabel: UI_TEXT.DELETE_BOOK_CONFIRM_TITLE, showGrabber: true },
  "book-groups": { ariaLabel: UI_TEXT.MANAGE_GROUPS, showGrabber: true },
  "reading-workspace": {
    ariaLabel: UI_TEXT.READING_WORKSPACE,
    className: styles.readingWorkspaceSheet,
    showGrabber: true,
  },
  "batch-groups": { ariaLabel: UI_TEXT.ADD_SELECTED_TO_GROUP, showGrabber: true },
  "batch-delete": { ariaLabel: UI_TEXT.BATCH_DELETE_CONFIRM_TITLE, showGrabber: true },
  "collection-create": { ariaLabel: "新建藏书", showGrabber: true },
};

export default function AppOverlays({
  reader,
  library,
  workspace,
  group,
  actions,
}: AppOverlaysProps) {
  const navigation = useNavigation();
  const navigationState = useNavigationState();
  const [visualEntries, setVisualEntries] = useReducer(
    (_current: SheetEntry[], next: SheetEntry[]) => next,
    navigationState.sheets
  );
  const [bookSnapshots, updateBookSnapshots] = useReducer(
    (
      current: Map<string, BookMetadata>,
      update: BookMetadata[] | null
    ) => {
      if (update === null) return new Map<string, BookMetadata>();
      const next = new Map(current);
      for (const book of update) next.set(book.id, book);
      return next;
    },
    library.books,
    (books) => new Map(books.map((book) => [book.id, book]))
  );

  useEffect(() => {
    if (navigationState.sheets.length > 0) {
      setVisualEntries(navigationState.sheets);
      updateBookSnapshots(library.books);
    }
  }, [library.books, navigationState.sheets]);

  const renderedEntries = navigationState.sheets.length > 0
    ? navigationState.sheets
    : visualEntries;
  const topSheet = renderedEntries.at(-1);

  useEffect(() => {
    if (library.booksLoading) return;
    const invalidEntry = renderedEntries.find(
      (entry) =>
        BOOK_ROUTES.has(entry.route) &&
        (!entry.entityId ||
          !library.books.some((book) => book.id === entry.entityId))
    );
    if (invalidEntry) navigation.removeInvalid(invalidEntry.key);
  }, [library.books, library.booksLoading, navigation, renderedEntries]);

  if (!topSheet) return null;

  const renderSheetPage = (
    entry: SheetEntry,
    controls: SheetPageRenderControls
  ) => {
    const closePage = controls.isRoot
      ? controls.dismiss
      : controls.back;
    const sheetBook = entry.entityId
      ? library.books.find((book) => book.id === entry.entityId) ??
        bookSnapshots.get(entry.entityId) ??
        null
      : null;
    const close = closePage;

    switch (entry.route) {
      case "reader-settings":
        return (
          <ReaderSettingsPage
            preferences={reader.preferences}
            mode={reader.mode}
            onChange={actions.changeReaderPreferences}
            onModeChange={actions.changeReaderMode}
            onOpenCustomSettings={() =>
              navigation.presentSheet("reader-custom-settings")
            }
            close={closePage}
          />
        );
      case "reader-custom-settings":
        return (
          <ReaderCustomSettingsPage
            preferences={reader.preferences}
            onChange={actions.changeReaderPreferences}
            close={closePage}
          />
        );
      case "toc":
        return (
          <TocPage
            items={reader.tocItems}
            bookmarks={reader.bookmarks}
            highlights={reader.highlights}
            currentPageBookmarked={reader.currentPageBookmarked}
            bookTitle={reader.bookTitle}
            pageInfo={reader.pageInfo}
            onSelect={actions.selectTocItem}
            onToggleBookmark={actions.toggleBookmark}
            onSelectAnnotation={actions.selectAnnotation}
            onDeleteAnnotation={actions.deleteAnnotation}
            close={closePage}
          />
        );
      case "ask-ai":
        return (
          <AskAiPage
            reader={reader}
            actions={actions}
            online={workspace.online}
            hasOlderMessages={workspace.hasOlderMessages}
            eligibleSkills={workspace.eligibleSkills}
            close={closePage}
          />
        );
      case "reading-workspace":
        return sheetBook ? (
          <ReadingWorkspacePage
            book={sheetBook}
            workspace={workspace.record}
            sessions={workspace.sessions}
            activeSessionId={workspace.activeSessionId}
            messages={workspace.messages}
            loading={workspace.loading}
            error={null}
            canCompactConversation={workspace.canCompactConversation}
            onCompactConversation={actions.compactWorkspaceConversation}
            onSelectSession={actions.selectWorkspaceSession}
            onNewSession={() => {
              if (workspace.record) {
                actions.newWorkspaceSession(workspace.record.id);
              }
            }}
            close={closePage}
            conversation={{
              selectedText:
                reader.bookId === sheetBook.id ? reader.selectedText : null,
              question: reader.question,
              loading: reader.askLoading,
              error: reader.askError,
              aiSettingsUsable: reader.aiUsable,
              online: workspace.online,
              hasOlderMessages: workspace.hasOlderMessages,
              eligibleSkills: workspace.eligibleSkills,
              onQuestionChange: actions.setQuestion,
              onAsk: actions.ask,
              onStop: actions.stopAsk,
              onRetry: actions.retryAsk,
              onClearSelection: actions.clearSelection,
              onOpenSettings: actions.openAiSettingsFromAsk,
              onLoadOlder: actions.loadOlderWorkspaceMessages,
              onRunSkill: actions.runReadingSkill,
              onSaveToMaterials: actions.saveMessageToMaterials,
              onRemember: actions.rememberWorkspaceMessage,
            }}
            materials={{
              artifacts: workspace.artifacts,
              memories: workspace.memories,
              annotations: reader.bookId === sheetBook.id
                ? [...reader.bookmarks, ...reader.highlights]
                : [],
              loading: workspace.loading,
              error: null,
              onDeleteArtifact: actions.deleteWorkspaceArtifact,
              onRenameArtifact: actions.renameWorkspaceArtifact,
              onRevokeMemory: actions.revokeWorkspaceMemory,
              onDeleteRevokedMemory: actions.deleteRevokedWorkspaceMemory,
            }}
          />
        ) : null;
      case "reading-goal":
        return (
          <ReadingGoalPage
            todayMinutes={reader.todayMinutes}
            targetMinutes={reader.targetMinutes}
            goalInputValue={reader.goalInputValue}
            onGoalInputChange={actions.setGoalInputValue}
            onSaveGoal={actions.saveGoal}
            close={closePage}
          />
        );
      case "book-actions":
        return sheetBook ? (
          <BookActionPage
            book={sheetBook}
            progress={getBookProgressPercent(library.progressMap, sheetBook.id)}
            actions={actions}
            onOpenRename={() =>
              navigation.presentSheet("book-rename", {
                entityId: sheetBook.id,
              })
            }
            onOpenGroups={() =>
              navigation.presentSheet("book-groups", {
                entityId: sheetBook.id,
              })
            }
            onOpenDelete={() =>
              navigation.presentSheet("book-delete", {
                entityId: sheetBook.id,
              })
            }
            onExport={() => close(() => actions.exportBook(sheetBook))}
            close={closePage}
          />
        ) : null;
      case "book-rename":
        return sheetBook ? (
          <BookRenamePage
            book={sheetBook}
            onRename={actions.renameBook}
            close={closePage}
            requiredMessage={UI_TEXT.BOOK_TITLE_REQUIRED}
            isSubmitKey={(event) => event.key === "Enter"}
          />
        ) : null;
      case "book-delete":
        return sheetBook ? (
          <BookDeletePage
            book={sheetBook}
            onDelete={actions.deleteBook}
            close={closePage}
          />
        ) : null;
      case "book-groups":
        return sheetBook ? (
          <BookGroupPage
            book={sheetBook}
            groups={library.groups}
            group={group}
            actions={actions}
            onToggleGroup={(book, item) =>
              actions.toggleBookGroup(book.id, item.id)
            }
            onCreateGroup={(book) => actions.createGroup(book.id)}
            close={closePage}
          />
        ) : null;
      case "batch-groups":
        return (
          <BatchGroupPage library={library} actions={actions} close={closePage} />
        );
      case "batch-delete":
        return (
          <BatchDeletePage
            selectedCountLabel={library.selectedCountLabel}
            onDelete={actions.deleteSelectedBooks}
            close={closePage}
          />
        );
      case "collection-create":
        return (
          <CollectionCreatePage
            newGroupName={library.newGroupName}
            onNameChange={actions.setNewGroupName}
            onCreate={actions.createCollection}
            close={closePage}
          />
        );
    }
  };

  const topBook = topSheet.entityId
    ? library.books.find((book) => book.id === topSheet.entityId) ??
      bookSnapshots.get(topSheet.entityId) ??
      null
    : null;
  const presentation: SheetPresentation = {
    ...SHEET_PRESENTATIONS[topSheet.route],
    ariaLabel:
      topSheet.route === "reading-workspace" && topBook
        ? `${UI_TEXT.READING_WORKSPACE} · ${topBook.title}`
        : SHEET_PRESENTATIONS[topSheet.route].ariaLabel,
    onBeforeDismiss:
      topSheet.route === "reading-goal"
        ? () => actions.setGoalInputValue(reader.targetMinutes)
        : undefined,
  };

  return (
    <div
      className={styles.sheetRouteHost}
      data-sheet-route={topSheet.route}
      data-sheet-stack-root={renderedEntries[0]?.route}
    >
      <MotionSheet
        open={navigationState.sheets.length > 0}
        onRequestClose={navigation.dismissSheetStack}
        onExitComplete={() => {
          if (navigation.getState().sheets.length === 0) {
            setVisualEntries([]);
            updateBookSnapshots(null);
          }
        }}
        ariaLabel={presentation.ariaLabel}
        className={presentation.className}
        showGrabber={presentation.showGrabber}
        stackDepth={renderedEntries.length}
        onBeforeClose={presentation.onBeforeDismiss}
      >
        {(dismiss) => (
          <SheetPageStack
            entries={renderedEntries}
            direction={navigationState.direction}
            onBack={navigation.dismissSheet}
            dismiss={dismiss}
            renderPage={renderSheetPage}
          />
        )}
      </MotionSheet>
    </div>
  );
}

function AskAiPage({
  reader,
  actions,
  online,
  hasOlderMessages,
  eligibleSkills,
  close,
}: {
  reader: AppOverlaysProps["reader"];
  actions: AppOverlaysProps["actions"];
  online: boolean;
  hasOlderMessages: boolean;
  eligibleSkills: ReadingSkill[];
  close: CloseSheet;
}) {
  return (
    <>
      <SheetHeader
        title={UI_TEXT.ASK_AI}
        close={close}
        action={
          reader.bookId
            ? {
                label: UI_TEXT.READING_WORKSPACE,
                onClick: () => {
                  const bookId = reader.bookId;
                  if (!bookId) return;
                  actions.openReadingWorkspace(bookId);
                },
              }
            : undefined
        }
      />
      <div className={styles.sheetBody}>
        <div className={styles.askSheetInner}>
          <AskAiPanel
            selectedText={reader.selectedText}
            question={reader.question}
            onQuestionChange={actions.setQuestion}
            messages={reader.messages}
            loading={reader.askLoading}
            error={reader.askError}
            online={online}
            hasOlderMessages={hasOlderMessages}
            eligibleSkills={eligibleSkills}
            onAsk={actions.ask}
            onStop={actions.stopAsk}
            onRetry={actions.retryAsk}
            onClearSelection={actions.clearSelection}
            aiSettingsUsable={reader.aiUsable}
            onOpenSettings={actions.openAiSettingsFromAsk}
            onLoadOlder={actions.loadOlderWorkspaceMessages}
            onRunSkill={actions.runReadingSkill}
            onSaveToMaterials={actions.saveMessageToMaterials}
            onRemember={actions.rememberWorkspaceMessage}
          />
        </div>
      </div>
    </>
  );
}
