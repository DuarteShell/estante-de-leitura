import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Book } from '../lib/types';
import { STATUS_DOT, STATUS_LABEL } from '../lib/types';
import { bookColors, hash } from '../lib/util';
import { ShelfPlant, ShelfStack } from './Decor';

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
export function Shelf({ books }: { books: Book[] }) {
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
    const cap = (i: number) => inner - (i % 2 === 0 ? 62 : 82); // espaço da plantinha / pilha
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
    <div className="shelf-case" ref={ref}>
      {rows.map((row, i) => (
        <div key={i}>
          <div className="shelf-row">
            {row.map(({ book, w, h }) => {
              const [bg, fg] = bookColors(book);
              const wish = book.status === 'desejo';
              return (
                <Link
                  key={book.id}
                  to={`/livro/${book.id}`}
                  className={`spine ${wish ? 'wish' : ''}`}
                  style={{ width: w, height: h, background: bg }}
                  aria-label={`${book.title} — ${STATUS_LABEL[book.status]}`}
                  title={book.title}
                >
                  <span className="band" style={{ background: wish ? '#C9B89A' : fg, opacity: 0.55 }} />
                  <span className="t" style={{ color: wish ? '#5C3D26' : fg }}>
                    {book.title}
                  </span>
                  <span className="s-dot" style={{ background: STATUS_DOT[book.status] }} />
                </Link>
              );
            })}
            {i % 2 === 0 ? <ShelfPlant /> : <ShelfStack />}
          </div>
          <div className="plank" />
        </div>
      ))}
    </div>
  );
}
