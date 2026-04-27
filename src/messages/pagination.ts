export type Page<T extends { id: string }> = {
  items: T[];
  hasMore: boolean;
  nextCursor: string | null;
};

export function buildPage<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  if (rows.length <= limit) {
    return { items: rows, hasMore: false, nextCursor: null };
  }
  const items = rows.slice(0, limit);
  return { items, hasMore: true, nextCursor: items[items.length - 1].id };
}
