import { useEffect, useRef } from 'react';
import { ArrowRight, Check, CheckCheck, Circle, LockKeyhole, RotateCcw, Star, X } from 'lucide-react';
import { useSimulator } from '../../store/simulator-store';
import { componentGuides } from '../../learning/component-guides';
import { money } from '../../simulation/cost';
import { objectiveValue } from '../../simulation/format';
import { transferMoney } from '../../simulation/transfers';
import { missionPreviews } from '../../scenarios';
import { labs } from '../../scenarios/labs';
import { BobAvatar } from '../bob/BobAvatar';

export function MissionCompletion() {
  const { showCompletion, completedResult: result, baseline, scenario, closeCompletion, replay, selectMission, startLab, navigate, lab, evidenceSeen } = useSimulator();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (showCompletion && !ref.current?.open) ref.current?.showModal();
    if (!showCompletion && ref.current?.open) ref.current?.close();
  }, [showCompletion]);
  if (!result) return null;
  const transfers = scenario.engine === 'transfers';
  const rows = lab ? scenario.objectives.map(objective => ({
    name: objective.label,
    before: objectiveValue(objective, baseline.telemetry[objective.id]),
    after: objectiveValue(objective, result.telemetry[objective.id]),
  })) : [
    ...(transfers ? [
      { name: 'Duplicate debits', before: String(baseline.telemetry.duplicateDebits), after: String(result.telemetry.duplicateDebits) },
      { name: 'Transfers confirmed', before: `${baseline.telemetry.completionRate}%`, after: `${result.telemetry.completionRate}%` },
      ...(baseline.ledger && result.ledger ? [{ name: 'Account balance', before: transferMoney(baseline.ledger.actualBalanceMinor, baseline.ledger.currency), after: transferMoney(result.ledger.actualBalanceMinor, result.ledger.currency) }] : []),
      { name: 'Receipts replayed', before: String(baseline.telemetry.replayedRequests), after: String(result.telemetry.replayedRequests) },
    ] : [
      { name: 'Error rate', before: `${baseline.telemetry.errorRate}%`, after: `${result.telemetry.errorRate}%` },
      { name: 'Database CPU', before: `${baseline.telemetry.dbCpu}%`, after: `${result.telemetry.dbCpu}%` },
      { name: 'Availability', before: `${baseline.telemetry.availability}%`, after: `${result.telemetry.availability}%` },
    ]),
    { name: transfers ? 'Accepted request p95' : 'p95 latency', before: `${baseline.telemetry.p95} ms`, after: `${result.telemetry.p95} ms` },
    { name: 'Monthly cost', before: money(baseline.telemetry.cost), after: money(result.telemetry.cost) },
  ];
  const stars = lab ? [] : [
    { label: 'Stable', earned: true },
    { label: 'Evidence before changes', earned: evidenceSeen },
    ...(scenario.stretchBudget ? [{ label: `Under ${money(scenario.stretchBudget)}`, earned: result.telemetry.cost <= scenario.stretchBudget }] : []),
  ];
  const nextMission = lab ? undefined : missionPreviews[missionPreviews.findIndex(mission => mission.id === scenario.id) + 1];
  const nextLab = lab ? labs[labs.findIndex(item => item.id === lab.id) + 1] : undefined;
  return <dialog ref={ref} className="completion-dialog" aria-labelledby="completion-title" onCancel={closeCompletion}>
    <button className="icon-button dialog-close" aria-label={lab ? 'Close lab debrief' : 'Close mission debrief'} onClick={closeCompletion}><X size={19} /></button>
    <div className="completion-bob"><BobAvatar mood="celebrating" size={116} /><span className="completion-bob-caption">You earned that high-five.</span></div>
    <div className="completion-icon"><CheckCheck size={29} /></div>
    <div className="eyebrow">{lab ? `LAB · ${componentGuides[lab.component].title.toUpperCase()} / COMPLETE` : `${scenario.incidentId} / RESOLVED`}</div>
    <h2 id="completion-title">{lab ? 'Lab complete.' : 'Mission stable.'}</h2>
    <p className="completion-subtitle">{scenario.presentation.completionText}</p>
    {lab
      ? <div className="completion-checks">{scenario.objectives.map(objective => <span key={objective.id}><Check size={13} /> {objective.label}</span>)}</div>
      : <div className="completion-checks"><Check size={13} /> Performance <Check size={13} /> Correctness <Check size={13} /> Budget</div>}
    {stars.length > 0 && <ul className="completion-stars" aria-label="Stars earned">
      {stars.map(star => (
        <li key={star.label} className={star.earned ? 'is-earned' : ''}>
          {star.earned ? <Star size={14} fill="currentColor" aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
          {star.label}<span className="sr-only">{star.earned ? ' — earned' : ' — not yet'}</span>
        </li>
      ))}
    </ul>}
    <table className="comparison-table">
      <caption className="sr-only">Starting design compared with your successful design</caption>
      <thead><tr><th>{lab ? 'LAB GOALS' : transfers ? 'SAME TRANSFERS / FAULTS' : `AT ${scenario.trafficProfile.peak.toLocaleString('en-US')} REQ/S`}</th><th>BEFORE</th><th>YOUR DESIGN</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.name}><th scope="row">{row.name}</th><td>{row.before}</td><td>{row.after}</td></tr>)}</tbody>
    </table>
    <section className="completion-explanation"><h3>Why your design worked</h3><p>{scenario.explanations.worked}</p><h3>Trade-offs to take with you</h3><p>{scenario.explanations.tradeoff}</p></section>
    <div className="completion-actions">
      <button className="button secondary" onClick={replay}><RotateCcw size={14} /> {lab ? 'Replay Lab' : 'Replay Mission'}</button>
      <button className="button primary" onClick={closeCompletion}>Inspect your system <ArrowRight size={15} /></button>
    </div>
    {lab && <button className="next-mission" onClick={() => {
      if (nextLab) startLab(nextLab.id);
      else { closeCompletion(); navigate('entry'); }
    }}>
      <ArrowRight size={13} /> {nextLab ? `Next lab: ${nextLab.title}` : 'All labs done · back to the lab map'}<span>{nextLab ? 'START' : 'HOME'}</span>
    </button>}
    {nextMission && <button className="next-mission" disabled={!nextMission.available} onClick={() => selectMission(nextMission.id)}>
      {nextMission.available ? <ArrowRight size={13} /> : <LockKeyhole size={13} />} Next Mission: {nextMission.title}<span>{nextMission.available ? 'PLAY NOW' : 'COMING SOON'}</span>
    </button>}
  </dialog>;
}
