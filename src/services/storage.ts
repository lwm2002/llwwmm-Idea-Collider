import { explanationSchema } from './ai/explainConcept';
import { z } from 'zod';
import type { AppData } from '../types';
import { connectionContent, ideaContent, criticSchema, conceptDraftContent } from './ai/schemas';
import { concepts as builtins } from '../data/concepts';
import { createCatalog, nameKey } from '../utils/catalog';
export const STORAGE_KEY = 'idea-collider:v1';
const id = z.string().min(1);
const time = z.string().datetime();
const collisionSchema = z.object({
  id,
  notice: z.string().optional(),
  conceptAId: id,
  conceptBId: id,
  connections: z.array(connectionContent.extend({ id })).min(1).max(500),
  createdAt: time,
  source: z.enum(['local', 'api']),
});
const ideaSchema = ideaContent.extend({
  id,
  rootId: id,
  parentId: id.nullable(),
  version: z.number().int().positive(),
  mutation: z.string(),
  collisionId: id,
  connectionId: id,
  createdAt: time,
  source: z.enum(['local', 'api']),
});
const schema = z.object({
  schemaVersion: z.literal(1),
  explanations: z.record(z.string(), explanationSchema).default({}),
  pair: z.tuple([id, id]),
  customConcepts: z
    .array(
      conceptDraftContent.extend({
        id: z.string().startsWith('custom:'),
        source: z.enum(['manual', 'local', 'api']),
      }),
    )
    .max(2000)
    .default([]),
  collisions: z.array(collisionSchema),
  ideas: z.array(ideaSchema),
  critics: z.record(z.string(), criticSchema),
  favorites: z.object({ concepts: z.array(id), collisions: z.array(id), ideas: z.array(id) }),
  settings: z.object({
    baseUrl: z.string(),
    apiKey: z.string(),
    model: z.string(),
    enabled: z.boolean(),
    authMode: z.enum(['auto', 'bearer', 'api-key', 'x-api-key', 'none']).optional(),
    jsonMode: z.boolean().optional(),
    requestTimeoutSeconds: z.number().int().min(30).max(600).optional(),
  }),
});
export function initialData(): AppData {
  return {
    schemaVersion: 1,
    pair: ['蜂群', '金刚石'],
    customConcepts: [],
    explanations: {},
    collisions: [],
    ideas: [],
    critics: {},
    favorites: { concepts: [], collisions: [], ideas: [] },
    settings: { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: '', enabled: false },
  };
}
function validateReferences(data: AppData): void {
  const { concepts, conceptMap } = createCatalog(data.customConcepts);
  if (
    new Set(concepts.map((c) => c.id)).size !== concepts.length ||
    new Set(concepts.map((c) => nameKey(c.name))).size !== concepts.length
  )
    throw new Error('自定义概念的名称或ID重复');
  if (
    data.customConcepts.some(
      (c) =>
        builtins.some((b) => b.id === c.id) ||
        c.relatedConcepts.some((id) => !conceptMap[id] || id === c.id),
    )
  )
    throw new Error('自定义概念包含无效关联');
  if (
    !data.pair.every((id) => conceptMap[id]) ||
    data.collisions.some(
      (c) =>
        !conceptMap[c.conceptAId] || !conceptMap[c.conceptBId] || c.conceptAId === c.conceptBId,
    )
  )
    throw new Error('备份包含无效概念');
  if (Object.keys(data.explanations).some((id) => !conceptMap[id]))
    throw new Error('概念解释缺少有效来源');
  const collisions = new Map(data.collisions.map((c) => [c.id, c]));
  const ideas = new Map(data.ideas.map((i) => [i.id, i]));
  if (collisions.size !== data.collisions.length || ideas.size !== data.ideas.length)
    throw new Error('备份包含重复记录');
  if (
    data.collisions.some(
      (c) =>
        new Set(c.connections.map((connection) => connection.id)).size !== c.connections.length,
    )
  )
    throw new Error('同一碰撞内的连接 ID 重复');
  for (const idea of data.ideas) {
    const collision = collisions.get(idea.collisionId);
    const root = ideas.get(idea.rootId);
    const parent = idea.parentId ? ideas.get(idea.parentId) : null;
    if (
      !collision?.connections.some((c) => c.id === idea.connectionId) ||
      !root ||
      root.parentId !== null ||
      root.rootId !== root.id ||
      root.version !== 1
    )
      throw new Error('创意缺少有效来源');
    if (
      idea.parentId &&
      (!parent ||
        parent.version + 1 !== idea.version ||
        parent.rootId !== idea.rootId ||
        parent.collisionId !== idea.collisionId ||
        parent.connectionId !== idea.connectionId)
    )
      throw new Error('演化关系无效');
    if (!idea.parentId && (idea.version !== 1 || idea.rootId !== idea.id))
      throw new Error('创意根节点无效');
  }
  if (
    data.favorites.concepts.some((id) => !conceptMap[id]) ||
    data.favorites.collisions.some((id) => !collisions.has(id)) ||
    data.favorites.ideas.some((id) => !ideas.has(id)) ||
    Object.keys(data.critics).some((id) => !ideas.has(id))
  )
    throw new Error('收藏或评审记录缺少来源');
}
export function readData(): { data: AppData; warning: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: initialData(), warning: '' };
    const result = schema.safeParse(JSON.parse(raw));
    if (!result.success) throw new Error('invalid');
    const data = result.data;
    validateReferences(data);
    return { data, warning: '' };
  } catch {
    return {
      data: initialData(),
      warning:
        '浏览器保存的数据无法读取。本次使用初始工作区，原数据暂未覆盖；继续操作将保存新状态。',
    };
  }
}
export function writeData(data: AppData): string {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return '';
  } catch {
    return '浏览器存储已满或被禁用：本次改动仍可使用，但刷新后可能丢失。请导出工作区备份。';
  }
}
export function exportWorkspace(data: AppData): void {
  const { settings, ...workspace } = data;
  const blob = new Blob(
    [
      JSON.stringify(
        { ...workspace, settings: { ...settings, apiKey: '', enabled: false } },
        null,
        2,
      ),
    ],
    { type: 'application/json' },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `idea-collider-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function parseImport(raw: string): AppData {
  const data = schema.parse(JSON.parse(raw));
  validateReferences(data);
  return { ...data, settings: { ...data.settings, apiKey: '', enabled: false } };
}
