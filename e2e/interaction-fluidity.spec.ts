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
    metrics,
  });

  expect(metrics.frames).toBeGreaterThan(20);
  expect(metrics.maxLongTask).toBe(0);
  expect(metrics.layoutShift).toBe(0);
  await expect(
    page.locator('[data-navigation-root="settings"][aria-hidden="false"]')
  ).toBeVisible();
});
