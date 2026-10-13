import { z } from 'zod';
import type { Connection } from '../../types';
import { uid } from '../../utils/id';
import { freshConnections } from '../../utils/connections';
import { connectionContent } from './schemas';
import { normalizeScore } from './scores';

const basis = z.object({
  status: z.enum(['已知特征', '用户定义', '推测']),
  reason: z.string().trim().min(1),
});
const validConnection = connectionContent.extend({
  dimension: z.string().trim().min(1),
  basisA: basis,
  basisB: basis,
});
export const requestedConnectionSchema = validConnection.extend({
  dimension: z.enum(['结构', '行为', '时间', '信息', '社会', '空间', '能量', '体验']),
});

export function parseConnectionBatch(
  incoming: unknown[],
  count: number,
  existing: Connection[] = [],
): { connections: Connection[]; notice: string } {
  const valid: Connection[] = [];
  const invalidFields = new Set<string>();
  let invalid = 0;
  const convertedIds = new Set<string>();
  for (const item of incoming) {
    const object =
      typeof item === 'object' && item !== null && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : null;
    const normalized = object
      ? {
          ...object,
          novelty: normalizeScore(object.novelty),
          plausibility: normalizeScore(object.plausibility),
        }
      : item;
    const parsed = validConnection.safeParse(normalized);
    if (parsed.success) {
      const connection = { ...parsed.data, id: uid(), source: 'api' as const };
      valid.push(connection);
      if (
        object &&
        ((typeof object.novelty !== 'number' && parsed.data.novelty !== null) ||
          (typeof object.plausibility !== 'number' && parsed.data.plausibility !== null))
      )
        convertedIds.add(connection.id);
    } else {
      invalid++;
      for (const issue of parsed.error.issues) invalidFields.add(issue.path.join('.') || '连接');
    }
  }
  const fresh = freshConnections(existing, valid);
  const connections = fresh.slice(0, count);
  if (!connections.length) {
    if (invalid)
      throw new Error(
        `AI 返回的数据结构不符合要求，没有可用连接。缺失或无效字段：${[...invalidFields].slice(0, 3).join('、')}。请重新尝试或改用离线生成。`,
      );
    return { connections, notice: '本轮没有找到新的不重复连接。' };
  }
  const notes: string[] = [];
  const unscored = connections.filter((c) => c.novelty === null || c.plausibility === null).length;
  const converted = connections.filter((c) => convertedIds.has(c.id)).length;
  if (connections.length < count)
    notes.push(`本轮请求 ${count} 条，保留 ${connections.length} 条有效连接`);
  if (invalid) notes.push(`已过滤 ${invalid} 条内容字段不完整的连接`);
  if (converted) notes.push(`已兼容 ${converted} 条连接的评分格式`);
  if (unscored) notes.push(`${unscored} 条连接的部分评分缺失或无法识别，已保留内容并标为“未评分”`);
  if (fresh.length < valid.length) notes.push(`已过滤 ${valid.length - fresh.length} 条重复连接`);
  if (fresh.length > count) notes.push(`模型多返回 ${fresh.length - count} 条，本轮按所选数量展示`);
  const dimensions = new Set(connections.map((c) => c.dimension)).size;
  const featuresA = new Set(connections.map((c) => c.conceptAProperty)).size;
  const featuresB = new Set(connections.map((c) => c.conceptBProperty)).size;
  if (dimensions < 4 || featuresA < 3 || featuresB < 3)
    notes.push(
      `探索多样性不足：${dimensions} 个维度，A/B 分别 ${featuresA}/${featuresB} 个特征，可继续追加探索`,
    );
  return { connections, notice: notes.length ? `${notes.join('；')}。` : '' };
}
