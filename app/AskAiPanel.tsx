"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, m } from "motion/react";
import { useAppReducedMotion } from "./AppMotionRoot";
import styles from "./page.module.css";
import { MOTION_DURATION } from "@/lib/motionSystem";
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
  onOpenSettings,
}: Props) {
  const threadRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useAppReducedMotion();

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTop = thread.scrollHeight;
  }, [loading, messages.length]);

  return (
    <div className={styles.askPanel}>
      <m.div
        className={styles.askThread}
        ref={threadRef}
        layout={reduceMotion ? false : "position"}
        aria-busy={loading}
      >
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
          <button
            type="button"
            className={styles.settingsPrompt}
            onClick={onOpenSettings}
          >
            {UI_TEXT.CONFIGURE_AI_PROMPT}
          </button>
        )}

        {messages.length > 0 && (
          <div className={styles.askMessages} aria-live="polite">
            <AnimatePresence initial={false} mode="popLayout">
              {messages.map((message) => (
                <m.div
                  key={message.id}
                  layout={reduceMotion ? false : "position"}
                  initial={{
                    opacity: 0,
                    y: reduceMotion ? 0 : 5,
                    scale: reduceMotion || message.role === "assistant" ? 1 : 0.985,
                  }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    y: reduceMotion ? 0 : -3,
                    scale: reduceMotion ? 1 : 0.985,
                  }}
                  transition={{
                    duration: reduceMotion
                      ? MOTION_DURATION.reduced
                      : MOTION_DURATION.state,
                  }}
                  className={`${styles.askMessage} ${
                    message.role === "user"
                      ? styles.askMessageUser
                      : styles.askMessageAssistant
                  }`}
                >
                  {message.content}
                </m.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {loading && (
          <div
            className={styles.loadingDots}
            role="status"
            aria-label={UI_TEXT.AI_THINKING}
          >
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
          </div>
        )}

        {error && (
          <div className={styles.errorBox} role="alert">{error}</div>
        )}
      </m.div>

      <m.div
        className={styles.askComposer}
        layout={reduceMotion ? false : "position"}
      >
        <div className={styles.askInput}>
          <input
            type="text"
            aria-label={UI_TEXT.ASK_AI}
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
            type="button"
            className={styles.sendButton}
            aria-label={UI_TEXT.SEND}
            onClick={onAsk}
            disabled={!aiSettingsUsable || loading || !question.trim()}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M3 10l14-7-7 14-2-5z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </m.div>
    </div>
  );
}
