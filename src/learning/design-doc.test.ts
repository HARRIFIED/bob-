import { describe, expect, it } from 'vitest';
import { paydaySurge } from '../scenarios/payday-surge';
import { addComponent, configureNode, connect, setNodeFault } from '../simulation/architecture';
import { simulate } from '../simulation/engine';
import { designDoc } from './design-doc';

describe('design notes export', () => {
  const architecture = configureNode(connect(connect(addComponent(structuredClone(paydaySurge.initialArchitecture), 'redis'), 'api-1', 'redis-1'), 'redis-1', 'db'), 'redis-1', { memoryGb: 2 });
  it('documents components, settings, connections, measured evidence, and trade-offs', () => {
    const result = simulate({ scenario: paydaySurge, architecture });
    const doc = designDoc({ name: 'Payday | v2', scenario: paydaySurge, architecture, result });
    expect(doc).toContain('# Payday | v2');
    expect(doc).toContain('| Redis Cache | Redis Cache | 2 GB · TTL 300 s · invalidate on write | $100 |');
    expect(doc).toContain('- API Server 01 → Redis Cache');
    expect(doc).toContain(`p95 latency: ${result.telemetry.p95} ms`);
    expect(doc).toContain('| p95 latency | < 300ms |');
    expect(doc).toContain('**Redis:** Cold start or flush');
    expect(doc).toContain('not from deployed infrastructure');
  });
  it('says plainly when the design has not been measured, and escapes table cells', () => {
    const renamed = { ...architecture, nodes: architecture.nodes.map(n => n.id === 'db' ? { ...n, label: 'Primary | ledger' } : n) };
    const doc = designDoc({ name: 'Draft', scenario: paydaySurge, architecture: setNodeFault(renamed, 'api-2', 'down'), result: null });
    expect(doc).toContain('Not measured yet');
    expect(doc).toContain('Primary \\| ledger');
    expect(doc).toContain('fault: offline');
  });
});
