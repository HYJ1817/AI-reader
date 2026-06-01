import type { BookRecord } from "./db";

type BackfillDependencies = {
  extractCoverImage: (fileBlob: Blob) => Promise<Blob | undefined>;
  saveBook: (book: BookRecord) => Promise<void>;
};

export async function backfillMissingBookCovers(
  books: BookRecord[],
  { extractCoverImage, saveBook }: BackfillDependencies
): Promise<{ books: BookRecord[]; updatedCount: number }> {
  const updatedBooks = [...books];
  let updatedCount = 0;

  for (let index = 0; index < updatedBooks.length; index++) {
    const book = updatedBooks[index];
    if (book.format !== "epub" || book.coverImageBlob) continue;

    const coverImageBlob = await extractCoverImage(book.fileBlob);
    if (!coverImageBlob) continue;

    const updatedBook = { ...book, coverImageBlob };
    await saveBook(updatedBook);
    updatedBooks[index] = updatedBook;
    updatedCount += 1;
  }

  return { books: updatedBooks, updatedCount };
}
