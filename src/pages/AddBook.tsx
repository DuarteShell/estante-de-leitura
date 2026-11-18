import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { BookForm } from '../components/BookForm';
import { Icon } from '../components/Icon';
import { Cover, Empty } from '../components/ui';
import { cleanIsbn, isValidIsbn, lookupIsbn, searchBooks, type FoundBook } from '../lib/isbn';
import type { Book, BookStatus } from '../lib/types';
import { bookKey } from '../lib/util';
import { useLibrary } from '../store/library';

type Mode = 'scan' | 'search' | 'manual';

export default function AddBook() {
  const { canEdit, addBook, books, notify, base } = useLibrary();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const startStatus = (params.get('status') as BookStatus) || 'nao_lido';
  const [mode, setMode] = useState<Mode>('scan');
  const [isbnText, setIsbnText] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoundBook[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ data: Partial<Book>; key: number } | null>(null);
  const [scanKey, setScanKey] = useState(0);

  if (!canEdit) {
    return (
      <Empty action={<Link className="btn btn-primary" to="/entrar">Entrar</Link>}>
        Só a dona/dono da estante pode adicionar livros.
      </Empty>
    );
  }

  const fill = (f: FoundBook | null, isbn?: string) => {
    setDraft({
      key: Date.now(),
      data: f
        ? { title: f.title, author: f.author, pages: f.pages, cover_url: f.cover_url, genres: f.genres, isbn: f.isbn ?? isbn ?? null, status: startStatus }
        : { isbn: isbn ?? null, status: startStatus }
    });
  };

  const byIsbn = async (raw: string) => {
    const isbn = cleanIsbn(raw);
    if (!isValidIsbn(isbn)) {
      setMessage('Esse ISBN não parece válido. Confira os 13 números embaixo do código de barras.');
      return;
    }
    setBusy(true);
    setMessage(null);
    const found = await lookupIsbn(isbn);
    setBusy(false);
    if (found) setMessage(`Encontrado via ${found.source}. Confira os dados:`);
    else setMessage('Não achei esse ISBN nas bases públicas. Preencha à mão:');
    fill(found, isbn);
  };

  const doSearch = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setResults(await searchBooks(query));
    setBusy(false);
  };

  const duplicate =
    draft &&
    books.find(
      (b) =>
        (draft.data.isbn && b.isbn && cleanIsbn(b.isbn) === cleanIsbn(draft.data.isbn)) ||
        (draft.data.title && bookKey(b.title, b.author) === bookKey(draft.data.title, draft.data.author ?? null))
    );

  const reset = () => {
    setDraft(null);
    setMessage(null);
    setResults(null);
    setIsbnText('');
    setScanKey((k) => k + 1);
  };

  return (
    <div className="stack lg" style={{ maxWidth: 640 }}>
      <header className="row" style={{ gap: 12 }}>
        <button className="icon-btn" onClick={() => (draft ? reset() : nav(-1))} aria-label="Voltar">
          <Icon name="back" size={20} />
        </button>
        <h1 style={{ fontSize: 28 }}>Adicionar livro</h1>
      </header>

      {!draft && (
        <>
          <div className="seg" role="tablist" aria-label="Como adicionar">
            {(
              [
                ['scan', 'Código de barras'],
                ['search', 'Buscar'],
                ['manual', 'Manual']
              ] as [Mode, string][]
            ).map(([m, l]) => (
              <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => (m === 'manual' ? fill(null) : setMode(m))}>
                {l}
              </button>
            ))}
          </div>

          {mode === 'scan' && (
            <div className="stack">
              {!busy && <BarcodeScanner key={scanKey} onDetected={byIsbn} />}
              {busy && <div className="empty">Procurando o livro…</div>}
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  byIsbn(isbnText);
                }}
              >
                <label className="search grow">
                  <Icon name="barcode" size={20} />
                  <span className="sr-only">ISBN</span>
                  <input inputMode="numeric" placeholder="Ou digite o ISBN" value={isbnText} onChange={(e) => setIsbnText(e.target.value)} />
                </label>
                <button className="btn btn-primary" disabled={busy}>
                  Buscar
                </button>
              </form>
              {message && <p className="small" style={{ margin: 0, color: 'var(--danger)' }}>{message}</p>}
            </div>
          )}

          {mode === 'search' && (
            <div className="stack">
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  doSearch();
                }}
              >
                <label className="search grow">
                  <Icon name="search" size={20} />
                  <span className="sr-only">Buscar livro</span>
                  <input type="search" placeholder="Título, autor ou ISBN" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
                </label>
                <button className="btn btn-primary" disabled={busy}>
                  {busy ? '…' : 'Buscar'}
                </button>
              </form>
              {results && results.length === 0 && (
                <Empty action={<button className="btn" onClick={() => fill({ title: query, author: null, pages: null, cover_url: null, genres: [], isbn: null, source: '' })}>Cadastrar à mão</button>}>
                  Nada encontrado para “{query}”.
                </Empty>
              )}
              <div className="stack">
                {results?.map((r, i) => (
                  <button key={i} className="book-row" style={{ textAlign: 'left', width: '100%' }} onClick={() => fill(r)}>
                    <Cover book={r} width={46} />
                    <div className="stack grow" style={{ gap: 3 }}>
                      <span className="t">{r.title}</span>
                      <span className="small muted">
                        {r.author ?? 'Autor desconhecido'}
                        {r.pages ? ` · ${r.pages} p.` : ''}
                      </span>
                    </div>
                    <Icon name="plus" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {draft && (
        <div className="stack lg">
          {message && <p className="small muted" style={{ margin: 0 }}>{message}</p>}
          {duplicate && (
            <Link to={`${base}/livro/${duplicate.id}`} className="card flat small" style={{ textDecoration: 'none', color: '#8A3B22', background: '#F8E8E0' }}>
              Você já tem “{duplicate.title}” cadastrado. Toque pra abrir, ou continue se for outra edição.
            </Link>
          )}
          <div className="card">
            <BookForm
              key={draft.key}
              mode="create"
              initial={draft.data}
              submitLabel={startStatus === 'desejo' ? 'Salvar nos desejos' : 'Colocar na estante'}
              onSubmit={async ({ book, reading }) => {
                const id = await addBook(book, reading);
                notify(book.status === 'desejo' ? 'Adicionado à lista de desejos' : 'Livro na estante!');
                nav(`${base}/livro/${id}`, { replace: true });
              }}
            />
          </div>
          <button className="btn btn-ghost" onClick={reset}>
            <Icon name="barcode" size={18} /> Escanear / buscar outro
          </button>
        </div>
      )}
    </div>
  );
}
