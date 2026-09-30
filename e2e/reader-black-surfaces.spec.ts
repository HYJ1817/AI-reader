import { expect, test } from "@playwright/test";

for (const theme of ["dark", "system", "light", "sepia"] as const) {
  test(`${theme} reader keeps theme-scoped opaque controls`, async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.addInitScript((value) => {
      localStorage.setItem("ai-reader-preferences", JSON.stringify({ theme: value }));
    }, theme);
    await page.route("**/api/book-metadata/search", (route) => route.fulfill({ json: { candidate: null, score: 0, missing: [] } }));
    await page.goto("/");
    await expect(page.locator('[data-library-loading="false"]')).toHaveCount(1);
    const libraryBackground = await page.locator('[data-app-shell="true"]').evaluate((element) => getComputedStyle(element).getPropertyValue("--background").trim());
    await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({ name: `${theme}.txt`, mimeType: "text/plain", buffer: Buffer.from("长正文验证按钮下方不透字。\n\n".repeat(150)) });
    await page.getByRole("region", { name: "图书导入状态" }).getByRole("button", { name: "查看详情" }).click();
    await page.locator('[data-book-details-read="true"]').click();
    const reader = page.locator('[data-reader-presented="true"]');
    await expect(reader).toBeVisible();
    const wake = reader.locator('[data-reader-menu-toggle="true"]');
    if ((await wake.getAttribute("aria-expanded")) !== "true") await wake.click();
    const menu = reader.locator('[data-reader-contents="true"]');
    const close = reader.locator('[data-reader-close="true"]');
    await expect(menu).toBeVisible();
    const dark = theme === "dark" || theme === "system";
    for (const control of [menu, close]) {
      if (dark) await expect(control).toHaveCSS("background-color", "rgb(0, 0, 0)");
      else await expect(control).not.toHaveCSS("background-color", "rgb(0, 0, 0)");
    }
    if (dark) expect(await wake.evaluate((element) => getComputedStyle(element, "::before").backgroundColor)).toBe("rgb(0, 0, 0)");
    await expect(reader.getByRole("button", { name: "主题与设置" })).not.toContainText("大小");
    if (dark) await expect(reader).toHaveCSS("background-color", "rgb(0, 0, 0)");
    await page.screenshot({ path: testInfo.outputPath(`reader-${theme}-expanded.png`) });
    const box = (await menu.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    if (dark) await expect(menu).toHaveCSS("background-color", "rgb(0, 0, 0)");
    await page.screenshot({ path: testInfo.outputPath(`reader-${theme}-pressed.png`) });
    await page.mouse.move(1, 1);
    await page.mouse.up();
    expect(await page.locator('[data-app-shell="true"]').evaluate((element) => getComputedStyle(element).getPropertyValue("--background").trim())).toBe(libraryBackground);
  });
}
