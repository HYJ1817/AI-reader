const MAX_COVER_BYTES = 2_097_152;
const MAX_REDIRECTS = 2;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ALLOWED_HOSTS = new Set([
  "covers.openlibrary.org",
  "books.google.com",
]);

type CoverSource = "open-library" | "google-books";

function isValidReference(source: string | null, id: string | null): source is CoverSource {
  if (!id) return false;
  if (source === "open-library") {
    return /^(?:OL\d+[MW]|\d{1,20}|\d{9}[\dXx])$/.test(id);
  }
  if (source === "google-books") {
    return /^[A-Za-z0-9_-]{1,128}$/.test(id);
  }
  return false;
}

function buildCoverUrl(source: CoverSource, id: string): URL {
  if (source === "open-library") {
    const keyType = /^OL/.test(id) ? "olid" : "isbn";
    return new URL(
      `https://covers.openlibrary.org/b/${keyType}/${encodeURIComponent(id)}-L.jpg`
    );
  }
  const url = new URL("https://books.google.com/books/content");
  url.searchParams.set("id", id);
  url.searchParams.set("printsec", "frontcover");
  url.searchParams.set("img", "1");
  url.searchParams.set("zoom", "2");
  url.searchParams.set("edge", "curl");
  return url;
}

async function fetchWithValidatedRedirects(initialUrl: URL): Promise<Response> {
  let url = initialUrl;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
      throw new Error("Invalid cover redirect");
    }
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(4_500),
      headers: { accept: "image/jpeg,image/png,image/webp,image/gif" },
    });
    if (response.status < 300 || response.status >= 400) return response;
    if (redirects === MAX_REDIRECTS) throw new Error("Too many cover redirects");
    const location = response.headers.get("location");
    if (!location) throw new Error("Missing cover redirect location");
    url = new URL(location, url);
  }
  throw new Error("Too many cover redirects");
}

async function readImageBytes(response: Response): Promise<Uint8Array | undefined> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_COVER_BYTES) return undefined;
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_COVER_BYTES) {
      await reader.cancel().catch(() => undefined);
      return undefined;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const source = requestUrl.searchParams.get("source");
  const id = requestUrl.searchParams.get("id");
  if (!isValidReference(source, id)) {
    return Response.json({ error: "Invalid cover reference" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetchWithValidatedRedirects(buildCoverUrl(source, id));
  } catch {
    return Response.json({ error: "Cover request failed" }, { status: 502 });
  }
  if (!upstream.ok) {
    return Response.json({ error: "Cover request failed" }, { status: 502 });
  }
  const contentType = upstream.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase();
  if (!contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) {
    return Response.json({ error: "Unsupported cover image" }, { status: 415 });
  }
  let bytes: Uint8Array | undefined;
  try {
    bytes = await readImageBytes(upstream);
  } catch {
    return Response.json({ error: "Cover request failed" }, { status: 502 });
  }
  if (!bytes) {
    return Response.json({ error: "Cover image too large" }, { status: 413 });
  }
  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  return new Response(copied.buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(copied.byteLength),
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
