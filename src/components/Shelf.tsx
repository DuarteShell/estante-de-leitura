import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Book, ShelfDecor, ShelfDecorItem } from '../lib/types';
import { STATUS_DOT, STATUS_LABEL } from '../lib/types';
import { useDragReorder, type DropTarget } from '../lib/useDragReorder';
import { bookColors, hash, seriesKey, uid } from '../lib/util';
import { useLibrary } from '../store/library';
import { AUTO_DECOR, decorDef, WOODS, wallBackground, type DecorDef } from './ShelfDecor';
import { ShelfDecorPanel } from './ShelfDecorPanel';

interface Spine {
  book: Book;
  w: number;
  h: number;
}

interface Placed {
  item: ShelfDecorItem;
  def: DecorDef;
}

type Token = { t: 'book'; s: Spine } | { t: 'decor'; d: Placed };

interface Row {
  books: Spine[];
  decor: Placed[];
  /** livros e enfeites na ordem da prateleira (só quando há livros) */
  seq: Token[];
}

/** onde o enfeite arrastado vai cair */
interface DecorTarget {
  row: number;
  pos: number;
  /** posição na sequência da prateleira (-1 = prateleira sem livros) */
  index: number;
}

const GAP = 3;
const PAD = 12;

const spineOf = (book: Book): Spine => {
  const pages = book.pages ?? 250;
  return {
    book,
    w: Math.round(Math.max(20, Math.min(52, 16 + pages / 22))),
    h: 124 + (hash(book.id + book.title) % 42)
  };
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const tokenKey = (t: Token) => (t.t === 'book' ? t.s.book.id : t.d.item.id);
/** em que vão (entre quais livros) o enfeite fica */
const gapOf = (pos: number, n: number) => clamp(Math.round(pos * n), 0, n);

/** posição de um enfeite inserido em `i` na sequência (sem ele) de uma prateleira com `n` livros */
function posAt(tokens: Token[], i: number, n: number): number {
  const b = tokens.slice(0, i).filter((t) => t.t === 'book').length;
  const prevT = tokens[i - 1];
  const nextT = tokens[i];
  const prev = prevT?.t === 'decor' ? prevT.d.item.pos : null;
  const next = nextT?.t === 'decor' ? nextT.d.item.pos : null;
  let lo = prev ?? (b - 0.45) / n;
  let hi = next ?? (b + 0.45) / n;
  if (prev == null && next != null) lo = Math.min(lo, next - 0.01 / n);
  if (next == null && prev != null) hi = Math.max(hi, prev + 0.01 / n);
  return (lo + hi) / 2;
}

/** distribui livros e enfeites nas prateleiras conforme a largura */
function layoutShelf(books: Book[], decor: ShelfDecor | null, width: number): Row[] {
  const inner = width - PAD * 2;
  const items = (decor?.items ?? []).filter((i) => decorDef(i.kind));
  const itemsIn = (r: number): ShelfDecorItem[] => {
    if (decor) return items.filter((i) => i.row === r);
    const a = AUTO_DECOR[r % AUTO_DECOR.length];
    return [{ id: `auto-${r}`, kind: a.kind, tone: a.tone, row: r, pos: 1 }];
  };
  const reserved = (r: number) => itemsIn(r).reduce((s, i) => s + decorDef(i.kind)!.w + GAP, 0);

  const bookRows: Spine[][] = [];
  let row: Spine[] = [];
  let used = 0;
  for (const s of books.map(spineOf)) {
    for (;;) {
      const r = bookRows.length;
      const cap = inner - reserved(r);
      // prateleira tomada pelos enfeites: os livros vão para a de baixo
      if (!row.length && s.w > cap && reserved(r) > 0) {
        bookRows.push([]);
        continue;
      }
      if (row.length && used + s.w + GAP > cap) {
        bookRows.push(row);
        row = [];
        used = 0;
        continue;
      }
      break;
    }
    row.push(s);
    used += s.w + GAP;
  }
  if (row.length) bookRows.push(row);

  const maxItemRow = decor ? items.reduce((m, i) => Math.max(m, i.row), -1) : -1;
  const count = Math.max(bookRows.length, decor?.rows ?? 3, maxItemRow + 1, 1);

  return Array.from({ length: count }, (_, r) => {
    const rb = bookRows[r] ?? [];
    const n = rb.length;
    const decorRow = itemsIn(r)
      .map((item) => ({ item, def: decorDef(item.kind)! }))
      .sort((a, b) => (n ? gapOf(a.item.pos, n) - gapOf(b.item.pos, n) : 0) || a.item.pos - b.item.pos);
    const seq: Token[] = [];
    if (n) {
      let k = 0;
      for (let g = 0; g <= n; g++) {
        while (k < decorRow.length && gapOf(decorRow[k].item.pos, n) === g) seq.push({ t: 'decor', d: decorRow[k++] });
        if (g < n) seq.push({ t: 'book', s: rb[g] });
      }
    }
    return { books: rb, decor: decorRow, seq };
  });
}

/** varal de luzinhas no alto da estante */
function Garland({ width, mode }: { width: number; mode: 'quente' | 'colorida' }) {
  const segs = Math.max(2, Math.round(width / 120));
  const sw = width / segs;
  const sag = 16;
  const colors = mode === 'quente' ? ['#F7D88A', '#F2C46C', '#F7E0A0'] : ['#F7D88A', '#E9A0A0', '#BFD8A8', '#A9C4E0', '#D9B8E8'];
  const bulbs: { x: number; y: number; a: number }[] = [];
  let d = '';
  for (let k = 0; k < segs; k++) {
    const x0 = k * sw;
    const x1 = x0 + sw;
    const cx = x0 + sw / 2;
    const cy = 2 + sag * 2;
    d += `M${x0} 2 Q ${cx} ${cy} ${x1} 2 `;
    for (const t of [0.22, 0.5, 0.78]) {
      const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1;
      const y = (1 - t) ** 2 * 2 + 2 * (1 - t) * t * cy + t ** 2 * 2;
      const dy = 2 * (1 - t) * (cy - 2) + 2 * t * (2 - cy);
      const dx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx);
      bulbs.push({ x, y, a: (Math.atan2(dy, dx) * 180) / Math.PI });
    }
  }
  return (
    <svg className="garland" width={width} height={34} viewBox={`0 0 ${width} 34`} aria-hidden="true">
      <path d={d} stroke="#5C4A36" strokeWidth="1.2" fill="none" />
      {bulbs.map((b, i) => (
        <g key={i} transform={`translate(${b.x} ${b.y}) rotate(${b.a})`}>
          <rect x="-2" y="0" width="4" height="3" rx="1" fill="#5C4A36" />
          <ellipse cx="0" cy="7" rx="3.4" ry="4.6" fill={colors[i % colors.length]} className="twinkle" style={{ animationDelay: `${(i * 0.53) % 2.4}s` }} />
        </g>
      ))}
    </svg>
  );
}

/** Estante de madeira: as lombadas se distribuem nas prateleiras conforme a largura da tela. */
export function Shelf({
  books,
  reorder = false,
  onReorder,
  decor = null,
  decorating = false,
  onDecorChange,
  onDecorDone
}: {
  books: Book[];
  /** modo de organizar: arrastar lombadas troca a ordem */
  reorder?: boolean;
  onReorder?: (dragId: string, target: DropTarget) => void;
  /** enfeites e estilo (null = enfeites automáticos) */
  decor?: ShelfDecor | null;
  /** modo de decorar: arrastar e editar enfeites */
  decorating?: boolean;
  onDecorChange?: (d: ShelfDecor | null) => void;
  onDecorDone?: () => void;
}) {
  const { base } = useLibrary();
  const drag = useDragReorder(reorder, (id, t) => onReorder?.(id, t));
  // a saga inteira acompanha o livro arrastado
  const dragKey = drag.dragId ? seriesKey(books.find((b) => b.id === drag.dragId) ?? { series: null }) : null;
  const isDragged = (b: Book) => b.id === drag.dragId || (!!dragKey && seriesKey(b) === dragKey);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(330);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = useMemo(() => layoutShelf(books, decor, width), [books, decor, width]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const inner = width - PAD * 2;

  /* ---------------- edição dos enfeites ---------------- */

  const [selected, setSelected] = useState<string | null>(null);
  const [decorDrag, setDecorDrag] = useState<string | null>(null);
  const [target, setTarget] = useState<DecorTarget | null>(null);
  const rowEls = useRef<(HTMLDivElement | null)[]>([]);
  const focusAfter = useRef<string | null>(null);

  useEffect(() => {
    if (!decorating) setSelected(null);
  }, [decorating]);

  // depois de mover pelo teclado, o foco continua no enfeite
  useLayoutEffect(() => {
    const id = focusAfter.current;
    if (!id) return;
    focusAfter.current = null;
    ref.current?.querySelector<HTMLElement>(`[data-decor-id="${id}"]`)?.focus();
  });

  /** enfeites atuais como lista editável (os automáticos viram enfeites de verdade) */
  const currentItems = (): ShelfDecorItem[] =>
    decor ? decor.items : rowsRef.current.flatMap((r) => r.decor.map(({ item }) => ({ ...item, id: uid() })));

  const commit = (items: ShelfDecorItem[], patch: Partial<ShelfDecor> = {}) => onDecorChange?.({ ...(decor ?? {}), items, ...patch });

  /** ids automáticos mudam ao personalizar: guarda qual era qual */
  const editItems = (fn: (items: ShelfDecorItem[], idOf: (id: string) => string) => ShelfDecorItem[] | null, patch: Partial<ShelfDecor> = {}) => {
    const before = decor ? null : rowsRef.current.flatMap((r) => r.decor.map(({ item }) => item.id));
    const items = currentItems();
    const idOf = (id: string) => (before ? items[before.indexOf(id)]?.id ?? id : id);
    const next = fn(items, idOf);
    if (!next) return;
    commit(next, patch);
    return idOf;
  };

  const updateItem = (id: string, patch: Partial<ShelfDecorItem>) => {
    const idOf = editItems((items, idOf) => items.map((i) => (i.id === idOf(id) ? { ...i, ...patch } : i)));
    if (idOf && selected === id) setSelected(idOf(id));
    return idOf?.(id) ?? id;
  };

  const removeItem = (id: string) => {
    editItems((items, idOf) => items.filter((i) => i.id !== idOf(id)));
    setSelected(null);
  };

  /** move pelo teclado/botões: um passo para o lado ou de prateleira */
  const moveItem = (id: string, dir: 'left' | 'right' | 'up' | 'down') => {
    const rs = rowsRef.current;
    const r = rs.findIndex((row) => row.decor.some((d) => d.item.id === id));
    if (r < 0) return;
    const item = rs[r].decor.find((d) => d.item.id === id)!.item;
    let patch: Partial<ShelfDecorItem> | null = null;
    if (dir === 'up' || dir === 'down') {
      const nr = r + (dir === 'up' ? -1 : 1);
      if (nr < 0 || nr >= rs.length) return;
      patch = { row: nr };
    } else {
      const n = rs[r].books.length;
      if (!n) {
        patch = { pos: clamp(item.pos + (dir === 'left' ? -0.08 : 0.08), 0, 1) };
      } else {
        const idx = rs[r].seq.findIndex((t) => t.t === 'decor' && t.d.item.id === id);
        const rest = rs[r].seq.filter((_, k) => k !== idx);
        const ni = dir === 'left' ? idx - 1 : idx + 1;
        if (ni < 0 || ni > rest.length) return;
        patch = { pos: posAt(rest, ni, n) };
      }
    }
    const newId = updateItem(id, patch);
    focusAfter.current = newId;
    setSelected(newId);
  };

  /** coloca um enfeite novo na primeira prateleira com espaço */
  const addItem = (kind: string, tone: number) => {
    const def = decorDef(kind);
    if (!def) return;
    const rs = rowsRef.current;
    const free = (row: Row) => inner - row.books.reduce((s, b) => s + b.w + GAP, 0) - row.decor.reduce((s, d) => s + d.def.w + GAP, 0);
    let r = rs.findIndex((row) => free(row) >= def.w + GAP);
    let rowsPatch: Partial<ShelfDecor> = {};
    if (r < 0) {
      r = rs.length;
      rowsPatch = { rows: rs.length + 1 };
    }
    const row = rs[r];
    let pos = 1;
    if (row && !row.books.length) {
      // prateleira vazia: procura o maior espaço livre entre os enfeites
      const spans = row.decor
        .map((d) => {
          const left = clamp(d.item.pos * inner - d.def.w / 2, 0, inner - d.def.w);
          return [left, left + d.def.w] as [number, number];
        })
        .sort((a, b) => a[0] - b[0]);
      let best = { size: -1, mid: inner / 2 };
      let x = 0;
      for (const [a, b] of [...spans, [inner, inner] as [number, number]]) {
        if (a - x > best.size) best = { size: a - x, mid: (x + a) / 2 };
        x = Math.max(x, b);
      }
      pos = clamp(best.mid / inner, 0, 1);
    } else if (row) {
      const n = row.books.length;
      const atEnd = row.decor.filter((d) => gapOf(d.item.pos, n) === n).map((d) => d.item.pos);
      pos = atEnd.length ? Math.max(...atEnd) + 0.01 / n : 1;
    }
    const item: ShelfDecorItem = { id: uid(), kind, tone, row: r, pos };
    editItems((items) => [...items, item], rowsPatch);
    setSelected(item.id);
    // mostra onde o enfeite foi parar
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(`[data-decor-id="${item.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  const setRows = (n: number) => {
    const max = n - 1;
    editItems((items) => items.map((i) => (i.row > max ? { ...i, row: max } : i)), { rows: n });
  };

  /** onde o enfeite cai, a partir do ponto do dedo/mouse */
  const findTarget = (x: number, y: number, dragId: string): DecorTarget | null => {
    const caseRect = ref.current?.getBoundingClientRect();
    if (!caseRect || x < caseRect.left - 60 || x > caseRect.right + 60 || y < caseRect.top - 80 || y > caseRect.bottom + 80) return null;
    let best = -1;
    let bestDist = Infinity;
    rowEls.current.forEach((el, r) => {
      if (!el) return;
      const rr = el.getBoundingClientRect();
      const dist = y < rr.top ? rr.top - y : y > rr.bottom + 14 ? y - rr.bottom - 14 : 0;
      if (dist < bestDist) {
        bestDist = dist;
        best = r;
      }
    });
    const el = rowEls.current[best];
    const row = rowsRef.current[best];
    if (!el || !row) return null;
    const rr = el.getBoundingClientRect();
    const n = row.books.length;
    if (!n) return { row: best, pos: clamp((x - rr.left - PAD) / (rr.width - PAD * 2), 0, 1), index: -1 };
    const rest = row.seq.filter((t) => tokenKey(t) !== dragId);
    const els = [...el.querySelectorAll<HTMLElement>('[data-key]')].filter((e) => e.dataset.key !== dragId);
    let i = 0;
    for (const e of els) {
      const b = e.getBoundingClientRect();
      if (b.left + b.width / 2 < x) i++;
    }
    return { row: best, pos: posAt(rest, Math.min(i, rest.length), n), index: i };
  };

  const decorPointer = useRef<{ id: string; x: number; y: number; started: boolean; ghost?: HTMLElement; dx: number; dy: number; target: DecorTarget | null } | null>(null);

  const onDecorPointerDown = (e: ReactPointerEvent<HTMLElement>, id: string) => {
    if (!decorating || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.focus({ preventScroll: true });
    const r = el.getBoundingClientRect();
    decorPointer.current = { id, x: e.clientX, y: e.clientY, started: false, dx: e.clientX - r.left, dy: e.clientY - r.top, target: null };

    const move = (ev: PointerEvent) => {
      const s = decorPointer.current;
      if (!s) return;
      if (!s.started) {
        if (Math.hypot(ev.clientX - s.x, ev.clientY - s.y) < 6) return;
        s.started = true;
        const ghost = el.cloneNode(true) as HTMLElement;
        ghost.removeAttribute('data-decor-id');
        ghost.removeAttribute('data-key');
        ghost.classList.add('drag-ghost', 'deco-ghost');
        ghost.classList.remove('sel');
        Object.assign(ghost.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: '0', zIndex: '1000', pointerEvents: 'none' });
        document.body.appendChild(ghost);
        document.body.classList.add('dragging');
        s.ghost = ghost;
        setDecorDrag(id);
        setSelected(id);
      }
      s.ghost!.style.left = `${ev.clientX - s.dx}px`;
      s.ghost!.style.top = `${ev.clientY - s.dy}px`;
      const t = findTarget(ev.clientX, ev.clientY, s.id);
      if (t?.row !== s.target?.row || t?.index !== s.target?.index || (t?.index === -1 && Math.abs(t.pos - (s.target?.pos ?? 0)) > 0.01)) {
        s.target = t;
        setTarget(t);
      }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const s = decorPointer.current;
      decorPointer.current = null;
      if (!s) return;
      s.ghost?.remove();
      document.body.classList.remove('dragging');
      setDecorDrag(null);
      setTarget(null);
      if (!s.started) {
        // toque sem arrastar: seleciona
        setSelected((cur) => (cur === s.id ? null : s.id));
        return;
      }
      if (ev.type === 'pointerup' && s.target) {
        const newId = updateItem(s.id, { row: s.target.row, pos: s.target.pos });
        setSelected(newId);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onDecorKey = (e: ReactKeyboardEvent<HTMLElement>, id: string) => {
    const dirs: Record<string, 'left' | 'right' | 'up' | 'down'> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    if (dirs[e.key]) {
      e.preventDefault();
      moveItem(id, dirs[e.key]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelected((cur) => (cur === id ? null : id));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      removeItem(id);
    } else if (e.key === 'Escape') {
      setSelected(null);
    }
  };

  /* ---------------- desenho ---------------- */

  const wood = WOODS.find((w) => w.id === decor?.wood) ?? WOODS[0];
  const caseStyle = {
    borderColor: wood.frame,
    background: wallBackground(decor?.wall, decor?.pattern),
    '--plank': wood.plank,
    '--plank-edge': wood.edge
  } as CSSProperties;

  const renderDecor = ({ item, def }: Placed, extra: { abs?: boolean; pushRight?: boolean }) => {
    const left = extra.abs ? PAD + clamp(item.pos * inner - def.w / 2, 0, inner - def.w) : undefined;
    return (
      <div
        key={item.id}
        data-key={item.id}
        data-decor-id={decorating ? item.id : undefined}
        className={`deco ${extra.abs ? 'deco-abs' : ''} ${decorating ? 'deco-edit' : ''} ${selected === item.id ? 'sel' : ''} ${decorDrag === item.id ? 'drag-src' : ''}`}
        style={{ width: def.w, left, marginLeft: extra.pushRight ? 'auto' : undefined, marginBottom: def.hang && !extra.abs ? -def.hang : undefined, bottom: def.hang && extra.abs ? -def.hang : undefined }}
        {...(decorating
          ? {
              role: 'button',
              tabIndex: 0,
              'aria-label': `${def.label}${def.tones[item.tone] ? ` (${def.tones[item.tone].name})` : ''}. Setas movem, Delete tira.`,
              'aria-pressed': selected === item.id,
              onPointerDown: (e: ReactPointerEvent<HTMLElement>) => onDecorPointerDown(e, item.id),
              onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => onDecorKey(e, item.id)
            }
          : { 'aria-hidden': true })}
      >
        <span className={item.flip ? 'flip' : undefined}>
          <def.Art tone={item.tone} />
        </span>
      </div>
    );
  };

  const selItem = selected ? rows.flatMap((r) => r.decor).find((d) => d.item.id === selected) ?? null : null;
  const selRow = selItem ? rows.findIndex((r) => r.decor.includes(selItem)) : -1;
  const minRows = Math.max(1, rows.reduce((m, r, i) => (r.books.length ? i + 1 : m), 0));

  return (
    <>
      <div className={`shelf-case ${reorder ? 'reordering' : ''} ${decorating ? 'decorating' : ''}`} ref={ref} style={caseStyle}>
        {decor?.lights && <Garland width={width} mode={decor.lights} />}
        {rows.map((row, i) => {
          const n = row.books.length;
          const firstEnd = n ? row.seq.findIndex((t) => t.t === 'decor' && gapOf(t.d.item.pos, n) === n) : -1;
          const showDrop = decorDrag && target?.row === i;
          return (
            <div key={i}>
              <div
                className="shelf-row"
                ref={(el) => {
                  rowEls.current[i] = el;
                }}
                onClick={decorating ? (e) => e.target === e.currentTarget && setSelected(null) : undefined}
              >
                {n === 0 && row.decor.map((d) => renderDecor(d, { abs: true }))}
                {n === 0 && showDrop && <span className="decor-drop abs" style={{ left: PAD + target!.pos * inner }} />}
                {row.seq.map((tok, k) => {
                  const drop =
                    showDrop && target!.index >= 0 && row.seq.filter((t, j) => j < k && tokenKey(t) !== decorDrag).length === target!.index && tokenKey(tok) !== decorDrag ? (
                      <span key="drop" className="decor-drop" />
                    ) : null;
                  if (tok.t === 'decor')
                    return (
                      <Fragment key={tok.d.item.id}>
                        {drop}
                        {renderDecor(tok.d, { pushRight: k === firstEnd })}
                      </Fragment>
                    );
                  const { book, w, h } = tok.s;
                  const [bg, fg] = bookColors(book);
                  const wish = book.status === 'desejo';
                  const mark = drag.over?.id === book.id ? (drag.over.after ? 'drop-after' : 'drop-before') : '';
                  return (
                    <Fragment key={book.id}>
                    {drop}
                    <Link
                      data-key={book.id}
                      to={`${base}/livro/${book.id}`}
                      className={`spine ${wish ? 'wish' : ''} ${isDragged(book) ? 'drag-src' : ''} ${mark}`}
                      style={{ width: w, height: h, background: bg }}
                      aria-label={`${book.title} — ${STATUS_LABEL[book.status]}${book.series ? ` — ${book.series}${book.series_index != null ? ` #${book.series_index}` : ''}` : ''}`}
                      title={book.series ? `${book.title} (${book.series}${book.series_index != null ? ` #${String(book.series_index).replace('.', ',')}` : ''})` : book.title}
                      draggable={false}
                      tabIndex={decorating ? -1 : undefined}
                      {...drag.itemProps(book.id)}
                      {...(decorating ? { onClick: (e: { preventDefault: () => void }) => e.preventDefault() } : {})}
                    >
                      <span className="band" style={{ background: wish ? '#C9B89A' : fg, opacity: 0.55 }} />
                      <span className="t" style={{ color: wish ? '#5C3D26' : fg }}>
                        {book.title}
                      </span>
                      <span className="s-foot">
                        {book.series && book.series_index != null && (
                          <span className="s-num" style={{ color: wish ? '#5C3D26' : fg }}>
                            {String(book.series_index).replace('.', ',')}
                          </span>
                        )}
                        <span className="s-dot" style={{ background: STATUS_DOT[book.status] }} />
                      </span>
                    </Link>
                    </Fragment>
                  );
                })}
                {showDrop && n > 0 && target!.index >= row.seq.filter((t) => tokenKey(t) !== decorDrag).length && <span className="decor-drop" />}
              </div>
              <div className="plank" />
            </div>
          );
        })}
      </div>
      {decorating && (
        <ShelfDecorPanel
          decor={decor}
          selected={selItem ? { item: selItem.item, def: selItem.def, canUp: selRow > 0, canDown: selRow < rows.length - 1 } : null}
          rowCount={rows.length}
          minRows={minRows}
          onDeselect={() => setSelected(null)}
          onTone={(tone) => selItem && updateItem(selItem.item.id, { tone })}
          onFlip={() => selItem && updateItem(selItem.item.id, { flip: !selItem.item.flip })}
          onMove={(dir) => selItem && moveItem(selItem.item.id, dir)}
          onRemove={() => selItem && removeItem(selItem.item.id)}
          onAdd={addItem}
          onStyle={(patch) => commit(currentItems(), patch)}
          onRows={setRows}
          onReset={() => {
            setSelected(null);
            onDecorChange?.(null);
          }}
          onDone={() => onDecorDone?.()}
        />
      )}
    </>
  );
}
