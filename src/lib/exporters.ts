import Papa from 'papaparse';
import type { Book, LibraryData, Quote, Reading } from './types';
import { FORMAT_SHORT, STATUS_LABEL } from './types';
import { downloadFile, todayIso } from './util';

export interface Backup {
  app: 'estante-de-leitura';
  version: 1;
  exported_at: string;
  profile: LibraryData['profile'];
  books: Book[];
  readings: Reading[];
  quotes: Quote[];
}

export function exportJson(d: LibraryData) {
  const backup: Backup = {
    app: 'estante-de-leitura',
    version: 1,
    exported_at: new Date().toISOString(),
    profile: d.profile,
    books: d.books.map(({ user_id: _u, ...b }) => b),
    readings: d.readings.map(({ user_id: _u, ...r }) => r),
    quotes: d.quotes.map(({ user_id: _u, ...q }) => q)
  };
  downloadFile(`estante-backup-${todayIso()}.json`, JSON.stringify(backup, null, 2), 'application/json');
}

/** Uma linha por leitura (livros sem leitura aparecem uma vez) — abre no Excel, Sheets e Notion. */
export function exportCsv(d: LibraryData) {
  const byBook = new Map<string, Reading[]>();
  d.readings.forEach((r) => byBook.set(r.book_id, [...(byBook.get(r.book_id) ?? []), r]));
  const rows: Record<string, string | number>[] = [];
  for (const b of d.books) {
    const base = {
      Título: b.title,
      Autor: b.author ?? '',
      Status: STATUS_LABEL[b.status],
      'Tenho o livro': b.owned ? 'Sim' : 'Não',
      Gênero: b.genres.join(', '),
      Saga: b.series ?? '',
      'Nº na saga': b.series_index ?? '',
      'Total da saga': b.series_total ?? '',
      'Total de páginas': b.pages ?? '',
      ISBN: b.isbn ?? '',
      Capa: b.cover_url && !b.cover_url.startsWith('data:') ? b.cover_url : ''
    };
    const rs = byBook.get(b.id) ?? [];
    if (!rs.length) {
      rows.push({ ...base, Início: '', Término: '', Ano: '', Nota: '', Formato: '', Resenha: '' });
      continue;
    }
    for (const r of rs) {
      rows.push({
        ...base,
        Status: r.status === 'lido' ? 'Lido' : r.status === 'lendo' ? 'Lendo' : 'Abandonado',
        Início: r.started_at ?? '',
        Término: r.finished_at ?? '',
        Ano: r.year ?? '',
        Nota: r.rating ?? '',
        Formato: r.format ? FORMAT_SHORT[r.format] : '',
        Resenha: r.review ?? ''
      });
    }
  }
  downloadFile(`estante-${todayIso()}.csv`, '﻿' + Papa.unparse(rows), 'text/csv;charset=utf-8');
}

export function isBackup(x: unknown): x is Backup {
  return !!x && typeof x === 'object' && (x as Backup).app === 'estante-de-leitura' && Array.isArray((x as Backup).books);
}
