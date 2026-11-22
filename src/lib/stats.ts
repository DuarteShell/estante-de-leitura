import type { Book, Reading, ReadingFormat } from './types';
import { norm, readingYear, seriesKey, seriesTotal } from './util';

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
  /** autores diferentes lidos no ano */
  authors: number;
  best: { book: Book; rating: number } | null;
  longest: Book | null;
}

/** favorito vale meia estrela a mais na hora de escolher a melhor nota */
export const FAVORITE_BONUS = 0.5;
/** peso de uma leitura para "melhor nota": a nota + bônus do coração */
export const ratingScore = (r: Pick<Reading, 'rating' | 'favorite'>) => (r.rating ?? 0) + (r.favorite ? FAVORITE_BONUS : 0);
/** compara duas leituras pela melhor nota: peso (nota + coração) e, no empate, a nota real */
const ratingRank = (r: Pick<Reading, 'rating' | 'favorite'>) => ratingScore(r) * 10 + (r.rating ?? 0);

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
  let bestScore = -1;
  let longest: Book | null = null;

  for (const r of finished) {
    const b = byId.get(r.book_id);
    // audiobook não conta páginas
    if (r.format !== 'audiobook') pages += r.pages_read ?? b?.pages ?? 0;
    if (r.finished_at) months[Number(r.finished_at.slice(5, 7)) - 1] += 1;
    if (r.rating != null) {
      ratingSum += r.rating;
      rated += 1;
      if (b && ratingRank(r) > bestScore) {
        best = { book: b, rating: r.rating };
        bestScore = ratingRank(r);
      }
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
    authors: authors.size,
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
/** Leitura legado: livro lido sem leitura datada. Pode ter uma leitura sem data
 *  só para guardar nota/favorito — ela não entra nas contas por ano. */
export function legacyBooks(books: Book[], readings: Reading[]) {
  const withReading = new Set(readings.filter((r) => r.status === 'lido' && readingYear(r) != null).map((r) => r.book_id));
  return books.filter((b) => b.status === 'lido' && !withReading.has(b.id));
}

/** Quanto da estante (livros que tenho, fora desejos) já foi lido.
 *  Lendo e abandonados contam como não lidos: só saem da pilha quando terminados. */
export function shelfProgress(books: Book[]) {
  const shelf = books.filter((b) => b.owned && b.status !== 'desejo');
  const read = shelf.filter((b) => b.status === 'lido').length;
  const unread = shelf.length - read;
  /** só os que nem foram começados (base das sugestões "pra ler a seguir") */
  const notStarted = shelf.filter((b) => b.status === 'nao_lido').length;
  const inProgress = shelf.filter((b) => b.status === 'lendo').length;
  return { total: shelf.length, read, unread, notStarted, inProgress, pct: shelf.length ? Math.round((read / shelf.length) * 100) : 0 };
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
  /** situação de cada volume, em ordem (para a faixa visual da saga) */
  volumes: VolumeState[];
}

export type VolumeState = 'lido' | 'lendo' | 'parado' | 'estante' | 'falta';

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
  // pilha = tudo da estante que ainda não foi terminado (lendo e abandonados inclusos)
  const pile = books.filter((b) => b.owned && b.status !== 'desejo' && b.status !== 'lido').length;
  const monthsToClear = pace > 0 && pile ? Math.ceil(pile / pace) : null;

  // gosto: leituras do ano; se forem poucas, usa o histórico todo (notas pesam)
  let base = finishedThisYear;
  if (base.length < 3) base = readings.filter((r) => r.status === 'lido');
  const genreW = new Map<string, number>();
  const authorW = new Map<string, number>();
  const usingYear = base === finishedThisYear;
  for (const r of base) {
    const b = byId.get(r.book_id);
    if (!b) continue;
    // coração pesa mais que nota alta
    const w = r.favorite ? 2 : r.rating == null ? 1 : r.rating >= 4 ? 1.5 : r.rating < 2.5 ? 0.3 : 1;
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
    // próximo = o volume logo depois do último lido (se abandonado, é retomar ele);
    // se já está lendo algum, é esse. Volume seguinte que não tenho → sem próximo.
    const lastRead = list.reduce((acc, b, i) => (b.status === 'lido' ? i : acc), -1);
    const after = list.slice(lastRead + 1).find((b) => b.status !== 'lido');
    const lastIdx = list[lastRead]?.series_index;
    const skipsVolume = after?.series_index != null && lastIdx != null && after.series_index > lastIdx + 1;
    const next =
      list.find((b) => b.status === 'lendo') ??
      (after && !skipsVolume && (after.status === 'abandonado' || (after.owned && after.status === 'nao_lido')) ? after : null);
    const have = new Set(list.filter((b) => b.owned || b.status === 'lido' || b.status === 'abandonado').map((b) => b.series_index).filter((n): n is number => n != null));
    const missing = total ? Array.from({ length: total }, (_, i) => i + 1).filter((i) => !have.has(i)) : [];
    if (!next && !missing.length) continue;
    const state = (b: Book | undefined): VolumeState =>
      !b ? 'falta' : b.status === 'lido' ? 'lido' : b.status === 'lendo' ? 'lendo' : b.status === 'abandonado' ? 'parado' : b.owned ? 'estante' : 'falta';
    const volumes: VolumeState[] = total
      ? Array.from({ length: total }, (_, i) => state(list.find((b) => b.series_index === i + 1 && (b.owned || b.status === 'lido' || b.status === 'abandonado'))))
      : list.map(state);
    const os = { name: list[0].series!, read, total, next, missing, volumes };
    openSeries.push(os);
    if (next) nextIds.set(next.id, os);
  }
  openSeries.sort((a, b) => Number(!!b.next) - Number(!!a.next) || b.read - a.read);

  const score = (b: Book): Suggestion | null => {
    const os = nextIds.get(b.id);
    if (os && b.status === 'abandonado') return { book: b, reason: `Retomar a saga ${os.name} (${os.read} ${os.read === 1 ? 'lido' : 'lidos'})` };
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
    // próximos de saga abandonados também entram (retomar a leitura)
    suggestions: rank([...unread, ...books.filter((b) => b.status === 'abandonado' && nextIds.has(b.id))]),
    wishSuggestions: rank(books.filter((b) => b.status === 'desejo'))
  };
}

/* ---------- Perfil de leitor: um ano ou o histórico todo ---------- */

/** um ano, o histórico todo (com legado) ou só as leituras legado */
export type Period = number | 'all' | 'legado';

export type AxisKey = 'ritmo' | 'folego' | 'variedade' | 'constancia' | 'sagas' | 'descoberta';

export interface ProfileAxis {
  key: AxisKey;
  label: string;
  /** 0–100, para o radar */
  value: number;
  /** o número de verdade por trás do eixo */
  detail: string;
  /** como o eixo é medido */
  hint: string;
}

export interface Ranked {
  name: string;
  n: number;
}

export interface ReaderProfile {
  period: Period;
  books: number;
  /** quantas leituras legado (sem data) entraram nas contas */
  legacy: number;
  pages: number;
  audiobooks: number;
  /** livros por mês no período (até hoje, se for o ano corrente) */
  perMonth: number;
  avgRating: number | null;
  avgPages: number | null;
  /** dias, em média, entre começar e terminar (só leituras com as duas datas) */
  avgDays: number | null;
  pagesPerDay: number | null;
  abandoned: number;
  authors: number;
  newAuthors: number;
  genres: Ranked[];
  /** quantas leituras com nota 1★…5★ (meia estrela sobe: 3,5 → 4★) */
  ratings: number[];
  /** até 200 · 200–349 · 350–499 · 500+ páginas */
  sizes: number[];
  formats: Record<ReadingFormat | 'nd', number>;
  /** só no histórico: livros por ano, do mais antigo ao atual */
  byYear: { year: number; n: number }[];
  axes: ProfileAxis[];
  traits: string[];
  records: {
    favorite: { book: Book; rating: number } | null;
    longest: Book | null;
    shortest: Book | null;
    fastest: { book: Book; days: number } | null;
    slowest: { book: Book; days: number } | null;
    topAuthor: Ranked | null;
    topSeries: Ranked | null;
    rereads: Ranked[];
  };
}

export const SIZE_LABELS = ['até 200', '200–349', '350–499', '500+'];

const dayMs = 86_400_000;
const daysBetween = (a: string, b: string) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / dayMs) + 1);
const sortKey = (r: Reading) => r.finished_at ?? `${readingYear(r) ?? 0}-99`;
const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const fmt1 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export function readerProfile(period: Period, books: Book[], readings: Reading[], now = new Date()): ReaderProfile {
  const byId = new Map(books.map((b) => [b.id, b]));
  // leituras com data (ou ano); as sem data são tratadas como legado logo abaixo
  const allFinished = readings.filter((r) => r.status === 'lido' && byId.has(r.book_id) && readingYear(r) != null).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const inPeriod = (r: Reading) => period === 'all' || readingYear(r) === period;
  const datedFinished = period === 'legado' ? [] : allFinished.filter(inPeriod);
  const abandoned = period === 'legado' ? 0 : readings.filter((r) => r.status === 'abandonado' && inPeriod(r)).length;
  const thisYear = now.getFullYear();

  // legado: livros lidos sem leitura datada. Nota/favorito vêm de uma leitura sem data, se houver.
  // Entram no montante (livros, páginas, gêneros, autores, sagas); nota só se tiver.
  // Formato: na estante = físico; fora dela, não entra nos formatos.
  // Nunca em ritmo, constância, tempo de leitura ou livros por ano.
  const legacyList = legacyBooks(books, readings);
  const legacyEntries: Reading[] = legacyList.map((b) => {
    const undated = readings.filter((r) => r.book_id === b.id && r.status === 'lido');
    return {
      id: `legado:${b.id}`,
      book_id: b.id,
      status: 'lido',
      started_at: null,
      finished_at: null,
      year: null,
      rating: undated.find((r) => r.rating != null)?.rating ?? null,
      favorite: undated.some((r) => r.favorite),
      format: undated.find((r) => r.format)?.format ?? (b.owned ? 'fisico' : null),
      pages_read: null,
      review: null,
      created_at: b.created_at
    } as Reading;
  });
  const legacyIds = new Set(legacyEntries.map((r) => r.id));
  const usesLegacy = period === 'all' || period === 'legado';
  const finished = usesLegacy ? [...datedFinished, ...legacyEntries] : datedFinished;
  /** leituras com data no período: base de ritmo, formatos, descoberta e afins */
  const nDated = datedFinished.length;

  // primeira leitura de cada autor no histórico → "descoberta".
  // Autores do legado já eram conhecidos antes do primeiro ano registrado.
  const firstOfAuthor = new Map<string, string>();
  for (const b of legacyList) if (b.author) firstOfAuthor.set(norm(b.author), 'legado');
  for (const r of allFinished) {
    const a = byId.get(r.book_id)?.author;
    if (a && !firstOfAuthor.has(norm(a))) firstOfAuthor.set(norm(a), r.id);
  }

  const genres = new Map<string, number>();
  const authors = new Map<string, number>();
  const series = new Map<string, number>();
  const formats = { fisico: 0, kindle: 0, audiobook: 0, outro: 0, nd: 0 };
  const ratings = [0, 0, 0, 0, 0];
  const sizes = [0, 0, 0, 0];
  const months = new Set<string>();
  let pages = 0;
  let paged = 0;
  let pagedBooks = 0;
  let ratingSum = 0;
  let rated = 0;
  let inSeries = 0;
  let newAuthors = 0;
  let daySum = 0;
  let dated = 0;
  let datedPages = 0;
  let datedPageDays = 0;
  let favScore = -1;
  const rec: ReaderProfile['records'] = { favorite: null, longest: null, shortest: null, fastest: null, slowest: null, topAuthor: null, topSeries: null, rereads: [] };

  for (const r of finished) {
    const b = byId.get(r.book_id)!;
    const audio = r.format === 'audiobook';
    const p = r.pages_read ?? b.pages ?? 0;
    // legado sem formato (fora da estante) não entra nos formatos
    if (!legacyIds.has(r.id) || r.format) formats[r.format ?? 'nd'] += 1;
    if (r.finished_at) months.add(r.finished_at.slice(0, 7));
    b.genres.forEach((g) => genres.set(g, (genres.get(g) ?? 0) + 1));
    if (b.author) {
      authors.set(b.author, (authors.get(b.author) ?? 0) + 1);
      if (firstOfAuthor.get(norm(b.author)) === r.id) newAuthors += 1;
    }
    if (b.series) {
      inSeries += 1;
      series.set(b.series, (series.get(b.series) ?? 0) + 1);
    }
    if (r.rating != null) {
      ratingSum += r.rating;
      rated += 1;
      ratings[Math.max(0, Math.ceil(r.rating) - 1)] += 1;
      if (!rec.favorite || ratingRank(r) >= favScore) {
        rec.favorite = { book: b, rating: r.rating };
        favScore = ratingRank(r);
      }
    }
    if (!audio && p > 0) {
      pages += p;
      paged += p;
      pagedBooks += 1;
      sizes[p < 200 ? 0 : p < 350 ? 1 : p < 500 ? 2 : 3] += 1;
      if (b.pages && (!rec.longest || b.pages > (rec.longest.pages ?? 0))) rec.longest = b;
      if (b.pages && (!rec.shortest || b.pages < (rec.shortest.pages ?? Infinity))) rec.shortest = b;
    }
    if (r.started_at && r.finished_at && r.finished_at >= r.started_at) {
      const d = daysBetween(r.started_at, r.finished_at);
      daySum += d;
      dated += 1;
      if (!audio && p > 0) {
        datedPages += p;
        datedPageDays += d;
      }
      if (!rec.fastest || d < rec.fastest.days) rec.fastest = { book: b, days: d };
      if (!rec.slowest || d > rec.slowest.days) rec.slowest = { book: b, days: d };
    }
  }

  // período em meses: ano fechado = 12; ano corrente = até hoje; histórico = da primeira leitura até hoje
  let spanMonths = 12;
  if (period === 'legado') spanMonths = 1;
  else if (period === thisYear) spanMonths = now.getMonth() + now.getDate() / 31;
  else if (period === 'all' && allFinished.length) {
    const first = allFinished[0];
    const fy = Number((first.finished_at ?? `${readingYear(first) ?? thisYear}-01`).slice(0, 4));
    const fm = first.finished_at ? Number(first.finished_at.slice(5, 7)) - 1 : 0;
    spanMonths = (thisYear - fy) * 12 + now.getMonth() - fm + now.getDate() / 31;
  }
  spanMonths = Math.max(1, spanMonths);
  const perMonth = nDated / spanMonths;

  const sortMap = (m: Map<string, number>) =>
    [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'pt-BR'));
  const genreList = sortMap(genres);
  const authorList = sortMap(authors);
  const seriesList = sortMap(series);
  rec.topAuthor = authorList[0]?.n > 1 ? authorList[0] : null;
  rec.topSeries = seriesList[0]?.n > 1 ? seriesList[0] : null;
  const readCount = new Map<string, number>();
  finished.forEach((r) => readCount.set(r.book_id, (readCount.get(r.book_id) ?? 0) + 1));
  rec.rereads = [...readCount.entries()].filter(([, n]) => n > 1).map(([id, n]) => ({ name: byId.get(id)!.title, n })).sort((a, b) => b.n - a.n);
  if (rec.shortest && rec.shortest === rec.longest) rec.shortest = null;
  if (rec.slowest && rec.fastest && rec.slowest.book === rec.fastest.book) rec.slowest = null;

  const avgPages = pagedBooks ? paged / pagedBooks : null;
  const n = finished.length;
  const datedShare = nDated ? datedFinished.filter((r) => r.finished_at).length / nDated : 0;
  const activeSpan = Math.max(1, Math.ceil(spanMonths));
  const constancy = datedShare >= 0.5 ? months.size / activeSpan : null;

  const axes: ProfileAxis[] = [
    {
      key: 'ritmo',
      label: 'Ritmo',
      value: clamp100((perMonth / 3) * 100),
      detail: `${fmt1(perMonth)} ${perMonth >= 0.95 && perMonth < 1.05 ? 'livro' : 'livros'} por mês`,
      hint: 'Livros terminados por mês. 3 por mês enchem o eixo.'
    },
    {
      key: 'folego',
      label: 'Fôlego',
      value: clamp100(((avgPages ?? 0) / 500) * 100),
      detail: avgPages ? `${Math.round(avgPages)} páginas em média` : 'sem páginas cadastradas',
      hint: 'Tamanho médio dos livros (fora audiobooks). 500 páginas enchem o eixo.'
    },
    {
      key: 'variedade',
      label: 'Variedade',
      value: clamp100((genreList.length / 8) * 100),
      detail: `${genreList.length} ${genreList.length === 1 ? 'gênero' : 'gêneros'} diferentes`,
      hint: 'Quantos gêneros diferentes você leu. 8 enchem o eixo.'
    },
    {
      key: 'constancia',
      label: 'Constância',
      value: clamp100((constancy ?? 0) * 100),
      detail: constancy == null ? 'faltam datas de término' : `leu em ${months.size} de ${activeSpan} meses`,
      hint: 'Meses em que terminou pelo menos um livro.'
    },
    {
      key: 'sagas',
      label: 'Sagas',
      value: pct(inSeries, n),
      detail: `${pct(inSeries, n)}% das leituras são de sagas`,
      hint: 'Parte das leituras que pertence a uma saga ou série.'
    },
    {
      key: 'descoberta',
      label: 'Descoberta',
      value: pct(newAuthors, nDated),
      detail: `${newAuthors} ${newAuthors === 1 ? 'autor novo' : 'autores novos'} (${pct(newAuthors, nDated)}%)`,
      hint: 'Leituras de autores que você nunca tinha lido antes (quem está no legado já conta como conhecido).'
    }
  ];
  // no legado não há datas: ritmo, constância e descoberta não se aplicam
  const shownAxes = period === 'legado' ? axes.filter((a) => a.key !== 'ritmo' && a.key !== 'constancia' && a.key !== 'descoberta') : axes;

  // traços: frases curtas que resumem o jeito de ler
  const traits: string[] = [];
  const top = genreList[0];
  if (top && n >= 3 && top.n / n >= 0.5) traits.push(`Fã de ${top.name.toLowerCase()}`);
  else if (genreList.length >= 6) traits.push('Lê de tudo um pouco');
  if (perMonth >= 3) traits.push('Maratona de leitura');
  if (avgPages && avgPages >= 420) traits.push('Não foge de tijolão');
  else if (avgPages && avgPages <= 220 && pagedBooks >= 3) traits.push('Prefere livros curtos');
  if (n >= 4 && inSeries / n >= 0.4) traits.push('Devora sagas');
  if (nDated >= 4 && newAuthors / nDated >= 0.6) traits.push('Sempre descobrindo autores');
  else if (nDated >= 6 && newAuthors / nDated <= 0.25) traits.push('Fiel aos autores favoritos');
  if (constancy != null && constancy >= 0.8 && activeSpan >= 4) traits.push('Leitura o ano todo');
  if (rated >= 4 && ratingSum / rated >= 4.3) traits.push('Dá nota alta fácil');
  else if (rated >= 4 && ratingSum / rated <= 3.2) traits.push('Difícil de agradar');
  const nFormat = Object.values(formats).reduce((a, b) => a + b, 0);
  if (nFormat >= 4 && formats.audiobook / nFormat >= 0.3) traits.push('Ouve livros');
  if (nFormat >= 4 && formats.kindle / nFormat >= 0.5) traits.push('Leitura digital');
  if (nDated + abandoned >= 6 && abandoned / (nDated + abandoned) >= 0.15) traits.push('Larga o que não agrada');
  else if (nDated >= 10 && abandoned === 0) traits.push('Termina o que começa');

  const byYear: ReaderProfile['byYear'] = [];
  if (period === 'all' && allFinished.length) {
    const ys = allFinished.map(readingYear).filter((y): y is number => y != null);
    for (let y = Math.min(...ys, thisYear); y <= thisYear; y++) byYear.push({ year: y, n: ys.filter((x) => x === y).length });
  }

  return {
    period,
    books: n,
    legacy: usesLegacy ? legacyEntries.length : 0,
    pages,
    audiobooks: formats.audiobook,
    perMonth,
    avgRating: rated ? ratingSum / rated : null,
    avgPages,
    avgDays: dated ? daySum / dated : null,
    pagesPerDay: datedPageDays ? datedPages / datedPageDays : null,
    abandoned,
    authors: authors.size,
    newAuthors,
    genres: genreList,
    ratings,
    sizes,
    formats,
    byYear,
    axes: shownAxes,
    traits: traits.slice(0, 5),
    records: rec
  };
}
