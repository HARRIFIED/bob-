import { definitions, isApi } from '../data/component-definitions';
import type { ArchitectureState, ComponentKind, RequestHandling } from './types';

export function canConnect(architecture: ArchitectureState, source: string, target: string) {
  const from = architecture.nodes.find(n => n.id === source);
  const to = architecture.nodes.find(n => n.id === target);
  if (!from || !to || source === target || architecture.edges.some(e => e.source === source && e.target === target)) return false;
  return (from.kind === 'users' && to.kind === 'load-balancer') ||
    (from.kind === 'load-balancer' && isApi(to.kind)) ||
    (isApi(from.kind) && (to.kind === 'redis' || to.kind === 'postgres')) ||
    (from.kind === 'redis' && to.kind === 'postgres');
}
export function connect(architecture: ArchitectureState, source: string, target: string): ArchitectureState {
  if (!canConnect(architecture, source, target)) return architecture;
  return { ...architecture, edges: [...architecture.edges, { id: `${source}-${target}`, source, target }] };
}
export function arrange(architecture: ArchitectureState): ArchitectureState {
  const apis = architecture.nodes.filter(n => isApi(n.kind));
  const center = Math.max(125, ((apis.length - 1) * 185) / 2);
  const hasCache = architecture.nodes.some(n => n.kind === 'redis');
  return { ...architecture, nodes: architecture.nodes.map(n => ({ ...n, position: isApi(n.kind)
    ? { x: 480, y: apis.findIndex(a => a.id === n.id) * 185 }
    : { x: n.kind === 'users' ? 0 : n.kind === 'load-balancer' ? 240 : n.kind === 'redis' ? 740 : hasCache ? 1000 : 780, y: center } })) };
}
export function addComponent(architecture: ArchitectureState, kind: ComponentKind): ArchitectureState {
  if (!definitions[kind].available) return architecture;
  if (kind === 'redis' && architecture.nodes.some(n => n.kind === kind)) return architecture;
  const apis = architecture.nodes.filter(n => isApi(n.kind));
  if (isApi(kind) && apis.length >= 12) return architecture;
  let index = 1;
  while (architecture.nodes.some(n => n.id === `${isApi(kind) ? 'api' : kind}-${index}`)) index++;
  const id = `${isApi(kind) ? 'api' : kind}-${index}`;
  let next: ArchitectureState = { ...architecture, nodes: [...architecture.nodes, { id, kind, label: isApi(kind) ? `API Server ${String(index).padStart(2, '0')}` : definitions[kind].name, position: { x: 0, y: 0 }, added: true }], edges: [...architecture.edges] };
  const db = next.nodes.find(n => n.kind === 'postgres');
  const lb = next.nodes.find(n => n.kind === 'load-balancer');
  const cache = next.nodes.find(n => n.kind === 'redis');
  if (isApi(kind)) {
    if (lb) next = connect(next, lb.id, id);
    const dependency = cache ?? db;
    if (dependency) next = connect(next, id, dependency.id);
  } else if (kind === 'redis' && db) {
    next.edges = next.edges.filter(e => !(apis.some(n => n.id === e.source) && e.target === db.id));
    for (const api of apis) next = connect(next, api.id, id);
    next = connect(next, id, db.id);
  }
  return arrange(next);
}
export function removeComponent(architecture: ArchitectureState, id: string): ArchitectureState {
  const node = architecture.nodes.find(n => n.id === id);
  if (!node?.added) return architecture;
  let next = { ...architecture, nodes: architecture.nodes.filter(n => n.id !== id), edges: architecture.edges.filter(e => e.source !== id && e.target !== id) };
  if (node.kind === 'redis') {
    const db = next.nodes.find(n => n.kind === 'postgres');
    if (db) for (const api of next.nodes.filter(n => isApi(n.kind))) next = connect(next, api.id, db.id);
  }
  return arrange(next);
}

export function configureRequestHandling(architecture: ArchitectureState, requestHandling: RequestHandling): ArchitectureState {
  return architecture.requestHandling === requestHandling ? architecture : { ...architecture, requestHandling };
}
