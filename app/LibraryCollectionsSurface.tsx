"use client";

import type { CollectionListItem } from "@/lib/collectionList";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

export type LibraryCollectionsSurfaceProps = {
  collectionItems: CollectionListItem[];
  groupFilter: string | null;
  editing: boolean;
  editingGroupId: string | null;
  editingGroupName: string;
  onBack: () => void;
  onToggleEditing: () => void;
  onSelectCollection: (filter: string | null) => void;
  onStartRenamingGroup: (id: string, name: string) => void;
  onEditingGroupNameChange: (name: string) => void;
  onRenameGroup: (id: string) => void;
  onDeleteGroup: (id: string) => void;
  onOpenCreateCollection: () => void;
};

export default function LibraryCollectionsSurface({
  collectionItems,
  groupFilter,
  editing,
  editingGroupId,
  editingGroupName,
  onBack,
  onToggleEditing,
  onSelectCollection,
  onStartRenamingGroup,
  onEditingGroupNameChange,
  onRenameGroup,
  onDeleteGroup,
  onOpenCreateCollection,
}: LibraryCollectionsSurfaceProps) {
  return (
    <div className={styles.collectionsScreen}>
      <div className={styles.collectionsTopBar}>
        <button className={styles.collectionBackButton} onClick={onBack}>
          <span aria-hidden="true">{"\u2039"}</span>
          {UI_TEXT.LIBRARY}
        </button>
        <button className={styles.libraryTextButton} onClick={onToggleEditing}>
          {editing ? UI_TEXT.DONE : UI_TEXT.EDIT}
        </button>
      </div>
      <h2 className={styles.collectionsTitle}>{UI_TEXT.COLLECTIONS}</h2>
      <div className={styles.collectionList}>
        {collectionItems.map((item) => {
          const isActive = groupFilter === item.filter;
          const customGroupId =
            typeof item.filter === "string" &&
            item.filter !== "__ungrouped"
              ? item.filter
              : null;
          const isEditingGroup =
            customGroupId !== null && editingGroupId === customGroupId;

          return (
            <div
              key={item.id}
              className={`${styles.collectionRow} ${
                isActive ? styles.collectionRowActive : ""
              }`}
            >
              <button
                className={styles.collectionRowMain}
                onClick={() => {
                  if (!editing) onSelectCollection(item.filter);
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
                      onChange={(event) =>
                        onEditingGroupNameChange(event.target.value)
                      }
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && customGroupId) {
                          onRenameGroup(customGroupId);
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <span className={styles.collectionRowName}>
                      {item.name}
                    </span>
                  )}
                  <span className={styles.collectionRowMeta}>
                    {item.count} {UI_TEXT.BOOK_COUNT}
                  </span>
                </span>
                {!editing && (
                  <span className={styles.collectionRowChevron}>
                    {"\u203a"}
                  </span>
                )}
              </button>
              {editing && customGroupId && (
                <span className={styles.collectionEditActions}>
                  {isEditingGroup ? (
                    <button
                      className={styles.groupEditSave}
                      onClick={() => onRenameGroup(customGroupId)}
                    >
                      {UI_TEXT.SAVE}
                    </button>
                  ) : (
                    <button
                      className={styles.groupAction}
                      onClick={() =>
                        onStartRenamingGroup(customGroupId, item.name)
                      }
                    >
                      {UI_TEXT.RENAME}
                    </button>
                  )}
                  <button
                    className={styles.groupActionDelete}
                    onClick={() => onDeleteGroup(customGroupId)}
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
          onClick={onOpenCreateCollection}
        >
          <span className={styles.collectionRowIcon}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path d="M10 4v12M4 10h12" strokeLinecap="round" />
            </svg>
          </span>
          <span className={styles.collectionRowBody}>
            <span className={styles.collectionRowName}>{UI_TEXT.NEW_GROUP}</span>
          </span>
          <span className={styles.collectionRowChevron}>{"\u203a"}</span>
        </button>
      </div>
    </div>
  );
}
