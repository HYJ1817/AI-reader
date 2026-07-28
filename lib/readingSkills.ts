import type { WorkspaceArtifactKind } from "./readingWorkspace";

export type ReadingSkillId =
  | "explain-selection"
  | "translate-selection"
  | "summarize-nearby"
  | "extract-key-points";

export type ReadingSkill = {
  id: ReadingSkillId;
  name: string;
  description: string;
  requiredContext: "selection" | "nearby";
  artifactKind: WorkspaceArtifactKind;
};

export const READING_SKILLS: readonly ReadingSkill[] = [
  {
    id: "explain-selection",
    name: "\u89e3\u91ca\u9009\u4e2d\u5185\u5bb9",
    description: "\u89e3\u91ca\u542b\u4e49\u3001\u8bed\u5883\u548c\u96be\u70b9",
    requiredContext: "selection",
    artifactKind: "explanation",
  },
  {
    id: "translate-selection",
    name: "\u7ffb\u8bd1\u9009\u4e2d\u5185\u5bb9",
    description: "\u5fe0\u5b9e\u7ffb\u8bd1\u5e76\u4fdd\u7559\u8bed\u6c14",
    requiredContext: "selection",
    artifactKind: "explanation",
  },
  {
    id: "summarize-nearby",
    name: "\u603b\u7ed3\u5f53\u524d\u5185\u5bb9",
    description: "\u6982\u62ec\u5f53\u524d\u53ef\u89c1\u5185\u5bb9",
    requiredContext: "nearby",
    artifactKind: "summary",
  },
  {
    id: "extract-key-points",
    name: "\u63d0\u70bc\u8981\u70b9",
    description: "\u63d0\u53d6\u7b80\u6d01\u3001\u6709\u5c42\u6b21\u7684\u8981\u70b9",
    requiredContext: "nearby",
    artifactKind: "outline",
  },
] as const;

export function listEligibleReadingSkills(context: {
  selectedText?: string;
  nearbyText?: string;
}): ReadingSkill[] {
  return READING_SKILLS.filter((skill) =>
    skill.requiredContext === "selection"
      ? Boolean(context.selectedText?.trim())
      : Boolean(context.nearbyText?.trim())
  );
}

export function buildReadingSkillQuestion(
  id: ReadingSkillId,
  context: { selectedText?: string; nearbyText?: string; locale: string }
): string {
  const skill = READING_SKILLS.find((item) => item.id === id);
  if (!skill) throw new Error("Unknown reading Skill.");
  const available =
    skill.requiredContext === "selection"
      ? context.selectedText?.trim()
      : context.nearbyText?.trim();
  if (!available) throw new Error("Required reading context is unavailable.");

  const language = context.locale.toLowerCase().startsWith("zh")
    ? "\u4f7f\u7528\u7b80\u4f53\u4e2d\u6587"
    : `Use ${context.locale}`;
  const prompts: Record<ReadingSkillId, string> = {
    "explain-selection": "\u89e3\u91ca\u9009\u4e2d\u5185\u5bb9\u7684\u542b\u4e49\u3001\u8bed\u5883\u548c\u9605\u8bfb\u96be\u70b9",
    "translate-selection": "\u7ffb\u8bd1\u9009\u4e2d\u5185\u5bb9\uff0c\u5fe0\u5b9e\u4fdd\u7559\u539f\u6587\u8bed\u6c14\u548c\u4e13\u6709\u540d\u8bcd",
    "summarize-nearby": "\u603b\u7ed3\u5f53\u524d\u9605\u8bfb\u5185\u5bb9\uff0c\u4fdd\u7559\u6838\u5fc3\u8bba\u70b9\u548c\u5173\u952e\u7ec6\u8282",
    "extract-key-points": "\u63d0\u70bc\u5f53\u524d\u9605\u8bfb\u5185\u5bb9\u7684\u8981\u70b9\uff0c\u6309\u5c42\u6b21\u8f93\u51fa Markdown \u5217\u8868",
  };
  return `${prompts[id]}\u3002${language}\uff1b\u53ea\u6839\u636e\u5df2\u63d0\u4f9b\u7684\u9605\u8bfb\u4e0a\u4e0b\u6587\u56de\u7b54\uff0c\u4e0d\u8981\u7f16\u9020\u3002`;
}

export function createArtifactTitle(content: string, bookTitle: string): string {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const heading = lines.find((line) => /^#{1,6}\s+/.test(line));
  const candidate = (heading ?? lines[0] ?? "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/[*_~`>[\]()!]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (candidate || `${bookTitle} \u8d44\u6599`).slice(0, 60);
}
