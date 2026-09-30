import { expect, test, type Page } from "@playwright/test";

const emptyV1 = { version: 1, exportedAt: "2026-09-18T00:00:00Z", books: [], readingPositions: [], annotations: [] };
const backupInput = (page: Page) => page.locator('input[type="file"][accept=".json"]');
async function selectBackup(page: Page, content: unknown = emptyV1) {
  await page.getByRole("button", { name: "导入备份", exact: false }).focus();
  await backupInput(page).setInputFiles({ name: "restore.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(content)) });
}
async function readBooks(page: Page) {
  return page.evaluate(() => new Promise<{ title: string; enrichment?: { status: string } }[]>((resolve, reject) => {
    const request = indexedDB.open("AiReader");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction("books").objectStore("books").getAll();
      read.onsuccess = () => { resolve(read.result); db.close(); };
      read.onerror = () => { reject(read.error); db.close(); };
    };
  }));
}
async function seedBook(page: Page, name = "keep.txt") {
  await page.route("**/api/book-metadata/search", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ candidate: null, score: 0, missing: [] }) }));
  await page.goto("/");
  await expect(page.locator('[data-library-loading="false"]')).toHaveCount(1);
  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from(`内容 ${name}\n\n阅读备份安全测试。`) });
  await expect.poll(async () => (await readBooks(page)).some((book) => book.title === name.replace(".txt", "") && book.enrichment?.status === "failed")).toBe(true);
}

test("backup selection previews without replacing data; cancel and export are non-destructive", async ({ page }) => {
  await seedBook(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await selectBackup(page);
  const dialog = page.getByRole("dialog", { name: "恢复备份确认" });
  await expect(dialog).toContainText("0 本书");
  await expect(dialog).toContainText("1 本书");
  await expect(dialog).toContainText("会清空当前书库");
  await expect(dialog).toContainText("统计与自定义背景保持不变");
  expect(await readBooks(page)).toHaveLength(1);
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "先导出当前备份" }).click();
  await download;
  await expect(dialog).toContainText("下载不会自动开始恢复");
  expect(await readBooks(page)).toHaveLength(1);
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await readBooks(page)).toHaveLength(1);
  await expect(page.getByRole("button", { name: "导入备份", exact: false })).toBeFocused();
});

test("empty backup only replaces library after explicit confirmation and invalid files never open confirmation", async ({ page }) => {
  await seedBook(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await selectBackup(page, { version: 99 });
  await expect(page.locator('[data-navigation-root="settings"]').getByRole("alert")).toContainText("请先更新应用");
  await expect(page.getByRole("dialog", { name: "恢复备份确认" })).toHaveCount(0);
  expect(await readBooks(page)).toHaveLength(1);
  await selectBackup(page);
  await page.getByRole("button", { name: "替换并恢复" }).click();
  await expect(page.getByRole("dialog", { name: "恢复备份确认" })).toHaveCount(0);
  await expect(page.locator('[data-navigation-root="settings"]').getByRole("status")).toContainText("已恢复 0 本图书");
  await expect(page.getByRole("button", { name: "查看书库", exact: true })).toBeVisible();
  expect(await readBooks(page)).toHaveLength(0);
});

test("another tab changing data invalidates an old restore preview", async ({ page, context }) => {
  await seedBook(page);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await selectBackup(page);
  const other = await context.newPage();
  await seedBook(other, "new.txt");
  await page.getByRole("button", { name: "替换并恢复" }).click();
  await expect(page.locator('[data-navigation-root="settings"]').getByRole("alert")).toContainText("预览后发生了变化");
  expect((await readBooks(page)).map((book) => book.title).sort()).toEqual(["keep", "new"]);
  await other.close();
});
