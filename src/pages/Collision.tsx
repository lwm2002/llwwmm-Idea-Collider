import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, FlaskConical } from 'lucide-react';
import { useStore } from '../hooks/store';
import { getProvider } from '../services/ai/provider';
import { uid } from '../utils/id';
import { PageTitle, FavoriteButton, ErrorBox, Loading, Empty } from '../components/ui';
import { CollisionGraph } from '../components/CollisionGraph';
import { IdeaCard } from '../components/IdeaCard';
import { ConceptDetail } from '../components/ConceptDetail';
import type { Concept } from '../types';
import { freshConnections } from '../utils/connections';
import { requestTimeoutSeconds } from '../services/ai/connection';
import { useAiRequest } from '../hooks/useAiRequest';
import { formatScore } from '../services/ai/scores';
const steps = ['解析 Concept A', '解析 Concept B', '寻找跨领域连接', '生成碰撞图谱'];
export default function Collision() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { data, update, conceptMap } = useStore();
  const navigate = useNavigate();
  const creating = id?.startsWith('new-');
  const saved = data.collisions.find((c) => c.id === id);
  const a = conceptMap[saved?.conceptAId ?? params.get('a') ?? ''];
  const b = conceptMap[saved?.conceptBId ?? params.get('b') ?? ''];
  const requestedCount = Number(params.get('count'));
  const count = [4, 8, 12].includes(requestedCount) ? requestedCount : 8;
  const [detail, setDetail] = useState<Concept | null>(null);
  const [graphPage, setGraphPage] = useState(0);
  const [moreBusy, setMoreBusy] = useState(false);
  const [moreError, setMoreError] = useState('');
  const [moreNotice, setMoreNotice] = useState('');
  const [batchCount, setBatchCount] = useState(8);
  const moreFlight = useRef(false);
  const collisionRequest = useAiRequest();
  const ideaRequest = useAiRequest();
  const moreRequest = useAiRequest();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [offlineRun, setOfflineRun] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [selected, setSelected] = useState<string | null>(saved?.connections[0]?.id ?? null);
  const [ideaBusy, setIdeaBusy] = useState(false);
  const [ideaError, setIdeaError] = useState('');
  const mounted = useRef(true);
  const started = useRef(false);
  const ideasRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function collide(offline = false) {
    if (!a || !b || a.id === b.id) return;
    const controller = collisionRequest.start();
    if (!controller) return;
    setBusy(true);
    setOfflineRun(offline);
    setError('');
    setStep(0);
    setElapsed(0);
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (mounted.current && !controller.signal.aborted) {
        setStep((s) => Math.min(s + 1, 2));
        setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      }
    }, 450);
    try {
      let notice = '';
      const connections = await getProvider(data.settings, offline).generateConnections(a, b, {
        count,
        signal: controller.signal,
        onNotice: (message) => {
          notice = message;
        },
      });
      if (!mounted.current || controller.signal.aborted) return;
      if (!connections.length) throw new Error('本轮没有生成有效连接，请补充概念定义后重试。');
      const collision = {
        id: uid(),
        notice:
          notice ||
          (connections.length < count
            ? `本轮请求 ${count} 条，保留 ${connections.length} 条有效连接。`
            : undefined),
        conceptAId: a.id,
        conceptBId: b.id,
        connections: connections.map((c) => ({
          ...c,
          source: data.settings.enabled && !offline ? ('api' as const) : ('local' as const),
        })),
        createdAt: new Date().toISOString(),
        source: data.settings.enabled && !offline ? ('api' as const) : ('local' as const),
      };
      update((s) => ({ ...s, collisions: [collision, ...s.collisions] }));
      navigate(`/collision/${collision.id}`, { replace: true });
    } catch (e) {
      if (mounted.current && !controller.signal.aborted)
        setError(e instanceof Error ? e.message : '碰撞失败');
    } finally {
      clearInterval(timer);
      collisionRequest.finish(controller);
      if (mounted.current && !controller.signal.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    if (creating && !started.current) {
      started.current = true;
      void collide();
    }
    // The request belongs to this route instance; settings changes do not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function generate(connectionId: string, offline = false) {
    if (!saved || inFlight.current) return;
    setSelected(connectionId);
    setIdeaError('');
    const existing = data.ideas.filter(
      (i) => i.collisionId === saved.id && i.connectionId === connectionId && i.version === 1,
    );
    if (existing.length) {
      ideasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const c = saved.connections.find((x) => x.id === connectionId);
    if (!c) return;
    const controller = ideaRequest.start();
    if (!controller) return;
    inFlight.current = true;
    setIdeaBusy(true);
    try {
      const ideas = await getProvider(data.settings, offline).generateIdeas(
        a,
        b,
        c,
        saved.id,
        controller.signal,
      );
      if (!mounted.current || controller.signal.aborted) return;
      update((s) => ({ ...s, ideas: [...ideas, ...s.ideas] }));
      if (mounted.current)
        setTimeout(
          () => ideasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          100,
        );
    } catch (e) {
      if (mounted.current && !controller.signal.aborted)
        setIdeaError(e instanceof Error ? e.message : '生成失败');
    } finally {
      inFlight.current = false;
      ideaRequest.finish(controller);
      if (mounted.current) setIdeaBusy(false);
    }
  }
  async function exploreMore(offline = false) {
    if (!saved || moreFlight.current || saved.connections.length >= 500) return;
    const controller = moreRequest.start();
    if (!controller) return;
    moreFlight.current = true;
    setMoreBusy(true);
    setMoreError('');
    setMoreNotice('');
    try {
      let notice = '';
      const rows = await getProvider(data.settings, offline).generateConnections(a, b, {
        count: batchCount,
        exclude: saved.connections,
        signal: controller.signal,
        onNotice: (message) => {
          notice = message;
        },
      });
      if (!mounted.current || controller.signal.aborted) return;
      const fresh = freshConnections(saved.connections, rows)
        .map((c) => ({
          ...c,
          source: data.settings.enabled && !offline ? ('api' as const) : ('local' as const),
        }))
        .slice(0, 500 - saved.connections.length);
      if (!fresh.length) {
        setMoreNotice('本轮没有找到新的不重复连接。可以补充概念定义，或换一个模型后继续探索。');
        return;
      }
      update((s) => ({
        ...s,
        collisions: s.collisions.map((c) =>
          c.id === saved.id
            ? { ...c, connections: [...c.connections, ...freshConnections(c.connections, fresh)] }
            : c,
        ),
      }));
      setMoreNotice(`新增 ${fresh.length} 条连接，已有结果与发明已保留。${notice}`);
    } catch (e) {
      if (mounted.current && !controller.signal.aborted)
        setMoreError(e instanceof Error ? e.message : '继续探索失败');
    } finally {
      moreFlight.current = false;
      moreRequest.finish(controller);
      if (mounted.current) setMoreBusy(false);
    }
  }
  if (!a || !b || a.id === b.id)
    return (
      <Empty title="这个实验还没准备好">
        <Link to="/">返回工作台，选择两个不同的概念。</Link>
      </Empty>
    );
  if (!creating && !saved)
    return (
      <Empty title="找不到这个碰撞">
        <Link to="/">回到工作台创建一次新实验。</Link>
      </Empty>
    );
  if (creating)
    return (
      <div className="collision-progress">
        <div className="eyebrow">REACTION IN PROGRESS</div>
        <div className={`large-reactor ${busy ? 'reacting' : ''}`}>
          <FlaskConical size={52} />
        </div>
        <h1>
          {a.name} <span>×</span> {b.name}
        </h1>
        <p>拆解表象，寻找机制之间的连接。</p>
        <div className="process-steps">
          {steps.map((label, i) => (
            <div className={i <= step ? 'active' : ''} key={label}>
              <span>{i < step ? <Check size={17} /> : String(i + 1).padStart(2, '0')}</span>
              <p>{label}</p>
            </div>
          ))}
        </div>
        {busy && (
          <div>
            <div className="button-row">
              <Loading
                label={
                  data.settings.enabled && !offlineRun
                    ? `等待模型完整响应，最长 ${requestTimeoutSeconds(data.settings)} 秒…`
                    : '正在构建连接…'
                }
              />
              <button
                className="button"
                onClick={() => {
                  collisionRequest.cancel();
                  setBusy(false);
                  setError('请求已取消，可重新尝试或改用离线生成。');
                }}
              >
                取消生成
              </button>
            </div>
            {data.settings.enabled && !offlineRun && (
              <p>
                已等待 {elapsed} 秒
                {elapsed >= 30
                  ? '，模型响应较慢。可以继续等待，或改用离线生成。'
                  : '，正在等待服务返回结果。'}
              </p>
            )}
            {data.settings.enabled && !offlineRun && elapsed >= 30 && (
              <button
                className="button"
                onClick={() => {
                  collisionRequest.cancel();
                  void collide(true);
                }}
              >
                停止等待，改用离线生成
              </button>
            )}
          </div>
        )}{' '}
        {error && (
          <ErrorBox
            error={error}
            onRetry={() => void collide()}
            onOffline={() => void collide(true)}
          />
        )}
        <Link className="text-link" to="/">
          返回工作台
        </Link>
      </div>
    );
  if (!saved) return null;
  const selectedConnection = saved.connections.find((c) => c.id === selected);
  const ideas = data.ideas.filter(
    (i) => i.collisionId === saved.id && i.connectionId === selected && i.version === 1,
  );
  return (
    <>
      <Link className="back-link" to="/">
        <ArrowLeft size={15} />
        返回工作台
      </Link>
      <PageTitle
        eyebrow={`EXPERIMENT / ${saved.id.slice(0, 8).toUpperCase()}`}
        title={`${a.name} × ${b.name}`}
        description={`${saved.connections.length} 个潜在连接 · ${saved.connections.some((c) => c.source && c.source !== saved.source) ? '混合引擎' : saved.source === 'local' ? '本地创意引擎' : 'AI 引擎'} · 连接是待验证的假设`}
        action={<FavoriteButton kind="collisions" id={saved.id} large />}
      />
      {saved.notice && (
        <p className="info-banner" role="status">
          {saved.notice}
        </p>
      )}
      <div className="concept-explanations">
        {[a, b].map((c) => (
          <article key={c.id}>
            <span className="eyebrow">概念解释</span>
            <h2>{c.name}</h2>
            <p>{c.description}</p>
            <button className="button" onClick={() => setDetail(c)}>
              了解「{c.name}」
            </button>
          </article>
        ))}
      </div>
      {detail && (
        <ConceptDetail
          concept={detail}
          onClose={() => setDetail(null)}
          onSelectRelated={setDetail}
        />
      )}
      <div className="collision-results-layout">
        <section className="collision-map-panel" aria-label="碰撞图谱与连接详情">
          <div className="connection-options">
            <span>
              图谱展示第 {graphPage * 8 + 1}–
              {Math.min((graphPage + 1) * 8, saved.connections.length)} 条 / 共{' '}
              {saved.connections.length} 条
            </span>
            <button
              className="button"
              disabled={graphPage === 0}
              onClick={() => setGraphPage((p) => p - 1)}
            >
              上一组图谱
            </button>
            <button
              className="button"
              disabled={(graphPage + 1) * 8 >= saved.connections.length}
              onClick={() => setGraphPage((p) => p + 1)}
            >
              下一组图谱
            </button>
          </div>
          <CollisionGraph
            key={`${saved.id}-${graphPage}-${saved.connections
              .slice(graphPage * 8, graphPage * 8 + 8)
              .map((c) => c.id)
              .join(',')}`}
            a={a}
            b={b}
            connections={saved.connections.slice(graphPage * 8, graphPage * 8 + 8)}
            onSelect={(connectionId) => void generate(connectionId)}
          />
          {selectedConnection && (
            <article className="connection-insight">
              <span className="eyebrow">当前连接 / {selectedConnection.dimension ?? '跨领域'}</span>
              <h2>{selectedConnection.title}</h2>
              <p>{selectedConnection.explanation}</p>
              <div className="insight-bases">
                <div>
                  <strong>
                    {a.name} · {selectedConnection.conceptAProperty}
                  </strong>
                  {selectedConnection.basisA && (
                    <p>
                      {selectedConnection.basisA.status}：{selectedConnection.basisA.reason}
                    </p>
                  )}
                </div>
                <div>
                  <strong>
                    {b.name} · {selectedConnection.conceptBProperty}
                  </strong>
                  {selectedConnection.basisB && (
                    <p>
                      {selectedConnection.basisB.status}：{selectedConnection.basisB.reason}
                    </p>
                  )}
                </div>
              </div>
              <button
                className="button primary"
                disabled={ideaBusy}
                onClick={() => void generate(selectedConnection.id)}
              >
                沿着这个连接，生成创意
                <ArrowRight size={15} />
              </button>
            </article>
          )}
        </section>
        <aside className="collision-connections-panel" aria-label="可探索的连接">
          <div className="section-heading">
            <div>
              <span className="eyebrow">POSSIBLE CONNECTIONS</span>
              <h2>选择一个连接</h2>
            </div>
            <span className="muted">选择一个连接，生成三个方向的发明</span>
          </div>
          <div className="connections-list">
            {saved.connections.map((c, i) => (
              <button
                key={c.id}
                disabled={ideaBusy}
                className={`connection-card ${selected === c.id ? 'active' : ''}`}
                onClick={() => void generate(c.id)}
              >
                <span className="connection-number">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <div className="tags">
                    <span className="tag">
                      {(c.source ?? saved.source) === 'api' ? 'AI' : '本地'}
                    </span>
                    {c.basisA && (
                      <span
                        className="tag basis-label"
                        title={c.basisA.reason}
                        aria-label={`${a.name}依据：${c.basisA.status}`}
                      >
                        {c.basisA.status}
                      </span>
                    )}
                    {c.basisB && (
                      <span
                        className="tag basis-label"
                        title={c.basisB.reason}
                        aria-label={`${b.name}依据：${c.basisB.status}`}
                      >
                        {c.basisB.status}
                      </span>
                    )}
                    <span className="property-tag a">{c.conceptAProperty}</span>
                    <span className="muted">×</span>
                    <span className="property-tag b">{c.conceptBProperty}</span>
                  </div>
                  <h3>
                    {c.dimension && <span className="tag">{c.dimension}</span>} {c.title}
                  </h3>
                  <p>{c.explanation}</p>
                </div>
                <div className="connection-score">
                  <b>{formatScore(c.novelty)}</b>
                  <small>NOVELTY</small>
                  <span>可行 {formatScore(c.plausibility)}</span>
                  <ArrowRight size={18} />
                </div>
              </button>
            ))}
          </div>
          <div className="connection-options">
            <label>
              追加数量{' '}
              <select
                aria-label="追加连接数量"
                value={batchCount}
                onChange={(e) => setBatchCount(Number(e.target.value))}
              >
                <option value={4}>4 条</option>
                <option value={8}>8 条</option>
                <option value={12}>12 条</option>
              </select>
            </label>
            <button
              className="button primary"
              disabled={moreBusy || saved.connections.length >= 500}
              onClick={() => void exploreMore()}
            >
              {moreBusy ? '正在探索新连接…' : '继续探索新连接'}
            </button>
            <small>
              {saved.connections.length >= 500
                ? '本次实验已达到 500 条，可新建实验继续。'
                : '保留已有结果，过滤重复方向；新一轮使用当前设置的引擎。'}
            </small>
          </div>
          {moreNotice && <p role="status">{moreNotice}</p>}
          {moreError && (
            <ErrorBox
              error={moreError}
              onRetry={() => void exploreMore()}
              onOffline={() => void exploreMore(true)}
            />
          )}
        </aside>
      </div>
      <div className="ideas-anchor" ref={ideasRef}>
        {!ideas.length && !ideaBusy && !ideaError && (
          <div className="result-next-step">
            <span>03</span>
            <div>
              <h2>下一步，把连接变成一个想法。</h2>
              <p>点击图谱或右侧连接，生成实用、探索、荒诞三个方向的创意，再继续演化。</p>
            </div>
          </div>
        )}
        {(selectedConnection || ideaBusy) && (
          <div className="section-heading">
            <div>
              <span className="eyebrow">FROM CONNECTION TO INVENTION</span>
              <h2>{selectedConnection?.title ?? '正在生成'}</h2>
            </div>
            <span className="tiny">3 DIRECTIONS / ONE CONNECTION</span>
          </div>
        )}
        {ideaBusy && (
          <div className="loading-panel">
            <Loading label="正在生成实用、探索与荒诞三种发明…" />
          </div>
        )}
        {ideaError && (
          <ErrorBox
            error={ideaError}
            onRetry={() => selected && void generate(selected)}
            onOffline={() => selected && void generate(selected, true)}
          />
        )}
        <div className="idea-grid">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
        {ideas.length > 0 && (
          <p className="score-disclaimer">
            评分仅是软件内部的创意指标，不代表科学验证、专利新颖性或商业可行性。
          </p>
        )}
      </div>
    </>
  );
}
