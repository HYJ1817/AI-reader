import { expect, test, type Page, type TestInfo } from "@playwright/test";

const libraryRoot = '[data-navigation-root="library"][aria-hidden="false"]';

async function waitForLibrary(page: Page) {
  await page.goto("/");
  await expect(page.locator(libraryRoot)).toBeVisible();
  await expect(
    page.locator(`${libraryRoot} [data-library-loading="false"]`)
  ).toHaveCount(1);
}

async function importBook(page: Page) {
  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({
    name: "accessible-library-sample.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Keyboard and enlarged-text accessibility sample."),
  });
  await expect(
    page.locator(`${libraryRoot} [data-book-cover-origin]`).first()
  ).toBeVisible();
}

async function useListMode(page: Page) {
  await page.getByRole("button", { name: "\u5217\u8868" }).click();
  await expect(page.locator(`${libraryRoot} [data-library-book-open="true"]`)).toBeVisible();
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.locator("nextjs-portal").evaluateAll((portals) => {
    for (const portal of portals) (portal as HTMLElement).style.display = "none";
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
}

test.beforeEach(async ({ page }) => {
  await waitForLibrary(page);
  await importBook(page);
});

test("Library list exposes separate keyboard-native open and More actions", async ({
  page,
}, testInfo) => {
  await useListMode(page);
  const open = page.locator(`${libraryRoot} [data-library-book-open="true"]`).first();
  const more = page.locator(`${libraryRoot} [data-library-book-more="true"]`).first();

  await expect(open).toHaveJSProperty("tagName", "BUTTON");
  await expect(more).toHaveJSProperty("tagName", "BUTTON");
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab");
    if (await open.evaluate((element) => element === document.activeElement)) {
      break;
    }
  }
  await expect(open).toBeFocused();
  await expect
    .poll(() => open.evaluate((element) => getComputedStyle(element).outlineStyle))
    .not.toBe("none");
  await capture(page, testInfo, "keyboard-focus");
  await open.press("Enter");
  await expect(page.locator('[data-reader-presented="true"]')).toBeVisible();
  await page.locator('[data-reader-menu-toggle="true"]').click();
  await page.locator('[data-reader-close="true"]').click();

  await more.focus();
  await more.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("frequent Library controls expose 44px hit boxes and pressed semantics", async ({
  page,
}) => {
  const controls = [
    page.getByRole("button", { name: "\u5c01\u9762" }),
    page.getByRole("button", { name: "\u5217\u8868" }),
    page.locator(`${libraryRoot} [data-library-book-more="true"]`).first(),
    page.locator('[data-navigation-tab="library"]'),
  ];

  await controls[0].click();
  await expect(controls[0]).toHaveAttribute("aria-pressed", "true");
  await expect(controls[1]).toHaveAttribute("aria-pressed", "false");
  for (const control of controls) {
    const box = await control.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test("200 percent text keeps the daily path readable without horizontal overflow", async ({
  page,
}, testInfo: TestInfo) => {
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await useListMode(page);

  const bookTitle = page.locator(
    `${libraryRoot} [data-library-book-title="true"]`
  ).first();
  await expect
    .poll(() => bookTitle.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)))
    .toBeGreaterThanOrEqual(30);
  const overflow = await page.evaluate(() => ({
    root: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));
  expect(overflow.root).toBeLessThanOrEqual(1);
  expect(overflow.body).toBeLessThanOrEqual(1);
  await expect(page.locator('[data-navigation-tab="library"]')).toBeVisible();
  await capture(page, testInfo, "text-scale-200");
});

test("keyboard focus remains visible across themes and custom ambience", async ({
  page,
}, testInfo) => {
  await useListMode(page);
  const open = page.locator(
    `${libraryRoot} [data-library-book-open="true"]`
  ).first();
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab");
    if (await open.evaluate((element) => element === document.activeElement)) {
      break;
    }
  }
  await expect(open).toBeFocused();

  for (const theme of ["light", "dark", "sepia"] as const) {
    await page.evaluate((value) => {
      document
        .querySelector('[data-app-shell="true"]')
        ?.setAttribute("data-reader-theme", value);
    }, theme);
    await expect
      .poll(() => open.evaluate((element) => getComputedStyle(element).outlineWidth))
      .toBe("3px");
    await capture(page, testInfo, `focus-${theme}`);
  }

  await page.evaluate(() => {
    const app = document.querySelector('[data-app-shell="true"]');
    app?.setAttribute("data-reader-theme", "light");
    const ambient = document.querySelector<HTMLElement>("[data-custom-active]");
    const layer = ambient?.querySelector<HTMLElement>('[data-layer="current"]');
    ambient?.setAttribute("data-custom-active", "true");
    ambient?.style.setProperty("--ambient-custom-effect", "0.18");
    layer?.setAttribute("data-custom", "true");
    if (layer) {
      layer.style.backgroundImage =
        "linear-gradient(135deg, rgb(44 78 112), rgb(180 118 92))";
      layer.style.opacity = "0.42";
    }
  });
  await capture(page, testInfo, "focus-custom-background");
});
