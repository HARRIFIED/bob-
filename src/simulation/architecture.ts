import { definitions, isApi, singletonKinds } from '../data/component-definitions';
import type { ArchitectureState, ComponentKind, RequestHandling } from './types';

export function canConnect(architecture: ArchitectureState, source: string, target: string, freeform = false) {
  const from = architecture.nodes.find(n => n.id === source);
  const to = architecture.nodes.find(n => n.id === target);
  if (!from || !to || source === target || architecture.edges.some(e => e.source === source && e.target === target)) return false;
  if (freeform) return true;
  return (from.kind === 'users' && to.kind === 'load-balancer') ||
    (from.kind === 'load-balancer' && isApi(to.kind)) ||
    (isApi(from.kind) && (to.kind === 'redis' || to.kind === 'postgres')) ||
    (from.kind === 'redis' && to.kind === 'postgres');
}
export function connect(architecture: ArchitectureState, source: string, target: string, freeform = false): ArchitectureState {
  if (!canConnect(architecture, source, target, freeform)) return architecture;
  return { ...architecture, edges: [...architecture.edges, { id: `${source}-${target}`, source, target }] };
}
export function arrange(architecture: ArchitectureState): ArchitectureState {
  const columns: ComponentKind[][] = [
    ['users'], ['load-balancer'], ['api-small', 'api-medium'], ['redis'],
    ['postgres', 'mysql', 'mongodb', 'read-replica'], ['outbox', 'cdc', 'worker'], ['queue', 'kafka', 'kubernetes'],
  ];
  return { ...architecture, nodes: architecture.nodes.map(n => {
    const column = columns.findIndex(kinds => kinds.includes(n.kind));
    const peers = architecture.nodes.filter(peer => columns[column].includes(peer.kind));
    return { ...n, position: { x: column * 270, y: peers.findIndex(peer => peer.id === n.id) * 220 } };
  }) };
}
export function addComponent(architecture: ArchitectureState, kind: ComponentKind, position?: { x: number; y: number }, freeform = false): ArchitectureState {
  if ((!definitions[kind].available && !freeform) || architecture.nodes.length >= 60) return architecture;
  if (!freeform && singletonKinds.includes(kind) && architecture.nodes.some(n => n.kind === kind)) return architecture;
  if (isApi(kind) && architecture.nodes.filter(n => isApi(n.kind)).length >= 12) return architecture;
  let index = 1;
  while (architecture.nodes.some(n => n.id === `${isApi(kind) ? 'api' : kind}-${index}`)) index++;
  const id = `${isApi(kind) ? 'api' : kind}-${index}`;
  const placement = position ?? { x: 480, y: Math.max(-185, ...architecture.nodes.map(n => n.position.y)) + 185 };
  return { ...architecture, nodes: [...architecture.nodes, {
    id, kind, label: isApi(kind) ? `API Server ${String(index).padStart(2, '0')}` : definitions[kind].name,
    position: placement, added: true,
  }] };
}
export function removeComponent(architecture: ArchitectureState, id: string, freeform = false): ArchitectureState {
  const node = architecture.nodes.find(n => n.id === id);
  if (!node || (!node.added && !freeform)) return architecture;
  return { ...architecture, nodes: architecture.nodes.filter(n => n.id !== id), edges: architecture.edges.filter(e => e.source !== id && e.target !== id) };
}

export function configureRequestHandling(architecture: ArchitectureState, requestHandling: RequestHandling): ArchitectureState {
  return architecture.requestHandling === requestHandling ? architecture : { ...architecture, requestHandling };
}
