import { GitBranch } from 'lucide-react';
import { useSimulator } from '../../store/simulator-store';
export function TracesPanel() {
  const { result } = useSimulator();
  if (!result) return <div className="dock-empty"><GitBranch size={24} /><p>Run traffic to capture a request trace.</p></div>;
  const total = result.trace.reduce((n, s) => n + s.duration, 0);
  return <div className="traces-panel"><div className="trace-heading"><span><span className="method-label">GET</span> /balance <span className="text-muted">· illustrative slow request</span></span><strong className="mono">{total} ms</strong></div><div className="trace-ruler"><span>0 ms</span><span>{Math.round(total / 2)} ms</span><span>{total} ms</span></div>{result.trace.map((span, index) => {
    const offset = result.trace.slice(0, index).reduce((n, s) => n + s.duration, 0);
    return <div className={`trace-row trace-${span.kind}`} key={span.name}><span>{span.name}</span><div className="trace-track"><div className="trace-span" style={{ marginLeft: `${offset / total * 100}%`, width: `${span.duration / total * 100}%` }} /></div><strong>{span.duration} ms</strong></div>;
  })}<p className="trace-note">{result.telemetry.dbCpu >= 85 ? 'PostgreSQL is the slowest dependency. Increasing API count does not shorten the database wait.' : result.telemetry.apiCpu >= 95 ? 'Database time is down. Requests now spend most of their time waiting for API compute.' : 'Cache hits reduce database work. This example shows a cache miss that still reaches PostgreSQL.'}</p></div>;
}
