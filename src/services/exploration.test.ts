import { describe, it, expect, vi, afterEach } from 'vitest';
import { localGenerator } from './ai/localGenerator';
import { conceptMap } from '../data/concepts';
import { freshConnections } from '../utils/connections';
import { initialData, parseImport } from './storage';
import { explainConcept } from './ai/explainConcept';
import { localConceptDraft } from './conceptDraft';
import { concepts } from '../data/concepts';
import { materializeConcept } from '../utils/catalog';

afterEach(() => vi.unstubAllGlobals());
describe('持续探索与独立解释', () => {
  it('大量属性的离线碰撞不会枚举所有组合，重复随机值也能结束', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const properties = Array.from({ length: 2000 }, (_, i) => `结构网络${i}`);
      const a = { ...conceptMap['蜂群'], id: 'custom:large-a', properties };
      const b = { ...conceptMap['金刚石'], id: 'custom:large-b', properties };
      const rows = await localGenerator.generateConnections(a, b, { count: 12 });
      expect(rows).toHaveLength(12);
      for (const row of rows) {
        expect(properties).toContain(row.conceptAProperty);
        expect(properties).toContain(row.conceptBProperty);
      }
    } finally {
      vi.restoreAllMocks();
    }
  });
  it('长属性生成的碰撞及发明刷新导入时不会被旧长度校验拒绝', async () => {
    const a = materializeConcept(
      {
        ...localConceptDraft('长定义实验'),
        properties: ['结构机制'.repeat(4000)],
      },
      concepts,
      'manual',
    );
    const b = conceptMap['蜂群'];
    const rows = await localGenerator.generateConnections(a, b, { count: 4 });
    const data = initialData();
    data.customConcepts = [a];
    data.collisions = [
      {
        id: 'long-experiment',
        conceptAId: a.id,
        conceptBId: b.id,
        connections: rows,
        createdAt: new Date().toISOString(),
        source: 'local',
      },
    ];
    data.ideas = await localGenerator.generateIdeas(a, b, rows[0], 'long-experiment');
    const restored = parseImport(JSON.stringify(data));
    expect(restored.collisions).toEqual(data.collisions);
    expect(restored.ideas).toEqual(data.ideas);
  });
  it('首批数量可变，追加去重并保留旧的五条记录', async () => {
    const a = conceptMap['蜂群'],
      b = conceptMap['金刚石'];
    const first = await localGenerator.generateConnections(a, b, { count: 4 });
    expect(first).toHaveLength(4);
    const second = await localGenerator.generateConnections(a, b, { count: 12, exclude: first });
    const added = freshConnections(first, second);
    expect(added).toHaveLength(12);
    expect(freshConnections([...first, ...added], second)).toEqual([]);
    const data = initialData();
    data.collisions = [
      {
        id: 'saved',
        conceptAId: a.id,
        conceptBId: b.id,
        connections: [...first, ...added],
        createdAt: new Date().toISOString(),
        source: 'local',
      },
    ];
    expect(parseImport(JSON.stringify(data)).collisions[0].connections).toHaveLength(16);
    data.collisions[0].connections = (await localGenerator.generateConnections(a, b)).slice(0, 5);
    expect(parseImport(JSON.stringify(data)).collisions[0].connections).toHaveLength(5);
  });
  it('没有新离线候选时停止，不循环生成同一组问题', async () => {
    const a = { ...conceptMap['蜂群'], properties: ['未知的设定'] },
      b = { ...conceptMap['金刚石'], properties: ['未知的界限'] };
    const first = await localGenerator.generateConnections(
      { ...a, id: 'custom:a' },
      { ...b, id: 'custom:b' },
      { count: 8 },
    );
    expect(first).toHaveLength(8);
    expect(
      await localGenerator.generateConnections(
        { ...a, id: 'custom:a' },
        { ...b, id: 'custom:b' },
        { count: 8, exclude: first },
      ),
    ).toEqual([]);
  });
  it('逐项解释必须涵盖原属性，拒绝遗漏或替换', async () => {
    const c = conceptMap['蜂群'];
    const base = {
      definition: '定义',
      mechanism: '原理',
      examples: ['案例'],
      distinctions: '区别',
      uncertainties: ['模型解释尚未验证'],
      propertyDetails: c.properties.map((property) => ({
        property,
        explanation: `${property}的具体含义`,
      })),
    };
    const settings = {
      enabled: true,
      baseUrl: 'https://example.com/v1',
      apiKey: 'mock',
      model: 'mock',
    };
    const mock = (value: unknown) =>
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response(
              JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] }),
            ),
          ),
      );
    mock(base);
    const result = await explainConcept(c, settings);
    expect(result.propertyDetails).toHaveLength(c.properties.length);
    const data = initialData();
    data.explanations[c.id] = result;
    expect(parseImport(JSON.stringify(data)).explanations[c.id]).toEqual(result);
    mock({ ...base, propertyDetails: base.propertyDetails.slice(1) });
    await expect(explainConcept(c, settings)).rejects.toThrow('未完整对应');
  });
});
