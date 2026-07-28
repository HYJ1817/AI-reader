import {
  buildChatMessages,
  buildAiProviderRequest,
  type AiContext,
  type ChatConversationMessage,
} from "@/lib/aiChat";
import { normalizeAiProviderStream } from "@/lib/aiStream";
import {
  createAiProviderFromPreset,
  hasUsableAiProvider,
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
    body = await readLimitedJson(request);
  } catch (error) {
    const status = error instanceof AiRequestError ? error.status : 400;
    const message = error instanceof Error ? error.message : "Invalid JSON body";
    return Response.json({ error: message }, { status });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { provider, baseUrl, apiKey, model, question, context, messages, memory, summary } =
    body as {
      provider?: unknown;
      baseUrl?: string;
      apiKey?: string;
      model?: string;
      question?: string;
      context?: AiContext;
      messages?: ChatConversationMessage[];
      memory?: string;
      summary?: string;
    };

  const resolvedProvider: AiProviderConfig | null = provider
    ? sanitizeAiProvider(provider)
    : baseUrl && apiKey && model
      ? createAiProviderFromPreset("openai", {
          id: "request-openai-compatible",
          baseUrl,
          apiKey,
          model,
          appendDefaultPath: false,
        })
      : null;

  if (
    !resolvedProvider ||
    !hasUsableAiProvider(resolvedProvider) ||
    typeof question !== "string" ||
    !question.trim() ||
    question.length > 8_000 ||
    (messages !== undefined && (!Array.isArray(messages) || messages.length > 40)) ||
    (memory !== undefined && (typeof memory !== "string" || memory.length > 4_000)) ||
    (summary !== undefined && (typeof summary !== "string" || summary.length > 6_000))
  ) {
    return Response.json(
      { error: "Missing required fields: provider, question" },
      { status: 400 }
    );
  }

  let aiRequest: ReturnType<typeof buildAiProviderRequest>;
  try {
    aiRequest = buildAiProviderRequest(
      resolvedProvider,
      buildChatMessages(question, context ?? {}, messages ?? [], { memory, summary }),
      { stream: true }
    );
  } catch {
    return Response.json({ error: "Invalid baseUrl" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetchAiUpstream(aiRequest.url, aiRequest.init, {
      allowLocalDevelopment: process.env.NODE_ENV !== "production",
      streamResponse: true,
    });
  } catch (error) {
    const status = error instanceof AiRequestError ? error.status : 502;
    const message =
      error instanceof AiRequestError ? error.message : "AI request failed";
    return Response.json({ error: message }, { status });
  }

  if (!upstream.ok) {
    const status = upstream.status >= 400 && upstream.status < 600
      ? upstream.status
      : 502;
    return Response.json({ error: "AI request failed" }, { status });
  }

  if (!upstream.body) {
    return Response.json(
      { error: "AI request failed: missing response stream" },
      { status: 502 }
    );
  }

  return new Response(
    normalizeAiProviderStream(resolvedProvider.protocol, upstream.body),
    {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    }
  );
}
