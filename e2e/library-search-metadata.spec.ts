import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

test("local search finds enriched metadata and preserves its details return context", async ({ page }) => {
  let metadataRequests = 0;
  await page.route("**/api/book-metadata/search", (route) => {
    metadataRequests += 1;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        candidate: {
          source: "open-library",
          sourceId: "OL1W",
          title: "资本论",
          authors: ["卡尔·马克思"],
          description: "一部政治经济学经典著作。",
          subjects: ["政治经济学", "经典"],
          publisher: "人民出版社",
          publishedDate: "2004",
          language: "zh",
          identifiers: [],
        },
        score: 0.96,
        missing: [],
      }),
    });
  });
  await page.goto("/");
  const library = page.locator('[data-navigation-root="library"][aria-hidden="false"]');
  await expect(library.locator('[data-library-loading="false"]')).toHaveCount(1);
  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({
    name: "local-import.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("第一章 商品与价值。\n\n本地正文用于搜索验证。"),
  });
  const shelfBook = library.locator('[data-library-book-open="true"]');
  await expect(shelfBook).toHaveCount(1);

  // Wait for enrichment through the existing details workflow, not a fixed delay.
  await shelfBook.click();
  const details = page.locator('[data-push-route="book-details"]');
  await expect(details.getByRole("heading", { level: 1 })).toHaveText("资本论");
  await page.goBack();
  await expect(details).toHaveCount(0);
  await expect(shelfBook).toContainText("local import");
  await expect(library.locator('[data-library-search-context="true"]')).toHaveCount(0);
  const requestsAfterEnrichment = metadataRequests;

  await page.getByRole("button", { name: /搜索书库/ }).click();
  const search = page.getByRole("searchbox", { name: /搜索书库/ });
  const surface = page.locator('[data-library-search-surface="true"]');
  const result = surface.locator('[data-library-book-open="true"]');
  await search.fill("资本论");
  await expect(result).toHaveCount(1);
  await expect(result).toContainText("书名：资本论");
  await expect(result).toContainText("local import");
  await search.fill("马克思");
  await expect(result).toHaveCount(1);
  await expect(result).toContainText("作者：卡尔·马克思");

  const mixedQuery = "  资本论   马克思  经典  ＴＸＴ  ";
  await search.fill(mixedQuery);
  await expect(result).toHaveCount(1);
  await expect(result).toContainText("标签：经典");
  await result.click();
  await expect(details).toBeVisible();
  await page.goBack();
  await expect(details).toHaveCount(0);
  await expect(search).toHaveValue(mixedQuery);
  await expect(result).toHaveCount(1);
  await expect(result).toBeFocused();
  expect(metadataRequests).toBe(requestsAfterEnrichment);

  await search.fill("资本论 missing");
  await expect(result).toHaveCount(0);
  await search.fill("");
  await expect(result).toHaveCount(1);
  await expect(surface.locator('[data-library-search-context="true"]')).toHaveCount(0);
});

test("search restores a scrolled result and retains progress after a reader round trip", async ({ page }) => {
  await page.route("**/api/book-metadata/search", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      candidate: {
        source: "open-library",
        sourceId: "OL1W",
        title: "资本论",
        authors: ["卡尔·马克思"],
        description: "一部政治经济学经典著作。",
        subjects: ["政治经济学", "经典"],
        publisher: "人民出版社",
        publishedDate: "2004",
        language: "zh",
        identifiers: [],
      },
      score: 0.96,
      missing: [],
    }),
  }));
  await page.goto("/");
  const library = page.locator('[data-navigation-root="library"][aria-hidden="false"]');
  await expect(library.locator('[data-library-loading="false"]')).toHaveCount(1);
  const bookCount = 12;
  const buffer = readFileSync(path.resolve(process.cwd(), "e2e/fixtures/sample.txt"));
  for (let index = 1; index <= bookCount; index += 1) {
    await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({
      name: `search-journey-${String(index).padStart(2, "0")}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.concat([buffer, Buffer.from(`\n\n独立文件 ${index}`)]),
    });
    await expect(library.locator('[data-library-book-open="true"]')).toHaveCount(index);
  }

  await page.getByRole("button", { name: /搜索书库/ }).click();
  const search = page.getByRole("searchbox", { name: /搜索书库/ });
  const query = "  search-journey   ＴＸＴ  ";
  await search.fill(query);
  const searchPage = page.locator('[data-push-route="library-search"]');
  const results = searchPage.locator('[data-library-book-open="true"]');
  await expect(results).toHaveCount(bookCount);
  const selectedBookId = await results.last().getAttribute("data-book-focus-id");
  expect(selectedBookId).toBeTruthy();
  if (!selectedBookId) throw new Error("Search result is missing its book id");
  const selectedResult = searchPage.locator(`[data-book-focus-id="${selectedBookId}"]`);
  await selectedResult.scrollIntoViewIfNeeded();
  await expect(selectedResult).toBeInViewport();
  const searchScrollTop = await searchPage.evaluate((element) => element.scrollTop);
  expect(searchScrollTop).toBeGreaterThan(100);
  await selectedResult.click();

  const details = page.locator('[data-push-route="book-details"]');
  await expect(details).toBeVisible();
  const progress = details.getByRole("region", { name: "阅读进度", includeHidden: true });
  await expect(progress.getByText("0%", { exact: true })).toBeVisible();
  await details.getByRole("button", { name: "开始阅读", exact: true }).click();
  const reader = page.locator('[data-txt-reader="true"]');
  await expect(page.locator('[data-reader-presented="true"]')).toBeVisible();
  await expect(reader).toContainText("The first page begins");
  const readSavedProgress = () => page.evaluate((bookId) => new Promise<number | undefined>((resolve) => {
    const request = indexedDB.open("AiReader");
    request.onsuccess = () => {
      const database = request.result;
      const get = database.transaction("readingPositions", "readonly").objectStore("readingPositions").get(bookId);
      get.onsuccess = () => { resolve(get.result?.progressPercent); database.close(); };
    };
  }), selectedBookId);
  const readerScrollTop = await reader.evaluate((element) => {
    element.scrollTop = (element.scrollHeight - element.clientHeight) * 0.505;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
    return element.scrollTop;
  });
  expect(readerScrollTop).toBeGreaterThan(0);
  // The covered details surface reflects processed reader progress before Back.
  await expect(progress.getByText("50%", { exact: true })).toHaveText("50%");

  await page.goBack();
  await expect(page.locator('[data-reader-presented="true"]')).toHaveCount(0);
  await expect(details).toBeVisible();
  await expect.poll(readSavedProgress).toBeGreaterThan(0);
  const savedProgress = await readSavedProgress();
  if (savedProgress === undefined) throw new Error("Reader progress was not persisted");
  const expectedProgress = `${savedProgress}%`;
  await expect(progress.getByText(expectedProgress, { exact: true })).toBeVisible();
  await expect(details.getByRole("button", { name: "继续阅读", exact: true })).toBeVisible();
  await page.goBack();
  await expect(details).toHaveCount(0);
  await expect(search).toHaveValue(query);
  await expect(results).toHaveCount(bookCount);
  await expect(selectedResult).toBeFocused();
  await expect.poll(async () =>
    Math.abs(await searchPage.evaluate((element) => element.scrollTop) - searchScrollTop)
  ).toBeLessThanOrEqual(2);

  // Reopening from the restored search result verifies the saved reading position.
  await selectedResult.click();
  await expect(progress.getByText(expectedProgress, { exact: true })).toBeVisible();
  await details.getByRole("button", { name: "继续阅读", exact: true }).click();
  await expect(reader).toBeVisible();
  await expect.poll(readSavedProgress).toBe(savedProgress);
  await expect.poll(async () => reader.evaluate((element) =>
    Math.round(element.scrollTop / (element.scrollHeight - element.clientHeight) * 100)
  )).toBe(savedProgress);

  await reader.focus();
  await page.keyboard.press("End");
  await expect(reader).toBeFocused();
  await expect.poll(async () => reader.evaluate((element) =>
    Math.floor(element.scrollTop / (element.scrollHeight - element.clientHeight) * 100)
  )).toBeGreaterThan(savedProgress);
  const keyboardProgress = await reader.evaluate((element) =>
    Math.floor(element.scrollTop / (element.scrollHeight - element.clientHeight) * 100)
  );
  await expect.poll(readSavedProgress).toBe(keyboardProgress);
});
