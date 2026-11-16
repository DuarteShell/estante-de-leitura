import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PottedPlant } from '../components/Decor';
import { Icon } from '../components/Icon';
import { Shelf } from '../components/Shelf';
import { ChipGroup, Cover, Empty } from '../components/ui';
import { legacyBooks } from '../lib/stats';
import type { BookStatus } from '../lib/types';
import { STATUS_DOT } from '../lib/types';
import { norm } from '../lib/util';
import { useLibrary } from '../store/library';

type Filter = 'todos' | BookStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'lido', label: 'Lidos' },
  { value: 'lendo', label: 'Lendo' },
  { value: 'nao_lido', label: 'Não lidos' },
  { value: 'abandonado', label: 'Abandonados' },
  { value: 'desejo', label: 'Desejos' }
];

export default function ShelfPage() {
  const { books, readings, canEdit, base } = useLibrary();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('f') as Filter) || 'todos';
  const onlyLegacy = params.get('legado') === '1';
  const [q, setQ] = useState('');
  const [view, setView] = useState<'estante' | 'capas'>(() => (localStorage.getItem('estante:view') as 'estante' | 'capas') || 'estante');
  const [onlyOwned, setOnlyOwned] = useState(false);
  const [sort, setSort] = useState<'recentes' | 'titulo' | 'autor'>('recentes');

  const legacyIds = useMemo(() => new Set(legacyBooks(books, readings).map((b) => b.id)), [books, readings]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: books.length };
    books.forEach((b) => (c[b.status] = (c[b.status] ?? 0) + 1));
    return c;
  }, [books]);

  const list = useMemo(() => {
    const nq = norm(q);
    const out = books.filter(
      (b) =>
        (filter === 'todos' || b.status === filter) &&
        (!onlyLegacy || legacyIds.has(b.id)) &&
        (!onlyOwned || b.owned) &&
        (!nq || norm(b.title).includes(nq) || norm(b.author).includes(nq) || b.genres.some((g) => norm(g).includes(nq)))
    );
    if (sort === 'titulo') out.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    else if (sort === 'autor') out.sort((a, b) => (a.author ?? '').localeCompare(b.author ?? '', 'pt-BR') || a.title.localeCompare(b.title, 'pt-BR'));
    else out.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return out;
  }, [books, filter, onlyLegacy, onlyOwned, q, sort, legacyIds]);

  const setFilter = (f: Filter) => {
    const p = new URLSearchParams();
    if (f !== 'todos') p.set('f', f);
    setParams(p, { replace: true });
  };
  const changeView = (v: 'estante' | 'capas') => {
    setView(v);
    try {
      localStorage.setItem('estante:view', v);
    } catch {
      /* ok */
    }
  };

  const owned = books.filter((b) => b.owned && b.status !== 'desejo').length;

  return (
    <div className="stack lg">
      <header className="page-head">
        <div>
          <h1>{filter === 'desejo' ? 'Lista de desejos' : 'Minha estante'}</h1>
          <p className="sub" style={{ margin: 0 }}>
            {owned} {owned === 1 ? 'livro' : 'livros'} na estante · {counts.desejo ?? 0} desejos
          </p>
        </div>
        <PottedPlant />
      </header>

      <div className="row wrap" style={{ gap: 10 }}>
        <label className="search grow" style={{ minWidth: 220 }}>
          <Icon name="search" size={20} />
          <span className="sr-only">Buscar na estante</span>
          <input type="search" placeholder="Buscar título, autor ou gênero" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="seg" role="group" aria-label="Visualização" style={{ minWidth: 200 }}>
          <button className={view === 'estante' ? 'on' : ''} onClick={() => changeView('estante')}>
            Estante
          </button>
          <button className={view === 'capas' ? 'on' : ''} onClick={() => changeView('capas')}>
            Capas
          </button>
        </div>
      </div>

      <ChipGroup
        scroll
        label="Status"
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({ ...f, count: counts[f.value] ?? 0, dot: f.value === 'todos' ? undefined : STATUS_DOT[f.value] }))}
      />

      <div className="row wrap small" style={{ gap: 16 }}>
        <label className="row" style={{ gap: 8, fontWeight: 700 }}>
          <input type="checkbox" checked={onlyOwned} onChange={(e) => setOnlyOwned(e.target.checked)} />
          Só os que tenho
        </label>
        {onlyLegacy && (
          <button className="pill red" style={{ border: 'none', cursor: 'pointer' }} onClick={() => setFilter(filter)}>
            Só lidos sem registro ✕
          </button>
        )}
        {view === 'capas' && (
          <label className="row" style={{ gap: 6 }}>
            <span className="muted">Ordenar</span>
            <select className="select" style={{ width: 'auto', minHeight: 36, padding: '4px 10px' }} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="recentes">Recentes</option>
              <option value="titulo">Título</option>
              <option value="autor">Autor</option>
            </select>
          </label>
        )}
      </div>

      {list.length === 0 ? (
        <Empty
          action={
            canEdit && books.length === 0 ? (
              <Link to={`${base}/adicionar`} className="btn btn-primary">
                <Icon name="plus" /> Adicionar livro
              </Link>
            ) : undefined
          }
        >
          {books.length === 0 ? 'A estante está vazia.' : 'Nenhum livro encontrado com esses filtros.'}
        </Empty>
      ) : view === 'estante' ? (
        <>
          <Shelf books={list} />
          <div className="row wrap tiny muted" style={{ gap: 14 }}>
            {(['lido', 'lendo', 'nao_lido', 'abandonado', 'desejo'] as BookStatus[]).map((s) => (
              <span key={s} className="row" style={{ gap: 6 }}>
                <span className="dot" style={{ background: STATUS_DOT[s] }} />
                {FILTERS.find((f) => f.value === s)!.label}
              </span>
            ))}
            <span>· pontilhados = lista de desejos</span>
          </div>
        </>
      ) : (
        <div className="cover-grid">
          {list.map((b) => (
            <Link key={b.id} to={`${base}/livro/${b.id}`}>
              <Cover book={b} width={104} className="cover-fluid" />
              <span className="t">{b.title}</span>
              <span className="tiny muted row" style={{ gap: 6 }}>
                <span className="dot" style={{ background: STATUS_DOT[b.status], width: 8, height: 8 }} />
                {b.author ?? '—'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
