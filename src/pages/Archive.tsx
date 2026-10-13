import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock, FlaskConical, GitBranch } from 'lucide-react';
import { useStore } from '../hooks/store';
import type { Concept } from '../types';
import { PageTitle, Empty, FavoriteButton } from '../components/ui';
import { ConceptDetail } from '../components/ConceptDetail';
import { IdeaCard } from '../components/IdeaCard';
export default function Archive({ favorites = false }: { favorites?: boolean }) {
  const { data, conceptMap } = useStore();
  const [tab, setTab] = useState(favorites ? 'concepts' : 'collisions');
  const [detail, setDetail] = useState<Concept | null>(null);
  const collisions = data.collisions.filter(
    (c) => !favorites || data.favorites.collisions.includes(c.id),
  );
  const ideas = data.ideas.filter((i) => !favorites || data.favorites.ideas.includes(i.id));
  const concepts = data.favorites.concepts.map((id) => conceptMap[id]).filter(Boolean);
  const shownIdeas = tab === 'evolution' ? ideas.filter((i) => i.version > 1) : ideas;
  const format = (date: string) =>
    new Date(date).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  return (
    <>
      <PageTitle
        eyebrow={favorites ? 'YOUR CABINET OF CURIOSITIES' : 'THE EXPERIMENT LOG'}
        title={favorites ? '我的灵感收藏' : '实验记录'}
        description={
          favorites
            ? '概念、碰撞与发明，收藏在你的本地灵感档案。'
            : '概念组合、连接、创意与演化版本，自动保存在这个浏览器中。'
        }
      />
      <div className="archive-overview">
        <div>
          <FlaskConical size={19} />
          <strong>{collisions.length}</strong>
          <span>次碰撞实验</span>
        </div>
        <div>
          <ArrowUpRight size={19} />
          <strong>{ideas.filter((i) => i.version === 1).length}</strong>
          <span>个创意起点</span>
        </div>
        <div>
          <GitBranch size={19} />
          <strong>{ideas.filter((i) => i.version > 1).length}</strong>
          <span>个演化版本</span>
        </div>
      </div>
      <div className="archive-tabs">
        {(favorites
          ? [
              ['concepts', '概念', concepts.length],
              ['collisions', '碰撞', collisions.length],
              ['ideas', '创意', ideas.length],
            ]
          : [
              ['collisions', '碰撞与概念组合', collisions.length],
              ['ideas', '创意', ideas.length],
              ['evolution', '演化', ideas.filter((i) => i.version > 1).length],
            ]
        ).map(([key, label, count]) => (
          <button
            className={tab === key ? 'active' : ''}
            key={key}
            onClick={() => setTab(String(key))}
          >
            {label}
            <span>{count}</span>
          </button>
        ))}
      </div>
      {tab === 'concepts' && (
        <div className="library-grid">
          {concepts.map((c) => (
            <article className="library-card" key={c.id}>
              <div className="library-card-top">
                <span className="tag">{c.category}</span>
                <FavoriteButton kind="concepts" id={c.id} />
              </div>
              <button className="card-main" onClick={() => setDetail(c)}>
                <h2>
                  {c.name}
                  <ArrowUpRight size={16} />
                </h2>
                <p>{c.description}</p>
              </button>
            </article>
          ))}
        </div>
      )}
      {tab === 'collisions' && (
        <div className="archive-list">
          {collisions.map((c) => (
            <article className="archive-row" key={c.id}>
              <div className="archive-symbol">
                <FlaskConical size={23} />
              </div>
              <Link to={`/collision/${c.id}`}>
                <span className="eyebrow">
                  {c.source === 'local' ? 'LOCAL EXPERIMENT' : 'AI EXPERIMENT'} / {c.id.slice(0, 6)}
                </span>
                <h3>
                  {conceptMap[c.conceptAId].name} <span>×</span> {conceptMap[c.conceptBId].name}
                </h3>
                <p>
                  {c.connections.length} 个连接 ·{' '}
                  {data.ideas.filter((i) => i.collisionId === c.id).length} 个创意与版本
                </p>
              </Link>
              <span className="archive-time">
                <Clock size={13} />
                {format(c.createdAt)}
              </span>
              <FavoriteButton kind="collisions" id={c.id} />
              <Link className="icon-button" aria-label="打开碰撞" to={`/collision/${c.id}`}>
                <ArrowUpRight size={18} />
              </Link>
            </article>
          ))}
        </div>
      )}
      {(tab === 'ideas' || tab === 'evolution') && (
        <div className="idea-grid">
          {shownIdeas.map((idea) => (
            <div key={idea.id}>
              {tab === 'evolution' && (
                <Link className="evolution-archive-link" to={`/evolution/${idea.id}`}>
                  <GitBranch size={14} />
                  {idea.mutation} · V{idea.version} · {format(idea.createdAt)}
                </Link>
              )}
              <IdeaCard idea={idea} />
            </div>
          ))}
        </div>
      )}
      {((tab === 'concepts' && !concepts.length) ||
        (tab === 'collisions' && !collisions.length) ||
        ((tab === 'ideas' || tab === 'evolution') && !shownIdeas.length)) && (
        <Empty title={favorites ? '你的灵感档案，等待第一颗星。' : '实验记录，从一次碰撞开始。'}>
          <Link to="/">回到工作台，寻找你的第一个连接 →</Link>
        </Empty>
      )}
      {detail && (
        <ConceptDetail
          concept={detail}
          onSelectRelated={setDetail}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
