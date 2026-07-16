import { expect, test, type Page } from "@playwright/test";

const libraryRoot = '[data-navigation-root="library"][aria-hidden="false"]';
const selectedText = "第一段文字支持高亮";

async function waitForLibrary(page: Page) {
  await expect(page.locator(libraryRoot)).toBeVisible();
  await expect(
    page.locator(`${libraryRoot} [data-library-loading="false"]`)
  ).toHaveCount(1);
}

async function importTxtBook(page: Page) {
  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({
    name: "reader-annotations.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      `${selectedText}，并且在重启后仍然保留。\n\n第二段文字用于验证定位和跳转。`
    ),
  });
  await expect(page.locator(`${libraryRoot} [data-book-id]`)).toHaveCount(1);
}

async function openFirstBook(page: Page) {
  await page.locator(`${libraryRoot} [data-book-id]`).first().click();
  await expect(page.locator('[data-reader-presented="true"]')).toBeVisible();
  await expect(page.locator('[data-txt-reader="true"]')).toBeVisible();
}

async function showReaderMenu(page: Page) {
  const toggle = page.locator('[data-reader-menu-toggle="true"]');
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator('[data-reader-chrome-controls="true"]')).toHaveAttribute(
    "aria-hidden",
    "false"
  );
}

async function selectFirstParagraphText(page: Page) {
  await page.locator('[data-paragraph-index="0"]').evaluate(
    (paragraph, length) => {
      const textNode = document
        .createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
        .nextNode();
      const stage = paragraph.closest<HTMLElement>(
        '[data-navigation-gesture-owner="reader"]'
      );
      if (!textNode || !stage) throw new Error("TXT paragraph is not selectable");

      stage.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          clientX: 80,
          clientY: 180,
          pointerId: 1,
          pointerType: "touch",
        })
      );
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, Math.min(length, textNode.textContent?.length ?? 0));
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      stage.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          clientX: 80,
          clientY: 180,
          pointerId: 1,
          pointerType: "touch",
        })
      );
    },
    selectedText.length
  );
}

async function openContents(page: Page) {
  await showReaderMenu(page);
  await page.locator('[data-reader-contents="true"]').click();
  await expect(page.locator('#toc-tab-bookmarks')).toBeVisible();
}

async function dragTouch(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps: number = 14
) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: from.x, y: from.y, radiusX: 2, radiusY: 2 }],
    });
    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: from.x + (to.x - from.x) * progress,
            y: from.y + (to.y - from.y) * progress,
            radiusX: 2,
            radiusY: 2,
          },
        ],
      });
      await page.waitForTimeout(10);
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }
}

async function snappedTabIndex(page: Page): Promise<number> {
  return page.locator('[data-toc-swipe-viewport="true"]').evaluate((viewport) =>
    Math.round(viewport.scrollLeft / Math.max(1, viewport.clientWidth))
  );
}

test("contents tabs keep their height and follow native horizontal swipes", async ({
  page,
}) => {
  await page.goto("/");
  await waitForLibrary(page);
  await importTxtBook(page);
  await openFirstBook(page);
  await openContents(page);

  const sheet = page.locator(
    '[data-sheet-route="toc"] [data-motion-sheet="panel"]'
  );
  const viewport = page.locator('[data-toc-swipe-viewport="true"]');
  const initialHeight = await sheet.evaluate(
    (element) => element.getBoundingClientRect().height
  );

  await page.locator("#toc-tab-bookmarks").click();
  await expect(page.locator("#toc-tab-bookmarks")).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect.poll(() => snappedTabIndex(page)).toBe(1);
  expect(
    await sheet.evaluate((element) => element.getBoundingClientRect().height)
  ).toBeCloseTo(initialHeight, 2);

  const box = await viewport.boundingBox();
  if (!box) throw new Error("Contents swipe viewport has no bounds");
  await dragTouch(
    page,
    { x: box.x + box.width * 0.92, y: box.y + box.height * 0.45 },
    { x: box.x + box.width * 0.06, y: box.y + box.height * 0.45 }
  );
  await expect(page.locator("#toc-tab-highlights")).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect.poll(() => snappedTabIndex(page)).toBe(2);

  await page.locator("#toc-tab-chapters").click();
  await page.locator("#toc-tab-bookmarks").click();
  await page.locator("#toc-tab-highlights").click();
  await expect(page.locator("#toc-tab-highlights")).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect.poll(() => snappedTabIndex(page)).toBe(2);
});

test("TXT bookmarks and three-color highlights persist, navigate, and delete", async ({
  page,
}) => {
  await page.goto("/");
  await waitForLibrary(page);
  await importTxtBook(page);
  await openFirstBook(page);

  await showReaderMenu(page);
  await page.locator('[data-reader-bookmark-toggle="true"]').click();

  await selectFirstParagraphText(page);
  await expect(page.locator('[data-highlight-color="green"]')).toBeVisible();
  await page.locator('button[data-highlight-color="green"]').click();
  const highlight = page.locator(
    'mark[data-highlight-color="green"][data-annotation-id]'
  );
  await expect(highlight).toHaveText(selectedText);

  await page.locator('[data-reader-close="true"]').click();
  await expect(page.locator('[data-reader-presented="true"]')).toHaveCount(0);
  await page.reload();
  await waitForLibrary(page);
  await openFirstBook(page);
  await expect(highlight).toHaveText(selectedText);

  await openContents(page);
  await page.locator('#toc-tab-bookmarks').click();
  await expect(page.locator('[data-annotation-kind="bookmark"]')).toHaveCount(1);

  await page.locator('#toc-tab-highlights').click();
  const highlightRow = page.locator('[data-annotation-kind="highlight"]');
  await expect(highlightRow).toHaveCount(1);
  await highlightRow.locator('[data-annotation-jump="true"]').click();
  await expect(highlight).toBeInViewport();

  await openContents(page);
  await page.locator('#toc-tab-highlights').click();
  await page
    .locator('[data-annotation-kind="highlight"] [data-annotation-delete="true"]')
    .click();
  await expect(page.locator('[data-annotation-kind="highlight"]')).toHaveCount(0);
  await expect(page.locator('mark[data-annotation-id]')).toHaveCount(0);

  await page.locator('#toc-tab-bookmarks').click();
  await page
    .locator('[data-annotation-kind="bookmark"] [data-annotation-delete="true"]')
    .click();
  await expect(page.locator('[data-annotation-kind="bookmark"]')).toHaveCount(0);
});

test("imports a TXT book when randomUUID is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.crypto, "randomUUID", {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto("/");
  await waitForLibrary(page);
  await importTxtBook(page);
  await expect(page.locator(`${libraryRoot} [data-book-id]`).first()).toBeVisible();
});
