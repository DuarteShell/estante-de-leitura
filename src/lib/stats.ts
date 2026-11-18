import type { Book, Reading, ReadingFormat } from './types';
import { readingYear, seriesKey, seriesTotal } from './util';

export interface YearStats {
  year: number;
  finished: Reading[];
  books: number;
  pages: number;
  /** livros ouvidos em audiobook (não entram na soma de páginas) */
  audiobooks: number;
  avgRating: number | null;
  months: number[];
  genres: { name: string; n: number }[];
  formats: Record<ReadingFormat | 'nd', number>;
  abandoned: number;
  topAuthors: { name: string; n: number }[];
  best: { book: Book; rating: number } | null;
  longest: Book | null;
}

export function yearStats(year: number, books: Book[], readings: Reading[]): YearStats {
  const byId = new Map(books.map((b) => [b.id, b]));
  const inYear = readings.filter((r) => readingYear(r) === year);
  const finished = inYear.filter((r) => r.status === 'lido');
  const months = Array(12).fill(0);
  const genres = new Map<string, number>();
  const authors = new Map<string, number>();
  const formats = { fisico: 0, kindle: 0, audiobook: 0, outro: 0, nd: 0 };
  let pages = 0;
  let ratingSum = 0;
  let rated = 0;
  let best: YearStats['best'] = null;
  let longest: Book | null = null;

  for (const r of finished) {
    const b = byId.get(r.book_id);
    // audiobook não conta páginas
    if (r.format !== 'audiobook') pages += r.pages_read ?? b?.pages ?? 0;
    if (r.finished_at) months[Number(r.finished_at.slice(5, 7)) - 1] += 1;
    if (r.rating != null) {
      ratingSum += r.rating;
      rated += 1;
      if (b && (!best || r.rating > best.rating)) best = { book: b, rating: r.rating };
    }
    formats[r.format ?? 'nd'] += 1;
    if (b) {
      b.genres.forEach((g) => genres.set(g, (genres.get(g) ?? 0) + 1));
      if (b.author) authors.set(b.author, (authors.get(b.author) ?? 0) + 1);
      if (r.format !== 'audiobook' && b.pages && (!longest || b.pages > (longest.pages ?? 0))) longest = b;
    }
  }

  const sortMap = (m: Map<string, number>) =>
    [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));

  return {
    year,
    finished,
    books: finished.length,
    pages,
    audiobooks: formats.audiobook,
    avgRating: rated ? ratingSum / rated : null,
    months,
    genres: sortMap(genres),
    formats,
    abandoned: inYear.filter((r) => r.status === 'abandonado').length,
    topAuthors: sortMap(authors).filter((a) => a.n > 1).slice(0, 3),
    best,
    longest
  };
}

export function availableYears(readings: Reading[]): number[] {
  const set = new Set<number>([new Date().getFullYear()]);
  readings.forEach((r) => {
    const y = readingYear(r);
    if (y) set.add(y);
  });
  return [...set].sort((a, b) => b - a);
}

/** livros marcados como lidos que não têm nenhuma leitura registrada */
export function legacyBooks(books: Book[], readings: Reading[]) {
  const withReading = new Set(readings.filter((r) => r.status === 'lido').map((r) => r.book_id));
  return books.filter((b) => b.status === 'lido' && !withReading.has(b.id));
}

/** Quanto da estante (livros que tenho, fora desejos) já foi lido. */
export function shelfProgress(books: Book[]) {
  const shelf = books.filter((b) => b.owned && b.status !== 'desejo');
  const read = shelf.filter((b) => b.status === 'lido').length;
  const unread = shelf.filter((b) => b.status === 'nao_lido').length;
  return { total: shelf.length, read, unread, pct: shelf.length ? Math.round((read / shelf.length) * 100) : 0 };
}

/* ---------- Leitura da estante: ritmo, sagas e sugestões ---------- */

export interface OpenSeries {
  name: string;
  read: number;
  total: number | null;
  /** próximo livro da saga que já está na estante */
  next: Book | null;
  /** posições que faltam cadastrar/comprar (só quando o total é conhecido) */
  missing: number[];
}

export interface Suggestion {
  book: Book;
  reason: string;
}

export interface ShelfInsights {
  /** livros terminados por mês no ano corrente */
  pace: number;
  /** meses estimados para zerar a pilha no ritmo atual (null se não há ritmo) */
  monthsToClear: number | null;
  openSeries: OpenSeries[];
  suggestions: Suggestion[];
  /** desejos que combinam com o que a pessoa lê (para quando a pilha zerou) */
  wishSuggestions: Suggestion[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function shelfInsights(books: Book[], readings: Reading[], now = new Date()): ShelfInsights {
  const year = now.getFullYear();
  const byId = new Map(books.map((b) => [b.id, b]));

  // ritmo: livros terminados neste ano / meses decorridos
  const finishedThisYear = readings.filter((r) => r.status === 'lido' && readingYear(r) === year);
  const monthsElapsed = now.getMonth() + now.getDate() / 31;
  const pace = finishedThisYear.length / Math.max(1, monthsElapsed);
  const unread = books.filter((b) => b.owned && b.status === 'nao_lido');
  const monthsToClear = pace > 0 && unread.length ? Math.ceil(unread.length / pace) : null;

  // gosto: leituras do ano; se forem poucas, usa o histórico todo (notas pesam)
  let base = finishedThisYear;
  if (base.length < 3) base = readings.filter((r) => r.status === 'lido');
  const genreW = new Map<string, number>();
  const authorW = new Map<string, number>();
  const usingYear = base === finishedThisYear;
  for (const r of base) {
    const b = byId.get(r.book_id);
    if (!b) continue;
    const w = r.rating == null ? 1 : r.rating >= 4 ? 1.5 : r.rating < 2.5 ? 0.3 : 1;
    b.genres.forEach((g) => genreW.set(g, (genreW.get(g) ?? 0) + w));
    if (b.author) authorW.set(b.author, (authorW.get(b.author) ?? 0) + w);
  }
  // livros marcados como lidos sem registro também contam um pouco
  if (!base.length)
    books
      .filter((b) => b.status === 'lido')
      .forEach((b) => {
        b.genres.forEach((g) => genreW.set(g, (genreW.get(g) ?? 0) + 0.5));
        if (b.author) authorW.set(b.author, (authorW.get(b.author) ?? 0) + 0.5);
      });
  const when = usingYear ? `em ${year}` : 'até agora';

  // sagas em aberto: pelo menos um lido e algo faltando
  const groups = new Map<string, Book[]>();
  for (const b of books) {
    const k = seriesKey(b);
    if (k) groups.set(k, [...(groups.get(k) ?? []), b]);
  }
  const openSeries: OpenSeries[] = [];
  const nextIds = new Map<string, OpenSeries>();
  for (const list of groups.values()) {
    list.sort((a, b) => (a.series_index ?? 999) - (b.series_index ?? 999));
    const read = list.filter((b) => b.status === 'lido').length;
    if (!read) continue;
    const total = seriesTotal(list[0], books);
    const next = list.find((b) => b.owned && (b.status === 'nao_lido' || b.status === 'lendo')) ?? null;
    const have = new Set(list.filter((b) => b.owned || b.status === 'lido').map((b) => b.series_index).filter((n): n is number => n != null));
    const missing = total ? Array.from({ length: total }, (_, i) => i + 1).filter((i) => !have.has(i)) : [];
    if (!next && !missing.length) continue;
    const os = { name: list[0].series!, read, total, next, missing };
    openSeries.push(os);
    if (next) nextIds.set(next.id, os);
  }
  openSeries.sort((a, b) => Number(!!b.next) - Number(!!a.next) || b.read - a.read);

  const score = (b: Book): Suggestion | null => {
    const os = nextIds.get(b.id);
    if (os) return { book: b, reason: `Continua a saga ${os.name} (${os.read} ${os.read === 1 ? 'lido' : 'lidos'})` };
    let best = 0;
    let reason = '';
    const aw = b.author ? authorW.get(b.author) ?? 0 : 0;
    if (aw) {
      best = aw * 2;
      reason = `Você leu ${plural(Math.round(aw) || 1, 'livro', 'livros')} de ${b.author} ${when}`;
    }
    let gw = 0;
    let topG = '';
    for (const g of b.genres) {
      const w = genreW.get(g) ?? 0;
      gw += w;
      if (w > (genreW.get(topG) ?? 0)) topG = g;
    }
    if (gw > best) {
      best = gw;
      reason = `${topG} é um dos gêneros que você mais leu ${when}`;
    }
    return best > 0 ? { book: b, reason } : null;
  };
  const rank = (list: Book[]) =>
    list
      .map((b) => ({ s: score(b), w: nextIds.has(b.id) ? 1000 : (b.author ? (authorW.get(b.author) ?? 0) * 2 : 0) + b.genres.reduce((a, g) => a + (genreW.get(g) ?? 0), 0) }))
      .filter((x): x is { s: Suggestion; w: number } => !!x.s)
      .sort((a, b) => b.w - a.w)
      .slice(0, 3)
      .map((x) => x.s);

  return {
    pace,
    monthsToClear,
    openSeries: openSeries.slice(0, 4),
    suggestions: rank(unread),
    wishSuggestions: rank(books.filter((b) => b.status === 'desejo'))
  };
}
