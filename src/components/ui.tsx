import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { ArrowUpRight, LoaderCircle, Star, X } from 'lucide-react';
import { useStore } from '../hooks/store';
import type { AppData } from '../types';
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
export function FavoriteButton({
  kind,
  id,
  large = false,
}: {
  kind: keyof AppData['favorites'];
  id: string;
  large?: boolean;
}) {
  const { data, toggleFavorite } = useStore();
  const active = data.favorites[kind].includes(id);
  return (
    <button
      className={`${large ? 'button' : 'icon-button'} ${active ? 'is-favorite' : ''}`}
      aria-label={active ? '取消收藏' : '收藏'}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite(kind, id);
      }}
    >
      <Star size={16} fill={active ? 'currentColor' : 'none'} />
      {large && (active ? '已收藏' : '收藏')}
    </button>
  );
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-mark">✳</div>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export function Loading({ label = '正在生成…' }: { label?: string }) {
  return (
    <span className="loading">
      <LoaderCircle size={16} className="spin" />
      {label}
    </span>
  );
}
export function ErrorBox({
  error,
  onRetry,
  onOffline,
}: {
  error: string;
  onRetry?: () => void;
  onOffline?: () => void;
}) {
  return (
    <div role="alert" className="error-box">
      <strong>这次实验遇到了问题</strong>
      <p>{error}</p>
      <div className="button-row">
        {onRetry && (
          <button className="button" onClick={onRetry}>
            重新尝试
          </button>
        )}
        {onOffline && (
          <button className="button primary" onClick={onOffline}>
            改用离线生成
          </button>
        )}
      </div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const target = dialog.current?.querySelector<HTMLElement>('[data-autofocus]') ?? dialog.current;
    target?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <dialog
        open
        className="modal"
        aria-label={title}
        aria-modal="true"
        ref={dialog}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Tab') {
            const items = [
              ...e.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]',
              ),
            ].filter((element) => element.getClientRects().length > 0);
            const first = items[0],
              last = items[items.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first || document.activeElement === dialog.current)
            ) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="eyebrow">CONCEPT SPECIMEN / 概念样本</span>
          <button className="icon-button" onClick={onClose} aria-label="关闭详情">
            <X size={20} />
          </button>
        </div>
        {children}
      </dialog>
    </div>
  );
}
export function Score({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="score">
      <div>
        <span>{label}</span>
        <b>
          {value === null ? '未评分' : value}
          {value !== null && <small>/100</small>}
        </b>
      </div>
      <div className="score-track">
        <i style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}
export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={14} />
    </button>
  );
}
