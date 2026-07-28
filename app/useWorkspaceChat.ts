"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { EpubReaderHandle } from "@/app/EpubReader";
import { limitContextText, type AiContext } from "@/lib/aiChat";
import type { AiProviderConfig } from "@/lib/aiProviders";
import {
  createWorkspaceSession,
  ensureDefaultBookWorkspace,
  listWorkspaceArtifacts,
  listWorkspaceMemories,
  listWorkspaceMessages,
  listWorkspaceSessions,
  putWorkspaceMessage,
  putWorkspaceMessagePair,
  putWorkspaceSession,
  type BookMetadata,
} from "@/lib/db";
import {
  WORKSPACE_CONTEXT_CHARS,
  WORKSPACE_MESSAGE_INITIAL_LIMIT,
  WORKSPACE_MESSAGE_PAGE_SIZE,
  type ReadingWorkspaceRecord,
  type WorkspaceArtifactRecord,
  type WorkspaceContextSnapshot,
  type WorkspaceMemoryRecord,
  type WorkspaceMessageRecord,
  type WorkspaceSessionRecord,
} from "@/lib/readingWorkspace";
import {
  buildWorkspaceMessagePair,
  selectInferenceHistory,
  shouldAcceptWorkspaceEvent,
  type WorkspaceRequestIdentity,
} from "@/lib/workspaceChat";
import { UI_TEXT } from "@/lib/uiText";

type UseWorkspaceChatOptions = {
  book: BookMetadata | null;
  readerContextBookId: string | null;
  activeAiProvider: AiProviderConfig | null;
  aiProviderUsable: boolean;
  textReaderRef: RefObject<HTMLDivElement | null>;
  epubReaderRef: RefObject<EpubReaderHandle | null>;
  readerLocator?: string;
  progressPercent?: number;
};

function collectVisibleReaderText(reader: HTMLElement | null): string {
  if (!reader) return "";
  const viewport = reader.getBoundingClientRect();
  const visibleParagraphs = Array.from(reader.querySelectorAll("p"))
    .filter((paragraph) => {
      const rects = paragraph.getClientRects();
      for (let index = 0; index < rects.length; index += 1) {
        const rect = rects[index];
        if (
          rect.bottom >= viewport.top - 80 &&
          rect.top <= viewport.bottom + 80 &&
          rect.right >= viewport.left - 80 &&
          rect.left <= viewport.right + 80
        ) {
          return true;
        }
      }
      return false;
    })
    .map((paragraph) => paragraph.textContent?.trim() ?? "")
    .filter(Boolean);

  return visibleParagraphs.length > 0
    ? visibleParagraphs.join("\n\n")
    : reader.innerText ?? "";
}

function isQuotaExceeded(error: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "QuotaExceededError") ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "QuotaExceededError")
  );
}

export default function useWorkspaceChat({
  book,
  readerContextBookId,
  activeAiProvider,
  aiProviderUsable,
  textReaderRef,
  epubReaderRef,
  readerLocator,
  progressPercent,
}: UseWorkspaceChatOptions) {
  const [workspace, setWorkspace] = useState<ReadingWorkspaceRecord | null>(null);
  const [sessions, setSessions] = useState<WorkspaceSessionRecord[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WorkspaceMessageRecord[]>([]);
  const [artifacts, setArtifacts] = useState<WorkspaceArtifactRecord[]>([]);
  const [memories, setMemories] = useState<WorkspaceMemoryRecord[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [hasOlderMessages, setHasOlderMessages] = useState(false);

  const workspaceRef = useRef<ReadingWorkspaceRecord | null>(null);
  const sessionsRef = useRef<WorkspaceSessionRecord[]>([]);
  const activeSessionIdRef = useRef<string | null>(null);
  const messagesRef = useRef<WorkspaceMessageRecord[]>([]);
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestIdentityRef = useRef<WorkspaceRequestIdentity | null>(null);
  const generationRef = useRef(0);

  const publishMessages = useCallback((next: WorkspaceMessageRecord[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const publishSessions = useCallback((next: WorkspaceSessionRecord[]) => {
    sessionsRef.current = next;
    setSessions(next);
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const workspaceBookId = book?.id ?? null;

  useEffect(() => {
    const pendingIdentity = requestIdentityRef.current;
    if (pendingIdentity) {
      const now = new Date().toISOString();
      const pendingAssistant = messagesRef.current.find(
        (message) => message.id === pendingIdentity.assistantMessageId
      );
      if (pendingAssistant?.state === "streaming") {
        void putWorkspaceMessage({
          ...pendingAssistant,
          state: "cancelled",
          updatedAt: now,
        }).catch(() => undefined);
      }
      const pendingSession = sessionsRef.current.find(
        (session) => session.id === pendingIdentity.sessionId
      );
      if (pendingSession) {
        void putWorkspaceSession({
          ...pendingSession,
          status: "paused",
          updatedAt: now,
        }).catch(() => undefined);
      }
    }
    generationRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    requestIdentityRef.current = null;
    workspaceRef.current = null;
    activeSessionIdRef.current = null;
    messagesRef.current = [];
    sessionsRef.current = [];
    const generation = generationRef.current;
    let cancelled = false;
    const resetTimer = window.setTimeout(() => {
      setWorkspace(null);
      setSessions([]);
      setActiveSessionId(null);
      setMessages([]);
      setArtifacts([]);
      setMemories([]);
      setSelectedText(null);
      setQuestion("");
      setError(null);
      setLoading(false);
      setHasOlderMessages(false);

      if (!workspaceBookId) {
        setWorkspaceLoading(false);
        return;
      }

      setWorkspaceLoading(true);
      void (async () => {
        try {
          const owner = await ensureDefaultBookWorkspace(workspaceBookId);
          const nextSessions = await listWorkspaceSessions(owner.workspace.id);
          const activeSession = nextSessions[0] ?? owner.session;
          const [nextMessages, nextArtifacts, nextMemories] = await Promise.all([
            listWorkspaceMessages(activeSession.id, {
              limit: WORKSPACE_MESSAGE_INITIAL_LIMIT,
            }),
            listWorkspaceArtifacts(owner.workspace.id),
            listWorkspaceMemories(owner.workspace.id),
          ]);
          if (cancelled || generationRef.current !== generation) return;

          workspaceRef.current = owner.workspace;
          activeSessionIdRef.current = activeSession.id;
          setWorkspace(owner.workspace);
          publishSessions(
            nextSessions.length > 0 ? nextSessions : [activeSession]
          );
          setActiveSessionId(activeSession.id);
          publishMessages(nextMessages);
          setHasOlderMessages(
            nextMessages.length === WORKSPACE_MESSAGE_INITIAL_LIMIT
          );
          setArtifacts(nextArtifacts);
          setMemories(nextMemories);
        } catch (loadError) {
          if (!cancelled && generationRef.current === generation) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : UI_TEXT.WORKSPACE_LOAD_FAILED
            );
          }
        } finally {
          if (!cancelled && generationRef.current === generation) {
            setWorkspaceLoading(false);
          }
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(resetTimer);
    };
  }, [publishMessages, publishSessions, workspaceBookId]);

  useEffect(() => {
    return () => requestControllerRef.current?.abort();
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedText(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const refreshMaterials = useCallback(async () => {
    const currentWorkspace = workspaceRef.current;
    if (!currentWorkspace) return;
    const [nextArtifacts, nextMemories] = await Promise.all([
      listWorkspaceArtifacts(currentWorkspace.id),
      listWorkspaceMemories(currentWorkspace.id),
    ]);
    setArtifacts(nextArtifacts);
    setMemories(nextMemories);
  }, []);

  const markRequestCancelled = useCallback(async () => {
    const identity = requestIdentityRef.current;
    if (!identity) return;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    requestIdentityRef.current = null;
    generationRef.current += 1;

    const now = new Date().toISOString();
    const assistant = messagesRef.current.find(
      (message) => message.id === identity.assistantMessageId
    );
    if (assistant && assistant.state === "streaming") {
      const cancelledMessage: WorkspaceMessageRecord = {
        ...assistant,
        state: "cancelled",
        updatedAt: now,
      };
      await putWorkspaceMessage(cancelledMessage).catch(() => undefined);
      publishMessages(
        messagesRef.current.map((message) =>
          message.id === cancelledMessage.id ? cancelledMessage : message
        )
      );
    }

    const session = sessionsRef.current.find(
      (item) => item.id === identity.sessionId
    );
    if (session) {
      const pausedSession: WorkspaceSessionRecord = {
        ...session,
        status: "paused",
        updatedAt: now,
      };
      await putWorkspaceSession(pausedSession).catch(() => undefined);
      publishSessions(
        sessionsRef.current.map((item) =>
          item.id === pausedSession.id ? pausedSession : item
        )
      );
    }
    setLoading(false);
  }, [publishMessages, publishSessions]);

  const selectSession = useCallback(
    async (sessionId: string) => {
      if (sessionId === activeSessionIdRef.current) return;
      await markRequestCancelled();
      generationRef.current += 1;
      const generation = generationRef.current;
      setError(null);
      setWorkspaceLoading(true);
      try {
        const nextMessages = await listWorkspaceMessages(sessionId, {
          limit: WORKSPACE_MESSAGE_INITIAL_LIMIT,
        });
        if (generationRef.current !== generation) return;
        activeSessionIdRef.current = sessionId;
        setActiveSessionId(sessionId);
        publishMessages(nextMessages);
        setHasOlderMessages(
          nextMessages.length === WORKSPACE_MESSAGE_INITIAL_LIMIT
        );
      } catch (loadError) {
        if (generationRef.current === generation) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : UI_TEXT.WORKSPACE_LOAD_FAILED
          );
        }
      } finally {
        if (generationRef.current === generation) setWorkspaceLoading(false);
      }
    },
    [markRequestCancelled, publishMessages]
  );

  const createSession = useCallback(async () => {
    const currentWorkspace = workspaceRef.current;
    if (!currentWorkspace) return;
    await markRequestCancelled();
    setError(null);
    try {
      const session = await createWorkspaceSession(currentWorkspace.id);
      const nextSessions = await listWorkspaceSessions(currentWorkspace.id);
      publishSessions(nextSessions);
      activeSessionIdRef.current = session.id;
      setActiveSessionId(session.id);
      publishMessages([]);
      setHasOlderMessages(false);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : UI_TEXT.WORKSPACE_SESSION_CREATE_FAILED
      );
    }
  }, [markRequestCancelled, publishMessages, publishSessions]);

  const loadOlderMessages = useCallback(async () => {
    const sessionId = activeSessionIdRef.current;
    const oldest = messagesRef.current[0];
    if (!sessionId || !oldest || !hasOlderMessages) return;
    const older = await listWorkspaceMessages(sessionId, {
      limit: WORKSPACE_MESSAGE_PAGE_SIZE,
      before: { createdAt: oldest.createdAt, id: oldest.id },
    });
    const knownIds = new Set(messagesRef.current.map((message) => message.id));
    publishMessages([
      ...older.filter((message) => !knownIds.has(message.id)),
      ...messagesRef.current,
    ]);
    setHasOlderMessages(older.length === WORKSPACE_MESSAGE_PAGE_SIZE);
  }, [hasOlderMessages, publishMessages]);

  const sendQuestion = useCallback(
    async (
      submittedQuestion: string,
      contextOverride?: WorkspaceContextSnapshot
    ) => {
      const currentWorkspace = workspaceRef.current;
      const sessionId = activeSessionIdRef.current;
      const targetBook = book;
      const trimmedQuestion = submittedQuestion.trim();
      if (!trimmedQuestion || !currentWorkspace || !sessionId || !targetBook) {
        return;
      }
      if (!activeAiProvider || !aiProviderUsable) {
        setError(UI_TEXT.CONFIGURE_AI_PROMPT);
        return;
      }
      if (!online) {
        setError(UI_TEXT.WORKSPACE_OFFLINE);
        return;
      }

      await markRequestCancelled();
      setError(null);

      const capturedAt = new Date().toISOString();
      let contextSnapshot = contextOverride;
      if (!contextSnapshot) {
        contextSnapshot = {
          bookId: targetBook.id,
          bookTitle: targetBook.title,
          bookFormat: targetBook.format,
          capturedAt,
        };
        if (readerContextBookId === targetBook.id) {
          const nearbyText = limitContextText(
            targetBook.format === "epub"
              ? epubReaderRef.current?.getVisibleText()
              : collectVisibleReaderText(textReaderRef.current),
            WORKSPACE_CONTEXT_CHARS
          );
          const selected = limitContextText(
            selectedText ?? undefined,
            WORKSPACE_CONTEXT_CHARS
          );
          if (nearbyText) contextSnapshot.nearbyText = nearbyText;
          if (selected) contextSnapshot.selectedText = selected;
          if (readerLocator) contextSnapshot.locator = readerLocator;
          if (typeof progressPercent === "number" && Number.isFinite(progressPercent)) {
            contextSnapshot.progressPercent = progressPercent;
          }
        }
      }

      const history = selectInferenceHistory(messagesRef.current);
      const pair = buildWorkspaceMessagePair({
        workspaceId: currentWorkspace.id,
        sessionId,
        question: trimmedQuestion,
        contextSnapshot,
        now: capturedAt,
      });
      const currentSession = sessionsRef.current.find(
        (session) => session.id === sessionId
      );
      const streamingSession: WorkspaceSessionRecord | null = currentSession
        ? { ...currentSession, status: "streaming", updatedAt: capturedAt }
        : null;

      try {
        await putWorkspaceMessagePair(pair.user, pair.assistant);
        if (streamingSession) await putWorkspaceSession(streamingSession);
      } catch (persistenceError) {
        setError(
          isQuotaExceeded(persistenceError)
            ? UI_TEXT.WORKSPACE_QUOTA_EXCEEDED
            : UI_TEXT.WORKSPACE_SAVE_FAILED
        );
        return;
      }

      publishMessages([...messagesRef.current, pair.user, pair.assistant]);
      if (streamingSession) {
        publishSessions(
          sessionsRef.current.map((session) =>
            session.id === streamingSession.id ? streamingSession : session
          )
        );
      }
      setQuestion("");
      setLoading(true);

      const controller = new AbortController();
      const identity: WorkspaceRequestIdentity = {
        workspaceId: currentWorkspace.id,
        sessionId,
        assistantMessageId: pair.assistant.id,
        generation: generationRef.current + 1,
      };
      generationRef.current = identity.generation;
      requestControllerRef.current = controller;
      requestIdentityRef.current = identity;

      const context: AiContext = {
        bookTitle: contextSnapshot.bookTitle,
        bookFormat: contextSnapshot.bookFormat,
        selectedText: contextSnapshot.selectedText,
        nearbyText: contextSnapshot.nearbyText,
      };

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            provider: activeAiProvider,
            question: trimmedQuestion,
            messages: history,
            context,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(
            data?.error || `${UI_TEXT.REQUEST_FAILED} (${response.status})`
          );
        }
        const data = await response.json();
        const currentIdentity = requestIdentityRef.current;
        if (
          !currentIdentity ||
          !shouldAcceptWorkspaceEvent(currentIdentity, identity)
        ) {
          return;
        }

        const now = new Date().toISOString();
        const completedAssistant: WorkspaceMessageRecord = {
          ...pair.assistant,
          content: typeof data.answer === "string" ? data.answer : "",
          state: "complete",
          updatedAt: now,
        };
        await putWorkspaceMessage(completedAssistant);
        publishMessages(
          messagesRef.current.map((message) =>
            message.id === completedAssistant.id ? completedAssistant : message
          )
        );
        if (streamingSession) {
          const idleSession: WorkspaceSessionRecord = {
            ...streamingSession,
            status: "idle",
            updatedAt: now,
          };
          await putWorkspaceSession(idleSession);
          publishSessions(
            sessionsRef.current.map((session) =>
              session.id === idleSession.id ? idleSession : session
            )
          );
        }
      } catch (requestError) {
        if (controller.signal.aborted) return;
        const currentIdentity = requestIdentityRef.current;
        if (
          !currentIdentity ||
          !shouldAcceptWorkspaceEvent(currentIdentity, identity)
        ) {
          return;
        }
        const message =
          requestError instanceof Error
            ? requestError.message
            : UI_TEXT.REQUEST_FAILED;
        const now = new Date().toISOString();
        const failedAssistant: WorkspaceMessageRecord = {
          ...pair.assistant,
          state: "error",
          error: message,
          updatedAt: now,
        };
        await putWorkspaceMessage(failedAssistant).catch(() => undefined);
        publishMessages(
          messagesRef.current.map((item) =>
            item.id === failedAssistant.id ? failedAssistant : item
          )
        );
        if (streamingSession) {
          const failedSession: WorkspaceSessionRecord = {
            ...streamingSession,
            status: "error",
            updatedAt: now,
          };
          await putWorkspaceSession(failedSession).catch(() => undefined);
          publishSessions(
            sessionsRef.current.map((session) =>
              session.id === failedSession.id ? failedSession : session
            )
          );
        }
        setError(message);
      } finally {
        const currentIdentity = requestIdentityRef.current;
        if (
          currentIdentity &&
          shouldAcceptWorkspaceEvent(currentIdentity, identity)
        ) {
          requestIdentityRef.current = null;
          requestControllerRef.current = null;
          setLoading(false);
        }
      }
    },
    [
      activeAiProvider,
      aiProviderUsable,
      book,
      epubReaderRef,
      markRequestCancelled,
      online,
      progressPercent,
      publishMessages,
      publishSessions,
      readerContextBookId,
      readerLocator,
      selectedText,
      textReaderRef,
    ]
  );

  const ask = useCallback(
    () => sendQuestion(question),
    [question, sendQuestion]
  );

  const retry = useCallback(async () => {
    const failedAssistant = [...messagesRef.current]
      .reverse()
      .find((message) => message.role === "assistant" && message.state === "error");
    if (!failedAssistant?.replyToMessageId) return;
    const userMessage = messagesRef.current.find(
      (message) => message.id === failedAssistant.replyToMessageId
    );
    if (!userMessage?.contextSnapshot) return;
    await sendQuestion(userMessage.content, userMessage.contextSnapshot);
  }, [sendQuestion]);

  return {
    workspace,
    sessions,
    activeSessionId,
    messages,
    artifacts,
    memories,
    workspaceLoading,
    hasOlderMessages,
    selectedText,
    setSelectedText,
    clearSelection,
    question,
    setQuestion,
    loading,
    error,
    online,
    ask,
    stop: markRequestCancelled,
    retry,
    selectSession,
    createSession,
    loadOlderMessages,
    refreshMaterials,
  };
}
