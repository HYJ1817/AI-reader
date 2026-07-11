import type { AiProviderConfig } from "./aiProviders";
import { resolveAiProviderBaseUrl } from "./aiProviders";

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

export type ChatConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

function sanitizeConversationMessages(
  messages: ChatConversationMessage[]
): ChatConversationMessage[] {
  return messages
    .filter(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
    )
    .map((message) => ({
      role: message.role,
      content: limitContextText(message.content, 3000),
    }))
    .slice(-20);
}

export function buildChatMessages(
  question: string,
  context: AiContext,
  history: ChatConversationMessage[] = []
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
    ...sanitizeConversationMessages(history),
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

export interface AiProviderRequest {
  url: string;
  init: RequestInit;
}

function headersOf(value: Record<string, string>): HeadersInit {
  return value;
}

function bodyOf(value: unknown): string {
  return JSON.stringify(value);
}

function splitSystemAndMessages(messages: ChatMessage[]): {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const nonSystem = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content,
    }));
  return { system, messages: nonSystem };
}

export function buildAiProviderRequest(
  provider: AiProviderConfig,
  messages: ChatMessage[]
): AiProviderRequest {
  const baseUrl = resolveAiProviderBaseUrl(provider);
  if (provider.protocol === "anthropic-compatible") {
    const split = splitSystemAndMessages(messages);
    return {
      url: `${baseUrl}/messages`,
      init: {
        method: "POST",
        headers: headersOf({
          "Content-Type": "application/json",
          "x-api-key": provider.apiKey,
          "anthropic-version": "2023-06-01",
        }),
        body: bodyOf({
          model: provider.model,
          system: split.system,
          messages: split.messages,
          max_tokens: 1024,
          temperature: 0.2,
        }),
      },
    };
  }

  if (provider.protocol === "gemini") {
    const split = splitSystemAndMessages(messages);
    const model = provider.model.replace(/^models\//, "");
    return {
      url: `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(provider.apiKey)}`,
      init: {
        method: "POST",
        headers: headersOf({ "Content-Type": "application/json" }),
        body: bodyOf({
          systemInstruction: {
            parts: [{ text: split.system }],
          },
          contents: split.messages.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
          generationConfig: {
            temperature: 0.2,
          },
        }),
      },
    };
  }

  return {
    url: `${baseUrl}/chat/completions`,
    init: {
      method: "POST",
      headers: headersOf({
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      }),
      body: bodyOf({ model: provider.model, messages, temperature: 0.2 }),
    },
  };
}

function extractAnthropicAnswer(responseJson: unknown): string {
  if (typeof responseJson !== "object" || responseJson === null) {
    throw new Error("Invalid AI response: not an object");
  }
  const obj = responseJson as Record<string, unknown>;
  if (typeof obj.content === "string") return obj.content;
  if (!Array.isArray(obj.content)) {
    throw new Error("Invalid AI response: missing content");
  }
  const text = obj.content
    .map((block) =>
      typeof block === "object" &&
      block !== null &&
      typeof (block as Record<string, unknown>).text === "string"
        ? String((block as Record<string, unknown>).text)
        : ""
    )
    .join("")
    .trim();
  if (!text) throw new Error("Invalid AI response: missing text content");
  return text;
}

function extractGeminiAnswer(responseJson: unknown): string {
  if (typeof responseJson !== "object" || responseJson === null) {
    throw new Error("Invalid AI response: not an object");
  }
  const obj = responseJson as Record<string, unknown>;
  const candidates = obj.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error("Invalid AI response: missing candidates");
  }
  const first = candidates[0] as Record<string, unknown>;
  const content = first.content as Record<string, unknown> | undefined;
  const parts = content?.parts;
  if (!Array.isArray(parts)) {
    throw new Error("Invalid AI response: missing parts");
  }
  const text = parts
    .map((part) =>
      typeof part === "object" &&
      part !== null &&
      typeof (part as Record<string, unknown>).text === "string"
        ? String((part as Record<string, unknown>).text)
        : ""
    )
    .join("")
    .trim();
  if (!text) throw new Error("Invalid AI response: missing text content");
  return text;
}

export function extractAiProviderAnswer(
  provider: AiProviderConfig,
  responseJson: unknown
): string {
  if (provider.protocol === "anthropic-compatible") {
    return extractAnthropicAnswer(responseJson);
  }
  if (provider.protocol === "gemini") {
    return extractGeminiAnswer(responseJson);
  }
  return extractChatAnswer(responseJson);
}
