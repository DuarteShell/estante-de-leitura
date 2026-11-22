import { useState } from 'react';
import type { ShelfDecor, ShelfDecorItem } from '../lib/types';
import { Icon } from './Icon';
import { DECOR_CATALOG, PATTERNS, WALLS, WOODS, wallBackground, type DecorDef } from './ShelfDecor';
import { Modal } from './ui';

type Dir = 'left' | 'right' | 'up' | 'down';

/** Barra do modo decorar: editar o enfeite tocado, colocar novos e mudar o estilo da estante. */
export function ShelfDecorPanel({
  decor,
  selected,
  rowCount,
  minRows,
  onDeselect,
  onTone,
  onFlip,
  onMove,
  onRemove,
  onAdd,
  onStyle,
  onRows,
  onReset,
  onDone
}: {
  decor: ShelfDecor | null;
  selected: { item: ShelfDecorItem; def: DecorDef; canUp: boolean; canDown: boolean } | null;
  rowCount: number;
  minRows: number;
  onDeselect: () => void;
  onTone: (tone: number) => void;
  onFlip: () => void;
  onMove: (dir: Dir) => void;
  onRemove: () => void;
  onAdd: (kind: string, tone: number) => void;
  onStyle: (patch: Partial<ShelfDecor>) => void;
  onRows: (n: number) => void;
  onReset: () => void;
  onDone: () => void;
}) {
  const [modal, setModal] = useState<'catalogo' | 'estilo' | null>(null);

  return (
    <>
      <div className="decor-bar" role="toolbar" aria-label="Decorar a estante">
        {selected ? (
          <div className="stack" style={{ gap: 10 }}>
            <div className="row between" style={{ gap: 8 }}>
              <span className="small">
                <b>{selected.def.label}</b>
                {selected.def.tones[selected.item.tone] && <span className="muted"> · {selected.def.tones[selected.item.tone].name}</span>}
              </span>
              <button type="button" className="icon-btn" onClick={onDeselect} aria-label="Fechar edição do enfeite">
                <Icon name="close" size={18} />
              </button>
            </div>
            {selected.def.tones.length > 1 && (
              <div className="swatches" role="radiogroup" aria-label="Variação">
                {selected.def.tones.map((t, i) => (
                  <button
                    key={t.name}
                    type="button"
                    role="radio"
                    aria-checked={selected.item.tone === i}
                    className={`swatch ${selected.item.tone === i ? 'on' : ''}`}
                    style={{ background: t.swatch }}
                    title={t.name}
                    aria-label={t.name}
                    onClick={() => onTone(i)}
                  />
                ))}
              </div>
            )}
            <div className="row wrap" style={{ gap: 6 }}>
              <div className="decor-arrows" role="group" aria-label="Mover">
                <button type="button" className="btn btn-sm" onClick={() => onMove('left')} aria-label="Mover para a esquerda">
                  <Icon name="left" size={18} />
                </button>
                <button type="button" className="btn btn-sm" onClick={() => onMove('right')} aria-label="Mover para a direita">
                  <Icon name="right" size={18} />
                </button>
                <button type="button" className="btn btn-sm" onClick={() => onMove('up')} disabled={!selected.canUp} aria-label="Prateleira de cima">
                  <Icon name="up" size={18} />
                </button>
                <button type="button" className="btn btn-sm" onClick={() => onMove('down')} disabled={!selected.canDown} aria-label="Prateleira de baixo">
                  <Icon name="down" size={18} />
                </button>
              </div>
              <button type="button" className="btn btn-sm" onClick={onFlip} aria-label="Espelhar" title="Espelhar">
                <Icon name="flip" size={18} /> <span className="lbl">Espelhar</span>
              </button>
              <button type="button" className="btn btn-sm btn-danger" onClick={onRemove} aria-label="Tirar da estante" title="Tirar da estante">
                <Icon name="trash" size={18} /> <span className="lbl">Tirar</span>
              </button>
            </div>
          </div>
        ) : (
          <p className="tiny muted" style={{ margin: 0 }}>
            Arraste os enfeites para qualquer lugar da estante. Toque num enfeite para trocar a cor, espelhar ou tirar.
          </p>
        )}
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-sm grow" onClick={() => setModal('catalogo')}>
            <Icon name="plus" size={18} /> Enfeite
          </button>
          <button type="button" className="btn btn-sm grow" onClick={() => setModal('estilo')}>
            <Icon name="brush" size={18} /> Estilo
          </button>
          <button type="button" className="btn btn-sm btn-primary grow" onClick={onDone}>
            <Icon name="check" size={18} /> Pronto
          </button>
        </div>
      </div>

      {modal === 'catalogo' && (
        <Catalog
          onClose={() => setModal(null)}
          onPick={(kind, tone) => {
            onAdd(kind, tone);
            setModal(null);
          }}
        />
      )}
      {modal === 'estilo' && (
        <StyleModal decor={decor} rowCount={rowCount} minRows={minRows} onClose={() => setModal(null)} onStyle={onStyle} onRows={onRows} onReset={onReset} />
      )}
    </>
  );
}

function Catalog({ onClose, onPick }: { onClose: () => void; onPick: (kind: string, tone: number) => void }) {
  const [tones, setTones] = useState<Record<string, number>>({});
  return (
    <Modal title="Colocar enfeite" onClose={onClose}>
      <p className="small muted" style={{ marginTop: -8 }}>
        Escolha a cor e toque no enfeite. Ele vai para a primeira prateleira com espaço, e aí é só arrastar.
      </p>
      <div className="decor-catalog">
        {DECOR_CATALOG.map((d) => {
          const tone = tones[d.kind] ?? 0;
          return (
            <div key={d.kind} className="decor-card">
              <button type="button" className="decor-pick" onClick={() => onPick(d.kind, tone)} aria-label={`Colocar ${d.label} (${d.tones[tone]?.name})`}>
                <span className="decor-prev">
                  <d.Art tone={tone} />
                </span>
                <span className="small" style={{ fontWeight: 700 }}>
                  {d.label}
                </span>
              </button>
              {d.tones.length > 1 && (
                <div className="swatches sm" role="radiogroup" aria-label={`Cor de ${d.label}`}>
                  {d.tones.map((t, i) => (
                    <button
                      key={t.name}
                      type="button"
                      role="radio"
                      aria-checked={tone === i}
                      className={`swatch ${tone === i ? 'on' : ''}`}
                      style={{ background: t.swatch }}
                      title={t.name}
                      aria-label={t.name}
                      onClick={() => setTones((s) => ({ ...s, [d.kind]: i }))}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function StyleModal({
  decor,
  rowCount,
  minRows,
  onClose,
  onStyle,
  onRows,
  onReset
}: {
  decor: ShelfDecor | null;
  rowCount: number;
  minRows: number;
  onClose: () => void;
  onStyle: (patch: Partial<ShelfDecor>) => void;
  onRows: (n: number) => void;
  onReset: () => void;
}) {
  const wood = decor?.wood ?? 'mel';
  const wall = decor?.wall ?? 'creme';
  const pattern = decor?.pattern ?? 'liso';
  const lights = decor?.lights ?? null;
  return (
    <Modal title="Estilo da estante" onClose={onClose}>
      <div className="stack" style={{ gap: 18 }}>
        <fieldset className="decor-field">
          <legend>Madeira</legend>
          <div className="style-opts">
            {WOODS.map((w) => (
              <button key={w.id} type="button" className={`style-opt ${wood === w.id ? 'on' : ''}`} aria-pressed={wood === w.id} onClick={() => onStyle({ wood: w.id })}>
                <span className="style-chip" style={{ background: `linear-gradient(${w.edge} 0 22%, ${w.plank} 22%)`, border: `4px solid ${w.frame}` }} />
                {w.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="decor-field">
          <legend>Fundo</legend>
          <div className="style-opts">
            {WALLS.map((w) => (
              <button key={w.id} type="button" className={`style-opt ${wall === w.id ? 'on' : ''}`} aria-pressed={wall === w.id} onClick={() => onStyle({ wall: w.id })}>
                <span className="style-chip" style={{ background: wallBackground(w.id, pattern) }} />
                {w.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="decor-field">
          <legend>Padrão do fundo</legend>
          <div className="style-opts">
            {PATTERNS.map((p) => (
              <button key={p.id} type="button" className={`style-opt ${pattern === p.id ? 'on' : ''}`} aria-pressed={pattern === p.id} onClick={() => onStyle({ pattern: p.id })}>
                <span className="style-chip" style={{ background: wallBackground(wall, p.id) }} />
                {p.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="decor-field">
          <legend>Varal de luzinhas</legend>
          <div className="seg" role="group">
            {(
              [
                [null, 'Sem'],
                ['quente', 'Amarelas'],
                ['colorida', 'Coloridas']
              ] as const
            ).map(([v, label]) => (
              <button key={label} type="button" className={lights === v ? 'on' : ''} aria-pressed={lights === v} onClick={() => onStyle({ lights: v })}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="decor-field">
          <legend>Prateleiras</legend>
          <div className="row" style={{ gap: 12 }}>
            <button type="button" className="btn btn-sm" onClick={() => onRows(rowCount - 1)} disabled={rowCount <= minRows} aria-label="Uma prateleira a menos">
              −
            </button>
            <b style={{ minWidth: 24, textAlign: 'center' }}>{rowCount}</b>
            <button type="button" className="btn btn-sm" onClick={() => onRows(rowCount + 1)} disabled={rowCount >= 20} aria-label="Uma prateleira a mais">
              +
            </button>
            <span className="tiny muted">Prateleiras vazias são boas pra enfeites.</span>
          </div>
        </fieldset>

        <div className="row between wrap" style={{ gap: 10 }}>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              if (window.confirm('Voltar a estante ao original? Os enfeites que você colocou e o estilo escolhido saem.')) {
                onReset();
                onClose();
              }
            }}
          >
            Voltar ao original
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
            Pronto
          </button>
        </div>
      </div>
    </Modal>
  );
}
