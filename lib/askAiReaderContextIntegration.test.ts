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
const workspaceConversationSource = readFileSync(
  new URL("../app/WorkspaceConversation.tsx", import.meta.url),
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
  new URL("../app/useWorkspaceChat.ts", import.meta.url),
  "utf8"
);
const cssSource = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);
const readmeSource = readFileSync(
  new URL("../README.md", import.meta.url),
  "utf8"
);
const aiSettingsSource = readFileSync(
  new URL("../app/AiSettingsSurface.tsx", import.meta.url),
  "utf8"
);

describe("Ask AI reader context integration", () => {
  it("keeps a visible conversation history instead of a single answer", () => {
    expect(askHookSource).toContain("const [messages, setMessages]");
    expect(pageSource).toContain("messages: askMessages");
    expect(overlaysSource).toContain("messages: AiConversationMessage[]");
    expect(overlaysSource).toContain("messages={reader.messages}");
    expect(workspaceConversationSource).toContain("messages.map((message)");
    expect(askPanelSource).not.toContain("answer: string | null");
  });

  it("mounts each persistent message once by stable ID", () => {
    expect(askPanelSource).toContain("WorkspaceConversation");
    expect(workspaceConversationSource).toContain("key={message.id}");
    expect(workspaceConversationSource).not.toContain("key={message.content}");
    expect(askHookSource).not.toContain("crypto.randomUUID");
  });

  it("keeps the Ask AI composer fixed below the scrollable conversation", () => {
    const messagesIndex = workspaceConversationSource.indexOf(
      "styles.workspaceMessages"
    );
    const inputIndex = workspaceConversationSource.indexOf(
      "styles.workspaceComposer"
    );

    expect(workspaceConversationSource).not.toContain("UI_TEXT.ASKING_ABOUT");
    expect(workspaceConversationSource).not.toContain("bookTitle");
    expect(messagesIndex).toBeGreaterThanOrEqual(0);
    expect(inputIndex).toBeGreaterThan(messagesIndex);
    expect(overlaysSource).toContain(
      '"ask-ai": {'
    );
    expect(overlaysSource).toContain("className: styles.askBottomSheet");
    expect(cssSource).toContain(".askBottomSheet .sheetBody");
    expect(cssSource).toContain(".workspaceConversationThread");
    expect(cssSource).toContain("overflow-y: auto");
    expect(cssSource).toContain(".workspaceComposer");
    expect(cssSource).toContain("flex-shrink: 0");
  });

  it("opens Ask AI through the navigation sheet route", () => {
    expect(pageSource).toContain('navigation.presentSheet("ask-ai")');
    expect(overlaysSource).toContain('case "ask-ai"');
    expect(overlaysSource).toContain("close={closePage}");
    expect(pageSource).not.toContain("setAskSheetOpen");
  });

  it("expands compact Ask AI into the active book workspace", () => {
    expect(overlaysSource).toContain("reader.bookId");
    expect(overlaysSource).toContain("UI_TEXT.READING_WORKSPACE");
    expect(overlaysSource).toContain("openReadingWorkspace(bookId)");
    expect(pageSource).toContain(
      'navigation.replaceSheet("reading-workspace", { entityId: bookId })'
    );
  });

  it("clears submitted input and sends prior messages plus current reader text", () => {
    expect(pageSource).toContain("useWorkspaceChat({");
    expect(askHookSource).toContain("setQuestion(\"\")");
    expect(askHookSource).toContain("selectInferenceHistory(compactedHistory.messages)");
    expect(askHookSource).toContain("collectVisibleReaderText");
    expect(askHookSource).toContain("question: trimmedQuestion");
  });

  it("aborts stale requests and scrolls new conversation content into view", () => {
    expect(askHookSource).toContain("new AbortController()");
    expect(askHookSource).toContain("requestControllerRef.current?.abort()");
    expect(askHookSource).toContain("signal: controller.signal");
    expect(workspaceConversationSource).toContain(
      "thread.scrollTop = thread.scrollHeight"
    );
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
    expect(routeSource).toContain("buildChatMessages(question, context ?? {}, messages ?? [], { memory, summary })");
  });

  it("loads and writes persistent workspace records with stale-event guards", () => {
    expect(askHookSource).toContain("ensureDefaultBookWorkspace");
    expect(askHookSource).toContain("putWorkspaceMessagePair");
    expect(askHookSource).toContain("shouldAcceptWorkspaceEvent");
    expect(askHookSource).toContain("listWorkspaceMessages");
  });

  it("discloses the actual nearby text and recent conversation sent to AI", () => {
    for (const source of [readmeSource, aiSettingsSource]) {
      expect(source).toContain("\u9644\u8fd1\u6b63\u6587");
      expect(source).toContain("\u6700\u8fd1\u5bf9\u8bdd");
      expect(source).toContain("\u4e0d\u4f1a\u53d1\u9001\u6574\u672c\u4e66");
    }
  });
});
