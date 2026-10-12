import { definitions, nodeConfig, roleOf } from '../data/component-definitions';
import { money, monthlyCost, nodeMonthlyCost } from '../simulation/cost';
import { objectiveTarget, objectiveValue } from '../simulation/format';
import type { ArchitectureNode, ArchitectureState, ScenarioDefinition, SimulationResult } from '../simulation/types';
import { componentGuides, guideKeyFor } from './component-guides';

const cell = (value: string) => value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const faultText = { down: 'offline', slow: '+200 ms latency', cold: 'cache flushed' } as const;

function settingsText(node: ArchitectureNode) {
  const config = nodeConfig(node);
  const parts = node.kind === 'redis' ? [`${config.memoryGb} GB`, `TTL ${config.ttlSeconds} s`, config.writePolicy === 'ttl-only' ? 'TTL-only expiry' : 'invalidate on write']
    : node.kind === 'kafka' ? [`${config.partitions} partitions`]
    : node.kind === 'read-replica' ? [config.readYourWrites ? 'read-your-writes routing' : 'all reads may lag']
    : [];
  if (!definitions[node.kind].available) parts.push('design-only preview');
  if (node.fault) parts.push(`fault: ${faultText[node.fault]}`);
  return parts.join(' · ') || '—';
}

interface DesignDocInput {
  name: string;
  scenario: ScenarioDefinition;
  architecture: ArchitectureState;
  /** Latest completed result; omit when the design changed after the run. */
  result: SimulationResult | null;
}

/** A Markdown write-up of a design and its measured evidence, for notes or a portfolio. */
export function designDoc({ name, scenario, architecture, result }: DesignDocInput): string {
  const { peak, readFraction } = scenario.trafficProfile;
  const byId = new Map(architecture.nodes.map(node => [node.id, node.label]));
  const lines = [
    `# ${name}`,
    '',
    '_Exported from Bob the System Builder. Measurements come from a simplified, deterministic teaching model, not from deployed infrastructure._',
    '',
    '## Workload',
    '',
    `- Peak traffic: ${peak.toLocaleString('en-US')} requests/second`,
    `- Mix: ${Math.round(readFraction * 100)}% reads, ${Math.round((1 - readFraction) * 100)}% writes`,
    `- Monthly budget: ${money(scenario.budget)}; this design costs ${money(monthlyCost(architecture))}`,
    '',
    '## Components',
    '',
    '| Component | Type | Settings | Monthly cost |',
    '| --- | --- | --- | ---: |',
    ...architecture.nodes.map(node => `| ${cell(node.label)} | ${definitions[node.kind].name} | ${cell(settingsText(node))} | ${definitions[node.kind].available ? money(nodeMonthlyCost(node)) : 'unpriced'} |`),
    '',
    '## Connections',
    '',
    ...(architecture.edges.length
      ? architecture.edges.map(edge => `- ${byId.get(edge.source) ?? edge.source} → ${byId.get(edge.target) ?? edge.target}`)
      : ['- No connections yet.']),
    '',
  ];
  if (result) {
    const t = result.telemetry;
    lines.push(
      '## Measured at peak',
      '',
      `- p95 latency: ${t.p95} ms; error rate: ${t.errorRate}%; availability: ${t.availability}%`,
      `- API CPU: ${t.apiCpu}%; busiest database CPU: ${t.dbCpu}% with ${t.dbConnections} connections`,
      `- Cache hit rate: ${t.cacheHitRate}%; stale balance reads: ${t.staleReads}/s`,
      `- Queue backlog after one minute: ${t.queueBacklog.toLocaleString('en-US')} messages; queued write delay: ${t.asyncLag} s; replica lag: ${t.replicaLag} ms`,
      '',
    );
    if (result.objectives.length) {
      lines.push('| Goal | Target | Measured | Result |', '| --- | --- | --- | --- |',
        ...result.objectives.map(o => `| ${o.label} | ${objectiveTarget(o)} | ${objectiveValue(o, o.actual)} | ${o.passed ? 'pass' : 'not yet'} |`), '');
    }
    if (result.notes.length) lines.push('### Model notes', '', ...result.notes.map(note => `- ${note}`), '');
  } else {
    lines.push('## Measured at peak', '', '_Not measured yet. Run this design before exporting to include evidence._', '');
  }
  const kinds = [...new Set(architecture.nodes.filter(node => roleOf(node) !== 'source').map(node => guideKeyFor(node.kind)))];
  lines.push('## Trade-offs to discuss', '', ...kinds.map(key => `- **${componentGuides[key].title}:** ${componentGuides[key].failureModes[0] ?? componentGuides[key].modelNote}`));
  return lines.join('\n') + '\n';
}
