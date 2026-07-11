import {
  buildAiModelListRequest,
  extractAiModels,
} from "@/lib/aiModelList";
import {
  sanitizeAiProvider,
  type AiProviderConfig,
} from "@/lib/aiProviders";
import {
  AiRequestError,
  fetchAiUpstream,
  readLimitedJson,
} from "@/lib/aiRequestSecurity";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readLimitedJson(request, 64_000);
  } catch (error) {
    const status = error instanceof AiRequestError ? error.status : 400;
    const message = error instanceof Error ? error.message : "Invalid JSON body";
    return Response.json({ error: message }, { status });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { provider } = body as { provider?: unknown };
  const resolvedProvider: AiProviderConfig | null = provider
    ? sanitizeAiProvider(provider)
    : null;

  if (
    !resolvedProvider ||
    !resolvedProvider.baseUrl.trim() ||
    !resolvedProvider.apiKey.trim()
  ) {
    return Response.json(
      { error: "Missing required fields: provider.baseUrl, provider.apiKey" },
      { status: 400 }
    );
  }

  let modelRequest: ReturnType<typeof buildAiModelListRequest>;
  try {
    modelRequest = buildAiModelListRequest(resolvedProvider);
  } catch {
    return Response.json({ error: "Invalid baseUrl" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetchAiUpstream(modelRequest.url, modelRequest.init, {
      allowLocalDevelopment: process.env.NODE_ENV !== "production",
    });
  } catch (error) {
    const status = error instanceof AiRequestError ? error.status : 502;
    return Response.json({ error: "Model refresh failed" }, { status });
  }

  if (!upstream.ok) {
    const status = upstream.status >= 400 && upstream.status < 600
      ? upstream.status
      : 502;
    return Response.json({ error: "Model refresh failed" }, { status });
  }

  let data: unknown;
  try {
    data = await upstream.json();
  } catch {
    return Response.json(
      { error: "Model refresh failed: invalid response" },
      { status: 502 }
    );
  }

  try {
    return Response.json({ models: extractAiModels(resolvedProvider, data) });
  } catch {
    return Response.json(
      { error: "Model refresh failed: unexpected response format" },
      { status: 502 }
    );
  }
}
