import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sessionSource = readFileSync(
  new URL("../app/ReadingSession.tsx", import.meta.url),
  "utf8"
);
const css = readFileSync(
  new URL("../app/page.module.css", import.meta.url),
  "utf8"
);

function cssRule(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf("}", start);
  return start < 0 || end < 0 ? "" : css.slice(start, end);
}

describe("TXT reader typography", () => {
  it("uses start alignment unless the explicit justify preference is enabled", () => {
    const paragraphRule = cssRule(".paragraph");

    expect(paragraphRule).toContain("text-align: start");
    expect(paragraphRule).not.toContain("text-align: justify");
    expect(sessionSource).toMatch(
      /preferences\.customLayoutEnabled\s*&&\s*preferences\.justifyText[\s\S]*\?\s*"justify"[\s\S]*:\s*"start"/
    );
  });

  it("keeps imported text as semantic paragraphs without script heuristics", () => {
    expect(sessionSource).toContain("<p");
    expect(sessionSource).toContain("className={styles.paragraph}");
    expect(sessionSource).not.toContain("detectParagraphLanguage");
    expect(sessionSource).not.toContain("isLikelyHeading");
  });

  it("lets final content clear the menu affordance and safe area", () => {
    expect(sessionSource).toContain(
      "calc(var(--safe-bottom) + 96px)"
    );
    expect(sessionSource).toContain('data-txt-reader="true"');
  });
});
