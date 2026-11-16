// Testa a importação com CSVs reais: npm run test:import -- arquivo1.csv arquivo2.csv ...
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { mergeItems, normalizeFile, parseCsv, SOURCE_LABEL } from '../src/lib/importers';

const files = process.argv.slice(2);
if (!files.length) {
  console.log('Uso: npm run test:import -- caminho/para/arquivo.csv [...]');
  process.exit(1);
}

const all = files.flatMap((f) => {
  const parsed = parseCsv(basename(f), readFileSync(f, 'utf8'));
  console.log(`${parsed.name}: ${SOURCE_LABEL[parsed.source]} · ${parsed.rows.length} linhas`);
  console.log('  mapeamento:', JSON.stringify(parsed.mapping));
  return normalizeFile(parsed, { undatedStatus: 'desejo', defaultFormat: null });
});

const merged = mergeItems(all);
console.log(`\n${all.length} itens → ${merged.length} livros após juntar repetidos\n`);
for (const b of merged) {
  const rs = b.readings
    .map((r) => `${r.status} ${r.started_at ?? '?'}→${r.finished_at ?? (r.year ?? '?')} ★${r.rating ?? '-'}`)
    .join(' | ');
  console.log(`- [${b.status}] ${b.title} — ${b.author ?? '?'} · ${b.pages ?? '?'}p · capa:${b.cover_url ? 'sim' : 'não'} · ${rs || 'sem leitura'}`);
}
