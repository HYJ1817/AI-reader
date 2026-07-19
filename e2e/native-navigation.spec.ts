import { readFileSync } from "node:fs";
import path from "node:path";
import {
  expect,
  test,
  type Page,
  type TestInfo,
} from "@playwright/test";

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
  | "book-delete"
  | "book-groups"
  | "batch-groups"
  | "batch-delete"
  | "collection-create";

const sampleText = readFileSync(
  path.resolve(process.cwd(), "e2e/fixtures/sample.txt"),
  "utf8"
);
const libraryRootSelector =
  '[data-navigation-root="library"][aria-hidden="false"]';
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
    "rgb(255, 255, 255)"
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
    };
  });

  expect(geometry.width).toBeLessThanOrEqual(302.5);
  expect(geometry.height).toBe(76);
  expect(geometry.centerError).toBeLessThanOrEqual(0.5);
  expect(geometry.bottomGap).toBeGreaterThanOrEqual(8);
  expect(geometry.borderRadius).toBe("33px");
  expect(geometry.backdropFilter).toContain("blur(14px)");
  expect(geometry.backingWidth).toBe(31);
  expect(geometry.backingHeight).toBe(31);
  expect(geometry.backingRadius).toBe("10px");
  expect(geometry.backingColor).toBe("rgb(125, 85, 231)");
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
    "rgb(255, 255, 255)"
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
    "rgb(255, 255, 255)"
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
      return {
        backgroundColor: style.backgroundColor,
        content: style.color,
      };
    });
    backgrounds.push(material.backgroundColor);
    const expectedChannels = {
      light: "255, 255, 255",
      sepia: "244, 236, 216",
      dark: "44, 44, 46",
    }[theme];
    expect(material.backgroundColor).toContain(expectedChannels);
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
    return {
      backgroundColor: style.backgroundColor,
      color: style.color,
    };
  });
  expect(systemDarkMaterial.backgroundColor).toContain("44, 44, 46");
  expect(systemDarkMaterial.color).toContain("174, 174, 178");
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

test("Ask AI composer remains visible in a keyboard-sized viewport", async ({
  page,
}) => {
  await injectSheet(page, "ask-ai");
  await waitForVerticalSettle(
    page,
    '[data-sheet-route="ask-ai"] [data-motion-sheet="panel"]'
  );
  const input = page.locator('[data-sheet-route="ask-ai"] input[type="text"]');
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

test("root tab retargeting stays within frame and long-task budgets", async ({
  page,
}, testInfo) => {
  await page.waitForTimeout(600);

  const metricsPromise = page.evaluate(async () => {
    const intervals: number[] = [];
    const longTasks: number[] = [];
    let layoutShift = 0;
    let previous = performance.now();
    const observers: PerformanceObserver[] = [];
    const longTaskSupported =
      PerformanceObserver.supportedEntryTypes.includes("longtask");
    const layoutShiftSupported =
      PerformanceObserver.supportedEntryTypes.includes("layout-shift");
    const handleEntries = (entries: PerformanceEntryList) => {
      for (const entry of entries) {
        if (entry.entryType === "longtask") {
          longTasks.push(entry.duration);
        } else if (entry.entryType === "layout-shift") {
          layoutShift += (entry as PerformanceEntry & { value: number }).value;
        }
      }
    };

    if (longTaskSupported) {
      const observer = new PerformanceObserver((list) => {
        handleEntries(list.getEntries());
      });
      observer.observe({ entryTypes: ["longtask"] });
      observers.push(observer);
    }
    if (layoutShiftSupported) {
      const observer = new PerformanceObserver((list) => {
        handleEntries(list.getEntries());
      });
      observer.observe({ entryTypes: ["layout-shift"] });
      observers.push(observer);
    }

    const startedAt = performance.now();
    await new Promise<void>((resolve) => {
      const sample = (now: number) => {
        intervals.push(now - previous);
        previous = now;
        if (now - startedAt >= 700) {
          resolve();
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

    for (const observer of observers) {
      handleEntries(observer.takeRecords());
      observer.disconnect();
    }
    const sampledIntervals = intervals.slice(2);
    const sorted = [...sampledIntervals].sort((a, b) => a - b);
    return {
      frames: sampledIntervals.length,
      p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      maxLongTask: longTasks.length > 0 ? Math.max(...longTasks) : 0,
      layoutShift,
      longTaskSupported,
      layoutShiftSupported,
    };
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
  console.info(
    `[root-tab-performance] ${testInfo.project.name} ${JSON.stringify(metrics)}`
  );
  await testInfo.attach("root-tab-performance.json", {
    body: JSON.stringify(
      { project: testInfo.project.name, ...metrics },
      null,
      2
    ),
    contentType: "application/json",
  });

  expect(metrics.frames).toBeGreaterThanOrEqual(32);
  expect(metrics.p95).toBeLessThanOrEqual(20);
  expect(metrics.longTaskSupported).toBe(true);
  expect(metrics.layoutShiftSupported).toBe(true);
  expect(metrics.maxLongTask).toBe(0);
  expect(metrics.layoutShift).toBe(0);
});

test("push transition meets mobile frame cadence and long-task budgets", async ({
  page,
}) => {
  await page.waitForTimeout(600);

  const metricsPromise = page.evaluate(async () => {
    const intervals: number[] = [];
    const longTasks: number[] = [];
    let previous = performance.now();
    let observer: PerformanceObserver | undefined;

    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTasks.push(entry.duration);
        }
      });
      observer.observe({ entryTypes: ["longtask"] });
    }

    const startedAt = performance.now();
    await new Promise<void>((resolve) => {
      const sample = (now: number) => {
        intervals.push(now - previous);
        previous = now;
        if (now - startedAt >= 800) {
          resolve();
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });

    observer?.disconnect();
    return {
      frames: intervals.length,
      maxInterval: Math.max(...intervals),
      maxLongTask: longTasks.length > 0 ? Math.max(...longTasks) : 0,
    };
  });

  await page.waitForTimeout(40);
  await page
    .locator(libraryRootSelector)
    .getByRole("button", { name: /\u85cf\u4e66/ })
    .first()
    .click();
  const metrics = await metricsPromise;

  expect(metrics.frames).toBeGreaterThanOrEqual(40);
  expect(metrics.maxInterval).toBeLessThanOrEqual(80);
  expect(metrics.maxLongTask).toBeLessThanOrEqual(100);
});
