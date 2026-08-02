import { expect, test } from "@playwright/test";

test("text-entry controls use an inset focus indicator instead of an outer blue box", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-library-loading="false"]').waitFor();
  await page.locator('[data-navigation-tab="settings"]').click();
  await page.getByRole("button", { name: "AI 服务商" }).click();
  await expect(page.locator('[data-push-route="ai-providers"]')).toBeVisible();
  await page.locator('[data-open-provider-configure="true"]').click();

  const form = page.locator('[data-provider-configure="true"]');
  await expect(form).toBeVisible();
  const controls = form.locator(
    'input:not([type="checkbox"]), textarea, select'
  );
  const visibleControlCount = await controls.evaluateAll((elements) =>
    elements.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).length
  );
  expect(visibleControlCount).toBeGreaterThanOrEqual(4);

  for (let index = 0; index < (await controls.count()); index += 1) {
    const control = controls.nth(index);
    if (!(await control.isVisible())) continue;
    await control.focus();
    const material = await control.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        focusVisible: element.matches(":focus-visible"),
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
      };
    });
    expect(material.outlineStyle).toBe("none");
    expect(material.boxShadow).not.toContain("0px 0px 0px 2px");
    if (material.focusVisible) {
      expect(material.boxShadow).toContain("inset");
    }
  }
});
