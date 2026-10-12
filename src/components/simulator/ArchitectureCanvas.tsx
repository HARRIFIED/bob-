import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Background, BackgroundVariant, Controls, Handle, Position, ReactFlow, useNodesState, useReactFlow, useStore } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { GitBranch, Maximize2, Minimize2, MousePointer2, Redo2, Scan, Undo2 } from 'lucide-react';
import { definitions, isComponentKind } from '../../data/component-definitions';
import { canConnect } from '../../simulation/architecture';
import type { ArchitectureNode, NodeTelemetry } from '../../simulation/types';
import { useSimulator } from '../../store/simulator-store';
import { ComponentIcon, HealthBadge } from '../shared';
import '@xyflow/react/dist/style.css';

type FlowNode = Node<{
  component: ArchitectureNode; telemetry?: NodeTelemetry; selected: boolean; stale: boolean;
  baseTraffic: number; transfers: boolean; freeform: boolean; inspect: (id: string) => void;
}, 'component'>;
const ComponentNode = memo(function ComponentNode({ data }: NodeProps<FlowNode>) {
  const { component, telemetry, selected, stale, baseTraffic, transfers, freeform, inspect } = data;
  const def = definitions[component.kind];
  const health = stale || !def.available ? 'ready' : telemetry?.health ?? 'ready';
  const subtitle = !def.available ? 'Design preview · not simulated' : component.kind.startsWith('api') ?
    `${def.vcpu} vCPU · ${def.memory} GB · ${def.capacity.toLocaleString('en-US')} req/s` :
    component.kind === 'postgres' ? 'Primary · source of truth' :
    component.kind === 'redis' ? 'Read cache · write invalidation' :
    component.kind === 'users' ? transfers ? 'Transfer retries · lost responses' : 'Balance checks & transfers' : 'Capacity-weighted routing';
  return <div className={`architecture-node ${health} ${selected ? 'is-selected' : ''}`}>
    {(freeform || component.kind !== 'users') && <Handle type="target" position={Position.Left} />}
    <button className="node-select" onClick={event => { if (event.detail === 0) inspect(component.id); }} aria-label={`Inspect ${component.label}`}>
      <div className="node-top">
        <span className={`node-icon ${component.kind}`}><ComponentIcon kind={component.kind} size={19} /></span>
        <span className="node-kind">{component.kind === 'users' ? 'TRAFFIC SOURCE' : def.category}</span>
        {component.added && <span className="node-added" title="Added by you">+</span>}
      </div>
      <strong>{component.label}</strong>
      <div className="node-subtitle">{subtitle}</div>
      <div className="node-telemetry">
        {component.kind === 'users' ? <span className="node-traffic">{(telemetry?.traffic ?? baseTraffic).toLocaleString('en-US')} <small>req/s</small></span> :
          <><HealthBadge health={health} /><span className="mono">{!def.available ? 'PREVIEW' : telemetry && !stale ? telemetry.detail ?? `${telemetry.cpu}% CPU` : '—'}</span></>}
      </div>
    </button>
    {(freeform || component.kind !== 'postgres') && <Handle type="source" position={Position.Right} />}
  </div>;
});
const nodeTypes = { component: ComponentNode };
function ViewControls({ fitRevision }: { fitRevision: number }) {
  const { fitView } = useReactFlow();
  const width = useStore(state => state.width);
  const height = useStore(state => state.height);
  useEffect(() => {
    if (!width || !height) return;
    const timer = window.setTimeout(() => void fitView({ padding: 0.08, duration: 0 }), 100);
    return () => window.clearTimeout(timer);
  }, [width, height, fitRevision, fitView]);
  return <button className="canvas-fit icon-button" aria-label="Fit architecture to view" title="Fit architecture to view" onClick={() => void fitView({ padding: 0.08, duration: 0 })}><Scan size={16} /></button>;
}
interface ArchitectureCanvasProps { expanded: boolean; onToggleExpanded: () => void; onInspect: () => void }
export function ArchitectureCanvas({ expanded, onToggleExpanded, onInspect }: ArchitectureCanvasProps) {
  const store = useSimulator();
  const [fitRevision, setFitRevision] = useState(0);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const { screenToFlowPosition } = useReactFlow();
  const actions = useRef({ store, onInspect });
  actions.current = { store, onInspect };
  const inspect = useCallback((id: string) => { actions.current.store.select(id); actions.current.onInspect(); }, []);
  const { architecture, result, running, stale, selectedId, sandbox } = store;
  const peak = store.scenario.trafficProfile.peak;
  const transfers = store.scenario.engine === 'transfers';
  const freeform = !!sandbox;

  // React Flow owns transient dragging and measured dimensions. Commit a move only on release.
  useEffect(() => {
    setNodes(previous => architecture.nodes.map(component => {
      const existing = previous.find(n => n.id === component.id);
      return {
        ...existing, id: component.id, type: 'component', position: component.position,
        data: { component, telemetry: result?.nodes[component.id], selected: selectedId === component.id,
          stale, baseTraffic: peak, transfers, freeform, inspect },
        draggable: !running,
      };
    }));
  }, [architecture.nodes, result, selectedId, stale, peak, transfers, freeform, running, inspect, setNodes]);

  const edges = architecture.edges.map(e => ({
    ...e, type: 'smoothstep', animated: running, deletable: false,
    style: { stroke: !stale && result?.nodes[e.target]?.health === 'critical' ? '#dba369' : running ? '#c5dfa8' : '#7b8d83', strokeWidth: running ? 2 : 1.4 },
  }));
  return <section id="architecture-panel" className="canvas-section" aria-label="System architecture"
    onKeyDown={event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault(); if (event.shiftKey) store.redo(); else store.undo();
      }
    }}>
    <div className="canvas-toolbar">
      <div><GitBranch size={14} /><h2>Architecture</h2><span className="canvas-env">{sandbox ? 'sandbox' : 'production'}</span></div>
      <div className="canvas-toolbar-actions">
        <button className="icon-button" aria-label="Undo diagram edit" disabled={running || !store.past.length} onClick={store.undo}><Undo2 size={15} /></button>
        <button className="icon-button" aria-label="Redo diagram edit" disabled={running || !store.future.length} onClick={store.redo}><Redo2 size={15} /></button>
        <button className="text-link" onClick={() => { store.arrange(); setFitRevision(n => n + 1); }} disabled={running}>Auto-layout</button>
        <button id="architecture-expand" className="text-link desktop-layout-control" onClick={onToggleExpanded} aria-label={expanded ? 'Restore workspace layout' : 'Expand architecture'} aria-pressed={expanded} aria-controls="architecture-panel">
          {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}<span>{expanded ? 'Restore layout' : 'Expand'}</span>
        </button>
      </div>
    </div>
    <div className={`flow-container ${running ? 'is-running' : ''}`}
      onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = running ? 'none' : 'copy'; }}
      onDrop={event => {
        event.preventDefault();
        const kind = event.dataTransfer.getData('application/bob-component');
        if (!running && isComponentKind(kind)) store.add(kind, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
      }}>
      <ReactFlow<FlowNode> nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange}
        onNodeDragStop={(_, node) => store.move(node.id, node.position)}
        onNodeClick={(_, node) => inspect(node.id)} onPaneClick={() => store.select(null)}
        onConnect={connection => store.connect(connection.source, connection.target)}
        isValidConnection={connection => canConnect(architecture, connection.source, connection.target, freeform)}
        nodesConnectable={!running} nodesFocusable={false} edgesFocusable={false} deleteKeyCode={null}
        autoPanOnNodeDrag={false} nodeDragThreshold={4} fitView minZoom={0.1} maxZoom={2} colorMode="dark" attributionPosition="bottom-right">
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#343c38" />
        <Controls showInteractive={false} showFitView={false} />
        <ViewControls fitRevision={fitRevision} />
      </ReactFlow>
      <div className="canvas-region"><span className="status-dot" />{sandbox ? 'YOUR DESIGN' : 'SWIFTPAY CLOUD'} <span>/ local simulation</span></div>
      <div className="canvas-hint"><MousePointer2 size={12} /><span>Drag to move · Scroll to zoom · Connect handles · Fit to see every component</span></div>
    </div>
    <div className="canvas-legend">
      <span><i className="legend-dot neutral" /> Ready</span><span><i className="legend-dot green" /> ✓ Healthy</span>
      <span><i className="legend-dot amber" /> △ Warning</span><span><i className="legend-dot red" /> ! Critical / failed</span>
      <span className="mono node-count">{nodes.length} COMPONENTS</span>
    </div>
  </section>;
}
