import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);

describe("persistent app surfaces", () => {
  it("keeps the library mounted while switching tabs", () => {
    expect(pageSource).not.toContain(
      '{activeTab === "library" && ('
    );
    expect(pageSource).toContain("styles.tabPageInactive");
    expect(pageSource).toContain('aria-hidden={activeTab !== "library"}');
  });
});
