"use client";

import { useEffect, useRef } from "react";
import type { WorkspaceMessageRecord } from "@/lib/readingWorkspace";
import { UI_TEXT } from "@/lib/uiText";
import styles from "./page.module.css";

export type WorkspaceConversationProps = {
  messages: WorkspaceMessageRecord[];
  selectedText: string | null;
  question: string;
  loading: boolean;
  error: string | null;
  aiSettingsUsable: boolean;
  compact?: boolean;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
  onClearSelection: () => void;
  onOpenSettings: () => void;
};

export default function WorkspaceConversation({
  messages,
  selectedText,
  question,
  loading,
  error,
  aiSettingsUsable,
  compact = false,
  onQuestionChange,
  onAsk,
  onClearSelection,
  onOpenSettings,
}: WorkspaceConversationProps) {
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [loading, messages.length]);

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
      >
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
                {message.content}
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
        <input
          type="text"
          aria-label={UI_TEXT.ASK_AI}
          placeholder={UI_TEXT.ASK_PLACEHOLDER}
          className={styles.input}
          value={question}
          onChange={(event) => onQuestionChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) onAsk();
          }}
          disabled={!aiSettingsUsable}
        />
        <button
          type="button"
          className={styles.sendButton}
          aria-label={UI_TEXT.SEND}
          onClick={onAsk}
          disabled={!aiSettingsUsable || loading || !question.trim()}
        >
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
        </button>
      </div>
    </div>
  );
}
