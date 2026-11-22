import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PottedPlant } from '../components/Decor';
import { Icon } from '../components/Icon';
import { Shelf } from '../components/Shelf';
import { ChipGroup, Cover, Empty, Fav } from '../components/ui';
import { legacyBooks } from '../lib/stats';
import type { Book, BookStatus, ShelfDecor } from '../lib/types';
import { STATUS_DOT } from '../lib/types';
import { moveBlock, useDragReorder, type DropTarget } from '../lib/useDragReorder';
import { groupSeries, norm, seriesKey, seriesTag } from '../lib/util';
import { useLibrary } from '../store/library';

type Filter = 'todos' | 'favoritos' | BookStatus;
type Sort = 'manual' | 'recentes' | 'titulo' | 'autor' | 'genero' | 'saga' | 'leitura';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'manual', label: 'Minha ordem (arrastar)' },
  { value: 'recentes', label: 'Adicionados recentemente' },
  { value: 'titulo', label: 'Título' },
  { value: 'autor', label: 'Autor' },
  { value: 'genero', label: 'Gênero' },
  { value: 'saga', label: 'Saga' },
  { value: 'leitura', label: 'Data de leitura' }
];
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'lido', label: 'Lidos' },
  { value: 'favoritos', label: 'Favoritos' },
  { value: 'lendo', label: 'Lendo' },
  { value: 'nao_lido', label: 'Não lidos' },
  { value: 'abandonado', label: 'Abandonados' },
  { value: 'desejo', label: 'Desejos' }
];

/** cor do coração de favorito */
const FAV_DOT = '#C95F4E';

/** preferências da estante que ficam salvas neste navegador */
const pref = {
  get: (k: string) => {
    try {
      return localStorage.getItem(`estante:${k}`);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(`estante:${k}`, v);
    } catch {
      /* ok */
    }
  }
};

/** ordem manual: posição salva primeiro; livros sem posição vão para o fim, pela data em que entraram */
const manualOrder = (a: Book, b: Book) =>
  (a.shelf_position ?? Number.MAX_SAFE_INTEGER) - (b.shelf_position ?? Number.MAX_SAFE_INTEGER) || a.created_at.localeCompare(b.created_at);

export default function ShelfPage() {
  const { books, readings, canEdit, base, reorderBooks, profile, saveProfile } = useLibrary();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('f') as Filter) || 'todos';
  const onlyLegacy = params.get('legado') === '1';
  const [q, setQ] = useState('');
  const [view, setView] = useState<'estante' | 'capas'>(() => (localStorage.getItem('estante:view') as 'estante' | 'capas') || 'estante');
  const [onlyOwned, setOnlyOwnedState] = useState(() => pref.get('tenho') === '1');
  const setOnlyOwned = (v: boolean) => {
    setOnlyOwnedState(v);
    pref.set('tenho', v ? '1' : '0');
  };
  const [arranging, setArranging] = useState(false);
  const [decorating, setDecorating] = useState(false);

  /* enfeites: mudam na tela na hora e são salvos no perfil logo depois */
  const [decorDraft, setDecorDraft] = useState<{ pid?: string; value: ShelfDecor | null } | null>(null);
  const decor = decorDraft && decorDraft.pid === profile?.id ? decorDraft.value : profile?.shelf_decor ?? null;
  const pendingDecor = useRef<{ value: ShelfDecor | null; timer: number } | null>(null);
  const saveRef = useRef(saveProfile);
  saveRef.current = saveProfile;
  const flushDecor = useCallback(() => {
    const p = pendingDecor.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    pendingDecor.current = null;
    saveRef.current({ shelf_decor: p.value }).catch(() => {
      /* o aviso de erro já aparece */
    });
  }, []);
  const changeDecor = (value: ShelfDecor | null) => {
    setDecorDraft({ pid: profile?.id, value });
    if (pendingDecor.current) window.clearTimeout(pendingDecor.current.timer);
    pendingDecor.current = { value, timer: window.setTimeout(flushDecor, 900) };
  };
  // saiu da página com algo por salvar: salva já
  useEffect(() => flushDecor, [flushDecor]);

  // volta para o último filtro de status usado (a lista de desejos é uma página à parte, não entra)
  useEffect(() => {
    if (params.has('f') || params.has('legado')) return;
    const saved = pref.get('filtro');
    if (saved && saved !== 'todos' && saved !== 'desejo' && FILTERS.some((f) => f.value === saved)) setParams({ f: saved }, { replace: true });
  }, [params, setParams]);
  const [sort, setSortState] = useState<Sort>(() => {
    try {
      const v = pref.get('sort') as Sort | null;
      return v && SORTS.some((o) => o.value === v) ? v : 'recentes';
    } catch {
      return 'recentes';
    }
  });
  const setSort = (v: Sort) => {
    setSortState(v);
    pref.set('sort', v);
    if (v !== 'manual') setArranging(false);
  };

  /** data da leitura concluída mais recente de cada livro */
  const lastRead = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of readings) {
      if (r.status !== 'lido') continue;
      const d = r.finished_at ?? (r.year ? `${r.year}-00-00` : null);
      if (d && d > (m.get(r.book_id) ?? '')) m.set(r.book_id, d);
    }
    return m;
  }, [readings]);

  const legacyIds = useMemo(() => new Set(legacyBooks(books, readings).map((b) => b.id)), [books, readings]);
  /** livros com alguma leitura marcada com coração */
  const favIds = useMemo(() => new Set(readings.filter((r) => r.favorite).map((r) => r.book_id)), [readings]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: books.length, favoritos: 0 };
    books.forEach((b) => {
      c[b.status] = (c[b.status] ?? 0) + 1;
      if (favIds.has(b.id)) c.favoritos += 1;
    });
    return c;
  }, [books, favIds]);

  // desejos nunca são livros que eu tenho: o filtro não se aplica (e a preferência salva fica intacta)
  const ownedOnly = onlyOwned && filter !== 'desejo';

  const list = useMemo(() => {
    const nq = norm(q);
    const out = books.filter(
      (b) =>
        (filter === 'todos' || (filter === 'favoritos' ? favIds.has(b.id) : b.status === filter)) &&
        (!onlyLegacy || legacyIds.has(b.id)) &&
        (!ownedOnly || b.owned) &&
        (!nq || norm(b.title).includes(nq) || norm(b.author).includes(nq) || norm(b.series).includes(nq) || b.genres.some((g) => norm(g).includes(nq)))
    );
    const byTitle = (a: Book, b: Book) => a.title.localeCompare(b.title, 'pt-BR');
    // vazios (sem autor/gênero/data) vão para o fim
    const text = (x: string | null | undefined, y: string | null | undefined) => (!x ? (y ? 1 : 0) : !y ? -1 : x.localeCompare(y, 'pt-BR'));
    if (sort === 'manual') out.sort(manualOrder);
    else if (sort === 'titulo') out.sort(byTitle);
    else if (sort === 'saga')
      out.sort((a, b) => text(a.series, b.series) || (a.series_index ?? 999) - (b.series_index ?? 999) || byTitle(a, b));
    else if (sort === 'autor') out.sort((a, b) => text(a.author, b.author) || byTitle(a, b));
    else if (sort === 'genero') out.sort((a, b) => text(a.genres[0], b.genres[0]) || text(a.author, b.author) || byTitle(a, b));
    else if (sort === 'leitura')
      out.sort((a, b) => {
        const x = lastRead.get(a.id);
        const y = lastRead.get(b.id);
        return !x ? (y ? 1 : byTitle(a, b)) : !y ? -1 : y.localeCompare(x) || byTitle(a, b);
      });
    else out.sort((a, b) => b.created_at.localeCompare(a.created_at));
    // livros da mesma saga sempre juntos e em ordem (1, 2, 3…)
    return groupSeries(out);
  }, [books, filter, onlyLegacy, ownedOnly, q, sort, legacyIds, favIds, lastRead]);

  /** solta o livro arrastado: recalcula a ordem de TODA a estante (mesmo com filtro ativo) */
  const onReorder = (dragId: string, target: DropTarget) => {
    const all = groupSeries([...books].sort(manualOrder));
    const ids = all.map((b) => b.id);
    // arrastar um livro de saga leva a saga inteira (ela fica sempre junta)
    const blockOf = (id: string) => {
      const k = seriesKey(all.find((b) => b.id === id) ?? { series: null });
      return k ? all.filter((b) => seriesKey(b) === k).map((b) => b.id) : [id];
    };
    const next = moveBlock(ids, dragId, target, blockOf);
    if (next.join() !== ids.join()) reorderBooks(next);
  };
  /** o livro faz parte do que está sendo arrastado (ele mesmo ou a saga dele) */
  const isDragging = (b: Book, dragId: string) => {
    if (b.id === dragId) return true;
    const k = seriesKey(b);
    return !!k && k === seriesKey(books.find((x) => x.id === dragId) ?? { series: null });
  };
  const coverDrag = useDragReorder(arranging && view === 'capas', onReorder);

  const setFilter = (f: Filter) => {
    if (f !== 'desejo') pref.set('filtro', f);
    const p = new URLSearchParams();
    if (f !== 'todos') p.set('f', f);
    setParams(p, { replace: true });
  };
  const changeView = (v: 'estante' | 'capas') => {
    setView(v);
    if (v !== 'estante') {
      flushDecor();
      setDecorating(false);
    }
    try {
      localStorage.setItem('estante:view', v);
    } catch {
      /* ok */
    }
  };

  const owned = books.filter((b) => b.owned && b.status !== 'desejo').length;

  return (
    <div className="page">
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
        options={FILTERS.map((f) => ({ ...f, count: counts[f.value] ?? 0, dot: f.value === 'todos' ? undefined : f.value === 'favoritos' ? FAV_DOT : STATUS_DOT[f.value] }))}
      />

      <div className="row wrap small" style={{ gap: 16 }}>
        <label className="check">
          <input type="checkbox" checked={ownedOnly} disabled={filter === 'desejo'} onChange={(e) => setOnlyOwned(e.target.checked)} />
          Só os que tenho
        </label>
        {onlyLegacy && (
          <button className="pill red" style={{ border: 'none', cursor: 'pointer' }} onClick={() => setFilter(filter)}>
            Só lidos sem registro ✕
          </button>
        )}
        <label className="row" style={{ gap: 6 }}>
          <span className="muted">Organizar por</span>
          <select className="select" style={{ width: 'auto', minHeight: 36, padding: '4px 10px' }} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            {SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {canEdit && (
          <button
            type="button"
            className={`btn btn-sm ${arranging ? 'btn-primary' : ''}`}
            onClick={() => {
              if (!arranging && sort !== 'manual') setSort('manual');
              setDecorating(false);
              setArranging(!arranging);
            }}
          >
            {arranging ? 'Pronto' : 'Reorganizar'}
          </button>
        )}
        {canEdit && view === 'estante' && (
          <button
            type="button"
            className={`btn btn-sm ${decorating ? 'btn-primary' : ''}`}
            onClick={() => {
              if (decorating) flushDecor();
              setArranging(false);
              setDecorating(!decorating);
            }}
          >
            <Icon name="brush" size={16} /> {decorating ? 'Pronto' : 'Decorar'}
          </button>
        )}
      </div>

      {arranging && (
        <p className="small card flat" role="status" style={{ margin: 0, background: 'var(--sage-l)', border: 'none' }}>
          Arraste os livros para trocar de lugar. A ordem fica salva sozinha. Toque em <b>Pronto</b> quando terminar.
        </p>
      )}

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
          {books.length === 0
            ? 'A estante está vazia.'
            : filter === 'favoritos' && counts.favoritos === 0
              ? 'Nenhum favorito ainda. Marque o coração ao lado das estrelas quando registrar ou editar uma leitura.'
              : 'Nenhum livro encontrado com esses filtros.'}
        </Empty>
      ) : view === 'estante' ? (
        <>
          <Shelf
            books={list}
            reorder={arranging}
            onReorder={onReorder}
            decor={decor}
            decorating={decorating}
            onDecorChange={changeDecor}
            onDecorDone={() => {
              flushDecor();
              setDecorating(false);
            }}
          />
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
        <div className={`cover-grid ${arranging ? 'reordering' : ''}`}>
          {list.map((b) => (
            <Link
              key={b.id}
              to={`${base}/livro/${b.id}`}
              draggable={false}
              className={`${coverDrag.dragId && isDragging(b, coverDrag.dragId) ? 'drag-src' : ''} ${coverDrag.over?.id === b.id ? (coverDrag.over.after ? 'drop-after' : 'drop-before') : ''}`}
              {...coverDrag.itemProps(b.id)}
            >
              <Cover book={b} width={104} className="cover-fluid" />
              <span className="t">
                {b.title}
                {favIds.has(b.id) && (
                  <>
                    {' '}
                    <Fav size={13} />
                  </>
                )}
              </span>
              {b.series && (
                <span className="saga-tag">
                  {b.series} {seriesTag(b, books) ?? ''}
                </span>
              )}
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
