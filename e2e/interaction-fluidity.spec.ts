import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  attachInteractionMetrics,
  collectInteractionMetrics,
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

  expect(metrics.frames).toBeGreaterThan(20);
  expect(metrics.maxLongTask).toBe(0);
  expect(metrics.layoutShift).toBe(0);
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
  await attachInteractionMetrics(testInfo, "ten-root-intents", metrics);

  await expect(
    page.locator('[data-navigation-root="settings"]')
  ).toHaveAttribute("aria-hidden", "false");
  await expect(
    page.locator('[data-navigation-root][aria-hidden="false"]')
  ).toHaveCount(1);
  expect(metrics.p95Frame).toBeLessThanOrEqual(17);
  expect(metrics.maxLongTask).toBe(0);
  expect(metrics.layoutShift).toBe(0);
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
