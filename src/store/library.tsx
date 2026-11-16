import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { backend } from '../lib/backend';
import type { Book, BookStatus, LibraryData, Profile, Quote, Reading } from '../lib/types';
import { nowIso, todayIso, uid } from '../lib/util';

type NewBook = Partial<Book> & { title: string };
type NewReading = Partial<Reading>;

interface Ctx extends LibraryData {
  loading: boolean;
  error: string | null;
  mode: 'supabase' | 'local';
  canEdit: boolean;
  userId: string | null;
  toast: string | null;
  notify: (msg: string) => void;
  reload: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  saveProfile: (p: Partial<Profile>) => Promise<void>;
  addBook: (b: NewBook, reading?: NewReading | null) => Promise<string>;
  updateBook: (id: string, patch: Partial<Book>) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
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

export const makeBook = (b: NewBook): Book => ({
  id: uid(),
  author: null,
  isbn: null,
  cover_url: null,
  genres: [],
  pages: null,
  status: 'nao_lido',
  owned: true,
  current_page: null,
  notes: null,
  created_at: nowIso(),
  ...b
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
  const [data, setData] = useState<LibraryData>({ profile: null, books: [], readings: [], quotes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>();
  const dataRef = useRef(data);
  dataRef.current = data;

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const [id, all] = await Promise.all([backend.currentUserId(), backend.loadAll()]);
      setUserId(id);
      setData(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    return backend.onAuthChange(() => {
      setLoading(true);
      reload();
    });
  }, [reload]);

  const canEdit = !!userId && (backend.mode === 'local' || !data.profile || data.profile.id === userId);

  const patchState = (fn: (d: LibraryData) => LibraryData) => setData((d) => fn(d));

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

  const api = useMemo<Omit<Ctx, keyof LibraryData | 'loading' | 'error' | 'canEdit' | 'userId' | 'toast' | 'displayName' | 'siteTitle'>>(
    () => ({
      mode: backend.mode,
      notify,
      reload,
      signIn: (email, password) =>
        run(async () => {
          await backend.signIn(email, password);
          await reload();
        }),
      signOut: () =>
        run(async () => {
          await backend.signOut();
          await reload();
        }),
      saveProfile: (p) =>
        run(async () => {
          const profile = await backend.saveProfile(p);
          patchState((d) => ({ ...d, profile }));
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
    [notify, reload, run, updateBook, syncStatus]
  );

  const displayName = data.profile?.display_name || 'Leitor';
  const siteTitle = data.profile?.site_title || `Estante de ${displayName}`;

  useEffect(() => {
    document.title = siteTitle;
  }, [siteTitle]);

  const value: Ctx = { ...data, ...api, loading, error, canEdit, userId, toast, displayName, siteTitle };
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary fora do LibraryProvider');
  return ctx;
}
