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
import { readWorkspaceEventStream } from "@/lib/aiStream";
import {
  createWorkspaceSession,
  deleteWorkspaceArtifact,
  ensureDefaultBookWorkspace,
  findWorkspaceArtifactBySourceMessageId,
  listWorkspaceArtifacts,
  listWorkspaceMemories,
  listWorkspaceMessages,
  listWorkspaceSessions,
  putWorkspaceMessage,
  putWorkspaceMessagePair,
  putWorkspaceSession,
  putWorkspaceArtifact,
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
import { createLocalId } from "@/lib/localId";
import {
  READING_SKILLS,
  buildReadingSkillQuestion,
  createArtifactTitle,
  listEligibleReadingSkills,
  type ReadingSkillId,
} from "@/lib/readingSkills";
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
  const streamingContentRef = useRef("");
  const streamingFrameRef = useRef<number | null>(null);
  const artifactsRef = useRef<WorkspaceArtifactRecord[]>([]);

  const publishMessages = useCallback((next: WorkspaceMessageRecord[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const publishSessions = useCallback((next: WorkspaceSessionRecord[]) => {
    sessionsRef.current = next;
    setSessions(next);
  }, []);

  const publishArtifacts = useCallback((next: WorkspaceArtifactRecord[]) => {
    artifactsRef.current = next;
    setArtifacts(next);
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
          content: streamingContentRef.current || pendingAssistant.content,
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
    if (streamingFrameRef.current !== null) {
      window.cancelAnimationFrame(streamingFrameRef.current);
      streamingFrameRef.current = null;
    }
    requestControllerRef.current = null;
    requestIdentityRef.current = null;
    streamingContentRef.current = "";
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
      publishArtifacts([]);
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
          let activeSession = nextSessions[0] ?? owner.session;
          const [loadedMessages, nextArtifacts, nextMemories] = await Promise.all([
            listWorkspaceMessages(activeSession.id, {
              limit: WORKSPACE_MESSAGE_INITIAL_LIMIT,
            }),
            listWorkspaceArtifacts(owner.workspace.id),
            listWorkspaceMemories(owner.workspace.id),
          ]);
          const interruptedAt = new Date().toISOString();
          const interruptedMessages = loadedMessages.filter(
            (message) => message.state === "streaming"
          );
          const nextMessages = loadedMessages.map((message) =>
            message.state === "streaming"
              ? { ...message, state: "cancelled" as const, updatedAt: interruptedAt }
              : message
          );
          if (interruptedMessages.length > 0) {
            activeSession = {
              ...activeSession,
              status: "paused",
              updatedAt: interruptedAt,
            };
            await Promise.all([
              ...nextMessages
                .filter((message) =>
                  interruptedMessages.some((item) => item.id === message.id)
                )
                .map((message) => putWorkspaceMessage(message)),
              putWorkspaceSession(activeSession),
            ]);
          }
          if (cancelled || generationRef.current !== generation) return;

          workspaceRef.current = owner.workspace;
          activeSessionIdRef.current = activeSession.id;
          setWorkspace(owner.workspace);
          publishSessions(
            (nextSessions.length > 0 ? nextSessions : [activeSession]).map(
              (session) =>
                session.id === activeSession.id ? activeSession : session
            )
          );
          setActiveSessionId(activeSession.id);
          publishMessages(nextMessages);
          setHasOlderMessages(
            nextMessages.length === WORKSPACE_MESSAGE_INITIAL_LIMIT
          );
          publishArtifacts(nextArtifacts);
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
  }, [publishArtifacts, publishMessages, publishSessions, workspaceBookId]);

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
    publishArtifacts(nextArtifacts);
    setMemories(nextMemories);
  }, [publishArtifacts]);

  const markRequestCancelled = useCallback(async () => {
    const identity = requestIdentityRef.current;
    if (!identity) return;
    requestControllerRef.current?.abort();
    if (streamingFrameRef.current !== null) {
      window.cancelAnimationFrame(streamingFrameRef.current);
      streamingFrameRef.current = null;
    }
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
        content: streamingContentRef.current || assistant.content,
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
    streamingContentRef.current = "";

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

  const captureCurrentContext = useCallback((): WorkspaceContextSnapshot | null => {
    if (!book) return null;
    const contextSnapshot: WorkspaceContextSnapshot = {
      bookId: book.id,
      bookTitle: book.title,
      bookFormat: book.format,
      capturedAt: new Date().toISOString(),
    };
    if (readerContextBookId === book.id) {
      const nearbyText = limitContextText(
        book.format === "epub"
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
    return contextSnapshot;
  }, [
    book,
    epubReaderRef,
    progressPercent,
    readerContextBookId,
    readerLocator,
    selectedText,
    textReaderRef,
  ]);

  const sendQuestion = useCallback(
    async (
      submittedQuestion: string,
      contextOverride?: WorkspaceContextSnapshot,
      retryUser?: WorkspaceMessageRecord,
      skillId?: ReadingSkillId
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
      const contextSnapshot = contextOverride ?? captureCurrentContext();
      if (!contextSnapshot) return;

      const history = selectInferenceHistory(messagesRef.current);
      const pair = retryUser
        ? {
            user: retryUser,
            assistant: {
              id: createLocalId(),
              workspaceId: currentWorkspace.id,
              sessionId,
              role: "assistant" as const,
              replyToMessageId: retryUser.id,
              content: "",
              state: "streaming" as const,
              ...(retryUser.skillId ? { skillId: retryUser.skillId } : {}),
              createdAt: capturedAt,
              updatedAt: capturedAt,
            },
          }
        : buildWorkspaceMessagePair({
            workspaceId: currentWorkspace.id,
            sessionId,
            question: trimmedQuestion,
            contextSnapshot,
            skillId,
            now: capturedAt,
          });
      const currentSession = sessionsRef.current.find(
        (session) => session.id === sessionId
      );
      const streamingSession: WorkspaceSessionRecord | null = currentSession
        ? { ...currentSession, status: "streaming", updatedAt: capturedAt }
        : null;

      try {
        if (retryUser) {
          await putWorkspaceMessage(pair.assistant);
        } else {
          await putWorkspaceMessagePair(pair.user, pair.assistant);
        }
        if (streamingSession) await putWorkspaceSession(streamingSession);
      } catch (persistenceError) {
        setError(
          isQuotaExceeded(persistenceError)
            ? UI_TEXT.WORKSPACE_QUOTA_EXCEEDED
            : UI_TEXT.WORKSPACE_SAVE_FAILED
        );
        return;
      }

      publishMessages(
        retryUser
          ? [...messagesRef.current, pair.assistant]
          : [...messagesRef.current, pair.user, pair.assistant]
      );
      if (streamingSession) {
        publishSessions(
          sessionsRef.current.map((session) =>
            session.id === streamingSession.id ? streamingSession : session
          )
        );
      }
      if (!retryUser) setQuestion("");
      setLoading(true);
      streamingContentRef.current = "";

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
        if (!response.body) {
          throw new Error(UI_TEXT.WORKSPACE_STREAM_MISSING);
        }

        let sawDone = false;
        let lastCheckpointAt = Date.now();
        let checkpointLength = 0;
        const publishStreamingContent = () => {
          streamingFrameRef.current = null;
          const currentIdentity = requestIdentityRef.current;
          if (
            !currentIdentity ||
            !shouldAcceptWorkspaceEvent(currentIdentity, identity)
          ) {
            return;
          }
          const content = streamingContentRef.current;
          publishMessages(
            messagesRef.current.map((message) =>
              message.id === pair.assistant.id
                ? { ...message, content, updatedAt: new Date().toISOString() }
                : message
            )
          );
        };

        for await (const event of readWorkspaceEventStream(response.body)) {
          const currentIdentity = requestIdentityRef.current;
          if (
            !currentIdentity ||
            !shouldAcceptWorkspaceEvent(currentIdentity, identity)
          ) {
            return;
          }
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "done") {
            sawDone = true;
            break;
          }

          streamingContentRef.current += event.text;
          if (streamingFrameRef.current === null) {
            streamingFrameRef.current = window.requestAnimationFrame(
              publishStreamingContent
            );
          }
          const nowMs = Date.now();
          if (
            nowMs - lastCheckpointAt >= 1_000 ||
            streamingContentRef.current.length - checkpointLength >= 4_000
          ) {
            const checkpoint: WorkspaceMessageRecord = {
              ...pair.assistant,
              content: streamingContentRef.current,
              updatedAt: new Date(nowMs).toISOString(),
            };
            await putWorkspaceMessage(checkpoint);
            lastCheckpointAt = nowMs;
            checkpointLength = checkpoint.content.length;
          }
        }
        if (!sawDone) throw new Error(UI_TEXT.WORKSPACE_STREAM_INTERRUPTED);

        if (streamingFrameRef.current !== null) {
          window.cancelAnimationFrame(streamingFrameRef.current);
          streamingFrameRef.current = null;
        }

        const now = new Date().toISOString();
        const completedAssistant: WorkspaceMessageRecord = {
          ...pair.assistant,
          content: streamingContentRef.current,
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
          content: streamingContentRef.current,
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
          if (streamingFrameRef.current !== null) {
            window.cancelAnimationFrame(streamingFrameRef.current);
            streamingFrameRef.current = null;
          }
          streamingContentRef.current = "";
          setLoading(false);
        }
      }
    },
    [
      activeAiProvider,
      aiProviderUsable,
      book,
      captureCurrentContext,
      markRequestCancelled,
      online,
      publishMessages,
      publishSessions,
    ]
  );

  const ask = useCallback(
    () => sendQuestion(question),
    [question, sendQuestion]
  );

  const eligibleSkills = listEligibleReadingSkills({
    selectedText: selectedText ?? "",
    nearbyText: readerContextBookId === book?.id ? "available" : "",
  });

  const runSkill = useCallback(
    async (skillId: ReadingSkillId) => {
      const contextSnapshot = captureCurrentContext();
      if (!contextSnapshot) return;
      try {
        const instruction = buildReadingSkillQuestion(skillId, {
          selectedText: contextSnapshot.selectedText,
          nearbyText: contextSnapshot.nearbyText,
          locale: navigator.language || "zh-CN",
        });
        setQuestion(instruction);
        await sendQuestion(instruction, contextSnapshot, undefined, skillId);
      } catch (skillError) {
        setError(
          skillError instanceof Error ? skillError.message : UI_TEXT.REQUEST_FAILED
        );
      }
    },
    [captureCurrentContext, sendQuestion]
  );

  const saveMessageToMaterials = useCallback(
    async (messageId: string) => {
      const currentWorkspace = workspaceRef.current;
      const message = messagesRef.current.find(
        (item) =>
          item.id === messageId &&
          item.role === "assistant" &&
          item.state === "complete"
      );
      if (!currentWorkspace || !message || !book) return;
      const existing = await findWorkspaceArtifactBySourceMessageId(
        currentWorkspace.id,
        message.id
      );
      if (existing) return;
      const now = new Date().toISOString();
      const skill = READING_SKILLS.find((item) => item.id === message.skillId);
      const artifact: WorkspaceArtifactRecord = {
        id: createLocalId(),
        workspaceId: currentWorkspace.id,
        sessionId: message.sessionId,
        sourceMessageIds: [message.id],
        kind: skill?.artifactKind ?? "note",
        title: createArtifactTitle(message.content, book.title),
        content: message.content,
        mediaType: "text/markdown",
        createdAt: now,
        updatedAt: now,
      };
      await putWorkspaceArtifact(artifact);
      await refreshMaterials();
    },
    [book, refreshMaterials]
  );

  const renameArtifact = useCallback(
    async (artifactId: string, title: string) => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) throw new Error(UI_TEXT.WORKSPACE_ARTIFACT_TITLE_REQUIRED);
      const artifact = artifactsRef.current.find((item) => item.id === artifactId);
      if (!artifact) return;
      await putWorkspaceArtifact({
        ...artifact,
        title: trimmedTitle.slice(0, 120),
        updatedAt: new Date().toISOString(),
      });
      await refreshMaterials();
    },
    [refreshMaterials]
  );

  const deleteArtifact = useCallback(
    async (artifactId: string) => {
      await deleteWorkspaceArtifact(artifactId);
      await refreshMaterials();
    },
    [refreshMaterials]
  );

  const retry = useCallback(async (assistantMessageId?: string) => {
    const failedAssistant = assistantMessageId
      ? messagesRef.current.find(
          (message) =>
            message.id === assistantMessageId &&
            message.role === "assistant" &&
            message.state === "error"
        )
      : [...messagesRef.current]
          .reverse()
          .find(
            (message) =>
              message.role === "assistant" && message.state === "error"
          );
    if (!failedAssistant?.replyToMessageId) return;
    const userMessage = messagesRef.current.find(
      (message) => message.id === failedAssistant.replyToMessageId
    );
    if (!userMessage?.contextSnapshot) return;
    await sendQuestion(
      userMessage.content,
      userMessage.contextSnapshot,
      userMessage
    );
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
    eligibleSkills,
    selectedText,
    setSelectedText,
    clearSelection,
    question,
    setQuestion,
    loading,
    error,
    online,
    ask,
    runSkill,
    saveMessageToMaterials,
    stop: markRequestCancelled,
    retry,
    selectSession,
    createSession,
    loadOlderMessages,
    renameArtifact,
    deleteArtifact,
    refreshMaterials,
  };
}
