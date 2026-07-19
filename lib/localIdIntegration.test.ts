import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const importBookSource = readFileSync(
  new URL("./importBook.ts", import.meta.url),
  "utf8"
);
const pageSource = readFileSync(
  new URL("../app/page.tsx", import.meta.url),
  "utf8"
);
const aiProvidersSource = readFileSync(
  new URL("./aiProviders.ts", import.meta.url),
  "utf8"
);

describe("old Android local ID integration", () => {
  it("does not call randomUUID directly for imported books or groups", () => {
    expect(importBookSource).toContain("createLocalId()");
    expect(importBookSource).not.toContain("crypto.randomUUID");
    expect(pageSource).toContain("createLocalId()");
    expect(pageSource).not.toContain("crypto.randomUUID");
  });

  it("only calls the AI provider UUID API after checking it is callable", () => {
    expect(aiProvidersSource).toContain(
      'typeof crypto.randomUUID === "function"'
    );
  });
});
