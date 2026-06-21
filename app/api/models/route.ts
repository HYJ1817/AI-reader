import {
  buildAiModelListRequest,
  extractAiModels,
} from "@/lib/aiModelList";
import {
  sanitizeAiProvider,
  type AiProviderConfig,
} from "@/lib/aiProviders";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
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
    upstream = await fetch(modelRequest.url, modelRequest.init);
  } catch {
    return Response.json({ error: "Model refresh failed" }, { status: 502 });
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
