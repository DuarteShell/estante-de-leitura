/** Busca de dados de livros: BrasilAPI (ótima p/ edições brasileiras) → Google Books → Open Library */

export interface FoundBook {
  title: string;
  author: string | null;
  pages: number | null;
  cover_url: string | null;
  genres: string[];
  isbn: string | null;
  source: string;
}

export const cleanIsbn = (s: string) => s.replace(/[^0-9Xx]/g, '').toUpperCase();

export function isValidIsbn(raw: string) {
  const s = cleanIsbn(raw);
  if (s.length === 13 && /^\d{13}$/.test(s)) {
    const sum = s
      .slice(0, 12)
      .split('')
      .reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
    return (10 - (sum % 10)) % 10 === Number(s[12]);
  }
  if (s.length === 10 && /^\d{9}[\dX]$/.test(s)) {
    const sum = s.split('').reduce((acc, d, i) => acc + (d === 'X' ? 10 : Number(d)) * (10 - i), 0);
    return sum % 11 === 0;
  }
  return false;
}

const GENRE_PT: [RegExp, string][] = [
  [/science fiction|ficcao cientifica/i, 'Ficção científica'],
  [/fantasy|fantasia/i, 'Fantasia'],
  [/romance|love/i, 'Romance'],
  [/horror|terror/i, 'Terror'],
  [/thriller|suspense/i, 'Suspense'],
  [/mystery|detective|misterio|policial/i, 'Mistério'],
  [/comics|graphic novel|manga|quadrinhos/i, 'Quadrinhos / mangá'],
  [/young adult|juvenile|juvenil|infantojuvenil/i, 'Jovem adulto'],
  [/biography|autobiography|biografia/i, 'Biografia'],
  [/history|historia/i, 'História'],
  [/self-help|autoajuda/i, 'Autoajuda'],
  [/philosophy|filosofia/i, 'Filosofia'],
  [/psychology|psicologia/i, 'Psicologia'],
  [/poetry|poesia/i, 'Poesia'],
  [/business|economics|negocios|economia/i, 'Negócios'],
  [/science|ciencia/i, 'Ciência'],
  [/classic|classico/i, 'Clássicos'],
  [/literary|literatura|fiction|ficcao/i, 'Ficção']
];

export function translateGenres(cats: string[]): string[] {
  const out = new Set<string>();
  for (const c of cats) {
    const plain = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const hit = GENRE_PT.find(([re]) => re.test(plain));
    if (hit) out.add(hit[1]);
  }
  // "Ficção" genérico só se não houver nada mais específico
  if (out.size > 1) out.delete('Ficção');
  return [...out].slice(0, 3);
}

const https = (u: string | null | undefined) => (u ? u.replace(/^http:/, 'https:') : null);

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

interface GVolume {
  volumeInfo: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    pageCount?: number;
    categories?: string[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: { type: string; identifier: string }[];
  };
}

function fromGoogle(v: GVolume): FoundBook | null {
  const i = v.volumeInfo;
  if (!i?.title) return null;
  const isbn =
    i.industryIdentifiers?.find((x) => x.type === 'ISBN_13')?.identifier ??
    i.industryIdentifiers?.find((x) => x.type === 'ISBN_10')?.identifier ??
    null;
  const thumb = i.imageLinks?.thumbnail ?? i.imageLinks?.smallThumbnail;
  return {
    title: i.title,
    author: i.authors?.join(', ') ?? null,
    pages: i.pageCount || null,
    cover_url: thumb ? https(thumb.replace('&edge=curl', '').replace('zoom=5', 'zoom=1')) : null,
    genres: translateGenres(i.categories ?? []),
    isbn,
    source: 'Google Books'
  };
}

async function brasilApi(isbn: string): Promise<FoundBook | null> {
  const d = (await getJson(`https://brasilapi.com.br/api/isbn/v1/${isbn}`)) as {
    title?: string;
    subtitle?: string | null;
    authors?: string[];
    page_count?: number;
    subjects?: string[];
    cover_url?: string | null;
  } | null;
  if (!d?.title) return null;
  return {
    title: d.title,
    author: d.authors?.length ? d.authors.join(', ') : null,
    pages: d.page_count || null,
    cover_url: https(d.cover_url),
    genres: translateGenres(d.subjects ?? []),
    isbn,
    source: 'BrasilAPI'
  };
}

async function googleIsbn(isbn: string): Promise<FoundBook | null> {
  const d = (await getJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`)) as { items?: GVolume[] } | null;
  const v = d?.items?.[0];
  return v ? fromGoogle(v) : null;
}

async function openLibrary(isbn: string): Promise<FoundBook | null> {
  const d = (await getJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`)) as Record<
    string,
    {
      title?: string;
      authors?: { name: string }[];
      number_of_pages?: number;
      subjects?: { name: string }[];
      cover?: { large?: string; medium?: string };
    }
  > | null;
  const b = d?.[`ISBN:${isbn}`];
  if (!b?.title) return null;
  return {
    title: b.title,
    author: b.authors?.map((a) => a.name).join(', ') ?? null,
    pages: b.number_of_pages || null,
    cover_url: https(b.cover?.large ?? b.cover?.medium),
    genres: translateGenres(b.subjects?.map((s) => s.name) ?? []),
    isbn,
    source: 'Open Library'
  };
}

/** Junta as fontes: a primeira que achar define título/autor; as outras completam capa, páginas e gêneros. */
export async function lookupIsbn(raw: string): Promise<FoundBook | null> {
  const isbn = cleanIsbn(raw);
  const [a, b, c] = await Promise.all([brasilApi(isbn), googleIsbn(isbn), openLibrary(isbn)]);
  const all = [a, b, c].filter(Boolean) as FoundBook[];
  if (!all.length) return null;
  const base = { ...all[0] };
  for (const x of all.slice(1)) {
    base.cover_url ??= x.cover_url;
    base.pages ??= x.pages;
    base.author ??= x.author;
    if (!base.genres.length) base.genres = x.genres;
  }
  return base;
}

export async function searchBooks(q: string): Promise<FoundBook[]> {
  if (!q.trim()) return [];
  const d = (await getJson(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=15&printType=books`
  )) as { items?: GVolume[] } | null;
  return (d?.items ?? []).map(fromGoogle).filter(Boolean) as FoundBook[];
}

/** Capa (e gêneros/páginas, se faltarem) a partir do título + autor — usado na importação */
export async function findCover(title: string, author: string | null): Promise<FoundBook | null> {
  const q = `intitle:${title}${author ? ` inauthor:${author.split(',')[0]}` : ''}`;
  const res = await searchBooks(q);
  return res.find((r) => r.cover_url) ?? null;
}
