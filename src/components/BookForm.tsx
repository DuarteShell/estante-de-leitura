import { useMemo, useRef, useState, type FormEvent } from 'react';
import type { Book, BookStatus, Reading } from '../lib/types';
import { useLibrary } from '../store/library';
import { todayIso } from '../lib/util';
import { Icon } from './Icon';
import { ReadingFields, draftFrom, draftToReading, type ReadingDraft } from './ReadingForm';
import { ChipGroup, Cover, FORMAT_OPTIONS, STATUS_OPTIONS } from './ui';

const COMMON_GENRES = ['Romance', 'Fantasia', 'Ficção científica', 'Clássicos', 'Terror', 'Suspense', 'Mistério', 'Não ficção', 'Quadrinhos / mangá', 'Jovem adulto', 'Poesia', 'Biografia'];

export interface BookFormResult {
  book: Partial<Book> & { title: string };
  reading: Partial<Reading> | null;
}

export function BookForm({
  initial,
  mode,
  submitLabel,
  onSubmit
}: {
  initial?: Partial<Book>;
  mode: 'create' | 'edit';
  submitLabel: string;
  onSubmit: (r: BookFormResult) => Promise<void>;
}) {
  const { books, uploadCover } = useLibrary();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [author, setAuthor] = useState(initial?.author ?? '');
  const [pages, setPages] = useState(initial?.pages ? String(initial.pages) : '');
  const [isbn, setIsbn] = useState(initial?.isbn ?? '');
  const [cover, setCover] = useState(initial?.cover_url ?? '');
  const [genres, setGenres] = useState<string[]>(initial?.genres ?? []);
  const [genreText, setGenreText] = useState('');
  const [owned, setOwned] = useState(initial?.owned ?? true);
  const [status, setStatus] = useState<BookStatus>(initial?.status ?? 'nao_lido');
  const [registerReading, setRegisterReading] = useState(true);
  const [draft, setDraft] = useState<ReadingDraft>(() => draftFrom());
  const [lendoFormat, setLendoFormat] = useState<Reading['format']>(null);
  const [currentPage, setCurrentPage] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const genreSuggestions = useMemo(() => {
    const used = new Map<string, number>();
    books.forEach((b) => b.genres.forEach((g) => used.set(g, (used.get(g) ?? 0) + 1)));
    const mine = [...used.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
    return [...new Set([...mine, ...COMMON_GENRES])].filter((g) => !genres.includes(g)).slice(0, 12);
  }, [books, genres]);

  const addGenre = (g: string) => {
    const v = g.trim();
    if (v && !genres.includes(v)) setGenres([...genres, v]);
    setGenreText('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    const pendingGenre = genreText.trim();
    const book: BookFormResult['book'] = {
      title: title.trim(),
      author: author.trim() || null,
      pages: pages ? Number(pages) : null,
      isbn: isbn.trim() || null,
      cover_url: cover.trim() || null,
      genres: pendingGenre && !genres.includes(pendingGenre) ? [...genres, pendingGenre] : genres,
      owned: status === 'desejo' ? false : owned
    };
    let reading: Partial<Reading> | null = null;
    if (mode === 'create') {
      book.status = status;
      if (status === 'lendo') {
        reading = { status: 'lendo', started_at: todayIso(), format: lendoFormat };
        book.current_page = currentPage ? Number(currentPage) : 0;
      } else if (status === 'lido' && registerReading) {
        reading = draftToReading({ ...draft, status: 'lido' });
      } else if (status === 'abandonado') {
        reading = draftToReading({ ...draft, status: 'abandonado' });
      }
    }
    try {
      await onSubmit({ book, reading });
    } catch {
      setBusy(false);
    }
  };

  return (
    <form className="stack lg" onSubmit={submit}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div className="stack" style={{ gap: 8, alignItems: 'center' }}>
          <Cover book={{ title: title || 'Sem título', cover_url: cover || null }} width={92} />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setUploading(true);
              try {
                setCover(await uploadCover(f));
              } finally {
                setUploading(false);
                e.target.value = '';
              }
            }}
          />
          <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Icon name="camera" size={16} /> {uploading ? 'Enviando…' : 'Foto'}
          </button>
        </div>
        <div className="stack grow">
          <label className="field">
            <span>Título *</span>
            <input className="input" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span>Autor(a)</span>
            <input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="grid grid-2">
        <label className="field">
          <span>Páginas</span>
          <input className="input" type="number" inputMode="numeric" min={1} value={pages} onChange={(e) => setPages(e.target.value)} />
        </label>
        <label className="field">
          <span>ISBN</span>
          <input className="input" inputMode="numeric" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
        </label>
      </div>

      <label className="field">
        <span>Link da capa (opcional)</span>
        <input className="input" type="url" placeholder="https://…" value={cover.startsWith('data:') ? '' : cover} onChange={(e) => setCover(e.target.value)} />
      </label>

      <div className="field">
        <span>Gêneros</span>
        <div className="chips">
          {genres.map((g) => (
            <button type="button" key={g} className="chip on" onClick={() => setGenres(genres.filter((x) => x !== g))} aria-label={`Remover ${g}`}>
              {g} <Icon name="close" size={14} />
            </button>
          ))}
        </div>
        <input
          className="input"
          placeholder="Digite e aperte Enter"
          value={genreText}
          onChange={(e) => setGenreText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addGenre(genreText);
            }
          }}
        />
        <div className="chips">
          {genreSuggestions.map((g) => (
            <button type="button" key={g} className="chip btn-sm" style={{ minHeight: 34, fontSize: 13 }} onClick={() => addGenre(g)}>
              + {g}
            </button>
          ))}
        </div>
      </div>

      {mode === 'create' && (
        <div className="field">
          <span>Status</span>
          <ChipGroup soft label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </div>
      )}

      {status !== 'desejo' && (
        <label className="row" style={{ gap: 10, fontWeight: 700 }}>
          <input type="checkbox" checked={owned} onChange={(e) => setOwned(e.target.checked)} style={{ width: 20, height: 20 }} />
          Está na minha estante (tenho o livro)
        </label>
      )}

      {mode === 'create' && status === 'lendo' && (
        <div className="card flat stack">
          <div className="field">
            <span>Formato</span>
            <ChipGroup soft value={lendoFormat ?? ('' as never)} onChange={setLendoFormat} options={FORMAT_OPTIONS} />
          </div>
          <label className="field">
            <span>Página atual</span>
            <input className="input" type="number" inputMode="numeric" min={0} value={currentPage} onChange={(e) => setCurrentPage(e.target.value)} />
          </label>
        </div>
      )}

      {mode === 'create' && status === 'lido' && (
        <div className="card flat stack lg">
          <div className="seg" role="group" aria-label="Detalhes da leitura">
            <button type="button" className={registerReading ? 'on' : ''} onClick={() => setRegisterReading(true)}>
              Registrar leitura
            </button>
            <button type="button" className={!registerReading ? 'on' : ''} onClick={() => setRegisterReading(false)}>
              Só marcar como lido
            </button>
          </div>
          {registerReading ? (
            <ReadingFields value={{ ...draft, status: 'lido' }} onChange={setDraft} allowStatus={false} />
          ) : (
            <p className="small muted" style={{ margin: 0 }}>
              Perfeito pra leituras antigas: o livro conta como lido na estante, mas fica fora das estatísticas por ano. Dá pra registrar os detalhes depois.
            </p>
          )}
        </div>
      )}

      {mode === 'create' && status === 'abandonado' && (
        <div className="card flat">
          <ReadingFields value={{ ...draft, status: 'abandonado' }} onChange={setDraft} allowStatus={false} />
        </div>
      )}

      <button className="btn btn-primary btn-block" disabled={busy || !title.trim()} style={{ minHeight: 54 }}>
        <Icon name="shelf" size={20} />
        {busy ? 'Salvando…' : submitLabel}
      </button>
    </form>
  );
}
