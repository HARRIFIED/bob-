import { ArrowUpRight, CircleDot } from 'lucide-react';
import { useSimulator } from '../../store/simulator-store';
import type { TelemetrySnapshot } from '../../simulation/types';

function Sparkline({ values, max, tone }: { values: number[]; max: number; tone: string }) {
  const pts = (values.length > 1 ? values : [0, ...values]).map((n, i, arr) => `${i / (arr.length - 1) * 220},${42 - Math.min(1, n / max) * 35}`).join(' ');
  return <svg className={`sparkline ${tone}`} viewBox="0 0 220 48" preserveAspectRatio="none" aria-hidden="true"><path className="chart-grid" d="M0 10H220 M0 26H220 M0 42H220" /><polygon points={`0,48 ${pts} 220,48`} /><polyline points={pts} /></svg>;
}
export function MetricsPanel() {
  const { result, history, running, architecture } = useSimulator();
  const t = result?.telemetry;
  const cards: { key: keyof TelemetrySnapshot; label: string; unit: string; max: number; limit?: number; footer: string }[] = [
    { key: 'traffic', label: 'REQUESTS / SEC', unit: 'req/s', max: 12000, footer: 'Payday peak · 10× baseline' },
    { key: 'apiCpu', label: 'API CPU', unit: '%', max: 100, limit: 85, footer: 'Capacity-weighted utilisation' },
    { key: 'dbCpu', label: 'DATABASE CPU', unit: '%', max: 100, limit: 85, footer: 'Primary PostgreSQL instance' },
    { key: 'p95', label: 'p95 LATENCY', unit: 'ms', max: Math.max(900, t?.p95 ?? 0), limit: 300, footer: 'Target < 300 ms' },
  ];
  return <div className="metrics-panel"><div className="metric-cards">{cards.map(c => {
    const bad = t && c.limit && t[c.key] >= c.limit;
    return <div className={`metric-card ${bad ? 'metric-alert' : ''}`} key={c.key}><div className="metric-label">{c.label}{bad && <ArrowUpRight size={13} />}</div><div className="metric-value">{t ? t[c.key].toLocaleString('en-US') : '—'}<span>{c.unit}</span></div><Sparkline values={history.map(h => h[c.key])} max={c.max} tone={bad ? 'chart-amber' : c.key === 'traffic' ? 'chart-blue' : 'chart-green'} /><div className="metric-card-footer">{c.footer}</div></div>;
  })}</div><div className="secondary-metrics"><div><span className="secondary-label">DB connections</span><strong className={t && t.dbConnections >= 95 ? 'text-amber' : ''}>{t?.dbConnections ?? '—'} <small>/ 100</small></strong><span className="mini-track"><span style={{ width: `${t?.dbConnections ?? 0}%` }} /></span></div><div><span className="secondary-label">Error rate <span className="text-muted">&lt; 1%</span></span><strong className={t && t.errorRate >= 1 ? 'text-red' : ''}>{t?.errorRate ?? '—'}<small>%</small></strong></div><div><span className="secondary-label">Redis hit rate</span><strong>{architecture.nodes.some(n => n.kind === 'redis') ? t?.cacheHitRate ?? '—' : '—'}<small>{architecture.nodes.some(n => n.kind === 'redis') ? '%' : 'not provisioned'}</small></strong></div></div><div className="telemetry-caption"><CircleDot size={11} />{running ? 'Collecting snapshots as traffic ramps up…' : result ? '6 snapshots · 1,200 → 12,000 req/s · deterministic replay' : 'Run a simulation to collect telemetry.'}<span>SIMULATED TIME · 08:00:00—08:00:05</span></div></div>;
}
