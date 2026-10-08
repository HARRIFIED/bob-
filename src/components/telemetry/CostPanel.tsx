import { useSimulator } from '../../store/simulator-store';
import { costBreakdown, monthlyCost, money } from '../../simulation/cost';
export function CostPanel() {
  const { architecture, scenario } = useSimulator();
  const total = monthlyCost(architecture);
  return <div className="cost-panel"><div className="cost-table-wrap"><table className="cost-table"><caption className="sr-only">Estimated monthly infrastructure cost</caption><thead><tr><th>RESOURCE</th><th>QTY</th><th>UNIT / MO</th><th>SUBTOTAL</th></tr></thead><tbody>{costBreakdown(architecture).map(row => <tr key={row.id}><td>{row.name}</td><td>{row.count}</td><td>{money(row.unitCost)}</td><td>{money(row.cost)}</td></tr>)}</tbody></table></div><div className={`cost-summary ${total > scenario.budget ? 'cost-over' : ''}`}><div><span>MONTHLY TOTAL</span><strong>{money(total)}<small> / month</small></strong></div><div><span>BUDGET {money(scenario.budget)}</span><strong>{total > scenario.budget ? 'OVER BUDGET' : `${money(scenario.budget - total)} remaining`}</strong></div><div className="budget-track"><span style={{ width: `${Math.min(100, total / scenario.budget * 100)}%` }} /></div><p>Costs update with every architecture change, including disconnected resources.</p></div></div>;
}
