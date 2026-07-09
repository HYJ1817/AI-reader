"use client";

import styles from "./page.module.css";
import { UI_TEXT } from "@/lib/uiText";

export type AiConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type Props = {
  selectedText: string | null;
  question: string;
  onQuestionChange: (value: string) => void;
  messages: AiConversationMessage[];
  loading: boolean;
  error: string | null;
  onAsk: () => void;
  onClearSelection: () => void;
  aiSettingsUsable: boolean;
  bookTitle: string | null;
  onOpenSettings: () => void;
};

export default function AskAiPanel({
  selectedText,
  question,
  onQuestionChange,
  messages,
  loading,
  error,
  onAsk,
  onClearSelection,
  aiSettingsUsable,
  bookTitle,
  onOpenSettings,
}: Props) {
  return (
    <>
      {bookTitle && (
        <p className={`${styles.emptyText} ${styles.askContext}`}>
          {UI_TEXT.ASKING_ABOUT.replace("{title}", bookTitle)}
        </p>
      )}

      {selectedText && (
        <div className={styles.selectedTextPreview}>
          <button
            className={styles.clearSelectionButton}
            onClick={onClearSelection}
            title={UI_TEXT.CLEAR}
            aria-label={UI_TEXT.CLEAR}
          >
            x
          </button>
          <div className={styles.selectedTextLabel}>{UI_TEXT.SELECTED_TEXT}</div>
          {selectedText.length > 300
            ? selectedText.slice(0, 300) + "..."
            : selectedText}
        </div>
      )}

      {!aiSettingsUsable && (
        <p className={styles.settingsPrompt} onClick={onOpenSettings}>
          {UI_TEXT.CONFIGURE_AI_PROMPT}
        </p>
      )}

      <div className={styles.askInput}>
        <input
          type="text"
          placeholder={UI_TEXT.ASK_PLACEHOLDER}
          className={styles.input}
          value={question}
          onChange={(e) => onQuestionChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onAsk();
          }}
          disabled={!aiSettingsUsable}
        />
        <button
          className={styles.sendButton}
          onClick={onAsk}
          disabled={!aiSettingsUsable || loading || !question.trim()}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 10l14-7-7 14-2-5z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {loading && (
        <div className={styles.loadingDots}>
          <span></span>
          <span></span>
          <span></span>
        </div>
      )}

      {error && (
        <div className={styles.errorBox}>{error}</div>
      )}

      {messages.length > 0 && (
        <div className={styles.askMessages}>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`${styles.askMessage} ${
                message.role === "user"
                  ? styles.askMessageUser
                  : styles.askMessageAssistant
              }`}
            >
              {message.content}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
