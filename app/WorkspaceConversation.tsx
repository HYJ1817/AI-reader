"use client";

import { AnimatePresence, m } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import { getRoleTransition } from "@/lib/motionSystem";
import type { WorkspaceMessageRecord } from "@/lib/readingWorkspace";
import type { ReadingSkill, ReadingSkillId } from "@/lib/readingSkills";
import { UI_TEXT } from "@/lib/uiText";
import { useAppReducedMotion } from "./AppMotionRoot";
import useWorkspaceViewportFollow from "./useWorkspaceViewportFollow";
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
  eligibleSkills: ReadingSkill[];
  compact?: boolean;
  onQuestionChange: (value: string) => void;
  onAsk: () => void;
  onStop: () => void;
  onRetry: (assistantMessageId?: string) => void;
  onClearSelection: () => void;
  onOpenSettings: () => void;
  onLoadOlder: () => Promise<void> | void;
  onRunSkill: (skillId: ReadingSkillId) => Promise<void> | void;
  onSaveToMaterials: (messageId: string) => Promise<void> | void;
  onRemember: (messageId: string, content: string) => Promise<void> | void;
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
  eligibleSkills,
  compact = false,
  onQuestionChange,
  onAsk,
  onStop,
  onRetry,
  onClearSelection,
  onOpenSettings,
  onLoadOlder,
  onRunSkill,
  onSaveToMaterials,
  onRemember,
}: WorkspaceConversationProps) {
  const reduceMotion = useAppReducedMotion();
  const memoryReviewTextareaRef = useRef<HTMLTextAreaElement>(null);
  const memoryReviewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [memoryReview, setMemoryReview] = useState<{
    messageId: string;
    content: string;
  } | null>(null);
  const [seenMessageIds] = useState(
    () => new Set(messages.map((message) => message.id))
  );
  const enteringMessageIds = new Set(
    messages
      .filter((message) => !seenMessageIds.has(message.id))
      .map((message) => message.id)
  );
  const memoryReviewOpen = memoryReview !== null;
  const lastMessage = messages.at(-1);
  const contentRevision = lastMessage
    ? `${lastMessage.id}:${lastMessage.state}:${lastMessage.content.length}`
    : `empty:${loading}`;
  const {
    threadRef,
    showReturnToBottom,
    onScroll,
    onUserInteractionStart,
    onUserInteractionEnd,
    onUserInteractionCancel,
    onWheel,
    preservePrependAnchor,
    returnToBottom,
  } = useWorkspaceViewportFollow({
    contentRevision,
    visible: !memoryReviewOpen,
  });

  useLayoutEffect(() => {
    if (memoryReviewOpen) {
      memoryReviewTextareaRef.current?.focus({ preventScroll: true });
      return;
    }

    const trigger = memoryReviewTriggerRef.current;
    memoryReviewTriggerRef.current = null;
    if (trigger?.isConnected) {
      trigger.focus({ preventScroll: true });
    }
  }, [memoryReviewOpen]);

  useLayoutEffect(() => {
    messages.forEach((message) => seenMessageIds.add(message.id));
  }, [messages, seenMessageIds]);

  const handleLoadOlder = async () => {
    await preservePrependAnchor(onLoadOlder);
  };

  return (
    <div
      className={`${styles.workspaceConversation} ${
        compact ? styles.workspaceConversationCompact : ""
      }`}
    >
      <div
        ref={threadRef}
        data-workspace-thread="true"
        className={styles.workspaceConversationThread}
        aria-busy={loading}
        aria-hidden={memoryReview ? true : undefined}
        inert={memoryReview ? true : undefined}
        onScroll={onScroll}
        onPointerDown={onUserInteractionStart}
        onPointerUp={onUserInteractionEnd}
        onPointerCancel={onUserInteractionCancel}
        onTouchStart={onUserInteractionStart}
        onTouchEnd={onUserInteractionEnd}
        onTouchCancel={onUserInteractionEnd}
        onWheel={onWheel}
      >
        {hasOlderMessages ? (
          <button
            type="button"
            data-workspace-prepend-anchor="true"
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

        <AnimatePresence initial={false} mode="sync">
        {messages.length === 0 && !loading ? (
          <m.div
            key="empty"
            className={styles.workspaceEmptyState}
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
            <strong>{UI_TEXT.WORKSPACE_EMPTY_TITLE}</strong>
            <span>{UI_TEXT.WORKSPACE_EMPTY_HINT}</span>
          </m.div>
        ) : (
          <m.div
            key="messages"
            className={styles.workspaceMessages}
            aria-live="polite"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{
              opacity: 0,
              transition: getRoleTransition("state-exit", reduceMotion),
            }}
          >
            {messages.map((message) => {
              const isEntering = enteringMessageIds.has(message.id);
              return (
              <m.div
                key={message.id}
                data-workspace-message-id={message.id}
                data-workspace-message-state={message.state}
                data-motion-role="message-entrance"
                className={`${styles.workspaceMessage} ${
                  message.role === "user"
                    ? styles.workspaceMessageUser
                    : styles.workspaceMessageAssistant
                  }`}
                initial={isEntering ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                transition={getRoleTransition("state-enter", reduceMotion)}
              >
                <WorkspaceMessageBody message={message} />
                {message.role === "assistant" && message.state === "complete" ? (
                  <button
                    type="button"
                    className={styles.workspaceMessageAction}
                    onClick={() => void onSaveToMaterials(message.id)}
                  >
                    {UI_TEXT.SAVE_TO_MATERIALS}
                  </button>
                ) : null}
                {message.role === "assistant" && message.state === "complete" ? (
                  <button
                    type="button"
                    className={styles.workspaceMessageAction}
                    onClick={(event) => {
                      memoryReviewTriggerRef.current = event.currentTarget;
                      setMemoryReview({
                        messageId: message.id,
                        content: message.content,
                      });
                    }}
                  >
                    {UI_TEXT.REMEMBER}
                  </button>
                ) : null}
                {message.state === "error" ? (
                  <button
                    type="button"
                    className={styles.workspaceRetryButton}
                    onClick={() => onRetry(message.id)}
                  >
                    {UI_TEXT.RETRY}
                  </button>
                ) : null}
              </m.div>
              );
            })}
          </m.div>
        )}
        </AnimatePresence>

        <div className={styles.workspaceConversationStatusRegion}>
          <AnimatePresence initial={false} mode="sync">
            {error ? (
              <m.div
                key="error"
                className={styles.errorBox}
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
            ) : loading ? (
              <m.div
                key="loading"
                className={styles.workspaceThinking}
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
                {UI_TEXT.AI_THINKING}
              </m.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {showReturnToBottom && !memoryReview ? (
        <button
          type="button"
          className={styles.workspaceReturnToLatest}
          onClick={returnToBottom}
        >
          {UI_TEXT.WORKSPACE_RETURN_TO_LATEST}
        </button>
      ) : null}

      {memoryReview ? (
        <div
          className={styles.workspaceMemoryReview}
          role="region"
          aria-labelledby="workspace-memory-review-title"
          aria-live="polite"
        >
          <strong id="workspace-memory-review-title">
            {UI_TEXT.REVIEW_MEMORY}
          </strong>
          <textarea
            ref={memoryReviewTextareaRef}
            aria-label={UI_TEXT.WORKSPACE_MEMORY}
            value={memoryReview.content}
            onChange={(event) =>
              setMemoryReview({ ...memoryReview, content: event.target.value })
            }
          />
          <div>
            <button type="button" onClick={() => setMemoryReview(null)}>
              {UI_TEXT.CANCEL}
            </button>
            <button
              type="button"
              disabled={!memoryReview.content.trim()}
              onClick={async () => {
                await onRemember(memoryReview.messageId, memoryReview.content);
                setMemoryReview(null);
              }}
            >
              {UI_TEXT.SAVE}
            </button>
          </div>
        </div>
      ) : null}

      {eligibleSkills.length > 0 && (messages.length === 0 || selectedText) ? (
        <div
          className={styles.workspaceSkills}
          aria-label={UI_TEXT.READING_SKILLS}
          aria-hidden={memoryReview ? true : undefined}
          inert={memoryReview ? true : undefined}
        >
          {eligibleSkills.map((skill) => (
            <button
              key={skill.id}
              type="button"
              title={skill.description}
              disabled={loading || !online || !aiSettingsUsable}
              onClick={() => void onRunSkill(skill.id)}
            >
              {skill.name}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className={styles.workspaceComposer}
        aria-hidden={memoryReview ? true : undefined}
        inert={memoryReview ? true : undefined}
      >
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
