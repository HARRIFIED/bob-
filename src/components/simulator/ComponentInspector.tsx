import { useState } from 'react';
import { ArrowLeft, Cable, Plus, Trash2, X } from 'lucide-react';
import { definitions, isApi } from '../../data/component-definitions';
import { canConnect } from '../../simulation/architecture';
import { money } from '../../simulation/cost';
import { useSimulator } from '../../store/simulator-store';
import { ComponentIcon, HealthBadge } from '../shared';

export function ComponentInspector() {
  const store = useSimulator();
  const [target, setTarget] = useState('');
  const node = store.architecture.nodes.find(n => n.id === store.selectedId);
  if (!node) return null;
  const def = definitions[node.kind];
  const telemetry = !store.stale ? store.result?.nodes[node.id] : undefined;
  const options = store.architecture.nodes.filter(n => canConnect(store.architecture, node.id, n.id));
  const outgoing = store.architecture.edges.filter(e => e.source === node.id);
  const targetId = options.some(n => n.id === target) ? target : options[0]?.id ?? '';
  return <div className="inspector"><button className="text-link inspector-back" onClick={() => store.select(null)}><ArrowLeft size={14} /> Back to mission</button><div className="inspector-title"><span className="inspector-icon"><ComponentIcon kind={node.kind} size={24} /></span><span><span className="eyebrow">{def.category}</span><h2>{node.label}</h2></span></div><HealthBadge health={telemetry?.health ?? 'ready'} /><p className="inspector-description">{def.description}</p><dl className="inspector-stats">{node.kind !== 'users' && <><div><dt>Compute</dt><dd>{def.vcpu} vCPU</dd></div><div><dt>Memory</dt><dd>{def.memory} GB</dd></div><div><dt>Capacity</dt><dd>{def.capacity.toLocaleString('en-US')} req/s</dd></div><div><dt>Base latency</dt><dd>{def.baseLatency} ms</dd></div></>}<div><dt>Current traffic</dt><dd>{telemetry?.traffic.toLocaleString('en-US') ?? '—'} req/s</dd></div>{node.kind !== 'users' && <><div><dt>CPU utilisation</dt><dd>{telemetry ? `${telemetry.cpu}%` : '—'}</dd></div><div><dt>Memory utilisation</dt><dd>{telemetry ? `${telemetry.memory}%` : '—'}</dd></div></>}{node.kind === 'postgres' && <div><dt>Connections</dt><dd>{telemetry?.connections ?? '—'} / 100</dd></div>}{node.kind === 'redis' && <div><dt>Cache hit rate</dt><dd>{telemetry?.cacheHitRate ?? '—'}%</dd></div>}<div className="inspector-cost"><dt>Monthly estimate</dt><dd>{money(def.monthlyCost)}</dd></div></dl>
    {store.stale && <p className="inline-notice">Architecture changed. Run again for current telemetry.</p>}
    {isApi(node.kind) && <label className="resize-control">Instance size<select aria-label="Instance size" value={node.kind} disabled={store.running} onChange={e => store.resize(node.id, e.target.value as 'api-small' | 'api-medium')}><option value="api-small">Small · 1,500 req/s · $80/mo</option><option value="api-medium">Medium · 2,500 req/s · $120/mo</option></select></label>}
    <div className="connections"><h3><Cable size={14} /> Outgoing connections</h3>{outgoing.map(e => <div className="connection-row" key={e.id}><span>→ {store.architecture.nodes.find(n => n.id === e.target)?.label}</span><button className="icon-button" disabled={store.running} aria-label={`Disconnect ${node.label} from ${store.architecture.nodes.find(n => n.id === e.target)?.label}`} onClick={() => store.disconnect(e.id)}><X size={14} /></button></div>)}{!outgoing.length && <p className="empty-copy">{node.kind === 'postgres' ? 'End of the request path.' : 'No outgoing connections.'}</p>}{options.length > 0 && <form className="connection-form" onSubmit={event => { event.preventDefault(); store.connect(node.id, targetId); setTarget(''); }}><label htmlFor="connection-target">Connect to</label><div><select id="connection-target" value={targetId} onChange={e => setTarget(e.target.value)} disabled={store.running}>{options.map(n => <option value={n.id} key={n.id}>{n.label}</option>)}</select><button className="icon-button" aria-label="Add connection" disabled={store.running}><Plus size={17} /></button></div></form>}</div>{node.added ? <button className="button danger-button" disabled={store.running} onClick={() => store.remove(node.id)}><Trash2 size={14} /> Remove component</button> : <p className="protected-note">Starting infrastructure · resize or rewire to experiment.</p>}</div>;
}
