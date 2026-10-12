import { useState } from 'react';
import { ArrowLeft, BookOpen, Cable, Plus, Trash2, X } from 'lucide-react';
import { definitions, isApi, roleOf } from '../../data/component-definitions';
import { componentGuides, guideKeyFor } from '../../learning/component-guides';
import { canConnect } from '../../simulation/architecture';
import { money, nodeMonthlyCost } from '../../simulation/cost';
import { useSimulator } from '../../store/simulator-store';
import type { ComponentRole } from '../../simulation/types';
import { ComponentIcon, HealthBadge } from '../shared';
import { ComponentSettings, FaultControls } from './ComponentSettings';
import { RequestHandlingControls } from './RequestHandlingControls';
import { RetryControls } from '../telemetry/RetryControls';

const endOfPath: Partial<Record<ComponentRole, string>> = {
  database: 'Answers requests. Outgoing links only replicate to read replicas.',
  replica: 'Answers reads. It does not forward requests.',
};

export function ComponentInspector() {
  const store = useSimulator();
  const [target, setTarget] = useState('');
  const node = store.architecture.nodes.find(n => n.id === store.selectedId);
  if (!node) return null;
  const def = definitions[node.kind];
  const role = roleOf(node);
  const telemetry = !store.stale ? store.result?.nodes[node.id] : undefined;
  const options = store.architecture.nodes.filter(n => canConnect(store.architecture, node.id, n.id, !!store.sandbox));
  const outgoing = store.architecture.edges.filter(e => e.source === node.id);
  const replicationSources = role === 'replica'
    ? store.architecture.edges
      .filter(e => e.target === node.id)
      .map(e => store.architecture.nodes.find(n => n.id === e.source))
      .filter(source => source && roleOf(source) === 'database')
    : [];
  const targetId = options.some(n => n.id === target) ? target : options[0]?.id ?? '';
  const logical = role === 'source';
  const transferClient = role === 'source' && store.scenario.engine === 'transfers';
  return <div className="inspector">
    <button className="text-link inspector-back" onClick={() => store.select(null)}>
      <ArrowLeft size={14} /> {store.sandbox ? 'Back to experiment' : 'Back to mission'}
    </button>
    <div className="inspector-title">
      <span className="inspector-icon"><ComponentIcon kind={node.kind} size={24} /></span>
      <span><span className="eyebrow">{def.category}</span><h2>{node.label}</h2></span>
    </div>
    <label className="resize-control">Component label
      <input
        aria-label="Component label" maxLength={80} defaultValue={node.label} disabled={store.running}
        onBlur={event => { if (event.target.value.trim() !== node.label) store.rename(node.id, event.target.value); }}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
      />
    </label>
    <div className="inspector-position">
      {(['x', 'y'] as const).map(axis => <label key={axis}>Position {axis.toUpperCase()}
        <input
          key={node.position[axis]} type="number" aria-label={`Position ${axis.toUpperCase()}`}
          defaultValue={Math.round(node.position[axis])} disabled={store.running}
          onBlur={event => {
            const value = event.target.valueAsNumber;
            if (Number.isFinite(value) && Math.abs(value) <= 100000 && value !== node.position[axis]) store.move(node.id, { ...node.position, [axis]: value });
          }}
        />
      </label>)}
    </div>
    {!def.available && <p className="inline-notice">Design preview · traffic drawn through it passes unchanged. Behavior and cost are not simulated.</p>}
    {node.fault && <p className="inline-notice">Injected fault: {node.fault === 'down' ? 'offline' : node.fault === 'slow' ? '+200 ms latency' : 'cache flushed (cold)'}.</p>}
    <HealthBadge health={telemetry?.health ?? 'ready'} />
    <p className="inspector-description">
      {transferClient ? 'Mobile clients retry a transfer when its response is lost. Inspect the ledger to distinguish a failed request from an already committed debit.' : def.description}
    </p>
    <button className="text-link inspector-learn" onClick={() => store.openGuide(node.kind)}>
      <BookOpen size={13} aria-hidden="true" /> Learn about {componentGuides[guideKeyFor(node.kind)].title}
    </button>
    {role === 'source' && <RetryControls />}
    {isApi(node.kind) && <RequestHandlingControls />}
    <ComponentSettings node={node} />
    <dl className="inspector-stats">
      {!logical && role !== 'design' && <>
        <div><dt>Compute</dt><dd>{def.vcpu} vCPU</dd></div>
        <div><dt>Memory</dt><dd>{def.memory} GB</dd></div>
        <div><dt>Capacity</dt><dd>{def.capacity.toLocaleString('en-US')} {role === 'queue' || role === 'consumer' ? 'msg/s' : 'req/s'}</dd></div>
        <div><dt>Base latency</dt><dd>{def.baseLatency} ms</dd></div>
      </>}
      <div><dt>Current traffic</dt><dd>{telemetry?.traffic.toLocaleString('en-US') ?? '—'} req/s</dd></div>
      {!logical && role !== 'design' && <>
        <div><dt>CPU utilisation</dt><dd>{telemetry ? `${telemetry.cpu}%` : '—'}</dd></div>
        <div><dt>Memory utilisation</dt><dd>{telemetry ? `${telemetry.memory}%` : '—'}</dd></div>
      </>}
      {(role === 'database' || role === 'replica') && <div><dt>Connections</dt><dd>{telemetry?.connections ?? '—'} / {def.connectionLimit ?? 100}</dd></div>}
      {node.kind === 'postgres' && telemetry?.detail && telemetry.detail.includes('duplicate') && <div><dt>Ledger alert</dt><dd className="text-red">{telemetry.detail}</dd></div>}
      {role === 'cache' && <div><dt>Cache hit rate</dt><dd>{telemetry?.cacheHitRate ?? '—'}%</dd></div>}
      {role === 'replica' && <div><dt>Replication lag</dt><dd>{telemetry?.lagMs ?? '—'} ms</dd></div>}
      {role === 'queue' && <div><dt>Backlog after 1 min</dt><dd>{telemetry?.backlog?.toLocaleString('en-US') ?? '—'} msgs</dd></div>}
      <div className="inspector-cost"><dt>Monthly estimate</dt><dd>{def.available ? money(nodeMonthlyCost(node)) : 'Unpriced preview'}</dd></div>
    </dl>
    {store.stale && <p className="inline-notice">Architecture changed. Run again for current telemetry.</p>}
    {isApi(node.kind) && <label className="resize-control">Instance size
      <select aria-label="Instance size" value={node.kind} disabled={store.running} onChange={event => store.resize(node.id, event.target.value === 'api-small' ? 'api-small' : 'api-medium')}>
        {(['api-small', 'api-medium'] as const).map(kind => (
          <option key={kind} value={kind}>{definitions[kind].name} · {definitions[kind].capacity.toLocaleString('en-US')} req/s · {money(definitions[kind].monthlyCost)}/mo</option>
        ))}
      </select>
    </label>}
    {role === 'replica' && <p className={replicationSources.length ? 'empty-copy' : 'inline-notice'}>
      {replicationSources.length
        ? `Replicates from ${replicationSources.map(source => source?.label).join(', ')}.`
        : 'No primary yet. Connect a primary database to this replica so it can replicate.'}
    </p>}
    <div className="connections">
      <h3><Cable size={14} aria-hidden="true" /> Outgoing connections</h3>
      {outgoing.map(edge => {
        const label = store.architecture.nodes.find(n => n.id === edge.target)?.label;
        return <div className="connection-row" key={edge.id}>
          <span>→ {label}</span>
          <button className="icon-button" disabled={store.running} aria-label={`Disconnect ${node.label} from ${label}`} onClick={() => store.disconnect(edge.id)}><X size={14} /></button>
        </div>;
      })}
      {!outgoing.length && <p className="empty-copy">{endOfPath[role] ?? 'No outgoing connections.'}</p>}
      {options.length > 0 && <form className="connection-form" onSubmit={event => { event.preventDefault(); store.connect(node.id, targetId); setTarget(''); }}>
        <label htmlFor="connection-target">Connect to</label>
        <div>
          <select id="connection-target" value={targetId} onChange={event => setTarget(event.target.value)} disabled={store.running}>
            {options.map(n => <option value={n.id} key={n.id}>{n.label}</option>)}
          </select>
          <button className="icon-button" aria-label="Add connection" disabled={store.running}><Plus size={17} /></button>
        </div>
      </form>}
    </div>
    {store.faultsEnabled && <FaultControls node={node} />}
    {node.added || store.sandbox
      ? <button className="button danger-button" disabled={store.running} onClick={() => store.remove(node.id)}><Trash2 size={14} /> Remove component</button>
      : <p className="protected-note">Starting infrastructure · resize or rewire to experiment.</p>}
  </div>;
}
