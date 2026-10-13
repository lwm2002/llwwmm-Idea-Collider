import type { Connection } from '../types';
const normalized = (text: string) =>
  text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s，。！？、,.;:：·-]+/g, '');
export function freshConnections(existing: Connection[], incoming: Connection[]): Connection[] {
  const titles = new Set(existing.map((c) => normalized(c.title)));
  const pairs = new Set(
    existing.map((c) =>
      JSON.stringify([
        normalized(c.conceptAProperty),
        normalized(c.conceptBProperty),
        normalized(c.dimension ?? ''),
      ]),
    ),
  );
  return incoming.filter((c) => {
    const title = normalized(c.title),
      key = JSON.stringify([
        normalized(c.conceptAProperty),
        normalized(c.conceptBProperty),
        normalized(c.dimension ?? ''),
      ]);
    if (titles.has(title) || pairs.has(key)) return false;
    titles.add(title);
    pairs.add(key);
    return true;
  });
}
