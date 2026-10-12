import { ReactFlowProvider } from '@xyflow/react';
import { useState } from 'react';
import { CheckCheck, ChevronRight, Cpu, Flag, Layers3 } from 'lucide-react';
import { useSimulator } from '../../store/simulator-store';
import { EstimateNote } from '../shared';
import { ArchitectureCanvas } from './ArchitectureCanvas';
import { ComponentPalette } from './ComponentPalette';
import { MissionPanel } from './MissionPanel';
import { SimulatorTopBar } from './SimulatorTopBar';
import { ObservabilityDock } from './ObservabilityDock';
import { MissionCompletion } from './MissionCompletion';
import { ResizeHandle } from './ResizeHandle';
import { useWorkspaceLayout } from './useWorkspaceLayout';
import { BobCoach } from '../bob/BobCoach';
import type { BobAction } from '../../learning/bob-coaching';
export function SimulatorWorkspace() {
  const s = useSimulator();
  const layout = useWorkspaceLayout();
  const [mobilePanel, setMobilePanel] = useState('architecture');
  const inspect = () => {
    layout.showInspector();
    if (!layout.desktop) setMobilePanel('mission');
  };
  const coachAction = (action: BobAction) => {
    if (action === 'run') s.run();
    else if (action === 'debrief') s.openCompletion();
    else {
      s.setTab(action);
      layout.showDock();
      if (layout.expanded) layout.toggleExpanded();
      if (!layout.desktop) setMobilePanel('architecture');
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[role="tab"][aria-selected="true"]`)?.focus());
    }
  };
  return <ReactFlowProvider><div className="sim-shell">
    <SimulatorTopBar />
    <main id="main-content" tabIndex={-1}>
      <div className="workspace-context">
        <div><span className="status-dot amber" /><span>{s.sandbox && !s.running ? s.runBlocker ?? (s.stale ? 'Experiment changed. Rerun to measure it.' : s.result ? 'Experiment complete. Compare the measurements below.' : 'Build, connect, and run your own experiment.') : s.running ? s.scenario.scriptedEvents[s.phase].phase : s.stale ? 'Architecture updated. Run the same traffic to compare results.' : s.result?.missionState === 'stable' ? 'All objectives passed. Service is stable.' : s.result ? 'Incident reproduced. Inspect the evidence and adjust your architecture.' : 'You’re on call. Run the baseline, then follow the evidence.'}</span></div>
        {s.running ? <span className="mono">{s.phase + 1} / {s.scenario.scriptedEvents.length}</span> : !s.sandbox && s.result?.missionState === 'stable' && !s.stale ? <button className="text-link text-green" onClick={s.openCompletion}><CheckCheck size={14} /> Mission debrief <ChevronRight size={13} /></button> : <span className="mono context-hint">OBSERVE → DIAGNOSE → REBUILD</span>}
      </div>
      {s.running && <div className="simulation-progress" role="progressbar" aria-label={s.scenario.engine === 'transfers' ? 'Retry sequence progress' : 'Traffic ramp progress'} aria-valuenow={s.phase + 1} aria-valuemin={0} aria-valuemax={s.scenario.scriptedEvents.length}><span style={{ width: `${(s.phase + 1) / s.scenario.scriptedEvents.length * 100}%` }} /></div>}
      <div className="mobile-panels" aria-label="Workspace panels">{[{ id: 'components', label: 'Components', icon: Layers3 }, { id: 'architecture', label: 'Architecture', icon: Cpu }, { id: 'mission', label: s.selectedId ? 'Inspector' : s.sandbox ? 'Experiment' : 'Mission', icon: Flag }].map(({ id, label, icon: Icon }) => <button key={id} aria-pressed={mobilePanel === id} className={mobilePanel === id ? 'active' : ''} onClick={() => setMobilePanel(id)}><Icon size={14} />{label}</button>)}</div>
      <BobCoach onAction={coachAction} />
      <p id="panel-resize-help" className="sr-only">Use the arrow keys to resize a panel, Shift for larger steps, Enter to collapse or expand, Home to collapse, and End for maximum size. Double-click a divider to reset its size.</p>
      <div ref={layout.gridRef} style={layout.style} className={`sim-grid adjustable-workspace show-${mobilePanel}${layout.expanded ? ' architecture-expanded' : ''}${layout.dockCollapsed ? ' dock-collapsed' : ''}`}>
        <ComponentPalette collapsed={layout.paletteCollapsed} onToggle={layout.togglePalette} />
        <ResizeHandle panel="components" label="Resize Components panel" axis="x" direction={1} value={layout.paletteWidth} min={60} max={layout.paletteMax} collapsed={layout.paletteCollapsed} onResize={layout.resizePalette} onToggle={layout.togglePalette} onReset={layout.resetPalette} />
        <ArchitectureCanvas expanded={layout.expanded} onToggleExpanded={layout.toggleExpanded} onInspect={inspect} />
        <ResizeHandle panel="mission" label="Resize Mission panel" axis="x" direction={-1} value={layout.missionWidth} min={44} max={layout.missionMax} collapsed={layout.missionCollapsed} onResize={layout.resizeMission} onToggle={layout.toggleMission} onReset={layout.resetMission} />
        <MissionPanel collapsed={layout.missionCollapsed} onToggle={layout.toggleMission} />
        <ResizeHandle panel="observability" label="Resize observability panel" axis="y" direction={-1} value={layout.dockHeight} min={44} max={layout.dockMax} collapsed={layout.dockCollapsed} onResize={layout.resizeDock} onToggle={layout.toggleDock} onReset={layout.resetDock} />
        <ObservabilityDock collapsed={layout.dockCollapsed} onToggle={layout.toggleDock} onOpen={layout.showDock} />
      </div>
    </main>
    <footer className="sim-footer"><span className="mono"><span className="status-dot" /> LOCAL SIMULATION <span>· No infrastructure deployed</span></span><span className="estimate-note"><EstimateNote /></span></footer>
    <div className="sr-only" role="status" aria-live="polite">{s.notice}</div>
    <MissionCompletion />
  </div></ReactFlowProvider>;
}
