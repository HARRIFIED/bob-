import { Zap } from 'lucide-react';
import { kafkaPartitionOptions, nodeConfig, redisMemoryOptions, redisTtlOptions, roleOf } from '../../data/component-definitions';
import { defaultWorkingSetGb } from '../../simulation/component-model';
import { money } from '../../simulation/cost';
import { useSimulator } from '../../store/simulator-store';
import type { ArchitectureNode, NodeFault } from '../../simulation/types';

/** Learner-adjustable settings for components whose behavior depends on them. */
export function ComponentSettings({ node }: { node: ArchitectureNode }) {
  const store = useSimulator();
  const config = nodeConfig(node);
  if (node.kind === 'redis') {
    const workingSet = store.scenario.model.workingSetGb ?? defaultWorkingSetGb;
    return (
      <fieldset className="component-settings" disabled={store.running}>
        <legend>Cache settings</legend>
        <label className="resize-control">
          Memory
          <select aria-label="Cache memory" value={config.memoryGb} onChange={event => store.configure(node.id, { memoryGb: Number(event.target.value) })}>
            {redisMemoryOptions.map(option => (
              <option key={option.gb} value={option.gb}>{option.gb} GB · {money(option.monthlyCost)}/mo</option>
            ))}
          </select>
        </label>
        <label className="resize-control">
          Time to live (TTL)
          <select aria-label="Cache TTL" value={config.ttlSeconds} onChange={event => store.configure(node.id, { ttlSeconds: Number(event.target.value) })}>
            {redisTtlOptions.map(option => <option key={option.seconds} value={option.seconds}>{option.label}</option>)}
          </select>
        </label>
        <label className="resize-control">
          When a balance changes
          <select
            aria-label="Cache write policy"
            value={config.writePolicy}
            onChange={event => store.configure(node.id, { writePolicy: event.target.value === 'ttl-only' ? 'ttl-only' : 'invalidate' })}
          >
            <option value="invalidate">Invalidate the cached value</option>
            <option value="ttl-only">Keep it until the TTL expires</option>
          </select>
        </label>
        <p className="empty-copy">
          The frequently read data is about {workingSet} GB. Less memory lowers the hit rate; a longer TTL keeps keys warm.
          Without invalidation, a cached balance can stay old until it expires.
        </p>
      </fieldset>
    );
  }
  if (node.kind === 'kafka') return (
    <fieldset className="component-settings" disabled={store.running}>
      <legend>Topic settings</legend>
      <label className="resize-control">
        Partitions
        <select aria-label="Kafka partitions" value={config.partitions} onChange={event => store.configure(node.id, { partitions: Number(event.target.value) })}>
          {kafkaPartitionOptions.map(count => <option key={count} value={count}>{count}</option>)}
        </select>
      </label>
      <p className="empty-copy">A consumer group uses at most one consumer per partition. Extra workers wait idle.</p>
    </fieldset>
  );
  if (node.kind === 'read-replica') return (
    <fieldset className="component-settings" disabled={store.running}>
      <legend>Read routing</legend>
      <label className="sandbox-check">
        <input
          type="checkbox"
          checked={!!config.readYourWrites}
          onChange={event => store.configure(node.id, { readYourWrites: event.target.checked })}
        />
        Send a customer’s follow-up reads to the primary (read-your-writes)
      </label>
      <p className="empty-copy">The API must also connect to the primary. Those reads add load to the primary instead.</p>
    </fieldset>
  );
  return null;
}

const faultLabels: Record<NodeFault, string> = { down: 'Take offline', slow: 'Add 200 ms latency', cold: 'Flush cache (cold start)' };

/** Experiment-only failure injection. Faults are saved with the design until cleared. */
export function FaultControls({ node }: { node: ArchitectureNode }) {
  const store = useSimulator();
  const role = roleOf(node);
  if (role === 'source' || role === 'design') return null;
  const options: (NodeFault | null)[] = [null, 'down', 'slow', ...(role === 'cache' ? ['cold' as const] : [])];
  return (
    <fieldset className="component-settings fault-controls" disabled={store.running}>
      <legend><Zap size={13} aria-hidden="true" /> Break it</legend>
      {options.map(fault => (
        <label key={fault ?? 'none'} className="sandbox-check">
          <input type="radio" name={`fault-${node.id}`} checked={(node.fault ?? null) === fault} onChange={() => store.setFault(node.id, fault)} />
          {fault ? faultLabels[fault] : 'No fault'}
        </label>
      ))}
      <p className="empty-copy">Faults apply to every run until you clear them. Rerun the same workload to compare.</p>
    </fieldset>
  );
}
