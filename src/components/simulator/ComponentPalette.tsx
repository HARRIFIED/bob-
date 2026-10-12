import { useReactFlow } from '@xyflow/react';
import { useState } from 'react';
import { BookOpen, Info, PanelLeftClose, PanelLeftOpen, Plus, Search } from 'lucide-react';
import { definitions, isApi, singletonKinds } from '../../data/component-definitions';
import { guideKeyFor } from '../../learning/component-guides';
import { labsFor } from '../../scenarios/labs';
import { useSimulator } from '../../store/simulator-store';
import type { ComponentDefinition, ComponentKind } from '../../simulation/types';
import { ComponentIcon } from '../shared';

const groups = ['TRAFFIC', 'COMPUTE', 'DATA', 'MESSAGING', 'RELIABILITY'];

export function ComponentPalette({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const [query, setQuery] = useState('');
  const { architecture, add, running, sandbox, openGuide, progress } = useSimulator();
  const { screenToFlowPosition, setCenter, getZoom } = useReactFlow();
  const addAtCenter = (kind: ComponentKind) => {
    const bounds = document.querySelector('.flow-container')?.getBoundingClientRect();
    if (!bounds || !bounds.width) { add(kind); return; }
    const position = screenToFlowPosition({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
    position.x -= 100; position.y -= 70;
    // Find a free slot near the centre: step right, then wrap to a new row, so nodes never stack.
    const origin = { ...position };
    for (let i = 0; i < 60 && architecture.nodes.some(n => Math.abs(n.position.x - position.x) < 215 && Math.abs(n.position.y - position.y) < 165); i++) {
      position.x = origin.x + (i % 3 + 1) * 230;
      position.y = origin.y + Math.floor(i / 3) * 180;
    }
    add(kind, position);
    void setCenter(position.x + 105, position.y + 75, { zoom: getZoom(), duration: 0 });
  };
  const apiCount = architecture.nodes.filter(n => isApi(n.kind)).length;
  const search = collapsed ? '' : query.toLowerCase();
  const matches = (def: ComponentDefinition) => def.name.toLowerCase().includes(search);
  return <aside id="components-panel" className={`palette${collapsed ? ' palette-compact' : ''}`} aria-label="Component palette">
    <div className="sidebar-heading">
      <h2>Components</h2>
      <button className="icon-button desktop-layout-control" onClick={onToggle} aria-label={collapsed ? 'Expand Components panel' : 'Collapse Components to icons'} aria-expanded={!collapsed} aria-controls="components-panel" title={collapsed ? 'Expand Components panel' : 'Collapse Components to icons'}>
        {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
      </button>
    </div>
    <label className="component-search"><Search size={14} /><input aria-label="Search components" placeholder="Find a component…" value={query} onChange={e => setQuery(e.target.value)} /></label>
    <div className="palette-groups">
      {groups.map(group => {
        const components = Object.values(definitions).filter(def => def.category === group && matches(def));
        return components.length > 0 && <section key={group}>
          <h3>{group}</h3>
          {components.map(def => {
            const exists = architecture.nodes.some(n => n.kind === def.id);
            const limit = isApi(def.id) && apiCount >= 12;
            const available = def.available;
            const singleton = !sandbox && singletonKinds.includes(def.id);
            const disabled = (!available && !sandbox) || running || architecture.nodes.length >= 60 || (singleton && exists) || limit;
            const componentLabs = labsFor(guideKeyFor(def.id));
            const labsDone = componentLabs.filter(item => progress.labs.includes(item.id)).length;
            const status = !available ? 'Preview · not simulated' : singleton && exists ? 'Added to architecture' : limit ? '12 instance limit' : `$${def.monthlyCost}/mo`;
            return <div className="palette-row" key={def.id}>
              <button
                className={`palette-item ${!available ? 'preview-only' : ''}`} disabled={disabled} draggable={!disabled}
                onDragStart={event => {
                  event.dataTransfer.setData('application/bob-component', def.id);
                  event.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => addAtCenter(def.id)} aria-label={`Add ${def.name}`} title={`${def.name} · $${def.monthlyCost}/mo — ${def.description}`}
              >
                <span className={`component-icon ${def.category.toLowerCase()}`}>
                  <ComponentIcon kind={def.id} size={17} />
                  {isApi(def.id) && <span className="palette-size" aria-hidden="true">{def.id === 'api-small' ? 'S' : 'M'}</span>}
                </span>
                <span className="palette-item-name">
                  {def.name}
                  <small>{status}{componentLabs.length > 0 && <span className="palette-labs"> · {labsDone}/{componentLabs.length} labs</span>}</small>
                </span>
                {available && !(singleton && exists) && !limit && <Plus size={14} className="palette-plus" />}
              </button>
              <button className="icon-button palette-info" aria-label={`Learn about ${def.name}`} title={`Field guide: ${def.name}`} onClick={() => openGuide(def.id)}>
                <BookOpen size={14} />
              </button>
            </div>;
          })}
        </section>;
      })}
      {search && !Object.values(definitions).some(matches) && <p className="empty-copy">No matching components.</p>}
    </div>
    <div className="palette-help"><Info size={15} /><p>Drag a component onto the board, or click to add. New components are disconnected. Wire them using handles or the inspector. The book opens its field guide.</p></div>
  </aside>;
}
