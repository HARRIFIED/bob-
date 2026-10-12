import { useReactFlow } from '@xyflow/react';
import { useState } from 'react';
import { Info, PanelLeftClose, PanelLeftOpen, Plus, Search } from 'lucide-react';
import { definitions, isApi, singletonKinds } from '../../data/component-definitions';
import { useSimulator } from '../../store/simulator-store';
import { ComponentIcon } from '../shared';

export function ComponentPalette({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const [query, setQuery] = useState('');
  const { architecture, add, running, sandbox } = useSimulator();
  const { screenToFlowPosition, setCenter, getZoom } = useReactFlow();
  const addAtCenter = (kind: import('../../simulation/types').ComponentKind) => {
    const bounds = document.querySelector('.flow-container')?.getBoundingClientRect();
    if (!bounds || !bounds.width) { add(kind); return; }
    const position = screenToFlowPosition({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
    position.x -= 100; position.y -= 70;
    for (let i = 0; i < 60 && architecture.nodes.some(n => Math.abs(n.position.x - position.x) < 215 && Math.abs(n.position.y - position.y) < 165); i++) { position.x += 40; position.y += 40; }
    add(kind, position);
    void setCenter(position.x + 105, position.y + 75, { zoom: getZoom(), duration: 0 });
  };
  const groups = ['TRAFFIC', 'COMPUTE', 'DATA', 'MESSAGING', 'RELIABILITY'];
  const apiCount = architecture.nodes.filter(n => isApi(n.kind)).length;
  const search = collapsed ? '' : query;
  return <aside id="components-panel" className={`palette${collapsed ? ' palette-compact' : ''}`} aria-label="Component palette"><div className="sidebar-heading"><h2>Components</h2><button className="icon-button desktop-layout-control" onClick={onToggle} aria-label={collapsed ? 'Expand Components panel' : 'Collapse Components to icons'} aria-expanded={!collapsed} aria-controls="components-panel" title={collapsed ? 'Expand Components panel' : 'Collapse Components to icons'}>{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div><label className="component-search"><Search size={14} /><input aria-label="Search components" placeholder="Find a component…" value={query} onChange={e => setQuery(e.target.value)} /></label><div className="palette-groups">{groups.map(group => {
    const components = Object.values(definitions).filter(def => def.category === group && def.name.toLowerCase().includes(search.toLowerCase()));
    return components.length > 0 && <section key={group}><h3>{group}</h3>{components.map(def => {
      const exists = architecture.nodes.some(n => n.kind === def.id);
      const limit = isApi(def.id) && apiCount >= 12;
      const available = def.available;
      const singleton = !sandbox && singletonKinds.includes(def.id);
      const preview = 'Preview · not simulated';
      const disabled = (!available && !sandbox) || running || architecture.nodes.length >= 60 || (singleton && exists) || limit;
      return <button key={def.id} className={`palette-item ${!available ? 'preview-only' : ''}`} disabled={disabled} draggable={!disabled} onDragStart={event => {
        event.dataTransfer.setData('application/bob-component', def.id);
        event.dataTransfer.effectAllowed = 'copy';
      }} onClick={() => addAtCenter(def.id)} aria-label={`Add ${def.name}`} title={`${def.name} · $${def.monthlyCost}/mo — ${def.description}`}><span className={`component-icon ${def.category.toLowerCase()}`}><ComponentIcon kind={def.id} size={17} />{isApi(def.id) && <span className="palette-size" aria-hidden="true">{def.id === 'api-small' ? 'S' : 'M'}</span>}</span><span className="palette-item-name">{def.name}<small>{!available ? preview : singleton && exists ? 'Added to architecture' : limit ? '12 instance limit' : `$${def.monthlyCost}/mo`}</small></span>{available && !(singleton && exists) && !limit && <Plus size={14} className="palette-plus" />}</button>;
    })}</section>;
  })}{search && !Object.values(definitions).some(d => d.name.toLowerCase().includes(search.toLowerCase())) && <p className="empty-copy">No matching components.</p>}</div><div className="palette-help"><Info size={15} /><p>Drag a component onto the board, or click to add. New components are disconnected. Wire them using handles or the inspector.</p></div></aside>;
}
