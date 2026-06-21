export type EpubTocItem = {
  id: string;
  label: string;
  href: string;
  children: EpubTocItem[];
};

export type FlatEpubTocItem = Omit<EpubTocItem, "children"> & {
  depth: number;
};

function isValidItem(item: unknown): item is Record<string, unknown> {
  return typeof item === "object" && item !== null;
}

function extractLabel(item: Record<string, unknown>): string {
  const raw = item.label ?? item.title ?? item.name ?? "";
  return typeof raw === "string" ? raw.trim() : "";
}

function extractHref(item: Record<string, unknown>): string {
  const raw = item.href ?? item.url ?? item.link ?? "";
  return typeof raw === "string" ? raw.trim() : "";
}

function extractChildren(item: Record<string, unknown>): unknown[] {
  if (Array.isArray(item.children)) return item.children;
  if (Array.isArray(item.subitems)) return item.subitems;
  if (Array.isArray(item.subItems)) return item.subItems;
  return [];
}

function normalizeItems(items: unknown[], prefix: string): EpubTocItem[] {
  const result: EpubTocItem[] = [];

  for (const [index, raw] of items.entries()) {
    if (!isValidItem(raw)) continue;

    const label = extractLabel(raw);
    const href = extractHref(raw);
    const id = prefix ? `${prefix}-${index}` : `toc-${index}`;
    const children = normalizeItems(extractChildren(raw), id);

    if (label && href) {
      result.push({ id, label, href, children });
    } else if (children.length > 0) {
      result.push(...children);
    }
  }

  return result;
}

export function normalizeEpubNavigation(input: unknown): EpubTocItem[] {
  if (!input) return [];

  if (Array.isArray(input)) {
    return normalizeItems(input, "toc");
  }

  if (isValidItem(input)) {
    const nav = input as Record<string, unknown>;
    if (Array.isArray(nav.toc)) {
      return normalizeItems(nav.toc, "toc");
    }
  }

  return [];
}

export function flattenEpubNavigation(
  items: EpubTocItem[]
): FlatEpubTocItem[] {
  const flattened: FlatEpubTocItem[] = [];

  function visit(nodes: EpubTocItem[], depth: number) {
    for (const node of nodes) {
      flattened.push({
        id: node.id,
        label: node.label,
        href: node.href,
        depth,
      });
      if (node.children.length > 0) {
        visit(node.children, depth + 1);
      }
    }
  }

  visit(items, 0);
  return flattened;
}
