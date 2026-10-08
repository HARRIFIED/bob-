import { Terminal } from 'lucide-react';
import { useSimulator } from '../../store/simulator-store';
export function LogsPanel() {
  const { result, running, phase } = useSimulator();
  const logs = running ? result?.logs.slice(0, 3 + phase) : result?.logs;
  return <div className="logs-panel"><div className="dock-panel-description"><Terminal size={13} /><span>Application & infrastructure logs</span><span className="mono">GET /balance</span></div>{logs ? <div className="log-rows" role="log" aria-label="Simulation logs" aria-live={running ? 'off' : 'polite'}>{logs.map((log, i) => <div className={`log-row log-${log.level.toLowerCase()}`} key={`${i}-${log.message}`}><time>{log.time}</time><strong>{log.level}</strong><span>{log.message}</span></div>)}</div> : <div className="dock-empty"><Terminal size={24} /><p>No logs yet. Run traffic to see what production tells you.</p></div>}</div>;
}
