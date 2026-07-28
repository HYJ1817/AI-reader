"use client";

import type { WorkspaceMessageRecord } from "@/lib/readingWorkspace";
import type { ReadingSkill, ReadingSkillId } from "@/lib/readingSkills";
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
  hasOlderMessages: boolean;
  eligibleSkills: ReadingSkill[];
  onAsk: () => void;
  onStop: () => void;
  onRetry: (assistantMessageId?: string) => void;
  onClearSelection: () => void;
  aiSettingsUsable: boolean;
  onOpenSettings: () => void;
  onLoadOlder: () => Promise<void> | void;
  onRunSkill: (skillId: ReadingSkillId) => Promise<void> | void;
  onSaveToMaterials: (messageId: string) => Promise<void> | void;
  onRemember: (messageId: string, content: string) => Promise<void> | void;
};

export default function AskAiPanel(props: Props) {
  return <WorkspaceConversation {...props} compact />;
}
