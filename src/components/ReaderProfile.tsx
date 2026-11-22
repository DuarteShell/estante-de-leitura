import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { availableYears, readerProfile, SIZE_LABELS, type AxisKey, type Period, type ProfileAxis } from '../lib/stats';
import { FORMAT_SHORT, type Book, type ReadingFormat } from '../lib/types';
import { fmtNum, fmtRating, readingYear } from '../lib/util';
import { useLibrary } from '../store/library';
import { Icon } from './Icon';
import { Cover, Empty } from './ui';

/** cor do período escolhido (destaque) e do histórico geral (comparação, só contorno) */
const C_MAIN = '#4F6B47';
const C_CMP = '#B07B4A';

const fmt1 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const plural = (n: number, one: string, many: string) => `${fmtNum(n)} ${n === 1 ? one : many}`;

/* ---------------- radar ---------------- */

const W = 340;
const H = 290;
const CX = W / 2;
const CY = H / 2 + 4;
const R = 96;

function point(i: number, n: number, v: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [CX + Math.cos(a) * R * (v / 100), CY + Math.sin(a) * R * (v / 100)];
}
const poly = (axes: ProfileAxis[]) => axes.map((a, i) => point(i, axes.length, Math.max(a.value, 3)).join(',')).join(' ');

function Radar({ axes, compare, active, setActive, label }: { axes: ProfileAxis[]; compare: ProfileAxis[] | null; active: AxisKey | null; setActive: (k: AxisKey | null) => void; label: string }) {
  const n = axes.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="radar" role="img" aria-label={label}>
      {[25, 50, 75, 100].map((v) => (
        <polygon key={v} points={axes.map((_, i) => point(i, n, v).join(',')).join(' ')} fill="none" stroke="var(--line)" strokeWidth={1} />
      ))}
      {axes.map((a, i) => {
        const [x, y] = point(i, n, 100);
        return <line key={a.key} x1={CX} y1={CY} x2={x} y2={y} stroke={active === a.key ? 'var(--line-2)' : 'var(--line)'} strokeWidth={1} />;
      })}
      {compare && <polygon points={poly(compare)} fill="none" stroke={C_CMP} strokeWidth={2} strokeLinejoin="round" />}
      <polygon points={poly(axes)} fill={C_MAIN} fillOpacity={0.12} stroke={C_MAIN} strokeWidth={2} strokeLinejoin="round" />
      {axes.map((a, i) => {
        const [px, py] = point(i, n, Math.max(a.value, 3));
        const [lx, ly] = point(i, n, 124);
        const anchor = Math.abs(lx - CX) < 4 ? 'middle' : lx > CX ? 'start' : 'end';
        const on = active === a.key;
        return (
          <g
            key={a.key}
            className="radar-axis"
            tabIndex={0}
            role="button"
            aria-label={`${a.label}: ${a.detail}`}
            aria-pressed={on}
            onPointerEnter={() => setActive(a.key)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(a.key)}
            onBlur={() => setActive(null)}
            onClick={() => setActive(on ? null : a.key)}
          >
            <circle cx={lx} cy={ly} r={26} fill="transparent" />
            <circle cx={px} cy={py} r={16} fill="transparent" />
            <circle cx={px} cy={py} r={on ? 6 : 4.5} fill={C_MAIN} stroke="var(--paper)" strokeWidth={2} />
            <text x={lx} y={ly} dy="0.35em" textAnchor={anchor} className={on ? 'on' : ''}>
              {a.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------------- peças ---------------- */

function Tile({ value, label, delta }: { value: string; label: string; delta?: string | null }) {
  return (
    <div className="ptile">
      <b>{value}</b>
      <span>{label}</span>
      {delta && <small>{delta}</small>}
    </div>
  );
}

/** lista de barras horizontais alinhadas: nome · barra · número */
function Meters({ rows, max, unit }: { rows: { name: string; n: number; icon?: React.ReactNode }[]; max?: number; unit?: (n: number) => string }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="meters">
      {rows.map((r) => (
        <div key={r.name} className="meter-row">
          <span className="meter-name">
            {r.icon}
            {r.name}
          </span>
          <div className="meter-track" aria-hidden="true">
            {r.n > 0 && <i style={{ width: `${(r.n / top) * 100}%` }} />}
          </div>
          <span className="meter-n">{unit ? unit(r.n) : fmtNum(r.n)}</span>
        </div>
      ))}
    </div>
  );
}

function Columns({ data, highlight }: { data: { label: string; n: number; title: string }[]; highlight?: number }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  return (
    <div className="bars cols" role="list">
      {data.map((d, i) => (
        <div key={d.label} className="bar" role="listitem" title={d.title} aria-label={d.title}>
          <em>{d.n || ''}</em>
          <i className={d.n === 0 ? 'zero' : i === highlight ? 'now' : ''} style={{ height: `${(d.n / max) * 100}%` }} />
          <span>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function Record({ label, book, detail, base }: { label: string; book?: Pick<Book, 'id' | 'title' | 'cover_url'>; detail: string; base: string }) {
  const body = (
    <>
      {book && <Cover book={book} width={40} />}
      <div className="stack grow" style={{ gap: 2 }}>
        <span className="eyebrow">{label}</span>
        {book && <span className="rec-t">{book.title}</span>}
        <span className="small muted">{detail}</span>
      </div>
    </>
  );
  return book ? (
    <Link to={`${base}/livro/${book.id}`} className="rec">
      {body}
    </Link>
  ) : (
    <div className="rec">{body}</div>
  );
}

/* ---------------- página ---------------- */

export function ReaderProfile() {
  const { books, readings, base, displayName } = useLibrary();
  const thisYear = new Date().getFullYear();
  const years = useMemo(
    () => availableYears(readings).filter((y) => readings.some((r) => r.status === 'lido' && readingYear(r) === y)),
    [readings]
  );
  const [period, setPeriod] = useState<Period>(() => {
    const now = readings.filter((r) => r.status === 'lido' && readingYear(r) === thisYear).length;
    return now >= 3 ? thisYear : 'all';
  });
  const [active, setActive] = useState<AxisKey | null>(null);

  const p = useMemo(() => readerProfile(period, books, readings), [period, books, readings]);
  const all = useMemo(() => readerProfile('all', books, readings), [books, readings]);
  const prev = useMemo(() => (typeof period === 'number' ? readerProfile(period - 1, books, readings) : null), [period, books, readings]);
  const compare = typeof period === 'number' && all.books >= 3 ? all : null;
  const periodLabel = period === 'all' ? 'Geral' : period === 'legado' ? 'Legado' : String(period);
  const isLegacy = period === 'legado';

  if (!all.books) {
    return <Empty>Quando houver leituras terminadas, o perfil de leitor aparece aqui: ritmo, gêneros, notas, recordes…</Empty>;
  }

  const delta = (now: number, before: number | undefined, unit = '') => {
    if (!prev || !prev.books || before == null) return null;
    const d = Math.round(now - before);
    return d === 0 ? `igual a ${period as number - 1}` : `${d > 0 ? '+' : '−'}${fmtNum(Math.abs(d))}${unit} vs ${period as number - 1}`;
  };
  const activeAxis = active ? p.axes.find((a) => a.key === active)! : null;
  const cmpAxis = active && compare ? compare.axes.find((a) => a.key === active)! : null;
  const r = p.records;
  const topGenres = p.genres.slice(0, 6);
  const otherGenres = p.genres.slice(6).reduce((a, g) => a + g.n, 0);
  const ratedCount = p.ratings.reduce((a, b) => a + b, 0);
  const sizedCount = p.sizes.reduce((a, b) => a + b, 0);
  const formatTotal = (Object.values(p.formats) as number[]).reduce((a, b) => a + b, 0);
  const formatRows = (Object.keys(FORMAT_SHORT) as ReadingFormat[])
    .map((f) => ({ name: FORMAT_SHORT[f], n: p.formats[f] }))
    .concat(p.formats.nd ? [{ name: 'Sem formato', n: p.formats.nd }] : [])
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  const yearCols = p.byYear.slice(-12);

  return (
    <div className="stack lg">
      <div className="chips scroll" role="group" aria-label="Período">
        {(['all', ...years, ...(all.legacy ? ['legado'] : [])] as Period[]).map((y) => (
          <button key={y} className={`chip ${period === y ? 'on' : ''}`} aria-pressed={period === y} onClick={() => setPeriod(y)}>
            {y === 'all' ? 'Geral' : y === 'legado' ? 'Legado' : y}
          </button>
        ))}
      </div>

      {period === 'all' && p.legacy > 0 && (
        <span className="tip">
          <Icon name="leaf" size={16} /> Inclui {plural(p.legacy, 'leitura legado', 'leituras legado')} (sem data) no total de livros, páginas, gêneros, autores e sagas — nas notas, quando
          têm, e como físico nos formatos, se estão na estante. Ritmo, constância e tempo de leitura usam só as leituras com data.
        </span>
      )}
      {isLegacy && (
        <span className="tip">
          <Icon name="leaf" size={16} /> Livros lidos antes de {years[years.length - 1] ?? thisYear}, sem data registrada. Sem datas, ritmo, constância e descoberta não se aplicam.
        </span>
      )}

      {!p.books ? (
        <Empty>Nenhuma leitura terminada em {periodLabel}.</Empty>
      ) : (
        <>
          <section className="card stack" style={{ gap: 16 }}>
            <div className="row between wrap" style={{ gap: 8 }}>
              <div>
                <span className="eyebrow">Perfil de leitura · {period === 'all' ? 'todo o histórico' : isLegacy ? 'leituras legado' : period}</span>
                <h2 style={{ marginTop: 4 }}>
                  {p.genres[0] ? `Leitura de ${p.genres[0].name.toLowerCase()}` : `Leituras de ${displayName}`}
                  {p.genres[1] ? ` e ${p.genres[1].name.toLowerCase()}` : ''}
                </h2>
              </div>
              {compare && (
                <div className="radar-legend" aria-label="Legenda">
                  <span>
                    <i className="sw" /> {period}
                  </span>
                  <span>
                    <i className="ln" /> Geral
                  </span>
                </div>
              )}
            </div>
            {p.traits.length > 0 && (
              <div className="chips">
                {p.traits.map((t) => (
                  <span key={t} className="pill green" style={{ fontSize: 13, padding: '5px 11px' }}>
                    {t}
                  </span>
                ))}
              </div>
            )}

            <div className="radar-wrap">
              <div className="stack" style={{ gap: 6, alignItems: 'center' }}>
                <Radar
                  axes={p.axes}
                  compare={compare?.axes ?? null}
                  active={active}
                  setActive={setActive}
                  label={`Radar do perfil de leitura (${periodLabel}): ${p.axes.map((a) => `${a.label} ${a.value} de 100`).join(', ')}`}
                />
                <p className="small radar-readout" aria-live="polite">
                  {activeAxis ? (
                    <>
                      <b>{activeAxis.label}:</b> {activeAxis.hint}
                      {cmpAxis && <> No geral: {cmpAxis.detail}.</>}
                    </>
                  ) : (
                    <span className="muted">Toque num eixo pra ver como ele é medido.</span>
                  )}
                </p>
              </div>
              <div className="axis-list">
                {p.axes.map((a) => (
                  <div
                    key={a.key}
                    className={`axis-row ${active === a.key ? 'on' : ''}`}
                    title={a.hint}
                    onPointerEnter={() => setActive(a.key)}
                    onPointerLeave={() => setActive(null)}
                  >
                    <b>{a.label}</b>
                    <div className="meter-track" aria-hidden="true">
                      {a.value > 0 && <i style={{ width: `${a.value}%` }} />}
                    </div>
                    <span className="meter-n">{a.value}</span>
                    <span className="small muted axis-detail">{a.detail}</span>
                  </div>
                ))}
              </div>
            </div>
            {p.books < 3 && <span className="tip"><Icon name="leaf" size={16} /> Com poucas leituras no período, o radar ainda diz pouco.</span>}
          </section>

          <div className="ptiles">
            <Tile value={fmtNum(p.books)} label={p.books === 1 ? 'livro lido' : 'livros lidos'} delta={delta(p.books, prev?.books)} />
            <Tile value={fmtNum(p.pages)} label="páginas" delta={delta(p.pages, prev?.pages)} />
            {!isLegacy && <Tile value={fmt1(p.perMonth)} label="livros por mês" />}
            <Tile value={p.avgRating == null ? '—' : fmtRating(Math.round(p.avgRating * 10) / 10)} label="nota média" />
            {!isLegacy && <Tile value={p.avgDays == null ? '—' : fmtNum(Math.round(p.avgDays))} label="dias por livro, em média" />}
            {!isLegacy && <Tile value={p.pagesPerDay == null ? '—' : fmtNum(Math.round(p.pagesPerDay))} label="páginas por dia lendo" />}
            <Tile value={fmtNum(p.authors)} label={p.authors === 1 ? 'autor' : 'autores diferentes'} delta={typeof period === 'number' && p.newAuthors ? `${p.newAuthors} ${p.newAuthors === 1 ? 'novo' : 'novos'}` : null} />
            {!isLegacy && <Tile value={fmtNum(p.abandoned)} label={p.abandoned === 1 ? 'abandonado' : 'abandonados'} />}
          </div>

          {yearCols.length > 1 && (
            <section className="card stack">
              <div className="row between">
                <span className="eyebrow">Livros por ano</span>
                <span className="tiny muted">média de {fmt1(yearCols.reduce((a, y) => a + y.n, 0) / yearCols.length)} por ano{p.legacy ? ' · sem o legado' : ''}</span>
              </div>
              <Columns data={yearCols.map((y) => ({ label: String(y.year).slice(-2) === String(thisYear).slice(-2) ? String(y.year) : `’${String(y.year).slice(-2)}`, n: y.n, title: `${y.year}: ${plural(y.n, 'livro', 'livros')}` }))} highlight={yearCols.length - 1} />
            </section>
          )}

          <div className="pduo">
            {topGenres.length > 0 && (
              <section className="card stack">
                <span className="eyebrow">Gêneros mais lidos</span>
                <Meters rows={topGenres} />
                {otherGenres > 0 && <span className="tiny muted">+ {plural(p.genres.length - topGenres.length, 'outro gênero', 'outros gêneros')}</span>}
              </section>
            )}
            {ratedCount > 0 && (
              <section className="card stack">
                <div className="row between">
                  <span className="eyebrow">Suas notas</span>
                  <span className="tiny muted">{plural(ratedCount, 'leitura avaliada', 'leituras avaliadas')}</span>
                </div>
                <Columns data={p.ratings.map((n, i) => ({ label: `${i + 1}★`, n, title: `${i + 1} estrela${i ? 's' : ''}: ${plural(n, 'leitura', 'leituras')}` }))} />
              </section>
            )}
            {sizedCount > 0 && (
              <section className="card stack">
                <span className="eyebrow">Tamanho dos livros (páginas)</span>
                <Meters rows={SIZE_LABELS.map((name, i) => ({ name, n: p.sizes[i] }))} />
              </section>
            )}
            {formatRows.length > 0 && (
              <section className="card stack">
                <span className="eyebrow">Formatos</span>
                <Meters rows={formatRows} max={formatTotal} unit={(n) => `${Math.round((n / formatTotal) * 100)}%`} />
              </section>
            )}
          </div>

          <section className="card stack">
            <span className="eyebrow">Recordes {period === 'all' ? 'de todos os tempos' : isLegacy ? 'do legado' : `de ${period}`}</span>
            <div className="records">
              {r.favorite && <Record base={base} label="Nota mais alta" book={r.favorite.book} detail={`${fmtRating(r.favorite.rating)} ★`} />}
              {r.longest && <Record base={base} label="Mais longo" book={r.longest} detail={`${fmtNum(r.longest.pages ?? 0)} páginas`} />}
              {r.shortest && <Record base={base} label="Mais curto" book={r.shortest} detail={`${fmtNum(r.shortest.pages ?? 0)} páginas`} />}
              {r.fastest && <Record base={base} label="Leitura mais rápida" book={r.fastest.book} detail={plural(r.fastest.days, 'dia', 'dias')} />}
              {r.slowest && <Record base={base} label="Leitura mais demorada" book={r.slowest.book} detail={plural(r.slowest.days, 'dia', 'dias')} />}
              {r.topAuthor && <Record base={base} label="Autor mais lido" detail={`${r.topAuthor.name} · ${plural(r.topAuthor.n, 'livro', 'livros')}`} />}
              {r.topSeries && <Record base={base} label="Saga mais lida" detail={`${r.topSeries.name} · ${plural(r.topSeries.n, 'volume', 'volumes')}`} />}
              {r.rereads.length > 0 && (
                <Record base={base} label="Releituras" detail={r.rereads.slice(0, 3).map((x) => `${x.name} (${x.n}×)`).join(' · ')} />
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

