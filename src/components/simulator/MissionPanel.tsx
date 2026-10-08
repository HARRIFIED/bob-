import { Check, Circle, Flag, Lightbulb, PanelRightClose, PanelRightOpen, TriangleAlert } from 'lucide-react';
import { useSimulator } from '../../store/simulator-store';
import { monthlyCost, money } from '../../simulation/cost';
import { EngineerCheckpoint } from '../bob/EngineerCheckpoint';
import { ComponentInspector } from './ComponentInspector';

export function MissionPanel({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { scenario, result, stale, running, architecture, selectedId, runCount } = useSimulator();
  const cost = monthlyCost(architecture);
  const valid = result && !stale && !running;
  const passed = scenario.objectives.filter(o => o.id === 'cost' ? cost <= scenario.budget : valid && result.objectives.find(r => r.id === o.id)?.passed).length;
  return <aside id="mission-panel" className={`mission-panel${collapsed ? ' mission-compact' : ''}`} aria-label="Mission and component details" tabIndex={collapsed ? -1 : 0}><div className="sidebar-heading"><h2><Flag size={14} />{selectedId ? 'Component details' : 'Mission objectives'}</h2><span className="mono">{passed}/5</span><button className="icon-button desktop-layout-control" onClick={onToggle} aria-label={collapsed ? 'Expand Mission panel' : 'Collapse Mission panel'} aria-expanded={!collapsed} aria-controls="mission-panel-body" title={collapsed ? 'Expand Mission panel' : 'Collapse Mission panel'}>{collapsed ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}</button></div>{collapsed && <span className="mission-rail-label" aria-hidden="true">{selectedId ? 'INSPECTOR' : 'MISSION'} · {passed}/5</span>}<div id="mission-panel-body" hidden={collapsed}>{selectedId ? <ComponentInspector key={selectedId} /> : <><div className="mission-panel-intro"><span className="eyebrow">MISSION 01</span><h3>Keep payday running.</h3><p>Meet every requirement at 12,000 req/s.</p></div><ul className="objectives">{scenario.objectives.map(o => {
    const evaluated = result?.objectives.find(r => r.id === o.id);
    const pass = o.id === 'cost' ? cost <= scenario.budget : valid && evaluated?.passed;
    const fail = o.id !== 'cost' ? valid && !pass : !pass;
    const value = o.id === 'cost' ? money(cost) : valid ? `${evaluated?.actual}${o.unit}` : '—';
    return <li key={o.id} className={pass ? 'objective-pass' : fail ? 'objective-fail' : ''}><span className="objective-icon">{pass ? <Check size={14} /> : fail ? <TriangleAlert size={13} /> : <Circle size={13} />}</span><div><span>{o.label}</span><small>{o.comparison === 'lt' ? '< ' : o.comparison === 'lte' ? '≤ ' : o.comparison === 'gte' ? '≥ ' : ''}{o.unit === '$' ? money(o.target) : `${o.target}${o.unit}`}</small></div><strong className="mono" aria-label={`${o.label} ${pass ? 'passed' : fail ? 'failed' : 'not measured'}: ${value}`}>{value}</strong></li>;
  })}</ul>{valid && <EngineerCheckpoint key={runCount} topic={result.mentor.id} />}<div className="learning-tip"><Lightbulb size={17} /><div><strong>{runCount ? 'Follow the slowest dependency.' : 'Start with a baseline.'}</strong><p>{runCount ? 'A request can only be as fast as the services it waits for. The Traces tab shows where the time goes.' : 'Run the existing architecture first. A failing system has useful things to tell you.'}</p></div></div><div className="mission-correctness"><span className="status-dot" /><span>Correctness model: PostgreSQL is authoritative; writes invalidate cached balances.</span></div></>}</div></aside>;
}
