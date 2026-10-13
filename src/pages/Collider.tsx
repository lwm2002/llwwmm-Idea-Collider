import { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight,
  Shuffle,
  Sparkles,
  ArrowLeftRight,
  Zap,
  SlidersHorizontal,
  Clock,
} from 'lucide-react';
import { useStore } from '../hooks/store';
import { ConceptPicker } from '../components/ConceptPicker';
import { ConceptWorkbench } from '../components/ConceptWorkbench';
import { ConceptDetail } from '../components/ConceptDetail';
import { examples } from '../data/concepts';
import { conceptDistance, randomPair } from '../utils/distance';
import { uid } from '../utils/id';
import type { Concept } from '../types';
export default function Collider() {
  const { data, update, concepts, conceptMap } = useStore();
  const navigate = useNavigate();
  const [distance, setDistance] = useState(65);
  const [connectionCount, setConnectionCount] = useState(8);
  const [detail, setDetail] = useState<Concept | null>(null);
  const [mobileView, setMobileView] = useState<'canvas' | 'configure'>('canvas');
  const workbench = useRef<HTMLDivElement>(null);
  function showCanvas() {
    setMobileView('canvas');
    requestAnimationFrame(() =>
      workbench.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  }
  const [a, b] = data.pair;
  const pair = (ids: [string, string]) => update((s) => ({ ...s, pair: ids }));
  const actual = Math.round(conceptDistance(conceptMap[a], conceptMap[b]) * 100);
  return (
    <div className="studio-home">
      <div className="studio-welcome">
        <div>
          <span className="eyebrow">你的创意白板</span>
          <h1>
            把想法摊开，看看会发生什么<span>。</span>
          </h1>
          <p>拖动两个概念，自由摆放。找到一次值得探索的相遇。</p>
        </div>
        <Link className="button" to="/inspiration">
          <Sparkles size={16} />
          没有想法？从这里开始
          <ArrowRight size={15} />
        </Link>
      </div>
      <div className="mobile-workbench-switch" aria-label="手机工作台视图">
        <button aria-pressed={mobileView === 'canvas'} onClick={() => setMobileView('canvas')}>
          <Zap size={15} />
          实验台
        </button>
        <button
          aria-pressed={mobileView === 'configure'}
          onClick={() => setMobileView('configure')}
        >
          <SlidersHorizontal size={15} />
          配置概念
        </button>
      </div>
      <div className="studio-workbench" ref={workbench} data-mobile-view={mobileView}>
        <div className="experiment-main">
          <section className="experiment-canvas" aria-label="概念碰撞实验台">
            <div className="canvas-topline">
              <span>
                <i className="status-dot" />
                实验台已就绪
              </span>
              <span>EXPERIMENT {String(data.collisions.length + 1).padStart(3, '0')}</span>
            </div>
            <ConceptWorkbench a={conceptMap[a]} b={conceptMap[b]} onOpen={setDetail} />
            <div className="canvas-distance">
              <span>概念距离</span>
              <div>
                <i style={{ width: `${actual}%` }} />
              </div>
              <b>
                {actual}
                <small>/100</small>
              </b>
              <span>{actual > 75 ? '意外相遇' : actual > 35 ? '跨界探索' : '近邻启发'}</span>
            </div>
            <div className="canvas-toolbar">
              <button onClick={() => pair([b, a])}>
                <ArrowLeftRight size={15} />
                交换概念
              </button>
              <button onClick={() => pair(randomPair(distance, concepts))}>
                <Shuffle size={15} />
                随机组合
              </button>
            </div>
            <div className="canvas-launch">
              <div>
                <strong>{a === b ? '需要两个不同的概念' : '准备好制造一点意外了吗？'}</strong>
                <span>{connectionCount} 个连接起点 · 三种创意方向 · 持续演化</span>
              </div>
              <button
                aria-label="COLLIDE"
                className="collide-button"
                disabled={a === b}
                onClick={() =>
                  navigate(
                    `/collision/new-${uid()}?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&count=${connectionCount}`,
                  )
                }
              >
                <Zap size={19} />
                开始碰撞
                <ArrowRight size={18} />
              </button>
            </div>
          </section>
          <section className="studio-recipes">
            <div className="section-heading">
              <div>
                <span className="eyebrow">QUICK START</span>
                <h2>试试这些奇妙组合</h2>
              </div>
              <Link className="text-link" to="/inspiration">
                全部灵感
                <ArrowRight size={14} />
              </Link>
            </div>
            <div className="recipe-strip">
              {examples.slice(0, 4).map(([x, y], i) => (
                <button key={x} onClick={() => pair([x, y])}>
                  <span className="recipe-number">0{i + 1}</span>
                  <strong>
                    {x}
                    <span>×</span>
                    {y}
                  </strong>
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
          </section>
          <section className="studio-recent">
            <div className="section-heading">
              <h2>
                <Clock size={16} />
                最近的实验
              </h2>
              <Link className="text-link" to="/history" aria-label="查看全部实验记录">
                查看全部
                <ArrowRight size={14} />
              </Link>
            </div>
            {data.collisions.length ? (
              <div className="recent-experiments">
                {data.collisions.slice(0, 3).map((c) => (
                  <Link key={c.id} to={`/collision/${c.id}`}>
                    <span className="recent-icon">
                      <Zap size={17} />
                    </span>
                    <div>
                      <strong>
                        {conceptMap[c.conceptAId].name} × {conceptMap[c.conceptBId].name}
                      </strong>
                      <span>
                        {c.connections.length} 个连接 ·{' '}
                        {new Date(c.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <ArrowRight size={16} />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="recent-empty">
                <span>✳</span>
                <div>
                  <strong>你的第一个想法，正在路上。</strong>
                  <p>完成一次碰撞后，可以在这里接着探索。</p>
                </div>
              </div>
            )}
          </section>
        </div>
        <aside className="experiment-inspector" aria-label="实验设置">
          <div className="inspector-heading">
            <SlidersHorizontal size={17} />
            <h2>配置这次相遇</h2>
            <span>01 / 03</span>
          </div>
          <div className="inspector-concepts">
            <ConceptPicker id={a} side="A" onChange={(id) => pair([id, b])} compact />
            <div className="inspector-connector">
              <span />
              两个不同的视角
              <span />
            </div>
            <ConceptPicker id={b} side="B" onChange={(id) => pair([a, id])} compact />
          </div>
          <section className="experiment-parameters">
            <h3>探索设置</h3>
            <label className="connection-options">
              首批连接数量
              <select
                aria-label="首批连接数量"
                value={connectionCount}
                onChange={(e) => setConnectionCount(Number(e.target.value))}
              >
                <option value={4}>4 条 · 快速</option>
                <option value={8}>8 条 · 广泛</option>
                <option value={12}>12 条 · 深入</option>
              </select>
            </label>
            <small>结果页可继续探索更多连接。</small>
            <div className="parameter-title">
              <span>随机组合的距离</span>
              <b>{distance}%</b>
            </div>
            <div className="segmented">
              {[
                ['近距离', 15],
                ['跨领域', 65],
                ['极端碰撞', 100],
              ].map(([label, value]) => (
                <button
                  key={label}
                  className={Number(value) === distance ? 'active' : ''}
                  onClick={() => setDistance(Number(value))}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="slider-row">
              <span>熟悉</span>
              <input
                aria-label="概念距离：熟悉到荒诞"
                type="range"
                min="0"
                max="100"
                value={distance}
                onChange={(e) => setDistance(Number(e.target.value))}
              />
              <span>荒诞</span>
            </div>
            <button
              className="button full-width"
              onClick={() => pair(randomPair(distance, concepts))}
            >
              <Shuffle size={15} />
              帮我选
            </button>
          </section>
          <div className="inspector-tip">
            <Sparkles size={17} />
            <p>不必追求“正确”的组合。越不相关，越可能有惊喜。</p>
          </div>
          <button className="button primary mobile-config-done" onClick={showCanvas}>
            应用概念，回到实验台
            <ArrowRight size={16} />
          </button>
        </aside>
      </div>
      {detail && (
        <ConceptDetail
          concept={detail}
          onClose={() => setDetail(null)}
          onSelectRelated={setDetail}
        />
      )}
    </div>
  );
}
