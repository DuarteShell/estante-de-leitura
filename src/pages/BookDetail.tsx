import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookForm } from '../components/BookForm';
import { HeroLandscape } from '../components/Decor';
import { Icon } from '../components/Icon';
import { ReadingModal } from '../components/ReadingForm';
import { ChipGroup, Cover, Empty, FORMAT_OPTIONS, FormatPill, Modal, STATUS_OPTIONS, Stars, StatusPill } from '../components/ui';
import type { BookStatus, Reading, ReadingFormat } from '../lib/types';
import { fmtDate, readingYear, seriesBooks, seriesPosition, seriesTotal } from '../lib/util';
import { STATUS_DOT } from '../lib/types';
import { useLibrary } from '../store/library';

type Dialog =
  | null
  | { kind: 'edit' }
  | { kind: 'finish'; status: 'lido' | 'abandonado' }
  | { kind: 'legacy-choice' }
  | { kind: 'add-reading' }
  | { kind: 'edit-reading'; reading: Reading }
  | { kind: 'start' }
  | { kind: 'delete' };

export default function BookDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const lib = useLibrary();
  const { books, readings, quotes, canEdit, base } = lib;
  const book = books.find((b) => b.id === id);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [page, setPage] = useState('');
  const [quoteText, setQuoteText] = useState('');
  const [quotePage, setQuotePage] = useState('');
  const [notes, setNotes] = useState(book?.notes ?? '');
  const [startFormat, setStartFormat] = useState<ReadingFormat>('fisico');

  useEffect(() => {
    setPage(book?.current_page != null ? String(book.current_page) : '');
  }, [book?.current_page]);
  useEffect(() => {
    setNotes(book?.notes ?? '');
  }, [book?.id, book?.notes]);

  if (!book) {
    return (
      <Empty action={<Link className="btn" to={`${base}/estante`}>Ir para a estante</Link>}>
        Livro não encontrado.
      </Empty>
    );
  }

  const mine = readings
    .filter((r) => r.book_id === book.id)
    .sort((a, b) => (b.finished_at ?? b.started_at ?? String(b.year ?? '')).localeCompare(a.finished_at ?? a.started_at ?? String(a.year ?? '')));
  const active = mine.find((r) => r.status === 'lendo');
  const isLegacy = book.status === 'lido' && !mine.some((r) => r.status === 'lido');
  const lastRating = mine.find((r) => r.rating != null)?.rating ?? null;
  const bookQuotes = quotes.filter((q) => q.book_id === book.id);
  const pct = book.pages && book.current_page ? Math.min(100, Math.round((book.current_page / book.pages) * 100)) : 0;

  const onStatus = async (s: BookStatus) => {
    if (s === book.status) return;
    if (s === 'lido') return setDialog(active ? { kind: 'finish', status: 'lido' } : { kind: 'legacy-choice' });
    if (s === 'lendo') return setDialog({ kind: 'start' });
    if (s === 'abandonado' && active) return setDialog({ kind: 'finish', status: 'abandonado' });
    await lib.updateBook(book.id, { status: s, ...(s === 'desejo' ? { owned: false } : {}) });
  };

  const savePage = async (n: number) => {
    const v = Math.max(0, book.pages ? Math.min(book.pages, n) : n);
    setPage(String(v));
    await lib.updateBook(book.id, { current_page: v });
    if (book.pages && v >= book.pages) setDialog({ kind: 'finish', status: 'lido' });
  };

  const saga = seriesBooks(book, books);
  const seriesSection = () => {
    if (!book.series || saga.length < 2) return null;
    const read = saga.filter((b) => b.status === 'lido').length;
    return (
      <section className="card stack" style={{ gap: 10 }}>
        <div className="row between">
          <span className="eyebrow">Nesta saga</span>
          <span className="tiny muted">
            {(() => {
              const total = seriesTotal(book, books);
              return total && total > saga.length ? `${read} de ${total} lidos · ${saga.length} na estante` : `${read} de ${saga.length} lidos`;
            })()}
          </span>
        </div>
        <div className="saga-row">
          {saga.map((b) => (
            <Link key={b.id} to={`${base}/livro/${b.id}`} className={`saga-item ${b.id === book.id ? 'on' : ''}`} aria-current={b.id === book.id ? 'page' : undefined}>
              <Cover book={b} width={56} />
              <span className="tiny row" style={{ gap: 4, justifyContent: 'center' }}>
                <span className="dot" style={{ background: STATUS_DOT[b.status], width: 8, height: 8 }} />
                {b.series_index != null ? `#${String(b.series_index).replace('.', ',')}` : '—'}
              </span>
            </Link>
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="page narrow">
      <div className="hero">
        <HeroLandscape />
        <button className="icon-btn" style={{ position: 'absolute', top: 'max(20px, env(safe-area-inset-top))', left: 18, background: 'rgba(251,248,239,0.9)', border: 'none' }} onClick={() => nav(-1)} aria-label="Voltar">
          <Icon name="back" size={20} />
        </button>
        {canEdit && (
          <button className="icon-btn" style={{ position: 'absolute', top: 'max(20px, env(safe-area-inset-top))', right: 18, background: 'rgba(251,248,239,0.9)', border: 'none' }} onClick={() => setDialog({ kind: 'edit' })} aria-label="Editar livro">
            <Icon name="edit" size={20} />
          </button>
        )}
      </div>

      <div className="stack" style={{ alignItems: 'center', textAlign: 'center', marginTop: -150, gap: 10, position: 'relative' }}>
        <Cover book={book} width={128} />
        <h1 style={{ fontSize: 27, marginTop: 6 }}>{book.title}</h1>
        {book.series && (
          <span className="eyebrow" style={{ color: 'var(--wood)' }}>
            {book.series}
            {seriesPosition(book, books) && ` · ${seriesPosition(book, books)}`}
          </span>
        )}
        <span className="muted">
          {book.author ?? 'Autor desconhecido'}
          {book.pages ? ` · ${book.pages} páginas` : ''}
        </span>
        <div className="row wrap" style={{ justifyContent: 'center', gap: 6 }}>
          <StatusPill status={book.status} legacy={isLegacy} />
          {book.owned && book.status !== 'desejo' && <span className="pill brown">Na estante</span>}
          {book.genres.map((g) => (
            <span key={g} className="pill">
              {g}
            </span>
          ))}
        </div>
        {lastRating != null && <Stars value={lastRating} size={20} showNumber />}
      </div>

      {seriesSection()}

      {canEdit && (
        <section className="stack">
          <ChipGroup scroll soft label="Status do livro" value={book.status} onChange={onStatus} options={STATUS_OPTIONS} />
          {book.status !== 'desejo' && (
            <label className="row small" style={{ gap: 8, fontWeight: 700 }}>
              <input type="checkbox" checked={book.owned} onChange={(e) => lib.updateBook(book.id, { owned: e.target.checked })} />
              Está na minha estante (tenho o livro)
            </label>
          )}
        </section>
      )}

      {book.status === 'lendo' && (
        <section className="card stack">
          <div className="row between">
            <span className="eyebrow">Progresso</span>
            <span className="small" style={{ fontWeight: 800, color: 'var(--moss)' }}>{book.pages ? `${pct}%` : ''}</span>
          </div>
          <div className="serif" style={{ fontSize: 22, fontWeight: 600 }}>
            Página {book.current_page ?? 0} {book.pages && <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink-2)' }}>de {book.pages}</span>}
          </div>
          {book.pages && (
            <div className="progress" style={{ height: 12 }}>
              <div style={{ width: `${pct}%` }} />
            </div>
          )}
          {canEdit && (
            <>
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  savePage(Number(page) || 0);
                }}
              >
                <button type="button" className="btn" onClick={() => savePage((book.current_page ?? 0) - 10)} aria-label="Menos 10 páginas">
                  −10
                </button>
                <label className="grow">
                  <span className="sr-only">Página atual</span>
                  <input className="input" type="number" inputMode="numeric" min={0} value={page} onChange={(e) => setPage(e.target.value)} onBlur={() => Number(page) !== book.current_page && savePage(Number(page) || 0)} style={{ textAlign: 'center' }} />
                </label>
                <button type="button" className="btn btn-primary" onClick={() => savePage((book.current_page ?? 0) + 10)} aria-label="Mais 10 páginas">
                  +10
                </button>
              </form>
              <div className="row">
                <button className="btn btn-primary grow" onClick={() => setDialog({ kind: 'finish', status: 'lido' })}>
                  <Icon name="check" size={18} /> Terminei!
                </button>
                <button className="btn grow" onClick={() => setDialog({ kind: 'finish', status: 'abandonado' })}>
                  Abandonar
                </button>
              </div>
            </>
          )}
          {active?.started_at && <span className="tiny muted">Começou em {fmtDate(active.started_at)}</span>}
        </section>
      )}

      {isLegacy && (
        <section className="card flat stack" style={{ background: 'var(--tan)', border: 'none' }}>
          <span className="eyebrow">Lido sem registro</span>
          <p className="small" style={{ margin: 0 }}>
            Esse livro conta como lido, mas não tem data, nota nem formato — por isso fica fora das estatísticas por ano.
          </p>
          {canEdit && (
            <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setDialog({ kind: 'add-reading' })}>
              Registrar detalhes da leitura
            </button>
          )}
        </section>
      )}

      {(mine.length > 0 || canEdit) && (
        <section className="card stack">
          <div className="row between">
            <span className="eyebrow">Leituras deste livro</span>
            {canEdit && (
              <button className="btn btn-sm btn-ghost" onClick={() => setDialog({ kind: 'add-reading' })}>
                + Registrar leitura
              </button>
            )}
          </div>
          {mine.length === 0 && <span className="small muted">Nenhuma leitura registrada ainda.</span>}
          {mine.map((r, i) => (
            <div key={r.id} className="stack" style={{ gap: 6 }}>
              {i > 0 && <hr className="divider" />}
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <span className="dot" style={{ marginTop: 6, background: r.status === 'lido' ? '#7FA36B' : r.status === 'lendo' ? '#E2B04A' : '#C46A4A' }} />
                <div className="stack grow" style={{ gap: 4 }}>
                  <span className="small">
                    <b>{readingYear(r) ?? 'Sem data'}</b> ·{' '}
                    {r.status === 'lendo' ? 'em andamento' : r.status === 'abandonado' ? `abandonado${r.pages_read ? ` na p. ${r.pages_read}` : ''}` : 'lido'}
                    {r.started_at || r.finished_at ? ` · ${fmtDate(r.started_at) || '?'} → ${r.status === 'lendo' ? 'hoje' : fmtDate(r.finished_at) || '?'}` : ''}
                  </span>
                  <div className="row wrap" style={{ gap: 6 }}>
                    <FormatPill format={r.format} />
                    {r.rating != null && <Stars value={r.rating} size={14} showNumber />}
                  </div>
                  {r.review && <p className="small" style={{ margin: 0, whiteSpace: 'pre-line' }}>{r.review}</p>}
                </div>
                {canEdit && (
                  <button className="icon-btn" style={{ width: 38, height: 38 }} onClick={() => setDialog({ kind: 'edit-reading', reading: r })} aria-label="Editar leitura">
                    <Icon name="edit" size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {(bookQuotes.length > 0 || canEdit) && (
        <section className="card stack">
          <span className="eyebrow">Citações</span>
          {bookQuotes.map((q) => (
            <div key={q.id} className="quote">
              <Icon name="quote" size={22} className="muted" />
              <p>{q.text}</p>
              <div className="row between">
                <span className="tiny" style={{ fontWeight: 800, color: 'var(--bark)' }}>{q.page ? `p. ${q.page}` : ''}</span>
                {canEdit && (
                  <button className="btn btn-sm btn-danger" style={{ minHeight: 30 }} onClick={() => lib.deleteQuote(q.id)} aria-label="Apagar citação">
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {canEdit && (
            <form
              className="stack"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!quoteText.trim()) return;
                await lib.addQuote(book.id, quoteText.trim(), quotePage ? Number(quotePage) : null);
                setQuoteText('');
                setQuotePage('');
              }}
            >
              <label className="field">
                <span className="sr-only">Nova citação</span>
                <textarea className="textarea" style={{ minHeight: 72 }} placeholder="Um trecho que você quer guardar…" value={quoteText} onChange={(e) => setQuoteText(e.target.value)} />
              </label>
              <div className="row">
                <label className="grow">
                  <span className="sr-only">Página</span>
                  <input className="input" type="number" inputMode="numeric" placeholder="Página" value={quotePage} onChange={(e) => setQuotePage(e.target.value)} />
                </label>
                <button className="btn btn-primary" disabled={!quoteText.trim()}>
                  + Guardar citação
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {(book.notes || canEdit) && (
        <section className="card stack">
          <span className="eyebrow">Anotações</span>
          {canEdit ? (
            <textarea
              className="textarea"
              placeholder="Anotações livres sobre o livro (salva sozinho)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== (book.notes ?? '') && lib.updateBook(book.id, { notes: notes.trim() || null })}
            />
          ) : (
            <p className="small" style={{ margin: 0, whiteSpace: 'pre-line' }}>{book.notes}</p>
          )}
        </section>
      )}

      {book.isbn && <span className="tiny muted" style={{ textAlign: 'center' }}>ISBN {book.isbn}</span>}

      {canEdit && (
        <button className="btn btn-danger btn-ghost" onClick={() => setDialog({ kind: 'delete' })}>
          <Icon name="trash" size={18} /> Remover da estante
        </button>
      )}

      {/* ---------- diálogos ---------- */}
      {dialog?.kind === 'edit' && (
        <Modal title="Editar livro" onClose={() => setDialog(null)}>
          <BookForm
            mode="edit"
            initial={book}
            submitLabel="Salvar alterações"
            onSubmit={async ({ book: patch }) => {
              await lib.updateBook(book.id, patch);
              setDialog(null);
            }}
          />
        </Modal>
      )}

      {dialog?.kind === 'finish' && (
        <ReadingModal
          title={dialog.status === 'lido' ? 'Terminei!' : 'Abandonar leitura'}
          initial={{ ...active, id: undefined, status: dialog.status, finished_at: undefined, pages_read: dialog.status === 'abandonado' ? book.current_page : null }}
          allowStatus={false}
          saveLabel={dialog.status === 'lido' ? 'Salvar leitura' : 'Marcar como abandonado'}
          onSave={(r) => lib.finishReading(book.id, { ...r, status: dialog.status })}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog?.kind === 'legacy-choice' && (
        <Modal title="Marcar como lido" onClose={() => setDialog(null)}>
          <div className="stack">
            <p className="small muted" style={{ margin: 0 }}>Quer registrar quando leu e a nota, ou só marcar como lido (leitura antiga, sem detalhes)?</p>
            <button className="btn btn-primary btn-block" onClick={() => setDialog({ kind: 'add-reading' })}>
              Registrar leitura
            </button>
            <button
              className="btn btn-block"
              onClick={async () => {
                await lib.setStatus(book.id, 'lido');
                setDialog(null);
              }}
            >
              Só marcar como lido
            </button>
          </div>
        </Modal>
      )}

      {dialog?.kind === 'add-reading' && (
        <ReadingModal title="Registrar leitura" initial={{ status: 'lido' }} statuses={['lido', 'abandonado']} onSave={(r) => lib.addReading(book.id, r)} onClose={() => setDialog(null)} />
      )}

      {dialog?.kind === 'edit-reading' && (
        <ReadingModal
          title="Editar leitura"
          initial={dialog.reading}
          onSave={(r) => lib.updateReading(dialog.reading.id, r)}
          onDelete={() => lib.deleteReading(dialog.reading.id)}
          onClose={() => setDialog(null)}
          saveLabel="Salvar"
        />
      )}
      {dialog?.kind === 'start' && (
        <Modal title="Começar leitura" onClose={() => setDialog(null)}>
          <div className="stack lg">
            <div className="field">
              <span>Formato</span>
              <ChipGroup soft value={startFormat} onChange={setStartFormat} options={FORMAT_OPTIONS} />
            </div>
            <button
              className="btn btn-primary btn-block"
              onClick={async () => {
                await lib.startReading(book.id, startFormat);
                setDialog(null);
              }}
            >
              <Icon name="play" size={18} /> Começar hoje
            </button>
          </div>
        </Modal>
      )}

      {dialog?.kind === 'delete' && (
        <Modal title="Remover livro?" onClose={() => setDialog(null)}>
          <div className="stack">
            <p className="small" style={{ margin: 0 }}>
              “{book.title}” e todas as leituras e citações dele serão apagados. Não dá pra desfazer.
            </p>
            <button
              className="btn btn-block"
              style={{ background: 'var(--danger)', color: '#fff', borderColor: 'var(--danger)' }}
              onClick={async () => {
                await lib.deleteBook(book.id);
                nav(`${base}/estante`, { replace: true });
              }}
            >
              Remover
            </button>
            <button className="btn btn-block" onClick={() => setDialog(null)}>
              Cancelar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
