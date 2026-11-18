import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { backend, type PublicShelf } from '../lib/backend';
import type { Book, BookStatus, LibraryData, Profile, Quote, Reading } from '../lib/types';
import { nameCase, normalizeBookNames, nowIso, titleCase, todayIso, uid } from '../lib/util';

type NewBook = Partial<Book> & { title: string };
type NewReading = Partial<Reading>;

export type ViewStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

interface Ctx extends LibraryData {
  /** sessão */
  authReady: boolean;
  userId: string | null;
  me: Profile | null;
  myBase: string | null;
  /** estante sendo vista (a própria ou de outra pessoa) */
  viewing: string | null;
  status: ViewStatus;
  error: string | null;
  base: string;
  view: (username: string) => void;
  mode: 'supabase' | 'local';
  canEdit: boolean;
  toast: string | null;
  notify: (msg: string) => void;
  reload: () => Promise<void>;
  usernameAvailable: (u: string) => Promise<boolean>;
  signUp: (username: string, displayName: string, pin: string) => Promise<void>;
  signIn: (username: string, pin: string) => Promise<void>;
  changePin: (pin: string) => Promise<void>;
  listPublic: () => Promise<PublicShelf[]>;
  signOut: () => Promise<void>;
  saveProfile: (p: Partial<Profile>) => Promise<void>;
  addBook: (b: NewBook, reading?: NewReading | null) => Promise<string>;
  updateBook: (id: string, patch: Partial<Book>) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  /** ordem manual da estante (todos os ids, na ordem) */
  reorderBooks: (ids: string[]) => Promise<void>;
  setStatus: (id: string, status: BookStatus) => Promise<void>;
  addReading: (bookId: string, r: NewReading) => Promise<void>;
  updateReading: (id: string, patch: Partial<Reading>) => Promise<void>;
  deleteReading: (id: string) => Promise<void>;
  startReading: (bookId: string, format: Reading['format']) => Promise<void>;
  finishReading: (bookId: string, data: NewReading) => Promise<void>;
  addQuote: (bookId: string, text: string, page: number | null) => Promise<void>;
  deleteQuote: (id: string) => Promise<void>;
  importBatch: (books: Book[], readings: Reading[], quotes?: Quote[]) => Promise<void>;
  uploadCover: (file: File) => Promise<string>;
  displayName: string;
  siteTitle: string;
}

const LibraryContext = createContext<Ctx | null>(null);

/**
 * Cópia local da própria estante: quando o celular descarta o app em segundo plano,
 * ao voltar a estante aparece na hora e é atualizada em silêncio.
 */
const CACHE_PREFIX = 'estante:cache:v1:';
function readCache(username: string): LibraryData | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + username);
    return raw ? (JSON.parse(raw) as LibraryData) : null;
  } catch {
    return null;
  }
}
function writeCache(username: string, data: LibraryData) {
  try {
    localStorage.setItem(CACHE_PREFIX + username, JSON.stringify(data));
  } catch {
    /* sem espaço ou armazenamento bloqueado: segue sem cache */
  }
}
function clearCache() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export const makeBook = (b: NewBook): Book => ({
  id: uid(),
  isbn: null,
  cover_url: null,
  genres: [],
  pages: null,
  status: 'nao_lido',
  owned: true,
  current_page: null,
  notes: null,
  created_at: nowIso(),
  ...b,
  title: titleCase(b.title),
  author: b.author ? nameCase(b.author) || null : null
});

export const makeReading = (bookId: string, r: NewReading): Reading => ({
  id: uid(),
  book_id: bookId,
  status: 'lido',
  started_at: null,
  finished_at: null,
  year: null,
  rating: null,
  format: null,
  pages_read: null,
  review: null,
  created_at: nowIso(),
  ...r
});

export function LibraryProvider({ children }: { children: ReactNode }) {
  const empty: LibraryData = { profile: null, books: [], readings: [], quotes: [] };
  const [data, setData] = useState<LibraryData>(empty);
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [status, setStatus] = useState<ViewStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>();
  const dataRef = useRef(data);
  dataRef.current = data;
  const viewingRef = useRef(viewing);
  viewingRef.current = viewing;
  const statusRef = useRef(status);
  statusRef.current = status;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const loadSeq = useRef(0);
  /** conta alterações locais, para uma recarga silenciosa não sobrescrever uma edição feita no meio */
  const editSeq = useRef(0);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const [id, profile] = await Promise.all([backend.currentUserId(), backend.myProfile()]);
      setUserId(id);
      setMe(profile);
    } catch {
      setUserId(null);
      setMe(null);
    } finally {
      setAuthReady(true);
    }
  }, []);

  /** silent: mantém a estante na tela enquanto busca a versão atualizada */
  const load = useCallback(async (username: string, silent = false) => {
    const seq = ++loadSeq.current;
    const edits = editSeq.current;
    if (!silent) {
      setStatus('loading');
      setError(null);
    }
    try {
      const lib = await backend.loadLibrary(username);
      if (seq !== loadSeq.current) return;
      if (silent && edits !== editSeq.current) {
        // houve edição durante a busca: busca de novo para não perder o que acabou de mudar
        void load(username, true);
        return;
      }
      if (!lib) {
        setData(empty);
        setStatus('missing');
      } else {
        setData(lib);
        setStatus('ready');
      }
    } catch (e) {
      if (seq !== loadSeq.current) return;
      if (silent) return; // sem rede ao voltar: continua mostrando o que já está na tela
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
      setStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const view = useCallback(
    (username: string) => {
      const u = username.toLowerCase();
      if (u === viewingRef.current) return;
      viewingRef.current = u;
      setViewing(u);
      const cached = readCache(u);
      if (cached?.profile && cached.profile.id === userIdRef.current) {
        setData(cached);
        setError(null);
        setStatus('ready');
        load(u, true);
      } else {
        load(u);
      }
    },
    [load]
  );

  const reload = useCallback(async () => {
    await refreshAuth();
    if (viewingRef.current) await load(viewingRef.current, statusRef.current === 'ready');
  }, [refreshAuth, load]);

  useEffect(() => {
    refreshAuth();
    return backend.onAuthChange(() => {
      reload();
    });
  }, [refreshAuth, reload]);

  const canEdit = !!userId && status === 'ready' && data.profile?.id === userId;

  const patchState = (fn: (d: LibraryData) => LibraryData) => {
    editSeq.current++;
    setData((d) => fn(d));
  };

  // mantém a cópia local da própria estante em dia
  useEffect(() => {
    if (!canEdit || !data.profile) return;
    const t = window.setTimeout(() => writeCache(data.profile!.username.toLowerCase(), data), 400);
    return () => window.clearTimeout(t);
  }, [canEdit, data]);

  /**
   * Padroniza maiúsculas de títulos e autores já cadastrados (antes da regra existir).
   * Roda uma vez por carga da própria estante e só toca nos livros que mudam.
   */
  const normalizedFor = useRef<string | null>(null);
  useEffect(() => {
    const pid = data.profile?.id;
    if (!canEdit || !pid || normalizedFor.current === pid) return;
    normalizedFor.current = pid;
    const fixes = data.books.map((b) => ({ id: b.id, patch: normalizeBookNames(b) })).filter((f): f is { id: string; patch: Pick<Book, 'title' | 'author'> } => !!f.patch);
    if (!fixes.length) return;
    (async () => {
      const done = new Map<string, Pick<Book, 'title' | 'author'>>();
      for (let i = 0; i < fixes.length; i += 10) {
        const chunk = fixes.slice(i, i + 10);
        const res = await Promise.allSettled(chunk.map((f) => backend.updateBook(f.id, f.patch)));
        res.forEach((r, k) => r.status === 'fulfilled' && done.set(chunk[k].id, chunk[k].patch));
      }
      if (done.size) patchState((d) => ({ ...d, books: d.books.map((b) => (done.has(b.id) ? { ...b, ...done.get(b.id) } : b)) }));
    })();
  }, [canEdit, data.profile?.id, data.books]);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (e) {
        notify(e instanceof Error ? e.message : 'Algo deu errado');
        throw e;
      }
    },
    [notify]
  );

  const updateBook = useCallback(
    (id: string, patch: Partial<Book>) =>
      run(async () => {
        if (patch.title != null) patch = { ...patch, title: titleCase(patch.title) };
        if (patch.author) patch = { ...patch, author: nameCase(patch.author) || null };
        await backend.updateBook(id, patch);
        patchState((d) => ({ ...d, books: d.books.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
      }),
    [run]
  );

  /** status do livro acompanha a leitura mais recente */
  const syncStatus = useCallback(
    async (bookId: string, readings: Reading[]) => {
      const book = dataRef.current.books.find((b) => b.id === bookId);
      if (!book) return;
      const mine = readings.filter((r) => r.book_id === bookId);
      if (!mine.length) return;
      let status: BookStatus;
      if (mine.some((r) => r.status === 'lendo')) status = 'lendo';
      else {
        const key = (r: Reading) => r.finished_at ?? r.started_at ?? (r.year ? `${r.year}-12-31` : '') + r.created_at;
        const latest = [...mine].sort((a, b) => key(b).localeCompare(key(a)))[0];
        status = latest.status;
      }
      const patch: Partial<Book> = { status };
      if (status === 'lido') patch.current_page = null;
      if (status !== book.status || (status === 'lido' && book.current_page != null)) await updateBook(bookId, patch);
    },
    [updateBook]
  );

  const api = useMemo<
    Omit<Ctx, keyof LibraryData | 'authReady' | 'me' | 'myBase' | 'viewing' | 'status' | 'base' | 'view' | 'error' | 'canEdit' | 'userId' | 'toast' | 'displayName' | 'siteTitle'>
  >(
    () => ({
      mode: backend.mode,
      notify,
      reload,
      usernameAvailable: (u) => backend.usernameAvailable(u),
      listPublic: () => backend.listPublic(),
      signUp: async (username, displayName, pin) => {
        await backend.signUp(username, displayName, pin);
        await refreshAuth();
      },
      signIn: async (username, pin) => {
        await backend.signIn(username, pin);
        await refreshAuth();
      },
      changePin: (pin) => run(() => backend.changePin(pin)),
      signOut: () =>
        run(async () => {
          await backend.signOut();
          clearCache();
          await reload();
        }),
      saveProfile: (p) =>
        run(async () => {
          const profile = await backend.saveProfile(p);
          setMe(profile);
          patchState((d) => (d.profile?.id === profile.id ? { ...d, profile } : d));
        }),
      addBook: (b, reading) =>
        run(async () => {
          const book = makeBook(b);
          await backend.insertBooks([book]);
          const readings: Reading[] = reading ? [makeReading(book.id, reading)] : [];
          if (readings.length) await backend.insertReadings(readings);
          patchState((d) => ({ ...d, books: [...d.books, book], readings: [...d.readings, ...readings] }));
          return book.id;
        }),
      updateBook,
      deleteBook: (id) =>
        run(async () => {
          await backend.deleteBook(id);
          patchState((d) => ({
            ...d,
            books: d.books.filter((b) => b.id !== id),
            readings: d.readings.filter((r) => r.book_id !== id),
            quotes: d.quotes.filter((q) => q.book_id !== id)
          }));
        }),
      reorderBooks: async (ids) => {
        // atualiza na tela na hora; se falhar, recarrega do servidor
        const pos = new Map(ids.map((id, i) => [id, i + 1]));
        patchState((d) => ({ ...d, books: d.books.map((b) => (pos.has(b.id) ? { ...b, shelf_position: pos.get(b.id)! } : b)) }));
        try {
          await run(() => backend.reorderBooks(ids));
        } catch {
          await reload();
        }
      },
      setStatus: (id, status) => updateBook(id, { status, ...(status === 'lido' ? { current_page: null } : {}) }),
      addReading: (bookId, r) =>
        run(async () => {
          const reading = makeReading(bookId, r);
          await backend.insertReadings([reading]);
          const readings = [...dataRef.current.readings, reading];
          patchState((d) => ({ ...d, readings: [...d.readings, reading] }));
          await syncStatus(bookId, readings);
        }),
      updateReading: (id, patch) =>
        run(async () => {
          await backend.updateReading(id, patch);
          const readings = dataRef.current.readings.map((r) => (r.id === id ? { ...r, ...patch } : r));
          patchState((d) => ({ ...d, readings }));
          const bookId = readings.find((r) => r.id === id)?.book_id;
          if (bookId) await syncStatus(bookId, readings);
        }),
      deleteReading: (id) =>
        run(async () => {
          await backend.deleteReading(id);
          patchState((d) => ({ ...d, readings: d.readings.filter((r) => r.id !== id) }));
        }),
      startReading: (bookId, format) =>
        run(async () => {
          const reading = makeReading(bookId, { status: 'lendo', started_at: todayIso(), format });
          await backend.insertReadings([reading]);
          patchState((d) => ({ ...d, readings: [...d.readings, reading] }));
          await updateBook(bookId, { status: 'lendo', current_page: 0 });
        }),
      finishReading: (bookId, r) =>
        run(async () => {
          const active = dataRef.current.readings.find((x) => x.book_id === bookId && x.status === 'lendo');
          const book = dataRef.current.books.find((b) => b.id === bookId);
          const status = r.status ?? 'lido';
          const patch: Partial<Reading> = {
            ...r,
            status,
            finished_at: r.finished_at ?? todayIso(),
            pages_read: r.pages_read ?? (status === 'lido' ? book?.pages ?? null : book?.current_page ?? null)
          };
          let readings: Reading[];
          if (active) {
            await backend.updateReading(active.id, patch);
            readings = dataRef.current.readings.map((x) => (x.id === active.id ? { ...x, ...patch } : x));
          } else {
            const reading = makeReading(bookId, patch);
            await backend.insertReadings([reading]);
            readings = [...dataRef.current.readings, reading];
          }
          patchState((d) => ({ ...d, readings }));
          await updateBook(bookId, { status, current_page: status === 'lido' ? null : book?.current_page ?? null });
        }),
      addQuote: (bookId, text, page) =>
        run(async () => {
          const q: Quote = { id: uid(), book_id: bookId, text, page, created_at: nowIso() };
          await backend.insertQuotes([q]);
          patchState((d) => ({ ...d, quotes: [...d.quotes, q] }));
        }),
      deleteQuote: (id) =>
        run(async () => {
          await backend.deleteQuote(id);
          patchState((d) => ({ ...d, quotes: d.quotes.filter((q) => q.id !== id) }));
        }),
      importBatch: (books, readings, quotes = []) =>
        run(async () => {
          if (books.length) await backend.insertBooks(books);
          if (readings.length) await backend.insertReadings(readings);
          if (quotes.length) await backend.insertQuotes(quotes);
          patchState((d) => ({
            ...d,
            books: [...d.books, ...books],
            readings: [...d.readings, ...readings],
            quotes: [...d.quotes, ...quotes]
          }));
        }),
      uploadCover: (file) => run(() => backend.uploadCover(file))
    }),
    [notify, reload, refreshAuth, run, updateBook, syncStatus]
  );

  const displayName = data.profile?.display_name || 'Leitor';
  const siteTitle = data.profile?.site_title || `Estante de ${displayName}`;

  useEffect(() => {
    document.title = siteTitle;
  }, [siteTitle]);

  const value: Ctx = {
    ...data,
    ...api,
    authReady,
    userId,
    me,
    myBase: me ? `/u/${me.username}` : null,
    viewing,
    status,
    error,
    base: `/u/${data.profile?.username ?? viewing ?? ''}`,
    view,
    canEdit,
    toast,
    displayName,
    siteTitle
  };
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary fora do LibraryProvider');
  return ctx;
}
