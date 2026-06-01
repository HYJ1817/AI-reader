function uniqueOrdered(ids: string[]): string[] {
  return [...new Set(ids)];
}

export function toggleBookSelection(selectedIds: string[], bookId: string): string[] {
  const uniqueSelected = uniqueOrdered(selectedIds);
  if (uniqueSelected.includes(bookId)) {
    return uniqueSelected.filter((id) => id !== bookId);
  }
  return [...uniqueSelected, bookId];
}

export function pruneSelectedBookIds(
  selectedIds: string[],
  availableBookIds: string[]
): string[] {
  const available = new Set(availableBookIds);
  return uniqueOrdered(selectedIds).filter((id) => available.has(id));
}

export function selectAllBookIds(...bookIdGroups: string[][]): string[] {
  return uniqueOrdered(bookIdGroups.flat());
}
