import type { ConceptDraft } from '../types';
import { normalizeName } from '../utils/catalog';

/** An offline scaffold for unknown input, not an invented encyclopedia entry. */
export function localConceptDraft(name: string, description = ''): ConceptDraft {
  const clean = normalizeName(name);
  if (!clean || clean.length > 80) throw new Error('概念名称需要 1–80 个字符。');
  const context = description.trim();
  if (context.length > 2000) throw new Error('补充说明最多 2000 个字符。');
  const subject = `${clean} ${context}`;
  const category = /软件|算法|程序|数字|数据/.test(subject)
    ? '计算机'
    : /植物|动物|细胞|生态|生物/.test(subject)
      ? '生物'
      : /装置|机械|机器|齿轮/.test(subject)
        ? '机械'
        : /建筑|房屋|空间/.test(subject)
          ? '建筑'
          : /声音|音乐|节奏/.test(subject)
            ? '音乐'
            : '自定义';
  return {
    name: clean,
    category,
    description: context
      ? `用户说明：${context}（本地草案，未经事实验证）`
      : `用户提出的概念「${clean}」。当前没有补充定义；以下是待确认的探索维度，不是已知事实。`,
    properties: context
      ? context
          .split(/[。；;\n]+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => `用户定义：${s}`)
      : [`待确认：请补充「${clean}」独有的机制、行为或规则`],
    functions: [`探索${clean}在具体场景中的用途`],
    constraints: ['定义及适用场景需要确认', '机制与可行性尚未验证'],
    tags: [clean, '用户概念', '待验证'],
    relatedConcepts: [],
  };
}
