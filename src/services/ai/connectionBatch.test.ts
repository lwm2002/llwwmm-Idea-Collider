import { describe, expect, it } from 'vitest';
import { parseConnectionBatch } from './connectionBatch';

const row = (i: number) => ({
  title: `连接${i}`,
  dimension: ['结构', '行为', '时间', '信息'][i % 4],
  conceptAProperty: `属性A${i}`,
  conceptBProperty: `属性B${i}`,
  basisA: { status: '用户定义', reason: '来自定义' },
  basisB: { status: '推测', reason: '待验证' },
  explanation: '两种机制之间的可检验映射',
  novelty: 70,
  plausibility: 40,
});
describe('逐条校验碰撞返回值', () => {
  it('保留不足数量的有效连接，过滤缺失内容及重复结果，未知评分标记为空', () => {
    const result = parseConnectionBatch(
      [
        row(0),
        row(1),
        row(2),
        row(0),
        { ...row(3), basisA: undefined },
        { ...row(4), novelty: 200 },
      ],
      8,
    );
    expect(result.connections).toHaveLength(4);
    expect(result.notice).toContain('保留 4 条');
    expect(result.notice).toContain('过滤 1 条内容字段');
    expect(result.notice).toContain('过滤 1 条重复');
    expect(result.connections[3].novelty).toBeNull();
    expect(result.notice).toContain('未评分');
    expect(new Set(result.connections.map((c) => c.id)).size).toBe(4);
    expect(result.connections.every((c) => c.source === 'api')).toBe(true);
  });
  it('整批评分缺失或为字符串也能保留完整连接，不生成默认分数', () => {
    const result = parseConnectionBatch(
      [
        { ...row(0), novelty: '85', plausibility: '72%' },
        { ...row(1), novelty: '8/10', plausibility: '３／５' },
        { ...row(2), novelty: undefined, plausibility: null },
        { ...row(3), novelty: '高', plausibility: false },
      ],
      4,
    );
    expect(result.connections.map((c) => [c.novelty, c.plausibility])).toEqual([
      [85, 72],
      [80, 60],
      [null, null],
      [null, null],
    ]);
    expect(result.notice).toContain('兼容 2 条');
    expect(result.notice).toContain('2 条连接的部分评分');
  });
  it('语义维度名称不影响图谱渲染，但缺少依据仍然拒绝', () => {
    expect(
      parseConnectionBatch([{ ...row(0), dimension: '结构/材料' }], 4).connections,
    ).toHaveLength(1);
    expect(() => parseConnectionBatch([{ ...row(0), basisB: undefined }], 4)).toThrow('basisB');
  });
  it('达标结果无警告，追加过滤已有结果且不超过所选数量', () => {
    const original = parseConnectionBatch(
      Array.from({ length: 4 }, (_, i) => row(i)),
      4,
    );
    expect(original.notice).toBe('');
    const next = parseConnectionBatch(
      Array.from({ length: 12 }, (_, i) => row(i)),
      4,
      original.connections,
    );
    expect(next.connections.map((c) => c.title)).toEqual(['连接4', '连接5', '连接6', '连接7']);
    expect(next.notice).toContain('重复');
    expect(parseConnectionBatch([row(0)], 4, original.connections).connections).toEqual([]);
  });
});
