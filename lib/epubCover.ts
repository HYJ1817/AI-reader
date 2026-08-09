import { extractEpubPackage } from "./epubPackage";

export type { EpubCoverManifestItem } from "./epubPackage";
export {
  findEpubCoverManifestItem,
  resolveEpubResourcePath,
} from "./epubPackage";

export async function extractEpubCoverImage(fileBlob: Blob): Promise<Blob | undefined> {
  return (await extractEpubPackage(fileBlob, { includeExcerpt: false })).coverImageBlob;
}
