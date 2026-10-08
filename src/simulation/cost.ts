import { definitions } from '../data/component-definitions';
import type { ArchitectureState } from './types';
export const monthlyCost = (architecture: ArchitectureState) => architecture.nodes.reduce((total, node) => total + definitions[node.kind].monthlyCost, 0);
export function costBreakdown(architecture: ArchitectureState) {
  return Object.values(definitions).filter(def => def.monthlyCost > 0).map(def => {
    const count = architecture.nodes.filter(node => node.kind === def.id).length;
    return { id: def.id, name: def.name, count, unitCost: def.monthlyCost, cost: count * def.monthlyCost };
  }).filter(row => row.count > 0);
}
export const money = (value: number) => '$' + value.toLocaleString('en-US');
