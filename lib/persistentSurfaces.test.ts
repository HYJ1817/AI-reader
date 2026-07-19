import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);
const navigationSource = readFileSync(
  new URL("../app/AppNavigation.tsx", import.meta.url),
  "utf8"
);
const navigationStackUrl = new URL(
  "../app/NavigationStack.tsx",
  import.meta.url
);
const navigationStackSource = existsSync(navigationStackUrl)
  ? readFileSync(navigationStackUrl, "utf8")
  : "";
const pageCssSource = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);
const pageAst = ts.createSourceFile(
  "page.tsx",
  pageSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

const primarySurfaces = [
  ["LibrarySurface", "library"],
  ["ReadingDashboard", "reading"],
  ["SettingsSurface", "settings"],
] as const;

function findComponentOpening(
  component: string
): ts.JsxOpeningElement | ts.JsxSelfClosingElement | undefined {
  let match: ts.JsxOpeningElement | ts.JsxSelfClosingElement | undefined;

  function visit(node: ts.Node): void {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(pageAst) === component
    ) {
      match = node;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(pageAst);
  return match;
}

function containsNode(container: ts.Node, target: ts.Node): boolean {
  return target.pos >= container.pos && target.end <= container.end;
}

function hasConditionalMountingAncestor(node: ts.Node): boolean {
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (
      ts.isBinaryExpression(ancestor) &&
      ancestor.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      return true;
    }

    if (
      ts.isConditionalExpression(ancestor) &&
      (containsNode(ancestor.whenTrue, node) ||
        containsNode(ancestor.whenFalse, node))
    ) {
      return true;
    }

    if (
      ts.isIfStatement(ancestor) &&
      (containsNode(ancestor.thenStatement, node) ||
        Boolean(
          ancestor.elseStatement &&
            containsNode(ancestor.elseStatement, node)
        ))
    ) {
      return true;
    }
  }

  return false;
}

function findEnclosingNavigationRootTab(node: ts.Node): string | undefined {
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (
      ts.isJsxElement(ancestor) &&
      ancestor.openingElement.tagName.getText(pageAst) === "NavigationRoot"
    ) {
      const tabAttribute = ancestor.openingElement.attributes.properties.find(
        (attribute): attribute is ts.JsxAttribute =>
          ts.isJsxAttribute(attribute) &&
          attribute.name.getText(pageAst) === "tab"
      );

      return tabAttribute?.initializer &&
        ts.isStringLiteral(tabAttribute.initializer)
        ? tabAttribute.initializer.text
        : undefined;
    }
  }
  return undefined;
}

describe("persistent app surfaces", () => {
  it.each(primarySurfaces)(
    "keeps <%s> mounted in the %s root slot",
    (component, tab) => {
      const opening = findComponentOpening(component);

      expect(opening, `Home should render <${component}>`).toBeDefined();
      if (!opening) return;

      expect(
        findEnclosingNavigationRootTab(opening),
        `<${component}> should be supplied through NavigationStack.${tab}`
      ).toBe(tab);
      expect(
        hasConditionalMountingAncestor(opening),
        `<${component}> should not have a conditional mounting ancestor`
      ).toBe(false);
    }
  );

  it("renders all three roots through Motion sections", () => {
    expect(pageSource).toContain("<NavigationStack");
    expect(navigationStackSource).toContain("m.section");
    expect(navigationStackSource).toContain("inert");
    expect(navigationStackSource).toContain("pointerEvents");
    expect(navigationStackSource).toContain("useAppReducedMotion");
    expect(navigationStackSource).toContain("MOTION_SPRING.navigation");
  });

  it("renders one shared bottom-tab indicator", () => {
    expect(navigationSource).toContain("styles.tabIndicator");
    expect(navigationSource).toContain('layoutId="root-tab-indicator"');
    expect(navigationSource).toContain("ROOT_TAB_TRANSITION");
    expect(navigationSource).not.toContain("MOTION_SPRING.navigation");
    expect(navigationSource).not.toContain('"--tab-index"');
  });

  it("removes the legacy root transition state classes", () => {
    expect(pageSource).not.toContain("getNavigationSurfaceClass");
    expect(pageCssSource).not.toMatch(/\.appSurfaceBefore\b/);
    expect(pageCssSource).not.toMatch(/\.appSurfaceAfter\b/);
    expect(pageCssSource).not.toMatch(/\.readerSessionInactive\b/);
    expect(pageCssSource).not.toMatch(/\.readerSessionActive\b/);
    expect(pageCssSource).not.toMatch(/\.readingDashboardReaderOpen\b/);
  });

  it("keeps the shared reader host mounted so presence can finish exits", () => {
    const opening = findComponentOpening("SharedBookTransition");

    expect(opening, "Home should render <SharedBookTransition>").toBeDefined();
    if (!opening) return;

    expect(
      hasConditionalMountingAncestor(opening),
      "<SharedBookTransition> should not have a conditional mounting ancestor"
    ).toBe(false);
  });
});
