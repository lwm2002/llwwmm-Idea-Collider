import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Shuffle, GitBranch } from 'lucide-react';
import { useStore } from '../hooks/store';
import { mutations } from '../services/ai/localGenerator';
import { getProvider } from '../services/ai/provider';
import { pick } from '../utils/id';
import { PageTitle, Empty, Loading, ErrorBox } from '../components/ui';
import { IdeaCard } from '../components/IdeaCard';
import { useAiRequest } from '../hooks/useAiRequest';
export default function Evolution() {
  const { id } = useParams();
  const { data, update, conceptMap } = useStore();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastMutation, setLastMutation] = useState('更实用');
  const request = useAiRequest();
  const idea = data.ideas.find((i) => i.id === id);
  const collision = data.collisions.find((c) => c.id === idea?.collisionId);
  const versions = data.ideas
    .filter((i) => i.rootId === idea?.rootId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const current = versions.findIndex((i) => i.id === id);
  async function evolve(mutation: string, offline = false) {
    if (!idea || !collision) return;
    const controller = request.start();
    if (!controller) return;
    setLastMutation(mutation);
    setBusy(true);
    setError('');
    try {
      const result = await getProvider(data.settings, offline).evolveIdea(
        idea,
        mutation,
        conceptMap[collision.conceptAId],
        conceptMap[collision.conceptBId],
        controller.signal,
      );
      if (controller.signal.aborted) return;
      update((s) => ({ ...s, ideas: [result, ...s.ideas] }));
      navigate(`/evolution/${result.id}`);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '演化失败');
    } finally {
      request.finish(controller);
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  if (!idea || !collision)
    return (
      <Empty title="还没有这个创意">
        <Link to="/">先完成一次碰撞，生成你的第一件发明。</Link>
      </Empty>
    );
  return (
    <>
      <Link className="back-link" to={`/collision/${collision.id}`}>
        <ArrowLeft size={15} />
        返回碰撞
      </Link>
      <PageTitle
        eyebrow="EVOLUTION WORKSHOP"
        title="创意演化工作坊"
        description={`${conceptMap[collision.conceptAId].name} × ${conceptMap[collision.conceptBId].name} · 选择一个变异方向，保留每一步的可能性。`}
      />
      <div className="evolution-layout">
        <aside className="mutation-panel">
          <div className="eyebrow">
            <GitBranch size={15} /> MUTATION CONTROLS
          </div>
          <h2>给它一个新方向</h2>
          <p>每次变异都会创建新版本，原版始终保留。</p>
          <div className="mutation-buttons">
            {mutations.map((m) => (
              <button
                disabled={busy}
                className={`button ${lastMutation === m ? 'selected' : ''}`}
                key={m}
                onClick={() => void evolve(m)}
              >
                {m}
                <span>↗</span>
              </button>
            ))}
          </div>
          <button
            disabled={busy}
            className="button primary full-width"
            onClick={() => void evolve(pick([...mutations]))}
          >
            <Shuffle size={16} />
            随机突变
          </button>
          {busy && <Loading label="正在演化新版本…" />}
          {error && (
            <ErrorBox
              error={error}
              onRetry={() => void evolve(lastMutation)}
              onOffline={() => void evolve(lastMutation, true)}
            />
          )}
        </aside>
        <div className="evolution-main">
          <div className="version-bar">
            <button
              className="icon-button"
              aria-label="上一版本"
              disabled={current <= 0 || busy}
              onClick={() => navigate(`/evolution/${versions[current - 1].id}`)}
            >
              <ArrowLeft size={17} />
            </button>
            <div>
              <strong>
                V{idea.version} · {idea.mutation}
              </strong>
              <span>
                {idea.parentId
                  ? `源自 V${data.ideas.find((x) => x.id === idea.parentId)?.version ?? '?'}`
                  : '最初的火花'}{' '}
                · {current + 1}/{versions.length} 个存档
              </span>
            </div>
            <button
              className="icon-button"
              aria-label="下一版本"
              disabled={current >= versions.length - 1 || busy}
              onClick={() => navigate(`/evolution/${versions[current + 1].id}`)}
            >
              <ArrowRight size={17} />
            </button>
          </div>
          <IdeaCard key={idea.id} idea={idea} expanded />
          <section className="lineage-panel">
            <h3>
              演化谱系 <span className="tiny">LINEAGE</span>
            </h3>
            <div className="lineage">
              {versions.map((v) => (
                <button
                  disabled={busy}
                  key={v.id}
                  className={v.id === id ? 'active' : ''}
                  onClick={() => navigate(`/evolution/${v.id}`)}
                >
                  <span>V{v.version}</span>
                  <strong>{v.mutation}</strong>
                  <small>
                    {v.parentId
                      ? `← V${data.ideas.find((x) => x.id === v.parentId)?.version ?? '?'}`
                      : '起点'}
                  </small>
                </button>
              ))}
            </div>
            <p className="muted">从历史版本继续演化会创建分支；每个版本都记录其直接父版本。</p>
          </section>
        </div>
      </div>
    </>
  );
}
