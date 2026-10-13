import { useEffect, useRef, useState } from 'react';
import { Sparkles, Plus } from 'lucide-react';
import type { Concept, ConceptDraft } from '../types';
import { useStore } from '../hooks/store';
import { getProvider } from '../services/ai/provider';
import { localConceptDraft } from '../services/conceptDraft';
import { conceptDraftContent } from '../services/ai/schemas';
import { findConceptByName, materializeConcept, normalizeName } from '../utils/catalog';
import { Modal, Loading } from './ui';

type Form = {
  name: string;
  category: string;
  description: string;
  properties: string;
  functions: string;
  constraints: string;
  tags: string;
};
const toForm = (draft: ConceptDraft): Form => ({
  ...draft,
  properties: draft.properties.join('\n'),
  functions: draft.functions.join('\n'),
  constraints: draft.constraints.join('\n'),
  tags: draft.tags.join('、'),
});
const splitList = (text: string) => [
  ...new Set(
    text
      .split(/[\n,，、;；]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  ),
];

export function ConceptEditor({
  initialName = '',
  target,
  onClose,
  onSaved,
}: {
  initialName?: string;
  target?: 'A' | 'B';
  onClose: () => void;
  onSaved: (concept: Concept) => void;
}) {
  const { data, concepts, update, notify } = useStore();
  const [form, setForm] = useState<Form>({
    name: initialName,
    category: '自定义',
    description: '',
    properties: '',
    functions: '',
    constraints: '',
    tags: '',
  });
  const [context, setContext] = useState('');
  const [source, setSource] = useState<NonNullable<Concept['source']>>('manual');
  const [related, setRelated] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const committed = useRef(false);
  useEffect(
    () => () => {
      request.current++;
      controller.current?.abort();
    },
    [],
  );
  const existing = findConceptByName(concepts, form.name);
  function edit(patch: Partial<Form>) {
    request.current++;
    controller.current?.abort();
    setBusy(false);
    setError('');
    setForm((old) => ({ ...old, ...patch }));
  }
  async function analyze(offline = false) {
    const name = normalizeName(form.name);
    if (!name || name.length > 80) {
      setError('请输入 1–80 个字符的概念名称。');
      return;
    }
    const ticket = ++request.current;
    controller.current?.abort();
    controller.current = new AbortController();
    setBusy(true);
    setError('');
    try {
      const draft = await getProvider(data.settings, offline).analyzeConcept(
        name,
        context,
        controller.current.signal,
      );
      if (ticket !== request.current) return;
      setForm(toForm(draft));
      setRelated(draft.relatedConcepts);
      setSource(data.settings.enabled && !offline ? 'api' : 'local');
    } catch (e) {
      if (ticket === request.current) setError(e instanceof Error ? e.message : '概念拆解失败');
    } finally {
      if (ticket === request.current) setBusy(false);
    }
  }
  function save() {
    if (committed.current || busy) return;
    try {
      const name = normalizeName(form.name);
      if (!name || name.length > 80) throw new Error('请输入 1–80 个字符的概念名称。');
      if (existing) {
        committed.current = true;
        update((old) => ({
          ...old,
          pair:
            target === 'A'
              ? [existing.id, old.pair[1]]
              : target === 'B'
                ? [old.pair[0], existing.id]
                : old.pair,
        }));
        onSaved(existing);
        return;
      }
      if (data.customConcepts.length >= 2000)
        throw new Error('当前工作区已达到 2000 个自定义概念上限。');
      const scaffold = localConceptDraft(name, context);
      const fullyManual = [
        form.description,
        form.properties,
        form.functions,
        form.constraints,
        form.tags,
      ].every((s) => s.trim());
      const parsed = conceptDraftContent.safeParse({
        name,
        category: form.category.trim() || '自定义',
        description: form.description.trim() || scaffold.description,
        properties: form.properties.trim() ? splitList(form.properties) : scaffold.properties,
        functions: form.functions.trim() ? splitList(form.functions) : scaffold.functions,
        constraints: form.constraints.trim() ? splitList(form.constraints) : scaffold.constraints,
        tags: form.tags.trim() ? splitList(form.tags) : scaffold.tags,
        relatedConcepts: related,
      });
      if (!parsed.success) throw new Error('请检查字段：列表中的每一项都需要包含有效内容。');
      const concept = materializeConcept(
        parsed.data,
        concepts,
        source === 'manual' && !fullyManual ? 'local' : source,
      );
      committed.current = true;
      update((old) => ({
        ...old,
        customConcepts: [...old.customConcepts, concept],
        pair:
          target === 'A'
            ? [concept.id, old.pair[1]]
            : target === 'B'
              ? [old.pair[0], concept.id]
              : old.pair,
      }));
      notify(`已创建「${concept.name}」并保存到概念库`);
      onSaved(concept);
    } catch (e) {
      committed.current = false;
      setError(e instanceof Error ? e.message : '保存失败');
    }
  }
  return (
    <Modal title="创建自定义概念" onClose={onClose}>
      <div className="concept-editor">
        <h2>任何概念，都能加入实验。</h2>
        <p>
          真实事物、抽象想法、虚构设定都可以。只填名称也能创建，空白属性会使用明确标注的待验证草案。
        </p>
        <div className="form-field">
          <label htmlFor="custom-name">概念名称</label>
          <input
            data-autofocus
            id="custom-name"
            maxLength={80}
            placeholder="例如：梦境、时间旅行、记忆邮局…"
            value={form.name}
            onChange={(e) => {
              edit({
                name: e.target.value,
                description: '',
                properties: '',
                functions: '',
                constraints: '',
                tags: '',
              });
              setSource('manual');
              setRelated([]);
            }}
          />
        </div>
        {existing && (
          <div className="info-banner">
            概念库中已有「{existing.name}」，将直接使用已有概念，避免重复。
          </div>
        )}
        {!existing && (
          <>
            <div className="form-field">
              <label htmlFor="custom-context">补充定义或场景（可选）</label>
              <textarea
                id="custom-context"
                maxLength={2000}
                rows={2}
                placeholder="你说的这个概念是什么？希望怎样理解它？"
                value={context}
                onChange={(e) => {
                  edit({});
                  setContext(e.target.value);
                }}
              />
            </div>
            <div className="button-row">
              <button
                className="button"
                disabled={busy || !form.name.trim()}
                onClick={() => void analyze()}
              >
                {busy ? (
                  <Loading label="正在拆解…" />
                ) : (
                  <>
                    <Sparkles size={15} />
                    {data.settings.enabled ? 'AI 拆解概念' : '生成本地草案'}
                  </>
                )}
              </button>
              {busy && (
                <button className="text-link" onClick={() => edit({})}>
                  取消拆解
                </button>
              )}
            </div>
            <p className="draft-notice">
              {source === 'api'
                ? 'AI 拆解草案：请审阅事实、假设及适用边界，下面每个字段都可修改。'
                : source === 'local'
                  ? '本地草案：根据你的输入建立探索维度，不代表系统已了解或验证这个概念。'
                  : '可先自动拆解，也可以直接填写属性。无需从内置概念中选择。'}
            </p>
            <div className="form-field">
              <label htmlFor="custom-category">领域</label>
              <input
                id="custom-category"
                value={form.category}
                onChange={(e) => edit({ category: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label htmlFor="custom-description">概念简介</label>
              <textarea
                id="custom-description"
                rows={3}
                value={form.description}
                onChange={(e) => edit({ description: e.target.value })}
                placeholder="定义、背景，以及哪些部分是假设。"
              />
            </div>
            {(
              [
                ['properties', '核心属性'],
                ['functions', '功能或用途'],
                ['constraints', '限制与未知'],
              ] as const
            ).map(([key, label]) => (
              <div className="form-field" key={key}>
                <label htmlFor={`custom-${key}`}>{label}（每行一项）</label>
                <textarea
                  id={`custom-${key}`}
                  rows={3}
                  value={form[key]}
                  onChange={(e) => edit({ [key]: e.target.value })}
                  placeholder="可直接编辑；留空则使用待确认的探索维度。"
                />
              </div>
            ))}
            <div className="form-field">
              <label htmlFor="custom-tags">标签（逗号分隔）</label>
              <input
                id="custom-tags"
                value={form.tags}
                onChange={(e) => edit({ tags: e.target.value })}
                placeholder="例如：记忆、时间、信息"
              />
            </div>
          </>
        )}
        {error && (
          <div className="error-box" role="alert">
            <p>{error}</p>
            {data.settings.enabled && (
              <button className="button" disabled={busy} onClick={() => void analyze(true)}>
                改用本地草案
              </button>
            )}
          </div>
        )}
        <div className="button-row editor-save">
          <button className="button primary" disabled={busy || !form.name.trim()} onClick={save}>
            <Plus size={16} />
            {existing ? '使用已有概念' : target ? `创建并设为 Concept ${target}` : '保存到概念库'}
          </button>
          <button className="button" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </Modal>
  );
}
