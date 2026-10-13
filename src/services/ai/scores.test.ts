import { describe, expect, it } from 'vitest';
import { formatScore, normalizeScore } from './scores';
import { conceptMap } from '../../data/concepts';
import { localGenerator } from './localGenerator';
import { initialData, parseImport } from '../storage';

describe('评分格式兼容及未知评分', () => {
  it.each([
    [0, 0],
    [0.8, 0.8],
    [100, 100],
    [' 85.5 ', 85.5],
    ['８０％', 80],
    ['75分', 75],
    ['8/10', 80],
    ['3/5', 60],
    ['90/100', 90],
    [null, null],
    [undefined, null],
    ['', null],
    [' ', null],
    [false, null],
    ['高', null],
    ['85abc', null],
    [-1, null],
    [200, null],
    [Infinity, null],
    ['11/10', null],
    ['1/2', null],
    ['80%-90%', null],
  ])('评分 %s 解析为 %s', (input, expected) => {
    expect(normalizeScore(input)).toBe(expected);
  });
  it('未评分连接可生成离线发明、演化、评审和备份恢复，空值不会变成零分', async () => {
    const a = conceptMap['蜂群'],
      b = conceptMap['金刚石'];
    const connection = {
      ...(await localGenerator.generateConnections(a, b))[0],
      novelty: null,
      plausibility: null,
    };
    const ideas = await localGenerator.generateIdeas(a, b, connection, 'unscored');
    expect(ideas.every((idea) => idea.novelty === null && idea.feasibility === null)).toBe(true);
    const child = await localGenerator.evolveIdea(ideas[0], '更实用', a, b);
    expect(child.novelty).toBeNull();
    expect(child.feasibility).toBeNull();
    expect((await localGenerator.criticizeIdea(child, a, b)).verdict).toBe('Needs Work');
    const data = initialData();
    data.collisions = [
      {
        id: 'unscored',
        conceptAId: a.id,
        conceptBId: b.id,
        connections: [connection],
        createdAt: new Date().toISOString(),
        source: 'api',
      },
    ];
    data.ideas = [...ideas, child];
    const restored = parseImport(JSON.stringify(data));
    expect(restored.collisions[0].connections[0].novelty).toBeNull();
    expect(restored.ideas.find((idea) => idea.id === child.id)?.feasibility).toBeNull();
    expect(formatScore(null)).toBe('未评分');
    expect(formatScore(0)).toBe('0');
  });
});
