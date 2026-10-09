import { useEffect, useRef } from 'react';
import { ArrowRight, Check, CheckCheck, LockKeyhole, RotateCcw, X } from 'lucide-react';
import { useSimulator } from '../../store/simulator-store';
import { money } from '../../simulation/cost';
import { transferMoney } from '../../simulation/transfers';
import { missionPreviews } from '../../scenarios';
import { BobAvatar } from '../bob/BobAvatar';

export function MissionCompletion() {
  const { showCompletion, completedResult: result, baseline, scenario, closeCompletion, replay, selectMission } = useSimulator();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (showCompletion && !ref.current?.open) ref.current?.showModal();
    if (!showCompletion && ref.current?.open) ref.current?.close();
  }, [showCompletion]);
  if (!result) return null;
  const transfers = scenario.engine === 'transfers';
  const rows = [
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
  const nextMission = missionPreviews[missionPreviews.findIndex(mission => mission.id === scenario.id) + 1];
  return <dialog ref={ref} className="completion-dialog" aria-labelledby="completion-title" onCancel={closeCompletion}>
    <button className="icon-button dialog-close" aria-label="Close mission debrief" onClick={closeCompletion}><X size={19} /></button>
    <div className="completion-bob"><BobAvatar mood="celebrating" size={116} /><span className="completion-bob-caption">You earned that high-five.</span></div>
    <div className="completion-icon"><CheckCheck size={29} /></div>
    <div className="eyebrow">{scenario.incidentId} / RESOLVED</div>
    <h2 id="completion-title">Mission stable.</h2>
    <p className="completion-subtitle">{scenario.presentation.completionText}</p>
    <div className="completion-checks"><Check size={13} /> Performance <Check size={13} /> Correctness <Check size={13} /> Budget</div>
    <table className="comparison-table">
      <caption className="sr-only">Initial architecture compared with your successful design</caption>
      <thead><tr><th>{transfers ? 'SAME TRANSFERS / FAULTS' : `AT ${scenario.trafficProfile.peak.toLocaleString('en-US')} REQ/S`}</th><th>BEFORE</th><th>YOUR DESIGN</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.name}><th scope="row">{row.name}</th><td>{row.before}</td><td>{row.after}</td></tr>)}</tbody>
    </table>
    <section className="completion-explanation"><h3>Why your design worked</h3><p>{scenario.explanations.worked}</p><h3>Trade-offs to take with you</h3><p>{scenario.explanations.tradeoff}</p></section>
    <div className="completion-actions"><button className="button secondary" onClick={replay}><RotateCcw size={14} /> Replay Mission</button><button className="button primary" onClick={closeCompletion}>Inspect your system <ArrowRight size={15} /></button></div>
    {nextMission && <button className="next-mission" disabled={!nextMission.available} onClick={() => selectMission(nextMission.id)}>
      {nextMission.available ? <ArrowRight size={13} /> : <LockKeyhole size={13} />} Next Mission: {nextMission.title}<span>{nextMission.available ? 'PLAY NOW' : 'COMING SOON'}</span>
    </button>}
  </dialog>;
}
