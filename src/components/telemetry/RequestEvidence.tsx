import type { AttemptOutcome, RequestHandling } from '../../simulation/types';

export function RequestEvidence({ attempt, currency, recordStore }: { attempt: AttemptOutcome; currency: string; recordStore: RequestHandling }) {
  const request = ['POST /transfers', ...(attempt.key ? [`Idempotency-Key: ${attempt.key}`] : []), 'Content-Type: application/json', '',
    JSON.stringify({ recipient: attempt.recipient, amountMinor: attempt.requestedAmountMinor, currency }, null, 2)].join('\n');
  const body = attempt.response ?? { error: attempt.outcome === 'conflict' ? 'key_payload_conflict' : 'transfer_service_unavailable' };
  const response = `HTTP/1.1 ${attempt.outcome === 'conflict' ? '409 Conflict' : attempt.outcome === 'unavailable' ? '503 Service Unavailable' : '200 OK'}\n\n${JSON.stringify(body, null, 2)}`;
  const lookup = attempt.lookup === 'skipped' ? attempt.key ? 'Key lookup skipped' : 'No key supplied'
    : `${recordStore === 'postgres' ? 'transfers table' : 'Worker memory'}: ${attempt.lookup === 'hit' ? 'matching record found' : attempt.lookup === 'miss' ? 'no matching record' : 'payload mismatch'}`;
  const effect = attempt.outcome === 'committed' ? 'New debit + receipt' : attempt.outcome === 'replayed' ? 'Return saved response · no debit' : 'No debit';
  return <details className="request-evidence">
    <summary>Inspect request & response <span className="mono">{attempt.id}</span></summary>
    {attempt.restartWorker && <p className="inline-notice">Worker restarted before this request. Its local memory was cleared; PostgreSQL records survived.</p>}
    <ol className="request-path" aria-label="Request processing">
      <li>Receive request</li><li>{attempt.outcome === 'unavailable' ? 'Database path unavailable' : lookup}</li><li>{effect}</li>
    </ol>
    <div className="request-messages">
      <div><h5>Client request</h5><pre className="mono" tabIndex={0} aria-label={`HTTP request ${attempt.id}`}>{request}</pre></div>
      <div><h5>{attempt.responseLost && attempt.response ? 'Server response · lost in transit' : 'Response received by client'}</h5><pre className="mono" tabIndex={0} aria-label={`HTTP response ${attempt.id}`}>{response}</pre></div>
    </div>
  </details>;
}
