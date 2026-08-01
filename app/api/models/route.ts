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
import {
  classifyAiModelRefreshFailure,
  type AiModelRefreshErrorCode,
} from "@/lib/aiModelRefresh";

function refreshFailureResponse(
  status: number,
  error: string,
  errorCode: AiModelRefreshErrorCode,
  retryable: boolean
) {
  return Response.json(
    {
      error,
      errorCode,
      retryable,
    },
    { status }
  );
}

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
    const failure = classifyAiModelRefreshFailure(
      error instanceof AiRequestError ? error.status : null
    );
    const message =
      error instanceof AiRequestError ? error.message : "Model refresh failed";
    return refreshFailureResponse(
      status,
      message,
      failure.code,
      failure.retryable
    );
  }

  if (!upstream.ok) {
    const status = upstream.status >= 400 && upstream.status < 600
      ? upstream.status
      : 502;
    const failure = classifyAiModelRefreshFailure(upstream.status);
    return refreshFailureResponse(
      status,
      "Model refresh failed",
      failure.code,
      failure.retryable
    );
  }

  let data: unknown;
  try {
    data = await upstream.json();
  } catch {
    return refreshFailureResponse(
      502,
      "Model refresh failed: invalid response",
      "invalid-response",
      false
    );
  }

  try {
    return Response.json({ models: extractAiModels(resolvedProvider, data) });
  } catch {
    return refreshFailureResponse(
      502,
      "Model refresh failed: unexpected response format",
      "invalid-response",
      false
    );
  }
}
