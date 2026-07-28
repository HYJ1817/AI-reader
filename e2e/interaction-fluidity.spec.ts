import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  attachInteractionMetrics,
  collectInteractionMetrics,
} from "./helpers/interactionMetrics";

const sampleText = readFileSync(
  path.resolve(process.cwd(), "e2e/fixtures/sample.txt"),
  "utf8"
);
const libraryRoot = '[data-navigation-root="library"][aria-hidden="false"]';

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
