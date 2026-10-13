import { describe, it, expect, vi, afterEach } from 'vitest';
import { concepts, categories, conceptMap } from '../data/concepts';
import { conceptDistance, randomPair } from '../utils/distance';
import { localGenerator, mutations } from './ai/localGenerator';
import { endpoint, openaiCompatible, requestJson } from './ai/openaiCompatible';
import { initialData, parseImport, readData, writeData } from './storage';
import { z } from 'zod';
const a = conceptMap['蜂群'],
  b = conceptMap['金刚石'];
afterEach(() => vi.unstubAllGlobals());
describe('真实概念与距离', () => {
  it('至少150个完整且唯一的概念，覆盖20个领域', () => {
    expect(concepts.length).toBeGreaterThanOrEqual(150);
    expect(categories).toHaveLength(20);
    expect(new Set(concepts.map((c) => c.id)).size).toBe(concepts.length);
    for (const c of concepts) {
      expect(c.description.length).toBeGreaterThan(8);
      for (const key of [
        'properties',
        'functions',
        'constraints',
        'tags',
        'relatedConcepts',
      ] as const)
        expect(c[key].length).toBeGreaterThan(0);
      expect(c.relatedConcepts.every((id) => conceptMap[id] && id !== c.id)).toBe(true);
    }
  });
  it('距离对称且处于[0,1]，相同概念距离为0', () => {
    for (const c of concepts) {
      expect(conceptDistance(c, c)).toBe(0);
      expect(conceptDistance(c, a)).toBe(conceptDistance(a, c));
      expect(conceptDistance(c, a)).toBeGreaterThanOrEqual(0);
      expect(conceptDistance(c, a)).toBeLessThanOrEqual(1);
    }
  });
  it('极端配对明显比近距离配对更远，且不产生相同概念', () => {
    const distances = (level: number) =>
      Array.from({ length: 150 }, () => randomPair(level)).map(([a, b]) => {
        expect(a).not.toBe(b);
        return conceptDistance(conceptMap[a], conceptMap[b]);
      });
    const average = (xs: number[]) => xs.reduce((x, y) => x + y, 0) / xs.length;
    expect(average(distances(100)) - average(distances(0))).toBeGreaterThan(0.35);
  });
});
describe('离线创意闭环', () => {
  it('默认案例的连接属性确实来自输入，并支持反转', async () => {
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      const connections = await localGenerator.generateConnections(x, y);
      expect(connections).toHaveLength(5);
      for (const c of connections) {
        expect(x.properties).toContain(c.conceptAProperty);
        expect(y.properties).toContain(c.conceptBProperty);
        expect(c.explanation).toContain('创意假设');
      }
    }
  });
  it('跨域组合都能生成5个不同连接与三类有内容的创意', async () => {
    for (const category of categories) {
      const x = concepts.find((c) => c.category === category)!;
      const y = conceptMap['数据库'];
      const connections = await localGenerator.generateConnections(x, y);
      expect(connections).toHaveLength(5);
      expect(new Set(connections.map((c) => c.title)).size).toBe(5);
      for (const c of connections) {
        expect(x.properties).toContain(c.conceptAProperty);
        expect(y.properties).toContain(c.conceptBProperty);
        const ideas = await localGenerator.generateIdeas(x, y, c, 'test');
        expect(new Set(ideas.map((i) => i.kind)).size).toBe(3);
        for (const idea of ideas) {
          expect(idea.contributionA).toContain(x.name);
          expect(idea.contributionB).toContain(y.name);
          expect(idea.implementation.length).toBeGreaterThan(40);
          expect(idea.rootId).toBe(idea.id);
        }
      }
    }
  });
  it('每种变异实质改变实现方式，维护谱系且评分始终有效', async () => {
    const c = (await localGenerator.generateConnections(a, b))[0];
    const original = (await localGenerator.generateIdeas(a, b, c, 'c'))[0];
    let idea = original;
    for (const mutation of mutations) {
      const next = await localGenerator.evolveIdea(idea, mutation, a, b);
      expect(next.parentId).toBe(idea.id);
      expect(next.rootId).toBe(original.id);
      expect(next.version).toBe(idea.version + 1);
      expect(next.implementation).not.toBe(idea.implementation);
      for (const value of [next.novelty, next.feasibility, next.fun]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
      idea = next;
    }
    expect(original.version).toBe(1);
  });
  it('Critic会根据创意特点提供不同结论', async () => {
    const c = (await localGenerator.generateConnections(a, b))[0];
    const idea = (await localGenerator.generateIdeas(a, b, c, 'c'))[0];
    const promising = await localGenerator.criticizeIdea({ ...idea, feasibility: 90 }, a, b);
    const doubtful = await localGenerator.criticizeIdea({ ...idea, feasibility: 20 }, a, b);
    expect(promising.verdict).toBe('Promising');
    expect(doubtful.verdict).toBe('Physically Questionable');
    expect(promising.majorProblems.length).toBeGreaterThanOrEqual(3);
  });
});
describe('API边界', () => {
  const settings = {
    baseUrl: 'https://example.com/v1',
    apiKey: 'test-secret',
    model: 'test-model',
    enabled: true,
  };
  it('正确拼接路径，接受本机服务并拒绝不安全的远程地址', () => {
    expect(endpoint('https://example.com/v1/')).toBe('https://example.com/v1/chat/completions');
    expect(endpoint('https://example.com/v1/chat/completions')).toBe(
      'https://example.com/v1/chat/completions',
    );
    expect(endpoint('http://localhost:1234/v1')).toContain('localhost:1234');
    expect(() => endpoint('http://example.com/v1')).toThrow();
    expect(() => endpoint('https://name:password@example.com/v1')).toThrow();
  });
  it('按兼容协议发请求，校验返回JSON', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] })),
      );
    vi.stubGlobal('fetch', fetch);
    expect(await requestJson(settings, 'test', {}, z.object({ ok: z.literal(true) }))).toEqual({
      ok: true,
    });
    const args = fetch.mock.calls[0];
    expect(args[0]).toBe('https://example.com/v1/chat/completions');
    expect(args[1].headers.Authorization).toBe('Bearer test-secret');
    expect(JSON.parse(args[1].body).messages).toHaveLength(2);
  });
  it('拒绝结构不完整、越界评分、无效JSON及错误状态', async () => {
    for (const content of ['not json', '{"ok":false}', '{}']) {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content } }] }))),
      );
      await expect(
        requestJson(settings, 'test', {}, z.object({ ok: z.literal(true) })),
      ).rejects.toThrow();
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 })),
    );
    await expect(requestJson(settings, 'test', {}, z.object({}))).rejects.toThrow('401');
  });
  it('拒绝API返回没有属性依据的连接，不写入工作区', async () => {
    const connections = await localGenerator.generateConnections(a, b);
    connections[0].conceptAProperty = '不存在的属性';
    for (const connection of connections) delete connection.basisA;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ connections }) } }],
          }),
        ),
      ),
    );
    await expect(openaiCompatible(settings).generateConnections(a, b)).rejects.toThrow('数据结构');
  });
  it('网络失败提供可操作提示，不泄露Key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(requestJson(settings, 'test', {}, z.object({}))).rejects.toThrow('CORS');
  });
});
describe('持久化', () => {
  it('拒绝悬空收藏、重复碰撞和无效演化父节点', async () => {
    const data = initialData();
    const connections = await localGenerator.generateConnections(a, b);
    data.collisions = [
      {
        id: 'collision',
        conceptAId: a.id,
        conceptBId: b.id,
        connections,
        createdAt: new Date().toISOString(),
        source: 'local',
      },
    ];
    data.ideas = await localGenerator.generateIdeas(a, b, connections[0], 'collision');
    expect(parseImport(JSON.stringify(data)).ideas).toHaveLength(3);
    const invalidFavorite = { ...data, favorites: { ...data.favorites, ideas: ['missing'] } };
    expect(() => parseImport(JSON.stringify(invalidFavorite))).toThrow('缺少来源');
    expect(() =>
      parseImport(
        JSON.stringify({ ...data, collisions: [...data.collisions, ...data.collisions] }),
      ),
    ).toThrow('重复');
    const child = await localGenerator.evolveIdea(data.ideas[0], '更小', a, b);
    expect(() =>
      parseImport(
        JSON.stringify({ ...data, ideas: [...data.ideas, { ...child, parentId: 'missing' }] }),
      ),
    ).toThrow('演化关系');
  });
  it('损坏数据安全回退且不自动覆盖原存储', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => '{broken', setItem });
    const result = readData();
    expect(result.data.pair).toEqual(['蜂群', '金刚石']);
    expect(result.warning).not.toBe('');
    expect(setItem).not.toHaveBeenCalled();
  });
  it('存储失败不伪称保存成功', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    expect(writeData(initialData())).toContain('刷新后可能丢失');
  });
  it('导入校验未知概念并清除密钥', () => {
    const data = initialData();
    data.settings.apiKey = 'secret';
    data.settings.enabled = true;
    expect(parseImport(JSON.stringify(data)).settings.apiKey).toBe('');
    expect(() => parseImport(JSON.stringify({ ...data, pair: ['无效', '蜂群'] }))).toThrow();
  });
});
