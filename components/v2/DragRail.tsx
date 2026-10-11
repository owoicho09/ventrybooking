'use client';

import { useRef } from 'react';

/**
 * Horizontal snap rail that can also be dragged with a mouse. Touch devices
 * use native scrolling (pointer drag is only wired for mouse), so phones keep
 * momentum scrolling and nothing fights the browser.
 */
export function DragRail({ children, label }: { children: React.ReactNode; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !ref.current) return;
    drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 5) {
      d.moved = true;
      el.classList.add('dragging');
      el.setPointerCapture(e.pointerId);
    }
    if (d.moved) el.scrollLeft = d.left - dx;
  };
  const end = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d?.moved || !el) return;
    el.releasePointerCapture?.(e.pointerId);
    // Let snapping settle from wherever the drag left off.
    requestAnimationFrame(() => el.classList.remove('dragging'));
  };

  return (
    <div className="v-rail-outer">
      <div
        ref={ref}
        className="v-rail"
        role="region"
        aria-label={label}
        tabIndex={label ? 0 : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onDragStart={e => e.preventDefault()}
      >
        {children}
      </div>
    </div>
  );
}
