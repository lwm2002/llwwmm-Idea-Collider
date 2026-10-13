import { useEffect, useRef, useState } from 'react';
import { explainConcept } from '../services/ai/explainConcept';
import type { Concept } from '../types';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../hooks/store';
import { Modal, FavoriteButton } from './ui';
function ConceptDetailContent({
  concept,
  onClose,
  onSelectRelated,
}: {
  concept: Concept;
  onClose: () => void;
  onSelectRelated: (c: Concept) => void;
}) {
  const { data, update, conceptMap } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const detail = data.explanations[concept.id];
  useEffect(() => () => controller.current?.abort(), []);
  async function expand() {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError('');
    try {
      const result = await explainConcept(concept, data.settings, abort.signal);
      if (abort.signal.aborted) return;
      update((s) => ({ ...s, explanations: { ...s.explanations, [concept.id]: result } }));
    } catch (e) {
      if (!abort.signal.aborted) setError(e instanceof Error ? e.message : '解释失败');
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  const navigate = useNavigate();
  function assign(index: 0 | 1) {
    update((s) => ({
      ...s,
      pair: index === 0 ? [concept.id, s.pair[1]] : [s.pair[0], concept.id],
    }));
    onClose();
    navigate('/');
  }
  return (
    <Modal title={concept.name} onClose={onClose}>
      <div className="detail-title">
        <div>
          <span className="tag">{concept.category}</span>
          <h2>{concept.name}</h2>
        </div>
        <FavoriteButton kind="concepts" id={concept.id} />
      </div>
      <section>
        <h3>它是什么</h3>
        <p>{detail?.definition ?? concept.description}</p>
      </section>
      {concept.source && (
        <p className="draft-notice">
          自定义概念 ·{' '}
          {concept.source === 'api'
            ? 'AI 辅助拆解'
            : concept.source === 'manual'
              ? '手动定义'
              : '本地草案'}{' '}
          · 定义与机制尚需验证
        </p>
      )}
      {detail && (
        <>
          <section>
            <h3>怎样运作 / 怎样理解</h3>
            <p>{detail.mechanism}</p>
          </section>
          <section>
            <h3>具体例子</h3>
            <ul>
              {detail.examples.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3>与相近概念的区别</h3>
            <p>{detail.distinctions}</p>
          </section>
          <section>
            <h3>逐项属性解释</h3>
            {detail.propertyDetails.map((p) => (
              <div key={p.property}>
                <h4>{p.property}</h4>
                <p>{p.explanation}</p>
              </div>
            ))}
          </section>
          <section>
            <h3>边界与不确定性</h3>
            <ul>
              {detail.uncertainties.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
          <p className="draft-notice">以上为保存的 AI 解释，未经外部事实核查。</p>
        </>
      )}
      {data.settings.enabled ? (
        <button className="button" disabled={busy} onClick={() => void expand()}>
          {busy ? '正在解释概念…' : detail ? '重新解释概念' : 'AI 深入解释每项属性'}
        </button>
      ) : (
        !detail && (
          <p className="draft-notice">
            以下为该概念已有的具体属性、用途和限制。启用 API 后可进一步解释每项属性的含义与原理。
          </p>
        )
      )}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      {[
        ['核心属性', concept.properties],
        ['功能', concept.functions],
        ['限制', concept.constraints],
      ].map(([label, items]) => (
        <section key={label as string}>
          <h3>{label}</h3>
          <div className="tags">
            {(items as string[]).map((x) => (
              <span className="tag" key={x}>
                {x}
              </span>
            ))}
          </div>
        </section>
      ))}
      <section>
        <h3>相关概念</h3>
        <div className="tags">
          {concept.relatedConcepts.map((id) => (
            <button className="chip" key={id} onClick={() => onSelectRelated(conceptMap[id])}>
              {conceptMap[id].name} ↗
            </button>
          ))}
        </div>
      </section>
      <div className="button-row">
        <button className="button primary" onClick={() => assign(0)}>
          设为 Concept A
        </button>
        <button className="button" onClick={() => assign(1)}>
          设为 Concept B
        </button>
      </div>
    </Modal>
  );
}

export function ConceptDetail(props: Parameters<typeof ConceptDetailContent>[0]) {
  return <ConceptDetailContent key={props.concept.id} {...props} />;
}
