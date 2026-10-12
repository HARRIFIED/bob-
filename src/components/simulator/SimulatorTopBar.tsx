import { BookOpen, ChevronRight, CircleHelp, LoaderCircle, Play, Radio, RotateCcw } from 'lucide-react';
import { componentGuides } from '../../learning/component-guides';
import { useSimulator } from '../../store/simulator-store';
import { monthlyCost, money } from '../../simulation/cost';
import { definitions } from '../../data/component-definitions';
import { Logo } from '../shared';

export function SimulatorTopBar() {
  const s = useSimulator();
  const cost = monthlyCost(s.architecture);
  return <>
    <header className="sim-header">
      <Logo onClick={() => s.navigate('entry')} />
      <nav aria-label="Mission breadcrumb">
        <button className="text-link" onClick={() => s.navigate('entry')} disabled={s.running}>{s.lab ? 'Labs' : 'Missions'}</button>
        <ChevronRight size={13} /><span>{s.lab ? componentGuides[s.lab.component].title : s.scenario.company}</span><ChevronRight size={13} /><strong>{s.scenario.title}</strong>
      </nav>
      {s.lab
        ? <button className="text-link" onClick={() => s.lab && s.openGuide(s.lab.component)}><BookOpen size={15} /> Field guide</button>
        : !s.sandbox && <button className="text-link" onClick={() => s.navigate('brief')} disabled={s.running}><CircleHelp size={15} /> Mission brief</button>}
    </header>
    <div className="sim-topbar">
      <div className="sim-title">
        <div className="eyebrow"><Radio size={12} /> PRODUCTION LAB <span className="sim-id">/ {s.scenario.incidentId}</span></div>
        <h1>{s.scenario.title} <span className={`workspace-status ${s.running ? 'running' : s.stale ? 'changed' : s.result?.missionState ?? 'idle'}`}>
          {s.running ? 'SIMULATING' : s.stale ? 'CHANGES PENDING' : s.sandbox && s.result ? 'RUN COMPLETE'
            : s.result?.missionState === 'stable' ? s.lab ? 'GOAL MET' : 'STABLE'
            : s.result ? s.lab ? 'IN PROGRESS' : 'INCIDENT OPEN' : 'AWAITING TRAFFIC'}
        </span></h1>
      </div>
      <div className="topbar-stat"><span>{s.scenario.presentation.loadLabel}</span><strong>{s.scenario.trafficProfile.peak.toLocaleString('en-US')} <small>req/s</small></strong></div>
      <div className={`topbar-stat topbar-budget ${cost > s.scenario.budget ? 'over-budget' : ''}`}>
        <span>{s.architecture.nodes.some(n => !definitions[n.kind].available) ? 'PARTIAL ESTIMATE' : 'MONTHLY ESTIMATE'}</span><strong>{money(cost)} <small>/ {money(s.scenario.budget)}</small></strong>
        <span>{cost > s.scenario.budget ? `OVER BUDGET · ${money(cost - s.scenario.budget)}` : `${money(s.scenario.budget - cost)} remaining`}</span>
      </div>
      <div className="run-controls">
        <button className="button primary run-button" onClick={s.run} disabled={s.running}>
          {s.running ? <LoaderCircle size={16} className="spin" /> : s.runCount ? <RotateCcw size={16} /> : <Play size={16} fill="currentColor" />}
          {s.running ? 'Simulating…' : s.runCount ? 'Run Again' : 'Run Simulation'}
        </button>
        {s.running && <button className="skip-button" onClick={s.skip}>Skip animation</button>}
      </div>
    </div>
  </>;
}
