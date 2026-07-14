import { expect, test, type Page, type TestInfo } from "@playwright/test";

const libraryRoot =
  '[data-navigation-root="library"][aria-hidden="false"]';
const readingRoot =
  '[data-navigation-root="reading"][aria-hidden="false"]';
const dashboardRoot = `${readingRoot} [data-reading-dashboard-state]`;
const sampleText = [
  "A quiet page waits for the reader.",
  "The next paragraph keeps enough content for a realistic imported book.",
].join("\n\n");

type ReadingSeed = {
  progressPercent?: number;
  secondsRead?: number;
};

async function waitForLibrary(page: Page) {
  await expect(page.locator(libraryRoot)).toBeVisible();
  await expect(
    page.locator(`${libraryRoot} [data-library-loading="false"]`)
  ).toHaveCount(1);
}

async function importBook(page: Page) {
  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({
    name: "reading-dashboard-sample.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(sampleText),
  });
  await expect(
    page.locator(`${libraryRoot} [data-book-cover-origin]`).first()
  ).toBeVisible();
}

async function seedReadingData(page: Page, seed: ReadingSeed) {
  await page.evaluate(async ({ progressPercent, secondsRead }) => {
    const request = indexedDB.open("AiReader");
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    try {
      const bookId = await new Promise<string>((resolve, reject) => {
        const transaction = database.transaction("books", "readonly");
        const keysRequest = transaction.objectStore("books").getAllKeys();
        keysRequest.onsuccess = () => resolve(String(keysRequest.result[0]));
        keysRequest.onerror = () => reject(keysRequest.error);
      });

      const stores = [
        ...(progressPercent !== undefined ? ["readingPositions"] : []),
        ...(secondsRead !== undefined ? ["dailyReadingStats"] : []),
      ];
      if (stores.length === 0) return;

      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(stores, "readwrite");
        const now = new Date();

        if (progressPercent !== undefined) {
          transaction.objectStore("readingPositions").put({
            bookId,
            locator: "0",
            progressPercent,
            readingMode: "scroll",
            updatedAt: now.toISOString(),
          });
        }

        if (secondsRead !== undefined) {
          const date = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0"),
          ].join("-");
          transaction.objectStore("dailyReadingStats").put({
            date,
            secondsRead,
            updatedAt: now.toISOString(),
          });
        }

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  }, seed);
}

async function openReading(page: Page) {
  await page.locator('[data-navigation-tab="reading"]').click();
  await expect(page.locator(readingRoot)).toBeVisible();
  await page.waitForTimeout(420);
}

async function hideDevelopmentChrome(page: Page) {
  await page.locator("nextjs-portal").evaluateAll((portals) => {
    for (const portal of portals) {
      (portal as HTMLElement).style.display = "none";
    }
  });
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await hideDevelopmentChrome(page);
  await page.waitForTimeout(800);
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: false,
    animations: "disabled",
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await waitForLibrary(page);
});

test("empty library prioritizes import and hides progress surfaces", async ({
  page,
}, testInfo) => {
  await openReading(page);

  const dashboard = page.locator(dashboardRoot);
  await expect(dashboard).toHaveAttribute(
    "data-reading-dashboard-state",
    "empty-library"
  );
  await expect(
    dashboard.getByRole("button", { name: "\u5bfc\u5165\u56fe\u4e66" })
  ).toBeVisible();
  await expect(dashboard.locator('[data-reading-primary="true"]')).toHaveCount(1);
  await expect(dashboard.locator('[data-reading-goal="true"]')).toHaveCount(0);
  await expect(dashboard.locator('[data-reading-week="true"]')).toHaveCount(0);

  await capture(page, testInfo, "reading-empty");
});

test("imported unread book offers start reading without an empty chart", async ({
  page,
}, testInfo) => {
  await importBook(page);
  await openReading(page);

  const dashboard = page.locator(dashboardRoot);
  await expect(dashboard).toHaveAttribute(
    "data-reading-dashboard-state",
    "imported-unread"
  );
  await expect(
    dashboard.getByRole("button", { name: /^\u5f00\u59cb\u9605\u8bfb\uff1a/ })
  ).toBeVisible();
  await expect(dashboard.locator('[data-reading-goal="true"]')).toHaveCount(1);
  await expect(dashboard.locator('[data-reading-week="true"]')).toHaveCount(0);
  await expect(dashboard.locator('[class*="libraryProgressTrack"]')).toHaveCount(0);

  await capture(page, testInfo, "reading-unread");
});

test("active book prioritizes continue reading and semantic progress", async ({
  page,
}, testInfo) => {
  await importBook(page);
  await seedReadingData(page, { progressPercent: 42 });
  await page.reload();
  await waitForLibrary(page);
  await openReading(page);

  const dashboard = page.locator(dashboardRoot);
  await expect(dashboard).toHaveAttribute(
    "data-reading-dashboard-state",
    "active-reading"
  );
  await expect(
    dashboard.getByRole("button", { name: /^\u7ee7\u7eed\u9605\u8bfb\uff1a/ })
  ).toBeVisible();
  await expect(dashboard.getByText(/42%/)).toHaveCount(1);
  await expect(dashboard.locator('[data-reading-goal="true"]')).toHaveCount(1);
  await expect(dashboard.locator('[data-reading-week="true"]')).toHaveCount(0);

  await capture(page, testInfo, "reading-active");
});

test("recorded minutes reveal the seven-day summary after the primary action", async ({
  page,
}, testInfo) => {
  await importBook(page);
  await seedReadingData(page, { progressPercent: 42, secondsRead: 3900 });
  await page.reload();
  await waitForLibrary(page);
  await openReading(page);

  const dashboard = page.locator(dashboardRoot);
  await expect(dashboard).toHaveAttribute(
    "data-reading-dashboard-state",
    "populated-week"
  );
  await expect(dashboard.locator('[data-reading-primary="true"]')).toHaveCount(1);
  await expect(dashboard.locator('[data-reading-goal="true"]')).toHaveCount(1);
  await expect(dashboard.locator('[data-reading-week="true"]')).toHaveCount(1);
  await expect(dashboard.getByText(/65\s*\u5206\u949f/)).toBeVisible();
  await expect(
    dashboard.locator('[data-reading-week="true"] [aria-label="65"]')
  ).toBeVisible();

  const surfaceOrder = await dashboard.evaluate((element) =>
    Array.from(
      element.querySelectorAll(
        "[data-reading-primary], [data-reading-goal], [data-reading-week]"
      )
    ).map((node) =>
      node.hasAttribute("data-reading-primary")
        ? "primary"
        : node.hasAttribute("data-reading-goal")
          ? "goal"
          : "week"
    )
  );
  expect(surfaceOrder).toEqual(["primary", "goal", "week"]);

  await capture(page, testInfo, "reading-week");
});
