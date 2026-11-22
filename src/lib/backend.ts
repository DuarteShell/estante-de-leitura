import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Book, LibraryData, Profile, Quote, Reading } from './types';

export interface PublicShelf {
  username: string;
  display_name: string;
  site_title: string | null;
  bio: string | null;
}

export interface Backend {
  mode: 'supabase' | 'local';
  /** id do usuário logado ou null */
  currentUserId(): Promise<string | null>;
  myProfile(): Promise<Profile | null>;
  onAuthChange(cb: () => void): () => void;
  usernameAvailable(username: string): Promise<boolean>;
  signUp(username: string, displayName: string, pin: string): Promise<void>;
  signIn(username: string, pin: string): Promise<void>;
  changePin(pin: string): Promise<void>;
  signOut(): Promise<void>;
  /** estante de alguém pelo @ — null se não existe ou é privada */
  loadLibrary(username: string): Promise<LibraryData | null>;
  listPublic(): Promise<PublicShelf[]>;
  saveProfile(p: Partial<Profile>): Promise<Profile>;
  insertBooks(rows: Book[]): Promise<void>;
  updateBook(id: string, patch: Partial<Book>): Promise<void>;
  deleteBook(id: string): Promise<void>;
  /** grava a ordem manual: ids na ordem desejada */
  reorderBooks(ids: string[]): Promise<void>;
  insertReadings(rows: Reading[]): Promise<void>;
  updateReading(id: string, patch: Partial<Reading>): Promise<void>;
  deleteReading(id: string): Promise<void>;
  insertQuotes(rows: Quote[]): Promise<void>;
  deleteQuote(id: string): Promise<void>;
  uploadCover(file: File): Promise<string>;
}

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
export const PIN_RE = /^\d{6}$/;
/** O Supabase Auth exige e-mail: usamos um e-mail técnico derivado do @ (nenhum e-mail é enviado). */
const authEmail = (username: string) => `${username.toLowerCase()}@estante-de-leitura.app`;

const strip = <T extends object>(row: T): T => {
  const copy = { ...row } as Record<string, unknown>;
  delete copy.user_id;
  return copy as T;
};

function friendly(msg: string) {
  if (/(series|shelf_position|shelf_decor).*(column|schema cache)|column.*(series|shelf_position|shelf_decor)/i.test(msg))
    return 'Falta atualizar o banco: rode o supabase/schema.sql de novo no Supabase';
  if (/invalid login credentials/i.test(msg)) return '@usuário ou PIN incorretos';
  if (/already registered|already exists/i.test(msg)) return 'Esse @ já está em uso';
  if (/rate limit|too many/i.test(msg)) return 'Muitas tentativas. Espere alguns minutos e tente de novo';
  if (/signups not allowed/i.test(msg)) return 'Cadastros estão desativados no Supabase (veja o README)';
  if (/email not confirmed/i.test(msg)) return 'Desative "Confirm email" no Supabase (veja o README)';
  if (/password/i.test(msg) && /(weak|short|least)/i.test(msg)) return 'O PIN precisa ter 6 dígitos';
  return msg;
}

/* ------------------------------------------------------------------ */
/* Supabase                                                            */
/* ------------------------------------------------------------------ */

class SupabaseBackend implements Backend {
  mode = 'supabase' as const;
  constructor(private sb: SupabaseClient) {}

  private check<T>(res: { data: T; error: { message: string } | null }): T {
    if (res.error) throw new Error(friendly(res.error.message));
    return res.data;
  }

  async currentUserId() {
    const { data } = await this.sb.auth.getSession();
    return data.session?.user.id ?? null;
  }

  async myProfile() {
    const id = await this.currentUserId();
    if (!id) return null;
    return this.check(await this.sb.from('profiles').select('*').eq('id', id).maybeSingle()) as Profile | null;
  }

  onAuthChange(cb: () => void) {
    // O Supabase reemite SIGNED_IN sempre que a aba volta a ficar visível (revalida a sessão).
    // Só avisamos quando o usuário logado realmente muda — senão a estante recarregaria à toa.
    let lastUser: string | null | undefined;
    const { data } = this.sb.auth.onAuthStateChange((event, session) => {
      const id = session?.user.id ?? null;
      if (event === 'INITIAL_SESSION') {
        lastUser = id;
        return;
      }
      if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return;
      if (id === lastUser) return;
      lastUser = id;
      setTimeout(cb, 0);
    });
    return () => data.subscription.unsubscribe();
  }

  async usernameAvailable(username: string) {
    return this.check(await this.sb.rpc('username_available', { u: username })) as boolean;
  }

  async signUp(username: string, displayName: string, pin: string) {
    const { data, error } = await this.sb.auth.signUp({
      email: authEmail(username),
      password: pin,
      options: { data: { username: username.toLowerCase(), display_name: displayName } }
    });
    if (error) throw new Error(friendly(error.message));
    if (!data.session) throw new Error('Desative "Confirm email" no Supabase (veja o README)');
  }

  async signIn(username: string, pin: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email: authEmail(username), password: pin });
    if (error) throw new Error(friendly(error.message));
  }

  async changePin(pin: string) {
    const { error } = await this.sb.auth.updateUser({ password: pin });
    if (error) throw new Error(friendly(error.message));
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  async loadLibrary(username: string): Promise<LibraryData | null> {
    const profile = this.check(await this.sb.from('profiles').select('*').eq('username', username.toLowerCase()).maybeSingle()) as Profile | null;
    if (!profile) return null;
    const [b, r, q] = await Promise.all([
      this.sb.from('books').select('*').eq('user_id', profile.id).order('created_at').limit(5000),
      this.sb.from('readings').select('*').eq('user_id', profile.id).limit(10000),
      this.sb.from('quotes').select('*').eq('user_id', profile.id).order('created_at').limit(10000)
    ]);
    return {
      profile,
      books: (this.check(b) as Book[]).map((x) => ({ ...x, series_index: x.series_index == null ? null : Number(x.series_index) })),
      readings: (this.check(r) as Reading[]).map((x) => ({ ...x, rating: x.rating == null ? null : Number(x.rating) })),
      quotes: this.check(q) as Quote[]
    };
  }

  async listPublic() {
    return this.check(
      await this.sb.from('profiles').select('username, display_name, site_title, bio').eq('is_public', true).order('updated_at', { ascending: false }).limit(24)
    ) as PublicShelf[];
  }

  async saveProfile(patch: Partial<Profile>) {
    const id = await this.currentUserId();
    if (!id) throw new Error('Entre para editar');
    const { username: _ignored, id: _id, ...rest } = patch;
    return this.check(await this.sb.from('profiles').update(rest).eq('id', id).select().single()) as Profile;
  }

  private async chunked<T>(rows: T[], fn: (part: T[]) => PromiseLike<{ error: { message: string } | null }>) {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await fn(rows.slice(i, i + 200));
      if (error) throw new Error(friendly(error.message));
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
  async reorderBooks(ids: string[]) {
    const { error } = await this.sb.rpc('reorder_books', { ids });
    if (error) {
      if (/reorder_books|function|schema cache/i.test(error.message))
        throw new Error('Falta atualizar o banco: rode o supabase/schema.sql de novo no Supabase');
      throw new Error(friendly(error.message));
    }
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
    if (!uid) throw new Error('Entre para enviar capas');
    const blob = await shrinkImage(file, 600);
    const path = `${uid}/${crypto.randomUUID()}.jpg`;
    const { error } = await this.sb.storage.from('covers').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw new Error(error.message);
    return this.sb.storage.from('covers').getPublicUrl(path).data.publicUrl;
  }
}

/* ------------------------------------------------------------------ */
/* Modo local (sem Supabase): uma estante só, salva neste navegador    */
/* ------------------------------------------------------------------ */

const LOCAL_KEY = 'estante:v1';
const LOCAL_ID = 'local';
export const LOCAL_USERNAME = 'eu';

class LocalBackend implements Backend {
  mode = 'local' as const;

  private read(): LibraryData {
    const fresh: Profile = { id: LOCAL_ID, username: LOCAL_USERNAME, is_public: true, display_name: 'Leitor', site_title: null, bio: null, annual_goal: 24 };
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) {
        const d = JSON.parse(raw) as LibraryData;
        d.profile = { ...fresh, ...d.profile, id: LOCAL_ID, username: LOCAL_USERNAME };
        return d;
      }
    } catch {
      /* armazenamento indisponível */
    }
    return { profile: fresh, books: [], readings: [], quotes: [] };
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
  async myProfile() {
    return this.read().profile;
  }
  onAuthChange() {
    return () => {};
  }
  async usernameAvailable() {
    return true;
  }
  async signUp() {}
  async signIn() {}
  async changePin() {}
  async signOut() {}
  async loadLibrary(username: string) {
    return username === LOCAL_USERNAME ? this.read() : null;
  }
  async listPublic() {
    return [];
  }
  async saveProfile(patch: Partial<Profile>) {
    const d = this.read();
    d.profile = { ...(d.profile as Profile), ...patch, id: LOCAL_ID, username: LOCAL_USERNAME };
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
  reorderBooks(ids: string[]) {
    const pos = new Map(ids.map((id, i) => [id, i + 1]));
    return this.mutate((d) => {
      d.books = d.books.map((b) => (pos.has(b.id) ? { ...b, shelf_position: pos.get(b.id)! } : b));
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
// Chave pública: a nova "publishable" (sb_publishable_...) ou a antiga "anon"
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

export const backend: Backend = url && key ? new SupabaseBackend(createClient(url, key)) : new LocalBackend();
