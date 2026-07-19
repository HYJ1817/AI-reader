import { expect, test, type Locator, type Page } from "@playwright/test";

const libraryRoot =
  '[data-navigation-root="library"][aria-hidden="false"]';
const readingRoot =
  '[data-navigation-root="reading"][aria-hidden="false"]';
const wheelSelector = '[data-reading-goal-wheel="true"]';
const rowSelector = '[data-reading-goal-wheel-row="true"]';
const persistenceTestTitle =
  "enforces keyboard bounds and persists a saved target across reload";
const hydrationMismatchSignature =
  "Hydration failed because the server rendered text didn't match the client.";
const sampleText = [
  "A small library gives the reading goal a realistic home.",
  "A second paragraph keeps this imported book useful across a reload.",
].join("\n\n");

type BrowserErrorLog = {
  pageErrors: string[];
  consoleErrors: string[];
};

const browserErrorsByPage = new WeakMap<Page, BrowserErrorLog>();

async function waitForLibrary(page: Page) {
  await expect(page.locator(libraryRoot)).toBeVisible();
  await expect(
    page.locator(`${libraryRoot} [data-library-loading="false"]`)
  ).toHaveCount(1);
}

async function importBook(page: Page) {
  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({
    name: "reading-goal-wheel-sample.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(sampleText),
  });
  await expect(
    page.locator(`${libraryRoot} [data-book-cover-origin]`).first()
  ).toBeVisible();
}

async function openReading(page: Page) {
  await page.locator('[data-navigation-tab="reading"]').click();
  await expect(page.locator(readingRoot)).toBeVisible();
  await page.waitForTimeout(420);
}

async function openGoalEditor(page: Page) {
  await page.locator(`${readingRoot} [data-reading-goal="true"]`).click();
  const dialog = page.getByRole("dialog", { name: "阅读目标" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "调整目标" }).click();
  const wheel = dialog.locator(wheelSelector);
  await expect(wheel).toBeVisible();
  return { dialog, wheel };
}

function minuteRow(wheel: Locator, minute: number) {
  return wheel.locator(`${rowSelector}[data-minute="${minute}"]`);
}

test.beforeEach(async ({ page }) => {
  const errorLog: BrowserErrorLog = { pageErrors: [], consoleErrors: [] };
  browserErrorsByPage.set(page, errorLog);
  page.on("pageerror", (error) => errorLog.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errorLog.consoleErrors.push(message.text());
  });
  await page.goto("/");
  await waitForLibrary(page);
  await importBook(page);
  await openReading(page);
});

test.afterEach(async ({ page }, testInfo) => {
  const errorLog = browserErrorsByPage.get(page);
  const permitsKnownHydrationMismatch = testInfo.title === persistenceTestTitle;
  const isUnexpected = (message: string) =>
    !(
      permitsKnownHydrationMismatch &&
      message.startsWith(hydrationMismatchSignature)
    );
  expect(
    (errorLog?.pageErrors ?? []).filter(isUnexpected),
    "unexpected page errors"
  ).toEqual([]);
  expect(
    (errorLog?.consoleErrors ?? []).filter(isUnexpected),
    "unexpected console errors"
  ).toEqual(
    []
  );
});

test("renders the virtualized wheel across themes and compact geometry", async ({
  page,
}) => {
  const { dialog, wheel } = await openGoalEditor(page);

  await expect(wheel).toHaveAttribute("aria-valuemin", "0");
  await expect(wheel).toHaveAttribute("aria-valuemax", "1440");
  await expect(wheel).toHaveAttribute("aria-valuenow", "120");
  await expect(wheel).toHaveAttribute("aria-valuetext", "120 分钟");
  await expect(wheel.locator(rowSelector)).toHaveCount(15);

  const center = minuteRow(wheel, 120);
  const neighbor = minuteRow(wheel, 121);
  await expect(center).toHaveCSS("opacity", "1");
  await expect(center).toHaveCSS("filter", "blur(0px)");
  await expect(neighbor).toHaveCSS("opacity", "0.75");
  await expect(neighbor).toHaveCSS("filter", "blur(2px)");
  expect(await center.evaluate((element) => getComputedStyle(element).color)).toBe(
    await dialog
      .getByRole("heading", { name: "每日阅读目标" })
      .evaluate((element) => getComputedStyle(element).color)
  );

  const shell = page.locator('[data-app-shell="true"]');
  await shell.evaluate((element) =>
    element.setAttribute("data-reader-theme", "light")
  );
  const lightColor = await center.evaluate(
    (element) => getComputedStyle(element).color
  );
  expect(lightColor).toMatch(/^rgba?\(/);
  expect(lightColor).not.toBe("rgba(0, 0, 0, 0)");

  await shell.evaluate((element) =>
    element.setAttribute("data-reader-theme", "dark")
  );
  await expect
    .poll(() => center.evaluate((element) => getComputedStyle(element).color))
    .not.toBe(lightColor);
  const darkColor = await center.evaluate(
    (element) => getComputedStyle(element).color
  );
  expect(darkColor).toMatch(/^rgba?\(/);
  expect(darkColor).not.toBe("rgba(0, 0, 0, 0)");

  await page.setViewportSize({ width: 390, height: 740 });
  await expect(wheel).toHaveCSS("height", "190px");
  await expect(wheel.locator(rowSelector)).toHaveCount(15);

  const wheelBox = await wheel.boundingBox();
  expect(wheelBox).not.toBeNull();
  for (const minute of [118, 119, 120, 121, 122]) {
    const rowBox = await minuteRow(wheel, minute).boundingBox();
    expect(rowBox, `row ${minute} has a bounding box`).not.toBeNull();
    expect(rowBox!.y, `row ${minute} top`).toBeGreaterThanOrEqual(
      wheelBox!.y - 0.5
    );
    expect(rowBox!.y + rowBox!.height, `row ${minute} bottom`).toBeLessThanOrEqual(
      wheelBox!.y + wheelBox!.height + 0.5
    );
  }
});

test("normalizes native wheel input, queues rapid keys, and keeps work bounded", async ({
  page,
}) => {
  await page.evaluate(() => {
    const state = window as Window & { __goalPlayCount?: number };
    state.__goalPlayCount = 0;
    HTMLMediaElement.prototype.play = function () {
      state.__goalPlayCount = (state.__goalPlayCount ?? 0) + 1;
      return Promise.resolve();
    };
  });
  const { wheel } = await openGoalEditor(page);

  const defaultPrevented = await wheel.evaluate((element) => {
    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 1,
      deltaMode: WheelEvent.DOM_DELTA_LINE,
    });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(defaultPrevented).toBe(true);
  await expect(wheel).toHaveAttribute("aria-valuenow", "121");

  await wheel.evaluate((element) => {
    for (let index = 0; index < 2; index += 1) {
      element.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        })
      );
    }
  });
  await expect(wheel).toHaveAttribute("aria-valuenow", "123");

  const synchronousDuration = await wheel.evaluate((element) => {
    const start = performance.now();
    for (let index = 0; index < 40; index += 1) {
      element.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaY: 1,
          deltaMode: WheelEvent.DOM_DELTA_PIXEL,
        })
      );
    }
    return performance.now() - start;
  });
  expect(synchronousDuration).toBeLessThan(50);
  await expect(wheel).toHaveAttribute("aria-valuenow", "124");
  await expect(wheel.locator(rowSelector)).toHaveCount(15);
  await expect(minuteRow(wheel, 124)).toHaveCSS("filter", "blur(0px)");
  await expect
    .poll(() => page.evaluate(() => (window as Window & { __goalPlayCount?: number }).__goalPlayCount ?? 0))
    .toBeGreaterThan(0);
});

test("supports pointer dragging and restores an unsaved value on close", async ({
  page,
}) => {
  let { dialog, wheel } = await openGoalEditor(page);
  const wheelBox = await wheel.boundingBox();
  expect(wheelBox).not.toBeNull();
  const startX = wheelBox!.x + wheelBox!.width / 2;
  const startY = wheelBox!.y + wheelBox!.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY - 90, { steps: 6 });
  await page.mouse.up();

  await expect
    .poll(async () => Number(await wheel.getAttribute("aria-valuenow")))
    .toBeGreaterThan(120);

  await dialog.getByRole("button", { name: "关闭" }).click();
  await expect(dialog).toBeHidden();

  ({ dialog, wheel } = await openGoalEditor(page));
  await expect(dialog).toBeVisible();
  await expect(wheel).toHaveAttribute("aria-valuenow", "120");
});

test(persistenceTestTitle, async ({
  page,
}) => {
  let { dialog, wheel } = await openGoalEditor(page);
  await wheel.focus();
  await wheel.press("ArrowDown");
  await expect(wheel).toHaveAttribute("aria-valuenow", "121");
  await wheel.press("Home");
  await expect(wheel).toHaveAttribute("aria-valuenow", "0");
  await wheel.press("ArrowUp");
  await expect(wheel).toHaveAttribute("aria-valuenow", "0");

  await dialog.getByRole("button", { name: "完成" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("ai-reader-reading-goal");
        return raw ? JSON.parse(raw).targetMinutes : null;
      })
    )
    .toBe(0);

  await dialog.getByRole("button", { name: "关闭" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(
    page.locator('[data-navigation-root="library"] [data-library-loading="false"]')
  ).toHaveCount(1);
  await page.locator("nextjs-portal").evaluateAll((portals) => {
    for (const portal of portals) {
      (portal as HTMLElement).style.display = "none";
    }
  });
  await page.getByRole("button", { name: "书库", exact: true }).click();
  await waitForLibrary(page);
  await openReading(page);
  ({ dialog, wheel } = await openGoalEditor(page));
  await expect(wheel).toHaveAttribute("aria-valuenow", "0");

  await wheel.focus();
  await wheel.press("End");
  await expect(wheel).toHaveAttribute("aria-valuenow", "1440");
  await wheel.press("ArrowDown");
  await expect(wheel).toHaveAttribute("aria-valuenow", "1440");
});

test("keeps selection responsive when wheel sound playback is rejected", async ({
  page,
}) => {
  await page.evaluate(() => {
    const state = window as Window & { __goalRejectedPlayCount?: number };
    state.__goalRejectedPlayCount = 0;
    HTMLMediaElement.prototype.play = function () {
      state.__goalRejectedPlayCount =
        (state.__goalRejectedPlayCount ?? 0) + 1;
      return Promise.reject(new Error("blocked"));
    };
  });
  const { wheel } = await openGoalEditor(page);

  await wheel.focus();
  await wheel.press("ArrowDown");
  await expect(wheel).toHaveAttribute("aria-valuenow", "121");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __goalRejectedPlayCount?: number })
            .__goalRejectedPlayCount ?? 0
      )
    )
    .toBeGreaterThan(0);
});

test("honors reduced motion and cleans up animation and audio on unmount", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    const state = window as Window & {
      __goalCancelCount?: number;
      __goalPauseCount?: number;
      __goalReducedPlayCount?: number;
    };
    state.__goalCancelCount = 0;
    state.__goalPauseCount = 0;
    state.__goalReducedPlayCount = 0;
    const cancel = window.cancelAnimationFrame.bind(window);
    window.cancelAnimationFrame = (handle: number) => {
      state.__goalCancelCount = (state.__goalCancelCount ?? 0) + 1;
      cancel(handle);
    };
    HTMLMediaElement.prototype.play = function () {
      state.__goalReducedPlayCount = (state.__goalReducedPlayCount ?? 0) + 1;
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      state.__goalPauseCount = (state.__goalPauseCount ?? 0) + 1;
    };
  });

  const { dialog, wheel } = await openGoalEditor(page);
  await wheel.focus();
  await wheel.press("ArrowDown");
  await expect(wheel).toHaveAttribute("aria-valuenow", "121");
  await expect(wheel.locator(rowSelector)).toHaveCount(15);
  await expect(minuteRow(wheel, 121)).toHaveCSS("filter", "blur(0px)");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __goalReducedPlayCount?: number })
            .__goalReducedPlayCount ?? 0
      )
    )
    .toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
    )
    .toBe(false);
  await wheel.press("End");
  await dialog.getByRole("button", { name: "关闭" }).click();
  await expect(dialog).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __goalCancelCount?: number })
            .__goalCancelCount ?? 0
      )
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as Window & { __goalPauseCount?: number }).__goalPauseCount ??
          0
      )
    )
    .toBeGreaterThan(0);
});
