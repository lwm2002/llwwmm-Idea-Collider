import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shuffle, Zap, Sparkles } from 'lucide-react';
import { examples } from '../data/concepts';
import { useStore } from '../hooks/store';
import { randomPair } from '../utils/distance';
import { pick, uid } from '../utils/id';
import { PageTitle } from '../components/ui';
import { ConceptGlyph } from '../components/ConceptGlyph';
const templates = [
  ['材料', '生物'],
  ['机械', '日常用品'],
  ['自然现象', '计算机'],
  ['建筑', '医学'],
  ['艺术', '电子'],
  ['人工智能', '物理'],
  ['太空', '日常用品'],
  ['音乐', '计算机'],
];
export default function Inspiration() {
  const { update, concepts, conceptMap } = useStore();
  const navigate = useNavigate();
  const [slots, setSlots] = useState<[string, string]>(['蜘蛛网', '数据库']);
  const [spinning, setSpinning] = useState(false);
  const [surprise, setSurprise] = useState(() => randomPair(80, concepts));
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const today = new Date();
  const dayCode = Number(
    `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`,
  );
  const daily = concepts[dayCode % concepts.length];
  useEffect(
    () => () => {
      if (interval.current) clearInterval(interval.current);
      if (timeout.current) clearTimeout(timeout.current);
    },
    [],
  );
  function choose(pair: [string, string]) {
    update((s) => ({ ...s, pair }));
    navigate('/');
  }
  function spin() {
    if (spinning) return;
    setSpinning(true);
    interval.current = setInterval(() => setSlots([pick(concepts).id, pick(concepts).id]), 85);
    timeout.current = setTimeout(() => {
      if (interval.current) clearInterval(interval.current);
      setSlots(randomPair(95, concepts));
      setSpinning(false);
    }, 1600);
  }
  return (
    <>
      <PageTitle
        eyebrow="DISCOVER YOUR NEXT EXPERIMENT"
        title="灵感游乐场"
        description="放下目的性，让偶然把你带到一个没去过的地方。"
      />
      <div className="inspiration-top">
        <section className="daily-card">
          <div className="eyebrow">
            <Sparkles size={14} /> 今日概念 / DAILY SPECIMEN
          </div>
          <ConceptGlyph name={daily.category} />
          <span className="tag">{daily.category}</span>
          <h2>{daily.name}</h2>
          <p>{daily.description}</p>
          <button
            className="text-link"
            onClick={() => choose([daily.id, pick(concepts.filter((c) => c.id !== daily.id)).id])}
          >
            以它开始一次碰撞 <ArrowRight size={16} />
          </button>
        </section>
        <section className="slot-machine">
          <div className="section-heading">
            <div>
              <div className="eyebrow">LET SERENDIPITY TAKE OVER</div>
              <h2>摇出一次意外相遇</h2>
            </div>
            <span className="tiny">01 / ∞</span>
          </div>
          <div
            className={`slot-reels ${spinning ? 'spinning' : ''}`}
            aria-live={spinning ? 'off' : 'polite'}
          >
            <div>
              <span className="tiny">CONCEPT A</span>
              <strong>{slots[0]}</strong>
              <span className="tag">{conceptMap[slots[0]].category}</span>
            </div>
            <span className="slot-x">×</span>
            <div>
              <span className="tiny">CONCEPT B</span>
              <strong>{slots[1]}</strong>
              <span className="tag">{conceptMap[slots[1]].category}</span>
            </div>
          </div>
          <p>给未知一个机会。拉动概念老虎机，看看谁会相遇。</p>
          <div className="button-row">
            <button className="button primary" disabled={spinning} onClick={spin}>
              <Shuffle size={16} />
              {spinning ? 'SPINNING…' : 'SPIN'}
            </button>
            <button
              className="button"
              disabled={spinning}
              onClick={() => {
                update((s) => ({ ...s, pair: slots }));
                navigate(
                  `/collision/new-${uid()}?a=${encodeURIComponent(slots[0])}&b=${encodeURIComponent(slots[1])}`,
                );
              }}
            >
              <Zap size={16} />
              COLLIDE
            </button>
          </div>
        </section>
      </div>
      <section className="surprise-pair">
        <div>
          <span className="eyebrow">RANDOM ENCOUNTER</span>
          <h2>
            {surprise[0]} <span>×</span> {surprise[1]}
          </h2>
        </div>
        <div className="button-row">
          <button
            className="icon-button"
            aria-label="换一组随机组合"
            onClick={() => setSurprise(randomPair(80, concepts))}
          >
            <Shuffle size={18} />
          </button>
          <button className="button" onClick={() => choose(surprise)}>
            带入工作台 <ArrowRight size={16} />
          </button>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">CROSS-DOMAIN RECIPES</span>
          <h2>一些值得尝试的相遇</h2>
        </div>
        <span className="muted">热门组合模板</span>
      </div>
      <div className="template-grid">
        {templates.map(([a, b], i) => (
          <button
            key={a}
            className="template-card"
            onClick={() =>
              choose([
                pick(concepts.filter((c) => c.category === a)).id,
                pick(concepts.filter((c) => c.category === b)).id,
              ])
            }
          >
            <span className="tiny">RECIPE / 0{i + 1}</span>
            <strong>
              {a}
              <span>×</span>
              {b}
            </strong>
            <ArrowRight size={17} />
          </button>
        ))}
      </div>
      <div className="section-heading">
        <h2>经典实验样本</h2>
      </div>
      <div className="tags">
        {examples.map((pair) => (
          <button className="chip" key={pair[0]} onClick={() => choose(pair)}>
            {pair[0]} × {pair[1]} ↗
          </button>
        ))}
      </div>
    </>
  );
}
