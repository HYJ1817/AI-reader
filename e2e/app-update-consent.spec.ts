import { expect, test } from "@playwright/test";

test("build discovery never reloads; snooze persists per candidate and settings retains explicit update", async ({ page }) => {
  let candidate = "acceptance-build-two";
  await page.route("**/BUILD_ID", (route) => route.fulfill({ body: candidate, contentType: "text/plain" }));
  await page.goto("/");
  const notice = page.getByRole("complementary", { name: "应用更新" });
  await expect(notice).toBeVisible();
  const marker = await page.evaluate(() => {
    const value = crypto.randomUUID();
    Object.assign(window, { updateAcceptanceMarker: value });
    return value;
  });
  await notice.getByRole("button", { name: "稍后" }).click();
  await expect(notice).toHaveCount(0);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    navigator.serviceWorker.dispatchEvent(new Event("controllerchange"));
  });
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "updateAcceptanceMarker"))).toBe(marker);
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const settings = page.locator('[data-navigation-root="settings"]');
  await expect(settings.getByRole("button", { name: "立即更新" })).toBeVisible();
  await page.getByRole("button", { name: "书库", exact: true }).click();
  await expect(notice).toHaveCount(0);
  candidate = "acceptance-build-three";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(notice).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "updateAcceptanceMarker"))).toBe(marker);
  const navigation = page.waitForEvent("framenavigated", { predicate: (frame) => frame === page.mainFrame() });
  await notice.getByRole("button", { name: "立即更新" }).click();
  await navigation;
  expect(await page.evaluate(() => Reflect.get(window, "updateAcceptanceMarker"))).toBeUndefined();
});

test("a failed final save prevents reload and an explicit retry can succeed", async ({ page }) => {
  await page.route("**/BUILD_ID", (route) => route.fulfill({ body: "acceptance-failed-save", contentType: "text/plain" }));
  await page.goto("/");
  const notice = page.getByRole("complementary", { name: "应用更新" });
  await expect(notice).toBeVisible();
  await page.evaluate(() => {
    const listener = (event: Event) => {
      (event as CustomEvent<{ waitUntil: (promise: Promise<void>) => void }>).detail.waitUntil(Promise.reject(new Error("storage-full")));
      window.removeEventListener("ai-reader-before-reload", listener);
    };
    window.addEventListener("ai-reader-before-reload", listener);
    Object.assign(window, { updateAcceptanceMarker: "unchanged" });
  });
  await notice.getByRole("button", { name: "立即更新" }).click();
  await expect(notice.getByRole("alert")).toContainText("当前页面已保留");
  expect(await page.evaluate(() => Reflect.get(window, "updateAcceptanceMarker"))).toBe("unchanged");
  const navigation = page.waitForEvent("framenavigated", { predicate: (frame) => frame === page.mainFrame() });
  await notice.getByRole("button", { name: "立即更新" }).click();
  await navigation;
  expect(await page.evaluate(() => Reflect.get(window, "updateAcceptanceMarker"))).toBeUndefined();
});

test("an explicit update reloads only its requesting tab", async ({ page }) => {
  const secondTab = await page.context().newPage();
  for (const tab of [page, secondTab]) {
    await tab.route("**/BUILD_ID", (route) => route.fulfill({ body: "two-tab-candidate", contentType: "text/plain" }));
  }
  await Promise.all([page.goto("/"), secondTab.goto("/")]);
  const firstNotice = page.getByRole("complementary", { name: "应用更新" });
  const secondNotice = secondTab.getByRole("complementary", { name: "应用更新" });
  await expect(firstNotice).toBeVisible();
  await expect(secondNotice).toBeVisible();
  const secondMarker = await secondTab.evaluate(() => {
    const value = crypto.randomUUID();
    Object.assign(window, { twoTabUpdateMarker: value });
    return value;
  });

  const navigation = page.waitForEvent("framenavigated", { predicate: (frame) => frame === page.mainFrame() });
  await firstNotice.getByRole("button", { name: "立即更新" }).click();
  await navigation;

  expect(await secondTab.evaluate(() => Reflect.get(window, "twoTabUpdateMarker"))).toBe(secondMarker);
  await expect(secondNotice).toBeVisible();
});
