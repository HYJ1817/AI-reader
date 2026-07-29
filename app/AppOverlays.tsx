"use client";

import { useEffect, useRef } from "react";
import AskAiPanel, { type AiConversationMessage } from "@/app/AskAiPanel";
import BottomSheet from "@/app/BottomSheet";
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
import ReaderCustomSettingsPanel from "@/app/ReaderCustomSettingsPanel";
import ReaderSettingsPanel from "@/app/ReaderSettingsPanel";
import ReadingGoalSheet from "@/app/ReadingGoalSheet";
import ReadingWorkspaceSheet from "@/app/ReadingWorkspaceSheet";
import TocDrawer from "@/app/TocDrawer";
import {
  useNavigation,
  useNavigationSheets,
} from "@/app/NavigationProvider";
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

export default function AppOverlays({
  reader,
  library,
  workspace,
  group,
  actions,
}: AppOverlaysProps) {
  const navigation = useNavigation();
  const sheets = useNavigationSheets();
  const sheet = sheets.at(-1);
  const sheetBook = sheet?.entityId
    ? library.books.find((book) => book.id === sheet.entityId) ?? null
    : null;

  useEffect(() => {
    if (
      sheet &&
      BOOK_ROUTES.has(sheet.route) &&
      !library.booksLoading &&
      !sheetBook
    ) {
      navigation.removeInvalid(sheet.key);
    }
  }, [
    library.booksLoading,
    navigation,
    navigation.removeInvalid,
    sheet,
    sheetBook,
  ]);

  if (!sheet) return null;

  const overlay = (() => {
    switch (sheet.route) {
      case "reader-settings":
        return (
          <ReaderSettingsPanel
            preferences={reader.preferences}
            mode={reader.mode}
            onChange={actions.changeReaderPreferences}
            onModeChange={actions.changeReaderMode}
            onOpenCustomSettings={() =>
              navigation.presentSheet("reader-custom-settings")
            }
            onClose={navigation.dismissSheet}
          />
        );
      case "reader-custom-settings":
        return (
          <ReaderCustomSettingsPanel
            preferences={reader.preferences}
            onChange={actions.changeReaderPreferences}
            onClose={navigation.dismissSheet}
          />
        );
      case "toc":
        return (
          <TocDrawer
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
            onClose={navigation.dismissSheet}
          />
        );
      case "ask-ai":
        return (
          <AskAiSheet
            reader={reader}
            actions={actions}
            online={workspace.online}
            hasOlderMessages={workspace.hasOlderMessages}
            eligibleSkills={workspace.eligibleSkills}
            onClose={navigation.dismissSheet}
          />
        );
      case "reading-workspace":
        return sheetBook ? (
          <ReadingWorkspaceSheet
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
            onClose={navigation.dismissSheet}
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
          <ReadingGoalSheet
            todayMinutes={reader.todayMinutes}
            targetMinutes={reader.targetMinutes}
            goalInputValue={reader.goalInputValue}
            onGoalInputChange={actions.setGoalInputValue}
            onSaveGoal={actions.saveGoal}
            onClose={navigation.dismissSheet}
          />
        );
      case "book-actions":
        return sheetBook ? (
          <BottomSheet
            onClose={navigation.dismissSheet}
            ariaLabel={UI_TEXT.BOOK_ACTIONS}
            className={styles.bookActionSheet}
          >
            {(close) => (
              <BookActionPage
                book={sheetBook}
                progress={getBookProgressPercent(
                  library.progressMap,
                  sheetBook.id
                )}
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
                onExport={() =>
                  close(() => actions.exportBook(sheetBook))
                }
                close={close}
              />
            )}
          </BottomSheet>
        ) : null;
      case "book-rename":
        return sheetBook ? (
          <BookRenameSheet
            book={sheetBook}
            onRename={actions.renameBook}
            onClose={navigation.dismissSheet}
          />
        ) : null;
      case "book-delete":
        return sheetBook ? (
          <BookDeleteSheet
            book={sheetBook}
            onDelete={actions.deleteBook}
            onClose={navigation.dismissSheet}
          />
        ) : null;
      case "book-groups":
        return sheetBook ? (
          <BottomSheet
            onClose={navigation.dismissSheet}
            ariaLabel={UI_TEXT.MANAGE_GROUPS}
          >
            {(close) => (
              <BookGroupPage
                book={sheetBook}
                groups={library.groups}
                group={group}
                actions={actions}
                onToggleGroup={(book, item) =>
                  actions.toggleBookGroup(book.id, item.id)
                }
                onCreateGroup={(book) => actions.createGroup(book.id)}
                close={close}
              />
            )}
          </BottomSheet>
        ) : null;
      case "batch-groups":
        return (
          <BottomSheet
            onClose={navigation.dismissSheet}
            ariaLabel={UI_TEXT.ADD_SELECTED_TO_GROUP}
          >
            {(close) => (
              <BatchGroupPage
                library={library}
                actions={actions}
                close={close}
              />
            )}
          </BottomSheet>
        );
      case "batch-delete":
        return (
          <BottomSheet
            onClose={navigation.dismissSheet}
            ariaLabel={UI_TEXT.BATCH_DELETE_CONFIRM_TITLE}
          >
            {(close) => (
              <BatchDeletePage
                selectedCountLabel={library.selectedCountLabel}
                onDelete={actions.deleteSelectedBooks}
                close={close}
              />
            )}
          </BottomSheet>
        );
      case "collection-create":
        return (
          <BottomSheet onClose={navigation.dismissSheet} ariaLabel="新建藏书">
            {(close) => (
              <CollectionCreatePage
                newGroupName={library.newGroupName}
                onNameChange={actions.setNewGroupName}
                onCreate={actions.createCollection}
                close={close}
              />
            )}
          </BottomSheet>
        );
    }
  })();

  return (
    <div className={styles.sheetRouteHost} data-sheet-route={sheet.route}>
      {overlay}
    </div>
  );
}

function AskAiSheet({
  reader,
  actions,
  online,
  hasOlderMessages,
  eligibleSkills,
  onClose,
}: {
  reader: AppOverlaysProps["reader"];
  actions: AppOverlaysProps["actions"];
  online: boolean;
  hasOlderMessages: boolean;
  eligibleSkills: ReadingSkill[];
  onClose: () => void;
}) {
  return (
    <BottomSheet
      onClose={onClose}
      ariaLabel={UI_TEXT.ASK_AI}
      className={styles.askBottomSheet}
    >
      {(close) => (
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
      )}
    </BottomSheet>
  );
}

function BookRenameSheet({
  book,
  onRename,
  onClose,
}: {
  book: BookMetadata;
  onRename: (bookId: string, title: string) => Promise<void>;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <BottomSheet
      onClose={onClose}
      ariaLabel={UI_TEXT.RENAME_BOOK}
      initialFocusRef={inputRef}
    >
      {(close) => (
        <BookRenamePage
          book={book}
          onRename={onRename}
          close={close}
          initialFocusRef={inputRef}
          requiredMessage={UI_TEXT.BOOK_TITLE_REQUIRED}
          isSubmitKey={(event) => event.key === "Enter"}
        />
      )}
    </BottomSheet>
  );
}

function BookDeleteSheet({
  book,
  onDelete,
  onClose,
}: {
  book: BookMetadata;
  onDelete: (book: BookMetadata) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet onClose={onClose} ariaLabel={UI_TEXT.DELETE_BOOK_CONFIRM_TITLE}>
      {(close) => (
        <BookDeletePage book={book} onDelete={onDelete} close={close} />
      )}
    </BottomSheet>
  );
}
