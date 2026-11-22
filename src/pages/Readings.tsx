import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Vine } from '../components/Decor';
import { ChipGroup, Cover, Empty, FormatPill, Fav, Stars } from '../components/ui';
import { availableYears, legacyBooks, yearStats } from '../lib/stats';
import type { ReadingFormat } from '../lib/types';
import { fmtDate, fmtNum, fmtRating, readingYear } from '../lib/util';
import { useLibrary } from '../store/library';

type Fmt = 'todos' | ReadingFormat;

export default function Readings() {
  const { books, readings, base } = useLibrary();
  const [params, setParams] = useSearchParams();
  const years = useMemo(() => availableYears(readings), [readings]);
  const isLegacy = params.get('ano') === 'legado';
  const year = Number(params.get('ano')) || years[0];
  const fmt = (params.get('formato') as Fmt) || 'todos';
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    p.set(k, v);
    setParams(p, { replace: true });
  };

  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const s = useMemo(() => yearStats(year, books, readings), [year, books, readings]);
  const legacy = useMemo(() => legacyBooks(books, readings).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')), [books, readings]);
  const legacyPages = legacy.reduce((n, b) => n + (b.pages ?? 0), 0);
  // nota/favorito guardados numa leitura sem data
  const legacyRating = useMemo(() => {
    const m = new Map<string, { rating: number | null; favorite: boolean }>();
    const ids = new Set(legacy.map((b) => b.id));
    for (const r of readings)
      if (r.status === 'lido' && ids.has(r.book_id)) {
        const cur = m.get(r.book_id);
        m.set(r.book_id, { rating: cur?.rating ?? r.rating, favorite: !!cur?.favorite || !!r.favorite });
      }
    return m;
  }, [legacy, readings]);

  const list = readings
    .filter((r) => readingYear(r) === year && (fmt === 'todos' || r.format === fmt))
    .map((r) => ({ r, b: byId.get(r.book_id)! }))
    .filter((x) => x.b)
    .sort((a, b) => {
      const order = (s: string) => (s === 'lendo' ? 0 : 1);
      if (order(a.r.status) !== order(b.r.status)) return order(a.r.status) - order(b.r.status);
      return (b.r.finished_at ?? b.r.started_at ?? '').localeCompare(a.r.finished_at ?? a.r.started_at ?? '');
    });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Minhas leituras</h1>
          <p className="sub" style={{ margin: 0 }}>
            Tudo o que foi lido, ano a ano
          </p>
        </div>
        <Vine style={{ position: 'absolute', right: -18, top: -36 }} />
      </header>

      <ChipGroup
        scroll
        label="Ano"
        value={isLegacy ? 'legado' : String(year)}
        onChange={(v) => set('ano', v)}
        options={[...years.map((y) => ({ value: String(y), label: String(y) })), ...(legacy.length ? [{ value: 'legado', label: 'Legado' }] : [])]}
      />

      {isLegacy ? (
        <>
          <div className="card tan row" style={{ justifyContent: 'space-around', padding: '14px 10px' }}>
            {[
              [String(legacy.length), legacy.length === 1 ? 'livro' : 'livros'],
              [fmtNum(legacyPages), 'páginas']
            ].map(([v, l], i) => (
              <div key={i} className="row" style={{ gap: 0 }}>
                {i > 0 && (
                  <span
                    style={{
                      width: 1,
                      alignSelf: 'stretch',
                      background: 'var(--line-2)',
                      marginRight: 18
                    }}
                  />
                )}
                <div className="stack" style={{ gap: 0, alignItems: 'center' }}>
                  <span className="serif" style={{ fontSize: 22, fontWeight: 600 }}>
                    {v}
                  </span>
                  <span className="tiny muted">{l}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            Livros lidos antes de {years[years.length - 1]}, sem data registrada.
          </p>
          {legacy.length === 0 ? (
            <Empty>Nenhuma leitura legado.</Empty>
          ) : (
            <div className="book-list">
              {legacy.map((b) => (
                <Link key={b.id} to={`${base}/livro/${b.id}`} className="book-row" style={{ alignItems: 'flex-start' }}>
                  <Cover book={b} width={62} />
                  <div className="stack grow" style={{ gap: 5 }}>
                    <span className="t">{b.title}</span>
                    <span className="small muted">{b.author ?? 'Autor desconhecido'}</span>
                    {(legacyRating.get(b.id)?.rating != null || legacyRating.get(b.id)?.favorite) && (
                      <span className="row" style={{ gap: 6 }}>
                        {legacyRating.get(b.id)?.rating != null && <Stars value={legacyRating.get(b.id)!.rating!} showNumber />}
                        {legacyRating.get(b.id)?.favorite && <Fav />}
                      </span>
                    )}
                    {(b.owned || b.genres.length > 0) && (
                      <div className="row wrap" style={{ gap: 6 }}>
                        {b.owned && <FormatPill format="fisico" />}
                        {b.genres.slice(0, 2).map((g) => (
                          <span key={g} className="pill">
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="card tan row" style={{ justifyContent: 'space-around', padding: '14px 10px' }}>
            {[
              [String(s.books), 'livros'],
              [fmtNum(s.pages), 'páginas'],
              [s.avgRating == null ? '—' : fmtRating(Math.round(s.avgRating * 10) / 10), 'nota média']
            ].map(([v, l], i) => (
              <div key={l} className="row" style={{ gap: 0 }}>
                {i > 0 && (
                  <span
                    style={{
                      width: 1,
                      alignSelf: 'stretch',
                      background: 'var(--line-2)',
                      marginRight: 18
                    }}
                  />
                )}
                <div className="stack" style={{ gap: 0, alignItems: 'center' }}>
                  <span className="serif" style={{ fontSize: 22, fontWeight: 600 }}>
                    {v}
                  </span>
                  <span className="tiny muted">{l}</span>
                </div>
              </div>
            ))}
          </div>

          <ChipGroup
            soft
            label="Formato"
            value={fmt}
            onChange={(v) => set('formato', v)}
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'fisico', label: 'Físico' },
              { value: 'kindle', label: 'Kindle' },
              { value: 'audiobook', label: 'Audiobook' }
            ]}
          />

          {list.length === 0 ? (
            <Empty>
              Nenhuma leitura {fmt !== 'todos' ? 'nesse formato ' : ''}em {year}.
            </Empty>
          ) : (
            <div className="book-list">
              {list.map(({ r, b }) => (
                <Link key={r.id} to={`${base}/livro/${b.id}`} className="book-row" style={{ alignItems: 'flex-start' }}>
                  <Cover book={b} width={62} />
                  <div className="stack grow" style={{ gap: 5 }}>
                    <span className="t">{b.title}</span>
                    <span className="small muted">{b.author ?? 'Autor desconhecido'}</span>
                    {(r.rating != null || r.favorite) && (
                      <span className="row" style={{ gap: 6 }}>
                        {r.rating != null && <Stars value={r.rating} showNumber />}
                        {r.favorite && <Fav />}
                      </span>
                    )}
                    <div className="row wrap" style={{ gap: 6 }}>
                      <FormatPill format={r.format} />
                      {b.genres.slice(0, 2).map((g) => (
                        <span key={g} className="pill">
                          {g}
                        </span>
                      ))}
                      {r.status === 'abandonado' && <span className="pill red">Abandonado</span>}
                      {r.status === 'lendo' && <span className="pill gold">Lendo</span>}
                    </div>
                    <span className="tiny" style={{ color: 'var(--bark)' }}>
                      {r.status === 'lendo'
                        ? `Começou em ${fmtDate(r.started_at) || '—'}`
                        : r.status === 'abandonado'
                          ? `Parou${r.pages_read ? ` na p. ${r.pages_read}` : ''}${r.finished_at ? ` · ${fmtDate(r.finished_at)}` : ''}`
                          : r.finished_at
                            ? `Terminado em ${fmtDate(r.finished_at)}`
                            : `Lido em ${readingYear(r)}`}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
