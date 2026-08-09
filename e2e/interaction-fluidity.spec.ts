import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  attachInteractionMetrics,
  collectInteractionMetrics,
  expectInteractionBudget,
} from "./helpers/interactionMetrics";

const sampleText = readFileSync(
  path.resolve(process.cwd(), "e2e/fixtures/sample.txt"),
  "utf8"
);
const libraryRoot = '[data-navigation-root="library"][aria-hidden="false"]';

async function waitForPushSettle(page: Page, selector: string) {
  await expect
    .poll(() =>
      page.locator(selector).evaluate((element) => {
        const transform = getComputedStyle(element).transform;
        return transform === "none"
          ? 0
          : new DOMMatrixReadOnly(transform).m41;
      })
    )
    .toBe(0);
}

async function completeEdgeBack(page: Page) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 4, y: 360, radiusX: 2, radiusY: 2 }],
    });
    for (let index = 1; index <= 12; index += 1) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: 4 + (336 * index) / 12,
            y: 360,
            radiusX: 2,
            radiusY: 2,
          },
        ],
      });
      await page.waitForTimeout(12);
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }
}

async function openBookActionSheet(page: Page) {
  await page.getByRole("button", { name: "\u5217\u8868" }).click();
  await page
    .locator(`${libraryRoot} [data-library-book-more="true"]`)
    .first()
    .click();
  const actionSheet = page.locator('[data-sheet-route="book-actions"]');
  await expect(actionSheet).toHaveCount(1);
  return actionSheet;
}

test("book actions use a clear grouped visual hierarchy", async ({ page }) => {
  const sheet = await openBookActionSheet(page);
  const sections = sheet.locator("[data-book-action-section]");
  await expect(sections).toHaveCount(4);

  const visualContract = await sheet.evaluate((element) => {
    const read = (selector: string) => {
      const node = element.querySelector<HTMLElement>(selector);
      if (!node) throw new Error(`Missing ${selector}`);
      const style = getComputedStyle(node);
      return {
        borderTopWidth: style.borderTopWidth,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
      };
    };

    return {
      actions: read('[data-book-action-section="actions"]'),
      details: read('[data-book-action-section="details"]'),
      rows: [
        ...element.querySelectorAll<HTMLElement>(
          '[data-book-action-section="actions"] button'
        ),
      ].map((row) => getComputedStyle(row).minHeight),
    };
  });

  expect(visualContract.actions.borderTopWidth).toBe("1px");
  expect(visualContract.details.borderTopWidth).toBe("1px");
  expect(visualContract.actions.borderRadius).toBe("14px");
  expect(visualContract.details.borderRadius).toBe("14px");
  expect(visualContract.actions.boxShadow).toBe("none");
  expect(visualContract.rows).toHaveLength(5);
  expect(
    visualContract.rows.every((height) => Number.parseFloat(height) >= 44)
  ).toBe(true);
});

test("reading workspace uses an opaque content surface", async ({ page }) => {
  const actionSheet = await openBookActionSheet(page);
  await actionSheet
    .locator('[data-book-action-section="actions"] button')
    .nth(1)
    .click();

  const workspace = page.locator('[data-sheet-route="reading-workspace"]');
  const panel = workspace.locator('[data-motion-sheet="panel"]');
  await expect(panel).toBeVisible();
  const background = await panel.evaluate(
    (element) => getComputedStyle(element).backgroundColor
  );
  const alphaMatch = background.match(
    /rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/
  );
  expect(alphaMatch ? Number(alphaMatch[1]) : 1).toBe(1);
});

test("book management sheets keep nested content opaque and touch-sized", async ({
  page,
}) => {
  const actionSheet = await openBookActionSheet(page);
  await actionSheet.getByRole("button", { name: "管理分组" }).click();

  const groupsSheet = page.locator('[data-sheet-route="book-groups"]');
  const groupsEditor = groupsSheet.locator('[data-book-editor="groups"]');
  await expect(groupsEditor).toBeVisible();
  const groupContract = await groupsEditor.evaluate((element) => {
    const input = element.querySelector<HTMLInputElement>(
      'input[placeholder="分组名称"]'
    );
    const createButton = element.querySelector<HTMLButtonElement>(
      'button:not([aria-label])'
    );
    const editorStyle = getComputedStyle(element);
    return {
      background: editorStyle.backgroundColor,
      inputMinHeight: input ? getComputedStyle(input).minHeight : "",
      createMinHeight: createButton
        ? getComputedStyle(createButton).minHeight
        : "",
    };
  });
  expect(groupContract.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(Number.parseFloat(groupContract.inputMinHeight)).toBeGreaterThanOrEqual(
    44
  );
  expect(Number.parseFloat(groupContract.createMinHeight)).toBeGreaterThanOrEqual(
    44
  );
  await groupsSheet.getByRole("button", { name: "完成" }).click();
  await expect(groupsSheet).toHaveCount(0);
  await actionSheet.getByRole("button", { name: "重命名书籍" }).click();

  const renameSheet = page.locator('[data-sheet-route="book-rename"]');
  const renameEditor = renameSheet.locator('[data-book-editor="rename"]');
  const renameInput = renameSheet.getByLabel("书名");
  await expect(renameEditor).toBeVisible();
  const renameContract = await renameInput.evaluate((element) => ({
    minHeight: getComputedStyle(element).minHeight,
    borderRadius: getComputedStyle(element).borderRadius,
    background: getComputedStyle(element.closest("[data-book-editor]")!).backgroundColor,
  }));
  expect(renameContract.background).not.toBe("rgba(0, 0, 0, 0)");
  expect(Number.parseFloat(renameContract.minHeight)).toBeGreaterThanOrEqual(48);
  expect(renameContract.borderRadius).toBe("10px");
});

async function installKeyboardVisualViewport(page: Page) {
  await page.evaluate(() => {
    const viewport = new EventTarget();
    Object.assign(viewport, {
      offsetLeft: 0,
      offsetTop: 0,
      width: window.innerWidth,
      height: window.innerHeight,
      pageLeft: 0,
      pageTop: 0,
      scale: 1,
    });
    const measuredWindow = window as typeof window & {
      __sheetKeyboardViewport?: EventTarget & { height: number };
      __sheetScrollIntoViewCalls?: Array<{
        block?: ScrollLogicalPosition;
        targetId: string;
      }>;
    };
    measuredWindow.__sheetKeyboardViewport = viewport as EventTarget & {
      height: number;
    };
    measuredWindow.__sheetScrollIntoViewCalls = [];
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(options) {
      measuredWindow.__sheetScrollIntoViewCalls?.push({
        block:
          typeof options === "object" && options
            ? options.block
            : undefined,
        targetId: (this as HTMLElement).id,
      });
      originalScrollIntoView?.call(this, options);
    };
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
  });
}

async function showKeyboardVisualViewport(page: Page) {
  await page.evaluate(() => {
    const measuredWindow = window as typeof window & {
      __sheetKeyboardViewport?: EventTarget & { height: number };
    };
    const viewport = measuredWindow.__sheetKeyboardViewport;
    if (!viewport) throw new Error("Keyboard visual viewport is not installed");
    viewport.height = Math.max(320, window.innerHeight - 320);
    viewport.dispatchEvent(new Event("resize"));
  });
}

async function measurePressFeedback(
  page: Page,
  target: Locator,
  observed: Locator = target
) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
  const box = await target.boundingBox();
  if (!box) throw new Error("Press target geometry is unavailable");
  await observed.evaluate((element) => {
    const targetElement = element as HTMLElement;
    const fingerprint = () => {
      const style = getComputedStyle(targetElement);
      return `${style.opacity}|${style.transform}|${style.backgroundColor}`;
    };
    const baseline = fingerprint();
    delete targetElement.dataset.pressProbeLatency;
    targetElement.addEventListener(
      "pointerdown",
      () => {
        const startedAt = performance.now();
        const sample = (now: number) => {
          if (fingerprint() !== baseline) {
            targetElement.dataset.pressProbeLatency = String(now - startedAt);
            return;
          }
          requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      },
      { once: true }
    );
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  try {
    await expect
      .poll(() => observed.getAttribute("data-press-probe-latency"), {
        timeout: 500,
      })
      .not.toBeNull();
    return Number(await observed.getAttribute("data-press-probe-latency"));
  } finally {
    await page.mouse.up();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(libraryRoot)).toBeVisible();
  await expect(
    page.locator(`${libraryRoot} [data-library-loading="false"]`)
  ).toHaveCount(1);

  const covers = page.locator(`${libraryRoot} [data-book-cover-origin]`);
  const previousCount = await covers.count();
  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({
    name: "interaction-fluidity-sample.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(sampleText),
  });
  await expect(covers).toHaveCount(previousCount + 1);
});

test("search dock remains coherent when the morph is interrupted", async ({ page }) => {
  await page.getByRole("button", { name: "搜索书库" }).click();
  const back = page.getByRole("button", { name: "返回" });
  await expect(back).toBeVisible();
  await back.click();
  await expect(page.locator('[data-navigation-mode="root"]')).toBeVisible();
  await expect(page.locator('[data-navigation-mode="search"]')).toHaveCount(0);
  await expect(page.getByRole("searchbox", { name: "搜索书库" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "搜索书库" })).toBeVisible();
});

test("press feedback appears within 80 ms across daily interaction families", async ({ page }, testInfo) => {
  const latencies: Array<{ control: string; latency: number }> = [];
  const searchButton = page.getByRole("button", { name: "搜索书库" });
  latencies.push({
    control: "search-button",
    latency: await measurePressFeedback(page, searchButton),
  });
  await page.getByRole("button", { name: "返回" }).click();
  await expect(page.locator('[data-navigation-mode="root"]')).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "搜索书库" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "返回" })).toHaveCount(0);
  const readingTab = page.locator('[data-navigation-tab="reading"]');
  latencies.push({
    control: "root-tab",
    latency: await measurePressFeedback(page, readingTab),
  });
  await page.locator('[data-navigation-tab="library"]').click();
  await page.getByRole("button", { name: "列表" }).click();
  const covers = page.locator(`${libraryRoot} [data-book-cover-origin]`);
  const coverCount = await covers.count();
  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({
    name: "press-feedback-second.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(sampleText),
  });
  await expect(covers).toHaveCount(coverCount + 1);

  const bookOpen = page.locator(`${libraryRoot} [data-library-book-open="true"]`).last();
  latencies.push({
    control: "book-row",
    latency: await measurePressFeedback(page, bookOpen),
  });
  const reader = page.locator('[data-reader-presented="true"]');
  await expect(reader).toBeVisible();
  await expect
    .poll(() =>
      reader.evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length
      )
    )
    .toBe(0);
  const readerControl = reader.locator('[data-reader-menu-toggle="true"]');
  latencies.push({
    control: "reader-control",
    latency: await measurePressFeedback(page, readerControl),
  });
  if ((await readerControl.getAttribute("aria-expanded")) !== "true") {
    await readerControl.click();
  }
  await reader.getByRole("button", { name: "书库" }).click();

  await expect(page.locator(libraryRoot)).toBeVisible();
  await page.locator(`${libraryRoot} [data-library-book-more="true"]`).first().click();
  const workspaceRow = page
    .locator('[data-sheet-route="book-actions"]')
    .getByRole("button", { name: "阅读空间" });
  await expect(workspaceRow).toBeVisible();
  await page.waitForTimeout(350);
  latencies.push({
    control: "sheet-row",
    latency: await measurePressFeedback(page, workspaceRow),
  });
  const workspace = page.locator('[data-sheet-route="reading-workspace"]');
  await expect(workspace).toBeVisible();
  const workspaceTab = workspace.getByRole("tab", { name: "资料" });
  latencies.push({
    control: "workspace-tab",
    latency: await measurePressFeedback(page, workspaceTab),
  });

  await testInfo.attach("press-feedback-latencies.json", {
    body: JSON.stringify({ project: testInfo.project.name, latencies }, null, 2),
    contentType: "application/json",
  });
  for (const sample of latencies) {
    expect(sample.latency, sample.control).toBeLessThanOrEqual(80);
  }
});

test("reader popover keeps focus with reduced motion and 200 percent text", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page.locator(`${libraryRoot} [data-book-cover-origin]`).first().click();
  await expect(page.locator('[data-reader-presented="true"]')).toBeVisible();
  const menuToggle = page.locator('[data-reader-menu-toggle="true"]');
  if ((await menuToggle.getAttribute("aria-expanded")) !== "true") {
    await menuToggle.click();
  }
  await page.getByRole("button", { name: /主题与设置/ }).click();

  const settings = page.locator('[data-sheet-route="reader-settings"]');
  const modeTrigger = settings.getByRole("button", { name: "阅读方式" });
  const metricsPromise = collectInteractionMetrics(page, { durationMs: 500 });
  await modeTrigger.click();
  const popover = settings.getByRole("menu");
  await expect(popover).toBeVisible();
  expect(
    await popover.evaluate((element) => {
      const transform = getComputedStyle(element).transform;
      if (transform === "none") return true;
      const matrix = new DOMMatrixReadOnly(transform);
      return matrix.a === 1 && matrix.d === 1 && matrix.e === 0 && matrix.f === 0;
    })
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);
  await expect(modeTrigger).toBeFocused();
  const metrics = await metricsPromise;
  console.info(
    `[reader-popover-cadence] ${testInfo.project.name}`,
    JSON.stringify(metrics)
  );
  await attachInteractionMetrics(testInfo, "reader-popover-inline-state", metrics);
  expectInteractionBudget(metrics);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
});

test("AI inline state stays current while model refresh is pending", async ({ page }, testInfo) => {
  await page.locator('[data-navigation-tab="settings"]').click();
  const settingsRoot = page.locator(
    '[data-navigation-root="settings"][aria-hidden="false"]'
  );
  await settingsRoot.getByRole("button", { name: /AI 服务商/ }).click();
  await page.getByRole("button", { name: "添加 AI 服务商" }).click();
  const configure = page.locator('[data-provider-configure="true"]');
  await configure.getByRole("button", { name: /OpenAI/ }).click();
  await configure.getByLabel("API Key").fill("fixture-key");

  await page.route("**/api/models", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        models: [{ id: "stale-model", label: "Stale model", source: "remote" }],
      }),
    });
  });

  const refresh = configure.getByRole("button", { name: "刷新" });
  await refresh.click();
  await expect(configure.getByText("正在刷新模型…")).toBeVisible();
  await expect(refresh).toBeDisabled();
  const metricsPromise = collectInteractionMetrics(page, { durationMs: 500 });
  await configure.getByRole("button", { name: /Anthropic/ }).click();
  await expect(refresh).toBeEnabled();
  await page.waitForTimeout(650);

  await expect(configure.getByText("Stale model")).toHaveCount(0);
  await expect(configure.getByRole("button", { name: /Anthropic/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(configure.getByText("正在刷新模型…")).toHaveCount(0);
  const metrics = await metricsPromise;
  await attachInteractionMetrics(testInfo, "provider-pending-inline-state", metrics);
  expectInteractionBudget(metrics);
});

test("reader lifecycle resumes at settled geometry without replaying entry", async ({
  page,
}) => {
  await page.locator(`${libraryRoot} [data-book-cover-origin]`).first().click();
  const presentation = page.locator('[data-reader-presented="true"]');
  const content = presentation.locator('[data-reader-content-ready="true"]');
  await expect(content).toHaveCount(1);

  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));

  await expect(presentation).toHaveCount(1);
  await expect(presentation).toHaveAttribute(
    "data-reader-lifecycle-settled",
    "true"
  );
  await expect
    .poll(() =>
      presentation.evaluate((element) => {
        const style = getComputedStyle(element);
        const transform = style.transform;
        const x =
          transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
        return {
          opacity: Number(style.opacity),
          running: element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
          x,
        };
      })
    )
    .toEqual({ opacity: 1, running: 0, x: 0 });

  await page.evaluate(() =>
    window.dispatchEvent(new Event("orientationchange"))
  );
  await expect(presentation).toHaveAttribute(
    "data-reader-lifecycle-settled",
    "true"
  );
  await expect
    .poll(() =>
      presentation.evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length
      )
    )
    .toBe(0);
});

test("interaction probe records root retargeting without layout shift", async ({
  page,
}, testInfo) => {
  const metricsPromise = collectInteractionMetrics(page, { durationMs: 700 });

  await page.locator('[data-navigation-tab="reading"]').click();
  await page.waitForTimeout(100);
  await page.locator('[data-navigation-tab="settings"]').click();

  const metrics = await metricsPromise;
  await attachInteractionMetrics(testInfo, "root-retarget-baseline", metrics);
  const evidencePath = testInfo.outputPath("root-retarget-baseline.json");

  expect(existsSync(evidencePath)).toBe(true);
  expect(JSON.parse(readFileSync(evidencePath, "utf8"))).toEqual({
    project: testInfo.project.name,
    ...metrics,
  });

  expectInteractionBudget(metrics);
  await expect(
    page.locator('[data-navigation-root="settings"][aria-hidden="false"]')
  ).toBeVisible();
});

test("ten root intents settle on the last tab without ghost surfaces", async ({
  page,
}, testInfo) => {
  const intents = [
    "reading",
    "settings",
    "library",
    "settings",
    "reading",
    "library",
    "reading",
    "settings",
    "library",
    "settings",
  ] as const;
  const metricsPromise = collectInteractionMetrics(page, { durationMs: 800 });

  for (const tab of intents) {
    await page.locator(`[data-navigation-tab="${tab}"]`).click();
    await page.waitForTimeout(18);
  }

  const metrics = await metricsPromise;
  console.info(
    `[ten-root-intents-cadence] ${testInfo.project.name}`,
    JSON.stringify(metrics)
  );
  await attachInteractionMetrics(testInfo, "ten-root-intents", metrics);

  await expect(
    page.locator('[data-navigation-root="settings"]')
  ).toHaveAttribute("aria-hidden", "false");
  await expect(
    page.locator('[data-navigation-root][aria-hidden="false"]')
  ).toHaveCount(1);
  expectInteractionBudget(metrics);
});

test("pointercancel restores an interrupted push without navigating", async ({
  page,
}) => {
  await page
    .locator(libraryRoot)
    .getByRole("button", { name: /藏书/ })
    .first()
    .click();
  const push = page.locator('[data-push-route="collections"]');
  await expect(push).toBeVisible();
  await expect
    .poll(() =>
      push.evaluate((element) => {
        const transform = getComputedStyle(element).transform;
        return transform === "none"
          ? 0
          : new DOMMatrixReadOnly(transform).m41;
      })
    )
    .toBe(0);

  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 4, y: 360, radiusX: 2, radiusY: 2 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 96, y: 360, radiusX: 2, radiusY: 2 }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }

  await expect(push).toHaveCount(1);
  await expect
    .poll(() =>
      push.evaluate((element) => {
        const transform = getComputedStyle(element).transform;
        return transform === "none"
          ? 0
          : new DOMMatrixReadOnly(transform).m41;
      })
    )
    .toBe(0);
  await expect(push).toHaveAttribute("aria-hidden", "false");
  await push.getByRole("button", { name: /书库/ }).click();
  await expect(push).toHaveCount(0);
});

test("one edge gesture pops one nested push and a second gesture can rearm", async ({
  page,
}) => {
  await page.locator('[data-navigation-tab="settings"]').click();
  const settingsRoot = page.locator(
    '[data-navigation-root="settings"][aria-hidden="false"]'
  );
  await expect(settingsRoot).toBeVisible();
  await settingsRoot.getByRole("button", { name: /AI 服务商/ }).click();

  const providerList = page.locator('[data-push-route="ai-providers"]');
  await expect(providerList).toBeVisible();
  const addProvider = page.locator('[data-open-provider-configure="true"]');
  await addProvider.click();
  const configure = page.locator(
    '[data-push-route="ai-provider-configure"]'
  );
  await expect(configure).toBeVisible();
  await expect(page.locator("[data-push-route]")).toHaveCount(2);
  await waitForPushSettle(page, '[data-push-route="ai-provider-configure"]');

  await completeEdgeBack(page);
  await page.waitForTimeout(800);

  await expect(page.locator("[data-push-route]")).toHaveCount(1);
  await expect(configure).toHaveCount(0);
  await expect(providerList).toBeVisible();
  await expect(addProvider).toBeEnabled();
  await addProvider.focus();
  await expect(addProvider).toBeFocused();

  await completeEdgeBack(page);
  await page.waitForTimeout(800);

  await expect(page.locator("[data-push-route]")).toHaveCount(0);
  await expect(settingsRoot).toBeVisible();
});

test("nested sheet rapid reversal settles on the last requested page", async ({
  page,
}) => {
  await page.getByRole("button", { name: "列表" }).click();
  await page.locator(`${libraryRoot} [data-library-book-more="true"]`).first().click();
  const panel = page.locator('[data-motion-sheet="panel"]');
  await expect(panel).toHaveCount(1);
  await panel.evaluate((element) => {
    (element as HTMLElement).dataset.e2eIdentity = "rapid-sheet-panel";
  });

  for (let index = 0; index < 5; index += 1) {
    await page.getByRole("button", { name: "重命名书籍" }).click();
    await page.getByRole("button", { name: "关闭" }).click();
  }

  await expect(page.locator('[data-sheet-route="book-actions"]')).toHaveCount(1);
  await expect(page.locator('[data-sheet-route="book-rename"]')).toHaveCount(0);
  await expect(page.locator("[data-sheet-page]")).toHaveCount(1);
  await expect(panel).toHaveCount(1);
  await expect(panel).toHaveAttribute("data-e2e-identity", "rapid-sheet-panel");
  await expect(page.locator('[data-motion-sheet="backdrop"]')).toHaveCount(1);
});

test("keyboard keeps rename input visible and prevents sheet drag ownership", async ({
  page,
}) => {
  await installKeyboardVisualViewport(page);
  const actionSheet = await openBookActionSheet(page);
  await actionSheet
    .getByRole("button", { name: "\u91cd\u547d\u540d\u4e66\u7c4d" })
    .click();

  const renameSheet = page.locator('[data-sheet-route="book-rename"]');
  const input = renameSheet.getByLabel("\u4e66\u540d");
  await expect(input).toBeFocused();
  await showKeyboardVisualViewport(page);
  await expect
    .poll(() =>
      input.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const viewport = window.visualViewport;
        const viewportTop = viewport?.offsetTop ?? 0;
        const viewportBottom =
          viewportTop + (viewport?.height ?? window.innerHeight);
        return rect.top >= viewportTop && rect.bottom <= viewportBottom;
      })
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const measuredWindow = window as typeof window & {
          __sheetScrollIntoViewCalls?: Array<{
            block?: ScrollLogicalPosition;
            targetId: string;
          }>;
        };
        return measuredWindow.__sheetScrollIntoViewCalls?.some(
          (call) =>
            call.targetId === "rename-book-title" && call.block === "nearest"
        ) ?? false;
      })
    )
    .toBe(true);

  const panel = page.locator('[data-motion-sheet="panel"]');
  const handle = page.locator('[data-sheet-drag-handle="true"]');
  const box = await handle.boundingBox();
  if (!box) throw new Error("Sheet drag handle geometry is unavailable");
  const session = await page.context().newCDPSession(page);
  try {
    const x = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y: startY }],
    });
    for (let index = 1; index <= 6; index += 1) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: startY + index * 12 }],
      });
    }
    await expect
      .poll(() =>
        panel.evaluate((element) => {
          const transform = getComputedStyle(element).transform;
          return transform === "none"
            ? 0
            : new DOMMatrixReadOnly(transform).m42;
        })
      )
      .toBe(0);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }

  await expect(renameSheet).toHaveCount(1);
  await expect(input).toBeFocused();
});

test("focus returns to the originating Book Action row after internal Back", async ({
  page,
}) => {
  const actionSheet = await openBookActionSheet(page);
  const renameAction = actionSheet.getByRole("button", {
    name: "\u91cd\u547d\u540d\u4e66\u7c4d",
  });
  await renameAction.click();
  const renameSheet = page.locator('[data-sheet-route="book-rename"]');
  await expect(renameSheet.getByLabel("\u4e66\u540d")).toBeFocused();

  await renameSheet
    .getByRole("button", { name: "\u5173\u95ed" })
    .click();

  await expect(page.locator('[data-sheet-route="book-actions"]')).toHaveCount(1);
  await expect(renameAction).toBeFocused();
});

test("lifecycle resume restores focus after an interrupted internal Back", async ({
  page,
}) => {
  const actionSheet = await openBookActionSheet(page);
  const renameAction = actionSheet.getByRole("button", {
    name: "\u91cd\u547d\u540d\u4e66\u7c4d",
  });
  await renameAction.click();
  const renameSheet = page.locator('[data-sheet-route="book-rename"]');
  await expect(renameSheet.getByLabel("\u4e66\u540d")).toBeFocused();

  await renameSheet
    .getByRole("button", { name: "\u5173\u95ed" })
    .click();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));

  await expect(page.locator('[data-sheet-route="book-actions"]')).toHaveCount(1);
  await expect(renameAction).toBeFocused();
});

test("reader custom settings returns focus to its originating control", async ({
  page,
}) => {
  await page.locator('[data-navigation-tab="settings"]').click();
  const settingsRoot = page.locator(
    '[data-navigation-root="settings"][aria-hidden="false"]'
  );
  await settingsRoot
    .getByRole("button", { name: /\u9605\u8bfb\u5916\u89c2/ })
    .click();

  const readerSettings = page.locator('[data-sheet-route="reader-settings"]');
  const customButton = readerSettings.getByRole("button", {
    name: "\u81ea\u5b9a\u4e49",
  });
  await customButton.click();

  const customSettings = page.locator(
    '[data-sheet-route="reader-custom-settings"]'
  );
  await expect(customSettings).toHaveCount(1);
  await customSettings
    .getByRole("button", { name: "\u5173\u95ed" })
    .click();

  await expect(readerSettings).toHaveCount(1);
  await expect(customButton).toBeFocused();
});

test("active sheet page is the only accessible internal page", async ({
  page,
}) => {
  const actionSheet = await openBookActionSheet(page);
  await actionSheet
    .getByRole("button", { name: "\u91cd\u547d\u540d\u4e66\u7c4d" })
    .click();

  await expect(page.locator('[role="dialog"][aria-modal="true"]')).toHaveCount(1);
  const pages = page.locator("[data-sheet-page]");
  await expect(pages).toHaveCount(2);
  await expect(page.locator('[data-sheet-page][role="region"]')).toHaveCount(2);
  await expect(
    page.locator('[data-sheet-page][data-sheet-page-active="true"]:not([aria-hidden])')
  ).toHaveCount(1);
  const coveredPage = page.locator(
    '[data-sheet-page][data-sheet-page-active="false"][aria-hidden="true"]'
  );
  await expect(coveredPage).toHaveCount(1);
  expect(await coveredPage.evaluate((element) => (element as HTMLElement).inert)).toBe(
    true
  );
});

test("focus trap wraps within the active sheet page in both directions", async ({
  page,
}) => {
  const actionSheet = await openBookActionSheet(page);
  await actionSheet
    .getByRole("button", { name: "\u91cd\u547d\u540d\u4e66\u7c4d" })
    .click();

  const renameSheet = page.locator('[data-sheet-route="book-rename"]');
  const closeButton = renameSheet.getByRole("button", {
    name: "\u5173\u95ed",
  });
  const saveButton = renameSheet.getByRole("button", {
    name: "\u4fdd\u5b58",
  });

  await saveButton.focus();
  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();

  await closeButton.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(saveButton).toBeFocused();
});

test("lifecycle interruption still commits a removed delete page callback once", async ({
  page,
}) => {
  const actionSheet = await openBookActionSheet(page);
  const booksBefore = await page.locator(`${libraryRoot} [data-book-cover-origin]`).count();
  await actionSheet
    .getByRole("button", { name: "\u5220\u9664\u8fd9\u672c\u4e66" })
    .click();
  const deleteSheet = page.locator('[data-sheet-route="book-delete"]');
  await expect(deleteSheet).toHaveCount(1);

  await deleteSheet
    .getByRole("button", { name: "\u5220\u9664\u8fd9\u672c\u4e66" })
    .click();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await page.waitForTimeout(50);
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));

  await expect(page.locator(`${libraryRoot} [data-book-cover-origin]`)).toHaveCount(
    booksBefore - 1
  );
  await expect(page.locator('[data-sheet-route]')).toHaveCount(0);
});

test("abnormal lost pointer capture settles once without dismissing the sheet", async ({
  page,
}) => {
  await openBookActionSheet(page);
  const panel = page.locator('[data-motion-sheet="panel"]');
  const handle = page.locator('[data-sheet-drag-handle="true"]');
  const box = await handle.boundingBox();
  if (!box) throw new Error("Sheet drag handle geometry is unavailable");
  const session = await page.context().newCDPSession(page);
  try {
    const x = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y: startY }],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: startY + 72 }],
    });
    await expect
      .poll(() =>
        panel.evaluate((element) => {
          const transform = getComputedStyle(element).transform;
          return transform === "none"
            ? 0
            : new DOMMatrixReadOnly(transform).m42;
        })
      )
      .toBeGreaterThan(0);
    await panel.evaluate((element) => {
      element.dispatchEvent(
        new PointerEvent("lostpointercapture", {
          bubbles: true,
          pointerId: 1,
        })
      );
    });
    await expect(page.locator('[data-sheet-route="book-actions"]')).toHaveCount(1);
    await expect
      .poll(() =>
        panel.evaluate((element) => {
          const transform = getComputedStyle(element).transform;
          return transform === "none"
            ? 0
            : new DOMMatrixReadOnly(transform).m42;
        })
      )
      .toBe(0);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }

  await expect(page.locator('[data-sheet-route="book-actions"]')).toHaveCount(1);
  await expect
    .poll(() =>
      panel.evaluate((element) => {
        const transform = getComputedStyle(element).transform;
        return transform === "none"
          ? 0
          : new DOMMatrixReadOnly(transform).m42;
      })
    )
    .toBe(0);
});
