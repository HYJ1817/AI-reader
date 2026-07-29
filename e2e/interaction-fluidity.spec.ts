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
