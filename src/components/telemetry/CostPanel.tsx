import { definitions } from '../../data/component-definitions';
import { useSimulator } from '../../store/simulator-store';
import { costBreakdown, monthlyCost, money } from '../../simulation/cost';
export function CostPanel() {
  const { architecture, scenario } = useSimulator();
  const partial = architecture.nodes.some(n => !definitions[n.kind].available);
  const total = monthlyCost(architecture);
  return <div className="cost-panel"><div className="cost-table-wrap"><table className="cost-table"><caption className="sr-only">Estimated monthly infrastructure cost</caption><thead><tr><th>RESOURCE</th><th>QTY</th><th>UNIT / MO</th><th>SUBTOTAL</th></tr></thead><tbody>{costBreakdown(architecture).map(row => <tr key={row.id}><td>{row.name}</td><td>{row.count}</td><td>{definitions[row.id].available ? money(row.unitCost) : 'Unpriced preview'}</td><td>{definitions[row.id].available ? money(row.cost) : '—'}</td></tr>)}</tbody></table></div><div className={`cost-summary ${total > scenario.budget ? 'cost-over' : ''}`}><div><span>{partial ? 'PARTIAL ESTIMATE' : 'MONTHLY TOTAL'}</span><strong>{money(total)}<small> / month</small></strong></div><div><span>BUDGET {money(scenario.budget)}</span><strong>{total > scenario.budget ? 'OVER BUDGET' : `${money(scenario.budget - total)} remaining`}</strong></div><div className="budget-track"><span style={{ width: `${Math.min(100, total / Math.max(1, scenario.budget) * 100)}%` }} /></div><p>{partial ? 'Preview resources are unpriced. This is not a complete cost estimate.' : 'Costs update with every architecture change, including disconnected resources.'}</p></div></div>;
}
