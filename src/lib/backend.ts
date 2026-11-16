import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Book, LibraryData, Profile, Quote, Reading } from './types';

export interface Backend {
  mode: 'supabase' | 'local';
  /** id do usuário logado (quem pode editar) ou null para visitantes */
  currentUserId(): Promise<string | null>;
  onAuthChange(cb: () => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  loadAll(): Promise<LibraryData>;
  saveProfile(p: Partial<Profile>): Promise<Profile>;
  insertBooks(rows: Book[]): Promise<void>;
  updateBook(id: string, patch: Partial<Book>): Promise<void>;
  deleteBook(id: string): Promise<void>;
  insertReadings(rows: Reading[]): Promise<void>;
  updateReading(id: string, patch: Partial<Reading>): Promise<void>;
  deleteReading(id: string): Promise<void>;
  insertQuotes(rows: Quote[]): Promise<void>;
  deleteQuote(id: string): Promise<void>;
  uploadCover(file: File): Promise<string>;
}

const strip = <T extends object>(row: T): T => {
  const copy = { ...row } as Record<string, unknown>;
  delete copy.user_id;
  return copy as T;
};

/* ------------------------------------------------------------------ */
/* Supabase                                                            */
/* ------------------------------------------------------------------ */

class SupabaseBackend implements Backend {
  mode = 'supabase' as const;
  constructor(private sb: SupabaseClient) {}

  private check<T>(res: { data: T; error: { message: string } | null }): T {
    if (res.error) throw new Error(res.error.message);
    return res.data;
  }

  async currentUserId() {
    const { data } = await this.sb.auth.getSession();
    return data.session?.user.id ?? null;
  }

  onAuthChange(cb: () => void) {
    const { data } = this.sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') cb();
    });
    return () => data.subscription.unsubscribe();
  }

  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos' : error.message);
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  async loadAll(): Promise<LibraryData> {
    // Logado: os próprios dados. Visitante: o perfil público (app de uma pessoa só).
    let ownerId = await this.currentUserId();
    if (!ownerId) {
      const first = this.check(await this.sb.from('profiles').select('id').order('updated_at').limit(1));
      ownerId = (first as { id: string }[])[0]?.id ?? null;
    }
    if (!ownerId) return { profile: null, books: [], readings: [], quotes: [] };
    const [p, b, r, q] = await Promise.all([
      this.sb.from('profiles').select('*').eq('id', ownerId).maybeSingle(),
      this.sb.from('books').select('*').eq('user_id', ownerId).order('created_at').limit(5000),
      this.sb.from('readings').select('*').eq('user_id', ownerId).limit(10000),
      this.sb.from('quotes').select('*').eq('user_id', ownerId).order('created_at').limit(10000)
    ]);
    return {
      profile: this.check(p) as Profile | null,
      books: this.check(b) as Book[],
      readings: (this.check(r) as Reading[]).map((x) => ({ ...x, rating: x.rating == null ? null : Number(x.rating) })),
      quotes: this.check(q) as Quote[]
    };
  }

  async saveProfile(patch: Partial<Profile>) {
    const id = await this.currentUserId();
    if (!id) throw new Error('Faça login para editar');
    return this.check(await this.sb.from('profiles').upsert({ ...patch, id }).select().single()) as Profile;
  }

  private async chunked<T>(rows: T[], fn: (part: T[]) => PromiseLike<{ error: { message: string } | null }>) {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await fn(rows.slice(i, i + 200));
      if (error) throw new Error(error.message);
    }
  }

  insertBooks(rows: Book[]) {
    return this.chunked(rows.map(strip), (part) => this.sb.from('books').insert(part));
  }
  async updateBook(id: string, patch: Partial<Book>) {
    this.check(await this.sb.from('books').update(strip(patch)).eq('id', id));
  }
  async deleteBook(id: string) {
    this.check(await this.sb.from('books').delete().eq('id', id));
  }
  insertReadings(rows: Reading[]) {
    return this.chunked(rows.map(strip), (part) => this.sb.from('readings').insert(part));
  }
  async updateReading(id: string, patch: Partial<Reading>) {
    this.check(await this.sb.from('readings').update(strip(patch)).eq('id', id));
  }
  async deleteReading(id: string) {
    this.check(await this.sb.from('readings').delete().eq('id', id));
  }
  insertQuotes(rows: Quote[]) {
    return this.chunked(rows.map(strip), (part) => this.sb.from('quotes').insert(part));
  }
  async deleteQuote(id: string) {
    this.check(await this.sb.from('quotes').delete().eq('id', id));
  }

  async uploadCover(file: File) {
    const uid = await this.currentUserId();
    if (!uid) throw new Error('Faça login para enviar capas');
    const blob = await shrinkImage(file, 600);
    const path = `${uid}/${crypto.randomUUID()}.jpg`;
    const { error } = await this.sb.storage.from('covers').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw new Error(error.message);
    return this.sb.storage.from('covers').getPublicUrl(path).data.publicUrl;
  }
}

/* ------------------------------------------------------------------ */
/* Modo local (sem Supabase): tudo no localStorage deste navegador     */
/* ------------------------------------------------------------------ */

const LOCAL_KEY = 'estante:v1';
const LOCAL_ID = 'local';

class LocalBackend implements Backend {
  mode = 'local' as const;

  private read(): LibraryData {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) return JSON.parse(raw) as LibraryData;
    } catch {
      /* armazenamento indisponível */
    }
    return {
      profile: { id: LOCAL_ID, display_name: 'Leitor', site_title: null, bio: null, annual_goal: 24 },
      books: [],
      readings: [],
      quotes: []
    };
  }
  private write(d: LibraryData) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(d));
    } catch {
      throw new Error('Não deu pra salvar no navegador (armazenamento cheio?)');
    }
  }
  private mutate(fn: (d: LibraryData) => void) {
    const d = this.read();
    fn(d);
    this.write(d);
    return Promise.resolve();
  }

  async currentUserId() {
    return LOCAL_ID;
  }
  onAuthChange() {
    return () => {};
  }
  async signIn() {}
  async signOut() {}
  async loadAll() {
    return this.read();
  }
  async saveProfile(patch: Partial<Profile>) {
    const d = this.read();
    d.profile = { ...(d.profile as Profile), ...patch, id: LOCAL_ID };
    this.write(d);
    return d.profile;
  }
  insertBooks(rows: Book[]) {
    return this.mutate((d) => d.books.push(...rows));
  }
  updateBook(id: string, patch: Partial<Book>) {
    return this.mutate((d) => {
      d.books = d.books.map((b) => (b.id === id ? { ...b, ...patch } : b));
    });
  }
  deleteBook(id: string) {
    return this.mutate((d) => {
      d.books = d.books.filter((b) => b.id !== id);
      d.readings = d.readings.filter((r) => r.book_id !== id);
      d.quotes = d.quotes.filter((q) => q.book_id !== id);
    });
  }
  insertReadings(rows: Reading[]) {
    return this.mutate((d) => d.readings.push(...rows));
  }
  updateReading(id: string, patch: Partial<Reading>) {
    return this.mutate((d) => {
      d.readings = d.readings.map((r) => (r.id === id ? { ...r, ...patch } : r));
    });
  }
  deleteReading(id: string) {
    return this.mutate((d) => {
      d.readings = d.readings.filter((r) => r.id !== id);
    });
  }
  insertQuotes(rows: Quote[]) {
    return this.mutate((d) => d.quotes.push(...rows));
  }
  deleteQuote(id: string) {
    return this.mutate((d) => {
      d.quotes = d.quotes.filter((q) => q.id !== id);
    });
  }
  async uploadCover(file: File) {
    const blob = await shrinkImage(file, 360);
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error('Não consegui ler a imagem'));
      fr.readAsDataURL(blob);
    });
  }
}

/** Reduz a foto da capa antes de salvar (fotos de celular são enormes). */
async function shrinkImage(file: File, maxW: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Imagem inválida'));
      i.src = url;
    });
    const scale = Math.min(1, maxW / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao converter imagem'))), 'image/jpeg', 0.85)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const backend: Backend =
  url && key ? new SupabaseBackend(createClient(url, key)) : new LocalBackend();
