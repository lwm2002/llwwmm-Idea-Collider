import { lazy, Suspense, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation, Link } from 'react-router-dom';
import {
  Orbit,
  ArrowUpRight,
  Settings2,
  FlaskConical,
  Library,
  Sparkles,
  Star,
  History,
  Plus,
  ArrowRight,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useStore } from './hooks/store';
import { Empty, Loading } from './components/ui';
import Collider from './pages/Collider';
const Concepts = lazy(() => import('./pages/Concepts'));
const Collision = lazy(() => import('./pages/Collision'));
const Evolution = lazy(() => import('./pages/Evolution'));
const Inspiration = lazy(() => import('./pages/Inspiration'));
const Archive = lazy(() => import('./pages/Archive'));
const Settings = lazy(() => import('./pages/Settings'));
const links = [
  { path: '/', label: 'Collider', name: '实验台', icon: FlaskConical },
  { path: '/concepts', label: 'Concepts', name: '概念库', icon: Library },
  { path: '/inspiration', label: 'Inspiration', name: '灵感探索', icon: Sparkles },
  { path: '/favorites', label: 'Favorites', name: '我的收藏', icon: Star },
  { path: '/history', label: 'History', name: '实验记录', icon: History },
];
export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { data, concepts } = useStore();
  const location = useLocation();
  const collisionPage = location.pathname.startsWith('/collision/');
  const evolutionPage = location.pathname.startsWith('/evolution/');
  const workflow = location.pathname === '/' || collisionPage || evolutionPage;
  const stage = evolutionPage ? 3 : collisionPage ? 2 : 1;
  const routeId = location.pathname.split('/')[2];
  const currentIdea = evolutionPage ? data.ideas.find((idea) => idea.id === routeId) : undefined;
  const lastCollision = collisionPage
    ? data.collisions.find((collision) => collision.id === routeId)
    : evolutionPage
      ? data.collisions.find((collision) => collision.id === currentIdea?.collisionId)
      : data.collisions[0];
  const lastIdea =
    currentIdea ??
    (lastCollision ? data.ideas.find((idea) => idea.collisionId === lastCollision.id) : undefined);
  const favorites = Object.values(data.favorites).reduce(
    (total, entries) => total + entries.length,
    0,
  );
  const currentName = collisionPage
    ? '碰撞结果'
    : evolutionPage
      ? '创意演化'
      : location.pathname === '/settings'
        ? '工作室设置'
        : (links.find((item) => item.path === location.pathname)?.name ?? '工作室');
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <div
      className={`app-shell studio-shell notebook-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
    >
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <aside className="studio-sidebar">
        <Link className="brand" to="/">
          <span className="brand-icon">
            <Orbit size={28} />
          </span>
          <span>
            <strong>
              COLLIDER<span className="brand-period">.</span>
            </strong>
            <small>概念白板工作室</small>
          </span>
        </Link>
        <div className="sidebar-label">
          你的创意空间 <span>01</span>
        </div>
        <nav aria-label="主导航" className="studio-navigation">
          {links.map(({ path, label, name, icon: Icon }, i) => (
            <NavLink
              key={path}
              end={path === '/'}
              to={path}
              aria-label={label}
              className={i === 3 ? 'nav-group-start' : ''}
            >
              <Icon size={18} />
              <span>{name}</span>
              <small>
                {path === '/concepts'
                  ? concepts.length
                  : path === '/favorites'
                    ? favorites
                    : path === '/history'
                      ? data.collisions.length
                      : i === 0
                        ? '↗'
                        : ''}
              </small>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={sidebarCollapsed ? '展开导航' : '收起导航'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            <span>收起导航</span>
          </button>
          <NavLink className="settings-nav" to="/settings" aria-label="Settings">
            <Settings2 size={18} />
            <span>工作室设置</span>
          </NavLink>
          <div className="sidebar-engine">
            <i className="status-dot" />
            <span>{data.settings.enabled ? 'AI 引擎已开启' : '本地引擎 · 即刻探索'}</span>
          </div>
        </div>
      </aside>
      <div className="studio-body">
        <header className="studio-topbar">
          <div className="studio-breadcrumb">
            <span>工作室</span>
            <span>/</span>
            <strong>{currentName}</strong>
          </div>
          <div className="studio-top-actions">
            <span className="studio-save-state">
              <i />
              自动保存于本机
            </span>
            <Link to="/" className="button new-experiment">
              <Plus size={15} />
              新实验
            </Link>
          </div>
        </header>
        {workflow && (
          <nav className="studio-steps" aria-label="实验进程">
            {[
              { name: '选择概念', path: '/' },
              { name: '寻找连接', path: lastCollision ? `/collision/${lastCollision.id}` : null },
              { name: '演化创意', path: lastIdea ? `/evolution/${lastIdea.id}` : null },
            ].map((item, index) => (
              <div
                key={item.name}
                className={`studio-step ${stage === index + 1 ? 'current' : ''} ${stage > index + 1 ? 'done' : ''}`}
                aria-current={stage === index + 1 ? 'step' : undefined}
              >
                <span className="step-number">
                  {stage > index + 1 ? <Check size={14} /> : `0${index + 1}`}
                </span>
                {item.path ? (
                  <Link to={item.path}>{item.name}</Link>
                ) : (
                  <span aria-disabled="true">{item.name}</span>
                )}
                {index < 2 && <ArrowRight size={15} className="step-arrow" />}
              </div>
            ))}
          </nav>
        )}
        <main id="main-content" key={location.pathname} className="main-content">
          <Suspense
            fallback={
              <div className="loading-panel">
                <Loading label="正在打开工作室…" />
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Collider />} />
              <Route path="/concepts" element={<Concepts />} />
              <Route path="/collision/:id" element={<Collision key={location.pathname} />} />
              <Route path="/evolution/:id" element={<Evolution />} />
              <Route path="/inspiration" element={<Inspiration />} />
              <Route path="/favorites" element={<Archive favorites />} />
              <Route path="/history" element={<Archive />} />
              <Route path="/settings" element={<Settings />} />
              <Route
                path="*"
                element={
                  <Empty title="这里还没有实验室">
                    <Link to="/">
                      回到实验台 <ArrowUpRight size={14} />
                    </Link>
                  </Empty>
                }
              />
            </Routes>
          </Suspense>
        </main>
        <footer className="studio-footer">
          <span>为好奇心，留一点空间。</span>
          <span>IDEA COLLIDER / LOCAL STUDIO</span>
        </footer>
      </div>
    </div>
  );
}
