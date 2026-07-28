import {
  limitContextText,
  type ChatConversationMessage,
} from "./aiChat";
import { createLocalId } from "./localId";
import {
  WORKSPACE_HISTORY_MESSAGE_CHARS,
  WORKSPACE_HISTORY_MESSAGE_LIMIT,
  type WorkspaceContextSnapshot,
  type WorkspaceMessageRecord,
} from "./readingWorkspace";

export type WorkspaceRequestIdentity = {
  workspaceId: string;
  sessionId: string;
  assistantMessageId: string;
  generation: number;
};

export function buildWorkspaceMessagePair({
  workspaceId,
  sessionId,
  question,
  contextSnapshot,
  skillId,
  now = new Date().toISOString(),
  createId = createLocalId,
}: {
  workspaceId: string;
  sessionId: string;
  question: string;
  contextSnapshot: WorkspaceContextSnapshot;
  skillId?: string;
  now?: string;
  createId?: () => string;
}): { user: WorkspaceMessageRecord; assistant: WorkspaceMessageRecord } {
  const userId = createId();
  const assistantId = createId();
  const shared = {
    workspaceId,
    sessionId,
    createdAt: now,
    updatedAt: now,
    ...(skillId ? { skillId } : {}),
  };

  return {
    user: {
      id: userId,
      ...shared,
      role: "user",
      content: question.trim(),
      state: "complete",
      contextSnapshot,
    },
    assistant: {
      id: assistantId,
      ...shared,
      role: "assistant",
      replyToMessageId: userId,
      content: "",
      state: "streaming",
    },
  };
}

export function selectInferenceHistory(
  messages: WorkspaceMessageRecord[]
): ChatConversationMessage[] {
  return messages
    .filter(
      (message) =>
        (message.state === "complete" || message.state === "cancelled") &&
        message.content.trim().length > 0
    )
    .map((message) => ({
      role: message.role,
      content: limitContextText(
        message.content,
        WORKSPACE_HISTORY_MESSAGE_CHARS
      ),
    }))
    .slice(-WORKSPACE_HISTORY_MESSAGE_LIMIT);
}

export function shouldAcceptWorkspaceEvent(
  current: WorkspaceRequestIdentity,
  incoming: WorkspaceRequestIdentity
): boolean {
  return (
    current.workspaceId === incoming.workspaceId &&
    current.sessionId === incoming.sessionId &&
    current.assistantMessageId === incoming.assistantMessageId &&
    current.generation === incoming.generation
  );
}
