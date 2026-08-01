"use client";

import { AnimatePresence, m } from "motion/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import type { BookMetadata } from "@/lib/db";
import { getRoleTransition } from "@/lib/motionSystem";
import type {
  ReadingWorkspaceRecord,
  WorkspaceMessageRecord,
  WorkspaceSessionRecord,
} from "@/lib/readingWorkspace";
import { UI_TEXT } from "@/lib/uiText";
import { useAppReducedMotion } from "./AppMotionRoot";
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
  const reduceMotion = useAppReducedMotion();
  const [view, setView] = useState<"conversation" | "materials">(
    "conversation"
  );
  const [direction, setDirection] = useState(1);
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const sessionMenuHostRef = useRef<HTMLDivElement>(null);
  const sessionMenuTriggerRef = useRef<HTMLButtonElement>(null);

  const closeSessionMenu = useCallback((returnFocus = true) => {
    setSessionMenuOpen(false);
    if (!returnFocus) return;
    window.requestAnimationFrame(() =>
      sessionMenuTriggerRef.current?.focus({ preventScroll: true })
    );
  }, []);

  useEffect(() => {
    if (!sessionMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeSessionMenu();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.type === "pointerdown" &&
        !sessionMenuHostRef.current?.contains(event.target as Node)
      ) {
        closeSessionMenu();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [closeSessionMenu, sessionMenuOpen]);

  const selectView = (nextView: "conversation" | "materials") => {
    if (nextView === view) return;
    setDirection(nextView === "materials" ? 1 : -1);
    setSessionMenuOpen(false);
    setView(nextView);
  };

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
                <div
                  ref={sessionMenuHostRef}
                  className={styles.workspaceSessionMenuHost}
                >
                  <button
                    ref={sessionMenuTriggerRef}
                    type="button"
                    className={styles.workspaceHeaderButton}
                    aria-label={UI_TEXT.WORKSPACE_SESSIONS}
                    aria-expanded={sessionMenuOpen}
                    onClick={() => setSessionMenuOpen((current) => !current)}
                  >
                    •••
                  </button>
                  <AnimatePresence initial={false}>
                  {sessionMenuOpen ? (
                    <m.div
                      className={styles.workspaceSessionMenu}
                      role="menu"
                      data-motion-role="popover"
                      style={{ transformOrigin: "100% 0%" }}
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                      animate={
                        reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }
                      }
                      exit={
                        reduceMotion
                          ? {
                              opacity: 0,
                              transition: getRoleTransition(
                                "popover-exit",
                                reduceMotion
                              ),
                            }
                          : {
                              opacity: 0,
                              scale: 0.96,
                              transition: getRoleTransition(
                                "popover-exit",
                                reduceMotion
                              ),
                            }
                      }
                      transition={getRoleTransition("popover-enter", reduceMotion)}
                    >
                      {sessions.map((session) => (
                        <button
                          key={session.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={session.id === activeSessionId}
                          onClick={() => {
                            onSelectSession(session.id);
                            closeSessionMenu();
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
                          closeSessionMenu();
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
                            closeSessionMenu();
                            void onCompactConversation();
                          }}
                        >
                          {UI_TEXT.COMPACT_EARLY_CONVERSATION}
                        </button>
                      ) : null}
                    </m.div>
                  ) : null}
                  </AnimatePresence>
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
              onClick={() => selectView("conversation")}
            >
              {view === "conversation" ? (
                <m.span
                  aria-hidden="true"
                  className={styles.workspaceSegmentIndicator}
                  layoutId="workspace-segment-indicator"
                  transition={getRoleTransition("state-enter", reduceMotion)}
                />
              ) : null}
              <span>{UI_TEXT.WORKSPACE_CONVERSATION}</span>
            </button>
            <button
              type="button"
              id="workspace-materials-tab"
              className={styles.workspaceSegment}
              role="tab"
              aria-selected={view === "materials"}
              aria-controls="workspace-materials-panel"
              onClick={() => selectView("materials")}
            >
              {view === "materials" ? (
                <m.span
                  aria-hidden="true"
                  className={styles.workspaceSegmentIndicator}
                  layoutId="workspace-segment-indicator"
                  transition={getRoleTransition("state-enter", reduceMotion)}
                />
              ) : null}
              <span>{UI_TEXT.WORKSPACE_MATERIALS}</span>
            </button>
          </div>

          <div
            className={styles.workspaceViewport}
            data-layout-shift-contained="true"
          >
            <AnimatePresence initial={false} mode="sync">
            {loading ? (
              <m.div
                key="loading"
                className={`${styles.workspaceStatus} ${styles.workspaceStatusRegion}`}
                data-motion-role="inline-status"
                role="status"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{
                  opacity: 0,
                  transition: getRoleTransition("state-exit", reduceMotion),
                }}
                transition={getRoleTransition("state-enter", reduceMotion)}
              >
                {UI_TEXT.LOADING}
              </m.div>
            ) : error ? (
              <m.div
                key="error"
                className={`${styles.workspaceStatus} ${styles.workspaceStatusRegion}`}
                data-motion-role="inline-status"
                role="alert"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{
                  opacity: 0,
                  transition: getRoleTransition("state-exit", reduceMotion),
                }}
                transition={getRoleTransition("state-enter", reduceMotion)}
              >
                {error}
              </m.div>
            ) : view === "conversation" ? (
              <m.div
                key="conversation"
                id="workspace-conversation-panel"
                role="tabpanel"
                aria-labelledby="workspace-conversation-tab"
                className={styles.workspacePanel}
                data-motion-role="inline-state"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * 10 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={
                  reduceMotion
                    ? {
                        opacity: 0,
                        transition: getRoleTransition("state-exit", reduceMotion),
                      }
                    : {
                        opacity: 0,
                        x: direction * -10,
                        transition: getRoleTransition("state-exit", reduceMotion),
                      }
                }
                transition={getRoleTransition("state-enter", reduceMotion)}
              >
                <WorkspaceConversation
                  {...conversation}
                  messages={messages}
                />
              </m.div>
            ) : (
              <m.div
                key="materials"
                id="workspace-materials-panel"
                role="tabpanel"
                aria-labelledby="workspace-materials-tab"
                className={styles.workspacePanel}
                data-motion-role="inline-state"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * 10 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={
                  reduceMotion
                    ? {
                        opacity: 0,
                        transition: getRoleTransition("state-exit", reduceMotion),
                      }
                    : {
                        opacity: 0,
                        x: direction * -10,
                        transition: getRoleTransition("state-exit", reduceMotion),
                      }
                }
                transition={getRoleTransition("state-enter", reduceMotion)}
              >
                <WorkspaceMaterials {...materials} />
              </m.div>
            )}
            </AnimatePresence>
          </div>
    </div>
  );
}
