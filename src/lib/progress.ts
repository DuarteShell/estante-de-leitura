import type { Book, ReadingFormat } from './types';

/** 135 → "2h 15min"; 45 → "45min"; 120 → "2h" */
export function fmtDuration(min: number) {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}min`;
  return r ? `${h}h ${String(r).padStart(2, '0')}min` : `${h}h`;
}

export type ProgressMode = 'pages' | 'percent' | 'time';

export const progressMode = (format: ReadingFormat | null | undefined): ProgressMode =>
  format === 'kindle' ? 'percent' : format === 'audiobook' ? 'time' : 'pages';

const pctOf = (part: number, total: number) => Math.min(100, Math.max(0, Math.round((part / total) * 100)));

/** porcentagem lida (null = não dá pra calcular) e o texto curto do progresso */
export function readingProgress(book: Book, format: ReadingFormat | null | undefined): { pct: number | null; label: string } {
  const mode = progressMode(format);
  if (mode === 'percent') {
    const pct =
      book.progress_pct != null ? Math.round(book.progress_pct) : book.pages && book.current_page ? pctOf(book.current_page, book.pages) : 0;
    // com o total de páginas, mostra igual ao físico (página equivalente à porcentagem)
    if (book.pages) return { pct, label: `p. ${Math.round((pct / 100) * book.pages)} de ${book.pages} · ${pct}%` };
    return { pct, label: `${pct}% lido` };
  }
  if (mode === 'time') {
    if (!book.audio_minutes) return { pct: null, label: 'Sem duração cadastrada' };
    const pos = Math.min(book.audio_position ?? 0, book.audio_minutes);
    const pct = pctOf(pos, book.audio_minutes);
    return { pct, label: `${fmtDuration(pos)} de ${fmtDuration(book.audio_minutes)} · ${pct}%` };
  }
  if (!book.pages) return { pct: null, label: 'Sem total de páginas' };
  const pct = book.current_page ? pctOf(book.current_page, book.pages) : 0;
  return { pct, label: `p. ${book.current_page ?? 0} de ${book.pages} · ${pct}%` };
}

/**
 * Patch para salvar o progresso em % (Kindle) ou minutos (audiobook).
 * Se o livro tem total de páginas, a página atual acompanha — assim "parou na p. X" continua funcionando.
 */
export function progressPatch(book: Book, mode: 'percent' | 'time', value: number): Partial<Book> {
  if (mode === 'percent') {
    const pct = Math.min(100, Math.max(0, Math.round(value)));
    return { progress_pct: pct, ...(book.pages ? { current_page: Math.round((pct / 100) * book.pages) } : {}) };
  }
  const total = book.audio_minutes ?? 0;
  const pos = Math.max(0, Math.round(total ? Math.min(value, total) : value));
  return { audio_position: pos, ...(book.pages && total ? { current_page: Math.round((pos / total) * book.pages) } : {}) };
}

/** zera o progresso de Kindle/audiobook (só manda campos que existem, para não quebrar bancos sem a migração) */
export function resetProgressPatch(book: Book): Partial<Book> {
  const patch: Partial<Book> = {};
  if (book.progress_pct != null) patch.progress_pct = null;
  if (book.audio_position != null) patch.audio_position = null;
  return patch;
}
