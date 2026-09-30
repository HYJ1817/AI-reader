import { expect, test, type Page } from "@playwright/test";

const input = (page: Page) => page.locator('input[type="file"][accept*=".txt"]');
const books = (page: Page) => page.locator('[data-navigation-root="library"] [data-library-book-open="true"]');
async function importText(page: Page, name: string, text = "第一章\n\n相同文件的完整正文。") {
  await input(page).setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from(text) });
}
test.beforeEach(async ({ page }) => {
  await page.route("**/api/book-metadata/search", (route) => route.fulfill({ json: { candidate: null, score: 0, missing: [] } }));
  await page.goto("/");
  await expect(page.locator('[data-library-loading="false"]')).toHaveCount(1);
});

test("renamed identical files require a choice; same name with changed bytes remains independent", async ({ page }) => {
  await importText(page, "original.txt");
  await expect(books(page)).toHaveCount(1);
  await expect(page.locator('[data-reader-presented="true"]')).toHaveCount(0);
  await expect(page.getByRole("region", { name: "图书导入状态" })).toContainText("已导入");
  await importText(page, "renamed.txt");
  const dialog = page.getByRole("dialog", { name: "导入确认" });
  await expect(dialog).toContainText("已有《original》");
  await expect(books(page)).toHaveCount(1);
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(books(page)).toHaveCount(1);
  await importText(page, "renamed.txt");
  await dialog.getByRole("button", { name: "另存一份" }).click();
  await expect(books(page)).toHaveCount(2);
  await importText(page, "original.txt", "不同字节，保留为独立图书。");
  await expect(books(page)).toHaveCount(3);
  await expect(dialog).toHaveCount(0);
  await importText(page, "third-name.txt");
  await dialog.getByRole("button", { name: "打开已有书籍" }).click();
  await expect(page.locator('[data-push-route="book-details"]')).toBeVisible();
  await expect(books(page)).toHaveCount(3);
});

test("cancelling file reading ignores a late result and permits the next import", async ({ page }) => {
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      const value = await original.call(this);
      if (this.name === "cancel.txt") await new Promise((resolve) => setTimeout(resolve, 1200));
      return value;
    };
  });
  await importText(page, "cancel.txt");
  const status = page.getByRole("region", { name: "图书导入状态" });
  await expect(status).toContainText("正在读取文件");
  await expect(input(page)).toBeDisabled();
  await status.getByRole("button", { name: "取消导入" }).click();
  await importText(page, "keep.txt", "保留的不同文件。");
  await expect(books(page)).toHaveCount(1);
  await page.waitForTimeout(1400);
  await expect(books(page)).toHaveCount(1);
  await expect(books(page)).toContainText("keep");
});

test("a tab can open an existing duplicate imported by another tab", async ({ page, context }) => {
  const other = await context.newPage();
  await other.route("**/api/book-metadata/search", (route) => route.fulfill({ json: { candidate: null, score: 0, missing: [] } }));
  await other.goto("/");
  await expect(other.locator('[data-library-loading="false"]')).toHaveCount(1);
  await importText(page, "shared.txt");
  await expect(books(page)).toHaveCount(1);
  await importText(other, "renamed-shared.txt");
  const dialog = other.getByRole("dialog", { name: "导入确认" });
  await expect(dialog).toContainText("shared");
  await dialog.getByRole("button", { name: "打开已有书籍" }).click();
  await expect(other.locator('[data-push-route="book-details"]')).toBeVisible();
  await expect(other.getByRole("heading", { name: "shared", exact: true })).toBeVisible();
  await expect(books(other)).toHaveCount(1);
  await other.close();
});
