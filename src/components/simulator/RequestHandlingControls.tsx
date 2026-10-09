import { useId } from 'react';
import { requestHandlingDefinition, requestHandlingOptions } from '../../data/request-policies';
import { useSimulator } from '../../store/simulator-store';

export function RequestHandlingControls() {
  const { architecture, running, setRequestHandling } = useSimulator();
  const id = useId();
  const policy = requestHandlingDefinition(architecture);
  return <fieldset className="retry-controls" disabled={running}>
    <legend>API request handling</legend>
    <div>
      <label htmlFor={id}>On POST /transfers</label>
      <select id={id} value={policy.value} onChange={event => {
        const selected = requestHandlingOptions.find(option => option.value === event.target.value);
        if (selected) setRequestHandling(selected.value);
      }}>
        {requestHandlingOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
    <p>{policy.description}</p>
    <p>Application code shared by all API workers. Applies to transfer requests; no extra infrastructure is provisioned.</p>
  </fieldset>;
}
