import { describe, expect, it } from "vitest";
import { metadataResponseJson } from "./bookMetadataResponse";

describe("metadataResponseJson", () => {
  it("keeps only safe endpoint error codes", async () => {
    await expect(metadataResponseJson(Response.json({ code: "timeout", error: "private payload" }, { status: 502 })))
      .rejects.toMatchObject({ code: "timeout", message: "Metadata request failed" });
  });
  it("does not expose arbitrary endpoint errors", async () => {
    await expect(metadataResponseJson(Response.json({ code: "secret", error: "private payload" }, { status: 500 })))
      .rejects.toMatchObject({ code: "provider", message: "Metadata request failed" });
  });
  it("recognizes timeout status without JSON", async () => {
    await expect(metadataResponseJson(new Response("private upstream payload", { status: 504 })))
      .rejects.toMatchObject({ code: "timeout" });
  });
  it("maps malformed successful JSON to invalid-response", async () => {
    await expect(metadataResponseJson(new Response("not json")))
      .rejects.toMatchObject({ code: "invalid-response" });
  });
});
