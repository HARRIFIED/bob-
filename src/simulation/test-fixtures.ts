import { addComponent, connect } from './architecture';
import { isApi } from '../data/component-definitions';
import type { ArchitectureState, ComponentKind } from './types';

/** Explicitly wired model fixtures; the editor itself never creates these links. */
export function addWiredComponent(architecture: ArchitectureState, kind: ComponentKind): ArchitectureState {
  let next = addComponent(architecture, kind);
  if (next === architecture) return next;
  const node = next.nodes.at(-1)!;
  const db = next.nodes.find(n => n.kind === 'postgres');
  const lb = next.nodes.find(n => n.kind === 'load-balancer');
  const cache = next.nodes.find(n => n.kind === 'redis');
  if (isApi(kind)) {
    if (lb) next = connect(next, lb.id, node.id);
    if (cache ?? db) next = connect(next, node.id, (cache ?? db)!.id);
  } else if (kind === 'redis' && db) {
    const apis = next.nodes.filter(n => isApi(n.kind));
    next = { ...next, edges: next.edges.filter(e => !(apis.some(n => n.id === e.source) && e.target === db.id)) };
    for (const api of apis) next = connect(next, api.id, node.id);
    next = connect(next, node.id, db.id);
  }
  return next;
}
