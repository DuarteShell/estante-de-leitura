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

/** Junta as fontes: a primeira que achar define título/autor; as outras completam páginas e gêneros. A capa passa por findBestCover. */
export async function lookupIsbn(raw: string): Promise<FoundBook | null> {
  const isbn = cleanIsbn(raw);
  const [a, b, c] = await Promise.all([brasilApi(isbn), googleIsbn(isbn), openLibrary(isbn)]);
  const all = [a, b, c].filter(Boolean) as FoundBook[];
  if (!all.length) return null;
  const base = { ...all[0] };
  for (const x of all.slice(1)) {
    base.pages ??= x.pages;
    base.author ??= x.author;
    if (!base.genres.length) base.genres = x.genres;
  }
  base.cover_url = await findBestCover({
    isbn,
    title: base.title,
    author: base.author,
    candidates: all.map((x) => x.cover_url)
  });
  return base;
}

/* ---------------- Capas ---------------- */

export function isbn13to10(s: string): string | null {
  if (!/^978\d{10}$/.test(s)) return null;
  const core = s.slice(3, 12);
  const sum = core.split('').reduce((acc, d, i) => acc + Number(d) * (10 - i), 0);
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? 'X' : String(check));
}

export function isbn10to13(s: string): string | null {
  if (!/^\d{9}[\dX]$/.test(s)) return null;
  const core = '978' + s.slice(0, 9);
  const sum = core.split('').reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
  return core + String((10 - (sum % 10)) % 10);
}

/** Testa se a imagem carrega de verdade e não é um "pixel vazio" (Amazon devolve 1x1 quando não tem capa). */
function imageWorks(url: string, timeoutMs = 7000): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    const timer = setTimeout(() => {
      img.src = '';
      resolve(false);
    }, timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img.naturalWidth >= 40 && img.naturalHeight >= 40);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    img.src = url;
  });
}

/** Primeira URL da lista (em ordem de preferência) cuja imagem carrega. Testa todas em paralelo. */
async function firstWorking(urls: (string | null | undefined)[]): Promise<string | null> {
  const list = [...new Set(urls.filter(Boolean) as string[])];
  const ok = await Promise.all(list.map((u) => imageWorks(u)));
  return list[ok.indexOf(true)] ?? null;
}

/**
 * Procura uma capa que funcione, tentando em ordem:
 * 1. links devolvidos pelas APIs (BrasilAPI, Google, Open Library) — validados, porque às vezes vêm quebrados
 * 2. Open Library Covers direto pelo ISBN (13 e 10)
 * 3. Amazon pelo ISBN-10 (cobre muita edição brasileira)
 * 4. busca no Google Books por título + autor (pode ser outra edição, mas é melhor que nada)
 */
export async function findBestCover({
  isbn,
  title,
  author,
  candidates = []
}: {
  isbn?: string | null;
  title?: string | null;
  author?: string | null;
  candidates?: (string | null | undefined)[];
}): Promise<string | null> {
  const clean = isbn ? cleanIsbn(isbn) : '';
  const i13 = clean.length === 13 ? clean : clean.length === 10 ? isbn10to13(clean) : null;
  const i10 = clean.length === 10 ? clean : clean.length === 13 ? isbn13to10(clean) : null;

  const byIsbn: string[] = [];
  if (i13) byIsbn.push(`https://covers.openlibrary.org/b/isbn/${i13}-L.jpg?default=false`);
  if (i10) {
    byIsbn.push(`https://covers.openlibrary.org/b/isbn/${i10}-L.jpg?default=false`);
    byIsbn.push(`https://images-na.ssl-images-amazon.com/images/P/${i10}.01.LZZZZZZZ.jpg`);
  }

  const hit = await firstWorking([...candidates.map(https), ...byIsbn]);
  if (hit) return hit;

  if (title?.trim()) {
    const q = `intitle:${title}${author ? ` inauthor:${author.split(',')[0]}` : ''}`;
    const res = await searchBooks(q);
    return firstWorking(res.map((r) => r.cover_url).slice(0, 5));
  }
  return null;
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
