import type { Health, MissionObjective } from './types';
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const round = (n: number, digits = 0) => Number(n.toFixed(digits));
export const healthForCpu = (cpu: number): Health => cpu >= 95 ? 'critical' : cpu >= 85 ? 'warning' : 'healthy';
export function objectivePasses(objective: MissionObjective, actual: number) {
  switch (objective.comparison) {
    case 'lt': return actual < objective.target;
    case 'lte': return actual <= objective.target;
    case 'gte': return actual >= objective.target;
    case 'eq': return actual === objective.target;
  }
}
