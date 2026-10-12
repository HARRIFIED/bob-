import { BookOpen, Check, Circle, Flag, Lightbulb, ListChecks, PanelRightClose, PanelRightOpen, TriangleAlert } from 'lucide-react';
import { useSimulator } from '../../store/simulator-store';
import { componentGuides } from '../../learning/component-guides';
import { monthlyCost } from '../../simulation/cost';
import { objectiveTarget, objectiveValue } from '../../simulation/format';
import { objectivePasses } from '../../simulation/formulas';
import type { MissionObjective } from '../../simulation/types';
import { EngineerCheckpoint, checkpointFor } from '../bob/EngineerCheckpoint';
import { SandboxControls } from './SandboxControls';
import { ComponentInspector } from './ComponentInspector';

interface MeasuredObjective { objective: MissionObjective; actual: number | null; passed: boolean }

function ObjectiveList({ objectives }: { objectives: MeasuredObjective[] }) {
  return <ul className="objectives">{objectives.map(({ objective, actual, passed }) => {
    const fail = actual !== null && !passed;
    const value = actual === null ? '—' : objectiveValue(objective, actual);
    return <li key={objective.id} className={passed ? 'objective-pass' : fail ? 'objective-fail' : ''}>
      <span className="objective-icon">{passed ? <Check size={14} /> : fail ? <TriangleAlert size={13} /> : <Circle size={13} />}</span>
      <div><span>{objective.label}</span><small>{objectiveTarget(objective)}</small></div>
      <strong className="mono" aria-label={`${objective.label} ${passed ? 'passed' : fail ? 'failed' : 'not measured'}: ${value}`}>{value}</strong>
    </li>;
  })}</ul>;
}

export function MissionPanel({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { scenario, result, stale, running, architecture, selectedId, runCount, sandbox, lab, openGuide, answerCheck } = useSimulator();
  const cost = monthlyCost(architecture);
  const valid = result && !stale && !running;
  const objectives = scenario.objectives.map(objective => {
    const actual = objective.id === 'cost' ? cost : valid ? result.telemetry[objective.id] : null;
    return { objective, actual, passed: actual !== null && objectivePasses(objective, actual) };
  });
  const passed = objectives.filter(item => item.passed).length;
  const guide = lab ? componentGuides[lab.component] : null;
  const heading = selectedId ? 'Component details' : sandbox ? 'Experiment settings' : lab ? 'Lab goals' : 'Mission objectives';
  const rail = selectedId ? 'INSPECTOR' : sandbox ? 'SANDBOX' : lab ? 'LAB' : 'MISSION';
  return (
    <aside id="mission-panel" className={`mission-panel${collapsed ? ' mission-compact' : ''}`} aria-label="Mission and component details" tabIndex={collapsed ? -1 : 0}>
      <div className="sidebar-heading">
        <h2><Flag size={14} />{heading}</h2>
        <span className="mono">{passed}/{objectives.length}</span>
        <button className="icon-button desktop-layout-control" onClick={onToggle} aria-label={collapsed ? 'Expand Mission panel' : 'Collapse Mission panel'} aria-expanded={!collapsed} aria-controls="mission-panel-body" title={collapsed ? 'Expand Mission panel' : 'Collapse Mission panel'}>
          {collapsed ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}
        </button>
      </div>
      {collapsed && <span className="mission-rail-label" aria-hidden="true">{rail} · {passed}/{objectives.length}</span>}
      <div id="mission-panel-body" hidden={collapsed}>
        {selectedId ? <ComponentInspector key={selectedId} /> : sandbox ? <>
          <SandboxControls />
          <ul className="objectives">{objectives.map(({ objective, actual, passed: pass }) => (
            <li key={objective.id}><div>{objective.label}<small>{objectiveTarget(objective)}</small></div><strong>{actual === null ? '—' : objectiveValue(objective, actual)} {actual !== null && (pass ? '✓' : '!')}</strong></li>
          ))}</ul>
        </> : <>
          <div className="mission-panel-intro">
            <span className="eyebrow">{lab && guide ? `LAB · ${guide.title.toUpperCase()}` : `MISSION ${scenario.number}`}</span>
            <h3>{scenario.presentation.missionTitle}</h3>
            <p>{lab ? scenario.description : `Meet every requirement after the full ${scenario.engine === 'transfers' ? 'retry sequence' : `${scenario.trafficProfile.peak.toLocaleString('en-US')} req/s ramp`}.`}</p>
            {lab && guide && <button className="text-link lab-guide-link" onClick={() => openGuide(lab.component)}>
              <BookOpen size={13} aria-hidden="true" /> {guide.title} field guide
            </button>}
          </div>
          <ObjectiveList objectives={objectives} />
          {valid && <EngineerCheckpoint
            key={runCount}
            quiz={lab ? lab.quiz : checkpointFor(result.mentor.id, scenario.id)}
            onAnswer={correct => answerCheck(lab ? `lab:${lab.id}` : `${scenario.id}:${result.mentor.id}`, correct)}
          />}
          {lab ? <div className="learning-tip lab-steps">
            <ListChecks size={17} />
            <div>
              <strong>Suggested experiment</strong>
              <ol>{lab.steps.map(step => <li key={step}>{step}</li>)}</ol>
            </div>
          </div> : <div className="learning-tip">
            <Lightbulb size={17} />
            <div>
              <strong>{runCount ? 'Follow the evidence.' : 'Start with a baseline.'}</strong>
              <p>{runCount ? scenario.presentation.learningTip : 'Run the existing architecture first. A failing system has useful things to tell you.'}</p>
            </div>
          </div>}
          <div className="mission-correctness"><span className="status-dot" /><span>{scenario.presentation.correctnessNote}</span></div>
        </>}
      </div>
    </aside>
  );
}
