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
const viewportFollowHookSource = readFileSync(
  new URL("../app/useWorkspaceViewportFollow.ts", import.meta.url),
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
    const threadRuleStart = cssSource.indexOf(".workspaceConversationThread {");
    const threadRuleEnd = cssSource.indexOf("}", threadRuleStart);
    const threadRule = cssSource.slice(threadRuleStart, threadRuleEnd);
    expect(threadRuleStart).toBeGreaterThanOrEqual(0);
    expect(threadRule).toContain("overflow-y: auto");
    expect(threadRule).toContain("overflow-anchor: none");
    expect(cssSource).toContain(".workspaceComposer");
    expect(cssSource).toContain("flex-shrink: 0");
    expect(cssSource).toContain("--sheet-page-viewport-flex: 1");
    expect(cssSource).toContain("height: var(--sheet-page-viewport-height) !important");
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

  it("aborts stale requests and follows conversation content without stealing user scroll", () => {
    expect(askHookSource).toContain("new AbortController()");
    expect(askHookSource).toContain("requestControllerRef.current?.abort()");
    expect(askHookSource).toContain("signal: controller.signal");
    expect(workspaceConversationSource).toContain("useWorkspaceViewportFollow");
    expect(workspaceConversationSource).toContain("contentRevision");
    expect(workspaceConversationSource).toContain("onPointerDown={onUserInteractionStart}");
    expect(workspaceConversationSource).toContain("onPointerUp={onUserInteractionEnd}");
    expect(workspaceConversationSource).toContain("onPointerCancel={onUserInteractionCancel}");
    expect(workspaceConversationSource).toContain("onTouchStart={onUserInteractionStart}");
    expect(workspaceConversationSource).toContain("onTouchEnd={onUserInteractionEnd}");
    expect(workspaceConversationSource).toContain("onTouchCancel={onUserInteractionEnd}");
    expect(workspaceConversationSource).toContain("onWheel={onWheel}");
    expect(workspaceConversationSource).not.toContain(
      "thread.scrollTop = thread.scrollHeight"
    );
    expect(viewportFollowHookSource).toContain("activeAnimationRef.current?.stop()");
    expect(viewportFollowHookSource).toContain("MOTION_DURATION.pushExit");
    expect(viewportFollowHookSource).toContain("MOTION_EASE.enter");
    expect(viewportFollowHookSource).toContain("isThreadActuallyVisible");
    expect(viewportFollowHookSource).toContain("new MutationObserver");
    expect(viewportFollowHookSource).toContain("preservingPrependRef.current");
    expect(viewportFollowHookSource).toContain("findVisiblePrependAnchor");
    expect(viewportFollowHookSource).toContain("interactionGenerationRef");
    expect(viewportFollowHookSource).toContain("returnLayoutFrameRef");
  });

  it("publishes stream frames as transitions and serializes checkpoint persistence", () => {
    expect(askHookSource).toContain("startTransition(() =>");
    expect(askHookSource).toContain("WorkspacePersistenceCoordinator");
    expect(askHookSource).toContain("enqueueCheckpoint");
    expect(askHookSource).toContain("commitOwned");
    expect(askHookSource).toContain("cancel(async () =>");
    expect(askHookSource).toContain("await previousWorkspacePersistence");
  });

  it("keeps the return control in layout instead of overlaying workspace actions", () => {
    const start = cssSource.indexOf(".workspaceReturnToLatest {");
    const end = cssSource.indexOf("}", start);
    const rule = cssSource.slice(start, end);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(rule).toContain("align-self: center");
    expect(rule).toContain("flex-shrink: 0");
    expect(rule).not.toContain("position: absolute");
    expect(rule).not.toContain("bottom:");
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
