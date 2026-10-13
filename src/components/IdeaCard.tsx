import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GitBranch, ShieldQuestion, ChevronDown } from 'lucide-react';
import type { Idea } from '../types';
import { useStore } from '../hooks/store';
import { getProvider } from '../services/ai/provider';
import { FavoriteButton, Score, Loading, ErrorBox } from './ui';
import { CriticPanel } from './CriticPanel';
import { useAiRequest } from '../hooks/useAiRequest';
export function IdeaCard({ idea, expanded = false }: { idea: Idea; expanded?: boolean }) {
  const { data, update, conceptMap } = useStore();
  const [open, setOpen] = useState(expanded);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showCritic, setShowCritic] = useState(false);
  const request = useAiRequest();
  const critic = data.critics[idea.id];
  const collision = data.collisions.find((x) => x.id === idea.collisionId);
  async function challenge(offline = false) {
    if (!collision) return;
    setShowCritic(true);
    if (critic) return;
    const controller = request.start();
    if (!controller) return;
    setBusy(true);
    setError('');
    try {
      const result = await getProvider(data.settings, offline).criticizeIdea(
        idea,
        conceptMap[collision.conceptAId],
        conceptMap[collision.conceptBId],
        controller.signal,
      );
      if (controller.signal.aborted) return;
      update((s) => ({ ...s, critics: { ...s.critics, [idea.id]: result } }));
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : '生成挑战失败');
    } finally {
      request.finish(controller);
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <article className={`idea-card ${open ? 'expanded' : ''}`}>
      <div className="idea-meta">
        <span className={`kind kind-${idea.kind}`}>{idea.kind}</span>
        <span className="tiny">
          V{idea.version} / {idea.source === 'local' ? 'LOCAL' : 'AI'}
        </span>
        <FavoriteButton kind="ideas" id={idea.id} />
      </div>
      <h3>{idea.name}</h3>
      <p className="idea-summary">{idea.summary}</p>
      <div className="scores">
        <Score label="Novelty" value={idea.novelty} />
        <Score label="Feasibility" value={idea.feasibility} />
        <Score label="Fun" value={idea.fun} />
      </div>
      <button className="details-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? '收起原理与实现' : '查看原理与实现'}
        <ChevronDown size={15} style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>
      {open && (
        <div className="idea-details">
          {[
            ['解决什么问题', idea.problem],
            ['核心原理 · 创意假设', idea.principle],
            ['Concept A 的贡献', idea.contributionA],
            ['Concept B 的贡献', idea.contributionB],
            ['可能如何实现', idea.implementation],
            ['最大的挑战', idea.biggestProblem],
          ].map(([title, text]) => (
            <div key={title}>
              <h4>{title}</h4>
              <p>{text}</p>
            </div>
          ))}
        </div>
      )}
      <div className="idea-actions">
        <Link to={`/evolution/${idea.id}`} className="button primary">
          <GitBranch size={15} /> EVOLVE
        </Link>
        <button
          className="button"
          disabled={busy}
          onClick={() => {
            if (showCritic && critic) setShowCritic(false);
            else void challenge();
          }}
        >
          {busy ? (
            <Loading label="检验中" />
          ) : (
            <>
              <ShieldQuestion size={15} /> CHALLENGE
            </>
          )}
        </button>
      </div>
      {error && (
        <ErrorBox
          error={error}
          onRetry={() => void challenge()}
          onOffline={() => void challenge(true)}
        />
      )}{' '}
      {showCritic && critic && <CriticPanel critic={critic} />}
    </article>
  );
}
