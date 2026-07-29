"use client";

import { useState, type ComponentProps } from "react";
import type { BookMetadata } from "@/lib/db";
import type {
  ReadingWorkspaceRecord,
  WorkspaceMessageRecord,
  WorkspaceSessionRecord,
} from "@/lib/readingWorkspace";
import { UI_TEXT } from "@/lib/uiText";
import BottomSheet, { type CloseSheet } from "./BottomSheet";
import WorkspaceConversation from "./WorkspaceConversation";
import WorkspaceMaterials from "./WorkspaceMaterials";
import styles from "./page.module.css";

export type ReadingWorkspaceSheetProps = {
  book: BookMetadata;
  workspace: ReadingWorkspaceRecord | null;
  sessions: WorkspaceSessionRecord[];
  activeSessionId: string | null;
  messages: WorkspaceMessageRecord[];
  loading: boolean;
  error: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  canCompactConversation: boolean;
  onCompactConversation: () => Promise<void> | void;
  onClose: () => void;
  conversation: Omit<
    ComponentProps<typeof WorkspaceConversation>,
    "messages"
  >;
  materials: ComponentProps<typeof WorkspaceMaterials>;
};

export type ReadingWorkspacePageProps = Omit<
  ReadingWorkspaceSheetProps,
  "onClose"
> & {
  close: CloseSheet;
};

export default function ReadingWorkspaceSheet({
  onClose,
  ...pageProps
}: ReadingWorkspaceSheetProps) {
  return (
    <BottomSheet
      onClose={onClose}
      ariaLabel={`${UI_TEXT.READING_WORKSPACE} · ${pageProps.book.title}`}
      className={styles.readingWorkspaceSheet}
    >
      {(close) => <ReadingWorkspacePage {...pageProps} close={close} />}
    </BottomSheet>
  );
}

export function ReadingWorkspacePage({
  book,
  workspace,
  sessions,
  activeSessionId,
  messages,
  loading,
  error,
  onSelectSession,
  onNewSession,
  canCompactConversation,
  onCompactConversation,
  close,
  conversation,
  materials,
}: ReadingWorkspacePageProps) {
  const [view, setView] = useState<"conversation" | "materials">(
    "conversation"
  );
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);

  return (
    <div
          className={styles.workspaceShell}
          data-workspace-id={workspace?.id ?? undefined}
        >
          <header className={styles.workspaceHeader}>
            <div className={styles.workspaceHeading}>
              <span>{UI_TEXT.READING_WORKSPACE}</span>
              <h2 title={book.title}>{book.title}</h2>
            </div>
            <div className={styles.workspaceHeaderActions}>
              {view === "conversation" ? (
                <div className={styles.workspaceSessionMenuHost}>
                  <button
                    type="button"
                    className={styles.workspaceHeaderButton}
                    aria-label={UI_TEXT.WORKSPACE_SESSIONS}
                    aria-expanded={sessionMenuOpen}
                    onClick={() => setSessionMenuOpen((current) => !current)}
                  >
                    •••
                  </button>
                  {sessionMenuOpen ? (
                    <div className={styles.workspaceSessionMenu} role="menu">
                      {sessions.map((session) => (
                        <button
                          key={session.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={session.id === activeSessionId}
                          onClick={() => {
                            onSelectSession(session.id);
                            setSessionMenuOpen(false);
                          }}
                        >
                          {session.title}
                        </button>
                      ))}
                      <button
                        type="button"
                        role="menuitem"
                        disabled={!workspace}
                        onClick={() => {
                          if (!workspace) return;
                          onNewSession();
                          setSessionMenuOpen(false);
                        }}
                      >
                        {UI_TEXT.WORKSPACE_NEW_SESSION}
                      </button>
                      {canCompactConversation ? (
                        <button
                          type="button"
                          role="menuitem"
                          disabled={loading}
                          onClick={() => {
                            setSessionMenuOpen(false);
                            void onCompactConversation();
                          }}
                        >
                          {UI_TEXT.COMPACT_EARLY_CONVERSATION}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                className={styles.workspaceCloseButton}
                onClick={() => close()}
              >
                {UI_TEXT.CLOSE}
              </button>
            </div>
          </header>

          <div className={styles.workspaceSegments} role="tablist">
            <button
              type="button"
              id="workspace-conversation-tab"
              className={styles.workspaceSegment}
              role="tab"
              aria-selected={view === "conversation"}
              aria-controls="workspace-conversation-panel"
              onClick={() => setView("conversation")}
            >
              {UI_TEXT.WORKSPACE_CONVERSATION}
            </button>
            <button
              type="button"
              id="workspace-materials-tab"
              className={styles.workspaceSegment}
              role="tab"
              aria-selected={view === "materials"}
              aria-controls="workspace-materials-panel"
              onClick={() => setView("materials")}
            >
              {UI_TEXT.WORKSPACE_MATERIALS}
            </button>
          </div>

          <div className={styles.workspaceViewport}>
            {loading ? (
              <div className={styles.workspaceStatus}>{UI_TEXT.LOADING}</div>
            ) : error ? (
              <div className={styles.workspaceStatus} role="alert">
                {error}
              </div>
            ) : view === "conversation" ? (
              <div
                id="workspace-conversation-panel"
                role="tabpanel"
                aria-labelledby="workspace-conversation-tab"
                className={styles.workspacePanel}
              >
                <WorkspaceConversation
                  {...conversation}
                  messages={messages}
                />
              </div>
            ) : (
              <div
                id="workspace-materials-panel"
                role="tabpanel"
                aria-labelledby="workspace-materials-tab"
                className={styles.workspacePanel}
              >
                <WorkspaceMaterials {...materials} />
              </div>
            )}
          </div>
    </div>
  );
}
