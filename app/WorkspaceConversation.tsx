"use client";

import { useEffect, useRef } from "react";
import type { WorkspaceMessageRecord } from "@/lib/readingWorkspace";
import { UI_TEXT } from "@/lib/uiText";
import WorkspaceMessageBody from "./WorkspaceMessageBody";
import styles from "./page.module.css";

export type WorkspaceConversationProps = {
  messages: WorkspaceMessageRecord[];
  selectedText: string | null;
  question: string;
  loading: boolean;
  error: string | null;
  aiSettingsUsable: boolean;
  online: boolean;
  hasOlderMessages: boolean;
  compact?: boolean;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
  onStop: () => void;
  onRetry: (assistantMessageId?: string) => void;
  onClearSelection: () => void;
  onOpenSettings: () => void;
  onLoadOlder: () => Promise<void> | void;
};

export default function WorkspaceConversation({
  messages,
  selectedText,
  question,
  loading,
  error,
  aiSettingsUsable,
  online,
  hasOlderMessages,
  compact = false,
  onQuestionChange,
  onAsk,
  onStop,
  onRetry,
  onClearSelection,
  onOpenSettings,
  onLoadOlder,
}: WorkspaceConversationProps) {
  const threadRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread && nearBottomRef.current) thread.scrollTop = thread.scrollHeight;
  }, [loading, messages]);

  const handleLoadOlder = async () => {
    const thread = threadRef.current;
    if (!thread) return;
    const previousScrollHeight = thread.scrollHeight;
    const previousScrollTop = thread.scrollTop;
    await onLoadOlder();
    requestAnimationFrame(() => {
      if (!threadRef.current) return;
      const thread = threadRef.current;
      thread.scrollTop = thread.scrollHeight - previousScrollHeight + previousScrollTop;
    });
  };

  return (
    <div
      className={`${styles.workspaceConversation} ${
        compact ? styles.workspaceConversationCompact : ""
      }`}
    >
      <div
        ref={threadRef}
        className={styles.workspaceConversationThread}
        aria-busy={loading}
        onScroll={(event) => {
          const thread = event.currentTarget;
          nearBottomRef.current =
            thread.scrollHeight - thread.scrollTop - thread.clientHeight <= 48;
        }}
      >
        {hasOlderMessages ? (
          <button
            type="button"
            className={styles.workspaceLoadOlderButton}
            onClick={() => void handleLoadOlder()}
          >
            {UI_TEXT.LOAD_OLDER}
          </button>
        ) : null}
        {selectedText ? (
          <div className={styles.selectedTextPreview}>
            <button
              type="button"
              className={styles.clearSelectionButton}
              onClick={onClearSelection}
              title={UI_TEXT.CLEAR}
              aria-label={UI_TEXT.CLEAR}
            >
              ×
            </button>
            <div className={styles.selectedTextLabel}>{UI_TEXT.SELECTED_TEXT}</div>
            {selectedText.length > 300
              ? `${selectedText.slice(0, 300)}…`
              : selectedText}
          </div>
        ) : null}

        {!aiSettingsUsable ? (
          <button
            type="button"
            className={styles.settingsPrompt}
            onClick={onOpenSettings}
          >
            {UI_TEXT.CONFIGURE_AI_PROMPT}
          </button>
        ) : null}
        {!online ? (
          <div className={styles.workspaceOffline} role="status">
            {UI_TEXT.WORKSPACE_OFFLINE}
          </div>
        ) : null}

        {messages.length === 0 && !loading ? (
          <div className={styles.workspaceEmptyState}>
            <strong>{UI_TEXT.WORKSPACE_EMPTY_TITLE}</strong>
            <span>{UI_TEXT.WORKSPACE_EMPTY_HINT}</span>
          </div>
        ) : (
          <div className={styles.workspaceMessages} aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`${styles.workspaceMessage} ${
                  message.role === "user"
                    ? styles.workspaceMessageUser
                    : styles.workspaceMessageAssistant
                }`}
              >
                <WorkspaceMessageBody message={message} />
                {message.state === "error" ? (
                  <button
                    type="button"
                    className={styles.workspaceRetryButton}
                    onClick={() => onRetry(message.id)}
                  >
                    {UI_TEXT.RETRY}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div className={styles.workspaceThinking} role="status">
            {UI_TEXT.AI_THINKING}
          </div>
        ) : null}
        {error ? (
          <div className={styles.errorBox} role="alert">
            {error}
          </div>
        ) : null}
      </div>

      <div className={styles.workspaceComposer}>
        <textarea
          rows={1}
          aria-label={UI_TEXT.ASK_AI}
          placeholder={UI_TEXT.ASK_PLACEHOLDER}
          className={styles.input}
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              onAsk();
            }
          }}
          disabled={!aiSettingsUsable}
        />
        <button
          type="button"
          className={styles.sendButton}
          aria-label={loading ? UI_TEXT.STOP : UI_TEXT.SEND}
          onClick={loading ? onStop : onAsk}
          disabled={
            !aiSettingsUsable || !online || (!loading && !question.trim())
          }
        >
          {loading ? (
            <span className={styles.workspaceStopIcon} aria-hidden="true" />
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path
                d="M3 10l14-7-7 14-2-5z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
