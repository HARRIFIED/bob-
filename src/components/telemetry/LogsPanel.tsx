import { Terminal } from 'lucide-react';
import { useSimulator } from '../../store/simulator-store';

export function LogsPanel() {
  const { result, running, phase, scenario } = useSimulator();
  const logs = running && scenario.engine === 'capacity' ? result?.logs.slice(0, 3 + phase) : result?.logs;
  return <div className="logs-panel">
    <div className="dock-panel-description"><Terminal size={13} aria-hidden="true" /><span>Application & infrastructure logs</span><span className="mono">{scenario.presentation.requestMethod} {scenario.presentation.requestPath}</span></div>
    {logs ? <div className="log-rows" role="log" aria-label="Simulation logs" aria-live={running ? 'off' : 'polite'}>
      {logs.map((log, i) => <div className={`log-row log-${log.level.toLowerCase()}`} key={`${i}-${log.message}`}><time>{log.time}</time><strong>{log.level}</strong><span>{log.message}</span></div>)}
    </div> : <div className="dock-empty"><Terminal size={24} aria-hidden="true" /><p>No logs yet. Run traffic to see what production tells you.</p></div>}
  </div>;
}
