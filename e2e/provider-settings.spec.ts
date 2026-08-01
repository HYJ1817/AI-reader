import { expect, test, type Page } from "@playwright/test";

async function openProviderList(page: Page) {
  await page.goto("/");
  await expect(
    page.locator('[data-navigation-root="library"][aria-hidden="false"]')
  ).toBeVisible();
  await page.locator('[data-navigation-tab="settings"]').click();
  const settingsRoot = page.locator(
    '[data-navigation-root="settings"][aria-hidden="false"]'
  );
  await settingsRoot.getByRole("button", { name: /AI 服务商/ }).click();
  await expect(page.locator('[data-provider-configure="true"]')).toHaveCount(0);
  return page.locator('[data-provider-add-menu]');
}

test("provider list menu mirrors the native add flow and restores focus", async ({
  page,
}) => {
  await openProviderList(page);

  const menuTrigger = page.getByRole("button", { name: "AI 服务商菜单" });
  await menuTrigger.click();
  const menu = page.locator('[data-provider-add-menu="true"]');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "添加 AI 服务商" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "导入服务商配置" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(menuTrigger).toBeFocused();

  await menuTrigger.click();
  await menu.getByRole("menuitem", { name: "添加 AI 服务商" }).click();
  await expect(page.locator('[data-provider-configure="true"]')).toBeVisible();
});

test("provider configure keeps API credentials, protocol, model source, and retry state explicit", async ({
  page,
}) => {
  await openProviderList(page);
  await page
    .locator('[data-open-provider-configure="true"]')
    .click();

  const configure = page.locator('[data-provider-configure="true"]');
  await configure.getByRole("button", { name: /OpenAI/ }).click();
  const apiKey = configure.locator('input[aria-label="API Key"]');
  await apiKey.fill("sk-test-1234567890");
  await expect(apiKey).toHaveAttribute("type", "password");
  await configure.locator('[data-provider-api-key-toggle="true"]').click();
  await expect(apiKey).toHaveAttribute("type", "text");

  const protocol = configure.getByLabel("API 格式");
  await protocol.selectOption("anthropic-compatible");
  await expect(protocol).toHaveValue("anthropic-compatible");
  await expect(
    configure.locator('[data-provider-api-format="anthropic-compatible"]')
  ).toBeVisible();

  const manualInput = configure.getByPlaceholder(/模型 ID/);
  await manualInput.fill("manual-model");
  await configure.getByRole("button", { name: "添加", exact: true }).click();
  await expect(
    configure.locator('[data-provider-model-source="manual"]')
  ).toHaveCount(1);

  let refreshCalls = 0;
  await page.route("**/api/models", async (route) => {
    refreshCalls += 1;
    if (refreshCalls === 1) {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          error: "rate limited",
          errorCode: "rate-limit",
          retryable: true,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        models: [{ id: "remote-model", label: "Remote model", source: "remote" }],
      }),
    });
  });

  await configure.getByRole("button", { name: "刷新" }).click();
  const refreshError = configure.locator('[data-provider-refresh-error="true"]');
  await expect(refreshError).toHaveAttribute("data-error-code", "rate-limit");
  await expect(refreshError).toHaveAttribute("data-retryable", "true");
  await expect(configure.locator('[data-provider-retry="true"]')).toBeVisible();

  await configure.locator('[data-provider-retry="true"]').click();
  await expect(configure.locator('[data-provider-model-source="remote"]')).toHaveCount(1);
  expect(refreshCalls).toBe(2);

  await configure.getByRole("button", { name: "保存并使用" }).click();
  const providerRow = page.locator('[data-provider-list-row="true"]');
  await expect(providerRow).toHaveAttribute("data-provider-status", "ready");
  await expect(providerRow).toContainText("API Key · sk-t…7890");
});
