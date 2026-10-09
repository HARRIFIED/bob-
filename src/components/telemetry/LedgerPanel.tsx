import { BookOpen, Check, RotateCcw, TriangleAlert } from 'lucide-react';
import { useSimulator } from '../../store/simulator-store';
import { retryPolicy, transferMoney } from '../../simulation/transfers';
import { RetryControls } from './RetryControls';
import { RequestHandlingControls } from '../simulator/RequestHandlingControls';
import { requestHandlingDefinition } from '../../data/request-policies';
import { RequestEvidence } from './RequestEvidence';

export function LedgerPanel() {
  const { result, scenario, architecture, stale, running } = useSimulator();
  const ledger = result?.ledger;
  const fixture = scenario.transfers;
  if (!fixture) return null;
  const format = (amount: number) => transferMoney(amount, fixture.currency);
  const worker = (id: string) => architecture.nodes.find(node => node.id === id)?.label ?? id;
  const incorrect = ledger && ledger.actualBalanceMinor !== ledger.expectedBalanceMinor;
  const policy = retryPolicy(architecture);
  const handler = requestHandlingDefinition(architecture);
  return <div className="ledger-panel">
    <div className="ledger-heading"><BookOpen size={17} aria-hidden="true" /><div><h3>Transaction ledger</h3><p>{fixture.account} · {fixture.intents.length} intended transfers · authored incident sample</p></div></div>
    <details className="ledger-policy"><summary>Retry settings <span>{policy.enabled ? policy.keyStrategy === 'same-key' ? 'Retries on · same key' : policy.keyStrategy === 'none' ? 'Retries on · no key' : 'Retries on · new key' : 'Retries off'}</span></summary><RetryControls /></details>
    <details className="ledger-policy api-policy"><summary>API settings <span>{handler.label}</span></summary><RequestHandlingControls /></details>
    {stale && <p className="inline-notice" role="status">Previous run shown. Rerun to test the current retry policy and architecture.</p>}
    <dl className="ledger-summary">
      <div><dt>Opening balance</dt><dd>{format(fixture.openingBalanceMinor)}</dd></div>
      <div><dt>Expected{running ? ' so far' : ''}</dt><dd>{ledger ? format(ledger.expectedBalanceMinor) : '—'}</dd></div>
      <div className={incorrect ? 'ledger-mismatch' : ''}><dt>Actual balance</dt><dd>{ledger ? format(ledger.actualBalanceMinor) : '—'}</dd></div>
    </dl>
    {ledger ? <>
      <div className="ledger-verdict" role="status">
        {incorrect ? <TriangleAlert size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
        <span>{incorrect ? `Balance differs by ${format(Math.abs(ledger.actualBalanceMinor - ledger.expectedBalanceMinor))}.` : running ? 'Balance reconciles so far. Wait for every retry.' : 'Balance reconciles.'} <strong>{result.telemetry.duplicateDebits} duplicate debits</strong> · {ledger.confirmedTransfers}/{ledger.plannedTransfers} transfers confirmed · {result.telemetry.replayedRequests} receipts replayed</span>
      </div>
      <section className="ledger-section" aria-label="Posted debits">
        <div className="ledger-section-title"><h4>Posted debits</h4><span className="mono">{ledger.postings.length} ENTRIES</span></div>
        {ledger.postings.length ? <div className="ledger-scroll" role="region" aria-label="Posted debit table" tabIndex={0}>
          <table className="ledger-table"><caption className="sr-only">Actual ledger writes, including duplicate debits</caption>
            <thead><tr><th scope="col">Receipt / transfer</th><th scope="col">Request key</th><th scope="col">Recipient</th><th scope="col">Debit</th><th scope="col">Balance after</th><th scope="col">Status</th></tr></thead>
            <tbody>{ledger.postings.map(posting => <tr key={posting.receiptId} className={posting.duplicate ? 'ledger-duplicate' : ''}>
              <th scope="row"><span className="mono">{posting.receiptId}</span><small className="mono">{posting.transferId}</small></th>
              <td className="mono">{posting.key ?? '—'}</td><td>{posting.recipient}</td><td className="mono">−{format(posting.amountMinor)}</td><td className="mono">{format(posting.balanceMinor)}</td>
              <td><span className={`ledger-badge ${posting.duplicate ? 'is-duplicate' : ''}`}>{posting.duplicate ? 'Duplicate debit' : 'Committed'}</span></td>
            </tr>)}</tbody>
          </table>
        </div> : <p className="ledger-empty">The account is open. Waiting for the first transfer.</p>}
      </section>
      <section className="ledger-section" aria-label="Request attempts">
        <div className="ledger-section-title"><h4>Request attempts</h4><span className="mono">{ledger.recordStore === 'postgres' ? 'SHARED TRANSFER RECORDS' : ledger.recordStore === 'worker-memory' ? 'WORKER-LOCAL RECORDS' : 'NO KEY LOOKUP'}</span></div>
        <p className="ledger-explanation">A lost response can hide a committed debit. Match the retry’s key and receipt across workers.</p>
        <div className="ledger-attempts">{ledger.attempts.map(attempt => <div className="ledger-attempt" key={attempt.id}>
          <div><strong className="mono">{attempt.id}</strong><span>{attempt.attempt > 1 ? <><RotateCcw size={12} aria-hidden="true" /> Retry {attempt.attempt - 1}</> : 'First attempt'}</span><span className="mono">{worker(attempt.apiId)}</span></div>
          <p><span className="mono">{attempt.key ?? 'No key header'}</span><span aria-hidden="true"> → </span><span className="mono">{attempt.receiptId ?? 'no receipt'}</span></p>
          <span className={`ledger-badge ${attempt.outcome === 'replayed' ? 'is-replay' : attempt.outcome === 'conflict' || attempt.outcome === 'unavailable' ? 'is-duplicate' : ''}`}>
            {attempt.outcome === 'replayed' ? 'Receipt replayed · no debit' : attempt.outcome === 'committed' ? `Committed · ${attempt.responseLost ? 'response lost' : 'confirmed'}` : attempt.outcome === 'conflict' ? 'Key / payload conflict · rejected' : 'Unavailable · no debit'}
          </span>
          <RequestEvidence attempt={attempt} currency={ledger.currency} recordStore={ledger.recordStore} />
        </div>)}</div>
      </section>
      <section className="ledger-section" aria-label="Saved transfer responses">
        <div className="ledger-section-title"><h4>Saved transfer responses</h4><span className="mono">{ledger.records.length} RECORDS</span></div>
        <p className="ledger-explanation">{ledger.recordStore === 'postgres' ? 'PostgreSQL · transfers · UNIQUE(account, idempotency_key). Each response is committed with its debit.' : ledger.recordStore === 'worker-memory' ? 'In-process lookup records, isolated by worker. A restart clears that worker’s entries.' : 'The API posts debits without keeping an account/key lookup record. A key in the request alone does not prevent another debit.'}</p>
        {ledger.records.map(record => <details className="saved-response" key={record.apiId + record.key}>
          <summary><span className="mono">{record.key}</span> → <span className="mono">{record.response.receiptId}</span></summary>
          <dl><div><dt>Account</dt><dd>{record.account}</dd></div><div><dt>Written by</dt><dd>{worker(record.apiId)}</dd></div></dl>
          <pre className="mono" tabIndex={0} aria-label={`Stored response ${record.response.receiptId}`}>{JSON.stringify(record.response, null, 2)}</pre>
        </details>)}
      </section>
    </> : <p className="ledger-empty">Run the baseline to follow three transfers and two retries. Compare the intended debits with the receipts actually written.</p>}
    <p className="ledger-footnote">This small ledger sample is separate from background load estimates. PostgreSQL lookup mode commits a unique account/key, debit, and stored response together. The replay includes a worker restart; concurrent transaction interleaving is not simulated.</p>
  </div>;
}
