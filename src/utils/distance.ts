import { concepts } from '../data/concepts';
import type { Concept } from '../types';
import { pick } from './id';
const neighbors = [
  ['材料', '化学', '物理'],
  ['生物', '医学', '海洋'],
  ['电子', '光学', '计算机', '人工智能'],
  ['机械', '交通', '建筑'],
  ['艺术', '音乐', '日常用品'],
  ['能源', '太空', '自然现象'],
];
export function conceptDistance(a: Concept, b: Concept): number {
  if (a.id === b.id) return 0;
  const shared =
    a.tags.filter((t) => b.tags.includes(t)).length / new Set([...a.tags, ...b.tags]).size;
  const categoryDistance =
    a.category === b.category
      ? 0.1
      : neighbors.some((g) => g.includes(a.category) && g.includes(b.category))
        ? 0.5
        : 1;
  const related = a.relatedConcepts.includes(b.id) || b.relatedConcepts.includes(a.id);
  return Math.max(
    0.05,
    Math.min(1, categoryDistance * 0.65 + (1 - shared) * 0.35 - (related ? 0.15 : 0)),
  );
}
export function randomPair(level: number, pool: Concept[] = concepts): [string, string] {
  const a = pick(pool);
  const target = 0.12 + (level / 100) * 0.88;
  const candidates = pool
    .filter((b) => b.id !== a.id)
    .map((b) => ({ b, gap: Math.abs(conceptDistance(a, b) - target) }))
    .sort((x, y) => x.gap - y.gap)
    .slice(0, 12);
  return [a.id, pick(candidates).b.id];
}
