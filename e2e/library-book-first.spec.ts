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

async function importBook(page: Page) {
  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({
    name: "library-book-first-sample.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(sampleText),
  });
  await expect(
    page.locator(`${libraryRoot} [data-book-cover-origin]`).first()
  ).toBeVisible();
}

async function seedActiveBook(page: Page) {
  await page.evaluate(async () => {
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
          const book = getRequest.result[0];
          const now = new Date().toISOString();
          books.put({ ...book, lastOpenedAt: now });
          transaction.objectStore("readingPositions").put({
            bookId: book.id,
            locator: "0",
            progressPercent: 42,
            readingMode: "scroll",
            updatedAt: now,
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
  });
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

test("list shelf shows source, recent reading, and semantic progress", async ({
  page,
}, testInfo) => {
  await seedActiveBook(page);
  await page.reload();
  await waitForLibrary(page);
  await page.getByRole("button", { name: "\u5217\u8868" }).click();

  const book = page.locator(
    `${libraryRoot} [data-library-book-state="active"]`
  );
  await expect(book).toBeVisible();
  await expect(book.getByText("本地图书", { exact: true })).toBeVisible();
  await expect(book.getByText("今天阅读", { exact: true })).toBeVisible();
  await expect(book.getByText("已读 42%", { exact: true })).toBeVisible();
  await expect(book.locator('[data-library-book-progress="true"]')).toBeVisible();
  await expect(book.getByText(/\d+\s*(?:KB|MB)/)).toHaveCount(0);
  await capture(page, testInfo, "library-list-active");
});
