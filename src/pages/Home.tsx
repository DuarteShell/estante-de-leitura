import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { HangingPlant } from '../components/Decor';
import { Icon, type IconName } from '../components/Icon';
import { Cover, Empty } from '../components/ui';
import { availableYears, legacyBooks, shelfInsights, shelfProgress, yearStats, type OpenSeries, type Suggestion, type VolumeState } from '../lib/stats';
import { FORMAT_SHORT } from '../lib/types';
import { fmtNum, fmtRating } from '../lib/util';
import { useLibrary } from '../store/library';

const GENRE_COLORS = ['#3F5A39', '#A3B18A', '#7A5235', '#E0C49C', '#5E7D8A', '#C4855E'];
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function duration(months: number) {
  if (months < 12) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  const y = Math.round((months / 12) * 2) / 2;
  return `${String(y).replace('.', ',')} ${y === 1 ? 'ano' : 'anos'}`;
}

const VOL_LABEL: Record<VolumeState, string> = { lido: 'lido', lendo: 'lendo', parado: 'abandonado', estante: 'na estante', falta: 'falta' };

function Ring({ pct, label = 'lida', color = 'var(--leaf)' }: { pct: number; label?: string; color?: string }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" role="img" aria-label={`${pct}% ${label}`}>
      <svg viewBox="0 0 110 110" width="118" height="118">
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--tan-2)" strokeWidth="12" />
        <circle
          cx="55"
          cy="55"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          transform="rotate(-90 55 55)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="ring-label">
        <b>{pct}%</b>
        <span>{label}</span>
      </div>
    </div>
  );
}

function Kpi({ icon, value, label, bg, fg }: { icon: IconName; value: string; label: string; bg: string; fg: string }) {
  return (
    <div className="kpi" style={{ background: bg }}>
      <span className="kpi-ico" style={{ color: fg }}>
        <Icon name={icon} size={18} />
      </span>
      <b>{value}</b>
      <span className="tiny muted">{label}</span>
    </div>
  );
}

function PickCard({ s, base }: { s: Suggestion; base: string }) {
  const saga = /^(Continua|Retomar) a saga /.test(s.reason);
  return (
    <Link to={`${base}/livro/${s.book.id}`} className="pick">
      <Cover book={s.book} width={80} />
      <span className="serif pick-t">{s.book.title}</span>
      <span className={`pick-tag${saga ? ' saga' : ''}`}>
        <Icon name={saga ? 'readings' : 'heart'} size={12} />
        <span>{saga ? s.reason.replace(/^Continua a saga /, '') : s.reason}</span>
      </span>
    </Link>
  );
}

function SagaRow({ o, base }: { o: OpenSeries; base: string }) {
  const missing = o.missing.length;
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row between" style={{ gap: 8 }}>
        <b className="small">{o.name}</b>
        <span className="saga-count">
          {o.read}
          {o.total ? <span>/{o.total}</span> : <span> lidos</span>}
        </span>
      </div>
      <div className="vol-strip" role="img" aria-label={o.volumes.map((v, i) => `volume ${i + 1}: ${VOL_LABEL[v]}`).join(', ')}>
        {o.volumes.map((v, i) => (
          <i key={i} className={v} title={`Vol. ${i + 1} · ${VOL_LABEL[v]}`} />
        ))}
      </div>
      {(o.next || missing > 0) && (
        <span className="tiny muted">
          {o.next && (
            <>
              Próximo:{' '}
              <Link to={`${base}/livro/${o.next.id}`} style={{ fontWeight: 700 }}>
                {o.next.title}
              </Link>
              {o.next.status === 'abandonado' && ' (retomar)'}
            </>
          )}
          {o.next && missing > 0 && ' · '}
          {missing > 0 && (missing <= 3 ? `falta${missing === 1 ? '' : 'm'} vol. ${o.missing.join(', ').replace(/, (\d+)$/, ' e $1')}` : `${missing} volumes faltando`)}
        </span>
      )}
    </div>
  );
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
  const insights = useMemo(() => shelfInsights(books, readings), [books, readings]);
  const picks = shelfPct.unread > 0 ? insights.suggestions : insights.wishSuggestions;
  const goal = profile?.annual_goal ?? null;
  const goalInfo = useMemo(() => {
    if (!goal || year !== thisYear) return null;
    const now = new Date();
    const elapsed = now.getMonth() + now.getDate() / new Date(thisYear, now.getMonth() + 1, 0).getDate();
    const left = Math.max(0, goal - s.books);
    return {
      pct: Math.min(100, Math.round((s.books / goal) * 100)),
      left,
      perMonth: left / Math.max(0.5, 12 - elapsed),
      behind: Math.max(0, Math.floor((goal * elapsed) / 12) - s.books)
    };
  }, [goal, year, thisYear, s.books]);
  const maxMonth = Math.max(1, ...s.months);
  const activeMonths = s.months.filter((n) => n > 0).length;
  const bestMonth = s.months.indexOf(Math.max(...s.months));
  const monthsSoFar = year === thisYear ? new Date().getMonth() + 1 : 12;
  const genreTotal = s.genres.reduce((a, g) => a + g.n, 0);
  const topGenres = s.genres.slice(0, 5);
  const dateLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="page">
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

          <div className="grid-stats">
            <StatCard icon="book" value={String(s.books)} label="livros lidos" bg="#E3E8D5" fg="#4F6B47" />
            <StatCard icon="pages" value={fmtNum(s.pages)} label="páginas" bg="#F1E4D3" fg="#7A5235" />
            <StatCard icon="leaf" value={s.avgRating == null ? '—' : fmtRating(Math.round(s.avgRating * 10) / 10)} label="nota média" bg="#F6E9C9" fg="#8A5F1A" />
            <StatCard icon="readings" value={String(reading.length)} label="lendo agora" bg="#E3E8D5" fg="#4F6B47" />
          </div>

          {!(goal && year === thisYear) && canEdit && year === thisYear && (
            <Link to={`${base}/perfil`} className="card flat row" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
              <Icon name="flag" /> <span className="grow">Defina uma meta de leitura para {year}</span> <Icon name="back" size={18} className="flip" />
            </Link>
          )}

          {(goalInfo || shelfPct.total > 0) && (
          <div className={`duo${goalInfo && shelfPct.total > 0 ? ' two' : ''}`}>
            {goalInfo && (
              <section className="card stack ring-card" style={{ gap: 14 }}>
                <span className="eyebrow">Meta de {year}</span>
                <div className="shelf-body">
                  <Ring pct={goalInfo.pct} label="da meta" color="var(--moss)" />
                  <div className="kpis">
                    <Kpi icon="book" value={String(s.books)} label={`de ${goal} livros`} bg="#E3E8D5" fg="#4F6B47" />
                    <Kpi
                      icon="flag"
                      value={goalInfo.left === 0 ? 'Batida!' : String(goalInfo.left)}
                      label={goalInfo.left === 0 ? 'meta concluída' : goalInfo.left === 1 ? 'livro faltando' : 'livros faltando'}
                      bg="#F1E4D3"
                      fg="#7A5235"
                    />
                    <Kpi
                      icon="readings"
                      value={goalInfo.left === 0 ? `${fmtRating(Math.round(insights.pace * 10) / 10)}` : fmtRating(Math.ceil(goalInfo.perMonth * 10) / 10)}
                      label={goalInfo.left === 0 ? 'livros por mês' : 'por mês até dezembro'}
                      bg="#F6E9C9"
                      fg="#8A5F1A"
                    />
                  </div>
                </div>
                {goalInfo.left > 0 && (
                  <span className={`tip${goalInfo.behind > 0 ? ' warn' : ''}`}>
                    <Icon name={goalInfo.behind > 0 ? 'flag' : 'check'} size={16} />
                    {goalInfo.behind > 0
                      ? `${goalInfo.behind} ${goalInfo.behind === 1 ? 'livro' : 'livros'} atrás do ritmo da meta`
                      : 'Você está no ritmo da meta'}
                  </span>
                )}
              </section>
            )}
          {shelfPct.total > 0 && (
            <section className="card stack ring-card" style={{ gap: 14 }}>
              <span className="eyebrow">Estante lida</span>
              <div className="shelf-body">
                <Ring pct={shelfPct.pct} />
                <div className="kpis">
                  <Kpi icon="check" value={String(shelfPct.read)} label={`de ${shelfPct.total} lidos`} bg="#E3E8D5" fg="#4F6B47" />
                  <Kpi icon="book" value={String(shelfPct.unread)} label="esperando leitura" bg="#F1E4D3" fg="#7A5235" />
                  <Kpi
                    icon="flag"
                    value={shelfPct.unread === 0 ? 'Zerou!' : insights.monthsToClear ? duration(insights.monthsToClear) : '—'}
                    label={
                      shelfPct.unread === 0
                        ? 'pilha vazia'
                        : insights.monthsToClear
                          ? `pra zerar · ${fmtRating(Math.round(insights.pace * 10) / 10)}/mês`
                          : `sem leituras em ${thisYear}`
                    }
                    bg="#F6E9C9"
                    fg="#8A5F1A"
                  />
                </div>
              </div>
              {shelfPct.unread === 0 ? (
                <span className="tip">
                  <Icon name="check" size={16} /> Todos os livros da estante já foram lidos{totals.wish ? ` · ${totals.wish} na lista de desejos` : ''}
                </span>
              ) : (
                shelfPct.pct < 50 &&
                shelfPct.unread >= 5 && (
                  <span className="tip">
                    <Icon name="leaf" size={16} /> Vale priorizar a estante antes de novas compras
                  </span>
                )
              )}
            </section>
          )}
          </div>
          )}

          {(picks.length > 0 || insights.openSeries.length > 0) && (
            <section className={`card insights-grid${picks.length > 0 && insights.openSeries.length > 0 ? ' two' : ''}`}>
              {picks.length > 0 && (
                <div className="stack">
                  <span className="eyebrow">{shelfPct.unread > 0 ? 'Pra ler a seguir' : 'Da lista de desejos'}</span>
                  <div className="pick-grid">
                    {picks.map((p) => (
                      <PickCard key={p.book.id} s={p} base={base} />
                    ))}
                  </div>
                </div>
              )}
              {insights.openSeries.length > 0 && (
                <div className="stack">
                  <div className="row between wrap" style={{ gap: 8 }}>
                    <span className="eyebrow">Sagas em aberto</span>
                    <div className="vol-legend">
                      {(Object.keys(VOL_LABEL) as VolumeState[]).map((k) => (
                        <span key={k}>
                          <i className={k} /> {VOL_LABEL[k]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="stack" style={{ gap: 14 }}>
                    {insights.openSeries.map((o) => (
                      <SagaRow key={o.name} o={o} base={base} />
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          <p className="small muted" style={{ margin: 0 }}>
            Na estante: <b>{totals.shelf}</b> · Lidos no total: <b>{totals.read}</b>
            {legacy.length > 0 && <> </>} · Desejos: <b>{totals.wish}</b>
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

            <section className="card stack month-card">
              <h2 style={{ fontSize: 19 }}>Livros por mês</h2>
              <div className="bars" role="img" aria-label={`Livros terminados por mês em ${year}: ${s.months.join(', ')}`}>
                {s.months.map((n, i) => (
                  <div className="bar" key={i}>
                    {n > 0 && <span style={{ fontSize: 10 }}>{n}</span>}
                    <i className={n === 0 ? 'zero' : year === thisYear && i === new Date().getMonth() ? 'now' : ''} style={{ height: `calc((100% - 40px) * ${n / maxMonth})` }} />
                    <span>{MONTH_INITIALS[i]}</span>
                  </div>
                ))}
              </div>
              {s.books > 0 && (
                <div className="month-sum">
                  <div>
                    <b>{MONTH_NAMES[bestMonth]}</b>
                    <span className="tiny muted">melhor mês · {s.months[bestMonth]}</span>
                  </div>
                  <div>
                    <b>{fmtRating(Math.round((s.books / monthsSoFar) * 10) / 10)}</b>
                    <span className="tiny muted">média por mês</span>
                  </div>
                  <div>
                    <b>
                      {activeMonths}
                      <small>/{monthsSoFar}</small>
                    </b>
                    <span className="tiny muted">meses com leitura</span>
                  </div>
                </div>
              )}
            </section>

            {(s.best || s.topAuthors.length > 0 || s.longest) && (
              <section className="card stack span-2">
                <div className="row between wrap" style={{ gap: 8 }}>
                  <h2 style={{ fontSize: 19 }}>Destaques de {year}</h2>
                  {s.abandoned > 0 && (
                    <span className="pick-tag">
                      {s.abandoned} {s.abandoned === 1 ? 'abandonado' : 'abandonados'} · tudo bem!
                    </span>
                  )}
                </div>
                <div className="hl-grid">
                  {s.best && (
                    <Link to={`${base}/livro/${s.best.book.id}`} className={`hl-tile${s.best && s.longest ? '' : ' wide'}`} style={{ background: '#F6E9C9' }}>
                      <Cover book={s.best.book} width={48} />
                      <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                        <span className="eyebrow">Melhor nota</span>
                        <span className="serif hl-t">{s.best.book.title}</span>
                        <span className="tiny muted">{fmtRating(s.best.rating)} estrelas</span>
                      </div>
                    </Link>
                  )}
                  {s.longest && (
                    <Link to={`${base}/livro/${s.longest.id}`} className={`hl-tile${s.best && s.longest ? '' : ' wide'}`} style={{ background: '#F1E4D3' }}>
                      <Cover book={s.longest} width={48} />
                      <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                        <span className="eyebrow">Mais longo</span>
                        <span className="serif hl-t">{s.longest.title}</span>
                        <span className="tiny muted">{fmtNum(s.longest.pages ?? 0)} páginas</span>
                      </div>
                    </Link>
                  )}
                  {s.topAuthors.length > 0 && (
                    <div className="hl-authors">
                      <span className="eyebrow">Autores mais lidos</span>
                      {s.topAuthors.map((a) => (
                        <div key={a.name} className="hl-author">
                          <div className="row between" style={{ gap: 8 }}>
                            <span className="small" style={{ fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                            <span className="tiny muted" style={{ flexShrink: 0 }}>
                              {a.n} {a.n === 1 ? 'livro' : 'livros'}
                            </span>
                          </div>
                          <div className="progress" style={{ height: 6 }}>
                            <div style={{ width: `${(a.n / s.topAuthors[0].n) * 100}%`, background: 'var(--sage)' }} />
                          </div>
                        </div>
                      ))}
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
