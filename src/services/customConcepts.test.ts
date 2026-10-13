import { afterEach, describe, expect, it, vi } from 'vitest';
import { concepts, conceptMap } from '../data/concepts';
import { createCatalog, materializeConcept, findConceptByName } from '../utils/catalog';
import { localConceptDraft } from './conceptDraft';
import { initialData, parseImport } from './storage';
import { localGenerator } from './ai/localGenerator';
import { openaiCompatible } from './ai/openaiCompatible';
import { explainConcept } from './ai/explainConcept';

afterEach(() => vi.unstubAllGlobals());
const settings = {
  enabled: true,
  baseUrl: 'https://example.com/v1',
  apiKey: 'test-only',
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

describe('自由概念与持久化', () => {
  it('本地草案完整保留超过十二项和三百字的用户定义', () => {
    const definitions = Array.from({ length: 13 }, (_, i) => `规则${i}`);
    definitions[0] += '详细定义'.repeat(80);
    expect(localConceptDraft('长定义概念', definitions.join('\n')).properties).toEqual(
      definitions.map((item) => `用户定义：${item}`),
    );
  });
  it('长概念可通过AI拆解和逐项解释，并完整导入备份', async () => {
    const items = Array.from({ length: 13 }, (_, i) => `第${i}项${'详细定义'.repeat(80)}`);
    const draft = {
      name: '长内容概念',
      category: '跨领域研究'.repeat(10),
      description: '详细简介'.repeat(1100),
      properties: items,
      functions: items,
      constraints: items,
      tags: items,
      relatedConcepts: concepts.slice(0, 13).map((c) => c.name),
    };
    mock({ concept: draft });
    const result = await openaiCompatible(settings).analyzeConcept(draft.name);
    expect(result).toEqual(draft);
    const concept = materializeConcept(result, concepts, 'api');
    const explanation = {
      definition: '用户定义的概念',
      mechanism: '依用户定义运作',
      examples: ['一个具体例子'],
      distinctions: '与其他概念的区别',
      propertyDetails: items.map((property) => ({ property, explanation: '此项来自用户定义' })),
      uncertainties: ['尚需验证'],
    };
    mock(explanation);
    expect(await explainConcept(concept, settings)).toEqual(explanation);
    const data = initialData();
    data.customConcepts = [concept];
    data.explanations = { [concept.id]: explanation };
    const restored = parseImport(JSON.stringify(data));
    expect(restored.customConcepts).toEqual([concept]);
    expect(restored.explanations).toEqual(data.explanations);
  });
  it('未知概念不会获得虚构的通用属性，有说明时保留用户的具体定义', () => {
    expect(localConceptDraft('记忆邮局').properties).toEqual([
      '待确认：请补充「记忆邮局」独有的机制、行为或规则',
    ]);
    expect(localConceptDraft('记忆邮局', '按情绪分类信件；十年后投递').properties).toEqual([
      '用户定义：按情绪分类信件',
      '用户定义：十年后投递',
    ]);
  });
  it('兼容旧备份，自定义概念和实验可完整往返', async () => {
    const old: Record<string, unknown> = { ...initialData() };
    delete old.customConcepts;
    expect(parseImport(JSON.stringify(old)).customConcepts).toEqual([]);
    const c = materializeConcept(
      localConceptDraft('记忆邮局', '按情绪分类；延迟投递'),
      concepts,
      'manual',
    );
    const data = initialData();
    data.customConcepts = [c];
    data.pair = [c.id, '蜂群'];
    const connections = await localGenerator.generateConnections(c, conceptMap['蜂群']);
    data.collisions = [
      {
        id: 'experiment',
        conceptAId: c.id,
        conceptBId: '蜂群',
        connections,
        createdAt: new Date().toISOString(),
        source: 'local',
      },
    ];
    data.ideas = await localGenerator.generateIdeas(
      c,
      conceptMap['蜂群'],
      connections[0],
      'experiment',
    );
    data.favorites.concepts = [c.id];
    const restored = parseImport(JSON.stringify(data));
    expect(restored.customConcepts).toEqual([c]);
    expect(restored.ideas).toHaveLength(3);
    expect(createCatalog(restored.customConcepts).conceptMap[c.id].name).toBe('记忆邮局');
    expect(findConceptByName([c], ' 记忆邮局 ')).toBe(c);
    data.customConcepts.push({ ...c, id: 'custom:duplicate' });
    expect(() => parseImport(JSON.stringify(data))).toThrow();
  });
  it('拒绝悬空关联与冒用内置名称', () => {
    const data = initialData();
    const c = materializeConcept(localConceptDraft('新概念'), concepts, 'local');
    data.customConcepts = [{ ...c, relatedConcepts: ['missing'] }];
    expect(() => parseImport(JSON.stringify(data))).toThrow();
    data.customConcepts = [{ ...c, name: ' 蜂群 ' }];
    expect(() => parseImport(JSON.stringify(data))).toThrow();
  });
});

describe('概念特有属性和多维碰撞', () => {
  const a = conceptMap['弹簧'],
    b = conceptMap['光纤'];
  const response = () => ({
    connections: Array.from({ length: 5 }, (_, i) => ({
      title: `桥梁${i}`,
      conceptAProperty: `弹簧特征${i}`,
      conceptBProperty: `光纤特征${i}`,
      dimension: ['结构', '行为', '时间', '信息', '体验'][i],
      basisA: { status: '推测', reason: '测试用扩展属性，需要独立核实具体依据。' },
      basisB: { status: '推测', reason: '测试用扩展属性，需要独立核实具体依据。' },
      explanation: '这是用于接口验证的创意假设，不是事实结论。',
      novelty: 70,
      plausibility: 40,
    })),
  });
  it('允许有明确依据标记的新属性，图谱不受旧属性列表限制', async () => {
    mock(response());
    const rows = await openaiCompatible(settings).generateConnections(a, b);
    expect(rows).toHaveLength(5);
    expect(rows[0].basisA?.status).toBe('推测');
    expect(a.properties).not.toContain(rows[0].conceptAProperty);
  });
  it('保留有效但多样性不足的结果，并提示继续探索', async () => {
    for (const field of ['dimension', 'conceptAProperty', 'conceptBProperty'] as const) {
      const payload = response();
      payload.connections.forEach((c) => (c[field] = payload.connections[0][field]));
      mock(payload);
      const onNotice = vi.fn();
      const rows = await openaiCompatible(settings).generateConnections(a, b, { onNotice });
      expect(rows).toHaveLength(5);
      expect(onNotice).toHaveBeenCalledWith(expect.stringContaining('多样性不足'));
    }
  });
  it('不同概念的离线映射使用各自的实际属性并覆盖多个角度', async () => {
    for (const [x, y] of [
      [a, b],
      [conceptMap['神经元'], conceptMap['齿轮']],
    ]) {
      const rows = await localGenerator.generateConnections(x, y);
      expect(new Set(rows.map((c) => c.dimension)).size).toBeGreaterThanOrEqual(4);
      expect(new Set(rows.map((c) => `${c.conceptAProperty}/${c.conceptBProperty}`)).size).toBe(5);
      for (const c of rows) {
        expect(x.properties).toContain(c.conceptAProperty);
        expect(y.properties).toContain(c.conceptBProperty);
        expect(c.explanation).toContain('反证实验');
      }
    }
  });
  it('AI拆解保留用户原名称，过滤返回的额外元数据', async () => {
    mock({
      concept: { ...localConceptDraft('模型试图改名', '情绪邮戳；延迟投递'), id: 'untrusted' },
    });
    const result = await openaiCompatible(settings).analyzeConcept('记忆邮局');
    expect(result.name).toBe('记忆邮局');
    expect(result).not.toHaveProperty('id');
  });
});
