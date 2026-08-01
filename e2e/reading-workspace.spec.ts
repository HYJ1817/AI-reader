import { expect, test, type Page } from "@playwright/test";

const libraryRoot = '[data-navigation-root="library"][aria-hidden="false"]';

async function installLocalAiFixture(page: Page) {
  await page.addInitScript(() => {
    const timestamp = "2026-07-28T00:00:00.000Z";
    localStorage.setItem(
      "ai-reader-ai-provider-settings",
      JSON.stringify({
        activeProviderId: "workspace-fixture",
        providers: [{
          id: "workspace-fixture",
          kind: "custom",
          protocol: "openai-compatible",
          label: "Local fixture",
          baseUrl: "https://fixture.invalid",
          apiKey: "fixture-only-not-transmitted",
          model: "fixture-model",
          models: [{ id: "fixture-model", label: "Fixture", source: "manual" }],
          appendDefaultPath: false,
          defaultPath: "/v1",
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
      })
    );
  });
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
      if (!url.endsWith("/api/chat")) return originalFetch(input, init);
      const encoder = new TextEncoder();
      const signal = init?.signal;
      const mode = (window as typeof window & { __workspaceStreamMode?: string })
        .__workspaceStreamMode;
      const events = mode === "long" || mode === "prepend"
        ? [
            ...Array.from({ length: mode === "prepend" ? 120 : 24 }, (_, index) => ({
              type: "delta",
              text: mode === "long"
                ? "x".repeat(1_200)
                : `chunk-${index}${"\n".repeat(index < 14 ? 4 : index - 9)}${String(index % 10).repeat(1_200)}\n`,
            })),
            { type: "done" },
          ]
        : [
            { type: "delta", text: "\u7b2c\u4e00\u6bb5" },
            { type: "delta", text: "\u7b2c\u4e8c\u6bb5" },
            { type: "delta", text: "\u7b2c\u4e09\u6bb5" },
            { type: "done" },
          ];
      return new Response(new ReadableStream({
        start(controller) {
          let index = 0;
          let timer = 0;
          let closed = false;
          signal?.addEventListener("abort", () => {
            window.clearTimeout(timer);
            if (!closed) controller.error(new DOMException("Aborted", "AbortError"));
          }, { once: true });
          const publish = () => {
            if (signal?.aborted) return;
            if ((mode === "long" || mode === "prepend") && events[index].type === "delta") {
              const fixtureWindow = window as typeof window & {
                __workspacePublishedChunks?: number;
              };
              fixtureWindow.__workspacePublishedChunks =
                (fixtureWindow.__workspacePublishedChunks ?? 0) + 1;
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(events[index])}\n\n`));
            index += 1;
            if (index === events.length) {
              closed = true;
              controller.close();
            } else timer = window.setTimeout(
              publish,
              mode === "prepend" ? 16 : mode === "long" ? 300 : 30
            );
          };
          publish();
        },
      }), { headers: { "Content-Type": "text/event-stream" } });
    };
  });
}

async function waitForLibrary(page: Page) {
  await page.goto("/");
  await expect(page.locator(libraryRoot)).toBeVisible();
  await expect(page.locator(`${libraryRoot} [data-library-loading="false"]`)).toHaveCount(1);
}

async function importBook(page: Page, name = "workspace-sample.txt") {
  const covers = page.locator(`${libraryRoot} [data-book-cover-origin]`);
  const count = await covers.count();
  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({
    name,
    mimeType: "text/plain",
    buffer: Buffer.from("Reading workspace context. ".repeat(240)),
  });
  await expect(covers).toHaveCount(count + 1);
}

async function setListMode(page: Page) {
  await page.getByRole("button", { name: "\u5217\u8868" }).click();
}

async function openWorkspaceFromLibrary(page: Page) {
  await setListMode(page);
  await page.locator(`${libraryRoot} [data-library-book-more="true"]`).first().click();
  await expect(page.locator('[data-sheet-route="book-actions"]')).toBeVisible();
  await page.locator('[data-sheet-route="book-actions"]').getByRole("button", { name: "\u9605\u8bfb\u7a7a\u95f4" }).click();
  await expect(page.locator('[data-sheet-route="reading-workspace"]')).toBeVisible();
}

async function openAskFromReader(page: Page) {
  await page.locator(`${libraryRoot} [data-library-book-open="true"]`).first().click();
  await expect(page.locator('[data-reader-presented="true"]')).toBeVisible();
  const toggle = page.locator('[data-reader-menu-toggle="true"]');
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await page.locator('[data-reader-presented="true"]').getByRole("button", { name: "\u95ee AI", exact: true }).click();
  await expect(page.locator('[data-sheet-route="ask-ai"]')).toBeVisible();
}

async function saveFixtureMaterial(page: Page) {
  const workspace = page.locator('[data-sheet-route="reading-workspace"]');
  const composer = workspace.getByRole("textbox", { name: "问 AI" });
  await composer.fill("Create a material");
  await workspace.getByRole("button", { name: "发送" }).click();
  await expect(
    workspace.locator('[data-workspace-message-state="complete"]')
  ).toHaveCount(2);
  await workspace.getByRole("button", { name: "保存到资料" }).click();
  await expect(workspace.getByRole("tab", { name: "资料" })).toBeEnabled();
}

test.beforeEach(async ({ page }) => {
  await installLocalAiFixture(page);
  await waitForLibrary(page);
  await importBook(page);
});

test("reader question streams locally, persists, and opens the same workspace", async ({ page }) => {
  await setListMode(page);
  await openAskFromReader(page);
  const askSheet = page.locator('[data-sheet-route="ask-ai"]');
  await askSheet.getByRole("textbox", { name: "\u95ee AI" }).fill("What happens here?");
  await askSheet.getByRole("button", { name: "\u53d1\u9001" }).click();
  await expect(askSheet).toContainText("\u7b2c\u4e00\u6bb5\u7b2c\u4e8c\u6bb5\u7b2c\u4e09\u6bb5");
  await expect(askSheet.locator('[data-workspace-message-state="complete"]')).toHaveCount(2);
  await askSheet.getByRole("button", { name: "\u9605\u8bfb\u7a7a\u95f4" }).click();
  const workspace = page.locator('[data-sheet-route="reading-workspace"]');
  await expect(workspace).toContainText("\u7b2c\u4e00\u6bb5\u7b2c\u4e8c\u6bb5\u7b2c\u4e09\u6bb5");
  expect(await workspace.locator('[data-workspace-message-id]').evaluateAll(
    (items) => new Set(items.map((item) => item.getAttribute("data-workspace-message-id"))).size
  )).toBe(2);
});

test("offline workspace stays readable and preserves a disabled draft", async ({ page, context }) => {
  await openWorkspaceFromLibrary(page);
  const workspace = page.locator('[data-sheet-route="reading-workspace"]');
  await context.setOffline(true);
  await expect(workspace).toContainText("\u5f53\u524d\u5df2\u79bb\u7ebf");
  const composer = workspace.getByRole("textbox", { name: "\u95ee AI" });
  await composer.fill("Keep this draft");
  await expect(composer).toHaveValue("Keep this draft");
  await expect(workspace.getByRole("button", { name: "\u53d1\u9001" })).toBeDisabled();
  await expect(workspace.getByText("\u8fd8\u6ca1\u6709\u5bf9\u8bdd")).toBeVisible();
});

test("long history pages without scroll jumps and long content is explicit", async ({ page }) => {
  await openWorkspaceFromLibrary(page);
  const workspace = page.locator('[data-sheet-route="reading-workspace"]');
  const workspaceId = await workspace.locator('[data-workspace-id]').getAttribute("data-workspace-id");
  expect(workspaceId).toBeTruthy();
  await page.evaluate(async ({ workspaceId }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("AiReader");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const session = await new Promise<Record<string, string>>((resolve, reject) => {
      const transaction = db.transaction("workspaceSessions", "readonly");
      const request = transaction.objectStore("workspaceSessions").getAll();
      request.onsuccess = () => resolve(request.result.find((item) => item.workspaceId === workspaceId));
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("workspaceMessages", "readwrite");
      const store = transaction.objectStore("workspaceMessages");
      for (let index = 0; index < 330; index += 1) {
        const timestamp = new Date(Date.UTC(2026, 6, 28, 0, 0, index)).toISOString();
        store.put({
          id: `seed-${String(index).padStart(3, "0")}`,
          workspaceId,
          sessionId: session.id,
          role: index % 2 === 0 ? "user" : "assistant",
          content: index === 329 ? "L".repeat(33_000) : `seed message ${index}`,
          state: "complete",
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    db.close();
  }, { workspaceId });
  await workspace.getByRole("button", { name: "\u5173\u95ed" }).click();
  await expect(page.locator('[data-sheet-route="reading-workspace"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator(libraryRoot)).toBeVisible();
  await openWorkspaceFromLibrary(page);
  const reopened = page.locator('[data-sheet-route="reading-workspace"]');
  await expect(reopened.locator('[data-workspace-message-id]')).toHaveCount(100);
  await page.evaluate(() => {
    const fixtureWindow = window as typeof window & {
      __workspaceStreamMode?: string;
      __workspacePublishedChunks?: number;
    };
    fixtureWindow.__workspaceStreamMode = "prepend";
    fixtureWindow.__workspacePublishedChunks = 0;
  });
  const composer = reopened.getByRole("textbox", { name: "\u95ee AI" });
  await composer.fill("Keep streaming while older messages load");
  await reopened.getByRole("button", { name: "\u53d1\u9001" }).click();
  await expect(reopened.locator('[data-workspace-message-state="streaming"]')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __workspacePublishedChunks?: number }
  ).__workspacePublishedChunks ?? 0)).toBeGreaterThanOrEqual(3);
  const loadOlder = reopened.getByRole("button", { name: "\u52a0\u8f7d\u66f4\u65e9\u6d88\u606f" });
  await loadOlder.scrollIntoViewIfNeeded();
  const thread = reopened.locator('[data-workspace-thread="true"]');
  await thread.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
  });
  await thread.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await thread.dispatchEvent("pointerup", {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
  });
  await expect(
    reopened.getByRole("button", { name: "\u56de\u5230\u6700\u65b0\u6d88\u606f" })
  ).toBeVisible();
  const oldFirst = reopened.locator('[data-workspace-message-id]').first();
  const firstId = await oldFirst.getAttribute("data-workspace-message-id");
  const before = await oldFirst.boundingBox();
  const chunksBeforePrepend = await page.evaluate(() => (
    window as typeof window & { __workspacePublishedChunks?: number }
  ).__workspacePublishedChunks ?? 0);
  await loadOlder.click();
  await expect(reopened.locator('[data-workspace-message-id]')).toHaveCount(152);
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __workspacePublishedChunks?: number }
  ).__workspacePublishedChunks ?? 0)).toBeGreaterThanOrEqual(
    chunksBeforePrepend + 2
  );
  await expect.poll(async () => {
    const after = await reopened
      .locator(`[data-workspace-message-id="${firstId}"]`)
      .boundingBox();
    return Math.abs((after?.y ?? 0) - (before?.y ?? 0));
  }).toBeLessThanOrEqual(1);
  await expect(loadOlder).toHaveCount(1);
  const pendingUserScrollTop = await page.evaluate(() => {
    const workspace = document.querySelector<HTMLElement>(
      '[data-sheet-route="reading-workspace"]'
    );
    const thread = workspace?.querySelector<HTMLElement>(
      '[data-workspace-thread="true"]'
    );
    const button = workspace?.querySelector<HTMLButtonElement>(
      '[data-workspace-prepend-anchor="true"]'
    );
    if (!thread || !button) throw new Error("Workspace pagination controls missing");
    button.click();
    thread.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 2,
      pointerType: "touch",
      isPrimary: true,
    }));
    const target = Math.min(
      thread.scrollHeight - thread.clientHeight,
      thread.scrollTop + 137
    );
    thread.scrollTop = target;
    thread.dispatchEvent(new Event("scroll", { bubbles: true }));
    thread.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      pointerId: 2,
      pointerType: "touch",
      isPrimary: true,
    }));
    return thread.scrollTop;
  });
  await expect(reopened.locator('[data-workspace-message-id]')).toHaveCount(202);
  expect(Math.abs(
    (await thread.evaluate((element) => element.scrollTop)) - pendingUserScrollTop
  )).toBeLessThanOrEqual(1);
  await reopened.getByRole("button", { name: "\u505c\u6b62" }).click();
  await expect(reopened.getByText("\u5185\u5bb9\u8f83\u957f\uff0c\u5df2\u6298\u53e0\u9884\u89c8\u3002").first()).toBeVisible();
  await reopened.getByRole("button", { name: "\u5c55\u5f00\u5168\u6587" }).first().click();
  await expect(reopened.getByRole("button", { name: "\u5bfc\u51fa" }).last()).toBeVisible();
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("workspace inline state and popover settle on the last rapid intent", async ({ page }) => {
  await openWorkspaceFromLibrary(page);
  const workspace = page.locator('[data-sheet-route="reading-workspace"]');
  const conversationTab = workspace.getByRole("tab", { name: "对话" });
  const materialsTab = workspace.getByRole("tab", { name: "资料" });
  const sessionTrigger = workspace.getByRole("button", { name: "对话会话" });

  for (let index = 0; index < 6; index += 1) {
    await sessionTrigger.click();
    await sessionTrigger.click();
  }
  await expect(workspace.getByRole("menu")).toHaveCount(0);
  await materialsTab.click();

  for (let index = 0; index < 10; index += 1) {
    await (index % 2 === 0 ? conversationTab : materialsTab).click();
  }

  await expect(materialsTab).toHaveAttribute("aria-selected", "true");
  await expect(
    workspace.locator('[role="tabpanel"][data-motion-role="inline-state"]')
  ).toHaveCount(1);
  await expect(workspace.getByText("还没有资料")).toBeVisible();
});

test("workspace materials rename failure retains the title and focus", async ({ page }) => {
  await openWorkspaceFromLibrary(page);
  await saveFixtureMaterial(page);
  const workspace = page.locator('[data-sheet-route="reading-workspace"]');
  await workspace.getByRole("tab", { name: "资料" }).click();
  const material = workspace.locator("[data-workspace-material-id]").first();
  await expect(material).toBeVisible();
  await material.getByRole("button", { name: /打开/ }).click();

  const title = workspace.getByRole("textbox", { name: "资料标题" });
  await title.fill("保留这个标题");
  await page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function failArtifactPut(...args) {
      if (this.name === "workspaceArtifacts") {
        throw new DOMException("fixture rename failed", "AbortError");
      }
      return originalPut.apply(this, args as Parameters<IDBObjectStore["put"]>);
    };
  });
  await workspace.getByRole("button", { name: "重命名" }).click();

  await expect(workspace.getByRole("alert")).toContainText("fixture rename failed");
  await expect(title).toHaveValue("保留这个标题");
  await expect(title).toBeFocused();
});

test("workspace materials keep header and composer geometry stable", async ({ page }) => {
  await openWorkspaceFromLibrary(page);
  const workspace = page.locator('[data-sheet-route="reading-workspace"]');
  const header = workspace.locator("header").first();
  const composer = workspace.getByRole("textbox", { name: "问 AI" });
  const beforeHeader = await header.boundingBox();
  const beforeComposer = await composer.boundingBox();

  await saveFixtureMaterial(page);
  await workspace.getByRole("tab", { name: "资料" }).click();
  await expect(workspace.locator("[data-workspace-material-id]")).toHaveCount(1);
  await workspace.getByRole("tab", { name: "对话" }).click();

  const afterHeader = await header.boundingBox();
  const afterComposer = await composer.boundingBox();
  expect(Math.abs((afterHeader?.y ?? 0) - (beforeHeader?.y ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs((afterComposer?.y ?? 0) - (beforeComposer?.y ?? 0))).toBeLessThanOrEqual(1);
});

test("workspace streaming preserves user scroll and keeps the composer responsive", async ({ page }) => {
  await page.evaluate(() => {
    const fixtureWindow = window as typeof window & {
      __workspaceStreamMode?: string;
      __workspacePublishedChunks?: number;
    };
    fixtureWindow.__workspaceStreamMode = "long";
    fixtureWindow.__workspacePublishedChunks = 0;
  });
  await openWorkspaceFromLibrary(page);
  const workspace = page.locator('[data-sheet-route="reading-workspace"]');
  const composer = workspace.getByRole("textbox", { name: "\u95ee AI" });
  const thread = workspace.locator('[data-workspace-thread="true"]');
  await expect.poll(() => thread.evaluate((element) =>
    getComputedStyle(element).overflowAnchor
  )).toBe("none");

  await composer.fill("Stream a long answer");
  await workspace.getByRole("button", { name: "\u53d1\u9001" }).click();
  await expect(workspace.locator('[data-workspace-message-state="streaming"]')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __workspacePublishedChunks?: number }
  ).__workspacePublishedChunks ?? 0)).toBeGreaterThanOrEqual(9);
  await expect.poll(() => thread.evaluate((element) =>
    element.scrollHeight - element.clientHeight
  )).toBeGreaterThan(500);
  await expect.poll(() => thread.evaluate((element) =>
    element.scrollHeight - element.clientHeight - element.scrollTop
  )).toBeLessThanOrEqual(48);

  const chunksBeforeLongPress = await page.evaluate(() => (
    window as typeof window & { __workspacePublishedChunks?: number }
  ).__workspacePublishedChunks ?? 0);
  await thread.dispatchEvent("pointerdown", {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
  });
  await page.waitForTimeout(180);
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __workspacePublishedChunks?: number }
  ).__workspacePublishedChunks ?? 0)).toBeGreaterThanOrEqual(
    chunksBeforeLongPress + 1
  );
  const scrollTop = await thread.evaluate((element) => {
    element.scrollTop = Math.max(
      0,
      element.scrollHeight - element.clientHeight - 300
    );
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
    return element.scrollTop;
  });
  await thread.dispatchEvent("pointerup", {
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
  });
  await expect(
    workspace.getByRole("button", { name: "\u56de\u5230\u6700\u65b0\u6d88\u606f" })
  ).toBeVisible();

  const momentumTarget = Math.max(0, scrollTop - 128);
  await thread.evaluate((element, target) => {
    const firstStep = Math.max(target, element.scrollTop - 64);
    element.scrollTop = firstStep;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
    element.scrollTop = target;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  }, momentumTarget);
  await expect.poll(() => thread.evaluate((element) => element.scrollTop))
    .toBe(momentumTarget);

  await thread.dispatchEvent("pointerdown", {
    pointerId: 2,
    pointerType: "touch",
    isPrimary: true,
  });
  await thread.dispatchEvent("pointercancel", {
    pointerId: 2,
    pointerType: "touch",
    isPrimary: true,
  });
  const cancelledMomentumTarget = Math.max(0, momentumTarget - 64);
  await thread.evaluate((element, target) => {
    element.scrollTop = target;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  }, cancelledMomentumTarget);
  await expect.poll(() => thread.evaluate((element) => element.scrollTop))
    .toBe(cancelledMomentumTarget);

  const chunksBeforeTyping = await page.evaluate(() => (
    window as typeof window & { __workspacePublishedChunks?: number }
  ).__workspacePublishedChunks ?? 0);
  await composer.pressSequentially("draft stays responsive", { delay: 12 });
  await expect(composer).toHaveValue("draft stays responsive");
  await expect(workspace.locator('[data-workspace-message-state="streaming"]')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __workspacePublishedChunks?: number }
  ).__workspacePublishedChunks ?? 0)).toBeGreaterThanOrEqual(chunksBeforeTyping + 3);
  expect(Math.abs(
    (await thread.evaluate((element) => element.scrollTop)) - cancelledMomentumTarget
  ))
    .toBeLessThanOrEqual(1);

  const clientHeightBeforeReturn = await thread.evaluate(
    (element) => element.clientHeight
  );
  await workspace.getByRole("button", {
    name: "\u56de\u5230\u6700\u65b0\u6d88\u606f",
  }).click();
  await expect(workspace.getByRole("button", {
    name: "\u56de\u5230\u6700\u65b0\u6d88\u606f",
  })).toHaveCount(0);
  await expect.poll(() => thread.evaluate((element) => element.clientHeight))
    .toBeGreaterThan(clientHeightBeforeReturn);
  await expect.poll(() => thread.evaluate((element) =>
    element.scrollHeight - element.clientHeight - element.scrollTop
  )).toBeLessThanOrEqual(1);
  const chunksAfterReturn = await page.evaluate(() => (
    window as typeof window & { __workspacePublishedChunks?: number }
  ).__workspacePublishedChunks ?? 0);
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __workspacePublishedChunks?: number }
  ).__workspacePublishedChunks ?? 0)).toBeGreaterThanOrEqual(chunksAfterReturn + 2);
  await expect.poll(() => thread.evaluate((element) =>
    element.scrollHeight - element.clientHeight - element.scrollTop
  )).toBeLessThanOrEqual(48);

  await thread.dispatchEvent("pointerdown", {
    pointerId: 3,
    pointerType: "touch",
    isPrimary: true,
  });
  await thread.dispatchEvent("pointercancel", {
    pointerId: 3,
    pointerType: "touch",
    isPrimary: true,
  });
  const cancelledFromBottomTarget = await thread.evaluate((element) => {
    const target = Math.max(
      0,
      element.scrollHeight - element.clientHeight - 180
    );
    element.scrollTop = target;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
    return target;
  });
  await expect.poll(() => thread.evaluate((element) => element.scrollTop))
    .toBe(cancelledFromBottomTarget);
  await expect(workspace.getByRole("button", {
    name: "\u56de\u5230\u6700\u65b0\u6d88\u606f",
  })).toBeVisible();
  const chunksAfterCancel = await page.evaluate(() => (
    window as typeof window & { __workspacePublishedChunks?: number }
  ).__workspacePublishedChunks ?? 0);
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __workspacePublishedChunks?: number }
  ).__workspacePublishedChunks ?? 0)).toBeGreaterThanOrEqual(chunksAfterCancel + 1);
  expect(Math.abs(
    (await thread.evaluate((element) => element.scrollTop)) - cancelledFromBottomTarget
  )).toBeLessThanOrEqual(1);
});

test("workspace opens within the architecture budget", async ({ page }, testInfo) => {
  await setListMode(page);
  await page.locator(`${libraryRoot} [data-library-book-more="true"]`).first().click();
  const workspaceButton = page.locator('[data-sheet-route="book-actions"]').getByRole("button", { name: "\u9605\u8bfb\u7a7a\u95f4" });
  await workspaceButton.evaluate((button) => {
    const state = {
      clickAt: 0,
      longTasks: [] as number[],
      layoutShift: 0,
      observers: [] as PerformanceObserver[],
    };
    for (const type of ["longtask", "layout-shift"]) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.startTime < state.clickAt || state.clickAt === 0) continue;
            if (type === "longtask") state.longTasks.push(entry.duration);
            else if (!(entry as PerformanceEntry & { hadRecentInput?: boolean }).hadRecentInput) {
              state.layoutShift += (entry as PerformanceEntry & { value?: number }).value ?? 0;
            }
          }
        });
        observer.observe({ type, buffered: true });
        state.observers.push(observer);
      } catch {}
    }
    (window as typeof window & { __workspacePerf?: typeof state }).__workspacePerf = state;
    button.addEventListener("click", () => {
      state.clickAt = performance.now();
    }, { once: true });
  });
  await workspaceButton.click();
  await expect(page.locator('[data-sheet-route="reading-workspace"]')).toBeVisible();
  const metrics = await page.evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const state = (window as typeof window & {
      __workspacePerf: {
        clickAt: number;
        longTasks: number[];
        layoutShift: number;
        observers: PerformanceObserver[];
      };
    }).__workspacePerf;
    state.observers.forEach((observer) => observer.disconnect());
    return {
      clickToVisible: performance.now() - state.clickAt,
      maxLongTask: state.longTasks.length ? Math.max(...state.longTasks) : 0,
      layoutShift: state.layoutShift,
    };
  });
  console.log(`[workspace-open-performance] ${testInfo.project.name} ${JSON.stringify(metrics)}`);
  await testInfo.attach("workspace-open-metrics.json", {
    body: JSON.stringify(metrics),
    contentType: "application/json",
  });
  expect(metrics.clickToVisible).toBeLessThanOrEqual(100);
  expect(metrics.maxLongTask).toBeLessThan(50);
  expect(metrics.layoutShift).toBe(0);
});

test.afterEach(async ({ context }) => {
  await context.setOffline(false);
});
