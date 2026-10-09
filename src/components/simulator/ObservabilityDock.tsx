import { Activity, BookOpen, ChevronDown, ChevronUp, Coins, GitBranch, Terminal } from 'lucide-react';
import { useRef } from 'react';
import { useSimulator } from '../../store/simulator-store';
import type { DockTab } from '../../store/simulator-store';
import { MetricsPanel } from '../telemetry/MetricsPanel';
import { LogsPanel } from '../telemetry/LogsPanel';
import { TracesPanel } from '../telemetry/TracesPanel';
import { CostPanel } from '../telemetry/CostPanel';
import { LedgerPanel } from '../telemetry/LedgerPanel';

const baseTabs = [{ name: 'Metrics', icon: Activity }, { name: 'Logs', icon: Terminal }, { name: 'Traces', icon: GitBranch }, { name: 'Cost', icon: Coins }] as const;

export function ObservabilityDock({ collapsed, onToggle, onOpen }: { collapsed: boolean; onToggle: () => void; onOpen: () => void }) {
  const { tab, setTab, result, running, stale, runCount, scenario } = useSimulator();
  const ref = useRef<HTMLDivElement>(null);
  const tabs = scenario.engine === 'transfers' ? [{ name: 'Ledger' as const, icon: BookOpen }, ...baseTabs] : baseTabs;
  const panel = tab === 'Ledger' ? <LedgerPanel /> : tab === 'Metrics' ? <MetricsPanel /> : tab === 'Logs' ? <LogsPanel /> : tab === 'Traces' ? <TracesPanel /> : <CostPanel />;
  return <section id="observability-panel" className="observability" aria-label="Observability dock">
    <div className="dock-header">
      <div role="tablist" aria-label="Observability" ref={ref} onKeyDown={event => {
        const index = tabs.findIndex(t => t.name === tab);
        const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
        if (next !== null) {
          event.preventDefault();
          setTab(tabs[next].name as DockTab);
          onOpen();
          (ref.current?.children[next] as HTMLButtonElement)?.focus();
        }
      }}>
        {tabs.map(({ name, icon: Icon }) => <button key={name} id={`tab-${name}`} role="tab" aria-selected={tab === name} aria-controls={`panel-${name}`} tabIndex={tab === name ? 0 : -1} className={tab === name ? 'active' : ''} onClick={() => { setTab(name); onOpen(); }}>
          <Icon size={14} aria-hidden="true" />{name}{name === 'Logs' && result?.logs.some(l => l.level === 'ERROR') && <span className="tab-dot" />}
        </button>)}
      </div>
      <div className="dock-header-actions">
        <span className={`dock-status ${stale ? 'text-amber' : ''}`}>{tab === 'Cost' ? 'CURRENT ARCHITECTURE' : running ? '● COLLECTING' : stale ? 'PREVIOUS RUN · RERUN TO UPDATE' : runCount ? `RUN ${String(runCount).padStart(2, '0')} · COMPLETE` : 'NO DATA YET'}</span>
        <button className="icon-button" onClick={onToggle} aria-label={collapsed ? 'Expand observability panel' : 'Collapse observability panel'} aria-expanded={!collapsed} aria-controls={`panel-${tab}`} title={collapsed ? 'Expand observability panel' : 'Collapse observability panel'}>
          {collapsed ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
      </div>
    </div>
    <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0} className="dock-content" hidden={collapsed}>{panel}</div>
  </section>;
}
