import { expect, test, type Page } from "@playwright/test";

const libraryRoot = '[data-navigation-root="library"][aria-hidden="false"]';

async function waitForLibrary(page: Page) {
  await page.goto("/");
  await expect(page.locator(libraryRoot)).toBeVisible();
  await expect(
    page.locator(`${libraryRoot} [data-library-loading="false"]`)
  ).toHaveCount(1);
}

async function importTxt(page: Page, name = "detail-sample.txt") {
  const books = page.locator(`${libraryRoot} [data-library-book-open="true"]`);
  const previous = await books.count();
  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({
    name,
    mimeType: "text/plain",
    buffer: Buffer.from("第一章 商品与价值。\n\n这是一段用于阅读器验证的本地正文。"),
  });
  await expect(books).toHaveCount(previous + 1);
  return books.first();
}

async function mockCompletePublicMetadata(page: Page) {
  await page.route("**/api/book-metadata/search", (route) =>
    route.fulfill({
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
    })
  );
}

test.beforeEach(async ({ page }) => {
  await mockCompletePublicMetadata(page);
  await waitForLibrary(page);
});

test("book opens details before reader and restores library focus", async ({
  page,
}) => {
  const book = await importTxt(page);
  await book.focus();
  await book.click();

  const details = page.locator('[data-push-route="book-details"]');
  await expect(details).toBeVisible();
  await expect(details.getByRole("heading", { level: 1 })).toContainText("资本论");
  await expect(page.locator('[data-reader-presented="true"]')).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: /主要导航/ })).toBeVisible();

  await details.getByRole("button", { name: /开始阅读|继续阅读/ }).click();
  await expect(page.locator('[data-reader-presented="true"]')).toBeVisible();
  await expect(page.locator('[data-txt-reader="true"]')).toContainText("商品与价值");

  await page.goBack();
  await expect(details).toBeVisible();
  await page.goBack();
  await expect(details).toHaveCount(0);
  await expect(page.locator('[data-book-focus-id]').first()).toBeFocused();
});

test("search query and matching book survive a details round trip", async ({ page }) => {
  await importTxt(page, "searchable-capital.txt");
  await page.getByRole("button", { name: /搜索书库/ }).click();
  const search = page.getByRole("searchbox", { name: /搜索书库/ });
  await search.fill("searchable");
  const result = page.locator('[data-library-search-surface="true"] [data-library-book-open="true"]');
  await expect(result).toHaveCount(1);
  await result.click();
  await expect(page.locator('[data-push-route="book-details"]')).toBeVisible();

  await page.goBack();
  await expect(search).toHaveValue("searchable");
  await expect(result).toHaveCount(1);
});

test("public metadata renders and AI is not called when prose is complete", async ({
  page,
}) => {
  let aiRequests = 0;
  await page.route("**/api/book-metadata/complete", (route) => {
    aiRequests += 1;
    return route.fulfill({ status: 500, body: "unexpected" });
  });
  const book = await importTxt(page, "metadata-capital.txt");
  await book.click();
  const details = page.locator('[data-push-route="book-details"]');
  await expect(details.getByText("一部政治经济学经典著作。")).toBeVisible();
  await expect(details.getByText("卡尔·马克思").first()).toBeVisible();
  await expect(details.getByText("政治经济学", { exact: true }).first()).toBeVisible();
  expect(aiRequests).toBe(0);
});

test("selecting another root exits details and reduced motion remains functional", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "ai-reader-app-preferences",
      JSON.stringify({
        libraryView: "list",
        autoOpenLastBook: false,
        reduceMotion: true,
        keepScreenAwake: false,
        edgeTapToTurn: true,
        swipeToTurn: true,
        backgroundMode: "auto",
        customBackgroundOpacity: 1,
      })
    );
  });
  await page.reload();
  await expect(page.locator('[data-app-shell="true"][data-reduce-motion="true"]')).toBeVisible();
  const book = await importTxt(page, "reduced-detail.txt");
  await book.click();
  await expect(page.locator('[data-push-route="book-details"]')).toBeVisible();
  await page.locator('[data-navigation-tab="settings"]').click();
  await expect(page.locator('[data-push-route="book-details"]')).toHaveCount(0);
  await expect(
    page.locator('[data-navigation-root="settings"][aria-hidden="false"]')
  ).toBeVisible();
});
