import { buildPage } from './pagination';

type Row = { id: string };

const rows: Row[] = Array.from({ length: 6 }, (_, i) => ({ id: `msg_${i}` }));

describe('buildPage', () => {
  it('returns the rows untouched when fewer than the limit', () => {
    const page = buildPage(rows.slice(0, 3), 5);
    expect(page.items).toHaveLength(3);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('exactly matches limit but no more — no extra page', () => {
    const page = buildPage(rows.slice(0, 5), 5);
    expect(page.items).toHaveLength(5);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('marks hasMore and trims the extra row', () => {
    const page = buildPage(rows.slice(0, 6), 5);
    expect(page.items).toHaveLength(5);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe('msg_4');
  });

  it('returns empty page cleanly', () => {
    expect(buildPage([], 50)).toEqual({ items: [], hasMore: false, nextCursor: null });
  });
});
