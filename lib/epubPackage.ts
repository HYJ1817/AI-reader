import JSZip from "jszip";
import {
  BOOK_METADATA_LIMITS,
  type BookIdentifier,
} from "./bookMetadata";

export type EpubCoverManifestItem = {
  href: string;
  mediaType?: string;
};

export type EpubPackageMetadata = {
  title?: string;
  authors?: string[];
  identifiers?: BookIdentifier[];
  language?: string;
};

export type EpubPackageExtraction = {
  metadata: EpubPackageMetadata;
  coverImageBlob?: Blob;
  excerpt?: string;
};

export type EpubPackageOptions = {
  includeExcerpt?: boolean;
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
    attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? "");
  }
  return attrs;
}

function tagAttributes(xml: string, tagName: string): Record<string, string>[] {
  const pattern = new RegExp(`<(?:[\\w-]+:)?${tagName}\\b([^>]*)>`, "gi");
  return [...xml.matchAll(pattern)].map((match) => parseAttributes(match[1] ?? ""));
}

function tagContents(
  xml: string,
  tagName: string
): Array<{ attributes: Record<string, string>; content: string }> {
  const pattern = new RegExp(
    `<(?:[\\w-]+:)?${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tagName}\\s*>`,
    "gi"
  );
  return [...xml.matchAll(pattern)].map((match) => ({
    attributes: parseAttributes(match[1] ?? ""),
    content: normalizeText(match[2] ?? ""),
  }));
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, key: string) => {
    if (key[0] === "#") {
      const hexadecimal = key[1]?.toLowerCase() === "x";
      const point = Number.parseInt(key.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    }
    return named[key.toLowerCase()] ?? entity;
  });
}

function normalizeText(value: string): string {
  return decodeEntities(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]*>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueBounded(values: string[], count: number, length: number): string[] | undefined {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeText(value).slice(0, length).trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= count) break;
  }
  return result.length > 0 ? result : undefined;
}

function isImageMimeType(mediaType?: string): boolean {
  return Boolean(mediaType && IMAGE_MIME_TYPES.has(mediaType.toLowerCase()));
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
  let decodedHref = href;
  try {
    decodedHref = decodeURIComponent(href);
  } catch {
    // Keep the original path when a publisher used malformed percent escapes.
  }
  const cleanedHref = decodedHref.split("#")[0]?.split("?")[0]?.replace(/^\/+/, "") ?? "";
  const parts = [...opfPath.split("/").slice(0, -1), ...cleanedHref.split("/")];
  const normalized: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") normalized.pop();
    else normalized.push(part);
  }
  return normalized.join("/");
}

function findRootfilePath(containerXml: string): string | undefined {
  return tagAttributes(containerXml, "rootfile").find((rootfile) => rootfile["full-path"])?.[
    "full-path"
  ];
}

function extractMetadata(opfXml: string): EpubPackageMetadata {
  const title = tagContents(opfXml, "title")[0]?.content.slice(0, BOOK_METADATA_LIMITS.title).trim();
  const authors = uniqueBounded(
    tagContents(opfXml, "creator").map(({ content }) => content),
    BOOK_METADATA_LIMITS.authorCount,
    BOOK_METADATA_LIMITS.author
  );
  const language = tagContents(opfXml, "language")[0]?.content
    .slice(0, BOOK_METADATA_LIMITS.language)
    .trim();

  const identifiers: BookIdentifier[] = [];
  const seen = new Set<string>();
  for (const identifier of tagContents(opfXml, "identifier")) {
    const value = identifier.content.slice(0, BOOK_METADATA_LIMITS.identifierValue).trim();
    if (!value) continue;
    const compact = value.replace(/[\s-]/g, "");
    const hints = `${identifier.attributes.id ?? ""} ${identifier.attributes["opf:scheme"] ?? ""}`;
    const type = /isbn/i.test(hints) || /^(?:\d{9}[\dX]|\d{13})$/i.test(compact)
      ? "ISBN"
      : "IDENTIFIER";
    const key = `${type}\u0000${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    identifiers.push({ type, value });
    if (identifiers.length >= BOOK_METADATA_LIMITS.identifiers) break;
  }

  return {
    ...(title ? { title } : {}),
    ...(authors ? { authors } : {}),
    ...(identifiers.length > 0 ? { identifiers } : {}),
    ...(language ? { language } : {}),
  };
}

async function extractCover(
  zip: JSZip,
  opfPath: string,
  opfXml: string
): Promise<Blob | undefined> {
  const coverItem = findEpubCoverManifestItem(opfXml);
  if (!coverItem?.href) return undefined;
  const coverPath = resolveEpubResourcePath(opfPath, coverItem.href);
  const coverFile = zip.file(coverPath);
  if (!coverFile) return undefined;
  const bytes = await coverFile.async("uint8array");
  const copiedBytes = new Uint8Array(bytes.byteLength);
  copiedBytes.set(bytes);
  const mediaType = isImageMimeType(coverItem.mediaType)
    ? coverItem.mediaType
    : inferImageMimeType(coverPath);
  return new Blob([copiedBytes.buffer], { type: mediaType });
}

async function extractSpineExcerpt(
  zip: JSZip,
  opfPath: string,
  opfXml: string
): Promise<string | undefined> {
  const manifestById = new Map(
    tagAttributes(opfXml, "item")
      .filter((item) => item.id && item.href)
      .map((item) => [item.id, item] as const)
  );
  const spineItems = tagAttributes(opfXml, "itemref")
    .map((item) => manifestById.get(item.idref ?? ""))
    .filter(
      (item): item is Record<string, string> =>
        Boolean(
          item?.href &&
            (/x?html/i.test(item["media-type"] ?? "") || /\.x?html?$/i.test(item.href))
        )
    )
    .slice(0, 3);

  let excerpt = "";
  for (const item of spineItems) {
    const chapter = zip.file(resolveEpubResourcePath(opfPath, item.href));
    if (!chapter) continue;
    const markup = await chapter.async("text");
    const text = normalizeText(
      markup.replace(/<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    );
    if (!text) continue;
    excerpt = `${excerpt} ${text}`.trim().slice(0, BOOK_METADATA_LIMITS.excerpt);
    if (excerpt.length >= BOOK_METADATA_LIMITS.excerpt) break;
  }
  return excerpt || undefined;
}

export async function extractEpubPackage(
  fileBlob: Blob,
  options: EpubPackageOptions = {}
): Promise<EpubPackageExtraction> {
  try {
    const zip = await JSZip.loadAsync(await fileBlob.arrayBuffer());
    const container = zip.file("META-INF/container.xml");
    if (!container) return { metadata: {} };
    const opfPath = findRootfilePath(await container.async("text"));
    if (!opfPath) return { metadata: {} };
    const opfFile = zip.file(opfPath);
    if (!opfFile) return { metadata: {} };
    const opfXml = await opfFile.async("text");
    const [coverImageBlob, excerpt] = await Promise.all([
      extractCover(zip, opfPath, opfXml),
      options.includeExcerpt ? extractSpineExcerpt(zip, opfPath, opfXml) : undefined,
    ]);
    return {
      metadata: extractMetadata(opfXml),
      ...(coverImageBlob ? { coverImageBlob } : {}),
      ...(excerpt ? { excerpt } : {}),
    };
  } catch {
    return { metadata: {} };
  }
}

export async function extractOpeningExcerpt(
  fileBlob: Blob,
  format: "epub" | "txt"
): Promise<string> {
  if (format === "epub") {
    return (await extractEpubPackage(fileBlob, { includeExcerpt: true })).excerpt ?? "";
  }
  return normalizeText(await fileBlob.text()).slice(0, BOOK_METADATA_LIMITS.excerpt);
}
