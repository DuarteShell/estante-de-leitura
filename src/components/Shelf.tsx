import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Book } from '../lib/types';
import { STATUS_DOT, STATUS_LABEL } from '../lib/types';
import { useDragReorder, type DropTarget } from '../lib/useDragReorder';
import { bookColors, hash } from '../lib/util';
import { useLibrary } from '../store/library';
import { SHELF_DECOR } from './Decor';

/** enfeite de cada prateleira: alterna, sem repetir o vizinho */
const decorOf = (row: number) => SHELF_DECOR[row % SHELF_DECOR.length];

interface Spine {
  book: Book;
  w: number;
  h: number;
}

const spineOf = (book: Book): Spine => {
  const pages = book.pages ?? 250;
  return {
    book,
    w: Math.round(Math.max(20, Math.min(52, 16 + pages / 22))),
    h: 124 + (hash(book.id + book.title) % 42)
  };
};

/** Estante de madeira: as lombadas se distribuem nas prateleiras conforme a largura da tela. */
export function Shelf({
  books,
  reorder = false,
  onReorder
}: {
  books: Book[];
  /** modo de organizar: arrastar lombadas troca a ordem */
  reorder?: boolean;
  onReorder?: (dragId: string, target: DropTarget) => void;
}) {
  const { base } = useLibrary();
  const drag = useDragReorder(reorder, (id, t) => onReorder?.(id, t));
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(330);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = useMemo(() => {
    const spines = books.map(spineOf);
    const inner = width - 24; // padding da prateleira
    const out: Spine[][] = [];
    let row: Spine[] = [];
    let used = 0;
    const cap = (i: number) => inner - decorOf(i).w; // espaço do enfeite da prateleira
    for (const s of spines) {
      if (row.length && used + s.w + 3 > cap(out.length)) {
        out.push(row);
        row = [];
        used = 0;
      }
      row.push(s);
      used += s.w + 3;
    }
    if (row.length) out.push(row);
    while (out.length < 3) out.push([]);
    return out;
  }, [books, width]);

  return (
    <div className={`shelf-case ${reorder ? 'reordering' : ''}`} ref={ref}>
      {rows.map((row, i) => (
        <div key={i}>
          <div className="shelf-row">
            {row.map(({ book, w, h }) => {
              const [bg, fg] = bookColors(book);
              const wish = book.status === 'desejo';
              const mark = drag.over?.id === book.id ? (drag.over.after ? 'drop-after' : 'drop-before') : '';
              return (
                <Link
                  key={book.id}
                  to={`${base}/livro/${book.id}`}
                  className={`spine ${wish ? 'wish' : ''} ${drag.dragId === book.id ? 'drag-src' : ''} ${mark}`}
                  style={{ width: w, height: h, background: bg }}
                  aria-label={`${book.title} — ${STATUS_LABEL[book.status]}${book.series ? ` — ${book.series}${book.series_index != null ? ` #${book.series_index}` : ''}` : ''}`}
                  title={book.series ? `${book.title} (${book.series}${book.series_index != null ? ` #${String(book.series_index).replace('.', ',')}` : ''})` : book.title}
                  draggable={false}
                  {...drag.itemProps(book.id)}
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
              );
            })}
            {(() => {
              const D = decorOf(i).el;
              return <D />;
            })()}
          </div>
          <div className="plank" />
        </div>
      ))}
    </div>
  );
}
