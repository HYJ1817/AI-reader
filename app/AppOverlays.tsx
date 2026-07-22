"use client";

import { useEffect, useRef, useState } from "react";
import AskAiPanel, { type AiConversationMessage } from "@/app/AskAiPanel";
import BookCover from "@/app/BookCover";
import BottomSheet, { type CloseSheet } from "@/app/BottomSheet";
import ReaderCustomSettingsPanel from "@/app/ReaderCustomSettingsPanel";
import ReaderSettingsPanel from "@/app/ReaderSettingsPanel";
import ReadingGoalSheet from "@/app/ReadingGoalSheet";
import TocDrawer from "@/app/TocDrawer";
import {
  useNavigation,
  useNavigationSheets,
} from "@/app/NavigationProvider";
import type { AnnotationRecord, BookGroup, BookMetadata } from "@/lib/db";
import type { EpubTocItem } from "@/lib/epubNavigation";
import {
  formatLibraryProgressLabel,
  getBookProgressPercent,
  type ReadingProgressMap,
} from "@/lib/libraryProgress";
import { formatBookDate, formatBookSize } from "@/lib/libraryPresentation";
import type { ReaderMode } from "@/lib/readerMode";
import type { ReaderPageInfo } from "@/lib/readerPageInfo";
import type { ReaderPreferences } from "@/lib/readerPreferences";
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
    clearSelection: () => void;
    openAiSettingsFromAsk: () => void;
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
]);

export default function AppOverlays({
  reader,
  library,
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
            onClose={navigation.dismissSheet}
          />
        );
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
          <BookActionSheet
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
            onClose={navigation.dismissSheet}
          />
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
          <BookGroupSheet
            book={sheetBook}
            groups={library.groups}
            group={group}
            actions={actions}
            onClose={navigation.dismissSheet}
          />
        ) : null;
      case "batch-groups":
        return (
          <BatchGroupSheet
            library={library}
            actions={actions}
            onClose={navigation.dismissSheet}
          />
        );
      case "batch-delete":
        return (
          <BatchDeleteSheet
            selectedCountLabel={library.selectedCountLabel}
            onDelete={actions.deleteSelectedBooks}
            onClose={navigation.dismissSheet}
          />
        );
      case "collection-create":
        return (
          <CollectionCreateSheet
            newGroupName={library.newGroupName}
            onNameChange={actions.setNewGroupName}
            onCreate={actions.createCollection}
            onClose={navigation.dismissSheet}
          />
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
  onClose,
}: {
  reader: AppOverlaysProps["reader"];
  actions: AppOverlaysProps["actions"];
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
          <SheetHeader title={UI_TEXT.ASK_AI} close={close} />
          <div className={styles.sheetBody}>
            <div className={styles.askSheetInner}>
              <AskAiPanel
                selectedText={reader.selectedText}
                question={reader.question}
                onQuestionChange={actions.setQuestion}
                messages={reader.messages}
                loading={reader.askLoading}
                error={reader.askError}
                onAsk={actions.ask}
                onClearSelection={actions.clearSelection}
                aiSettingsUsable={reader.aiUsable}
                onOpenSettings={actions.openAiSettingsFromAsk}
              />
            </div>
          </div>
        </>
      )}
    </BottomSheet>
  );
}

function BatchGroupSheet({
  library,
  actions,
  onClose,
}: {
  library: AppOverlaysProps["library"];
  actions: AppOverlaysProps["actions"];
  onClose: () => void;
}) {
  return (
    <BottomSheet onClose={onClose} ariaLabel={UI_TEXT.ADD_SELECTED_TO_GROUP}>
      {(close) => (
        <>
          <SheetHeader title={UI_TEXT.ADD_SELECTED_TO_GROUP} close={close} />
          <div className={styles.sheetBody}>
            <div className={styles.groupSheetBookTitle}>
              {library.selectedCountLabel}
            </div>
            {library.groups.length === 0 ? (
              <GroupEmpty />
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
                      <ListIcon />
                    </span>
                    <span>{item.name}</span>
                    <small>{UI_TEXT.ADD_TO_THIS_GROUP}</small>
                  </button>
                ))}
              </div>
            )}
            <GroupCreateRow
              value={library.newGroupName}
              onChange={actions.setNewGroupName}
              onCreate={() => close(actions.createBatchGroup)}
            />
          </div>
        </>
      )}
    </BottomSheet>
  );
}

function BatchDeleteSheet({
  selectedCountLabel,
  onDelete,
  onClose,
}: {
  selectedCountLabel: string;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet onClose={onClose} ariaLabel={UI_TEXT.BATCH_DELETE_CONFIRM_TITLE}>
      {(close) => (
        <>
          <SheetHeader title={UI_TEXT.BATCH_DELETE_CONFIRM_TITLE} close={close} />
          <div className={styles.sheetBody}>
            <div className={styles.deleteConfirmBox}>
              <strong>{selectedCountLabel}</strong>
              <p>{UI_TEXT.BATCH_DELETE_CONFIRM_HINT}</p>
              <div>
                <button className={styles.secondaryButton} onClick={() => close()}>
                  {UI_TEXT.CANCEL}
                </button>
                <button
                  className={styles.dangerButton}
                  onClick={() => close(onDelete)}
                >
                  {UI_TEXT.BATCH_DELETE}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </BottomSheet>
  );
}

function CollectionCreateSheet({
  newGroupName,
  onNameChange,
  onCreate,
  onClose,
}: {
  newGroupName: string;
  onNameChange: (name: string) => void;
  onCreate: () => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet onClose={onClose} ariaLabel="新建藏书">
      {(close) => (
        <>
          <SheetHeader title="新建藏书" close={close} />
          <div className={styles.sheetBody}>
            <GroupCreateRow
              value={newGroupName}
              onChange={onNameChange}
              onCreate={() => close(onCreate)}
              autoFocus
            />
          </div>
        </>
      )}
    </BottomSheet>
  );
}

function BookActionSheet({
  book,
  progress,
  actions,
  onOpenRename,
  onOpenGroups,
  onOpenDelete,
  onClose,
}: {
  book: BookMetadata;
  progress: number;
  actions: AppOverlaysProps["actions"];
  onOpenRename: () => void;
  onOpenGroups: () => void;
  onOpenDelete: () => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      onClose={onClose}
      ariaLabel={UI_TEXT.BOOK_ACTIONS}
      className={styles.bookActionSheet}
    >
      {(close) => (
        <>
          <SheetHeader title={UI_TEXT.BOOK_ACTIONS} close={close} />
          <div className={styles.sheetBody}>
            <div className={styles.bookActionHero}>
              <BookCover
                title={book.title}
                format={book.format}
                coverImageBlob={book.coverImageBlob}
              />
              <div className={styles.bookActionHeroText}>
                <strong>{book.title}</strong>
                <span>
                  {book.format.toUpperCase()} · {formatBookSize(book.size)}
                </span>
                <span>{formatLibraryProgressLabel(progress)}</span>
              </div>
            </div>
            <div className={styles.actionListGroup}>
              <ActionRow
                label={UI_TEXT.OPEN_BOOK}
                icon="book"
                onClick={() => actions.openBook(book)}
              />
              <ActionRow
                label={UI_TEXT.RENAME_BOOK}
                icon="edit"
                onClick={onOpenRename}
              />
              <ActionRow
                label={UI_TEXT.MANAGE_GROUPS}
                icon="list"
                onClick={onOpenGroups}
              />
              <ActionRow
                label={UI_TEXT.EXPORT_BOOK}
                icon="export"
                onClick={() => close(() => actions.exportBook(book))}
              />
            </div>
            <div className={styles.bookDetailGroup}>
              <h3>{UI_TEXT.BOOK_DETAILS}</h3>
              <DetailRow label={UI_TEXT.FORMAT} value={book.format.toUpperCase()} />
              <DetailRow label={UI_TEXT.FILE_SIZE} value={formatBookSize(book.size)} />
              <DetailRow label={UI_TEXT.ADDED_AT} value={formatBookDate(book.createdAt)} />
              <DetailRow
                label={UI_TEXT.LAST_OPENED_AT}
                value={formatBookDate(book.lastOpenedAt)}
              />
            </div>
            <div className={styles.actionListGroup}>
              <button
                className={`${styles.actionListRow} ${styles.actionListDanger}`}
                onClick={onOpenDelete}
              >
                <span className={styles.actionIcon}>
                  <DeleteIcon />
                </span>
                <span>{UI_TEXT.DELETE_BOOK}</span>
              </button>
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
  const [title, setTitle] = useState(book.title);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(close: CloseSheet) {
    const trimmed = title.trim();
    if (!trimmed) {
      setError(UI_TEXT.BOOK_TITLE_REQUIRED);
      inputRef.current?.focus();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onRename(book.id, trimmed);
      close();
    } catch {
      setError(UI_TEXT.RENAME_BOOK_FAILED);
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      onClose={onClose}
      ariaLabel={UI_TEXT.RENAME_BOOK}
      initialFocusRef={inputRef}
    >
      {(close) => (
        <>
          <SheetHeader title={UI_TEXT.RENAME_BOOK} close={close} />
          <form
            className={styles.renameBookForm}
            onSubmit={(event) => {
              event.preventDefault();
              void submit(close);
            }}
          >
            <label htmlFor="rename-book-title">{UI_TEXT.BOOK_TITLE}</label>
            <input
              ref={inputRef}
              id="rename-book-title"
              className={styles.renameBookInput}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void submit(close);
                }
              }}
              aria-invalid={error ? "true" : undefined}
              aria-describedby={error ? "rename-book-error" : undefined}
              disabled={saving}
            />
            {error ? (
              <p id="rename-book-error" className={styles.renameBookError} role="alert">
                {error}
              </p>
            ) : null}
            <div className={styles.renameBookActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => close()} disabled={saving}>
                {UI_TEXT.CANCEL}
              </button>
              <button type="submit" className={styles.primaryButton} disabled={saving}>
                {UI_TEXT.SAVE}
              </button>
            </div>
          </form>
        </>
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
        <>
          <SheetHeader title={UI_TEXT.DELETE_BOOK_CONFIRM_TITLE} close={close} />
          <div className={styles.sheetBody}>
            <div className={styles.deleteConfirmBox}>
              <strong>{book.title}</strong>
              <p>{UI_TEXT.DELETE_BOOK_CONFIRM_HINT}</p>
              <div>
                <button className={styles.secondaryButton} onClick={() => close()}>
                  {UI_TEXT.CANCEL}
                </button>
                <button
                  className={styles.dangerButton}
                  onClick={() => close(() => onDelete(book))}
                >
                  {UI_TEXT.DELETE_BOOK}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </BottomSheet>
  );
}

function BookGroupSheet({
  book,
  groups,
  group,
  actions,
  onClose,
}: {
  book: BookMetadata;
  groups: BookGroup[];
  group: AppOverlaysProps["group"];
  actions: AppOverlaysProps["actions"];
  onClose: () => void;
}) {
  return (
    <BottomSheet onClose={onClose} ariaLabel={UI_TEXT.MANAGE_GROUPS}>
      {(close) => (
        <>
          <SheetHeader title={UI_TEXT.MANAGE_GROUPS} close={close} />
          <div className={styles.sheetBody}>
            <div className={styles.groupSheetBookTitle}>{book.title}</div>
            {groups.length === 0 ? (
              <GroupEmpty />
            ) : (
              <ul className={styles.groupList}>
                {groups.map((item) => {
                  const isChecked = book.groupIds?.includes(item.id) ?? false;
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
                              if (event.key === "Enter") actions.renameGroup(item.id);
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
                                actions.toggleBookGroup(book.id, item.id)
                              }
                            />
                            <span className={styles.groupName}>{item.name}</span>
                          </label>
                          <div className={styles.groupItemActions}>
                            <button
                              className={styles.groupAction}
                              onClick={() => actions.setEditingGroup(item.id, item.name)}
                              title={UI_TEXT.RENAME}
                              aria-label={UI_TEXT.RENAME}
                            >
                              <EditIcon />
                            </button>
                            <button
                              className={styles.groupActionDelete}
                              onClick={() => actions.deleteGroup(item.id)}
                              title={UI_TEXT.DELETE_GROUP}
                              aria-label={UI_TEXT.DELETE_GROUP}
                            >
                              <CloseIcon />
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <GroupCreateRow
              value={group.newGroupName}
              onChange={actions.setNewGroupName}
              onCreate={() => actions.createGroup(book.id)}
            />
            <div className={styles.groupSheetActions}>
              <button className={styles.primaryButton} onClick={() => close()}>
                {UI_TEXT.DONE}
              </button>
            </div>
          </div>
        </>
      )}
    </BottomSheet>
  );
}

function GroupEmpty() {
  return (
    <div className={styles.groupEmpty}>
      <p className={styles.emptyText}>{UI_TEXT.NO_GROUPS_YET}</p>
      <p className={styles.groupEmptyHint}>{UI_TEXT.CREATE_FIRST_GROUP_HINT}</p>
    </div>
  );
}

function GroupCreateRow({
  value,
  onChange,
  onCreate,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onCreate: () => void;
  autoFocus?: boolean;
}) {
  return (
    <div className={styles.groupCreateRow}>
      <input
        type="text"
        className={styles.groupCreateInput}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onCreate();
        }}
        placeholder={UI_TEXT.GROUP_NAME_PLACEHOLDER}
        autoFocus={autoFocus}
      />
      <button
        className={styles.groupCreateButton}
        onClick={onCreate}
        disabled={!value.trim()}
      >
        {UI_TEXT.NEW_GROUP}
      </button>
    </div>
  );
}

function SheetHeader({ title, close }: { title: string; close: CloseSheet }) {
  return (
    <div className={styles.sheetHeader}>
      <h2 className={styles.sheetTitle}>{title}</h2>
      <button
        className={styles.iconButton}
        onClick={() => close()}
        title={UI_TEXT.CLOSE}
        aria-label={UI_TEXT.CLOSE}
      >
        <CloseIcon width={20} height={20} />
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
  icon: "book" | "edit" | "list" | "export";
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
          ) : icon === "edit" ? (
            <path d="M13.6 3.6a2 2 0 0 1 2.8 2.8l-8.5 8.5-3.5 1 1-3.5 8.2-8.8Z" strokeLinecap="round" strokeLinejoin="round" />
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
    </button>
  );
}

function ListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 5h12M4 10h12M4 15h12" strokeLinecap="round" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M5 6h10M8 6V4h4v2m-6 0 .7 10h6.6L14 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M13.586 3.586a2 2 0 112.828 2.828l-8.5 8.5-3.5 1 1-3.5 8.172-8.828z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon({ width = 16, height = 16 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
    </svg>
  );
}
