import { useId } from 'react';
import { useSimulator } from '../../store/simulator-store';
import { retryPolicy } from '../../simulation/transfers';

export function RetryControls() {
  const { architecture, running, setRetryPolicy } = useSimulator();
  const policy = retryPolicy(architecture);
  const id = useId();
  return <fieldset className="retry-controls" disabled={running}>
    <legend>Client retry policy</legend>
    <div>
      <label htmlFor={`${id}-retry`}>After a timeout</label>
      <select id={`${id}-retry`} value={policy.enabled ? 'retry' : 'stop'} onChange={event => setRetryPolicy({ ...policy, enabled: event.target.value === 'retry' })}>
        <option value="retry">Retry the transfer</option>
        <option value="stop">Do not retry</option>
      </select>
    </div>
    <div>
      <label htmlFor={`${id}-key`}>Idempotency-Key header</label>
      <select id={`${id}-key`} value={policy.keyStrategy} disabled={running} onChange={event => setRetryPolicy({ ...policy, keyStrategy: event.target.value === 'none' ? 'none' : event.target.value === 'new-key' ? 'new-key' : 'same-key' })}>
        <option value="same-key">Same key for each transfer’s retries</option>
        <option value="new-key">New key on every request</option>
        <option value="none">No Idempotency-Key header</option>
      </select>
    </div>
    <p>A header identifies the intent; the backend decides how to use it. Changes apply on the next run.</p>
  </fieldset>;
}
