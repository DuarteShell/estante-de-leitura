import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HangingPlant } from '../components/Decor';
import { Icon, type IconName } from '../components/Icon';
import { Cover, Empty } from '../components/ui';
import { availableYears, legacyBooks, shelfProgress, yearStats } from '../lib/stats';
import { FORMAT_SHORT } from '../lib/types';
import { fmtNum, fmtRating } from '../lib/util';
import { useLibrary } from '../store/library';

const GENRE_COLORS = ['#3F5A39', '#A3B18A', '#7A5235', '#E0C49C', '#5E7D8A', '#C4855E'];
const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function StatCard({ icon, value, label, bg, fg }: { icon: IconName; value: string; label: string; bg: string; fg: string }) {
  return (
    <div className="card stat">
      <div className="ico" style={{ background: bg, color: fg }}>
        <Icon name={icon} size={18} />
      </div>
      <span className="num">{value}</span>
      <span className="small muted">{label}</span>
    </div>
  );
}

export default function Home() {
  const { books, readings, profile, canEdit, displayName, siteTitle, base } = useLibrary();
  const years = useMemo(() => availableYears(readings), [readings]);
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const s = useMemo(() => yearStats(year, books, readings), [year, books, readings]);
  const reading = books.filter((b) => b.status === 'lendo');
  const legacy = useMemo(() => legacyBooks(books, readings), [books, readings]);
  const totals = {
    shelf: books.filter((b) => b.owned && b.status !== 'desejo').length,
    read: books.filter((b) => b.status === 'lido').length,
    wish: books.filter((b) => b.status === 'desejo').length
  };
  const shelfPct = useMemo(() => shelfProgress(books), [books]);
  const goal = profile?.annual_goal ?? null;
  const maxMonth = Math.max(1, ...s.months);
  const genreTotal = s.genres.reduce((a, g) => a + g.n, 0);
  const topGenres = s.genres.slice(0, 5);
  const dateLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="stack lg">
      <header className="page-head" style={{ minHeight: 120, alignItems: 'flex-start' }}>
        <div style={{ paddingRight: 110 }}>
          <span className="eyebrow">{dateLabel}</span>
          <h1 style={{ marginTop: 4 }}>{canEdit ? `${greeting()}, ${displayName}` : siteTitle}</h1>
          <p className="sub" style={{ margin: '4px 0 0' }}>
            {profile?.bio || (canEdit ? 'Seu recanto de leitura' : `O que ${displayName} anda lendo`)}
          </p>
        </div>
        <HangingPlant style={{ position: 'absolute', right: -6, top: -28 }} />
      </header>

      {books.length === 0 ? (
        <Empty
          action={
            canEdit && (
              <div className="row wrap" style={{ justifyContent: 'center' }}>
                <Link to={`${base}/adicionar`} className="btn btn-primary">
                  <Icon name="plus" /> Adicionar livro
                </Link>
                <Link to={`${base}/importar`} className="btn">
                  <Icon name="upload" /> Importar planilha
                </Link>
              </div>
            )
          }
        >
          {canEdit ? 'Sua estante ainda está vazia. Comece adicionando um livro ou importando do Notion, Goodreads…' : 'Nenhum livro por aqui ainda.'}
        </Empty>
      ) : (
        <>
          <div className="row between wrap">
            <h2>{canEdit ? 'Seu ano em livros' : 'O ano em livros'}</h2>
            <label className="row small" style={{ gap: 6 }}>
              <span className="muted">Ano</span>
              <select className="select" style={{ width: 'auto', minHeight: 40, padding: '6px 10px' }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {goal && year === thisYear ? (
            <div className="card stack" style={{ gap: 10 }}>
              <div className="row between">
                <span className="eyebrow">Meta de {year}</span>
                <span className="small" style={{ fontWeight: 800, color: 'var(--moss)' }}>{Math.min(100, Math.round((s.books / goal) * 100))}%</span>
              </div>
              <div className="serif" style={{ fontSize: 24, fontWeight: 600 }}>
                {s.books} <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink-2)' }}>de {goal} livros</span>
              </div>
              <div className="progress" style={{ height: 14 }}>
                <div style={{ width: `${Math.min(100, (s.books / goal) * 100)}%`, background: 'var(--moss)' }} />
              </div>
              <span className="small muted">{s.books >= goal ? 'Meta batida! 🌱' : `Faltam ${goal - s.books} livros`}</span>
            </div>
          ) : (
            canEdit &&
            year === thisYear && (
              <Link to={`${base}/perfil`} className="card flat row" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                <Icon name="flag" /> <span className="grow">Defina uma meta de leitura para {year}</span> <Icon name="back" size={18} className="flip" />
              </Link>
            )
          )}

          <div className="grid-stats">
            <StatCard icon="book" value={String(s.books)} label="livros lidos" bg="#E3E8D5" fg="#4F6B47" />
            <StatCard icon="pages" value={fmtNum(s.pages)} label={s.audiobooks ? `páginas (sem ${s.audiobooks} audiobook${s.audiobooks > 1 ? 's' : ''})` : 'páginas'} bg="#F1E4D3" fg="#7A5235" />
            <StatCard icon="leaf" value={s.avgRating == null ? '—' : fmtRating(Math.round(s.avgRating * 10) / 10)} label="nota média" bg="#F6E9C9" fg="#8A5F1A" />
            <StatCard icon="readings" value={String(reading.length)} label="lendo agora" bg="#E3E8D5" fg="#4F6B47" />
          </div>

          {shelfPct.total > 0 && (
            <div className="card stack" style={{ gap: 10 }}>
              <div className="row between">
                <span className="eyebrow">Estante lida</span>
                <span className="small" style={{ fontWeight: 800, color: 'var(--moss)' }}>{shelfPct.pct}%</span>
              </div>
              <div className="serif" style={{ fontSize: 24, fontWeight: 600 }}>
                {shelfPct.read} <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink-2)' }}>de {shelfPct.total} livros que você tem</span>
              </div>
              <div className="progress" style={{ height: 14 }}>
                <div style={{ width: `${shelfPct.pct}%`, background: 'var(--leaf)' }} />
              </div>
              <span className="small muted">
                {shelfPct.unread === 0
                  ? 'Nenhum livro esperando na estante. Pode comprar sem culpa! 🌱'
                  : `${shelfPct.unread} ${shelfPct.unread === 1 ? 'livro esperando' : 'livros esperando'} para ser lido${shelfPct.unread === 1 ? '' : 's'}${shelfPct.pct < 50 ? ' — talvez segurar as compras um pouquinho 😉' : ''}`}
              </span>
            </div>
          )}

          <p className="small muted" style={{ margin: 0 }}>
            Na estante: <b>{totals.shelf}</b> · Lidos no total: <b>{totals.read}</b>
            {legacy.length > 0 && <> ({legacy.length} sem registro)</>} · Desejos: <b>{totals.wish}</b>
          </p>

          <div className="home-grid">
            {reading.length > 0 && (
              <section className="stack span-2">
                <div className="row between">
                  <h2>Lendo agora</h2>
                  <Link to={`${base}/estante?f=lendo`} className="small" style={{ fontWeight: 700, textDecoration: 'none' }}>
                    ver todos
                  </Link>
                </div>
                <div className="book-list">
                  {reading.map((b) => {
                    const pct = b.pages && b.current_page ? Math.min(100, Math.round((b.current_page / b.pages) * 100)) : 0;
                    const active = readings.find((r) => r.book_id === b.id && r.status === 'lendo');
                    return (
                      <Link key={b.id} to={`${base}/livro/${b.id}`} className="book-row">
                        <Cover book={b} width={58} />
                        <div className="stack grow" style={{ gap: 5 }}>
                          <span className="t">{b.title}</span>
                          <span className="small muted">
                            {b.author ?? 'Autor desconhecido'}
                            {active?.format ? ` · ${FORMAT_SHORT[active.format]}` : ''}
                          </span>
                          <div className="progress" style={{ height: 8 }}>
                            <div style={{ width: `${pct}%` }} />
                          </div>
                          <span className="tiny" style={{ fontWeight: 700, color: 'var(--bark)' }}>
                            {b.pages ? `p. ${b.current_page ?? 0} de ${b.pages} · ${pct}%` : 'Sem total de páginas'}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="card stack">
              <h2 style={{ fontSize: 19 }}>Gêneros em {year}</h2>
              {topGenres.length ? (
                <>
                  <div className="stack-bar" role="img" aria-label={topGenres.map((g) => `${g.name} ${g.n}`).join(', ')}>
                    {topGenres.map((g, i) => (
                      <div key={g.name} style={{ flex: g.n, background: GENRE_COLORS[i] }} />
                    ))}
                  </div>
                  <div className="legend">
                    {topGenres.map((g, i) => (
                      <div key={g.name}>
                        <i style={{ background: GENRE_COLORS[i] }} />
                        <span className="grow">{g.name}</span>
                        <b style={{ color: 'var(--bark)' }}>{Math.round((g.n / genreTotal) * 100)}%</b>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="small muted" style={{ margin: 0 }}>Adicione gêneros aos livros pra ver esse gráfico.</p>
              )}
              <hr className="divider" />
              <span className="eyebrow">Como você leu</span>
              <div className="fmt-boxes">
                <div style={{ background: '#F1E4D3' }}>
                  <Icon name="book" size={20} />
                  <b>{s.formats.fisico}</b>
                  <span className="tiny muted">Físico</span>
                </div>
                <div style={{ background: '#E3E8D5' }}>
                  <Icon name="kindle" size={20} />
                  <b>{s.formats.kindle}</b>
                  <span className="tiny muted">Kindle</span>
                </div>
                <div style={{ background: '#E2EAEC' }}>
                  <Icon name="audio" size={20} />
                  <b>{s.formats.audiobook}</b>
                  <span className="tiny muted">Audiobook</span>
                </div>
              </div>
              {s.formats.nd > 0 && <span className="tiny muted">{s.formats.nd} sem formato informado</span>}
            </section>

            <section className="card stack">
              <h2 style={{ fontSize: 19 }}>Livros por mês</h2>
              <div className="bars" role="img" aria-label={`Livros terminados por mês em ${year}: ${s.months.join(', ')}`}>
                {s.months.map((n, i) => (
                  <div className="bar" key={i}>
                    {n > 0 && <span style={{ fontSize: 10 }}>{n}</span>}
                    <i className={n === 0 ? 'zero' : year === thisYear && i === new Date().getMonth() ? 'now' : ''} style={{ height: `${(n / maxMonth) * 72}px` }} />
                    <span>{MONTH_INITIALS[i]}</span>
                  </div>
                ))}
              </div>
            </section>

            {(s.best || s.topAuthors.length > 0 || s.longest) && (
              <section className="card stack span-2">
                <h2 style={{ fontSize: 19 }}>Destaques de {year}</h2>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  {s.best && (
                    <Link to={`${base}/livro/${s.best.book.id}`} className="row" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                      <Cover book={s.best.book} width={44} />
                      <div className="stack" style={{ gap: 2 }}>
                        <span className="eyebrow">Melhor nota</span>
                        <span className="serif" style={{ fontWeight: 600 }}>{s.best.book.title}</span>
                        <span className="tiny muted">{fmtRating(s.best.rating)} estrelas</span>
                      </div>
                    </Link>
                  )}
                  {s.longest && (
                    <Link to={`${base}/livro/${s.longest.id}`} className="row" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
                      <Cover book={s.longest} width={44} />
                      <div className="stack" style={{ gap: 2 }}>
                        <span className="eyebrow">Mais longo</span>
                        <span className="serif" style={{ fontWeight: 600 }}>{s.longest.title}</span>
                        <span className="tiny muted">{fmtNum(s.longest.pages ?? 0)} páginas</span>
                      </div>
                    </Link>
                  )}
                  {s.topAuthors.length > 0 && (
                    <div className="stack" style={{ gap: 4 }}>
                      <span className="eyebrow">Autores mais lidos</span>
                      {s.topAuthors.map((a) => (
                        <span key={a.name} className="small">
                          <b>{a.name}</b> · {a.n} livros
                        </span>
                      ))}
                    </div>
                  )}
                  {s.abandoned > 0 && (
                    <div className="stack" style={{ gap: 4 }}>
                      <span className="eyebrow">Abandonados</span>
                      <span className="small">{s.abandoned} {s.abandoned === 1 ? 'livro' : 'livros'} — tudo bem!</span>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
