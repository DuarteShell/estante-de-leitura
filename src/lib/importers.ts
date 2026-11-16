/**
 * Importação de planilhas de leitura: Notion, Goodreads, StoryGraph ou qualquer CSV
 * (Skoob, Skeelo, Google Sheets, Excel...) via mapeamento de colunas.
 * Módulo puro (sem DOM) para poder ser testado no Node.
 */
import Papa from 'papaparse';
import type { BookStatus, ReadingFormat, ReadingStatus } from './types';
import { bookKey, clampRating, norm } from './util';

export type Field =
  | 'title'
  | 'author'
  | 'cover'
  | 'rating'
  | 'started'
  | 'finished'
  | 'pages'
  | 'pages_read'
  | 'progress'
  | 'status'
  | 'isbn'
  | 'format'
  | 'genre'
  | 'review'
  | 'owned';

export const FIELD_LABEL: Record<Field, string> = {
  title: 'Título',
  author: 'Autor(a)',
  cover: 'Capa (link)',
  rating: 'Nota',
  started: 'Data de início',
  finished: 'Data de término',
  pages: 'Total de páginas',
  pages_read: 'Páginas lidas',
  progress: 'Progresso (%)',
  status: 'Status / prateleira',
  isbn: 'ISBN',
  format: 'Formato',
  genre: 'Gênero / tags',
  review: 'Resenha',
  owned: 'Tenho o livro?'
};

export type Mapping = Partial<Record<Field, string>>;
export type SourceId = 'notion' | 'goodreads' | 'storygraph' | 'generico';

export const SOURCE_LABEL: Record<SourceId, string> = {
  notion: 'Notion',
  goodreads: 'Goodreads',
  storygraph: 'The StoryGraph',
  generico: 'CSV genérico'
};

// Sinônimos de cabeçalho (comparados sem acento/maiúsculas). Ordem importa: pages_read antes de pages.
const SYNONYMS: [Field, string[]][] = [
  ['title', ['titulo', 'title', 'nome', 'name', 'livro', 'book', 'obra']],
  ['author', ['autor', 'autora', 'author', 'authors', 'autores', 'autor a', 'escritor', 'escritora']],
  ['cover', ['capa', 'cover', 'imagem', 'image', 'cover url', 'foto']],
  ['rating', ['nota', 'rating', 'my rating', 'star rating', 'avaliacao', 'estrelas', 'stars', 'minha nota']],
  ['started', ['inicio', 'data de inicio', 'comecei', 'started', 'start date', 'date started', 'started reading']],
  [
    'finished',
    ['termino', 'fim', 'data de termino', 'data de leitura', 'lido em', 'conclusao', 'finished', 'end date', 'date read', 'last date read', 'date finished', 'finished reading']
  ],
  ['pages_read', ['paginas lidas', 'pages read', 'pagina atual', 'current page']],
  ['pages', ['total de paginas', 'paginas', 'n de paginas', 'numero de paginas', 'pages', 'number of pages', 'num pages', 'page count']],
  ['progress', ['progresso', 'progress', 'porcentagem', 'percent']],
  ['status', ['status', 'exclusive shelf', 'read status', 'estado', 'situacao', 'shelf', 'prateleira', 'estante']],
  ['isbn', ['isbn13', 'isbn 13', 'isbn', 'isbn uid', 'isbn10']],
  ['format', ['formato', 'format', 'binding', 'meio', 'midia', 'tipo', 'meio de leitura']],
  ['genre', ['genero', 'generos', 'genre', 'genres', 'categoria', 'categorias', 'tags', 'bookshelves']],
  ['review', ['resenha', 'review', 'my review', 'comentario', 'comentarios', 'opiniao', 'notas']],
  ['owned', ['owned', 'owned copies', 'tenho', 'possuo', 'na estante', 'tenho o livro']]
];

export const PRESETS: Record<Exclude<SourceId, 'generico' | 'notion'>, Mapping> = {
  goodreads: {
    title: 'Title',
    author: 'Author',
    rating: 'My Rating',
    finished: 'Date Read',
    pages: 'Number of Pages',
    status: 'Exclusive Shelf',
    isbn: 'ISBN13',
    format: 'Binding',
    review: 'My Review',
    genre: 'Bookshelves',
    owned: 'Owned Copies'
  },
  storygraph: {
    title: 'Title',
    author: 'Authors',
    rating: 'Star Rating',
    finished: 'Last Date Read',
    status: 'Read Status',
    isbn: 'ISBN/UID',
    format: 'Format',
    review: 'Review',
    genre: 'Tags',
    owned: 'Owned?'
  }
};

export interface ParsedFile {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
  source: SourceId;
  mapping: Mapping;
}

export function parseCsv(name: string, text: string): ParsedFile {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim()
  });
  const headers = (res.meta.fields ?? []).filter(Boolean);
  const source = detectSource(headers);
  const mapping = source === 'goodreads' || source === 'storygraph' ? PRESETS[source] : guessMapping(headers);
  return { name, headers, rows: res.data, source, mapping };
}

export function detectSource(headers: string[]): SourceId {
  const h = new Set(headers);
  if (h.has('Exclusive Shelf') && h.has('My Rating')) return 'goodreads';
  if (h.has('Read Status') && h.has('Star Rating')) return 'storygraph';
  const n = headers.map(norm);
  if (n.includes('titulo') || n.includes('autor') || n.includes('progresso')) return 'notion';
  return 'generico';
}

export function guessMapping(headers: string[]): Mapping {
  const m: Mapping = {};
  const used = new Set<string>();
  for (const [field, syns] of SYNONYMS) {
    const hit = headers.find((h) => !used.has(h) && syns.includes(norm(h)));
    if (hit) {
      m[field] = hit;
      used.add(hit);
    }
  }
  return m;
}

/* ---------------- parsers de valores ---------------- */

export function parseRating(raw: string | undefined): number | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  const stars = (s.match(/[⭐★🌟]/gu) ?? []).length;
  const moons = (s.match(/🌕/gu) ?? []).length;
  const halves = (s.match(/[½🌗🌓]/gu) ?? []).length;
  if (stars || moons || halves) return clampRating(stars + moons + halves * 0.5);
  const m = s.replace(',', '.').match(/(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?/);
  if (!m) return null;
  let n = Number(m[1]);
  const scale = m[2] ? Number(m[2]) : n > 5 ? 10 : 5;
  if (scale !== 5) n = (n / scale) * 5;
  return n > 0 ? clampRating(n) : null;
}

const MONTHS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTHS_PT = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const iso = (y: number, m: number, d: number) => {
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

export function parseDate(raw: string | undefined): string | null {
  let s = (raw ?? '').trim();
  if (!s) return null;
  // Notion: "02/01/2023 → 05/01/2023" (intervalo) — pega o primeiro
  s = s.split(/\s*(?:→|->)\s*/)[0];
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return iso(+m[3], +m[2], +m[1]); // dd/mm/aaaa (padrão brasileiro)
  const plain = norm(s);
  m = plain.match(/^([a-z]+) (\d{1,2}) (\d{4})/); // "january 2 2023"
  if (m) {
    const mi = MONTHS_EN.findIndex((x) => x.startsWith(m![1].slice(0, 3)));
    if (mi >= 0) return iso(+m[3], mi + 1, +m[2]);
  }
  m = plain.match(/^(\d{1,2}) (?:de )?([a-z]+) (?:de )?(\d{4})/); // "2 de janeiro de 2023"
  if (m) {
    const name = m[2].slice(0, 3);
    const mi = MONTHS_PT.findIndex((x) => x.startsWith(name));
    const me = MONTHS_EN.findIndex((x) => x.startsWith(name));
    if (mi >= 0 || me >= 0) return iso(+m[3], (mi >= 0 ? mi : me) + 1, +m[1]);
  }
  m = s.match(/^(\d{4})$/);
  if (m) return null; // só o ano: tratado em parseYearOnly
  return null;
}

const yearOnly = (raw: string | undefined) => {
  const m = (raw ?? '').trim().match(/^(\d{4})$/);
  return m ? Number(m[1]) : null;
};

const parseIntLoose = (raw: string | undefined) => {
  const m = (raw ?? '').replace(/\./g, '').match(/\d+/);
  const n = m ? Number(m[0]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

const parsePercent = (raw: string | undefined) => {
  const s = (raw ?? '').trim();
  if (!s) return null;
  const n = Number(s.replace('%', '').replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return s.includes('%') || n > 1 ? n : n * 100; // Notion às vezes exporta 0.13
};

export function parseStatus(raw: string | undefined): BookStatus | null {
  const s = norm(raw);
  if (!s) return null;
  if (/(did not finish|dnf|abandon|desist)/.test(s)) return 'abandonado';
  if (/(currently|lendo|reading|em andamento|em leitura|comecei)/.test(s)) return 'lendo';
  if (/(to read|quero ler|want|wish|desejo|tbr|sugest|comprar)/.test(s)) return 'desejo';
  if (/(nao lido|unread|not started|na fila|pendente)/.test(s)) return 'nao_lido';
  if (/(^read$|^lido|lido$|finished|conclu|terminad|^read )/.test(s)) return 'lido';
  return null;
}

export function parseFormat(raw: string | undefined): ReadingFormat | null {
  const s = norm(raw);
  if (!s) return null;
  if (/(audio|audible|ouvido|podcast)/.test(s)) return 'audiobook';
  if (/(kindle|ebook|e book|digital|kobo|epub|pdf|skeelo|tablet|celular|app)/.test(s)) return 'kindle';
  if (/(paperback|hardcover|mass market|fisico|brochura|capa dura|capa comum|impresso|papel|print)/.test(s)) return 'fisico';
  return 'outro';
}

const parseOwned = (raw: string | undefined) => {
  const s = norm(raw);
  if (!s) return null;
  if (/^(0|no|nao|false|n)$/.test(s)) return false;
  return /^(\d+|yes|sim|true|s|x|tenho)$/.test(s) ? s !== '0' : null;
};

const isUrl = (s: string | undefined) => !!s && /^https?:\/\//i.test(s.trim());

/* ---------------- normalização ---------------- */

export interface ImportReading {
  status: ReadingStatus;
  started_at: string | null;
  finished_at: string | null;
  year: number | null;
  rating: number | null;
  format: ReadingFormat | null;
  pages_read: number | null;
  review: string | null;
}

export interface ImportItem {
  key: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  pages: number | null;
  isbn: string | null;
  genres: string[];
  status: BookStatus;
  owned: boolean | null;
  current_page: number | null;
  readings: ImportReading[];
  sources: string[];
}

export interface NormalizeOptions {
  /** status para livros sem datas, sem nota e sem progresso */
  undatedStatus: 'desejo' | 'nao_lido';
  /** formato quando a planilha não diz */
  defaultFormat: ReadingFormat | null;
}

const cleanTitle = (s: string) => s.replace(/\s+/g, ' ').replace(/^["'\s]+|["'\s]+$/g, '').trim();

export function normalizeFile(file: ParsedFile, opts: NormalizeOptions): ImportItem[] {
  const m = file.mapping;
  const get = (row: Record<string, string>, f: Field) => (m[f] ? (row[m[f]!] ?? '').trim() : '');
  const out: ImportItem[] = [];

  for (const row of file.rows) {
    const title = cleanTitle(get(row, 'title'));
    const author = cleanTitle(get(row, 'author')) || null;
    // Linhas vazias e separadores decorativos ("Sugestões de leitura ▷▷▷")
    if (!title || !/[\p{L}\p{N}]/u.test(title)) continue;
    const started = parseDate(get(row, 'started'));
    const finished = parseDate(get(row, 'finished'));
    const year = yearOnly(get(row, 'finished')) ?? yearOnly(get(row, 'started'));
    const rating = parseRating(get(row, 'rating'));
    const pages = parseIntLoose(get(row, 'pages'));
    const pagesRead = parseIntLoose(get(row, 'pages_read'));
    if (!author && !pages && !started && !finished && rating == null && title.includes('▷')) continue;
    if (!author && !pages && !started && !finished && rating == null && /sugest/i.test(title)) continue;

    let progress = parsePercent(get(row, 'progress'));
    if (progress == null && pagesRead && pages) progress = (pagesRead / pages) * 100;
    const explicit = parseStatus(get(row, 'status'));
    const review = get(row, 'review') || null;

    let status: BookStatus;
    if (explicit) status = explicit;
    else if (finished || year || (progress != null && progress >= 100)) status = 'lido';
    else if (started || (progress != null && progress > 0)) status = 'lendo';
    else if (rating != null) status = 'lido';
    else status = opts.undatedStatus;

    // Goodreads: "to-read" de quem marca "Owned Copies" > 0 vira "não lido" (está na estante)
    const owned = parseOwned(get(row, 'owned'));
    if (status === 'desejo' && owned) status = 'nao_lido';

    const format = parseFormat(get(row, 'format')) ?? opts.defaultFormat;
    const readings: ImportReading[] = [];
    const hasInfo = started || finished || year || rating != null || review;
    if ((status === 'lido' || status === 'abandonado') && hasInfo) {
      readings.push({
        status,
        started_at: started,
        finished_at: finished,
        year: finished || started ? null : year,
        rating,
        format,
        pages_read: status === 'lido' ? pagesRead ?? pages : pagesRead,
        review
      });
    } else if (status === 'lendo') {
      readings.push({ status: 'lendo', started_at: started, finished_at: null, year: started ? null : year, rating: null, format, pages_read: pagesRead, review });
    }

    const genreRaw = get(row, 'genre');
    const genres = genreRaw
      ? genreRaw
          .split(/[,;|]/)
          .map((g) => g.trim())
          .filter((g) => g && !/^(read|to-read|currently-reading|favorites)$/i.test(g))
          .slice(0, 4)
      : [];

    const isbnRaw = get(row, 'isbn').replace(/[="]/g, '');
    out.push({
      key: bookKey(title, author),
      title,
      author,
      cover_url: isUrl(get(row, 'cover')) ? get(row, 'cover') : null,
      pages,
      isbn: /\d{9,13}/.test(isbnRaw) ? isbnRaw.replace(/[^0-9X]/gi, '') : null,
      genres,
      status,
      owned,
      current_page: status === 'lendo' ? pagesRead : null,
      readings,
      sources: [file.name]
    });
  }
  return out;
}

const STATUS_RANK: Record<BookStatus, number> = { lendo: 5, lido: 4, abandonado: 3, nao_lido: 2, desejo: 1 };

const readingKey = (r: ImportReading) => [r.status, r.started_at, r.finished_at, r.year, r.rating].join('|');

/**
 * Junta itens repetidos (o Notion exporta "_all" e a visão filtrada, e o mesmo
 * livro pode ter sido lido em anos diferentes — vira um livro com várias leituras).
 */
export function mergeItems(items: ImportItem[]): ImportItem[] {
  const map = new Map<string, ImportItem>();
  for (const it of items) {
    const cur = map.get(it.key);
    if (!cur) {
      map.set(it.key, { ...it, readings: [...it.readings], sources: [...it.sources] });
      continue;
    }
    cur.cover_url ??= it.cover_url;
    cur.pages ??= it.pages;
    cur.isbn ??= it.isbn;
    cur.owned ??= it.owned;
    if (!cur.genres.length) cur.genres = it.genres;
    for (const s of it.sources) if (!cur.sources.includes(s)) cur.sources.push(s);
    const seen = new Set(cur.readings.map(readingKey));
    for (const r of it.readings) if (!seen.has(readingKey(r))) cur.readings.push(r);
    if (STATUS_RANK[it.status] > STATUS_RANK[cur.status]) {
      cur.status = it.status;
      cur.current_page = it.current_page;
    }
  }
  // Uma leitura "lendo" antiga + uma "lida" do mesmo período: fica só a concluída
  for (const it of map.values()) {
    const done = it.readings.filter((r) => r.status === 'lido');
    if (done.length) {
      it.readings = it.readings.filter((r) => r.status !== 'lendo' || !done.some((d) => d.started_at && d.started_at === r.started_at));
      if (it.status === 'lendo' && !it.readings.some((r) => r.status === 'lendo')) it.status = 'lido';
    }
    it.readings.sort((a, b) => (a.finished_at ?? a.started_at ?? '').localeCompare(b.finished_at ?? b.started_at ?? ''));
  }
  return [...map.values()];
}
