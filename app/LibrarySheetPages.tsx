"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import BookCover from "./BookCover";
import type { CloseSheet } from "./BottomSheet";
import type { AppOverlaysProps } from "./AppOverlays";
import type { BookGroup, BookMetadata } from "@/lib/db";
import { formatLibraryProgressLabel } from "@/lib/libraryProgress";
import { formatBookDate, formatBookSize } from "@/lib/libraryPresentation";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

type LibraryData = AppOverlaysProps["library"];
type OverlayActions = AppOverlaysProps["actions"];
type GroupData = AppOverlaysProps["group"];

function BatchGroupPage({
  library,
  actions,
  close,
}: {
  library: LibraryData;
  actions: OverlayActions;
  close: CloseSheet;
}) {
  return (
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
  );
}

function BatchDeletePage({
  selectedCountLabel,
  onDelete,
  close,
}: {
  selectedCountLabel: string;
  onDelete: () => void;
  close: CloseSheet;
}) {
  return (
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
  );
}

function CollectionCreatePage({
  newGroupName,
  onNameChange,
  onCreate,
  close,
}: {
  newGroupName: string;
  onNameChange: (name: string) => void;
  onCreate: () => void;
  close: CloseSheet;
}) {
  return (
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
  );
}

function BookActionPage({
  book,
  progress,
  actions,
  onOpenRename,
  onOpenGroups,
  onOpenDelete,
  onExport,
  close,
}: {
  book: BookMetadata;
  progress: number;
  actions: OverlayActions;
  onOpenRename: () => void;
  onOpenGroups: () => void;
  onOpenDelete: () => void;
  onExport: () => void;
  close: CloseSheet;
}) {
  return (
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
            label={UI_TEXT.READING_WORKSPACE}
            icon="workspace"
            onClick={() => actions.openReadingWorkspace(book.id)}
          />
          <ActionRow
            label={UI_TEXT.RENAME_BOOK}
            icon="edit"
            onClick={onOpenRename}
            returnFocusFor="book-rename"
          />
          <ActionRow
            label={UI_TEXT.MANAGE_GROUPS}
            icon="list"
            onClick={onOpenGroups}
            returnFocusFor="book-groups"
          />
          <ActionRow
            label={UI_TEXT.EXPORT_BOOK}
            icon="export"
            onClick={onExport}
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
            data-sheet-return-focus="book-delete"
          >
            <span className={styles.actionIcon}>
              <DeleteIcon />
            </span>
            <span>{UI_TEXT.DELETE_BOOK}</span>
          </button>
        </div>
      </div>
    </>
  );
}

function BookRenamePage({
  book,
  onRename,
  close,
  initialFocusRef,
  requiredMessage = UI_TEXT.BOOK_TITLE_REQUIRED,
  isSubmitKey = (event) => event.key === "Enter",
}: {
  book: BookMetadata;
  onRename: (bookId: string, title: string) => Promise<void>;
  close: CloseSheet;
  initialFocusRef?: RefObject<HTMLInputElement | null>;
  requiredMessage?: string;
  isSubmitKey?: (event: { key: string }) => boolean;
}) {
  const localInputRef = useRef<HTMLInputElement>(null);
  const inputRef = initialFocusRef ?? localInputRef;
  const [title, setTitle] = useState(book.title);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const restoreFocusAfterFailureRef = useRef(false);

  useLayoutEffect(() => {
    if (
      !saving &&
      error === UI_TEXT.RENAME_BOOK_FAILED &&
      restoreFocusAfterFailureRef.current
    ) {
      restoreFocusAfterFailureRef.current = false;
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [error, inputRef, saving]);

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError(requiredMessage);
      inputRef.current?.focus();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onRename(book.id, trimmed);
      close();
    } catch {
      restoreFocusAfterFailureRef.current = true;
      setError(UI_TEXT.RENAME_BOOK_FAILED);
      setSaving(false);
    }
  }

  return (
    <>
      <SheetHeader title={UI_TEXT.RENAME_BOOK} close={close} />
      <form
        className={styles.renameBookForm}
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
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
            if (isSubmitKey(event) && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
            }
          }}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "rename-book-error" : undefined}
          disabled={saving}
          data-sheet-autofocus="true"
        />
        {error ? (
          <p id="rename-book-error" className={styles.renameBookError} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.renameBookActions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => close()}
            disabled={saving}
          >
            {UI_TEXT.CANCEL}
          </button>
          <button type="submit" className={styles.primaryButton} disabled={saving}>
            {UI_TEXT.SAVE}
          </button>
        </div>
      </form>
    </>
  );
}

function BookDeletePage({
  book,
  onDelete,
  close,
}: {
  book: BookMetadata;
  onDelete: (book: BookMetadata) => void;
  close: CloseSheet;
}) {
  return (
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
  );
}

function BookGroupPage({
  book,
  groups,
  group,
  actions,
  onToggleGroup,
  onCreateGroup,
  close,
}: {
  book: BookMetadata;
  groups: BookGroup[];
  group: GroupData;
  actions: OverlayActions;
  onToggleGroup: (book: BookMetadata, group: BookGroup) => void;
  onCreateGroup: (book: BookMetadata) => void;
  close: CloseSheet;
}) {
  return (
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
                        data-sheet-autofocus="true"
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
                          onChange={() => onToggleGroup(book, item)}
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
          onCreate={() => onCreateGroup(book)}
        />
        <div className={styles.groupSheetActions}>
          <button className={styles.primaryButton} onClick={() => close()}>
            {UI_TEXT.DONE}
          </button>
        </div>
      </div>
    </>
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
        data-sheet-autofocus={autoFocus ? "true" : undefined}
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

export function SheetHeader({
  title,
  close,
  action,
}: {
  title: string;
  close: CloseSheet;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className={styles.sheetHeader}>
      <h2 className={styles.sheetTitle}>{title}</h2>
      <div className={styles.sheetHeaderActions}>
        {action ? (
          <button
            type="button"
            className={styles.sheetHeaderTextButton}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ) : null}
        <button
          className={styles.iconButton}
          onClick={() => close()}
          title={UI_TEXT.CLOSE}
          aria-label={UI_TEXT.CLOSE}
        >
          <CloseIcon width={20} height={20} />
        </button>
      </div>
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
  returnFocusFor,
}: {
  label: string;
  icon: "book" | "workspace" | "edit" | "list" | "export";
  onClick: () => void;
  returnFocusFor?: string;
}) {
  return (
    <button
      className={styles.actionListRow}
      onClick={onClick}
      data-sheet-return-focus={returnFocusFor}
    >
      <span className={styles.actionIcon}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          {icon === "book" ? (
            <>
              <path d="M5 4.5c2-.2 3.6.2 5 1.4v10.6c-1.7-1.1-3.4-1.5-5-1.2V4.5Z" />
              <path d="M10 5.9c1.4-1.2 3-1.6 5-1.4v10.8c-1.6-.3-3.3.1-5 1.2V5.9Z" />
            </>
          ) : icon === "workspace" ? (
            <>
              <path d="M4 4.5h12v9H9l-3.5 2.5v-2.5H4v-9Z" strokeLinejoin="round" />
              <path d="M7 8h6M7 10.5h4" strokeLinecap="round" />
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

export {
  BatchDeletePage,
  BatchGroupPage,
  BookActionPage,
  BookDeletePage,
  BookGroupPage,
  BookRenamePage,
  CollectionCreatePage,
};
