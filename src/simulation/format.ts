import type { MissionObjective } from './types';
import { money } from './cost';

export function objectiveValue(objective: MissionObjective, value: number) {
  return objective.unit === '$' ? money(value) : `${value}${objective.unit}`;
}
export function objectiveTarget(objective: MissionObjective) {
  const operator = { lt: '< ', lte: '≤ ', gte: '≥ ', eq: '' }[objective.comparison];
  return operator + objectiveValue(objective, objective.target);
}
