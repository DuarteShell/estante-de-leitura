import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Book } from '../lib/types';
import { fmtDuration, progressPatch } from '../lib/progress';

/** campo de duração em horas + minutos (valor em minutos) */
export function DurationInput({ value, onChange, label }: { value: number | null; onChange: (min: number | null) => void; label: string }) {
  const [h, setH] = useState(value != null ? String(Math.floor(value / 60)) : '');
  const [m, setM] = useState(value != null ? String(value % 60) : '');
  const last = useRef(value);

  // valor mudou por fora (barra, botões): atualiza os campos
  useEffect(() => {
    if (value === last.current) return;
    last.current = value;
    setH(value != null ? String(Math.floor(value / 60)) : '');
    setM(value != null ? String(value % 60) : '');
  }, [value]);

  const emit = (hs: string, ms: string) => {
    const total = hs === '' && ms === '' ? null : (Number(hs) || 0) * 60 + (Number(ms) || 0);
    last.current = total;
    onChange(total);
  };

  return (
    <div className="row" role="group" aria-label={label} style={{ gap: 6 }}>
      <label className="row grow" style={{ gap: 6 }}>
        <input
          className="input"
          type="number"
          inputMode="numeric"
          min={0}
          value={h}
          onChange={(e) => {
            setH(e.target.value);
            emit(e.target.value, m);
          }}
          style={{ textAlign: 'center', minWidth: 0 }}
          aria-label={`${label}: horas`}
        />
        <span className="small" aria-hidden="true" style={{ fontWeight: 700 }}>h</span>
      </label>
      <label className="row grow" style={{ gap: 6 }}>
        <input
          className="input"
          type="number"
          inputMode="numeric"
          min={0}
          max={59}
          value={m}
          onChange={(e) => {
            setM(e.target.value);
            emit(h, e.target.value);
          }}
          style={{ textAlign: 'center', minWidth: 0 }}
          aria-label={`${label}: minutos`}
        />
        <span className="small" aria-hidden="true" style={{ fontWeight: 700 }}>min</span>
      </label>
    </div>
  );
}

/** barra de arrastar, com o trecho já lido preenchido */
function Range({ value, max, step = 1, onChange, onCommit, label, valueText }: { value: number; max: number; step?: number; onChange: (v: number) => void; onCommit: () => void; label: string; valueText: string }) {
  return (
    <input
      className="range"
      type="range"
      min={0}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={onCommit}
      onKeyUp={onCommit}
      onBlur={onCommit}
      aria-label={label}
      aria-valuetext={valueText}
      style={{ '--fill': `${max ? (value / max) * 100 : 0}%` } as CSSProperties}
    />
  );
}

/**
 * Progresso de leitura no Kindle (porcentagem) ou audiobook (tempo ouvido).
 * Enquanto arrasta, só a tela muda; salva ao soltar (ou logo depois de parar de mexer).
 */
export function ProgressTracker({
  book,
  mode,
  canEdit,
  onSave,
  onComplete
}: {
  book: Book;
  mode: 'percent' | 'time';
  canEdit: boolean;
  onSave: (patch: Partial<Book>) => Promise<void>;
  onComplete: () => void;
}) {
  const total = mode === 'percent' ? 100 : book.audio_minutes ?? 0;
  const stored =
    mode === 'percent'
      ? Math.round(book.progress_pct ?? (book.pages && book.current_page ? (book.current_page / book.pages) * 100 : 0))
      : Math.min(book.audio_position ?? 0, total);

  const [val, setVal] = useState(stored);
  const saved = useRef(stored);
  const timer = useRef<number>();
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalDraft, setTotalDraft] = useState<number | null>(book.audio_minutes ?? null);

  useEffect(() => {
    saved.current = stored;
    setVal(stored);
  }, [stored]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const commit = async (v: number) => {
    window.clearTimeout(timer.current);
    const next = Math.max(0, Math.min(total, Math.round(v)));
    if (next === saved.current) return;
    const before = saved.current;
    saved.current = next;
    await onSave(progressPatch(book, mode, next));
    if (next >= total && before < total) onComplete();
  };

  const change = (v: number) => {
    setVal(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => commit(v), 700);
  };

  const step = (d: number) => {
    const v = Math.max(0, Math.min(total, val + d));
    setVal(v);
    commit(v);
  };

  const [pagesDraft, setPagesDraft] = useState('');
  const savePages = async () => {
    const n = Math.round(Number(pagesDraft));
    if (!n || n < 1) return;
    await onSave({ pages: n, current_page: Math.round((val / 100) * n) });
    setPagesDraft('');
  };

  const saveTotal = async () => {
    if (!totalDraft || totalDraft <= 0) return;
    const pos = Math.min(book.audio_position ?? 0, totalDraft);
    await onSave({
      audio_minutes: totalDraft,
      audio_position: pos,
      ...(book.pages ? { current_page: Math.round((pos / totalDraft) * book.pages) } : {})
    });
    setEditingTotal(false);
  };

  // audiobook sem duração: primeiro pergunta quanto tempo tem
  if (mode === 'time' && (!book.audio_minutes || editingTotal)) {
    if (!canEdit) return <p className="small muted" style={{ margin: 0 }}>Duração do audiobook não cadastrada.</p>;
    return (
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          saveTotal();
        }}
      >
        <span className="small" style={{ fontWeight: 700 }}>Qual a duração total do audiobook?</span>
        <DurationInput value={totalDraft} onChange={setTotalDraft} label="Duração total" />
        <div className="row">
          {editingTotal && (
            <button type="button" className="btn grow" onClick={() => setEditingTotal(false)}>
              Cancelar
            </button>
          )}
          <button className="btn btn-primary grow" disabled={!totalDraft}>
            Salvar duração
          </button>
        </div>
      </form>
    );
  }

  const pct = total ? Math.round((val / total) * 100) : 0;

  return (
    <div className="stack">
      <div className="row between" style={{ alignItems: 'baseline' }}>
        <div className="serif" style={{ fontSize: 22, fontWeight: 600 }}>
          {mode === 'percent' ? (
            <>
              {val}% <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink-2)' }}>do livro</span>
            </>
          ) : (
            <>
              {fmtDuration(val)} <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink-2)' }}>de {fmtDuration(total)}</span>
            </>
          )}
        </div>
        {mode === 'time' && <span className="small" style={{ fontWeight: 800, color: 'var(--moss)' }}>{pct}%</span>}
      </div>

      {canEdit ? (
        <Range
          value={val}
          max={total}
          onChange={change}
          onCommit={() => commit(val)}
          label={mode === 'percent' ? 'Porcentagem lida' : 'Tempo ouvido'}
          valueText={mode === 'percent' ? `${val}%` : `${fmtDuration(val)} de ${fmtDuration(total)}`}
        />
      ) : (
        <div className="progress" style={{ height: 12 }}>
          <div style={{ width: `${pct}%` }} />
        </div>
      )}

      {mode === 'percent' &&
        (book.pages ? (
          <span className="small" style={{ fontWeight: 700, color: 'var(--bark)' }}>
            Página {Math.round((val / 100) * book.pages)} de {book.pages} no livro físico
          </span>
        ) : canEdit ? (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              savePages();
            }}
          >
            <label className="grow field" style={{ gap: 4 }}>
              <span className="small">Quantas páginas tem o livro físico? (para mostrar a página)</span>
              <input className="input" type="number" inputMode="numeric" min={1} placeholder="Ex.: 320" value={pagesDraft} onChange={(e) => setPagesDraft(e.target.value)} />
            </label>
            <button className="btn" style={{ alignSelf: 'flex-end' }} disabled={!Number(pagesDraft)}>
              Salvar
            </button>
          </form>
        ) : null)}

      {canEdit &&
        (mode === 'percent' ? (
          <div className="row">
            <button type="button" className="btn" onClick={() => step(-1)} aria-label="Menos 1%">
              −1%
            </button>
            <label className="grow row" style={{ gap: 6 }}>
              <span className="sr-only">Porcentagem atual</span>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={val}
                onChange={(e) => change(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                onBlur={() => commit(val)}
                style={{ textAlign: 'center', minWidth: 0 }}
              />
              <span className="small" aria-hidden="true" style={{ fontWeight: 700 }}>%</span>
            </label>
            <button type="button" className="btn btn-primary" onClick={() => step(1)} aria-label="Mais 1%">
              +1%
            </button>
          </div>
        ) : (
          <>
            <div className="row">
              <button type="button" className="btn grow" onClick={() => step(-5)} aria-label="Voltar 5 minutos">
                −5min
              </button>
              <button type="button" className="btn btn-primary grow" onClick={() => step(5)} aria-label="Avançar 5 minutos">
                +5min
              </button>
            </div>
            <div className="field">
              <span>Ou digite onde parou</span>
              <DurationInput value={val} onChange={(v) => change(Math.min(total, v ?? 0))} label="Tempo ouvido" />
            </div>
            <button
              type="button"
              className="small"
              style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, color: 'var(--bark)', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}
              onClick={() => {
                setTotalDraft(book.audio_minutes ?? null);
                setEditingTotal(true);
              }}
            >
              Alterar duração total
            </button>
          </>
        ))}
    </div>
  );
}
