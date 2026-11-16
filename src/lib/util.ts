import type { Book, Reading } from './types';

export const uid = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** minúsculas, sem acentos e espaços extras — para comparar títulos/autores */
export const norm = (s: string | null | undefined) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const bookKey = (title: string, author: string | null) => `${norm(title)}|${norm(author)}`;

export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function fmtDate(iso: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}

export const fmtNum = (n: number) => n.toLocaleString('pt-BR');
export const fmtRating = (r: number) => r.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export function readingYear(r: Reading): number | null {
  if (r.year) return r.year;
  const d = r.finished_at ?? r.started_at;
  return d ? Number(d.slice(0, 4)) : null;
}

/** paleta das lombadas/capas geradas */
const PALETTE: [string, string][] = [
  ['#4F6B47', '#FBF8EF'],
  ['#6E8B5E', '#FBF8EF'],
  ['#3F5A39', '#FBF8EF'],
  ['#8A5F3C', '#FBF8EF'],
  ['#7A5235', '#FBF8EF'],
  ['#5C3D26', '#FBF8EF'],
  ['#9C6B43', '#FBF8EF'],
  ['#B07B4A', '#FBF8EF'],
  ['#C9A57E', '#2F3E2C'],
  ['#A3B18A', '#2F3E2C'],
  ['#E0C49C', '#2F3E2C'],
  ['#5E7D8A', '#FBF8EF'],
  ['#8E4F3E', '#FBF8EF'],
  ['#C4855E', '#2F3E2C'],
  ['#7A9A68', '#2F3E2C'],
  ['#3E4E44', '#FBF8EF']
];

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const bookColors = (b: Pick<Book, 'title'>) => PALETTE[hash(b.title) % PALETTE.length];

export const clampRating = (n: number) => Math.max(0, Math.min(5, Math.round(n * 2) / 2));

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Sagas ---------- */

const fmtIndex = (n: number) => String(n).replace('.', ',');

/** livros da mesma saga, em ordem */
export function seriesBooks(book: Pick<Book, 'series'>, books: Book[]): Book[] {
  if (!book.series) return [];
  const key = norm(book.series);
  return books
    .filter((b) => b.series && norm(b.series) === key)
    .sort((a, b) => (a.series_index ?? 999) - (b.series_index ?? 999) || a.title.localeCompare(b.title, 'pt-BR'));
}

/** total da saga: o maior informado entre os livros dela */
export function seriesTotal(book: Pick<Book, 'series' | 'series_total'>, books: Book[]): number | null {
  const all = seriesBooks(book, books);
  const t = Math.max(book.series_total ?? 0, ...all.map((b) => b.series_total ?? 0));
  return t > 0 ? t : null;
}

/** "Livro 2 de 5" / "Livro 2" / null */
export function seriesPosition(book: Book, books: Book[]): string | null {
  if (!book.series) return null;
  const total = seriesTotal(book, books);
  if (book.series_index == null) return total ? `${total} livros` : null;
  return `Livro ${fmtIndex(book.series_index)}${total ? ` de ${total}` : ''}`;
}

/** "#2/5" curtinho para capas e lombadas */
export function seriesTag(book: Book, books: Book[]): string | null {
  if (!book.series || book.series_index == null) return null;
  const total = seriesTotal(book, books);
  return `#${fmtIndex(book.series_index)}${total ? `/${total}` : ''}`;
}
