import { expect, test } from "@playwright/test";

for (const count of [0, 1, 3, 5]) {
  test(`${count} tags have one concise hero and descriptions expand accessibly`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const description = count === 5 ? "这段较长的图书简介用于验证展开与收起后仍能保持阅读位置。".repeat(70) : "简短介绍。";
    await page.route("**/api/book-metadata/search", (route) => route.fulfill({ json: { candidate: { source: "open-library", sourceId: "fixture", title: "详情测试", description, subjects: Array.from({ length: count }, (_, index) => `标签${index + 1}`) }, score: 1, missing: [] } }));
    await page.goto("/");
    await expect(page.locator('[data-library-loading="false"]')).toHaveCount(1);
    await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({ name: "details.txt", mimeType: "text/plain", buffer: Buffer.from("独立的测试图书正文。") });
    await page.getByRole("region", { name: "图书导入状态" }).getByRole("button", { name: "查看详情" }).click();
    const details = page.locator('[data-push-route="book-details"]');
    await expect(details.getByRole("heading", { name: "详情测试", exact: true })).toBeVisible();
    const hero = details.locator('[aria-label="标签"]');
    await expect(hero.locator("span")).toHaveCount(Math.min(count, 3));
    const tagsHeading = details.getByRole("heading", { name: "标签", exact: true });
    const expand = details.getByRole("button", { name: "展开简介" });
    if (count <= 3) {
      await expect(tagsHeading).toHaveCount(0);
      await expect(expand).toHaveCount(0);
    } else {
      await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      const viewAll = details.getByRole("button", { name: "查看全部 5 个标签" });
      await viewAll.focus();
      await viewAll.press("Enter");
      await expect(tagsHeading).toBeFocused();
      await expect(tagsHeading).toBeInViewport();
      await expand.scrollIntoViewIfNeeded();
      await expand.focus();
      await expect(expand).toHaveAttribute("aria-expanded", "false");
      await expand.press("Enter");
      const collapse = details.getByRole("button", { name: "收起简介" });
      await expect(collapse).toHaveAttribute("aria-expanded", "true");
      await collapse.scrollIntoViewIfNeeded();
      const top = (await collapse.boundingBox())!.y;
      await collapse.press("Enter");
      await expect(expand).toBeFocused();
      await expect.poll(async () => Math.abs((await expand.boundingBox())!.y - top)).toBeLessThanOrEqual(2);
      expect(await details.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    }
    await page.screenshot({ path: testInfo.outputPath(`details-tags-${count}.png`) });
  });
}
