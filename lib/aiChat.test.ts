import { describe, it, expect } from "vitest";
import {
  normalizeOpenAiBaseUrl,
  limitContextText,
  buildChatMessages,
  extractChatAnswer,
} from "./aiChat";

describe("normalizeOpenAiBaseUrl", () => {
  it("trims whitespace and trailing slashes", () => {
    expect(normalizeOpenAiBaseUrl("  https://api.openai.com/v1/  ")).toBe(
      "https://api.openai.com/v1"
    );
  });

  it("removes multiple trailing slashes", () => {
    expect(normalizeOpenAiBaseUrl("https://api.openai.com/v1///")).toBe(
      "https://api.openai.com/v1"
    );
  });

  it("returns URL unchanged when already clean", () => {
    expect(normalizeOpenAiBaseUrl("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1"
    );
  });

  it("accepts http URLs", () => {
    expect(normalizeOpenAiBaseUrl("http://localhost:8080/v1")).toBe(
      "http://localhost:8080/v1"
    );
  });

  it("throws on non-http schemes", () => {
    expect(() => normalizeOpenAiBaseUrl("ftp://example.com")).toThrow(
      "URL must start with http:// or https://"
    );
  });

  it("throws on empty string", () => {
    expect(() => normalizeOpenAiBaseUrl("")).toThrow();
  });

  it("throws on malformed URL", () => {
    expect(() => normalizeOpenAiBaseUrl("not-a-url")).toThrow();
  });
});

describe("limitContextText", () => {
  it("returns empty string for undefined", () => {
    expect(limitContextText(undefined)).toBe("");
  });

  it("returns empty string for blank text", () => {
    expect(limitContextText("   ")).toBe("");
  });

  it("returns text unchanged when under limit", () => {
    expect(limitContextText("hello world")).toBe("hello world");
  });

  it("trims whitespace from input", () => {
    expect(limitContextText("  hello  ")).toBe("hello");
  });

  it("truncates text exceeding maxChars and appends marker", () => {
    const longText = "a".repeat(100);
    const result = limitContextText(longText, 50);
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result).toContain("a".repeat(50));
    expect(result).toContain("[truncated]");
  });

  it("preserves beginning of text when truncating", () => {
    const text = "start" + "x".repeat(6000);
    const result = limitContextText(text);
    expect(result.startsWith("start")).toBe(true);
    expect(result).toContain("[truncated]");
  });

  it("uses default max of 6000 chars", () => {
    const text = "b".repeat(7000);
    const result = limitContextText(text);
    expect(result).toContain("b".repeat(6000));
    expect(result).toContain("[truncated]");
  });
});

describe("buildChatMessages", () => {
  it("includes system message about reading context", () => {
    const messages = buildChatMessages("What is this about?", {});
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("reading context");
  });

  it("includes question in user message", () => {
    const messages = buildChatMessages("What is this about?", {});
    const userMsg = messages.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("What is this about?");
  });

  it("includes book title and format when present", () => {
    const messages = buildChatMessages("test", {
      bookTitle: "My Book",
      bookFormat: "epub",
    });
    const userMsg = messages.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("My Book");
    expect(userMsg?.content).toContain("epub");
  });

  it("includes selected text when present", () => {
    const messages = buildChatMessages("test", {
      selectedText: "important passage",
    });
    const userMsg = messages.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("important passage");
  });

  it("includes nearby text when present", () => {
    const messages = buildChatMessages("test", {
      nearbyText: "surrounding context",
    });
    const userMsg = messages.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("surrounding context");
  });

  it("passes selected/nearby text through limitContextText", () => {
    const longSelected = "s".repeat(7000);
    const messages = buildChatMessages("test", {
      selectedText: longSelected,
    });
    const userMsg = messages.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("[truncated]");
  });

  it("omits book info when not provided", () => {
    const messages = buildChatMessages("test", {});
    const userMsg = messages.find((m) => m.role === "user");
    expect(userMsg?.content).not.toContain("Book:");
    expect(userMsg?.content).not.toContain("Format:");
  });
});

describe("extractChatAnswer", () => {
  it("extracts content from valid response", () => {
    const response = {
      choices: [{ message: { content: "The answer is 42." } }],
    };
    expect(extractChatAnswer(response)).toBe("The answer is 42.");
  });

  it("throws on missing choices", () => {
    expect(() => extractChatAnswer({})).toThrow("choices");
  });

  it("throws on empty choices array", () => {
    expect(() => extractChatAnswer({ choices: [] })).toThrow("choices");
  });

  it("throws on missing message content", () => {
    expect(() =>
      extractChatAnswer({ choices: [{ message: {} }] })
    ).toThrow("content");
  });

  it("throws on non-object response", () => {
    expect(() => extractChatAnswer(null)).toThrow();
    expect(() => extractChatAnswer("string")).toThrow();
  });
});
