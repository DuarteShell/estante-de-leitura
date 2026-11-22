import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { findBestCover } from '../lib/isbn';
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
  const [series, setSeries] = useState(initial?.series ?? '');
  const [seriesIndex, setSeriesIndex] = useState(initial?.series_index != null ? String(initial.series_index) : '');
  const [seriesTotal, setSeriesTotal] = useState(initial?.series_total != null ? String(initial.series_total) : '');
  const [status, setStatus] = useState<BookStatus>(initial?.status ?? 'nao_lido');
  const [registerReading, setRegisterReading] = useState(true);
  const [draft, setDraft] = useState<ReadingDraft>(() => draftFrom());
  const [lendoFormat, setLendoFormat] = useState<Reading['format']>(null);
  const [currentPage, setCurrentPage] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [coverSearch, setCoverSearch] = useState<'idle' | 'busy' | 'none'>('idle');

  const searchCover = async () => {
    if (!isbn.trim() && !title.trim()) return;
    setCoverSearch('busy');
    const url = await findBestCover({ isbn, title, author: author || null });
    if (url) {
      setCover(url);
      setCoverSearch('idle');
    } else setCoverSearch('none');
  };

  // Livro novo sem capa: tenta achar sozinho uma vez
  useEffect(() => {
    if (mode === 'create' && !initial?.cover_url && (initial?.isbn || initial?.title)) searchCover();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const genreSuggestions = useMemo(() => {
    const used = new Map<string, number>();
    books.forEach((b) => b.genres.forEach((g) => used.set(g, (used.get(g) ?? 0) + 1)));
    const mine = [...used.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
    return [...new Set([...mine, ...COMMON_GENRES])].filter((g) => !genres.includes(g)).slice(0, 12);
  }, [books, genres]);

  /** sagas já usadas na estante, com o total conhecido */
  const knownSeries = useMemo(() => {
    const m = new Map<string, number | null>();
    books.forEach((b) => {
      if (!b.series) return;
      const prev = m.get(b.series) ?? null;
      m.set(b.series, Math.max(prev ?? 0, b.series_total ?? 0) || prev);
    });
    return m;
  }, [books]);

  const pickSeries = (v: string) => {
    setSeries(v);
    const total = knownSeries.get(v.trim());
    if (total && !seriesTotal) setSeriesTotal(String(total));
  };

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
    // só manda os campos de saga se forem usados (ou se o livro já tinha saga e foi limpo)
    if (series.trim() || initial?.series) {
      const name = series.trim() || null;
      book.series = name;
      book.series_index = name && seriesIndex ? Number(seriesIndex.replace(',', '.')) : null;
      book.series_total = name && seriesTotal ? Number(seriesTotal) : null;
    }
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
          {!cover && (
            <button type="button" className="btn btn-sm" onClick={searchCover} disabled={coverSearch === 'busy' || (!isbn.trim() && !title.trim())}>
              {coverSearch === 'busy' ? 'Buscando…' : coverSearch === 'none' ? 'Sem capa :(' : 'Achar capa'}
            </button>
          )}
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
        <div className="row">
          <input
            className="input"
            style={{ flex: 1, minWidth: 0 }}
            placeholder="Digite um gênero"
            enterKeyHint="done"
            value={genreText}
            onChange={(e) => {
              // no teclado do celular o Enter/vírgula nem sempre chega no onKeyDown: a vírgula é tratada aqui
              const v = e.target.value;
              if (v.includes(',')) {
                const parts = v.split(',');
                const rest = parts.pop() ?? '';
                const add = parts.map((x) => x.trim()).filter((x) => x && !genres.includes(x));
                if (add.length) setGenres([...genres, ...new Set(add)]);
                setGenreText(rest.trimStart());
              } else setGenreText(v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addGenre(genreText);
              }
            }}
          />
          <button type="button" className="btn btn-sm" onClick={() => addGenre(genreText)} disabled={!genreText.trim()}>
            <Icon name="plus" size={16} /> Adicionar
          </button>
        </div>
        <div className="chips">
          {genreSuggestions.map((g) => (
            <button type="button" key={g} className="chip btn-sm" style={{ minHeight: 34, fontSize: 13 }} onClick={() => addGenre(g)}>
              + {g}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>Saga / série</span>
        <input className="input" list="series-list" placeholder="Ex.: Trono de Vidro (deixe vazio se for livro único)" value={series} onChange={(e) => pickSeries(e.target.value)} />
        <datalist id="series-list">
          {[...knownSeries.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
        {series.trim() && (
          <div className="grid grid-2">
            <label className="field">
              <span>Livro nº</span>
              <input className="input" inputMode="decimal" placeholder="2" value={seriesIndex} onChange={(e) => setSeriesIndex(e.target.value.replace(/[^0-9.,]/g, ''))} />
            </label>
            <label className="field">
              <span>Total da saga</span>
              <input className="input" type="number" inputMode="numeric" min={1} placeholder="5" value={seriesTotal} onChange={(e) => setSeriesTotal(e.target.value)} />
            </label>
          </div>
        )}
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
