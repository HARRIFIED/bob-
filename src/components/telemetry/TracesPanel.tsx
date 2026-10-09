import { GitBranch } from 'lucide-react';
import { useSimulator } from '../../store/simulator-store';

export function TracesPanel() {
  const { result, scenario } = useSimulator();
  if (!result?.trace.length) return <div className="dock-empty"><GitBranch size={24} aria-hidden="true" /><p>Run traffic to capture a request trace.</p></div>;
  const transfers = scenario.engine === 'transfers';
  const total = result.trace.reduce((n, span) => n + span.duration, 0);
  return <div className="traces-panel">
    <div className="trace-heading"><span><span className="method-label">{scenario.presentation.requestMethod}</span> {scenario.presentation.requestPath} <span className="text-muted">· {transfers ? 'illustrative commit / retry sequence' : 'illustrative slow request'}</span></span><strong className="mono">{total} ms</strong></div>
    <div className="trace-ruler"><span>0 ms</span><span>{Math.round(total / 2)} ms</span><span>{total} ms</span></div>
    {result.trace.map((span, index) => {
      const offset = result.trace.slice(0, index).reduce((n, previous) => n + previous.duration, 0);
      return <div className={`trace-row trace-${span.kind}`} key={span.name}><span>{span.name}</span><div className="trace-track"><div className="trace-span" style={{ marginLeft: `${offset / total * 100}%`, width: `${span.duration / total * 100}%` }} /></div><strong>{span.duration} ms</strong></div>;
    })}
    <p className="trace-note">{transfers
      ? 'A client timeout can follow a successful commit. This sequence includes the wait and retry; it is separate from accepted-request processing p95. Use Ledger to see whether the retry returns the same receipt or creates another debit.'
      : result.telemetry.dbCpu >= 85 ? 'PostgreSQL is the slowest dependency. Increasing API count does not shorten the database wait.'
      : result.telemetry.apiCpu >= 95 ? 'Database time is down. Requests now spend most of their time waiting for API compute.'
      : 'Cache hits reduce database work. This example shows a cache miss that still reaches PostgreSQL.'}</p>
  </div>;
}
