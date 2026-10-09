import { Check, Circle, Flag, Lightbulb, PanelRightClose, PanelRightOpen, TriangleAlert } from 'lucide-react';
import { useSimulator } from '../../store/simulator-store';
import { monthlyCost } from '../../simulation/cost';
import { objectiveTarget, objectiveValue } from '../../simulation/format';
import { objectivePasses } from '../../simulation/formulas';
import { EngineerCheckpoint } from '../bob/EngineerCheckpoint';
import { ComponentInspector } from './ComponentInspector';

export function MissionPanel({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { scenario, result, stale, running, architecture, selectedId, runCount } = useSimulator();
  const cost = monthlyCost(architecture);
  const valid = result && !stale && !running;
  const objectives = scenario.objectives.map(objective => {
    const actual = objective.id === 'cost' ? cost : valid ? result.telemetry[objective.id] : null;
    return { objective, actual, passed: actual !== null && objectivePasses(objective, actual) };
  });
  const passed = objectives.filter(item => item.passed).length;
  return (
    <aside id="mission-panel" className={`mission-panel${collapsed ? ' mission-compact' : ''}`} aria-label="Mission and component details" tabIndex={collapsed ? -1 : 0}>
      <div className="sidebar-heading">
        <h2><Flag size={14} />{selectedId ? 'Component details' : 'Mission objectives'}</h2>
        <span className="mono">{passed}/{objectives.length}</span>
        <button className="icon-button desktop-layout-control" onClick={onToggle} aria-label={collapsed ? 'Expand Mission panel' : 'Collapse Mission panel'} aria-expanded={!collapsed} aria-controls="mission-panel-body" title={collapsed ? 'Expand Mission panel' : 'Collapse Mission panel'}>
          {collapsed ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}
        </button>
      </div>
      {collapsed && <span className="mission-rail-label" aria-hidden="true">{selectedId ? 'INSPECTOR' : 'MISSION'} · {passed}/{objectives.length}</span>}
      <div id="mission-panel-body" hidden={collapsed}>
        {selectedId ? <ComponentInspector key={selectedId} /> : <>
          <div className="mission-panel-intro"><span className="eyebrow">MISSION {scenario.number}</span><h3>{scenario.presentation.missionTitle}</h3><p>Meet every requirement after the full {scenario.engine === 'transfers' ? 'retry sequence' : `${scenario.trafficProfile.peak.toLocaleString('en-US')} req/s ramp`}.</p></div>
          <ul className="objectives">{objectives.map(({ objective, actual, passed: pass }) => {
            const fail = actual !== null && !pass;
            const value = actual === null ? '—' : objectiveValue(objective, actual);
            return <li key={objective.id} className={pass ? 'objective-pass' : fail ? 'objective-fail' : ''}>
              <span className="objective-icon">{pass ? <Check size={14} /> : fail ? <TriangleAlert size={13} /> : <Circle size={13} />}</span>
              <div><span>{objective.label}</span><small>{objectiveTarget(objective)}</small></div>
              <strong className="mono" aria-label={`${objective.label} ${pass ? 'passed' : fail ? 'failed' : 'not measured'}: ${value}`}>{value}</strong>
            </li>;
          })}</ul>
          {valid && <EngineerCheckpoint key={runCount} topic={result.mentor.id} scenarioId={scenario.id} />}
          <div className="learning-tip"><Lightbulb size={17} /><div><strong>{runCount ? 'Follow the evidence.' : 'Start with a baseline.'}</strong><p>{runCount ? scenario.presentation.learningTip : 'Run the existing architecture first. A failing system has useful things to tell you.'}</p></div></div>
          <div className="mission-correctness"><span className="status-dot" /><span>{scenario.presentation.correctnessNote}</span></div>
        </>}
      </div>
    </aside>
  );
}
