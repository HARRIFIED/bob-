import { useEffect, useState } from 'react';
import { Background, BackgroundVariant, Controls, Handle, Position, ReactFlow, ReactFlowProvider, useReactFlow, useStore } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { GitBranch, Maximize2, Minimize2, MousePointer2, Scan } from 'lucide-react';
import { definitions } from '../../data/component-definitions';
import { canConnect } from '../../simulation/architecture';
import type { ArchitectureNode, NodeTelemetry } from '../../simulation/types';
import { useSimulator } from '../../store/simulator-store';
import { ComponentIcon, HealthBadge } from '../shared';
import '@xyflow/react/dist/style.css';

type FlowNode = Node<{ component: ArchitectureNode; telemetry?: NodeTelemetry; selected: boolean; stale: boolean; select: () => void }, 'component'>;
function ComponentNode({ data }: NodeProps<FlowNode>) {
  const { component, telemetry, selected, stale, select } = data;
  const def = definitions[component.kind];
  const health = stale ? 'ready' : telemetry?.health ?? 'ready';
  return <div className={`architecture-node ${health} ${selected ? 'is-selected' : ''}`}>
    {component.kind !== 'users' && <Handle type="target" position={Position.Left} />}
    <button className="node-select" onClick={select} aria-label={`Inspect ${component.label}`}><div className="node-top"><span className={`node-icon ${component.kind}`}><ComponentIcon kind={component.kind} size={19} /></span><span className="node-kind">{component.kind === 'users' ? 'TRAFFIC SOURCE' : def.category}</span>{component.added && <span className="node-added" title="Added by you">+</span>}</div><strong>{component.label}</strong><div className="node-subtitle">{component.kind.startsWith('api') ? `${def.vcpu} vCPU · ${def.memory} GB · ${def.capacity.toLocaleString('en-US')} req/s` : component.kind === 'postgres' ? 'Primary · source of truth' : component.kind === 'redis' ? 'Read cache · write invalidation' : component.kind === 'users' ? 'Balance checks & transfers' : 'Capacity-weighted routing'}</div><div className="node-telemetry">{component.kind === 'users' ? <span className="node-traffic">{(telemetry?.traffic ?? 12000).toLocaleString('en-US')} <small>req/s</small></span> : <><HealthBadge health={health} /><span className="mono">{telemetry && !stale ? `${telemetry.cpu}%` : '—'} <small>CPU</small></span></>}</div></button>
    {component.kind !== 'postgres' && <Handle type="source" position={Position.Right} />}
  </div>;
}
const nodeTypes = { component: ComponentNode };
function ViewControls({ count, fitRevision }: { count: number; fitRevision: number }) {
  const { fitView } = useReactFlow();
  const width = useStore(state => state.width);
  const height = useStore(state => state.height);
  useEffect(() => {
    if (!width || !height) return;
    const timer = window.setTimeout(() => void fitView({ padding: 0.08, duration: 0 }), 100);
    return () => window.clearTimeout(timer);
  }, [count, width, height, fitRevision, fitView]);
  return <button className="canvas-fit icon-button" aria-label="Fit architecture to view" title="Fit architecture to view" onClick={() => void fitView({ padding: 0.08, duration: 0 })}><Scan size={16} /></button>;
}
interface ArchitectureCanvasProps { expanded: boolean; onToggleExpanded: () => void; onInspect: () => void }
function Canvas({ expanded, onToggleExpanded, onInspect }: ArchitectureCanvasProps) {
  const store = useSimulator();
  const [fitRevision, setFitRevision] = useState(0);
  const inspect = (id: string) => { store.select(id); onInspect(); };
  const { architecture, result, running, stale, selectedId } = store;
  const nodes: FlowNode[] = architecture.nodes.map(component => ({ id: component.id, type: 'component', position: component.position, data: { component, telemetry: result?.nodes[component.id], selected: selectedId === component.id, stale, select: () => inspect(component.id) }, draggable: !running }));
  const edges = architecture.edges.map(e => ({ ...e, type: 'smoothstep', animated: running, deletable: false, style: { stroke: !stale && result?.nodes[e.target]?.health === 'critical' ? '#dba369' : running ? '#c5dfa8' : '#57625d', strokeWidth: running ? 2 : 1.4 } }));
  return <section id="architecture-panel" className="canvas-section" aria-label="System architecture"><div className="canvas-toolbar"><div><GitBranch size={14} /><h2>Architecture</h2><span className="canvas-env">production</span></div><div className="canvas-toolbar-actions"><button className="text-link" onClick={() => { store.arrange(); setFitRevision(n => n + 1); }} disabled={running}>Auto-layout</button><button id="architecture-expand" className="text-link desktop-layout-control" onClick={onToggleExpanded} aria-label={expanded ? 'Restore workspace layout' : 'Expand architecture'} aria-pressed={expanded} aria-controls="architecture-panel" title={expanded ? 'Restore workspace layout (Esc)' : 'Expand architecture'}>{expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}<span>{expanded ? 'Restore layout' : 'Expand'}</span></button></div></div><div className={`flow-container ${running ? 'is-running' : ''}`}><ReactFlow<FlowNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={changes => changes.forEach(change => { if (change.type === 'position' && change.position) store.move(change.id, change.position); })} onNodeClick={(_, node) => inspect(node.id)} onPaneClick={() => store.select(null)} onConnect={connection => store.connect(connection.source, connection.target)} isValidConnection={connection => canConnect(architecture, connection.source, connection.target)} nodesConnectable={!running} nodesFocusable={false} edgesFocusable={false} deleteKeyCode={null} fitView minZoom={0.2} maxZoom={1.6} colorMode="dark" attributionPosition="bottom-right"><Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#343c38" /><Controls showInteractive={false} showFitView={false} /><ViewControls count={nodes.length} fitRevision={fitRevision} /></ReactFlow><div className="canvas-region"><span className="status-dot" /> SWIFTPAY CLOUD <span>/ eu-west-1 · simulated</span></div><div className="canvas-hint"><MousePointer2 size={12} /><span>{expanded ? 'Expanded view · Esc to restore · Select a node to open its inspector' : 'Select a node to inspect · Connect using handles or the inspector'}</span></div></div><div className="canvas-legend"><span><i className="legend-dot neutral" /> Ready</span><span><i className="legend-dot green" /> ✓ Healthy</span><span><i className="legend-dot amber" /> △ Warning</span><span><i className="legend-dot red" /> ! Critical / failed</span><span className="mono node-count">{nodes.length} COMPONENTS</span></div></section>;
}
export function ArchitectureCanvas(props: ArchitectureCanvasProps) { return <ReactFlowProvider><Canvas {...props} /></ReactFlowProvider>; }
