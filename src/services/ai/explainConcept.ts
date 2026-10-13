import { z } from 'zod';
import type { Concept, Settings } from '../../types';
import { requestJson } from './openaiCompatible';

const paragraph = z.string().trim().min(1).max(4000);
export const explanationSchema = z.object({
  definition: paragraph,
  mechanism: paragraph,
  examples: z.array(paragraph).min(1).max(4),
  distinctions: paragraph,
  propertyDetails: z
    .array(z.object({ property: z.string().min(1), explanation: paragraph }))
    .min(1),
  uncertainties: z.array(paragraph).min(1).max(6),
});
export type ConceptExplanation = z.infer<typeof explanationSchema>;
export async function explainConcept(
  concept: Concept,
  settings: Settings,
  signal?: AbortSignal,
): Promise<ConceptExplanation> {
  const result = await requestJson(
    settings,
    '独立解释这一个概念，不要讨论另一个概念或生成碰撞。向初学者说明：它是什么、怎样运作或遵循什么规则、具体例子、与容易混淆的概念有什么区别、适用边界和不确定性。逐一解释输入 properties 中的每一项（原文保留在property字段），说明其含义、为什么属于这个概念、在什么条件下成立，禁止套用所有概念通用的空话。已标为待确认的属性应说明缺少哪些定义，不可当作事实。真实事实、用户定义、类比、虚构设定和推测要在文字中明确区分，不编造来源，不声称已经检索验证。',
    { concept },
    explanationSchema,
    signal,
  );
  if (
    new Set(result.propertyDetails.map((p) => p.property)).size !== concept.properties.length ||
    result.propertyDetails.some((p) => !concept.properties.includes(p.property))
  )
    throw new Error('概念解释未完整对应原属性，请重试。');
  return result;
}
