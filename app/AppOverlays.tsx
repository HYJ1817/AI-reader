"use client";

import BookCover from "@/app/BookCover";
import BottomSheet from "@/app/BottomSheet";
import ReaderSettingsPanel from "@/app/ReaderSettingsPanel";
import TocDrawer from "@/app/TocDrawer";
import AskAiPanel from "@/app/AskAiPanel";
import AiSettingsSheet from "@/app/AiSettingsSheet";
import ReadingGoalSheet from "@/app/ReadingGoalSheet";
import type { AiProviderSettings } from "@/lib/aiProviders";
import type { BookGroup, BookRecord } from "@/lib/db";
import type { EpubTocItem } from "@/lib/epubNavigation";
import { formatLibraryProgressLabel } from "@/lib/libraryProgress";
import {
  formatBookDate,
  formatBookSize,
} from "@/lib/libraryPresentation";
import type { ReaderMode } from "@/lib/readerMode";
import type { ReaderPageInfo } from "@/lib/readerPageInfo";
import type { ReaderPreferences } from "@/lib/readerPreferences";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

export type AppOverlaysProps = {
  reader: {
    settingsOpen: boolean;
    preferences: ReaderPreferences;
    tocOpen: boolean;
    tocItems: EpubTocItem[];
    askOpen: boolean;
    selectedText: string | null;
    question: string;
    answer: string | null;
    askLoading: boolean;
    askError: string | null;
    aiUsable: boolean;
    bookTitle: string | null;
    mode: ReaderMode;
    pageInfo: ReaderPageInfo;
    goalOpen: boolean;
    todayMinutes: number;
    targetMinutes: number;
    goalInputValue: number;
  };
  ai: {
    settingsOpen: boolean;
    settings: AiProviderSettings;
  };
  library: {
    groups: BookGroup[];
    selectedCountLabel: string;
    newGroupName: string;
    batchGroupOpen: boolean;
    batchDeleteOpen: boolean;
    createCollectionOpen: boolean;
  };
  bookAction: {
    book: BookRecord | null;
    progress: number;
    deleteConfirmOpen: boolean;
  };
  group: {
    open: boolean;
    book: BookRecord | null;
    groups: BookGroup[];
    editingGroupId: string | null;
    editingGroupName: string;
    newGroupName: string;
  };
  actions: {
    closeReaderSettings: () => void;
    changeReaderPreferences: (preferences: ReaderPreferences) => void;
    changeReaderMode: (mode: ReaderMode) => void;
    closeToc: () => void;
    selectTocItem: (href: string) => void;
    closeAiSettings: () => void;
    saveAiSettings: (settings: AiProviderSettings) => void;
    closeAsk: () => void;
    setQuestion: (question: string) => void;
    ask: () => void;
    clearSelection: () => void;
    openAiSettingsFromAsk: () => void;
    closeGoal: () => void;
    setGoalInputValue: (value: number) => void;
    saveGoal: () => void;
    closeBatchGroup: () => void;
    addSelectedBooksToGroup: (groupId: string) => void;
    createBatchGroup: () => void;
    closeBatchDelete: () => void;
    deleteSelectedBooks: () => void;
    closeCreateCollection: () => void;
    createCollection: () => void;
    closeBookActions: () => void;
    openBook: (book: BookRecord) => void;
    openGroupSheet: (book: BookRecord) => void;
    exportBook: (book: BookRecord) => void;
    setDeleteConfirmOpen: (open: boolean) => void;
    deleteBook: (book: BookRecord) => void;
    closeGroupSheet: () => void;
    toggleBookGroup: (groupId: string) => void;
    setEditingGroup: (groupId: string | null, name: string) => void;
    setEditingGroupName: (name: string) => void;
    renameGroup: (groupId: string) => void;
    deleteGroup: (groupId: string) => void;
    setNewGroupName: (name: string) => void;
    createGroup: () => void;
  };
};

export default function AppOverlays({
  reader,
  ai,
  library,
  bookAction,
  group,
  actions,
}: AppOverlaysProps) {
  const actionBook = bookAction.book;
  const groupBook = group.book;

  return (
    <>
      {reader.settingsOpen && (
        <ReaderSettingsPanel
          preferences={reader.preferences}
          mode={reader.mode}
          onChange={actions.changeReaderPreferences}
          onModeChange={actions.changeReaderMode}
          onClose={actions.closeReaderSettings}
        />
      )}

      {reader.tocOpen && (
        <TocDrawer
          items={reader.tocItems}
          bookTitle={reader.bookTitle}
          pageInfo={reader.pageInfo}
          onSelect={actions.selectTocItem}
          onClose={actions.closeToc}
        />
      )}

      {ai.settingsOpen && (
        <AiSettingsSheet
          settings={ai.settings}
          onSave={actions.saveAiSettings}
          onClose={actions.closeAiSettings}
        />
      )}

      {reader.askOpen && (
        <BottomSheet onClose={actions.closeAsk} ariaLabel={UI_TEXT.ASK_AI}>
          {(close) => (
            <>
              <SheetHeader title={UI_TEXT.ASK_AI} close={close} />
              <div className={styles.sheetBody}>
                <div className={styles.askSheetInner}>
                  <AskAiPanel
                    selectedText={reader.selectedText}
                    question={reader.question}
                    onQuestionChange={actions.setQuestion}
                    answer={reader.answer}
                    loading={reader.askLoading}
                    error={reader.askError}
                    onAsk={actions.ask}
                    onClearSelection={actions.clearSelection}
                    aiSettingsUsable={reader.aiUsable}
                    bookTitle={reader.bookTitle}
                    onOpenSettings={() =>
                      close(actions.openAiSettingsFromAsk)
                    }
                  />
                </div>
              </div>
            </>
          )}
        </BottomSheet>
      )}

      {reader.goalOpen && (
        <ReadingGoalSheet
          todayMinutes={reader.todayMinutes}
          targetMinutes={reader.targetMinutes}
          goalInputValue={reader.goalInputValue}
          onGoalInputChange={actions.setGoalInputValue}
          onSaveGoal={actions.saveGoal}
          onClose={actions.closeGoal}
        />
      )}

      {library.batchGroupOpen && (
        <BottomSheet
          onClose={actions.closeBatchGroup}
          ariaLabel={UI_TEXT.ADD_SELECTED_TO_GROUP}
        >
          {(close) => (
            <>
              <SheetHeader title={UI_TEXT.ADD_SELECTED_TO_GROUP} close={close} />
              <div className={styles.sheetBody}>
                <div className={styles.groupSheetBookTitle}>
                  {library.selectedCountLabel}
                </div>

                {library.groups.length === 0 ? (
                  <div className={styles.groupEmpty}>
                    <p className={styles.emptyText}>{UI_TEXT.NO_GROUPS_YET}</p>
                    <p className={styles.groupEmptyHint}>
                      {UI_TEXT.CREATE_FIRST_GROUP_HINT}
                    </p>
                  </div>
                ) : (
                  <div className={styles.actionListGroup}>
                    {library.groups.map((item) => (
                      <button
                        key={item.id}
                        className={styles.actionListRow}
                        onClick={() =>
                          close(() => actions.addSelectedBooksToGroup(item.id))
                        }
                      >
                        <span className={styles.actionIcon}>
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                            <path d="M4 5h12M4 10h12M4 15h12" strokeLinecap="round" />
                          </svg>
                        </span>
                        <span>{item.name}</span>
                        <small>{UI_TEXT.ADD_TO_THIS_GROUP}</small>
                      </button>
                    ))}
                  </div>
                )}

                <div className={styles.groupCreateRow}>
                  <input
                    type="text"
                    className={styles.groupCreateInput}
                    value={library.newGroupName}
                    onChange={(event) =>
                      actions.setNewGroupName(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        close(actions.createBatchGroup);
                      }
                    }}
                    placeholder={UI_TEXT.GROUP_NAME_PLACEHOLDER}
                  />
                  <button
                    className={styles.groupCreateButton}
                    onClick={() => close(actions.createBatchGroup)}
                    disabled={!library.newGroupName.trim()}
                  >
                    {UI_TEXT.NEW_GROUP}
                  </button>
                </div>
              </div>
            </>
          )}
        </BottomSheet>
      )}

      {library.batchDeleteOpen && (
        <BottomSheet
          onClose={actions.closeBatchDelete}
          ariaLabel={UI_TEXT.BATCH_DELETE_CONFIRM_TITLE}
        >
          {(close) => (
            <>
              <SheetHeader
                title={UI_TEXT.BATCH_DELETE_CONFIRM_TITLE}
                close={close}
              />
              <div className={styles.sheetBody}>
                <div className={styles.deleteConfirmBox}>
                  <strong>{library.selectedCountLabel}</strong>
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
                      onClick={() => close(actions.deleteSelectedBooks)}
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

      {library.createCollectionOpen && (
        <BottomSheet
          onClose={actions.closeCreateCollection}
          ariaLabel="新建藏书"
        >
          {(close) => (
            <>
              <SheetHeader title="新建藏书" close={close} />
              <div className={styles.sheetBody}>
                <div className={styles.groupCreateRow}>
                  <input
                    type="text"
                    className={styles.groupCreateInput}
                    value={library.newGroupName}
                    onChange={(event) =>
                      actions.setNewGroupName(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        close(actions.createCollection);
                      }
                    }}
                    placeholder={UI_TEXT.GROUP_NAME_PLACEHOLDER}
                    autoFocus
                  />
                  <button
                    className={styles.groupCreateButton}
                    onClick={() => close(actions.createCollection)}
                    disabled={!library.newGroupName.trim()}
                  >
                    {UI_TEXT.NEW_GROUP}
                  </button>
                </div>
              </div>
            </>
          )}
        </BottomSheet>
      )}

      {actionBook && (
        <BottomSheet
          onClose={actions.closeBookActions}
          ariaLabel={UI_TEXT.BOOK_ACTIONS}
          className={styles.bookActionSheet}
        >
          {(close) => (
            <>
              <SheetHeader title={UI_TEXT.BOOK_ACTIONS} close={close} />
              <div className={styles.sheetBody}>
                <div className={styles.bookActionHero}>
                  <BookCover
                    title={actionBook.title}
                    format={actionBook.format}
                    coverImageBlob={actionBook.coverImageBlob}
                  />
                  <div className={styles.bookActionHeroText}>
                    <strong>{actionBook.title}</strong>
                    <span>
                      {actionBook.format.toUpperCase()} ·{" "}
                      {formatBookSize(actionBook.size)}
                    </span>
                    <span>
                      {formatLibraryProgressLabel(bookAction.progress)}
                    </span>
                  </div>
                </div>

                <div className={styles.actionListGroup}>
                  <ActionRow
                    label={UI_TEXT.OPEN_BOOK}
                    icon="book"
                    onClick={() => {
                      const book = actionBook;
                      close(() => actions.openBook(book));
                    }}
                  />
                  <ActionRow
                    label={UI_TEXT.MANAGE_GROUPS}
                    icon="list"
                    onClick={() => {
                      const book = actionBook;
                      close(() => actions.openGroupSheet(book));
                    }}
                  />
                  <ActionRow
                    label={UI_TEXT.EXPORT_BOOK}
                    icon="export"
                    onClick={() => {
                      const book = actionBook;
                      close(() => actions.exportBook(book));
                    }}
                  />
                </div>

                <div className={styles.bookDetailGroup}>
                  <h3>{UI_TEXT.BOOK_DETAILS}</h3>
                  <DetailRow
                    label={UI_TEXT.FORMAT}
                    value={actionBook.format.toUpperCase()}
                  />
                  <DetailRow
                    label={UI_TEXT.FILE_SIZE}
                    value={formatBookSize(actionBook.size)}
                  />
                  <DetailRow
                    label={UI_TEXT.ADDED_AT}
                    value={formatBookDate(actionBook.createdAt)}
                  />
                  <DetailRow
                    label={UI_TEXT.LAST_OPENED_AT}
                    value={formatBookDate(actionBook.lastOpenedAt)}
                  />
                </div>

                <div className={styles.actionListGroup}>
                  <button
                    className={`${styles.actionListRow} ${styles.actionListDanger}`}
                    onClick={() => actions.setDeleteConfirmOpen(true)}
                  >
                    <span className={styles.actionIcon}>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <path d="M5 6h10M8 6V4h4v2m-6 0 .7 10h6.6L14 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span>{UI_TEXT.DELETE_BOOK}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </BottomSheet>
      )}

      {actionBook && bookAction.deleteConfirmOpen && (
        <div
          className={styles.bookDeleteDialogOverlay}
          onClick={() => actions.setDeleteConfirmOpen(false)}
        >
          <div
            className={styles.bookDeleteDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="book-delete-confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <strong id="book-delete-confirm-title">
              {UI_TEXT.DELETE_BOOK_CONFIRM_TITLE}
            </strong>
            <p>{UI_TEXT.DELETE_BOOK_CONFIRM_HINT}</p>
            <div className={styles.bookDeleteDialogActions}>
              <button
                className={styles.secondaryButton}
                onClick={() => actions.setDeleteConfirmOpen(false)}
              >
                {UI_TEXT.CANCEL}
              </button>
              <button
                className={styles.dangerButton}
                onClick={() => actions.deleteBook(actionBook)}
              >
                {UI_TEXT.DELETE_BOOK}
              </button>
            </div>
          </div>
        </div>
      )}

      {group.open && groupBook && (
        <BottomSheet
          onClose={actions.closeGroupSheet}
          ariaLabel={UI_TEXT.MANAGE_GROUPS}
        >
          {(close) => (
            <>
              <SheetHeader title={UI_TEXT.MANAGE_GROUPS} close={close} />
              <div className={styles.sheetBody}>
                <div className={styles.groupSheetBookTitle}>
                  {groupBook.title}
                </div>

                {group.groups.length === 0 ? (
                  <div className={styles.groupEmpty}>
                    <p className={styles.emptyText}>{UI_TEXT.NO_GROUPS_YET}</p>
                    <p className={styles.groupEmptyHint}>
                      {UI_TEXT.CREATE_FIRST_GROUP_HINT}
                    </p>
                  </div>
                ) : (
                  <ul className={styles.groupList}>
                    {group.groups.map((item) => {
                      const isChecked =
                        groupBook.groupIds?.includes(item.id) ?? false;
                      const isEditing = group.editingGroupId === item.id;
                      return (
                        <li key={item.id} className={styles.groupListItem}>
                          {isEditing ? (
                            <div className={styles.groupEditRow}>
                              <input
                                type="text"
                                className={styles.groupEditInput}
                                value={group.editingGroupName}
                                onChange={(event) =>
                                  actions.setEditingGroupName(event.target.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    actions.renameGroup(item.id);
                                  }
                                }}
                                autoFocus
                              />
                              <button
                                className={styles.groupEditSave}
                                onClick={() => actions.renameGroup(item.id)}
                              >
                                {UI_TEXT.SAVE}
                              </button>
                              <button
                                className={styles.groupEditCancel}
                                onClick={() => actions.setEditingGroup(null, "")}
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
                                  onChange={() =>
                                    actions.toggleBookGroup(item.id)
                                  }
                                />
                                <span className={styles.groupName}>
                                  {item.name}
                                </span>
                              </label>
                              <div className={styles.groupItemActions}>
                                <button
                                  className={styles.groupAction}
                                  onClick={() =>
                                    actions.setEditingGroup(item.id, item.name)
                                  }
                                  title={UI_TEXT.RENAME}
                                  aria-label={UI_TEXT.RENAME}
                                >
                                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.5 8.5-3.5 1 1-3.5 8.172-8.828z" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                                <button
                                  className={styles.groupActionDelete}
                                  onClick={() => actions.deleteGroup(item.id)}
                                  title={UI_TEXT.DELETE_GROUP}
                                  aria-label={UI_TEXT.DELETE_GROUP}
                                >
                                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
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
                    value={group.newGroupName}
                    onChange={(event) =>
                      actions.setNewGroupName(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") actions.createGroup();
                    }}
                    placeholder={UI_TEXT.GROUP_NAME_PLACEHOLDER}
                  />
                  <button
                    className={styles.groupCreateButton}
                    onClick={actions.createGroup}
                    disabled={!group.newGroupName.trim()}
                  >
                    {UI_TEXT.NEW_GROUP}
                  </button>
                </div>

                <div className={styles.groupSheetActions}>
                  <button
                    className={styles.primaryButton}
                    onClick={() => close()}
                  >
                    {UI_TEXT.DONE}
                  </button>
                </div>
              </div>
            </>
          )}
        </BottomSheet>
      )}
    </>
  );
}

function SheetHeader({
  title,
  close,
}: {
  title: string;
  close: (afterClose?: () => void) => void;
}) {
  return (
    <div className={styles.sheetHeader}>
      <h2 className={styles.sheetTitle}>{title}</h2>
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
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.bookDetailRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ActionRow({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: "book" | "list" | "export";
  onClick: () => void;
}) {
  return (
    <button className={styles.actionListRow} onClick={onClick}>
      <span className={styles.actionIcon}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          {icon === "book" ? (
            <>
              <path d="M5 4.5c2-.2 3.6.2 5 1.4v10.6c-1.7-1.1-3.4-1.5-5-1.2V4.5Z" />
              <path d="M10 5.9c1.4-1.2 3-1.6 5-1.4v10.8c-1.6-.3-3.3.1-5 1.2V5.9Z" />
            </>
          ) : icon === "list" ? (
            <path d="M4 5h12M4 10h12M4 15h12" strokeLinecap="round" />
          ) : (
            <>
              <path d="M10 3v9m0 0 3-3m-3 3L7 9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16h12" strokeLinecap="round" />
            </>
          )}
        </svg>
      </span>
      <span>{label}</span>
      <span className={styles.continueChevron}>{"\u203a"}</span>
    </button>
  );
}
