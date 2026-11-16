import { useEffect, useState, type ReactNode } from 'react';
import type { Book, BookStatus, ReadingFormat } from '../lib/types';
import { FORMAT_SHORT, STATUS_DOT, STATUS_LABEL } from '../lib/types';
import { bookColors, fmtRating } from '../lib/util';
import { Icon } from './Icon';

/* ---------------- Capa ---------------- */

export function Cover({ book, width = 60, className = '' }: { book: Pick<Book, 'title' | 'cover_url'>; width?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [book.cover_url]);
  const height = Math.round(width * 1.5);
  if (book.cover_url && !broken) {
    return (
      <div className={`cover ${className}`} style={{ width, height }}>
        <img src={book.cover_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      </div>
    );
  }
  const [bg, fg] = bookColors(book);
  return (
    <div className={`cover gen ${className}`} style={{ width, height, background: bg, color: fg, padding: `${Math.round(width * 0.1)}px ${Math.round(width * 0.1)}px ${Math.round(width * 0.09)}px ${Math.round(width * 0.13)}px` }} aria-hidden="true">
      <span className="band" style={{ background: fg }} />
      <span className="t" style={{ fontSize: Math.max(8, Math.round(width / 7.5)) }}>
        {book.title}
      </span>
    </div>
  );
}

/* ---------------- Estrelas ---------------- */

const STAR = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z';

function StarShape({ size, fill }: { size: number; fill: number }) {
  return (
    <span className="star" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <path d={STAR} fill="#EFE3C4" stroke="#C9A75E" strokeWidth="1.2" />
      </svg>
      <span className="fill" style={{ width: size * fill }}>
        <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path d={STAR} fill="#D9A441" stroke="#B8862B" strokeWidth="1.2" />
        </svg>
      </span>
    </span>
  );
}

export function Stars({ value, size = 15, showNumber = false }: { value: number; size?: number; showNumber?: boolean }) {
  return (
    <span className="stars" role="img" aria-label={`${fmtRating(value)} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarShape key={i} size={size} fill={value >= i ? 1 : value >= i - 0.5 ? 0.5 : 0} />
      ))}
      {showNumber && <span className="tiny" style={{ fontWeight: 800, color: 'var(--bark)', marginLeft: 4 }}>{fmtRating(value)}</span>}
    </span>
  );
}

/** Nota de 0 a 5 de meio em meio. Tocar de novo no mesmo valor limpa (sem nota). */
export function StarInput({ value, onChange, size = 38 }: { value: number | null; onChange: (v: number | null) => void; size?: number }) {
  const v = value ?? 0;
  const pick = (n: number) => onChange(value === n ? null : n);
  return (
    <div className="stack" style={{ gap: 6, alignItems: 'center' }}>
      <div className="stars star-input" role="group" aria-label="Nota">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="star" style={{ width: size + 4, height: size + 4 }}>
            <span style={{ position: 'absolute', left: 2, top: 2 }}>
              <StarShape size={size} fill={v >= i ? 1 : v >= i - 0.5 ? 0.5 : 0} />
            </span>
            <button type="button" style={{ left: 0 }} aria-label={`${fmtRating(i - 0.5)} estrelas`} onClick={() => pick(i - 0.5)} />
            <button type="button" style={{ right: 0 }} aria-label={`${i} ${i === 1 ? 'estrela' : 'estrelas'}`} onClick={() => pick(i)} />
          </span>
        ))}
      </div>
      <span className="tiny muted">{value == null ? 'Sem nota — toque na metade da estrela pra meia nota' : `${fmtRating(value)} de 5`}</span>
    </div>
  );
}

/* ---------------- Chips ---------------- */

export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  soft = false,
  scroll = false,
  label
}: {
  options: { value: T; label: string; dot?: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  soft?: boolean;
  scroll?: boolean;
  label?: string;
}) {
  return (
    <div className={`chips ${scroll ? 'scroll' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`chip ${soft ? 'soft' : ''} ${o.value === value ? 'on' : ''}`}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.dot && <span className="dot" style={{ background: o.dot }} />}
          {o.label}
          {o.count != null && <span className="count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export const STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as BookStatus[]).map((s) => ({
  value: s,
  label: STATUS_LABEL[s],
  dot: STATUS_DOT[s]
}));

export const FORMAT_OPTIONS = (['fisico', 'kindle', 'audiobook'] as ReadingFormat[]).map((f) => ({ value: f, label: FORMAT_SHORT[f] }));

export function FormatPill({ format }: { format: ReadingFormat | null }) {
  if (!format) return null;
  const cls = format === 'fisico' ? 'brown' : format === 'kindle' ? 'green' : format === 'audiobook' ? 'blue' : '';
  return <span className={`pill ${cls}`}>{FORMAT_SHORT[format]}</span>;
}

export function StatusPill({ status, legacy }: { status: BookStatus; legacy?: boolean }) {
  const cls = { lido: 'green', lendo: 'gold', abandonado: 'red', desejo: 'red', nao_lido: '' }[status];
  return (
    <span className={`pill ${cls}`}>
      <span className="dot" style={{ background: STATUS_DOT[status], width: 8, height: 8 }} />
      {STATUS_LABEL[status]}
      {legacy ? ' · sem registro' : ''}
    </span>
  );
}

/* ---------------- Modal ---------------- */

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row between" style={{ marginBottom: 16 }}>
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <svg width="54" height="64" viewBox="0 0 54 64" aria-hidden="true">
        <ellipse cx="18" cy="20" rx="13" ry="6" fill="#8FA876" transform="rotate(-50 18 20)" />
        <ellipse cx="36" cy="18" rx="13" ry="6" fill="#6E8B5E" transform="rotate(45 36 18)" />
        <ellipse cx="27" cy="14" rx="6" ry="14" fill="#A3B18A" />
        <path d="M12 34 h30 l-4 26 h-22 z" fill="#B88A5E" />
        <rect x="10" y="31" width="34" height="7" rx="3" fill="#7A5235" />
      </svg>
      <div>{children}</div>
      {action}
    </div>
  );
}
