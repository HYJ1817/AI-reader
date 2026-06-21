import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
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

function containsNavigationClassCall(node: ts.Node, tab: string): boolean {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "getNavigationSurfaceClass" &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0]) &&
    node.arguments[0].text === tab
  ) {
    return true;
  }

  return node.getChildren(pageAst).some((child) =>
    containsNavigationClassCall(child, tab)
  );
}

function containsIdentifier(node: ts.Node, identifier: string): boolean {
  if (ts.isIdentifier(node) && node.text === identifier) return true;
  return node.getChildren(pageAst).some((child) =>
    containsIdentifier(child, identifier)
  );
}

function containsNode(container: ts.Node, target: ts.Node): boolean {
  return target.pos >= container.pos && target.end <= container.end;
}

function hasActiveTabMountingAncestor(node: ts.Node): boolean {
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (
      ts.isBinaryExpression(ancestor) &&
      ancestor.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
      containsNode(ancestor.right, node) &&
      containsIdentifier(ancestor.left, "activeTab")
    ) {
      return true;
    }

    if (
      ts.isConditionalExpression(ancestor) &&
      (containsNode(ancestor.whenTrue, node) ||
        containsNode(ancestor.whenFalse, node)) &&
      containsIdentifier(ancestor.condition, "activeTab")
    ) {
      return true;
    }

    if (
      ts.isIfStatement(ancestor) &&
      (containsNode(ancestor.thenStatement, node) ||
        Boolean(
          ancestor.elseStatement &&
            containsNode(ancestor.elseStatement, node)
        )) &&
      containsIdentifier(ancestor.expression, "activeTab")
    ) {
      return true;
    }
  }

  return false;
}

describe("persistent app surfaces", () => {
  it.each(primarySurfaces)(
    "keeps <%s> mounted with the %s navigation class",
    (component, tab) => {
      const opening = findComponentOpening(component);

      expect(opening, `Home should render <${component}>`).toBeDefined();
      if (!opening) return;

      const className = opening.attributes.properties.find(
        (attribute): attribute is ts.JsxAttribute =>
          ts.isJsxAttribute(attribute) &&
          attribute.name.getText(pageAst) === "className"
      );
      const classNameExpression =
        className?.initializer && ts.isJsxExpression(className.initializer)
          ? className.initializer.expression
          : undefined;

      expect(
        classNameExpression &&
          containsNavigationClassCall(classNameExpression, tab),
        `<${component}> className should call getNavigationSurfaceClass("${tab}")`
      ).toBe(true);
      expect(
        hasActiveTabMountingAncestor(opening),
        `<${component}> should not be conditionally mounted from activeTab`
      ).toBe(false);
    }
  );

  it("renders one shared bottom-tab indicator", () => {
    expect(pageSource).toContain("styles.tabIndicator");
    expect(pageSource).toContain('"--tab-index": getNavigationTabIndex(activeTab)');
  });
});
