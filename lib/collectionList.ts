export type CollectionListIcon = "stack" | "doc" | "folder";

export type CollectionListItem = {
  id: string;
  filter: string | null;
  name: string;
  count: number;
  icon: CollectionListIcon;
};

type MinimalBook = { groupIds?: string[] };
type MinimalGroup = { id: string; name: string };

const ALL_BOOKS_LABEL = "\u5168\u90e8";
const UNGROUPED_LABEL = "\u672a\u5206\u7ec4";

export function buildCollectionListItems(
  books: MinimalBook[],
  groups: MinimalGroup[],
  allLabel: string = ALL_BOOKS_LABEL,
  ungroupedLabel: string = UNGROUPED_LABEL,
): CollectionListItem[] {
  const ungroupedCount = books.filter(
    (b) => !b.groupIds || b.groupIds.length === 0,
  ).length;

  return [
    { id: "__all", filter: null, name: allLabel, count: books.length, icon: "stack" },
    { id: "__ungrouped", filter: "__ungrouped", name: ungroupedLabel, count: ungroupedCount, icon: "doc" },
    ...groups.map((group) => ({
      id: group.id,
      filter: group.id,
      name: group.name,
      count: books.filter((b) => b.groupIds?.includes(group.id)).length,
      icon: "folder" as CollectionListIcon,
    })),
  ];
}
