import JSZip from "jszip";

export type EpubCoverManifestItem = {
  href: string;
  mediaType?: string;
};

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

function parseAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrPattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (const match of source.matchAll(attrPattern)) {
    attrs[match[1]] = match[2] ?? match[3] ?? "";
  }
  return attrs;
}

function tagAttributes(xml: string, tagName: string): Record<string, string>[] {
  const pattern = new RegExp(`<(?:[\\w-]+:)?${tagName}\\b([^>]*)>`, "gi");
  return [...xml.matchAll(pattern)].map((match) => parseAttributes(match[1] ?? ""));
}

function isImageMimeType(mediaType?: string): boolean {
  if (!mediaType) return false;
  return IMAGE_MIME_TYPES.has(mediaType.toLowerCase());
}

function isLikelyImagePath(path: string): boolean {
  return /\.(jpe?g|png|webp|gif|svg)$/i.test(path);
}

function inferImageMimeType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

export function findEpubCoverManifestItem(opfXml: string): EpubCoverManifestItem | undefined {
  const manifestItems = tagAttributes(opfXml, "item");

  const epub3Cover = manifestItems.find((item) =>
    (item.properties ?? "")
      .split(/\s+/)
      .some((property) => property.toLowerCase() === "cover-image")
  );
  if (epub3Cover?.href) {
    return { href: epub3Cover.href, mediaType: epub3Cover["media-type"] };
  }

  const coverMeta = tagAttributes(opfXml, "meta").find(
    (meta) => meta.name?.toLowerCase() === "cover" && meta.content
  );
  if (coverMeta?.content) {
    const epub2Cover = manifestItems.find((item) => item.id === coverMeta.content);
    if (epub2Cover?.href) {
      return { href: epub2Cover.href, mediaType: epub2Cover["media-type"] };
    }
  }

  const fallbackCover = manifestItems.find((item) => {
    const href = item.href ?? "";
    return (
      href &&
      (isImageMimeType(item["media-type"]) || isLikelyImagePath(href)) &&
      /cover|front/i.test(`${item.id ?? ""} ${href}`)
    );
  });

  return fallbackCover?.href
    ? { href: fallbackCover.href, mediaType: fallbackCover["media-type"] }
    : undefined;
}

export function resolveEpubResourcePath(opfPath: string, href: string): string {
  const cleanedHref = decodeURIComponent(href.split("#")[0]?.split("?")[0] ?? "").replace(/^\/+/, "");
  const baseParts = opfPath.split("/").slice(0, -1);
  const parts = [...baseParts, ...cleanedHref.split("/")];
  const normalized: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      normalized.pop();
    } else {
      normalized.push(part);
    }
  }

  return normalized.join("/");
}

function findRootfilePath(containerXml: string): string | undefined {
  return tagAttributes(containerXml, "rootfile").find((rootfile) => rootfile["full-path"])?.[
    "full-path"
  ];
}

export async function extractEpubCoverImage(fileBlob: Blob): Promise<Blob | undefined> {
  try {
    const zip = await JSZip.loadAsync(await fileBlob.arrayBuffer());
    const container = zip.file("META-INF/container.xml");
    if (!container) return undefined;

    const containerXml = await container.async("text");
    const opfPath = findRootfilePath(containerXml);
    if (!opfPath) return undefined;

    const opfFile = zip.file(opfPath);
    if (!opfFile) return undefined;

    const coverItem = findEpubCoverManifestItem(await opfFile.async("text"));
    if (!coverItem?.href) return undefined;

    const coverPath = resolveEpubResourcePath(opfPath, coverItem.href);
    const coverFile = zip.file(coverPath);
    if (!coverFile) return undefined;

    const bytes = await coverFile.async("uint8array");
    const copiedBytes = new Uint8Array(bytes.byteLength);
    copiedBytes.set(bytes);
    const mediaType =
      coverItem.mediaType && isImageMimeType(coverItem.mediaType)
        ? coverItem.mediaType
        : inferImageMimeType(coverPath);

    return new Blob([copiedBytes.buffer as ArrayBuffer], { type: mediaType });
  } catch {
    return undefined;
  }
}
