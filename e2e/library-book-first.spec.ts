import { expect, test, type Page, type TestInfo } from "@playwright/test";

const libraryRoot =
  '[data-navigation-root="library"][aria-hidden="false"]';
const sampleText = "A book-first library keeps reading context ahead of file metadata.";

async function waitForLibrary(page: Page) {
  await expect(page.locator(libraryRoot)).toBeVisible();
  await expect(
    page.locator(`${libraryRoot} [data-library-loading="false"]`)
  ).toHaveCount(1);
}

async function importBook(
  page: Page,
  name: string = "library-book-first-sample.txt",
  text: string = sampleText
) {
  const covers = page.locator(`${libraryRoot} [data-book-cover-origin]`);
  const previousCount = await covers.count();

  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({
    name,
    mimeType: "text/plain",
    buffer: Buffer.from(text),
  });
  await expect(covers).toHaveCount(previousCount + 1);
  await expect(covers.first()).toBeVisible();
}

async function seedActiveBook(
  page: Page,
  {
    fileName = "library-book-first-sample.txt",
    lastOpenedAt = new Date().toISOString(),
    progressPercent = 42,
  }: {
    fileName?: string;
    lastOpenedAt?: string;
    progressPercent?: number;
  } = {}
) {
  await page.evaluate(async ({ targetFileName, openedAt, progress }) => {
    const request = indexedDB.open("AiReader");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(
          ["books", "readingPositions"],
          "readwrite"
        );
        const books = transaction.objectStore("books");
        const getRequest = books.getAll();
        getRequest.onsuccess = () => {
          const book = getRequest.result.find(
            (candidate) => candidate.fileName === targetFileName
          );
          if (!book) {
            transaction.abort();
            return;
          }
          books.put({ ...book, lastOpenedAt: openedAt });
          transaction.objectStore("readingPositions").put({
            bookId: book.id,
            locator: "0",
            progressPercent: progress,
            readingMode: "scroll",
            updatedAt: openedAt,
          });
        };
        getRequest.onerror = () => reject(getRequest.error);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  }, {
    targetFileName: fileName,
    openedAt: lastOpenedAt,
    progress: progressPercent,
  });
}

async function closeReaderWithControls(page: Page) {
  await page.locator('[data-reader-menu-toggle="true"]').click();
  const closeButton = page.locator('[data-reader-close="true"]');
  await expect(closeButton).toBeVisible();
  await closeButton.click();
}

async function showFeaturedLibrary(page: Page) {
  await importBook(
    page,
    "quiet-companion.txt",
    "A quiet companion remains available on the working shelf."
  );
  await seedActiveBook(page);
  await page.reload();
  await waitForLibrary(page);
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.locator("nextjs-portal").evaluateAll((portals) => {
    for (const portal of portals) (portal as HTMLElement).style.display = "none";
  });
  const cover = page.locator(`${libraryRoot} [data-book-cover-origin]:visible`).first();
  if ((await cover.count()) > 0) {
    await expect
      .poll(() => cover.evaluate((element) => getComputedStyle(element).transform))
      .toBe("none");
  }
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
  await page.waitForTimeout(800);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForLibrary(page);
  await importBook(page);
});

test("grid shelf leads with the unread book instead of file metadata", async ({
  page,
}, testInfo) => {
  await page.getByRole("button", { name: "\u5c01\u9762" }).click();
  const shelf = page.locator(`${libraryRoot} [data-library-shelf="true"]`);
  await expect(shelf).toBeVisible();
  await expect(
    shelf.locator('[data-library-collections="true"]')
  ).toBeVisible();
  await expect(
    shelf.locator('[data-library-book-state="unread"]')
  ).toBeVisible();
  await expect(shelf.getByText("未开始", { exact: true })).toBeVisible();
  await expect(shelf.getByText(/\d+\s*(?:KB|MB)/)).toHaveCount(0);
  await capture(page, testInfo, "library-grid-unread");
});

test("an imported unread book does not create a featured region", async ({
  page,
}) => {
  await expect(
    page.locator(`${libraryRoot} [data-library-featured="true"]`)
  ).toHaveCount(0);
});

test("one active book is featured once above the remaining shelf", async ({
  page,
}, testInfo) => {
  await showFeaturedLibrary(page);

  const featured = page.locator(
    `${libraryRoot} [data-library-featured="true"]`
  );
  await expect(featured).toHaveCount(1);
  await expect(featured).toBeVisible();
  const continuation = featured.getByRole("button", {
    name: /继续阅读/,
  });
  await expect(continuation).toHaveCount(1);
  expect(await continuation.evaluate((element) => element.tagName)).toBe(
    "BUTTON"
  );
  const featuredBookId = await featured
    .locator("[data-book-id]")
    .getAttribute("data-book-id");
  expect(featuredBookId).toBeTruthy();

  const shelf = page.locator(`${libraryRoot} [data-library-shelf="true"]`);
  await expect(
    shelf.locator(`[data-book-id="${featuredBookId}"]`)
  ).toHaveCount(0);
  const remainingBook = shelf.locator("[data-book-id]");
  await expect(remainingBook).toHaveCount(1);
  await expect(
    remainingBook.locator("xpath=ancestor::button[1]")
  ).toHaveAccessibleName(/quiet companion/);
  await capture(page, testInfo, "library-featured-light");
});

test("search and editing restore the complete working shelf", async ({
  page,
}) => {
  await showFeaturedLibrary(page);
  const featured = page.locator(
    `${libraryRoot} [data-library-featured="true"]`
  );
  const shelf = page.locator(`${libraryRoot} [data-library-shelf="true"]`);
  const search = page.getByRole("searchbox", { name: "搜索" });

  await expect(featured).toBeVisible();
  await search.fill("library book first sample");
  await expect(featured).toHaveCount(0);
  const matchingBook = shelf.locator("[data-book-id]");
  await expect(matchingBook).toHaveCount(1);
  await expect(
    matchingBook.locator("xpath=ancestor::button[1]")
  ).toHaveAccessibleName(/library book first sample/);

  await search.fill("");
  await expect(featured).toBeVisible();
  await expect(shelf.locator("[data-book-id]")).toHaveCount(1);

  await page.getByRole("button", { name: "编辑" }).click();
  await expect(featured).toHaveCount(0);
  const selectionBooks = shelf.locator("[data-book-id]");
  await expect(selectionBooks).toHaveCount(2);
  await expect(
    selectionBooks.locator("xpath=ancestor::button[1]").filter({
      hasText: "library book first sample",
    })
  ).toHaveCount(1);
  await expect(
    selectionBooks.locator("xpath=ancestor::button[1]").filter({
      hasText: "quiet companion",
    })
  ).toHaveCount(1);
});

test("featured continuation opens the reader and restores focus on close", async ({
  page,
}) => {
  await showFeaturedLibrary(page);
  const continuation = page
    .locator(`${libraryRoot} [data-library-featured="true"]`)
    .getByRole("button", { name: /继续阅读/ });

  await continuation.click();
  await expect(page.locator('[data-reader-presented="true"]')).toBeVisible();
  await closeReaderWithControls(page);

  await expect(page.locator('[data-reader-presented="true"]')).toHaveCount(0);
  await expect(continuation).toBeFocused();
});

test("featured reading remains legible in the dark theme", async ({
  page,
}, testInfo) => {
  await showFeaturedLibrary(page);
  await page.evaluate(() => {
    localStorage.setItem(
      "ai-reader-preferences",
      JSON.stringify({ theme: "dark" })
    );
  });
  await page.reload();
  await waitForLibrary(page);

  await expect(page.locator('[data-reader-theme="dark"]')).toBeVisible();
  await expect(
    page.locator(`${libraryRoot} [data-library-featured="true"]`)
  ).toBeVisible();
  await capture(page, testInfo, "library-featured-dark");
});

test("list shelf shows source, recent reading, and semantic progress", async ({
  page,
}, testInfo) => {
  await importBook(
    page,
    "active-shelf-sample.txt",
    "An older active book remains represented in the list shelf."
  );
  const now = Date.now();
  await seedActiveBook(page, {
    fileName: "active-shelf-sample.txt",
    lastOpenedAt: new Date(now - 120_000).toISOString(),
    progressPercent: 42,
  });
  await seedActiveBook(page, {
    lastOpenedAt: new Date(now - 60_000).toISOString(),
    progressPercent: 64,
  });
  await page.reload();
  await waitForLibrary(page);
  await page.getByRole("button", { name: "\u5217\u8868" }).click();

  await expect(
    page
      .locator(`${libraryRoot} [data-library-featured="true"]`)
      .getByRole("button", {
        name: /继续阅读.*library book first sample/,
      })
  ).toBeVisible();
  const book = page.locator(
    `${libraryRoot} [data-library-shelf="true"] [data-library-book-state="active"]`
  );
  await expect(book).toBeVisible();
  await expect(book.getByText("本地图书", { exact: true })).toBeVisible();
  await expect(book.getByText("今天阅读", { exact: true })).toBeVisible();
  await expect(book.getByText("已读 42%", { exact: true })).toBeVisible();
  await expect(book.locator('[data-library-book-progress="true"]')).toBeVisible();
  await expect(book.getByText(/\d+\s*(?:KB|MB)/)).toHaveCount(0);
  await capture(page, testInfo, "library-list-active");
});
