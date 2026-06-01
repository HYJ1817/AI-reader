export interface AiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AiContext {
  bookTitle?: string;
  bookFormat?: "epub" | "txt";
  selectedText?: string;
  nearbyText?: string;
}

export function normalizeOpenAiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    throw new Error("Base URL must not be empty");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Invalid base URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("URL must start with http:// or https://");
  }
  return trimmed.replace(/\/+$/, "");
}

export function limitContextText(
  text: string | undefined,
  maxChars: number = 6000
): string {
  if (text === undefined) return "";
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars) + "\n\n[truncated]";
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function buildChatMessages(
  question: string,
  context: AiContext
): ChatMessage[] {
  const systemMessage: ChatMessage = {
    role: "system",
    content:
      "You are a helpful reading assistant. Answer questions about the user's reading context. If the provided context is insufficient to answer confidently, say so clearly rather than guessing.",
  };

  const parts: string[] = [];

  if (context.bookTitle) {
    parts.push(`Book: ${context.bookTitle}`);
  }
  if (context.bookFormat) {
    parts.push(`Format: ${context.bookFormat}`);
  }
  if (context.selectedText) {
    parts.push(
      `Selected text:\n${limitContextText(context.selectedText)}`
    );
  }
  if (context.nearbyText) {
    parts.push(
      `Nearby text:\n${limitContextText(context.nearbyText)}`
    );
  }

  parts.push(`Question: ${question}`);

  return [
    systemMessage,
    { role: "user", content: parts.join("\n\n") },
  ];
}

export function extractChatAnswer(responseJson: unknown): string {
  if (typeof responseJson !== "object" || responseJson === null) {
    throw new Error("Invalid AI response: not an object");
  }
  const obj = responseJson as Record<string, unknown>;
  if (!Array.isArray(obj.choices) || obj.choices.length === 0) {
    throw new Error("Invalid AI response: missing choices");
  }
  const first = obj.choices[0] as Record<string, unknown>;
  const msg = first.message as Record<string, unknown> | undefined;
  if (typeof msg?.content !== "string") {
    throw new Error("Invalid AI response: missing message content");
  }
  return msg.content;
}
