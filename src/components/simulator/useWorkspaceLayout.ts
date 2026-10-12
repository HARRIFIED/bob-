import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

const defaults = { paletteWidth: 226, missionWidth: 284, dockHeight: 280 };
const limit = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Layout preferences are independent of architecture and simulation results. */
export function useWorkspaceLayout() {
  const gridRef = useRef<HTMLDivElement>(null);
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 901px)').matches);
  const [bounds, setBounds] = useState({ width: window.innerWidth, height: Math.max(400, window.innerHeight - 224) });
  const [layout, setLayout] = useState({ ...defaults, paletteCollapsed: false, missionCollapsed: false, dockCollapsed: false, expanded: false });

  useEffect(() => {
    const media = window.matchMedia('(min-width: 901px)');
    const update = () => setDesktop(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useLayoutEffect(() => {
    const element = gridRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBounds(previous => previous.width === width && previous.height === height ? previous : { width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Keep at least 320px for the diagram, even after resizing the browser window.
  const sideBudget = Math.max(410, bounds.width - 320 - 12);
  const missionWanted = layout.missionCollapsed ? 44 : limit(layout.missionWidth, 230, 460);
  const paletteWidth = layout.paletteCollapsed ? 60 : limit(layout.paletteWidth, 180, Math.min(360, sideBudget - missionWanted));
  const missionWidth = layout.missionCollapsed ? 44 : limit(missionWanted, 230, sideBudget - paletteWidth);
  const paletteMax = Math.min(360, sideBudget - missionWidth);
  const missionMax = Math.min(460, sideBudget - paletteWidth);
  const dockMax = Math.max(140, Math.min(680, Math.floor(bounds.height - 226)));
  const dockHeight = layout.dockCollapsed ? 44 : limit(layout.dockHeight, 140, dockMax);
  const expanded = desktop && layout.expanded;

  useEffect(() => {
    if (!expanded) return;
    const exit = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('dialog[open]')) {
        setLayout(previous => ({ ...previous, expanded: false }));
        document.getElementById('architecture-expand')?.focus();
      }
    };
    window.addEventListener('keydown', exit);
    return () => window.removeEventListener('keydown', exit);
  }, [expanded]);

  return {
    gridRef, desktop, expanded, paletteWidth, missionWidth, dockHeight, paletteMax, missionMax, dockMax,
    paletteCollapsed: desktop && layout.paletteCollapsed,
    missionCollapsed: desktop && layout.missionCollapsed,
    dockCollapsed: layout.dockCollapsed,
    style: { '--palette-width': `${paletteWidth}px`, '--mission-width': `${missionWidth}px`, '--dock-height': `${dockHeight}px` } as CSSProperties,
    resizePalette: (value: number) => setLayout(previous => value < 120
      ? { ...previous, paletteCollapsed: true }
      : { ...previous, paletteCollapsed: false, paletteWidth: limit(Math.round(value), 180, paletteMax) }),
    resizeMission: (value: number) => setLayout(previous => value < 140
      ? { ...previous, missionCollapsed: true }
      : { ...previous, missionCollapsed: false, missionWidth: limit(Math.round(value), 230, missionMax) }),
    resizeDock: (value: number) => setLayout(previous => value < 100
      ? { ...previous, dockCollapsed: true }
      : { ...previous, dockCollapsed: false, dockHeight: limit(Math.round(value), 140, dockMax) }),
    togglePalette: () => setLayout(previous => ({ ...previous, paletteCollapsed: !previous.paletteCollapsed })),
    toggleMission: () => setLayout(previous => ({ ...previous, missionCollapsed: !previous.missionCollapsed })),
    toggleDock: () => setLayout(previous => ({ ...previous, dockCollapsed: !previous.dockCollapsed })),
    toggleExpanded: () => setLayout(previous => ({ ...previous, expanded: !previous.expanded })),
    showDock: () => setLayout(previous => ({ ...previous, dockCollapsed: false })),
    showInspector: () => setLayout(previous => ({ ...previous, expanded: false, missionCollapsed: false })),
    resetPalette: () => setLayout(previous => ({ ...previous, paletteWidth: defaults.paletteWidth, paletteCollapsed: false })),
    resetMission: () => setLayout(previous => ({ ...previous, missionWidth: defaults.missionWidth, missionCollapsed: false })),
    resetDock: () => setLayout(previous => ({ ...previous, dockHeight: defaults.dockHeight, dockCollapsed: false })),
  };
}
