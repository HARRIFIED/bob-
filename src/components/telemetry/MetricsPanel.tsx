import { ArrowUpRight, CircleDot } from 'lucide-react';
import { useSimulator } from '../../store/simulator-store';
import type { TelemetrySnapshot } from '../../simulation/types';

function Sparkline({ values, max, tone }: { values: number[]; max: number; tone: string }) {
  const pts = (values.length > 1 ? values : [0, ...values]).map((n, i, arr) => `${i / (arr.length - 1) * 220},${42 - Math.min(1, n / max) * 35}`).join(' ');
  return <svg className={`sparkline ${tone}`} viewBox="0 0 220 48" preserveAspectRatio="none" aria-hidden="true"><path className="chart-grid" d="M0 10H220 M0 26H220 M0 42H220" /><polygon points={`0,48 ${pts} 220,48`} /><polyline points={pts} /></svg>;
}
interface MetricCard {
  key: keyof TelemetrySnapshot; label: string; unit: string; max: number;
  bad?: (value: number) => boolean; footer: string;
}

export function MetricsPanel() {
  const { result, history, running, architecture, scenario } = useSimulator();
  const t = result?.telemetry;
  const transfers = scenario.engine === 'transfers';
  const cards: MetricCard[] = transfers ? [
    { key: 'duplicateDebits', label: 'DUPLICATE DEBITS', unit: 'debits', max: 2, bad: value => value > 0, footer: 'Correctness target: zero' },
    { key: 'completionRate', label: 'TRANSFERS CONFIRMED', unit: '%', max: 100, bad: value => value < 100, footer: 'Every intended transfer acknowledged' },
    { key: 'apiCpu', label: 'API CPU', unit: '%', max: 100, bad: value => value >= 85, footer: 'Healthy CPU does not prove correctness' },
    { key: 'p95', label: 'ACCEPTED REQUEST p95', unit: 'ms', max: Math.max(900, t?.p95 ?? 0), bad: value => value >= 300, footer: 'Processing estimate · excludes lost responses' },
  ] : [
    { key: 'traffic', label: 'REQUESTS / SEC', unit: 'req/s', max: scenario.trafficProfile.peak, footer: scenario.presentation.loadDescription },
    { key: 'apiCpu', label: 'API CPU', unit: '%', max: 100, bad: value => value >= 85, footer: 'Capacity-weighted utilisation' },
    { key: 'dbCpu', label: 'DATABASE CPU', unit: '%', max: 100, bad: value => value >= 85, footer: 'Primary PostgreSQL instance' },
    { key: 'p95', label: 'p95 LATENCY', unit: 'ms', max: Math.max(900, t?.p95 ?? 0), bad: value => value >= 300, footer: 'Target < 300 ms' },
  ];
  return <div className="metrics-panel">
    <div className="metric-cards">{cards.map(card => {
      const bad = t && card.bad?.(t[card.key]);
      return <div className={`metric-card ${bad ? 'metric-alert' : ''}`} key={card.key}>
        <div className="metric-label">{card.label}{bad && <ArrowUpRight size={13} aria-hidden="true" />}</div>
        <div className="metric-value">{t ? t[card.key].toLocaleString('en-US') : '—'}<span>{card.unit}</span></div>
        <Sparkline values={history.map(h => h[card.key])} max={card.max} tone={bad ? 'chart-amber' : card.key === 'traffic' ? 'chart-blue' : 'chart-green'} />
        <div className="metric-card-footer">{card.footer}</div>
      </div>;
    })}</div>
    <div className="secondary-metrics">
      {transfers ? <>
        <div><span className="secondary-label">Retry attempts</span><strong>{t?.retryAttempts ?? '—'}</strong></div>
        <div><span className="secondary-label">Receipts replayed</span><strong>{t?.replayedRequests ?? '—'}</strong></div>
        <div><span className="secondary-label">Database CPU</span><strong>{t?.dbCpu ?? '—'}<small>%</small></strong></div>
      </> : <>
        <div><span className="secondary-label">DB connections</span><strong className={t && t.dbConnections >= 95 ? 'text-amber' : ''}>{t?.dbConnections ?? '—'} <small>/ 100</small></strong><span className="mini-track"><span style={{ width: `${t?.dbConnections ?? 0}%` }} /></span></div>
        <div><span className="secondary-label">Error rate <span className="text-muted">&lt; 1%</span></span><strong className={t && t.errorRate >= 1 ? 'text-red' : ''}>{t?.errorRate ?? '—'}<small>%</small></strong></div>
        <div><span className="secondary-label">Redis hit rate</span><strong>{architecture.nodes.some(n => n.kind === 'redis') ? t?.cacheHitRate ?? '—' : '—'}<small>{architecture.nodes.some(n => n.kind === 'redis') ? '%' : 'not provisioned'}</small></strong></div>
      </>}
    </div>
    <div className="telemetry-caption"><CircleDot size={11} aria-hidden="true" />
      {transfers ? 'Correctness: authored account sample. CPU and latency: background load estimates.' : running ? 'Collecting snapshots as traffic ramps up…' : result ? `${history.length} snapshots · ${scenario.trafficProfile.normal.toLocaleString('en-US')} → ${scenario.trafficProfile.peak.toLocaleString('en-US')} req/s · deterministic replay` : 'Run a simulation to collect telemetry.'}
    </div>
  </div>;
}
