import { describe, expect, it } from "vitest";
import { classifyAiModelRefreshFailure } from "./aiModelRefresh";

describe("classifyAiModelRefreshFailure", () => {
  it.each([
    [401, "auth", false],
    [402, "billing", false],
    [429, "rate-limit", true],
    [408, "network", true],
    [502, "network", true],
  ] as const)("maps %s to %s", (status, code, retryable) => {
    expect(classifyAiModelRefreshFailure(status)).toEqual({ code, retryable });
  });

  it("classifies an exception without status as a retryable network failure", () => {
    expect(classifyAiModelRefreshFailure(null)).toEqual({
      code: "network",
      retryable: true,
    });
  });
});
