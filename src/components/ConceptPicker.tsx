import { useState } from 'react';
import { Search, Shuffle, Library, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../hooks/store';
import { ConceptEditor } from './ConceptEditor';
import { ConceptDetail } from './ConceptDetail';
import type { Concept } from '../types';
import { findConceptByName, matchesConcept } from '../utils/catalog';
import { pick } from '../utils/id';
import { ConceptGlyph } from './ConceptGlyph';
export function ConceptPicker({
  id,
  side,
  onChange,
  compact = false,
}: {
  id: string;
  side: 'A' | 'B';
  onChange: (id: string) => void;
  compact?: boolean;
}) {
  const { concepts, conceptMap } = useStore();
  const [editing, setEditing] = useState(false);
  const [detail, setDetail] = useState<Concept | null>(null);
  const [query, setQuery] = useState('');
  const [opened, setOpened] = useState(false);
  const c = conceptMap[id];
  function choose() {
    if (!query.trim()) {
      setEditing(true);
      return;
    }
    const found = findConceptByName(concepts, query);
    if (found) {
      onChange(found.id);
      setQuery('');
      setOpened(false);
    } else setEditing(true);
  }
  const results = concepts.filter((x) => matchesConcept(x, query)).slice(0, 8);
  return (
    <section
      className={`concept-card concept-${side.toLowerCase()} ${compact ? 'compact-picker' : ''}`}
    >
      <div className="concept-topline">
        <span className="eyebrow">CONCEPT {side}</span>
        <span className="tiny">
          INPUT {side === 'A' ? '01' : '02'} <i className="status-dot" />
        </span>
      </div>
      {!compact && (
        <button
          className="glyph-button"
          onClick={() => onChange(pick(concepts.filter((x) => x.id !== id)).id)}
          aria-label={`重新抽取 Concept ${side}`}
        >
          <ConceptGlyph
            name={c.category === '生物' ? c.category : c.name}
            variant={side === 'A' ? 'a' : 'b'}
          />
        </button>
      )}
      <div className="concept-name">
        <button onClick={() => setOpened(!opened)} aria-expanded={opened}>
          <h2>{c.name}</h2>
          <ChevronDown size={18} />
        </button>
        <span className="tag">{c.category}</span>
      </div>
      <p className="concept-description">{c.description}</p>
      <button className="text-link" onClick={() => setDetail(c)}>
        了解这个概念 →
      </button>
      <div className="tags">
        {c.properties.slice(0, 3).map((p) => (
          <span key={p} className="property-tag">
            {p}
          </span>
        ))}
      </div>
      <div className="concept-free-entry">
        <input
          aria-label={`输入任意概念 ${side}`}
          maxLength={80}
          placeholder="输入任意概念，按 Enter 添加"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              choose();
            }
          }}
        />
        <button className="button" onClick={choose}>
          创建 / 选择
        </button>
      </div>
      <div className="concept-controls">
        <button onClick={() => setOpened(!opened)}>
          <Search size={15} />
          搜索概念
        </button>
        <Link to={`/concepts?target=${side}`}>
          <Library size={15} />
          概念库
        </Link>
        <button
          aria-label={`随机 Concept ${side}`}
          onClick={() => onChange(pick(concepts.filter((x) => x.id !== id)).id)}
        >
          <Shuffle size={15} />
        </button>
      </div>
      {opened && (
        <div className="picker-search">
          <div className="search-field">
            <Search size={16} />
            <input
              aria-label={`搜索 Concept ${side}`}
              placeholder="名称、领域或标签…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <button onClick={() => setOpened(false)} aria-label="关闭搜索">
              ×
            </button>
          </div>
          <div className="picker-results">
            <button onClick={choose}>创建「{query.trim() || '新概念'}」</button>
            {results.map((x) => (
              <button
                key={x.id}
                onClick={() => {
                  onChange(x.id);
                  setOpened(false);
                  setQuery('');
                }}
              >
                <span>{x.name}</span>
                <small>{x.category}</small>
              </button>
            ))}
            {results.length === 0 && <p>没有找到已有概念，你可以直接创建。</p>}
          </div>
        </div>
      )}
      {editing && (
        <ConceptEditor
          initialName={query}
          target={side}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setOpened(false);
            setQuery('');
          }}
        />
      )}
      {detail && (
        <ConceptDetail
          concept={detail}
          onClose={() => setDetail(null)}
          onSelectRelated={setDetail}
        />
      )}
    </section>
  );
}
