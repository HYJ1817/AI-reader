import { readFileSync } from "node:fs";
import path from "node:path";
import {
  expect,
  test,
  type Page,
  type TestInfo,
} from "@playwright/test";
import JSZip from "jszip";
import {
  attachInteractionMetrics,
  collectInteractionMetrics,
  expectInteractionBudget,
} from "./helpers/interactionMetrics";

type PushRoute =
  | "collections"
  | "ai-providers"
  | "ai-provider-configure"
  | "custom-background";

type SheetRoute =
  | "reader-settings"
  | "reader-custom-settings"
  | "toc"
  | "ask-ai"
  | "reading-goal"
  | "book-actions"
  | "book-rename"
  | "book-delete"
  | "book-groups"
  | "batch-groups"
  | "batch-delete"
  | "collection-create";

type ProviderTransitionMetrics = {
  clickToMount: number;
  frames: number;
  p95: number;
  maxInterval: number;
  maxLongTask: number;
  layoutShift: number;
  motion: ProviderMotionSnapshot;
};

type ProviderMotionSnapshot = {
  incomingX: number;
  incomingOpacity: number;
  previousX: number;
  previousOpacity: number;
  shadow: string;
  profile: string | null;
};

type ProviderTransitionMeasurementState = {
  clickedAt: number | null;
  mountedAt: number | null;
  intervals: number[];
  longTasks: number[];
  layoutShift: number;
  motion: ProviderMotionSnapshot | null;
  complete: boolean;
  cleanup: () => void;
};

type ProviderBackMotionMetrics = {
  frames: number;
  maxX: number;
  minOpacity: number;
};

const sampleText = readFileSync(
  path.resolve(process.cwd(), "e2e/fixtures/sample.txt"),
  "utf8"
);

async function buildReaderGestureEpub(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
      <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
        <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
      </container>`
  );
  const chapters = [1, 2, 3].map((chapter) => {
    const paragraphs = Array.from(
      { length: 36 },
      (_, index) =>
        `<p>Reader gesture chapter ${chapter}, paragraph ${index + 1}. Horizontal input belongs to EPUB pagination.</p>`
    ).join("");
    zip.file(
      `OEBPS/chapter-${chapter}.xhtml`,
      `<?xml version="1.0" encoding="utf-8"?>
        <html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter ${chapter}</title></head>
        <body><h1>Chapter ${chapter}</h1>${paragraphs}</body></html>`
    );
    return chapter;
  });
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="utf-8"?>
      <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:identifier id="book-id">reader-gesture-epub</dc:identifier>
          <dc:title>Reader Gesture EPUB</dc:title><dc:language>en</dc:language>
        </metadata>
        <manifest>
          <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
          ${chapters.map((chapter) => `<item id="chapter-${chapter}" href="chapter-${chapter}.xhtml" media-type="application/xhtml+xml"/>`).join("")}
        </manifest>
        <spine>${chapters.map((chapter) => `<itemref idref="chapter-${chapter}"/>`).join("")}</spine>
      </package>`
  );
  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="utf-8"?>
      <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
        <body><nav epub:type="toc"><ol>${chapters.map((chapter) => `<li><a href="chapter-${chapter}.xhtml">Chapter ${chapter}</a></li>`).join("")}</ol></nav></body>
      </html>`
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
const libraryRootSelector =
  '[data-navigation-root="library"][aria-hidden="false"]';
const settingsRootSelector =
  '[data-navigation-root="settings"][aria-hidden="false"]';
const primaryNavigationName = /\u4e3b\u8981\u5bfc\u822a/;

function wcagContrastRatio(foreground: string, background: string) {
  const relativeLuminance = (rgb: string) => {
    const channels = rgb.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (!channels || channels.length !== 3) {
      throw new Error(`Expected an RGB color, received: ${rgb}`);
    }
    const [red, green, blue] = channels.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };

  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

async function importBook(
  page: Page,
  fileName: string = "native-navigation-sample.txt"
) {
  const covers = page.locator(
    `${libraryRootSelector} [data-book-cover-origin]`
  );
  const previousCount = await covers.count();

  await page
    .locator('input[type="file"][accept*=".txt"]')
    .setInputFiles({
      name: fileName,
      mimeType: "text/plain",
      buffer: Buffer.from(sampleText),
    });

  await expect(covers).toHaveCount(previousCount + 1);
}

function firstLibraryCover(page: Page) {
  return page
    .locator(`${libraryRootSelector} [data-book-cover-origin]`)
    .first();
}

async function useLibraryListMode(page: Page) {
  await page.getByRole("button", { name: "\u5217\u8868" }).click();
  await expect(
    page.locator(
      `${libraryRootSelector} [data-library-book-open="true"]`
    ).first()
  ).toBeVisible();
}

async function openReader(page: Page) {
  await firstLibraryCover(page).click();
  await expect(page.locator('[data-reader-presented="true"]')).toBeVisible();
}

async function closeReaderWithControls(page: Page) {
  const menuToggle = page.locator('[data-reader-menu-toggle="true"]');
  if ((await menuToggle.getAttribute("aria-expanded")) !== "true") {
    await menuToggle.click();
  }
  const closeButton = page.locator('[data-reader-close="true"]');
  await expect(closeButton).toBeVisible();
  await closeButton.click();
}

async function openCollections(page: Page) {
  await page
    .locator(libraryRootSelector)
    .getByRole("button", { name: /\u85cf\u4e66/ })
    .first()
    .click();
  await expect(page.locator('[data-push-route="collections"]')).toBeVisible();
}

async function openAiProviderList(page: Page) {
  const navigation = page.getByRole("navigation", {
    name: primaryNavigationName,
  });
  await navigation.locator('[data-navigation-tab="settings"]').click();
  await expect(page.locator(settingsRootSelector)).toBeVisible();
  await page
    .locator(settingsRootSelector)
    .getByRole("button", { name: /AI 服务商/ })
    .click();
  await expect(page.locator('[data-push-route="ai-providers"]')).toBeVisible();
}

async function waitForHorizontalSettle(page: Page, selector: string) {
  await expect
    .poll(async () =>
      page.locator(selector).evaluate((element) => {
        const transform = getComputedStyle(element).transform;
        return transform === "none"
          ? 0
          : new DOMMatrixReadOnly(transform).m41;
      })
    )
    .toBeLessThanOrEqual(1);
}

async function waitForVerticalSettle(page: Page, selector: string) {
  await expect
    .poll(async () =>
      page.locator(selector).evaluate((element) => {
        const transform = getComputedStyle(element).transform;
        return transform === "none"
          ? 0
          : new DOMMatrixReadOnly(transform).m42;
      })
    )
    .toBeLessThanOrEqual(1);
}

async function collectProviderTransitionMetrics(
  page: Page,
  trigger: () => Promise<void>
): Promise<ProviderTransitionMetrics> {
  await page.evaluate(() => {
    const measurementWindow = window as typeof window & {
      __providerTransitionMeasurement?: ProviderTransitionMeasurementState;
    };
    measurementWindow.__providerTransitionMeasurement?.cleanup();

    if (
      !PerformanceObserver.supportedEntryTypes.includes("longtask") ||
      !PerformanceObserver.supportedEntryTypes.includes("layout-shift")
    ) {
      throw new Error("Required PerformanceObserver entry type is unavailable");
    }

    const triggerElement = document.querySelector(
      '[data-open-provider-configure="true"]'
    );
    if (!(triggerElement instanceof HTMLElement)) {
      throw new Error("Provider configure trigger is unavailable");
    }

    let previous = performance.now();
    let animationFrame = 0;
    const state: ProviderTransitionMeasurementState = {
      clickedAt: null,
      mountedAt: null,
      intervals: [],
      longTasks: [],
      layoutShift: 0,
      motion: null,
      complete: false,
      cleanup: () => undefined,
    };

    const longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        state.longTasks.push(entry.duration);
      }
    });
    const layoutShiftObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        state.layoutShift += (entry as PerformanceEntry & { value: number }).value;
      }
    });
    const mountObserver = new MutationObserver(() => {
      if (state.clickedAt === null || state.mountedAt !== null) return;
      const incoming = document.querySelector(
        '[data-push-route="ai-provider-configure"]'
      );
      const previous = document.querySelector(
        '[data-push-route="ai-providers"]'
      );
      if (!(incoming instanceof HTMLElement) || !(previous instanceof HTMLElement)) {
        return;
      }

      state.mountedAt = performance.now();

      const readX = (element: HTMLElement) => {
        const transform = getComputedStyle(element).transform;
        return transform === "none"
          ? 0
          : new DOMMatrixReadOnly(transform).m41;
      };
      const incomingStyle = getComputedStyle(incoming);
      const previousStyle = getComputedStyle(previous);
      state.motion = {
        incomingX: readX(incoming),
        incomingOpacity: Number.parseFloat(incomingStyle.opacity),
        previousX: readX(previous),
        previousOpacity: Number.parseFloat(previousStyle.opacity),
        shadow: incomingStyle.boxShadow,
        profile: incoming.getAttribute("data-push-motion"),
      };
    });

    function handleClick() {
      if (state.clickedAt !== null) return;
      state.clickedAt = performance.now();
      previous = state.clickedAt;

      const sample = (now: number) => {
        state.intervals.push(now - previous);
        previous = now;
        if (now - state.clickedAt! < 700) {
          animationFrame = requestAnimationFrame(sample);
          return;
        }
        state.complete = true;
      };
      animationFrame = requestAnimationFrame(sample);
    }

    state.cleanup = () => {
      triggerElement.removeEventListener("click", handleClick, true);
      mountObserver.disconnect();
      longTaskObserver.disconnect();
      layoutShiftObserver.disconnect();
      cancelAnimationFrame(animationFrame);
    };
    measurementWindow.__providerTransitionMeasurement = state;
    longTaskObserver.observe({ entryTypes: ["longtask"] });
    layoutShiftObserver.observe({ entryTypes: ["layout-shift"] });
    mountObserver.observe(document.body, { childList: true, subtree: true });
    triggerElement.addEventListener("click", handleClick, true);
  });

  try {
    await trigger();
    await page.waitForFunction(
      () =>
        Boolean(
          (
            window as typeof window & {
              __providerTransitionMeasurement?: ProviderTransitionMeasurementState;
            }
          ).__providerTransitionMeasurement?.complete
        ),
      undefined,
      { timeout: 1500 }
    );

    return await page.evaluate(() => {
      const measurementWindow = window as typeof window & {
        __providerTransitionMeasurement?: ProviderTransitionMeasurementState;
      };
      const state = measurementWindow.__providerTransitionMeasurement;
      if (
        !state ||
        state.clickedAt === null ||
        state.mountedAt === null ||
        state.motion === null
      ) {
        throw new Error(
          `Incomplete provider transition measurement (clicked=${state?.clickedAt !== null}, mounted=${state?.mountedAt !== null}, motion=${state?.motion !== null})`
        );
      }

      const sorted = [...state.intervals].sort((a, b) => a - b);
      const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
      const metrics = {
        clickToMount: state.mountedAt - state.clickedAt,
        frames: state.intervals.length,
        p95: sorted[p95Index] ?? 0,
        maxInterval: Math.max(...state.intervals),
        maxLongTask:
          state.longTasks.length > 0 ? Math.max(...state.longTasks) : 0,
        layoutShift: state.layoutShift,
        motion: state.motion,
      };
      state.cleanup();
      delete measurementWindow.__providerTransitionMeasurement;
      return metrics;
    });
  } catch (error) {
    await page.evaluate(() => {
      const measurementWindow = window as typeof window & {
        __providerTransitionMeasurement?: ProviderTransitionMeasurementState;
      };
      measurementWindow.__providerTransitionMeasurement?.cleanup();
      delete measurementWindow.__providerTransitionMeasurement;
    });
    throw error;
  }
}

async function collectProviderBackMotionMetrics(
  page: Page,
  trigger: () => Promise<void>
): Promise<ProviderBackMotionMetrics> {
  await page.evaluate(() => {
    const measurementWindow = window as typeof window & {
      __providerBackMotionMeasurement?: {
        xs: number[];
        opacities: number[];
        complete: boolean;
      };
    };
    const state = {
      xs: [] as number[],
      opacities: [] as number[],
      complete: false,
    };
    measurementWindow.__providerBackMotionMeasurement = state;
    const startedAt = performance.now();

    const sample = (now: number) => {
      const surface = document.querySelector(
        '[data-push-route="ai-provider-configure"]'
      );
      if (surface instanceof HTMLElement) {
        const style = getComputedStyle(surface);
        const transform = style.transform;
        state.xs.push(
          transform === "none"
            ? 0
            : new DOMMatrixReadOnly(transform).m41
        );
        state.opacities.push(Number.parseFloat(style.opacity));
      }
      if (now - startedAt < 600) {
        requestAnimationFrame(sample);
        return;
      }
      state.complete = true;
    };
    requestAnimationFrame(sample);
  });

  await trigger();
  await page.waitForFunction(
    () =>
      Boolean(
        (
          window as typeof window & {
            __providerBackMotionMeasurement?: { complete: boolean };
          }
        ).__providerBackMotionMeasurement?.complete
      ),
    undefined,
    { timeout: 1_500 }
  );

  return page.evaluate(() => {
    const measurementWindow = window as typeof window & {
      __providerBackMotionMeasurement?: {
        xs: number[];
        opacities: number[];
      };
    };
    const state = measurementWindow.__providerBackMotionMeasurement;
    delete measurementWindow.__providerBackMotionMeasurement;
    if (!state || state.xs.length === 0 || state.opacities.length === 0) {
      throw new Error("Provider back motion did not produce frame samples");
    }
    return {
      frames: state.xs.length,
      maxX: Math.max(...state.xs),
      minOpacity: Math.min(...state.opacities),
    };
  });
}

async function injectPush(
  page: Page,
  route: PushRoute,
  entityId?: string
) {
  await page.evaluate(
    ({ nextRoute, nextEntityId }) => {
      const payload = window.history.state;
      if (
        !payload ||
        payload.app !== "ai-reader" ||
        payload.version !== 1 ||
        !payload.state
      ) {
        throw new Error("AI Reader navigation history is not initialized");
      }

      const state = payload.state;
      const revision = Number(state.revision) + 1;
      const entry = {
        key: `e2e-push-${nextRoute}-${revision}`,
        kind: "push",
        route: nextRoute,
        ...(nextEntityId ? { entityId: nextEntityId } : {}),
      };
      const nextPayload = {
        app: "ai-reader",
        version: 1,
        state: {
          ...state,
          pushes: [...state.pushes, entry],
          sheets: [],
          direction: "forward",
          revision,
        },
      };

      window.history.pushState(nextPayload, "");
      window.dispatchEvent(
        new PopStateEvent("popstate", { state: nextPayload })
      );
    },
    { nextRoute: route, nextEntityId: entityId }
  );
}

async function injectSheet(
  page: Page,
  route: SheetRoute,
  entityId?: string
) {
  await page.evaluate(
    ({ nextRoute, nextEntityId }) => {
      const payload = window.history.state;
      if (
        !payload ||
        payload.app !== "ai-reader" ||
        payload.version !== 1 ||
        !payload.state
      ) {
        throw new Error("AI Reader navigation history is not initialized");
      }

      const state = payload.state;
      const revision = Number(state.revision) + 1;
      const entry = {
        key: `e2e-sheet-${nextRoute}-${revision}`,
        kind: "sheet",
        route: nextRoute,
        ...(nextEntityId ? { entityId: nextEntityId } : {}),
      };
      const nextPayload = {
        app: "ai-reader",
        version: 1,
        state: {
          ...state,
          sheets: [...state.sheets, entry],
          direction: "forward",
          revision,
        },
      };

      window.history.pushState(nextPayload, "");
      window.dispatchEvent(
        new PopStateEvent("popstate", { state: nextPayload })
      );
    },
    { nextRoute: route, nextEntityId: entityId }
  );
}

async function dismissHistoryEntry(page: Page, selector: string) {
  await page.evaluate(() => window.history.back());
  await expect(page.locator(selector)).toHaveCount(0);
}

async function dragTouch(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps: number = 12
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
      await page.waitForTimeout(12);
    }

    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }
}

async function capture(
  page: Page,
  testInfo: TestInfo,
  name: string
) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: false,
  });
}

async function hideNextDevIndicator(page: Page) {
  await page.locator("nextjs-portal").evaluateAll((elements) => {
    for (const element of elements) {
      (element as HTMLElement).style.display = "none";
    }
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const timestamp = "2026-07-13T00:00:00.000Z";
    localStorage.setItem(
      "ai-reader-ai-provider-settings",
      JSON.stringify({
        activeProviderId: "e2e-provider",
        providers: [
          {
            id: "e2e-provider",
            kind: "custom",
            protocol: "openai-compatible",
            label: "E2E Provider",
            baseUrl: "https://example.invalid",
            apiKey: "e2e-key",
            model: "e2e-model",
            models: [
              { id: "e2e-model", label: "E2E Model", source: "manual" },
            ],
            appendDefaultPath: false,
            defaultPath: "/v1",
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
      })
    );
  });

  await page.goto("/");
  await expect(page.locator(libraryRootSelector)).toBeVisible();
  await expect(
    page.locator(`${libraryRootSelector} [data-library-loading="false"]`)
  ).toHaveCount(1);
  await importBook(page);
});

test("reader closes back to its source action and restores focus", async ({
  page,
}) => {
  const cover = firstLibraryCover(page);
  const originId = await cover.getAttribute("data-book-cover-origin");

  await openReader(page);
  await closeReaderWithControls(page);

  await expect(page.locator('[data-reader-presented="true"]')).toHaveCount(0);
  const featured = page.locator('[data-library-featured="true"]');
  await expect(featured).toBeVisible();
  const restoredCover = featured.locator(
    `[data-book-cover-origin="${originId}"]`
  );
  await expect(restoredCover).toHaveCount(1);
  await expect(
    restoredCover.locator("xpath=ancestor::button[1]")
  ).toBeFocused();
});

test("first reader controls stay visible until an explicit toggle", async ({
  page,
}) => {
  await openReader(page);
  const menuToggle = page.locator('[data-reader-menu-toggle="true"]');
  await expect(menuToggle).toHaveAttribute("aria-expanded", "true");

  await page.locator('[data-txt-reader="true"]').evaluate((element) => {
    element.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
  });
  await expect(menuToggle).toHaveAttribute("aria-expanded", "true");

  await menuToggle.click();
  await expect(menuToggle).toHaveAttribute("aria-expanded", "false");
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("ai-reader-reader-controls-discovered-v1")
      )
    )
    .toBe("true");

  await menuToggle.click();
  await page.locator('[data-reader-close="true"]').click();
  await expect(page.locator('[data-reader-presented="true"]')).toHaveCount(0);

  await page.reload();
  await expect(page.locator(libraryRootSelector)).toBeVisible();
  await openReader(page);
  await expect(menuToggle).toHaveAttribute("aria-expanded", "false");
});

test("browser Back restores the root after a pushed route", async ({ page }) => {
  await openCollections(page);
  await page.evaluate(() => window.history.back());

  await expect(page.locator('[data-push-route="collections"]')).toHaveCount(0);
  await expect(page.locator(libraryRootSelector)).toBeVisible();
});

test("root scroll position survives tab changes", async ({ page }) => {
  for (let index = 1; index <= 12; index += 1) {
    await importBook(page, `native-navigation-${index}.txt`);
  }

  const libraryRoot = page.locator(libraryRootSelector);
  const before = await libraryRoot.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop;
  });
  expect(before).toBeGreaterThan(100);

  await page.locator('[data-navigation-tab="settings"]').click();
  await expect(
    page.locator('[data-navigation-root="settings"][aria-hidden="false"]')
  ).toBeVisible();
  await page.locator('[data-navigation-tab="library"]').click();
  await expect(libraryRoot).toBeVisible();

  const after = await libraryRoot.evaluate((element) => element.scrollTop);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(2);
});

test("root chrome stays compact, semantic, and safely tappable", async ({
  page,
}, testInfo) => {
  const app = page.locator('[data-app-shell="true"]');
  await app.evaluate((element) => {
    element.setAttribute("data-reader-theme", "light");
  });

  const navigation = page.getByRole("navigation", {
    name: primaryNavigationName,
  });
  const tabs = navigation.locator("[data-navigation-tab]");
  const title = page.locator(`${libraryRootSelector} h1`).first();

  await expect(navigation).toBeVisible();
  await expect(tabs).toHaveCount(3);
  await expect(title).toHaveCSS("font-size", "34px");
  await expect(title).toHaveCSS("font-weight", "750");
  await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(
    navigation.locator('[data-navigation-tab="library"]')
  ).toHaveAttribute("aria-current", "page");
  const libraryTab = navigation.locator('[data-navigation-tab="library"]');
  await expect(libraryTab).toHaveCSS("color", "rgb(5, 5, 5)");
  await expect(libraryTab.locator("span")).toHaveCSS(
    "color",
    "rgb(5, 5, 5)"
  );
  await expect(libraryTab.locator("svg")).toHaveCSS(
    "color",
    "rgb(0, 0, 0)"
  );

  const geometry = await navigation.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const standardBackdrop = style.getPropertyValue("backdrop-filter");
    const prefixedBackdrop = style.getPropertyValue(
      "-webkit-backdrop-filter"
    );
    const backdropFilter =
      standardBackdrop && standardBackdrop !== "none"
        ? standardBackdrop
        : prefixedBackdrop;
    const tabs = Array.from(
      element.querySelectorAll<HTMLElement>("[data-navigation-tab]")
    ).map((tab) => {
      const tabRect = tab.getBoundingClientRect();
      return { width: tabRect.width, height: tabRect.height };
    });
    const indicator = element.querySelector<HTMLElement>(
      '[data-root-tab-indicator="true"]'
    );
    if (!indicator) throw new Error("Root tab indicator is missing");
    const backing = getComputedStyle(indicator, "::after");
    return {
      width: rect.width,
      height: rect.height,
      centerError: Math.abs(rect.left + rect.width / 2 - innerWidth / 2),
      bottomGap: window.innerHeight - rect.bottom,
      borderRadius: style.borderRadius,
      backdropFilter,
      tabs,
      backingWidth: Number.parseFloat(backing.width),
      backingHeight: Number.parseFloat(backing.height),
      backingRadius: backing.borderRadius,
      backingColor: backing.backgroundColor,
      backingBoxShadow: backing.boxShadow,
      backingFilter: backing.filter,
      backingBackdropFilter:
        backing.getPropertyValue("backdrop-filter") ||
        backing.getPropertyValue("-webkit-backdrop-filter"),
    };
  });

  expect(geometry.width).toBeLessThanOrEqual(302.5);
  expect(geometry.height).toBe(76);
  expect(geometry.centerError).toBeLessThanOrEqual(0.5);
  expect(geometry.bottomGap).toBeGreaterThanOrEqual(8);
  expect(geometry.borderRadius).toBe("33px");
  expect(geometry.backdropFilter).toContain("blur(14px)");
  expect(
    Math.abs(geometry.backingWidth - (geometry.tabs[0].width - 8))
  ).toBeLessThanOrEqual(0.5);
  expect(geometry.backingHeight).toBe(60);
  expect(geometry.backingRadius).toBe("30px");
  expect(geometry.backingColor).toBe("rgba(118, 118, 128, 0.12)");
  expect(geometry.backingBoxShadow).toBe("none");
  expect(geometry.backingFilter).toBe("none");
  expect(geometry.backingBackdropFilter).toBe("none");
  for (const rect of geometry.tabs) {
    expect(rect.width).toBeGreaterThanOrEqual(44);
    expect(rect.height).toBeGreaterThanOrEqual(44);
  }
  await expect(navigation.locator('[data-root-tab-gear="true"]')).toHaveCount(
    1
  );

  await hideNextDevIndicator(page);
  await capture(page, testInfo, "chrome-library");
  await navigation.locator('[data-navigation-tab="reading"]').click();
  await expect(
    page.locator('[data-navigation-root="reading"][aria-hidden="false"]')
  ).toBeVisible();
  await expect(
    navigation.locator('[data-navigation-tab="reading"]')
  ).toHaveAttribute("aria-current", "page");
  const readingTab = navigation.locator('[data-navigation-tab="reading"]');
  await expect(readingTab).toHaveCSS("color", "rgb(5, 5, 5)");
  await expect(readingTab.locator("span")).toHaveCSS(
    "color",
    "rgb(5, 5, 5)"
  );
  await expect(readingTab.locator("svg")).toHaveCSS(
    "color",
    "rgb(0, 0, 0)"
  );
  await page.waitForTimeout(420);
  await hideNextDevIndicator(page);
  await capture(page, testInfo, "chrome-reading");
  await navigation.locator('[data-navigation-tab="settings"]').click();
  await expect(
    page.locator('[data-navigation-root="settings"][aria-hidden="false"]')
  ).toBeVisible();
  await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
  await expect(
    navigation.locator('[data-navigation-tab="settings"]')
  ).toHaveAttribute("aria-current", "page");
  const settingsTab = navigation.locator('[data-navigation-tab="settings"]');
  await expect(settingsTab).toHaveCSS("color", "rgb(5, 5, 5)");
  await expect(settingsTab.locator("span")).toHaveCSS(
    "color",
    "rgb(5, 5, 5)"
  );
  await expect(settingsTab.locator("svg")).toHaveCSS(
    "color",
    "rgb(0, 0, 0)"
  );
  await page.waitForTimeout(420);
  await hideNextDevIndicator(page);
  await capture(page, testInfo, "chrome-settings");
});

test("root navigation follows light, sepia, and dark frosted materials", async ({
  page,
}, testInfo) => {
  const app = page.locator('[data-app-shell="true"]');
  const navigation = page.getByRole("navigation", {
    name: primaryNavigationName,
  });
  const backgrounds: string[] = [];

  await expect(navigation).toBeVisible();
  await hideNextDevIndicator(page);

  for (const theme of ["light", "sepia", "dark"] as const) {
    await app.evaluate((element, nextTheme) => {
      element.setAttribute("data-reader-theme", nextTheme);
    }, theme);
    const material = await navigation.evaluate((element) => {
      const style = getComputedStyle(element);
      const standardBackdrop = style.getPropertyValue("backdrop-filter");
      const prefixedBackdrop = style.getPropertyValue(
        "-webkit-backdrop-filter"
      );
      const backdropFilter =
        standardBackdrop && standardBackdrop !== "none"
          ? standardBackdrop
          : prefixedBackdrop;
      if (!backdropFilter.includes("blur(14px)")) {
        throw new Error(`Unexpected root navigation backdrop: ${backdropFilter}`);
      }
      const indicator = element.querySelector<HTMLElement>(
        '[data-root-tab-indicator="true"]'
      );
      const activeTab = element.querySelector<HTMLElement>(
        '[aria-current="page"]'
      );
      const activeIcon = activeTab?.querySelector<SVGElement>("svg");
      const activeLabel = activeTab?.querySelector<HTMLElement>("span");
      if (!indicator || !activeIcon || !activeLabel) {
        throw new Error("Root navigation selection material is missing");
      }
      return {
        backgroundColor: style.backgroundColor,
        content: style.color,
        activeFill: getComputedStyle(indicator, "::after").backgroundColor,
        activeIcon: getComputedStyle(activeIcon).color,
        activeTab: getComputedStyle(activeTab).color,
        activeLabel: getComputedStyle(activeLabel).color,
      };
    });
    backgrounds.push(material.backgroundColor);
    const expectedChannels = {
      light: "255, 255, 255",
      sepia: "244, 236, 216",
      dark: "44, 44, 46",
    }[theme];
    expect(material.backgroundColor).toContain(expectedChannels);
    const expectedSelection = {
      light: {
        fill: "rgba(118, 118, 128, 0.12)",
        icon: "rgb(0, 0, 0)",
      },
      sepia: {
        fill: "rgba(130, 105, 66, 0.14)",
        icon: "rgb(0, 0, 0)",
      },
      dark: {
        fill: "rgba(255, 255, 255, 0.12)",
        icon: "rgb(255, 255, 255)",
      },
    }[theme];
    expect(material.activeFill).toBe(expectedSelection.fill);
    expect(material.activeIcon).toBe(expectedSelection.icon);
    expect(material.activeLabel).toBe(material.activeTab);
    if (theme === "sepia") {
      const sepiaBase = "rgb(244, 236, 216)";
      const contrast = wcagContrastRatio(material.content, sepiaBase);
      expect(material.content).toBe("rgb(119, 105, 83)");
      expect(contrast).toBeGreaterThanOrEqual(4.5);
      testInfo.annotations.push({
        type: "sepia-root-tab-contrast",
        description: String(contrast),
      });
      console.info(
        `[sepia-root-tab-contrast] ${testInfo.project.name} ${contrast}`
      );
    }
    await capture(page, testInfo, `chrome-theme-${theme}`);
  }

  expect(new Set(backgrounds).size).toBe(3);

  await page.emulateMedia({ colorScheme: "dark" });
  await app.evaluate((element) => {
    element.removeAttribute("data-reader-theme");
  });
  const systemDarkMaterial = await navigation.evaluate((element) => {
    const style = getComputedStyle(element);
    const indicator = element.querySelector<HTMLElement>(
      '[data-root-tab-indicator="true"]'
    );
    const activeTab = element.querySelector<HTMLElement>(
      '[aria-current="page"]'
    );
    const activeIcon = activeTab?.querySelector<SVGElement>("svg");
    const activeLabel = activeTab?.querySelector<HTMLElement>("span");
    if (!indicator || !activeIcon || !activeLabel) {
      throw new Error(
        "System-dark root navigation selection material is missing"
      );
    }
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
      activeFill: getComputedStyle(indicator, "::after").backgroundColor,
      activeIcon: getComputedStyle(activeIcon).color,
      activeTab: getComputedStyle(activeTab).color,
      activeLabel: getComputedStyle(activeLabel).color,
    };
  });
  expect(systemDarkMaterial.backgroundColor).toContain("44, 44, 46");
  expect(systemDarkMaterial.color).toContain("174, 174, 178");
  expect(systemDarkMaterial.activeFill).toBe("rgba(255, 255, 255, 0.12)");
  expect(systemDarkMaterial.activeIcon).toBe("rgb(255, 255, 255)");
  expect(systemDarkMaterial.activeLabel).toBe(systemDarkMaterial.activeTab);
  await capture(page, testInfo, "chrome-theme-system-dark");
});

test("root tab indicator retargets quickly and respects reduced motion", async ({
  page,
}) => {
  const navigation = page.getByRole("navigation", {
    name: primaryNavigationName,
  });
  const indicator = navigation.locator('[data-root-tab-indicator="true"]');

  await expect(navigation).toBeVisible();
  await expect(indicator).toHaveCount(1);
  await navigation.locator('[data-navigation-tab="reading"]').click();
  await page.waitForTimeout(100);
  const midGeometry = await indicator.evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    return {
      x:
        transform === "none"
          ? 0
          : new DOMMatrixReadOnly(transform).m41,
      slotWidth: element.getBoundingClientRect().width,
    };
  });
  expect(midGeometry.x).toBeGreaterThan(0);
  expect(midGeometry.x).toBeLessThan(midGeometry.slotWidth);
  await navigation.locator('[data-navigation-tab="settings"]').click();
  await expect
    .poll(() =>
      indicator.evaluate((element) => {
        const transform = getComputedStyle(element).transform;
        return transform === "none"
          ? 0
          : new DOMMatrixReadOnly(transform).m41;
      })
    )
    .toBeGreaterThan(midGeometry.slotWidth);
  await expect
    .poll(() =>
      indicator.evaluate((element, targetX) => {
        const transform = getComputedStyle(element).transform;
        const x =
          transform === "none"
            ? 0
            : new DOMMatrixReadOnly(transform).m41;
        return Math.abs(x - targetX);
      }, 2 * midGeometry.slotWidth)
    )
    .toBeLessThanOrEqual(1);
  await expect(
    navigation.locator('[data-navigation-tab="settings"]')
  ).toHaveAttribute("aria-current", "page");
  await expect(indicator).toHaveCount(1);

  await page.evaluate(() => {
    const storageKey = "ai-reader-app-preferences";
    const stored = localStorage.getItem(storageKey);
    const preferences = stored ? JSON.parse(stored) : {};
    localStorage.setItem(
      storageKey,
      JSON.stringify({ ...preferences, reduceMotion: true })
    );
  });
  await page.reload();

  const reducedNavigation = page.getByRole("navigation", {
    name: primaryNavigationName,
  });
  const reducedIndicator = reducedNavigation.locator(
    '[data-root-tab-indicator="true"]'
  );
  await expect(reducedNavigation).toBeVisible();
  await expect(page.locator('[data-app-shell="true"]')).toHaveAttribute(
    "data-reduce-motion",
    "true"
  );
  await expect(reducedIndicator).toHaveCount(1);
  await reducedNavigation.locator('[data-navigation-tab="reading"]').click();
  const reducedGeometry = await reducedIndicator.evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    const x =
      transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
    return {
      x,
      slotWidth: element.getBoundingClientRect().width,
      runningAnimations: element
        .getAnimations()
        .filter((animation) => animation.playState === "running").length,
    };
  });
  expect(
    Math.abs(reducedGeometry.x - reducedGeometry.slotWidth)
  ).toBeLessThanOrEqual(1);
  expect(reducedGeometry.runningAnimations).toBe(0);
  await expect(
    reducedNavigation.locator('[data-navigation-tab="reading"]')
  ).toHaveAttribute("aria-current", "page");
});

test("visible back button and edge swipe pop the same route", async ({
  page,
}) => {
  await openCollections(page);
  await page
    .locator('[data-push-route="collections"]')
    .getByRole("button", { name: /\u4e66\u5e93/ })
    .click();
  await expect(page.locator('[data-push-route="collections"]')).toHaveCount(0);

  await openCollections(page);
  await waitForHorizontalSettle(page, '[data-push-route="collections"]');
  await dragTouch(page, { x: 4, y: 360 }, { x: 340, y: 360 });
  await expect(page.locator('[data-push-route="collections"]')).toHaveCount(0);
});

test("reader horizontal gestures never trigger application edge back", async ({
  page,
}) => {
  await openReader(page);
  await injectPush(page, "collections");
  await expect(page.locator('[data-reader-presented="true"]')).toBeVisible();

  await dragTouch(page, { x: 4, y: 380 }, { x: 340, y: 380 });
  await page.waitForTimeout(350);

  await expect(page.locator('[data-reader-presented="true"]')).toBeVisible();
  await expect(page.locator('[data-push-route="collections"]')).toHaveCount(1);
});

test("AI provider configure transition stays within mobile frame budgets", async ({
  page,
}, testInfo) => {
  await openAiProviderList(page);
  const add = page.getByRole("button", { name: "添加 AI 服务商" });
  await expect(add).toBeVisible();

  const metrics = await collectProviderTransitionMetrics(page, () => add.click());

  await expect(page.locator('[data-provider-configure="true"]')).toBeVisible();
  await expect(page.locator('[data-provider-preset-grid="true"]')).toBeVisible();
  await testInfo.attach("ai-provider-transition.json", {
    body: JSON.stringify({ project: testInfo.project.name, ...metrics }, null, 2),
    contentType: "application/json",
  });

  expect(metrics.clickToMount).toBeGreaterThanOrEqual(0);
  expect(metrics.clickToMount).toBeLessThanOrEqual(34);
  expect(metrics.frames).toBeGreaterThanOrEqual(40);
  expect(metrics.p95).toBeLessThanOrEqual(20);
  expect(metrics.maxInterval).toBeLessThanOrEqual(34);
  expect(metrics.maxLongTask).toBe(0);
  expect(metrics.layoutShift).toBe(0);
  expect(metrics.motion.profile).toBe("compact");
  expect(metrics.motion.incomingX).toBeGreaterThanOrEqual(20);
  expect(metrics.motion.incomingX).toBeLessThanOrEqual(23);
  expect(metrics.motion.incomingOpacity).toBeLessThanOrEqual(0.05);
  expect(metrics.motion.previousX).toBeGreaterThanOrEqual(-13);
  expect(metrics.motion.previousX).toBeLessThanOrEqual(1);
  expect(metrics.motion.previousOpacity).toBeGreaterThanOrEqual(0);
  expect(metrics.motion.previousOpacity).toBeLessThanOrEqual(1);
  expect(metrics.motion.shadow).toBe("none");
});

test("provider compact back reverses direction and keeps edge back", async ({
  page,
}) => {
  await openAiProviderList(page);
  const add = page.locator('[data-open-provider-configure="true"]');
  await add.click();
  await waitForHorizontalSettle(
    page,
    '[data-push-route="ai-provider-configure"]'
  );

  const metrics = await collectProviderBackMotionMetrics(page, async () => {
    await page.goBack();
  });

  await expect(
    page.locator('[data-push-route="ai-provider-configure"]')
  ).toHaveCount(0);
  await expect(page.locator('[data-push-route="ai-providers"]')).toBeVisible();
  expect(metrics.frames).toBeGreaterThanOrEqual(8);
  expect(metrics.maxX).toBeGreaterThanOrEqual(20);
  expect(metrics.maxX).toBeLessThanOrEqual(23);
  expect(metrics.minOpacity).toBeLessThanOrEqual(0.05);

  await add.click();
  await waitForHorizontalSettle(
    page,
    '[data-push-route="ai-provider-configure"]'
  );
  await dragTouch(page, { x: 4, y: 360 }, { x: 340, y: 360 });
  await expect(
    page.locator('[data-push-route="ai-provider-configure"]')
  ).toHaveCount(0);
  await expect(page.locator('[data-push-route="ai-providers"]')).toBeVisible();
});

test("provider surfaces expose icon-only route-aware back buttons", async ({
  page,
}) => {
  await openAiProviderList(page);

  const listBack = page.getByRole("button", { name: "返回设置" });
  await expect(listBack).toBeVisible();
  await expect(listBack).toHaveAttribute("aria-label", "返回设置");
  await expect(listBack).toHaveCSS("width", "44px");
  expect((await listBack.boundingBox())?.width).toBeGreaterThanOrEqual(43.5);

  await page.locator('[data-open-provider-configure="true"]').click();
  const configure = page.locator('[data-provider-configure="true"]');
  await expect(configure).toBeVisible();

  const configureBack = page.getByRole("button", { name: "返回服务商" });
  await expect(configureBack).toBeVisible();
  await expect(configureBack).toHaveAttribute("aria-label", "返回服务商");
  await expect(configureBack).toHaveCSS("width", "44px");
  expect((await configureBack.boundingBox())?.width).toBeGreaterThanOrEqual(43.5);

  await configureBack.click();
  await expect(
    page.locator('[data-push-route="ai-provider-configure"]')
  ).toHaveCount(0);
  await expect(page.locator('[data-push-route="ai-providers"]')).toBeVisible();
});

test("AI provider configuration remains usable at 200 percent text", async ({
  page,
}, testInfo) => {
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await openAiProviderList(page);
  await page.getByRole("button", { name: "添加 AI 服务商" }).click();

  const configure = page.locator('[data-provider-configure="true"]');
  const picker = page.locator('[data-provider-preset-grid="true"]');
  await expect(configure).toBeVisible();
  await waitForHorizontalSettle(
    page,
    '[data-push-route="ai-provider-configure"]'
  );
  await expect(picker.getByRole("button")).toHaveCount(5);
  await expect(configure.getByText("名称", { exact: true })).toBeVisible();
  await expect(configure.getByText("API Key", { exact: true })).toBeVisible();
  await expect(configure.getByText("API 地址", { exact: true })).toBeVisible();

  const layout = await page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll('[data-provider-preset-grid="true"] button')
    );
    const saveRegion = document.querySelector(
      '[data-provider-sticky-actions="true"]'
    );
    return {
      rootOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
      presetsInViewport: buttons.every((button) => {
        const rect = button.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= window.innerWidth;
      }),
      presetLabelsSingleLine: buttons.every((button) => {
        const label = button.querySelector(":scope > span:nth-child(2)");
        if (!(label instanceof HTMLElement)) return false;
        const lineHeight = Number.parseFloat(getComputedStyle(label).lineHeight);
        return label.getBoundingClientRect().height <= lineHeight * 1.1;
      }),
      savePosition: saveRegion ? getComputedStyle(saveRegion).position : "missing",
    };
  });
  expect(layout.rootOverflow).toBeLessThanOrEqual(1);
  expect(layout.bodyOverflow).toBeLessThanOrEqual(1);
  expect(layout.presetsInViewport).toBe(true);
  expect(layout.presetLabelsSingleLine).toBe(true);
  expect(layout.savePosition).toBe("sticky");
  await capture(page, testInfo, "ai-provider-configure-text-200");
});

test("AI provider configuration follows app appearance themes", async ({
  page,
}, testInfo) => {
  await openAiProviderList(page);
  await page.getByRole("button", { name: "添加 AI 服务商" }).click();
  await waitForHorizontalSettle(
    page,
    '[data-push-route="ai-provider-configure"]'
  );
  await hideNextDevIndicator(page);

  const app = page.locator('[data-app-shell="true"]');
  const configure = page.locator('[data-provider-configure="true"]');
  const backgrounds: string[] = [];
  const presetLabels = configure.locator(
    '[data-provider-preset-grid="true"] button > span:nth-child(2)'
  );
  await expect(presetLabels).toHaveCount(5);
  expect(
    await presetLabels.evaluateAll((labels) =>
      labels.every((label) => label.scrollWidth <= label.clientWidth)
    )
  ).toBe(true);
  for (const theme of ["light", "sepia", "dark"] as const) {
    await app.evaluate((element, nextTheme) => {
      element.setAttribute("data-reader-theme", nextTheme);
    }, theme);
    const background = await configure.evaluate(
      (element) => getComputedStyle(element).backgroundColor
    );
    backgrounds.push(background);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      )
    ).toBeLessThanOrEqual(1);
    await capture(page, testInfo, `ai-provider-configure-theme-${theme}`);
  }
  expect(new Set(backgrounds).size).toBe(3);

  await page.emulateMedia({ colorScheme: "dark" });
  await app.evaluate((element) => {
    element.removeAttribute("data-reader-theme");
  });
  await expect(configure).toBeVisible();
  await capture(page, testInfo, "ai-provider-configure-theme-system-dark");
});

test("all pushed routes mount and return through history", async ({ page }) => {
  const routes: Array<{ route: PushRoute; entityId?: string }> = [
    { route: "collections" },
    { route: "ai-providers" },
    { route: "ai-provider-configure", entityId: "e2e-provider" },
    { route: "custom-background" },
  ];

  for (const { route, entityId } of routes) {
    await injectPush(page, route, entityId);
    const selector = `[data-push-route="${route}"]`;
    await expect(page.locator(selector)).toBeVisible();
    await dismissHistoryEntry(page, selector);
  }
});

test("all sheet routes share the motion layer and dismiss with Escape", async ({
  page,
}) => {
  const bookId = await firstLibraryCover(page).getAttribute("data-book-id");
  expect(bookId).toBeTruthy();

  const routes: Array<{ route: SheetRoute; entityId?: string }> = [
    { route: "reader-settings" },
    { route: "reader-custom-settings" },
    { route: "toc" },
    { route: "ask-ai" },
    { route: "reading-goal" },
    { route: "book-actions", entityId: bookId ?? undefined },
    { route: "book-rename", entityId: bookId ?? undefined },
    { route: "book-delete", entityId: bookId ?? undefined },
    { route: "book-groups", entityId: bookId ?? undefined },
    { route: "batch-groups" },
    { route: "batch-delete" },
    { route: "collection-create" },
  ];

  for (const { route, entityId } of routes) {
    await injectSheet(page, route, entityId);
    const host = page.locator(`[data-sheet-route="${route}"]`);
    await expect(host).toHaveCount(1);
    const panel = host.locator('[data-motion-sheet="panel"]');
    await expect(panel).toBeVisible();
    await expect
      .poll(() =>
        panel.evaluate((element) => element.contains(document.activeElement))
      )
      .toBe(true);
    expect(
      await host.evaluate((element) => {
        const appShell = element.closest('[data-app-shell="true"]');
        if (!appShell) return false;
        return Array.from(appShell.children)
          .filter((child) => child !== element)
          .every((child) => (child as HTMLElement).inert);
      })
    ).toBe(true);
    await page.keyboard.press("Shift+Tab");
    await expect
      .poll(() =>
        panel.evaluate((element) => element.contains(document.activeElement))
      )
      .toBe(true);
    await page.keyboard.press("Escape");
    await expect(host).toHaveCount(0);
  }
});

test("reader presentation captures a meaningful 70 ms midpoint and opaque settlement", async ({
  page,
}, testInfo) => {
  const midpointPath = testInfo.outputPath(
    "reader-presentation-midpoint-70ms.png"
  );
  const settledPath = testInfo.outputPath("reader-presentation-settled.png");
  await capture(page, testInfo, "reader-presentation-start");
  await firstLibraryCover(page).evaluate((cover) => {
    const trigger = cover.closest<HTMLButtonElement>("button");
    if (!trigger) throw new Error("Reader trigger is missing");
    const measuredWindow = window as typeof window & {
      __readerMidpoint?: {
        clickedAt: number;
        sampledAt?: number;
        contentOpacity?: number;
        contentBackground?: string;
        presentationBackground?: string;
        readableLayers?: number;
        durations?: number[];
        spatialDurationMs?: number;
        ready: boolean;
      };
    };
    const clickedAt = performance.now();
    measuredWindow.__readerMidpoint = { clickedAt, ready: false };
    trigger.click();

    const sample = (now: number) => {
      if (now - clickedAt < 70) {
        requestAnimationFrame(sample);
        return;
      }
      const presentation = document.querySelector<HTMLElement>(
        '[data-reader-presented="true"]'
      );
      const content = presentation?.querySelector<HTMLElement>(
        '[data-reader-presentation-content="true"]'
      );
      if (!presentation || !content) {
        if (now - clickedAt < 500) {
          requestAnimationFrame(sample);
        } else {
          measuredWindow.__readerMidpoint = {
            clickedAt,
            sampledAt: now,
            ready: true,
          };
        }
        return;
      }
      const animations = presentation.getAnimations({ subtree: true });
      for (const animation of animations) animation.pause();
      measuredWindow.__readerMidpoint = {
        clickedAt,
        sampledAt: now,
        contentOpacity: Number(getComputedStyle(content).opacity),
        contentBackground: getComputedStyle(content).backgroundColor,
        presentationBackground: getComputedStyle(presentation).backgroundColor,
        readableLayers: document.querySelectorAll(
          '[data-reader-content-ready="true"]'
        ).length,
        durations: animations.map((animation) =>
          Number(animation.effect?.getTiming().duration ?? 0)
        ),
        spatialDurationMs: Number(
          presentation.dataset.readerSpatialDurationMs ?? 0
        ),
        ready: true,
      };
    };
    requestAnimationFrame(sample);
  });
  const presentation = page.locator('[data-reader-presented="true"]');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const measuredWindow = window as typeof window & {
          __readerMidpoint?: { ready: boolean };
        };
        return measuredWindow.__readerMidpoint?.ready ?? false;
      })
    )
    .toBe(true);
  await expect(presentation).toHaveAttribute(
    "data-reader-transition-mode",
    "shared"
  );
  await page.screenshot({ path: midpointPath, fullPage: false });
  const midpoint = await page.evaluate(() => {
    const measuredWindow = window as typeof window & {
      __readerMidpoint?: {
        clickedAt: number;
        sampledAt?: number;
        contentOpacity?: number;
        contentBackground?: string;
        presentationBackground?: string;
        readableLayers?: number;
        durations?: number[];
        spatialDurationMs?: number;
      };
    };
    return measuredWindow.__readerMidpoint;
  });
  expect(midpoint?.sampledAt).toBeDefined();
  expect((midpoint?.sampledAt ?? 0) - (midpoint?.clickedAt ?? 0)).toBeGreaterThanOrEqual(70);
  expect((midpoint?.sampledAt ?? 0) - (midpoint?.clickedAt ?? 0)).toBeLessThan(110);
  expect(midpoint?.spatialDurationMs).toBe(280);
  expect(midpoint?.presentationBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(midpoint?.contentBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(midpoint?.readableLayers).toBe(1);

  await expect(presentation.locator('[data-reader-content-ready="true"]')).toHaveCount(1);
  await expect(page.locator('[data-reader-presented="true"]')).toHaveCount(1);
  await presentation.evaluate((element) => {
    for (const animation of element.getAnimations({ subtree: true })) {
      animation.play();
    }
  });
  await expect
    .poll(() =>
      presentation.evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length
      )
    )
    .toBe(0);
  await page.screenshot({ path: settledPath, fullPage: false });
  const visualState = await presentation.evaluate((element) => {
    const contentWrapper = element.querySelector<HTMLElement>(
      '[data-reader-presentation-content="true"]'
    );
    if (!contentWrapper) throw new Error("Reader presentation content is missing");
    const presentationStyle = getComputedStyle(element);
    const contentStyle = getComputedStyle(contentWrapper);
    return {
      contentOpacity: Number(contentStyle.opacity),
      presentationOpacity: Number(presentationStyle.opacity),
      presentationBackground: presentationStyle.backgroundColor,
      running: element
        .getAnimations({ subtree: true })
        .filter((animation) => animation.playState === "running").length,
    };
  });
  expect(visualState).toMatchObject({
    contentOpacity: 1,
    presentationOpacity: 1,
    running: 0,
  });
  expect(visualState.presentationBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(midpoint?.contentOpacity).not.toBe(visualState.contentOpacity);
  expect(readFileSync(midpointPath).equals(readFileSync(settledPath))).toBe(false);
});

test("reader presentation falls back safely when its cover origin is removed", async ({
  page,
}) => {
  const origin = firstLibraryCover(page);
  const originId = await origin.getAttribute("data-book-cover-origin");
  if (!originId) throw new Error("Reader source origin is missing");
  await origin.click();
  await expect(page.locator('[data-reader-presented="true"]')).toHaveCount(1);
  await page
    .locator(`[data-book-cover-origin="${originId}"]`)
    .evaluate((element) => element.remove());

  const menuToggle = page.locator('[data-reader-menu-toggle="true"]');
  if ((await menuToggle.getAttribute("aria-expanded")) !== "true") {
    await menuToggle.click();
  }
  const exitEvidence = await page.locator('[data-reader-close="true"]').evaluate(
    (button) =>
      new Promise<{
        durationMs: number[];
        exitMode: string | undefined;
        projectionActive: string | undefined;
        spatialDurationMs: number;
      }>((resolve, reject) => {
        const presentation = document.querySelector<HTMLElement>(
          '[data-reader-presented="true"]'
        );
        if (!presentation) {
          reject(new Error("Reader presentation is missing before exit"));
          return;
        }
        const captureExit = () => {
          if (presentation.dataset.readerExitMode === "present") return false;
          observer.disconnect();
          window.clearTimeout(timeout);
          requestAnimationFrame(() => {
            resolve({
              durationMs: presentation
                .getAnimations({ subtree: true })
                .map((animation) =>
                  Number(animation.effect?.getTiming().duration ?? 0)
                ),
              exitMode: presentation.dataset.readerExitMode,
              projectionActive: presentation.dataset.readerProjectionActive,
              spatialDurationMs: Number(
                presentation.dataset.readerSpatialDurationMs ?? 0
              ),
            });
          });
          return true;
        };
        const observer = new MutationObserver(captureExit);
        const timeout = window.setTimeout(() => {
          observer.disconnect();
          reject(new Error("Reader exit state was not committed"));
        }, 1_000);
        observer.observe(presentation, {
          attributes: true,
          attributeFilter: [
            "data-reader-exit-mode",
            "data-reader-projection-active",
          ],
        });
        (button as HTMLButtonElement).click();
        captureExit();
      })
  );

  expect(exitEvidence.exitMode).toBe("fallback");
  expect(exitEvidence.projectionActive).toBe("false");
  expect(exitEvidence.spatialDurationMs).toBe(210);
  expect(exitEvidence.durationMs).toContain(210);

  await expect(page.locator('[data-reader-presented="true"]')).toHaveCount(0);
});

test("reader presentation uses fallback geometry for an offscreen origin", async ({
  page,
}) => {
  for (let index = 0; index < 8; index += 1) {
    await importBook(page, `reader-fallback-${index}.txt`);
  }
  const origin = firstLibraryCover(page);
  const openButton = origin.locator("xpath=ancestor::button[1]");
  await page.locator(libraryRootSelector).evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect
    .poll(() =>
      origin.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.bottom <= 0 || rect.top >= window.innerHeight;
      })
    )
    .toBe(true);

  await openButton.evaluate((button) => (button as HTMLButtonElement).click());

  await expect(page.locator('[data-reader-presented="true"]')).toHaveAttribute(
    "data-reader-transition-mode",
    "fallback"
  );
});

test("reader presentation can close while TXT content is still preparing", async ({
  page,
}) => {
  await page.evaluate(() => {
    const readText = Blob.prototype.text;
    Blob.prototype.text = async function delayedText() {
      await new Promise((resolve) => window.setTimeout(resolve, 300));
      return readText.call(this);
    };
  });

  await firstLibraryCover(page).click();
  const presentation = page.locator('[data-reader-presented="true"]');
  await expect(presentation.locator('[data-reader-content-ready="false"]')).toHaveCount(1);
  await closeReaderWithControls(page);

  await expect(presentation).toHaveCount(0);
});

test("reader presentation reduced motion uses one short crossfade", async ({
  page,
}) => {
  await page.evaluate(() => {
    const storageKey = "ai-reader-app-preferences";
    const stored = localStorage.getItem(storageKey);
    const preferences = stored ? JSON.parse(stored) : {};
    localStorage.setItem(
      storageKey,
      JSON.stringify({ ...preferences, reduceMotion: true })
    );
  });
  await page.reload();
  await expect(page.locator(libraryRootSelector)).toBeVisible();

  await firstLibraryCover(page).click();
  const presentation = page.locator('[data-reader-presented="true"]');
  await expect(presentation).toHaveAttribute(
    "data-reader-transition-mode",
    /shared|fallback/
  );
  await page.waitForTimeout(110);
  await expect
    .poll(() =>
      presentation.evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length
      )
    )
    .toBe(0);
});

test("reader gesture ownership preserves TXT scroll selection and controls", async ({
  page,
}) => {
  await openReader(page);
  const stage = page.locator('[data-navigation-gesture-owner="reader"]');
  const reader = page.locator('[data-txt-reader="true"]');
  await expect(stage).toHaveCount(1);
  await expect(reader).toBeVisible();

  const scrollTop = await reader.evaluate((element) => {
    element.scrollTop = Math.min(120, element.scrollHeight - element.clientHeight);
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
    return element.scrollTop;
  });
  expect(scrollTop).toBeGreaterThan(0);

  const selectedText = await page.locator('[data-paragraph-index="0"]').evaluate(
    (paragraph) => {
      const textNode = document
        .createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
        .nextNode();
      if (!textNode || !textNode.textContent) return "";
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, Math.min(8, textNode.textContent.length));
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      return selection?.toString() ?? "";
    }
  );
  expect(selectedText.length).toBeGreaterThan(0);

  const menuToggle = page.locator('[data-reader-menu-toggle="true"]');
  await expect(menuToggle).toBeVisible();
  await menuToggle.click();
  await expect(menuToggle).toHaveAttribute("aria-expanded", "false");
  await menuToggle.click();
  await expect(page.locator('[data-reader-close="true"]')).toBeVisible();
});

test("reader gesture ownership keeps real EPUB swipes inside the reader", async ({
  page,
}) => {
  const covers = page.locator(`${libraryRootSelector} [data-book-cover-origin]`);
  const previousCount = await covers.count();
  await page.locator('input[type="file"][accept*=".epub"]').setInputFiles({
    name: "reader-gesture.epub",
    mimeType: "application/epub+zip",
    buffer: await buildReaderGestureEpub(),
  });
  await expect(covers).toHaveCount(previousCount + 1);
  await firstLibraryCover(page).click();

  const presentation = page.locator('[data-reader-presented="true"]');
  const owner = presentation.locator('[data-navigation-gesture-owner="reader"]');
  const frame = presentation.locator("iframe").first();
  await expect(owner).toHaveCount(2);
  await expect(frame).toBeVisible({ timeout: 20_000 });
  const chrome = presentation.locator('[data-reader-chrome-controls="true"]');
  await expect(chrome).toContainText(/\d+\/\d+/, { timeout: 30_000 });
  const beforeLabel = await chrome.innerText();

  await injectPush(page, "collections");
  const frameBox = await frame.boundingBox();
  if (!frameBox) throw new Error("EPUB frame geometry is missing");
  await frame.evaluate((element) => {
    const iframe = element as HTMLIFrameElement;
    const doc = iframe.contentDocument;
    const target = doc?.body;
    if (!doc || !target) throw new Error("EPUB frame document is unavailable");
    const makeTouch = (identifier: number, clientX: number, clientY: number) =>
      new Touch({ identifier, target, clientX, clientY });
    const y = Math.max(80, doc.documentElement.clientHeight * 0.5);
    const startX = Math.max(260, doc.documentElement.clientWidth * 0.85);
    const endX = Math.max(30, doc.documentElement.clientWidth * 0.15);
    const start = makeTouch(1, startX, y);
    target.dispatchEvent(
      new TouchEvent("touchstart", {
        bubbles: true,
        cancelable: true,
        touches: [start],
        targetTouches: [start],
        changedTouches: [start],
      })
    );
    for (let index = 1; index <= 8; index += 1) {
      const x = startX + ((endX - startX) * index) / 8;
      const move = makeTouch(1, x, y);
      target.dispatchEvent(
        new TouchEvent("touchmove", {
          bubbles: true,
          cancelable: true,
          touches: [move],
          targetTouches: [move],
          changedTouches: [move],
        })
      );
    }
    const end = makeTouch(1, endX, y);
    target.dispatchEvent(
      new TouchEvent("touchend", {
        bubbles: true,
        cancelable: true,
        touches: [],
        targetTouches: [],
        changedTouches: [end],
      })
    );
  });

  await expect(presentation).toHaveCount(1);
  await expect(page.locator('[data-push-route="collections"]')).toHaveCount(1);
  await expect.poll(() => chrome.innerText(), { timeout: 20_000 }).not.toBe(beforeLabel);
});

test("nested sheet stack preserves one panel through history and visible back", async ({
  page,
}) => {
  await useLibraryListMode(page);
  await page
    .locator(`${libraryRootSelector} [data-library-book-more="true"]`)
    .first()
    .click();

  const panel = page.locator('[data-motion-sheet="panel"]');
  const backdrop = page.locator('[data-motion-sheet="backdrop"]');
  await expect(panel).toHaveCount(1);
  await expect(backdrop).toHaveCount(1);
  await panel.evaluate((element) => {
    (element as HTMLElement).dataset.e2eIdentity = "persistent-panel";
  });
  await backdrop.evaluate((element) => {
    (element as HTMLElement).dataset.e2eIdentity = "persistent-backdrop";
  });

  await page.getByRole("button", { name: "重命名书籍" }).click();
  await expect(page.locator('[data-sheet-route="book-rename"]')).toHaveCount(1);
  await expect(page.locator("[data-sheet-page]")).toHaveCount(2);
  await expect(panel).toHaveAttribute("data-e2e-identity", "persistent-panel");
  await expect(backdrop).toHaveAttribute("data-e2e-identity", "persistent-backdrop");
  await expect(backdrop).not.toHaveCSS("opacity", "0");

  await page.evaluate(() => window.history.back());
  await expect(page.locator('[data-sheet-route="book-actions"]')).toHaveCount(1);
  await expect(page.locator("[data-sheet-page]")).toHaveCount(1);
  await expect(panel).toHaveAttribute("data-e2e-identity", "persistent-panel");

  await page.evaluate(() => window.history.back());
  await expect(page.locator('[data-motion-sheet="panel"]')).toHaveCount(0);
  await page
    .locator(`${libraryRootSelector} [data-library-book-more="true"]`)
    .first()
    .click();
  await expect(page.locator('[data-sheet-route="book-actions"]')).toHaveCount(1);

  await page.getByRole("button", { name: "重命名书籍" }).click();
  await page.getByRole("button", { name: "关闭" }).click();
  await expect(page.locator('[data-sheet-route="book-actions"]')).toHaveCount(1);
  await expect(page.locator("[data-sheet-page]")).toHaveCount(1);
  await expect(panel).toHaveCount(1);
  await expect(backdrop).toHaveCount(1);

  await page.getByRole("button", { name: "重命名书籍" }).click();
  await expect(page.locator("[data-sheet-page]")).toHaveCount(2);
  await page.waitForTimeout(350);
  const handle = page.locator('[data-sheet-drag-handle="true"]');
  const handleBox = await handle.boundingBox();
  const viewport = page.viewportSize();
  if (!handleBox || !viewport) throw new Error("Nested sheet drag geometry is unavailable");
  const x = handleBox.x + handleBox.width / 2;
  const y = handleBox.y + handleBox.height / 2;
  await dragTouch(page, { x, y }, { x, y: viewport.height - 4 }, 16);
  await expect(page.locator('[data-motion-sheet="panel"]')).toHaveCount(0);
  await expect(page.locator("[data-sheet-page]")).toHaveCount(0);
});

test("invalid nested sheet removal removes its descendants without an empty frame", async ({
  page,
}) => {
  await useLibraryListMode(page);
  await page
    .locator(`${libraryRootSelector} [data-library-book-more="true"]`)
    .first()
    .click();
  await page.getByRole("button", { name: "删除这本书" }).click();
  await expect(page.locator("[data-sheet-page]")).toHaveCount(2);

  await page.evaluate(() => {
    const measuredWindow = window as typeof window & {
      __invalidSheetFrameAudit?: {
        frames: Array<{ hasActivePage: boolean; activePageEmpty: boolean }>;
        stop: () => Array<{ hasActivePage: boolean; activePageEmpty: boolean }>;
      };
    };
    const frames: Array<{
      hasActivePage: boolean;
      activePageEmpty: boolean;
    }> = [];
    let animationFrame = 0;
    const sample = () => {
      const panel = document.querySelector('[data-motion-sheet="panel"]');
      if (panel) {
        const activePage = panel.querySelector(
          '[data-sheet-page-active="true"]'
        );
        frames.push({
          hasActivePage: Boolean(activePage),
          activePageEmpty: activePage
            ? activePage.childElementCount === 0 &&
              !(activePage.textContent ?? "").trim()
            : true,
        });
      }
      animationFrame = requestAnimationFrame(sample);
    };
    animationFrame = requestAnimationFrame(sample);
    measuredWindow.__invalidSheetFrameAudit = {
      frames,
      stop: () => {
        cancelAnimationFrame(animationFrame);
        return frames;
      },
    };
  });

  await page
    .locator('[data-sheet-route="book-delete"]')
    .getByRole("button", { name: "删除这本书", exact: true })
    .click();
  await expect(page.locator('[data-motion-sheet="panel"]')).toHaveCount(0);
  await expect(page.locator("[data-sheet-page]")).toHaveCount(0);
  await expect(page.locator("[data-sheet-route]")).toHaveCount(0);
  const exitFrames = await page.evaluate(() => {
    const measuredWindow = window as typeof window & {
      __invalidSheetFrameAudit?: {
        stop: () => Array<{
          hasActivePage: boolean;
          activePageEmpty: boolean;
        }>;
      };
    };
    return measuredWindow.__invalidSheetFrameAudit?.stop() ?? [];
  });
  expect(exitFrames.length).toBeGreaterThan(0);
  expect(
    exitFrames.every(
      (frame) => frame.hasActivePage && !frame.activePageEmpty
    )
  ).toBe(true);
});

test("renames a book from its action sheet and validates blank titles", async ({
  page,
}) => {
  await useLibraryListMode(page);
  await page
    .locator(`${libraryRootSelector} [data-library-book-more="true"]`)
    .first()
    .click();

  const actionsSheet = page.locator('[data-sheet-route="book-actions"]');
  await actionsSheet
    .getByRole("button", { name: "\u91cd\u547d\u540d\u4e66\u7c4d" })
    .click();

  const renameSheet = page.locator('[data-sheet-route="book-rename"]');
  const titleInput = renameSheet.getByLabel("\u4e66\u540d");
  await expect(titleInput).toBeFocused();
  await titleInput.fill("   ");
  await renameSheet.getByRole("button", { name: "\u4fdd\u5b58" }).click();
  await expect(renameSheet.getByRole("alert")).toHaveText(
    "\u8bf7\u8f93\u5165\u4e66\u540d"
  );

  const renamedTitle = "E2E \u91cd\u547d\u540d\u4e66\u7c4d";
  await titleInput.fill(renamedTitle);
  await titleInput.press("Enter");
  await expect(renameSheet).toHaveCount(0);
  await expect(actionsSheet.locator("strong", { hasText: renamedTitle })).toHaveText(
    renamedTitle
  );

  await page.keyboard.press("Escape");
  await expect(actionsSheet).toHaveCount(0);
  await expect(
    page.locator(
      `${libraryRootSelector} [data-library-book-title="true"]`
    ).filter({ hasText: renamedTitle })
  ).toHaveText(renamedTitle);
});

test("Ask AI composer remains visible in a keyboard-sized viewport", async ({
  page,
}) => {
  await injectSheet(page, "ask-ai");
  await waitForVerticalSettle(
    page,
    '[data-sheet-route="ask-ai"] [data-motion-sheet="panel"]'
  );
  const input = page.locator('[data-sheet-route="ask-ai"] textarea');
  await expect(input).toBeEnabled();
  await input.fill("Keep the composer anchored");
  await expect(input).toBeFocused();

  const originalViewport = page.viewportSize();
  expect(originalViewport).not.toBeNull();
  await page.setViewportSize({
    width: originalViewport?.width ?? 390,
    height: 430,
  });
  await expect.poll(() => page.evaluate(() => window.innerHeight)).toBe(430);

  await expect
    .poll(() =>
      input.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const viewport = window.visualViewport;
        const viewportBottom =
          (viewport?.offsetTop ?? 0) +
          (viewport?.height ?? window.innerHeight);
        return rect.bottom - viewportBottom;
      })
    )
    .toBeLessThanOrEqual(0);

  const visibleBounds = await input.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const viewport = window.visualViewport;
    return {
      inputTop: rect.top,
      inputBottom: rect.bottom,
      viewportTop: viewport?.offsetTop ?? 0,
      viewportBottom:
        (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight),
    };
  });
  expect(visibleBounds.inputTop).toBeGreaterThanOrEqual(
    visibleBounds.viewportTop
  );
  expect(visibleBounds.inputBottom).toBeLessThanOrEqual(
    visibleBounds.viewportBottom
  );
  await expect(input).toHaveValue("Keep the composer anchored");
});

test("reduced motion keeps push and sheet destinations functional", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "ai-reader-app-preferences",
      JSON.stringify({
        libraryView: "list",
        autoOpenLastBook: false,
        reduceMotion: true,
        keepScreenAwake: false,
        edgeTapToTurn: true,
        swipeToTurn: true,
        backgroundMode: "auto",
        customBackgroundOpacity: 1,
      })
    );
  });
  await page.reload();
  await expect(
    page.locator('[data-reduce-motion="true"]:not([aria-hidden="true"])')
  ).toBeVisible();

  await openCollections(page);
  const pushX = await page
    .locator('[data-push-route="collections"]')
    .evaluate((element) => {
      const transform = getComputedStyle(element).transform;
      return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
    });
  expect(Math.abs(pushX)).toBeLessThanOrEqual(1);

  await dismissHistoryEntry(page, '[data-push-route="collections"]');
  await openAiProviderList(page);
  await page.locator('[data-open-provider-configure="true"]').click();
  const compactPush = page.locator(
    '[data-push-route="ai-provider-configure"]'
  );
  await expect(compactPush).toBeVisible();
  await expect(compactPush).toHaveAttribute("data-push-motion", "compact");
  const compactPushX = await compactPush.evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
  });
  expect(Math.abs(compactPushX)).toBeLessThanOrEqual(1);

  await injectSheet(page, "collection-create");
  const panel = page.locator(
    '[data-sheet-route="collection-create"] [data-motion-sheet="panel"]'
  );
  await expect(panel).toBeVisible();
  const sheetY = await panel.evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m42;
  });
  expect(Math.abs(sheetY)).toBeLessThanOrEqual(1);
});

test("captures root, push, reader, and sheet transition evidence", async ({
  page,
}, testInfo) => {
  await capture(page, testInfo, "root-start");
  await page.locator('[data-navigation-tab="reading"]').click();
  await page.waitForTimeout(80);
  await capture(page, testInfo, "root-mid");
  await page.waitForTimeout(420);
  await capture(page, testInfo, "root-complete");

  await page.locator('[data-navigation-tab="library"]').click();
  await page.waitForTimeout(420);
  await capture(page, testInfo, "push-start");
  await page
    .locator(libraryRootSelector)
    .getByRole("button", { name: /\u85cf\u4e66/ })
    .first()
    .click();
  await page.waitForTimeout(80);
  await capture(page, testInfo, "push-mid");
  await page.waitForTimeout(420);
  const settledPush = page.locator('[data-push-route="collections"]');
  await expect(settledPush).toBeVisible();
  await expect(settledPush.getByRole("heading", { name: "藏书" })).toBeVisible();
  await expect
    .poll(() =>
      settledPush.evaluate((element) => {
        const transform = getComputedStyle(element).transform;
        return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
      })
    )
    .toBe(0);
  await capture(page, testInfo, "push-complete");

  await page.evaluate(() => window.history.back());
  await expect(page.locator('[data-push-route="collections"]')).toHaveCount(0);
  await capture(page, testInfo, "reader-start");
  await firstLibraryCover(page).click();
  await page.waitForTimeout(80);
  await capture(page, testInfo, "reader-mid");
  await page.waitForTimeout(520);
  await capture(page, testInfo, "reader-complete");

  await closeReaderWithControls(page);
  await expect(page.locator('[data-reader-presented="true"]')).toHaveCount(0);
  await capture(page, testInfo, "sheet-start");
  await injectSheet(page, "collection-create");
  await page.waitForTimeout(80);
  await capture(page, testInfo, "sheet-mid");
  await page.waitForTimeout(420);
  await capture(page, testInfo, "sheet-complete");
});

test("book action sheet entrance stays within mobile frame budgets", async ({
  page,
}, testInfo) => {
  await useLibraryListMode(page);
  const more = page
    .locator(`${libraryRootSelector} [data-library-book-more="true"]`)
    .first();
  await expect(more).toBeVisible();
  await page.waitForTimeout(600);
  const observerSupport = await page.evaluate(() => ({
    longtask: PerformanceObserver.supportedEntryTypes.includes("longtask"),
    layoutShift: PerformanceObserver.supportedEntryTypes.includes("layout-shift"),
  }));
  expect(observerSupport.longtask).toBe(true);
  expect(observerSupport.layoutShift).toBe(true);
  const metricsPromise = collectInteractionMetrics(page, {
    durationMs: 800,
    clickSelector: '[data-library-book-more="true"]',
    mountSelector:
      '[data-sheet-route="book-actions"] [data-motion-sheet="panel"]',
  });

  await page.waitForTimeout(40);
  await more.click();
  const panel = page.locator(
    '[data-sheet-route="book-actions"] [data-motion-sheet="panel"]'
  );
  const backdrop = page.locator(
    '[data-sheet-route="book-actions"] [data-motion-sheet="backdrop"]'
  );
  await expect(panel).toBeVisible();
  await expect(backdrop).toHaveCSS("will-change", "opacity");
  await expect(panel).toHaveCSS("will-change", "transform");
  const metrics = await metricsPromise;

  await attachInteractionMetrics(testInfo, "book-sheet-performance", metrics);

  expect(metrics.clickToMount).not.toBeNull();
  expect(metrics.clickToMount ?? -1).toBeGreaterThanOrEqual(0);
  expect(metrics.clickToMount ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(34);
  expect(metrics.frames).toBeGreaterThanOrEqual(40);
  expect(metrics.p95Frame).toBeLessThanOrEqual(20);
  expect(metrics.maxFrame).toBeLessThanOrEqual(34);
  expectInteractionBudget(metrics, { requireMount: true });
});

test("book action sheet preserves light, sepia, dark, and system-dark materials", async ({
  page,
}, testInfo) => {
  await useLibraryListMode(page);
  await page
    .locator(`${libraryRootSelector} [data-library-book-more="true"]`)
    .first()
    .click();
  const app = page.locator('[data-app-shell="true"]');
  const sheet = page.locator('[data-sheet-route="book-actions"]');
  const panel = sheet.locator('[data-motion-sheet="panel"]');
  await expect(panel).toBeVisible();
  await waitForVerticalSettle(
    page,
    '[data-sheet-route="book-actions"] [data-motion-sheet="panel"]'
  );

  for (const theme of ["light", "sepia", "dark"] as const) {
    await app.evaluate((element, nextTheme) => {
      element.setAttribute("data-reader-theme", nextTheme);
    }, theme);
    await expect(panel).toHaveCSS(
      "background-color",
      {
        light: "rgba(255, 255, 255, 0.96)",
        sepia: "rgba(244, 236, 216, 0.96)",
        dark: "rgba(28, 28, 30, 0.98)",
      }[theme]
    );
    await capture(page, testInfo, `book-sheet-theme-${theme}`);
  }

  await page.emulateMedia({ colorScheme: "dark" });
  await app.evaluate((element) => {
    element.removeAttribute("data-reader-theme");
  });
  await expect(panel).toHaveCSS("background-color", "rgba(28, 28, 30, 0.98)");
  await capture(page, testInfo, "book-sheet-theme-system-dark");
});

test("shared sheet preserves outside-tap and drag dismissal", async ({ page }) => {
  await injectSheet(page, "collection-create");
  let host = page.locator('[data-sheet-route="collection-create"]');
  await expect(host.locator('[data-motion-sheet="panel"]')).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(host).toHaveCount(0);

  await injectSheet(page, "collection-create");
  host = page.locator('[data-sheet-route="collection-create"]');
  const panel = host.locator('[data-motion-sheet="panel"]');
  const handle = host.locator('[data-sheet-drag-handle="true"]');
  await waitForVerticalSettle(
    page,
    '[data-sheet-route="collection-create"] [data-motion-sheet="panel"]'
  );
  const handleBox = await handle.boundingBox();
  const viewport = page.viewportSize();
  if (!handleBox || !viewport) {
    throw new Error("Shared sheet drag geometry is unavailable");
  }
  const x = handleBox.x + handleBox.width / 2;
  const y = handleBox.y + handleBox.height / 2;
  await dragTouch(page, { x, y }, { x, y: viewport.height - 4 }, 16);
  await expect(host).toHaveCount(0);
  await expect(panel).toHaveCount(0);
});

test("root tab retargeting stays within frame and long-task budgets", async ({
  page,
}, testInfo) => {
  await page.waitForTimeout(600);
  const observerSupport = await page.evaluate(() => ({
    longtask: PerformanceObserver.supportedEntryTypes.includes("longtask"),
    layoutShift: PerformanceObserver.supportedEntryTypes.includes("layout-shift"),
  }));
  expect(observerSupport.longtask).toBe(true);
  expect(observerSupport.layoutShift).toBe(true);
  const metricsPromise = collectInteractionMetrics(page, {
    durationMs: 700,
    clickSelector: '[data-navigation-tab="reading"]',
  });

  await page.waitForTimeout(40);
  await page.locator('[data-navigation-tab="reading"]').click();
  await page.waitForTimeout(100);
  await page.locator('[data-navigation-tab="settings"]').click();
  const metrics = await metricsPromise;
  testInfo.annotations.push({
    type: "root-tab-performance",
    description: JSON.stringify(metrics),
  });
  await attachInteractionMetrics(testInfo, "root-tab-performance", metrics);

  expectInteractionBudget(metrics);
});

test("push transition meets mobile frame cadence and long-task budgets", async ({
  page,
}, testInfo) => {
  await page.waitForTimeout(600);
  const metricsPromise = collectInteractionMetrics(page, {
    durationMs: 800,
    clickSelector: libraryRootSelector,
    mountSelector: '[data-push-route="collections"]',
  });

  await page.waitForTimeout(40);
  await page
    .locator(libraryRootSelector)
    .getByRole("button", { name: /\u85cf\u4e66/ })
    .first()
    .click();
  const metrics = await metricsPromise;

  await attachInteractionMetrics(testInfo, "push-transition-performance", metrics);

  expect(metrics.maxFrame).toBeLessThanOrEqual(80);
  expectInteractionBudget(metrics, { requireMount: true });
});
