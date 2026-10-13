import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Shuffle, ArrowUpRight } from 'lucide-react';
import { ConceptEditor } from '../components/ConceptEditor';
import type { Concept } from '../types';
import { PageTitle, FavoriteButton, Empty } from '../components/ui';
import { ConceptDetail } from '../components/ConceptDetail';
import { useStore } from '../hooks/store';
import { pick } from '../utils/id';
import { matchesConcept } from '../utils/catalog';
export default function Concepts() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  const [detail, setDetail] = useState<Concept | null>(null);
  const [favorite, setFavorite] = useState(false);
  const { data, update, concepts } = useStore();
  const categories = [...new Set(concepts.map((c) => c.category))];
  const [editing, setEditing] = useState(false);
  const [params] = useSearchParams();
  const target = params.get('target');
  const navigate = useNavigate();
  const list = useMemo(
    () =>
      concepts.filter(
        (c) =>
          (category === '全部' || c.category === category) &&
          (!favorite || data.favorites.concepts.includes(c.id)) &&
          matchesConcept(c, query),
      ),
    [query, category, favorite, data.favorites.concepts, concepts],
  );
  return (
    <>
      <PageTitle
        eyebrow="YOUR BUILDING BLOCKS"
        title="概念素材库"
        description={`${concepts.length} 个概念，随时加入你的实验。也可以创建属于你自己的素材。`}
        action={
          <button className="button" onClick={() => setDetail(pick(list.length ? list : concepts))}>
            <Shuffle size={16} />
            随机抽取
          </button>
        }
      />
      {target && (
        <div className="info-banner">
          正在选择 Concept {target}。可直接点击卡片上的“设为 {target}”。
        </div>
      )}
      <div className="library-toolbar">
        <button className="button primary" onClick={() => setEditing(true)}>
          创建概念
        </button>
        <label className="search-field">
          <Search size={18} />
          <input
            placeholder="搜索名称、属性或标签…"
            aria-label="搜索概念库"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          className={`button ${favorite ? 'selected' : ''}`}
          aria-pressed={favorite}
          onClick={() => setFavorite(!favorite)}
        >
          只看收藏
        </button>
        <span className="tiny">{list.length} SPECIMENS</span>
      </div>
      <div className="catalog-layout">
        <aside className="catalog-taxonomy">
          <h2>浏览领域</h2>
          <p>{categories.length} 个不同的视角</p>
          <div className="category-filter">
            {['全部', ...categories].map((c) => (
              <button
                className={`chip ${c === category ? 'active' : ''}`}
                key={c}
                onClick={() => setCategory(c)}
                aria-label={c}
                aria-pressed={c === category}
              >
                <span>{c}</span>
                <small aria-hidden="true">
                  {c === '全部'
                    ? concepts.length
                    : concepts.filter((item) => item.category === c).length}
                </small>
              </button>
            ))}
          </div>
        </aside>
        <div className="catalog-results">
          <div className="catalog-results-heading">
            <h2>{category === '全部' ? '全部素材' : category}</h2>
            <span>
              {list.length} 个概念
              {data.customConcepts.length > 0 && ` · ${data.customConcepts.length} 个自定义`}
            </span>
          </div>
          <div className="library-grid">
            {list.map((c, i) => (
              <article className="library-card" key={c.id}>
                <div className="library-card-top">
                  <span className="tiny">
                    {c.category} / {String(i + 1).padStart(3, '0')}
                  </span>
                  <FavoriteButton kind="concepts" id={c.id} />
                </div>
                <button className="card-main" onClick={() => setDetail(c)}>
                  <h2>
                    {c.name}
                    <ArrowUpRight size={17} />
                  </h2>
                  <p>{c.description}</p>
                  <div className="tags">
                    {c.properties.slice(0, 3).map((p) => (
                      <span className="property-tag" key={p}>
                        {p}
                      </span>
                    ))}
                  </div>
                </button>
                {target && (
                  <button
                    className="assign-button"
                    onClick={() => {
                      update((s) => ({
                        ...s,
                        pair: target === 'A' ? [c.id, s.pair[1]] : [s.pair[0], c.id],
                      }));
                      navigate('/');
                    }}
                  >
                    设为 {target} →
                  </button>
                )}
              </article>
            ))}
          </div>
          {!list.length && <Empty title="没有匹配的概念">试试换一个关键词，或取消筛选。</Empty>}
        </div>
      </div>
      {editing && (
        <ConceptEditor
          initialName={query}
          target={target === 'A' || target === 'B' ? target : undefined}
          onClose={() => setEditing(false)}
          onSaved={(c) => {
            setEditing(false);
            if (target) navigate('/');
            else {
              setQuery('');
              setCategory('全部');
              setDetail(c);
            }
          }}
        />
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
