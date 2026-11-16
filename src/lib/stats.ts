import type { Book, Reading, ReadingFormat } from './types';
import { readingYear } from './util';

export interface YearStats {
  year: number;
  finished: Reading[];
  books: number;
  pages: number;
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
    pages += r.pages_read ?? b?.pages ?? 0;
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
      if (b.pages && (!longest || b.pages > (longest.pages ?? 0))) longest = b;
    }
  }

  const sortMap = (m: Map<string, number>) =>
    [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));

  return {
    year,
    finished,
    books: finished.length,
    pages,
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
