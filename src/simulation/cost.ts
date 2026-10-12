import { definitions, nodeConfig, redisMemoryOptions } from '../data/component-definitions';
import type { ArchitectureNode, ArchitectureState, ComponentKind } from './types';

/** Provisioned resources are charged whether or not they are connected. */
export function nodeMonthlyCost(node: Pick<ArchitectureNode, 'kind' | 'config'>) {
  if (node.kind === 'redis') {
    const memory = nodeConfig(node).memoryGb;
    return redisMemoryOptions.find(option => option.gb === memory)?.monthlyCost ?? definitions.redis.monthlyCost;
  }
  return definitions[node.kind].monthlyCost;
}
export const monthlyCost = (architecture: ArchitectureState) => architecture.nodes.reduce((total, node) => total + nodeMonthlyCost(node), 0);

export interface CostRow { id: string; kind: ComponentKind; name: string; count: number; unitCost: number; cost: number }
export function costBreakdown(architecture: ArchitectureState): CostRow[] {
  const rows = new Map<string, CostRow>();
  for (const node of architecture.nodes) {
    const def = definitions[node.kind];
    if (def.role === 'source') continue;
    const memory = nodeConfig(node).memoryGb;
    const variant = node.kind === 'redis' && memory !== 4 ? ` · ${memory} GB` : '';
    const id = node.kind + variant;
    const unitCost = nodeMonthlyCost(node);
    const row = rows.get(id) ?? { id, kind: node.kind, name: def.name + variant, count: 0, unitCost, cost: 0 };
    rows.set(id, { ...row, count: row.count + 1, cost: row.cost + unitCost });
  }
  const order = Object.keys(definitions);
  return [...rows.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.unitCost - b.unitCost);
}
export const money = (value: number) => '$' + value.toLocaleString('en-US');
