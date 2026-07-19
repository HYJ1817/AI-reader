import { expect, test, type Page, type TestInfo } from "@playwright/test";

const libraryRoot =
  '[data-navigation-root="library"][aria-hidden="false"]';

const samples = [
  {
    id: "english",
    text: "A quiet room waits beside the window. The reader returns to the same line after every interruption.\n\nA second paragraph keeps ordinary English word spacing on narrow screens.",
  },
  {
    id: "chinese",
    text: "窗边的书页安静地展开，读者每次回来都能找到刚才的位置。\n\n第二段继续验证中文正文在窄屏上的自然节奏。",
  },
  {
    id: "mixed",
    text: "AI Reader 会保留 reading progress，也会让中英文混排保持自然间距。\n\nThe second 段落 verifies a predictable alignment choice.",
  },
] as const;

const longEnglishText = Array.from(
  { length: 24 },
  (_, index) =>
    `Paragraph ${index + 1} keeps a steady reading rhythm while the reader moves through a longer book on a narrow screen.`
).join("\n\n");

async function importAndOpen(page: Page, name: string, text: string) {
  await page.goto("/");
  await expect(page.locator(libraryRoot)).toBeVisible();
  await expect(
    page.locator(`${libraryRoot} [data-library-loading="false"]`)
  ).toHaveCount(1);

  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({
    name: `${name}.txt`,
    mimeType: "text/plain",
    buffer: Buffer.from(text),
  });

  const cover = page
    .locator(`${libraryRoot} [data-book-cover-origin]`)
    .first();
  await expect(cover).toBeVisible();
  await cover.click();
  await expect(page.locator('[data-reader-presented="true"]')).toBeVisible();
  await expect(
    page.locator('[data-reader-presented="true"] > div').first()
  ).toHaveCSS("opacity", "0");
  await page.locator("nextjs-portal").evaluateAll((portals) => {
    for (const portal of portals) {
      (portal as HTMLElement).style.display = "none";
    }
  });
}

async function setReaderMenuExpanded(page: Page, expanded: boolean) {
  const wake = page.locator('[data-reader-menu-toggle="true"]');
  if ((await wake.getAttribute("aria-expanded")) !== String(expanded)) {
    await wake.click();
  }
  await expect(wake).toHaveAttribute("aria-expanded", String(expanded));
  if (expanded) {
    await expect
      .poll(() =>
        wake.evaluate(
          (element) => getComputedStyle(element, "::before").boxShadow
        )
      )
      .not.toBe("none");
  } else {
    await expect
      .poll(() =>
        wake.evaluate((element) => ({
          boxShadow: getComputedStyle(element, "::before").boxShadow,
          iconOpacity: getComputedStyle(element.querySelector("svg")!).opacity,
        }))
      )
      .toEqual({ boxShadow: "none", iconOpacity: "0.38" });
  }
  return wake;
}

for (const sample of samples) {
  test(`${sample.id} TXT keeps natural default alignment`, async ({
    page,
  }, testInfo: TestInfo) => {
    await importAndOpen(page, sample.id, sample.text);
    const reader = page.locator('[data-txt-reader="true"]');
    await expect(reader).toHaveCSS("text-align", "start");
    expect(
      await reader.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).paddingBottom)
      )
    ).toBeGreaterThanOrEqual(96);
    await page.screenshot({
      path: testInfo.outputPath(`${sample.id}-default.png`),
      fullPage: false,
    });
  });
}

test("explicit justification and the menu wake target remain available", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "ai-reader-preferences",
      JSON.stringify({
        theme: "system",
        fontSizePx: 18,
        lineHeight: 1.75,
        contentWidth: 720,
        fontFamily: "default",
        boldText: false,
        customLayoutEnabled: true,
        letterSpacingPercent: 0,
        wordSpacingPercent: 0,
        pageMarginPx: 0,
        justifyText: true,
      })
    );
  });
  await importAndOpen(page, "explicit-justify", samples[0].text);
  await expect(page.locator('[data-txt-reader="true"]')).toHaveCSS(
    "text-align",
    "justify"
  );

  const wake = await setReaderMenuExpanded(page, false);
  expect(
    await wake.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    })
  ).toEqual({ width: 48, height: 48 });
  expect(
    await wake.evaluate((element) => {
      const style = getComputedStyle(element, "::before");
      const iconStyle = getComputedStyle(element.querySelector("svg")!);
      return {
        boxShadow: style.boxShadow,
        top: style.top,
        right: style.right,
        bottom: style.bottom,
        left: style.left,
        iconOpacity: iconStyle.opacity,
      };
    })
  ).toEqual({
    boxShadow: "none",
    top: "9px",
    right: "-6px",
    bottom: "9px",
    left: "32px",
    iconOpacity: "0.38",
  });
  await page.screenshot({
    path: testInfo.outputPath("menu-collapsed.png"),
    fullPage: false,
  });

  await setReaderMenuExpanded(page, true);
  expect(
    await wake.evaluate(
      (element) => getComputedStyle(element, "::before").boxShadow
    )
  ).not.toBe("none");
  await page.screenshot({
    path: testInfo.outputPath("menu-expanded.png"),
    fullPage: false,
  });
});

test("collapsed menu affordance stays quiet in dark reader theme", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "ai-reader-preferences",
      JSON.stringify({
        theme: "dark",
        fontSizePx: 18,
        lineHeight: 1.75,
        contentWidth: 720,
        fontFamily: "default",
        boldText: false,
        customLayoutEnabled: false,
        letterSpacingPercent: 0,
        wordSpacingPercent: 0,
        pageMarginPx: 0,
        justifyText: false,
      })
    );
  });
  await importAndOpen(page, "menu-dark", samples[1].text);
  const wake = await setReaderMenuExpanded(page, false);
  await expect(wake).toHaveCSS("width", "48px");
  await expect(wake).toHaveCSS("height", "48px");
  expect(
    await wake.evaluate(
      (element) => getComputedStyle(element, "::before").boxShadow
    )
  ).toBe("none");
  await page.screenshot({
    path: testInfo.outputPath("menu-collapsed-dark.png"),
    fullPage: false,
  });
});

test("final TXT content scrolls above the collapsed menu affordance", async ({
  page,
}, testInfo) => {
  await importAndOpen(page, "final-content-clearance", longEnglishText);
  const reader = page.locator('[data-txt-reader="true"]');
  await reader.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect
    .poll(() =>
      reader.evaluate(
        (element) =>
          element.scrollHeight - element.clientHeight - element.scrollTop
      )
    )
    .toBeLessThanOrEqual(1);

  const lastParagraph = await reader.locator("p").last().boundingBox();
  const wakeButton = await page
    .locator('[data-reader-menu-toggle="true"]')
    .boundingBox();
  expect(lastParagraph).not.toBeNull();
  expect(wakeButton).not.toBeNull();
  expect(lastParagraph?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(
    wakeButton?.y ?? 0
  );
  expect(
    (lastParagraph?.y ?? 0) + (lastParagraph?.height ?? 0)
  ).toBeLessThanOrEqual((wakeButton?.y ?? 0) - 8);

  await page.screenshot({
    path: testInfo.outputPath("final-content-clearance.png"),
    fullPage: false,
  });
});

test("paged TXT keeps natural alignment and horizontal page flow", async ({
  page,
}, testInfo) => {
  await importAndOpen(page, "paged-default", longEnglishText);
  const wake = await setReaderMenuExpanded(page, true);
  await page.getByRole("button", { name: /主题与设置/ }).click();

  const settingsSheet = page.locator('[data-sheet-route="reader-settings"]');
  await expect(settingsSheet).toBeVisible();
  await settingsSheet.getByRole("button", { name: "阅读方式" }).click();
  await settingsSheet.getByRole("button", { name: /翻页/ }).click();
  await page.keyboard.press("Escape");
  await expect(settingsSheet).toHaveCount(0);
  await wake.click();
  await expect(wake).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.locator('[data-reader-chrome-controls="true"]')
  ).toHaveAttribute("aria-hidden", "true");

  const reader = page.locator('[data-txt-reader="true"]');
  await expect(reader).toHaveCSS("text-align", "start");
  await expect(reader).toHaveCSS("overflow-x", "auto");
  await expect(reader).toHaveCSS("overflow-y", "hidden");
  expect(
    await reader.evaluate(
      (element) => element.scrollWidth > element.clientWidth
    )
  ).toBe(true);

  await page.screenshot({
    path: testInfo.outputPath("paged-default.png"),
    fullPage: false,
  });
});
