import { z } from 'zod';
const text = z.string().trim().min(1);
const score = z.number().finite().min(0).max(100);
export const storedScore = score.nullable();
const conceptText = z.string().trim().min(1);
export const conceptDraftContent = z.object({
  name: z.string().trim().min(1).max(80),
  category: conceptText,
  description: conceptText,
  properties: z.array(conceptText).min(1),
  functions: z.array(conceptText).min(1),
  constraints: z.array(conceptText).min(1),
  tags: z.array(conceptText).min(1),
  relatedConcepts: z.array(conceptText),
});
const basis = z.object({ status: z.enum(['已知特征', '用户定义', '推测']), reason: text });
export const connectionContent = z.object({
  source: z.enum(['local', 'api']).optional(),
  dimension: text.optional(),
  basisA: basis.optional(),
  basisB: basis.optional(),
  title: text,
  conceptAProperty: text,
  conceptBProperty: text,
  explanation: text,
  novelty: storedScore,
  plausibility: storedScore,
});
export const ideaContent = z.object({
  kind: z.enum(['实用型', '探索型', '荒诞型']),
  name: text,
  summary: text,
  problem: text,
  principle: text,
  contributionA: text,
  contributionB: text,
  implementation: text,
  biggestProblem: text,
  novelty: storedScore,
  feasibility: storedScore,
  fun: storedScore,
});
export const criticSchema = z.object({
  majorProblems: z.array(text).min(1).max(8),
  minorProblems: z.array(text).min(1).max(8),
  potentialFixes: z.array(text).min(1).max(8),
  verdict: z.enum(['Promising', 'Needs Work', 'Mostly Gimmick', 'Physically Questionable']),
  explanation: text,
});
export const connectionResponse = z.object({
  connections: z.array(connectionContent).min(1).max(12),
});
export const ideaResponse = z.object({
  ideas: z
    .array(ideaContent)
    .length(3)
    .refine((items) => new Set(items.map((x) => x.kind)).size === 3, '必须包含三种不同方向'),
});
