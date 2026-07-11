export class AiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "AiRequestError";
  }
}

type SafeUrlOptions = {
  allowLocalDevelopment?: boolean;
};

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) {
    return false;
  }

  const octets = parts.map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) {
    return true;
  }

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function isPrivateIpv6(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!normalized.includes(":")) return false;

  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;

  const firstSegment = Number.parseInt(normalized.split(":", 1)[0] || "0", 16);
  if (firstSegment >= 0xfe80 && firstSegment <= 0xfebf) return true;

  const mappedIpv4 = normalized.match(/(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mappedIpv4 ? isPrivateIpv4(mappedIpv4) : false;
}

function isLocalHostname(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized.endsWith(".home.arpa") ||
    isPrivateIpv4(normalized) ||
    isPrivateIpv6(normalized)
  );
}

export function assertSafeAiUpstreamUrl(
  input: string,
  options: SafeUrlOptions = {}
) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new AiRequestError("Invalid AI upstream URL", 400);
  }

  if (url.username || url.password) {
    throw new AiRequestError("AI upstream URL must not include credentials", 400);
  }

  const localDevelopmentUrl =
    options.allowLocalDevelopment &&
    url.protocol === "http:" &&
    isLocalHostname(url.hostname);

  if (url.protocol !== "https:" && !localDevelopmentUrl) {
    throw new AiRequestError("AI upstream must use HTTPS", 400);
  }

  if (isLocalHostname(url.hostname) && !localDevelopmentUrl) {
    throw new AiRequestError("Private AI upstream addresses are not allowed", 400);
  }

  return url.toString().replace(/\/$/, "");
}

async function readStreamWithLimit(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  error: AiRequestError
) {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw error;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function readLimitedJson(request: Request, maxBytes = 256_000) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new AiRequestError("Request body too large", 413);
  }

  const text = await readStreamWithLimit(
    request.body,
    maxBytes,
    new AiRequestError("Request body too large", 413)
  );

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AiRequestError("Invalid JSON body", 400);
  }
}

export async function fetchAiUpstream(
  input: string,
  init: RequestInit,
  options: SafeUrlOptions & {
    timeoutMs?: number;
    maxResponseBytes?: number;
  } = {}
) {
  const url = assertSafeAiUpstreamUrl(input, options);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);

  try {
    const response = await fetch(url, {
      ...init,
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.body) return response;

    const maxResponseBytes = options.maxResponseBytes ?? 2_000_000;
    const text = await readStreamWithLimit(
      response.body,
      maxResponseBytes,
      new AiRequestError("AI response too large", 502)
    );
    const bytes = new TextEncoder().encode(text);
    const responseBody =
      response.status === 204 || response.status === 205 || response.status === 304
        ? null
        : bytes;
    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}
