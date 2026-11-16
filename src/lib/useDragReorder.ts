import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export interface DropTarget {
  id: string;
  /** soltar depois (à direita) do alvo */
  after: boolean;
}

/**
 * Arrastar para reordenar com pointer events (mouse e toque).
 * Os itens precisam ter `data-drag-id`. Um "fantasma" (cópia do item) segue o dedo
 * e a página rola sozinha perto das bordas da tela.
 */
export function useDragReorder(enabled: boolean, onDrop: (dragId: string, target: DropTarget) => void) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<DropTarget | null>(null);
  const st = useRef<{
    id: string;
    ghost: HTMLElement;
    dx: number;
    dy: number;
    x: number;
    y: number;
    target: DropTarget | null;
    raf: number;
  } | null>(null);
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;

  const findTarget = (x: number, y: number): DropTarget | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drag-id]');
    if (!el || !st.current) return null;
    const id = el.dataset.dragId!;
    if (id === st.current.id) return null;
    const r = el.getBoundingClientRect();
    return { id, after: x > r.left + r.width / 2 };
  };

  const cleanup = useCallback(() => {
    const s = st.current;
    if (!s) return;
    cancelAnimationFrame(s.raf);
    s.ghost.remove();
    st.current = null;
    document.body.classList.remove('dragging');
    setDragId(null);
    setOver(null);
  }, []);

  useEffect(() => cleanup, [cleanup]);
  useEffect(() => {
    if (!enabled) cleanup();
  }, [enabled, cleanup]);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const el = e.currentTarget;
    const id = el.dataset.dragId;
    if (!id) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    const ghost = el.cloneNode(true) as HTMLElement;
    ghost.removeAttribute('data-drag-id');
    ghost.classList.add('drag-ghost');
    Object.assign(ghost.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: '0', zIndex: '1000', pointerEvents: 'none' });
    document.body.appendChild(ghost);
    document.body.classList.add('dragging');
    st.current = { id, ghost, dx: e.clientX - r.left, dy: e.clientY - r.top, x: e.clientX, y: e.clientY, target: null, raf: 0 };
    setDragId(id);

    const move = (ev: PointerEvent) => {
      const s = st.current;
      if (!s) return;
      s.x = ev.clientX;
      s.y = ev.clientY;
      s.ghost.style.left = `${ev.clientX - s.dx}px`;
      s.ghost.style.top = `${ev.clientY - s.dy}px`;
      const t = findTarget(ev.clientX, ev.clientY);
      if (t?.id !== s.target?.id || t?.after !== s.target?.after) {
        s.target = t;
        setOver(t);
      }
    };
    // rola a página quando o dedo chega perto do topo/rodapé
    const scroll = () => {
      const s = st.current;
      if (!s) return;
      const edge = 70;
      const speed = s.y < edge ? -(edge - s.y) / 4 : s.y > window.innerHeight - edge ? (s.y - (window.innerHeight - edge)) / 4 : 0;
      if (speed) {
        window.scrollBy(0, speed);
        const t = findTarget(s.x, s.y);
        if (t?.id !== s.target?.id || t?.after !== s.target?.after) {
          s.target = t;
          setOver(t);
        }
      }
      s.raf = requestAnimationFrame(scroll);
    };
    st.current.raf = requestAnimationFrame(scroll);

    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const s = st.current;
      const target = ev.type === 'pointerup' ? s?.target : null;
      const dragged = s?.id;
      cleanup();
      if (dragged && target) dropRef.current(dragged, target);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return {
    dragId,
    over,
    /** props para cada item arrastável */
    itemProps: (id: string) => ({
      'data-drag-id': id,
      onPointerDown,
      // no modo de organizar, tocar não abre o livro
      onClick: enabled ? (e: { preventDefault: () => void }) => e.preventDefault() : undefined,
      onDragStart: (e: { preventDefault: () => void }) => e.preventDefault()
    })
  };
}

/** Move `dragId` para antes/depois de `target.id` dentro de `ids`. */
export function moveId(ids: string[], dragId: string, target: DropTarget): string[] {
  const rest = ids.filter((x) => x !== dragId);
  const i = rest.indexOf(target.id);
  if (i < 0) return ids;
  rest.splice(target.after ? i + 1 : i, 0, dragId);
  return rest;
}
