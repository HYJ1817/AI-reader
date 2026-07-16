import { expect, test, type Page } from "@playwright/test";
import JSZip from "jszip";

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

async function importNavigationEpub(page: Page, chapterCount: number = 120) {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
      </container>`
  );
  const manifest: string[] = [];
  const spine: string[] = [];
  const navigation: string[] = [];
  for (let chapter = 1; chapter <= chapterCount; chapter += 1) {
    const fileName = `chapter-${chapter}.xhtml`;
    manifest.push(
      `<item id="chapter-${chapter}" href="${fileName}" media-type="application/xhtml+xml"/>`
    );
    spine.push(`<itemref idref="chapter-${chapter}"/>`);
    navigation.push(`<li><a href="${fileName}">第 ${chapter} 章</a></li>`);
    zip.file(
      `OEBPS/${fileName}`,
      `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>第 ${chapter} 章</title></head><body><p>性能诊断正文 ${chapter}</p></body></html>`
    );
  }
  zip.file(
    "OEBPS/content.opf",
    `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">toc-performance</dc:identifier><dc:title>目录性能诊断</dc:title><dc:language>zh-CN</dc:language></metadata>
      <manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${manifest.join("")}</manifest>
      <spine>${spine.join("")}</spine>
    </package>`
  );
  zip.file(
    "OEBPS/nav.xhtml",
    `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>目录</title></head><body><nav epub:type="toc"><ol>${navigation.join("")}</ol></nav></body></html>`
  );
  await page.locator('input[type="file"][accept*=".epub"]').setInputFiles({
    name: "toc-performance.epub",
    mimeType: "application/epub+zip",
    buffer: await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
    }),
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

async function measureFrameCadence(
  page: Page,
  action: () => Promise<void>,
  duration: number = 900
) {
  const metricsPromise = page.evaluate(async (sampleDuration) => {
    const intervals: number[] = [];
    const longTasks: number[] = [];
    let observer: PerformanceObserver | undefined;
    let previous = performance.now();

    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longTasks.push(entry.duration);
      });
      observer.observe({ entryTypes: ["longtask"] });
    }

    const startedAt = performance.now();
    await new Promise<void>((resolve) => {
      const sample = (now: number) => {
        intervals.push(now - previous);
        previous = now;
        if (now - startedAt >= sampleDuration) {
          resolve();
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    observer?.disconnect();
    const sorted = [...intervals].sort((a, b) => a - b);
    return {
      frames: intervals.length,
      maxInterval: Math.max(...intervals),
      p95Interval: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      over33ms: intervals.filter((interval) => interval > 33.4).length,
      maxLongTask: longTasks.length ? Math.max(...longTasks) : 0,
    };
  }, duration);

  await page.waitForTimeout(50);
  await action();
  return metricsPromise;
}

test("contents tab clicks keep 60fps under CPU pressure and native swipes keep pace", async ({
  page,
}) => {
  await page.goto("/");
  await waitForLibrary(page);
  await importNavigationEpub(page);
  await page.locator(`${libraryRoot} [data-book-id]`).first().click();
  await expect(page.locator('[data-reader-presented="true"]')).toBeVisible();
  await openContents(page);
  await expect(page.locator("#toc-panel-chapters li")).toHaveCount(60);
  await expect(
    page.locator('[data-sheet-route="toc"] [data-motion-sheet="panel"]')
  ).toContainText(/第 \d+ 页（共 \d+ 页）/, { timeout: 30_000 });
  await page.waitForTimeout(500);

  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const idleMetrics = await measureFrameCadence(page, async () => {});
  const clickMetrics = await measureFrameCadence(page, async () => {
    await page.locator("#toc-tab-bookmarks").click();
    await expect.poll(() => snappedTabIndex(page)).toBe(1);
  });
  const warmedClickMetrics = await measureFrameCadence(page, async () => {
    await page.locator("#toc-tab-chapters").click();
    await expect.poll(() => snappedTabIndex(page)).toBe(0);
  });
  await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });

  const viewport = page.locator('[data-toc-swipe-viewport="true"]');
  const box = await viewport.boundingBox();
  if (!box) throw new Error("Contents swipe viewport has no bounds");
  const swipeMetrics = await measureFrameCadence(page, async () => {
    await dragTouch(
      page,
      { x: box.x + box.width * 0.92, y: box.y + box.height * 0.45 },
      { x: box.x + box.width * 0.06, y: box.y + box.height * 0.45 }
    );
    await expect.poll(() => snappedTabIndex(page)).toBe(1);
  });
  await session.detach();

  expect(idleMetrics.p95Interval).toBeLessThanOrEqual(20);
  expect(clickMetrics.p95Interval).toBeLessThanOrEqual(20);
  expect(clickMetrics.maxInterval).toBeLessThanOrEqual(34);
  expect(clickMetrics.over33ms).toBeLessThanOrEqual(1);
  expect(clickMetrics.maxLongTask).toBeLessThan(50);
  expect(swipeMetrics.p95Interval).toBeLessThanOrEqual(20);
  expect(swipeMetrics.maxInterval).toBeLessThanOrEqual(50);
  expect(swipeMetrics.over33ms).toBeLessThanOrEqual(1);
  expect(warmedClickMetrics.p95Interval).toBeLessThanOrEqual(20);
});

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
