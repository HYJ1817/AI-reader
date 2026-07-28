"use client";

import type { WorkspaceMessageRecord } from "@/lib/readingWorkspace";
import WorkspaceConversation from "./WorkspaceConversation";

export type AiConversationMessage = WorkspaceMessageRecord;

type Props = {
  selectedText: string | null;
  question: string;
  onQuestionChange: (value: string) => void;
  messages: WorkspaceMessageRecord[];
  loading: boolean;
  error: string | null;
  online: boolean;
  onAsk: () => void;
  onStop: () => void;
  onRetry: (assistantMessageId?: string) => void;
  onClearSelection: () => void;
  aiSettingsUsable: boolean;
  onOpenSettings: () => void;
};

export default function AskAiPanel(props: Props) {
  return <WorkspaceConversation {...props} compact />;
}
