import { buildAiProviderRequest } from "../../../../lib/aiChat";
import {
  buildMetadataAiMessages,
  parseMetadataAiResponse,
  type MetadataAiField,
} from "../../../../lib/bookMetadataAi";
import { BOOK_METADATA_LIMITS } from "../../../../lib/bookMetadata";
import {
  AiRequestError,
  fetchAiUpstream,
  readLimitedJson,
} from "../../../../lib/aiRequestSecurity";
import {
  hasUsableAiProvider,
  sanitizeAiProvider,
} from "../../../../lib/aiProviders";

const PROVENANCE = { source: "ai" as const, generated: true as const };

function parseMissing(value: unknown): MetadataAiField[] | undefined {
  if (!Array.isArray(value) || value.length > 2) return undefined;
  const result: MetadataAiField[] = [];
  for (const field of value) {
    if (field !== "description" && field !== "subjects") return undefined;
    if (!result.includes(field)) result.push(field);
  }
  return result;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readLimitedJson(request, 128_000);
  } catch (error) {
    const status = error instanceof AiRequestError ? error.status : 400;
    return Response.json(
      { error: status === 413 ? "Request body too large" : "Invalid JSON body" },
      { status }
    );
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid metadata completion request" }, { status: 400 });
  }
  const value = body as Record<string, unknown>;
  const missing = parseMissing(value.missing);
  if (!missing) {
    return Response.json({ error: "Invalid metadata completion request" }, { status: 400 });
  }
  if (missing.length === 0) {
    return Response.json(
      { completion: {}, provenance: PROVENANCE },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
  const provider = sanitizeAiProvider(value.provider);
  if (!provider || !hasUsableAiProvider(provider)) {
    return Response.json({ error: "Missing usable AI provider" }, { status: 400 });
  }
  if (
    (value.knownMetadata !== undefined &&
      (!value.knownMetadata || typeof value.knownMetadata !== "object" || Array.isArray(value.knownMetadata))) ||
    (value.excerpt !== undefined && typeof value.excerpt !== "string")
  ) {
    return Response.json({ error: "Invalid metadata completion request" }, { status: 400 });
  }

  try {
    const messages = buildMetadataAiMessages(
      value.knownMetadata,
      missing,
      typeof value.excerpt === "string"
        ? value.excerpt.slice(0, BOOK_METADATA_LIMITS.excerpt)
        : ""
    );
    const aiRequest = buildAiProviderRequest(provider, messages, { stream: false });
    const upstream = await fetchAiUpstream(aiRequest.url, aiRequest.init, {
      allowLocalDevelopment: process.env.NODE_ENV !== "production",
      timeoutMs: 15_000,
      maxResponseBytes: 64_000,
    });
    if (!upstream.ok) throw new Error("AI request failed");
    const payload = await upstream.json();
    const completion = parseMetadataAiResponse(provider.protocol, payload, missing);
    return Response.json(
      { completion, provenance: PROVENANCE },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json({ error: "AI request failed" }, { status: 502 });
  }
}
