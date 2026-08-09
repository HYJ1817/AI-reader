import type { ChatMessage } from "./aiChat";
import { BOOK_METADATA_LIMITS } from "./bookMetadata";
import type { AiProviderProtocol } from "./aiProviders";

export type MetadataAiField = "description" | "subjects";
export type MetadataAiCompletion = {
  description?: string;
  subjects?: string[];
};

function sanitizeText(value: unknown, limit: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, limit).trim() : undefined;
}

function sanitizeSubjects(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const subject = sanitizeText(item, BOOK_METADATA_LIMITS.subject);
    if (!subject || seen.has(subject)) continue;
    seen.add(subject);
    result.push(subject);
    if (result.length >= BOOK_METADATA_LIMITS.subjectCount) break;
  }
  return result.length > 0 ? result : undefined;
}

function unwrapJsonFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export function parseMetadataCompletionText(
  responseText: string,
  requested: MetadataAiField[]
): MetadataAiCompletion {
  const parsed = JSON.parse(unwrapJsonFence(responseText)) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid AI metadata completion");
  }
  const value = parsed as Record<string, unknown>;
  const completion: MetadataAiCompletion = {};
  if (requested.includes("description")) {
    const description = sanitizeText(value.description, BOOK_METADATA_LIMITS.description);
    if (description) completion.description = description;
  }
  if (requested.includes("subjects")) {
    const subjects = sanitizeSubjects(value.subjects);
    if (subjects) completion.subjects = subjects;
  }
  return completion;
}

function responseTextForProtocol(
  protocol: AiProviderProtocol,
  payload: unknown
): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid AI response");
  }
  const value = payload as Record<string, unknown>;
  if (protocol === "openai-compatible") {
    const choice = Array.isArray(value.choices) ? value.choices[0] : undefined;
    const message = choice && typeof choice === "object"
      ? (choice as Record<string, unknown>).message
      : undefined;
    const content = message && typeof message === "object"
      ? (message as Record<string, unknown>).content
      : undefined;
    if (typeof content === "string") return content;
  } else if (protocol === "anthropic-compatible") {
    if (typeof value.content === "string") return value.content;
    if (Array.isArray(value.content)) {
      const content = value.content
        .map((block) =>
          block && typeof block === "object" &&
          typeof (block as Record<string, unknown>).text === "string"
            ? String((block as Record<string, unknown>).text)
            : ""
        )
        .join("")
        .trim();
      if (content) return content;
    }
  } else {
    const candidate = Array.isArray(value.candidates) ? value.candidates[0] : undefined;
    const content = candidate && typeof candidate === "object"
      ? (candidate as Record<string, unknown>).content
      : undefined;
    const parts = content && typeof content === "object"
      ? (content as Record<string, unknown>).parts
      : undefined;
    if (Array.isArray(parts)) {
      const result = parts
        .map((part) =>
          part && typeof part === "object" &&
          typeof (part as Record<string, unknown>).text === "string"
            ? String((part as Record<string, unknown>).text)
            : ""
        )
        .join("")
        .trim();
      if (result) return result;
    }
  }
  throw new Error("Invalid AI response");
}

export function parseMetadataAiResponse(
  protocol: AiProviderProtocol,
  payload: unknown,
  requested: MetadataAiField[]
): MetadataAiCompletion {
  return parseMetadataCompletionText(
    responseTextForProtocol(protocol, payload),
    requested
  );
}

function safeKnownMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const title = sanitizeText(input.title ?? input.bibliographicTitle, BOOK_METADATA_LIMITS.title);
  if (title) result.title = title;
  if (Array.isArray(input.authors)) {
    const authors = input.authors
      .map((author) => sanitizeText(author, BOOK_METADATA_LIMITS.author))
      .filter((author): author is string => Boolean(author))
      .slice(0, BOOK_METADATA_LIMITS.authorCount);
    if (authors.length > 0) result.authors = authors;
  }
  const publisher = sanitizeText(input.publisher, BOOK_METADATA_LIMITS.publisher);
  if (publisher) result.publisher = publisher;
  const publishedDate = sanitizeText(input.publishedDate, BOOK_METADATA_LIMITS.publishedDate);
  if (publishedDate) result.publishedDate = publishedDate;
  const language = sanitizeText(input.language, BOOK_METADATA_LIMITS.language);
  if (language) result.language = language;
  return result;
}

export function buildMetadataAiMessages(
  knownMetadata: unknown,
  missing: MetadataAiField[],
  excerpt: string
): ChatMessage[] {
  const system = [
    "你只负责补全缺失的图书简介和标签。不得编造未知事实；无法确认的字段必须省略。",
    "只输出一个 JSON 对象，允许的结构仅为：{\"description\":\"纯文本简介\",\"subjects\":[\"标签\"]}。",
    "不得输出 HTML、Markdown、代码围栏、作者、出版社或任何未被请求的字段。",
  ].join("\n");
  const boundedExcerpt = excerpt.replace(/\s+/g, " ").trim().slice(0, BOOK_METADATA_LIMITS.excerpt);
  return [
    { role: "system", content: system },
    {
      role: "user",
      content: JSON.stringify({
        requestedFields: [...new Set(missing)],
        knownMetadata: safeKnownMetadata(knownMetadata),
        excerpt: boundedExcerpt,
      }),
    },
  ];
}
