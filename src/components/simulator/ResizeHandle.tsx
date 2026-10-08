import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';

interface ResizeHandleProps {
  panel: 'components' | 'mission' | 'observability';
  label: string; value: number; min: number; max: number;
  axis: 'x' | 'y'; direction: 1 | -1; collapsed: boolean;
  onResize: (value: number) => void; onToggle: () => void; onReset: () => void;
}

export function ResizeHandle({ panel, label, value, min, max, axis, direction, collapsed, onResize, onToggle, onReset }: ResizeHandleProps) {
  const drag = useRef<{ pointerId: number; start: number; value: number } | null>(null);
  const [resizing, setResizing] = useState(false);
  const stop = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    setResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <div
    className={`resize-handle resize-${panel}`}
    role="separator" tabIndex={0} aria-label={label}
    aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
    aria-valuenow={Math.round(value)} aria-valuemin={min} aria-valuemax={Math.floor(max)}
    aria-valuetext={collapsed ? 'Collapsed' : `${Math.round(value)} pixels`}
    aria-controls={`${panel}-panel`} aria-describedby="panel-resize-help"
    title={`${label} · drag or use arrow keys · double-click to reset`}
    data-resizing={resizing || undefined}
    onDoubleClick={onReset}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { pointerId: event.pointerId, start: axis === 'x' ? event.clientX : event.clientY, value };
      setResizing(true);
    }}
    onPointerMove={event => {
      if (!drag.current || event.pointerId !== drag.current.pointerId) return;
      const position = axis === 'x' ? event.clientX : event.clientY;
      onResize(drag.current.value + (position - drag.current.start) * direction);
    }}
    onPointerUp={stop} onPointerCancel={stop}
    onLostPointerCapture={() => { drag.current = null; setResizing(false); }}
    onKeyDown={event => {
      const negative = axis === 'x' ? 'ArrowLeft' : 'ArrowUp';
      const positive = axis === 'x' ? 'ArrowRight' : 'ArrowDown';
      if (![negative, positive, 'Home', 'End', 'Enter'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Enter') { onToggle(); return; }
      if (event.key === 'Home') { onResize(min); return; }
      if (event.key === 'End') { onResize(max); return; }
      const step = (event.shiftKey ? 40 : 16) * (event.key === positive ? 1 : -1) * direction;
      if (collapsed && step > 0) onToggle();
      else if (value + step <= (panel === 'components' ? 180 : panel === 'mission' ? 230 : 140) && step < 0) onResize(min);
      else onResize(value + step);
    }}
  ><span aria-hidden="true" /></div>;
}
