export const BOOK_COVER_OBSERVER_MARGIN = "320px 0px";

type BookCoverLoadingInput = {
  hasCoverBlob: boolean;
  observerSupported: boolean;
  nearViewport: boolean;
};

export function shouldLoadBookCover({
  hasCoverBlob,
  observerSupported,
  nearViewport,
}: BookCoverLoadingInput): boolean {
  if (!hasCoverBlob) return false;
  return !observerSupported || nearViewport;
}
