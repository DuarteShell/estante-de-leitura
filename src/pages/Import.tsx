import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { ChipGroup, Empty } from '../components/ui';
import { isBackup, type Backup } from '../lib/exporters';
import {
  FIELD_LABEL,
  PRESETS,
  SOURCE_LABEL,
  guessMapping,
  mergeItems,
  normalizeFile,
  parseCsv,
  type Field,
  type ImportItem,
  type ParsedFile,
  type SourceId
} from '../lib/importers';
import { findBestCover, findCover } from '../lib/isbn';
import type { Book, BookStatus, Reading, ReadingFormat } from '../lib/types';
import { STATUS_LABEL } from '../lib/types';
import { bookKey, nowIso } from '../lib/util';
import { makeBook, makeReading, useLibrary } from '../store/library';

const FIELDS = Object.keys(FIELD_LABEL) as Field[];

export default function Import() {
  const lib = useLibrary();
  const { base } = lib;
  const nav = useNavigate();
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [undated, setUndated] = useState<'desejo' | 'nao_lido'>('desejo');
  const [defFormat, setDefFormat] = useState<ReadingFormat | 'nd'>('nd');
  const [ownedMode, setOwnedMode] = useState<'sim' | 'nao' | 'coluna'>('nao');
  const [fetchCovers, setFetchCovers] = useState(true);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [statusOverride, setStatusOverride] = useState<Record<string, BookStatus>>({});
  const [openMapping, setOpenMapping] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const existingKeys = useMemo(() => new Map(lib.books.map((b) => [bookKey(b.title, b.author), b])), [lib.books]);

  const items = useMemo<ImportItem[]>(() => {
    const all = files.flatMap((f) => normalizeFile(f, { undatedStatus: undated, defaultFormat: defFormat === 'nd' ? null : defFormat }));
    return mergeItems(all);
  }, [files, undated, defFormat]);

  const onFiles = async (list: FileList | null) => {
    if (!list) return;
    setError(null);
    const parsed: ParsedFile[] = [];
    for (const f of Array.from(list)) {
      const text = await f.text();
      if (f.name.toLowerCase().endsWith('.json')) {
        try {
          const data = JSON.parse(text);
          if (isBackup(data)) setBackup(data);
          else setError(`${f.name} não é um backup desta estante.`);
        } catch {
          setError(`Não consegui ler ${f.name}.`);
        }
        continue;
      }
      const p = parseCsv(f.name, text);
      if (!p.headers.length || !p.rows.length) setError(`${f.name} parece vazio.`);
      else parsed.push(p);
    }
    setFiles((cur) => [...cur, ...parsed]);
  };

  const updateFile = (name: string, patch: Partial<ParsedFile>) => setFiles((cur) => cur.map((f) => (f.name === name ? { ...f, ...patch } : f)));

  const setSource = (f: ParsedFile, source: SourceId) => {
    const mapping = source === 'goodreads' || source === 'storygraph' ? PRESETS[source] : guessMapping(f.headers);
    updateFile(f.name, { source, mapping });
  };

  const toImport = items.filter((it) => !excluded.has(it.key));
  const newCount = toImport.filter((it) => !existingKeys.has(it.key)).length;

  const runImport = async () => {
    setError(null);
    const books: Book[] = [];
    const readings: Reading[] = [];
    const existingReadingKeys = new Set(lib.readings.map((r) => [r.book_id, r.started_at, r.finished_at, r.year, r.status].join('|')));
    for (const it of toImport) {
      const status = statusOverride[it.key] ?? it.status;
      const existing = existingKeys.get(it.key);
      let bookId: string;
      if (existing) {
        bookId = existing.id;
      } else {
        const owned = status === 'desejo' ? false : ownedMode === 'sim' ? true : ownedMode === 'nao' ? false : it.owned ?? false;
        const b = makeBook({
          title: it.title,
          author: it.author,
          cover_url: it.cover_url,
          pages: it.pages,
          isbn: it.isbn,
          genres: it.genres,
          status,
          owned,
          current_page: status === 'lendo' ? it.current_page : null,
          created_at: nowIso()
        });
        books.push(b);
        bookId = b.id;
      }
      for (const r of it.readings) {
        if (status === 'desejo' || status === 'nao_lido') continue;
        // status trocado na prévia: leitura "lendo" acompanha (vira lida/abandonada)
        const fixed = r.status === 'lendo' && (status === 'lido' || status === 'abandonado') ? { ...r, status } : r;
        const rr = makeReading(bookId, fixed);
        const k = [bookId, rr.started_at, rr.finished_at, rr.year, rr.status].join('|');
        if (!existingReadingKeys.has(k)) readings.push(rr);
      }
    }

    if (fetchCovers) {
      const missing = books.filter((b) => !b.cover_url);
      let done = 0;
      const queue = [...missing];
      const worker = async () => {
        while (queue.length) {
          const b = queue.shift()!;
          b.cover_url = await findBestCover({ isbn: b.isbn, title: b.title, author: b.author });
          if (!b.genres.length || b.pages == null) {
            const found = await findCover(b.title, b.author);
            if (found) {
              if (!b.genres.length) b.genres = found.genres;
              b.pages ??= found.pages;
            }
          }
          done += 1;
          setProgress(`Buscando capas e gêneros… ${done}/${missing.length}`);
        }
      };
      await Promise.all([worker(), worker(), worker()]);
    }

    setProgress('Salvando na estante…');
    try {
      await lib.importBatch(books, readings);
      lib.notify(`${books.length} livros e ${readings.length} leituras importados`);
      nav(`${base}/estante`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao importar');
      setProgress(null);
    }
  };

  const restoreBackup = async () => {
    if (!backup) return;
    setProgress('Restaurando backup…');
    const haveBooks = new Set(lib.books.map((b) => b.id));
    const haveReadings = new Set(lib.readings.map((r) => r.id));
    const haveQuotes = new Set(lib.quotes.map((q) => q.id));
    const books = backup.books.filter((b) => !haveBooks.has(b.id));
    const okBooks = new Set([...haveBooks, ...books.map((b) => b.id)]);
    const readings = backup.readings.filter((r) => !haveReadings.has(r.id) && okBooks.has(r.book_id));
    const quotes = backup.quotes.filter((q) => !haveQuotes.has(q.id) && okBooks.has(q.book_id));
    try {
      await lib.importBatch(books, readings, quotes);
      if (backup.profile) {
        const { display_name, site_title, bio, annual_goal } = backup.profile;
        await lib.saveProfile({ display_name, site_title, bio, annual_goal });
      }
      lib.notify(`Backup restaurado: ${books.length} livros novos`);
      nav(base);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao restaurar');
      setProgress(null);
    }
  };

  if (!lib.canEdit) {
    return <Empty action={<Link className="btn btn-primary" to="/entrar">Entrar</Link>}>Entre para importar livros.</Empty>;
  }

  return (
    <div className="stack lg" style={{ maxWidth: 900 }}>
      <header className="row" style={{ gap: 12 }}>
        <button className="icon-btn" onClick={() => nav(-1)} aria-label="Voltar">
          <Icon name="back" size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: 28 }}>Importar</h1>
          <p className="small muted" style={{ margin: 0 }}>Notion, Goodreads, StoryGraph, qualquer CSV ou um backup .json</p>
        </div>
      </header>

      <label className="card stack" style={{ alignItems: 'center', textAlign: 'center', borderStyle: 'dashed', cursor: 'pointer' }}>
        <Icon name="upload" size={30} />
        <b>Escolher arquivos</b>
        <span className="small muted">Pode selecionar vários CSVs de uma vez (ex.: um por ano do Notion). Repetidos são juntados.</span>
        <input type="file" accept=".csv,.json,text/csv,application/json" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} />
      </label>

      <details className="card flat small">
        <summary style={{ fontWeight: 800, cursor: 'pointer' }}>Como exportar de cada lugar</summary>
        <ul style={{ margin: '10px 0 0', paddingLeft: 18, display: 'grid', gap: 6 }}>
          <li><b>Notion:</b> abra a base de leitura → ••• → Export → Markdown &amp; CSV. Use os arquivos .csv do zip.</li>
          <li><b>Goodreads:</b> My Books → Import and export → Export Library.</li>
          <li><b>StoryGraph:</b> Manage Account → Export StoryGraph Library.</li>
          <li><b>Skoob, Skeelo e outros:</b> não têm exportação oficial — copie sua lista para uma planilha (Google Sheets/Excel), baixe como .csv e ajuste as colunas aqui.</li>
        </ul>
      </details>

      {error && (
        <p className="small" role="alert" style={{ margin: 0, color: 'var(--danger)' }}>
          {error}
        </p>
      )}

      {backup && (
        <section className="card stack">
          <span className="eyebrow">Backup encontrado</span>
          <span>
            {backup.books.length} livros · {backup.readings.length} leituras · {backup.quotes.length} citações (de {new Date(backup.exported_at).toLocaleDateString('pt-BR')})
          </span>
          <button className="btn btn-primary" onClick={restoreBackup} disabled={!!progress}>
            Restaurar backup
          </button>
        </section>
      )}

      {files.map((f) => (
        <section key={f.name} className="card stack">
          <div className="row between wrap">
            <div className="stack" style={{ gap: 2 }}>
              <b style={{ wordBreak: 'break-all' }}>{f.name}</b>
              <span className="tiny muted">{f.rows.length} linhas · detectado: {SOURCE_LABEL[f.source]}</span>
            </div>
            <button className="btn btn-sm btn-danger" onClick={() => setFiles((cur) => cur.filter((x) => x.name !== f.name))}>
              Remover
            </button>
          </div>
          <ChipGroup
            soft
            label="Origem"
            value={f.source}
            onChange={(s) => setSource(f, s)}
            options={(Object.keys(SOURCE_LABEL) as SourceId[]).map((s) => ({ value: s, label: SOURCE_LABEL[s] }))}
          />
          <button className="btn btn-sm btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setOpenMapping(openMapping === f.name ? null : f.name)}>
            {openMapping === f.name ? 'Fechar colunas' : 'Ajustar colunas'}
          </button>
          {openMapping === f.name && (
            <div className="grid grid-2">
              {FIELDS.map((field) => (
                <label key={field} className="field">
                  <span>{FIELD_LABEL[field]}</span>
                  <select
                    className="select"
                    value={f.mapping[field] ?? ''}
                    onChange={(e) => updateFile(f.name, { mapping: { ...f.mapping, [field]: e.target.value || undefined } })}
                  >
                    <option value="">— não usar —</option>
                    {f.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
        </section>
      ))}

      {files.length > 0 && (
        <>
          <section className="card stack lg">
            <h2 style={{ fontSize: 19 }}>Opções</h2>
            <div className="field">
              <span>Livros sem data, nota nem progresso viram</span>
              <ChipGroup soft value={undated} onChange={setUndated} options={[{ value: 'desejo', label: 'Lista de desejos' }, { value: 'nao_lido', label: 'Não lidos' }]} />
            </div>
            <div className="field">
              <span>Formato quando a planilha não informa</span>
              <ChipGroup
                soft
                value={defFormat}
                onChange={setDefFormat}
                options={[
                  { value: 'nd', label: 'Não informado' },
                  { value: 'fisico', label: 'Físico' },
                  { value: 'kindle', label: 'Kindle' },
                  { value: 'audiobook', label: 'Audiobook' }
                ]}
              />
            </div>
            <div className="field">
              <span>Os livros importados estão na sua estante (você tem)?</span>
              <ChipGroup
                soft
                value={ownedMode}
                onChange={setOwnedMode}
                options={[
                  { value: 'nao', label: 'Não / não sei' },
                  { value: 'sim', label: 'Sim, todos' },
                  { value: 'coluna', label: 'Usar coluna da planilha' }
                ]}
              />
            </div>
            <label className="row small" style={{ gap: 8, fontWeight: 700 }}>
              <input type="checkbox" checked={fetchCovers} onChange={(e) => setFetchCovers(e.target.checked)} />
              Buscar capas e gêneros que faltam (Google Books)
            </label>
          </section>

          <section className="card stack">
            <div className="row between wrap">
              <h2 style={{ fontSize: 19 }}>Prévia</h2>
              <span className="small muted">
                {toImport.length} selecionados · {newCount} novos · {toImport.length - newCount} já na estante (só leituras novas)
              </span>
            </div>
            <div className="table-wrap">
              <table className="preview">
                <thead>
                  <tr>
                    <th aria-label="Importar" />
                    <th>Livro</th>
                    <th>Status</th>
                    <th>Leituras</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const off = excluded.has(it.key);
                    return (
                      <tr key={it.key} style={{ opacity: off ? 0.45 : 1 }}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Importar ${it.title}`}
                            checked={!off}
                            onChange={() => {
                              const n = new Set(excluded);
                              off ? n.delete(it.key) : n.add(it.key);
                              setExcluded(n);
                            }}
                          />
                        </td>
                        <td>
                          <b>{it.title}</b>
                          <div className="tiny muted">
                            {it.author ?? '—'}
                            {it.pages ? ` · ${it.pages}p` : ''}
                            {existingKeys.has(it.key) ? ' · já na estante' : ''}
                          </div>
                        </td>
                        <td>
                          <select
                            className="select"
                            style={{ minHeight: 34, padding: '4px 8px', fontSize: 13, width: 'auto' }}
                            value={statusOverride[it.key] ?? it.status}
                            onChange={(e) => setStatusOverride({ ...statusOverride, [it.key]: e.target.value as BookStatus })}
                          >
                            {(Object.keys(STATUS_LABEL) as BookStatus[]).map((s) => (
                              <option key={s} value={s}>
                                {STATUS_LABEL[s]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="tiny">
                          {it.readings.length
                            ? it.readings.map((r, i) => (
                                <div key={i}>
                                  {(r.finished_at ?? r.started_at ?? String(r.year ?? '')).slice(0, 4) || '?'}
                                  {r.rating != null ? ` · ★${String(r.rating).replace('.', ',')}` : ''}
                                  {r.status !== 'lido' ? ` · ${r.status}` : ''}
                                </div>
                              ))
                            : (statusOverride[it.key] ?? it.status) === 'lido'
                              ? 'sem registro'
                              : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button className="btn btn-primary" style={{ minHeight: 54 }} disabled={!toImport.length || !!progress} onClick={runImport}>
              <Icon name="shelf" size={20} /> {progress ?? `Importar ${toImport.length} livros`}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
