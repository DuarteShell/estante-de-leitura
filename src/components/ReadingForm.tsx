import { useState } from 'react';
import type { Reading, ReadingFormat, ReadingStatus } from '../lib/types';
import { todayIso } from '../lib/util';
import { ChipGroup, FORMAT_OPTIONS, HeartInput, Modal, StarInput } from './ui';

export interface ReadingDraft {
  status: ReadingStatus;
  started_at: string;
  finished_at: string;
  year: string;
  yearOnly: boolean;
  rating: number | null;
  favorite: boolean;
  format: ReadingFormat | '';
  pages_read: string;
  review: string;
}

export const draftFrom = (r?: Partial<Reading>): ReadingDraft => ({
  status: r?.status ?? 'lido',
  started_at: r?.started_at ?? '',
  // leitura existente: mantém o que tem; leitura nova: sugere hoje como término
  finished_at: r?.finished_at ?? (r?.id || r?.status === 'lendo' ? '' : todayIso()),
  year: r?.year ? String(r.year) : String(new Date().getFullYear()),
  yearOnly: !!r?.year && !r.started_at && !r.finished_at,
  rating: r?.rating ?? null,
  favorite: !!r?.favorite,
  format: r?.format ?? '',
  pages_read: r?.pages_read ? String(r.pages_read) : '',
  review: r?.review ?? ''
});

export const draftToReading = (d: ReadingDraft): Partial<Reading> => ({
  status: d.status,
  started_at: d.yearOnly ? null : d.started_at || null,
  finished_at: d.yearOnly || d.status === 'lendo' ? null : d.finished_at || null,
  year: d.yearOnly && d.year ? Number(d.year) : null,
  rating: d.status === 'lendo' ? null : d.rating,
  favorite: d.status !== 'lendo' && d.favorite,
  format: d.format || null,
  pages_read: d.pages_read ? Number(d.pages_read) : null,
  review: d.review.trim() || null
});

export function ReadingFields({
  value: d,
  onChange,
  allowStatus = true,
  statuses = ['lido', 'abandonado', 'lendo']
}: {
  value: ReadingDraft;
  onChange: (d: ReadingDraft) => void;
  allowStatus?: boolean;
  statuses?: ReadingStatus[];
}) {
  const set = (patch: Partial<ReadingDraft>) => onChange({ ...d, ...patch });
  const labels: Record<ReadingStatus, string> = { lido: 'Terminei', abandonado: 'Abandonei', lendo: 'Ainda lendo' };
  return (
    <div className="stack lg">
      {allowStatus && (
        <ChipGroup
          soft
          label="Situação da leitura"
          value={d.status}
          onChange={(status) => set({ status })}
          options={statuses.map((s) => ({ value: s, label: labels[s] }))}
        />
      )}

      <div className="stack">
        <label className="row small" style={{ gap: 8, fontWeight: 700 }}>
          <input type="checkbox" checked={d.yearOnly} onChange={(e) => set({ yearOnly: e.target.checked })} />
          Não lembro as datas — só o ano
        </label>
        {d.yearOnly ? (
          <label className="field">
            <span>Ano</span>
            <input className="input" type="number" inputMode="numeric" min={1900} max={2100} value={d.year} onChange={(e) => set({ year: e.target.value })} />
          </label>
        ) : (
          <div className="grid grid-2">
            <label className="field">
              <span>Início</span>
              <input className="input" type="date" value={d.started_at} onChange={(e) => set({ started_at: e.target.value })} />
            </label>
            {d.status !== 'lendo' && (
              <label className="field">
                <span>{d.status === 'abandonado' ? 'Parei em' : 'Término'}</span>
                <input className="input" type="date" value={d.finished_at} onChange={(e) => set({ finished_at: e.target.value })} />
              </label>
            )}
          </div>
        )}
      </div>

      {d.status !== 'lendo' && (
        <div className="field">
          <span>Nota</span>
          <div className="rating-row">
            <StarInput value={d.rating} onChange={(rating) => set({ rating })} />
            <div className="stack" style={{ gap: 6, alignItems: 'center' }}>
              <HeartInput value={d.favorite} onChange={(favorite) => set({ favorite })} />
              <span className="tiny muted">{d.favorite ? 'Favorito' : 'Favoritar'}</span>
            </div>
          </div>
        </div>
      )}

      <div className="field">
        <span>Formato</span>
        <ChipGroup
          soft
          label="Formato"
          value={d.format as ReadingFormat}
          onChange={(format) => set({ format: d.format === format ? '' : format })}
          options={FORMAT_OPTIONS}
        />
      </div>

      {d.status === 'abandonado' && (
        <label className="field">
          <span>Até que página leu?</span>
          <input className="input" type="number" inputMode="numeric" min={0} value={d.pages_read} onChange={(e) => set({ pages_read: e.target.value })} />
        </label>
      )}

      <label className="field">
        <span>Resenha / impressões (opcional)</span>
        <textarea className="textarea" value={d.review} onChange={(e) => set({ review: e.target.value })} placeholder="O que achou?" />
      </label>
    </div>
  );
}

export function ReadingModal({
  title,
  initial,
  statuses,
  allowStatus = true,
  saveLabel = 'Salvar',
  onSave,
  onDelete,
  onClose
}: {
  title: string;
  initial?: Partial<Reading>;
  statuses?: ReadingStatus[];
  allowStatus?: boolean;
  saveLabel?: string;
  onSave: (r: Partial<Reading>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [d, setD] = useState(() => draftFrom(initial));
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="stack lg"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onSave(draftToReading(d));
            onClose();
          } catch {
            setBusy(false);
          }
        }}
      >
        <ReadingFields value={d} onChange={setD} statuses={statuses} allowStatus={allowStatus} />
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Salvando…' : saveLabel}
        </button>
        {onDelete && (
          <button
            type="button"
            className="btn btn-danger btn-ghost btn-block"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onDelete();
                onClose();
              } catch {
                setBusy(false);
              }
            }}
          >
            Apagar esta leitura
          </button>
        )}
      </form>
    </Modal>
  );
}
