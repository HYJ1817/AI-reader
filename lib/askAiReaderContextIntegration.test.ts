import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);
const askPanelSource = readFileSync(
  new URL("../app/AskAiPanel.tsx", import.meta.url),
  "utf8"
);
const overlaysSource = readFileSync(
  new URL("../app/AppOverlays.tsx", import.meta.url),
  "utf8"
);
const epubSource = readFileSync(
  new URL("../app/EpubReader.tsx", import.meta.url),
  "utf8"
);
const routeSource = readFileSync(
  new URL("../app/api/chat/route.ts", import.meta.url),
  "utf8"
);
const askHookSource = readFileSync(
  new URL("../app/useAskAi.ts", import.meta.url),
  "utf8"
);

describe("Ask AI reader context integration", () => {
  it("keeps a visible conversation history instead of a single answer", () => {
    expect(askHookSource).toContain("const [messages, setMessages]");
    expect(pageSource).toContain("messages: askMessages");
    expect(overlaysSource).toContain("messages: AiConversationMessage[]");
    expect(overlaysSource).toContain("messages={reader.messages}");
    expect(askPanelSource).toContain("messages.map((message)");
    expect(askPanelSource).not.toContain("answer: string | null");
  });

  it("clears submitted input and sends prior messages plus current reader text", () => {
    expect(pageSource).toContain("useAskAi({");
    expect(askHookSource).toContain("setQuestion(\"\")");
    expect(askHookSource).toContain("messages: messages.map");
    expect(askHookSource).toContain("nearbyText: getCurrentReadingContextText()");
    expect(askHookSource).toContain("question: submittedQuestion");
  });

  it("collects visible TXT and EPUB text for AI context", () => {
    expect(askHookSource).toContain("function collectVisibleReaderText");
    expect(askHookSource).toContain("epubReaderRef.current?.getVisibleText()");
    expect(epubSource).toContain("getVisibleText: () => string");
    expect(epubSource).toContain("collectRenderedTextFromRendition");
    expect(epubSource).toContain("body?.innerText");
  });

  it("passes conversation messages from the API route into chat message building", () => {
    expect(routeSource).toContain("messages?: ChatConversationMessage[]");
    expect(routeSource).toContain("buildChatMessages(question, context ?? {}, messages ?? [])");
  });
});
