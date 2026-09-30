import { expect, test, type Page } from "@playwright/test";

async function configureExistingProvider(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("ai-reader-ai-provider-settings", JSON.stringify({
      activeProviderId: "consent-fixture",
      providers: [{ id: "consent-fixture", kind: "custom", protocol: "openai-compatible", label: "Consent fixture", baseUrl: "https://fixture.invalid", apiKey: "test-only", model: "fixture-model", models: [{ id: "fixture-model", label: "Fixture", source: "manual" }], appendDefaultPath: false, defaultPath: "/v1", createdAt: "2026-09-18", updatedAt: "2026-09-18" }],
    }));
  });
}
async function importText(page: Page, name: string) {
  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from(`${name}\n\n${"这是有限的开头节选。".repeat(900)}`) });
}

test("an existing provider grants no automatic consent; single-book confirmation sends only a bounded excerpt", async ({ page }) => {
  await configureExistingProvider(page);
  let publicCalls = 0;
  const aiRequests: { excerpt: string }[] = [];
  await page.route("**/api/book-metadata/search", async (route) => {
    publicCalls++;
    await route.fulfill({ json: { candidate: null, score: 0, missing: ["description", "subjects"] } });
  });
  await page.route("**/api/book-metadata/complete", async (route) => {
    aiRequests.push(route.request().postDataJSON());
    await route.fulfill({ json: { completion: { description: "这是一段 AI 生成的简介。", subjects: ["阅读"] }, provenance: { source: "ai", generated: true } } });
  });
  await page.goto("/");
  await expect(page.locator('[data-library-loading="false"]')).toHaveCount(1);
  await importText(page, "consent.txt");
  await expect.poll(() => publicCalls).toBe(1);
  await page.getByRole("region", { name: "图书导入状态" }).getByRole("button", { name: "查看详情" }).click();
  const details = page.locator('[data-push-route="book-details"]');
  const retry = details.getByRole("button", { name: "重试图书信息查询" });
  await expect(retry).toBeEnabled();
  expect(aiRequests).toHaveLength(0);
  await retry.click();
  const offer = details.getByRole("region", { name: "单本 AI 补全" });
  await expect(offer).toContainText("Consent fixture");
  await expect(offer).toContainText("不会开启自动补全");
  expect(aiRequests).toHaveLength(0);
  page.once("dialog", (dialog) => dialog.dismiss());
  await offer.getByRole("button", { name: "用 AI 补全这本书" }).click();
  expect(aiRequests).toHaveLength(0);
  page.once("dialog", (dialog) => dialog.accept());
  await offer.getByRole("button", { name: "用 AI 补全这本书" }).click();
  await expect(details.getByText("AI 生成 · 请结合原书判断", { exact: true })).toBeVisible();
  expect(aiRequests).toHaveLength(1);
  expect(aiRequests[0].excerpt.length).toBeGreaterThan(0);
  expect(aiRequests[0].excerpt.length).toBeLessThanOrEqual(6000);
  await page.goBack();
  await importText(page, "later.txt");
  await expect.poll(() => publicCalls).toBe(4);
  expect(aiRequests).toHaveLength(1);
});

test("opt-in affects only future work and opt-out fences a queued completion", async ({ page }) => {
  await configureExistingProvider(page);
  let publicCalls = 0;
  let aiCalls = 0;
  let releaseSearch: (() => void) | undefined;
  let delayNext = false;
  await page.route("**/api/book-metadata/search", async (route) => {
    publicCalls++;
    if (delayNext) {
      delayNext = false;
      await new Promise<void>((resolve) => { releaseSearch = resolve; });
    }
    await route.fulfill({ json: { candidate: null, score: 0, missing: ["description", "subjects"] } });
  });
  await page.route("**/api/book-metadata/complete", async (route) => {
    aiCalls++;
    await route.fulfill({ json: { completion: { description: "授权后的简介", subjects: ["阅读"] }, provenance: { source: "ai", generated: true } } });
  });
  await page.goto("/");
  await expect(page.locator('[data-library-loading="false"]')).toHaveCount(1);
  await importText(page, "before-opt-in.txt");
  await expect.poll(() => publicCalls).toBe(1);
  async function openPreferences() {
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page.locator('[data-navigation-root="settings"]').getByRole("button", { name: /AI 服务商/ }).click();
    return page.getByRole("checkbox", { name: /自动用 AI 补全图书信息/ });
  }
  const toggle = await openPreferences();
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(toggle).toBeChecked();
  expect(aiCalls).toBe(0);
  expect(publicCalls).toBe(1);
  await page.goBack();
  await page.getByRole("button", { name: "书库", exact: true }).click();
  delayNext = true;
  await importText(page, "queued-opt-out.txt");
  await expect.poll(() => Boolean(releaseSearch)).toBe(true);
  await openPreferences();
  await toggle.uncheck();
  await toggle.check();
  releaseSearch!();
  await expect.poll(() => page.evaluate(() => new Promise<string[]>((resolve) => {
    const request = indexedDB.open("AiReader");
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction("books").objectStore("books").getAll();
      read.onsuccess = () => { resolve(read.result.map((book) => book.enrichment?.status)); db.close(); };
    };
  }))).toEqual(["failed", "failed"]);
  expect(aiCalls).toBe(0);
  await expect(toggle).toBeChecked();
  expect(aiCalls).toBe(0);
  expect(publicCalls).toBe(2);
  await page.goBack();
  await page.getByRole("button", { name: "书库", exact: true }).click();
  await importText(page, "after-opt-in.txt");
  await expect.poll(() => aiCalls).toBe(1);
  expect(publicCalls).toBe(3);
});
