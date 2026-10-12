import { useState } from 'react';
import { Check, Lightbulb } from 'lucide-react';

const checkpoints = {
  database: { question: 'More API servers, same overloaded database. What helps most?', choices: ['Keep adding API servers', 'Cache repeated balance reads', 'Ignore the slow requests'], answer: 1, explanation: 'Redis can answer repeated reads before they reach PostgreSQL. More API workers alone still send that work to the same database.' },
  compute: { question: 'Database pressure is down. API CPU is still high. Your next experiment?', choices: ['Add or resize an API worker', 'Add another cache', 'Remove the load balancer'], answer: 0, explanation: 'The remaining pressure is in the API layer. Test more compute capacity, then check the cost and performance together.' },
  disconnected: { question: 'A server is on the canvas but receives no traffic. Is it helping?', choices: ['Yes, just being there adds capacity', 'Only if it has more memory', 'No, it needs a complete request path'], answer: 2, explanation: 'Capacity only helps when requests can reach the server and the server can reach its dependencies. Inspect the connections.' },
  budget: { question: 'All performance targets pass, but the bill is too high. What next?', choices: ['Declare victory', 'Remove or downsize capacity and retest', 'Stop measuring the cost'], answer: 1, explanation: 'A working design also meets its budget. Make one small capacity change and rerun the same traffic to test the trade-off.' },
  success: { question: 'A balance changes. What must happen to its cached value?', choices: ['Keep it forever', 'Treat the cache as the source of truth', 'Invalidate or update it after the write'], answer: 2, explanation: 'PostgreSQL is authoritative. In this mission, writes invalidate the cached balance so the next read can fetch the new value.' },
  stale: { question: 'A customer transfers money, then sees their old balance. Why?', choices: ['The read came from a copy that had not caught up', 'The write was too fast', 'The API had too much CPU'], answer: 0, explanation: 'Replicas lag, TTL-only caches keep old values, and queued writes apply later. Route follow-up reads to the primary or invalidate on write.' },
  backlog: { question: 'A queue’s backlog keeps growing. What does that tell you?', choices: ['Publishing is broken', 'Consumers drain slower than producers publish', 'The database is too fast'], answer: 1, explanation: 'A queue absorbs bursts, but only enough consumer capacity drains it. Without that, the delay before writes apply keeps growing.' },
  replica: { question: 'Why can a read replica overload even with few reads?', choices: ['It also replays every write from the primary', 'Replicas cannot serve reads', 'It shares the API’s CPU'], answer: 0, explanation: 'Every write on the primary is applied on each replica. Write-heavy systems gain less from replicas.' },
  outage: { question: 'One API worker goes offline. What keeps requests flowing?', choices: ['A bigger database', 'Healthy workers behind a load balancer that skips the failed one', 'A longer cache TTL'], answer: 1, explanation: 'Redundant instances with health checks let traffic route around a failure, as long as the remaining capacity is enough.' },
};

const transferCheckpoints: Record<string, { question: string; choices: string[]; answer: number; explanation: string }> = {
  duplicate: { question: 'The client timed out. What does that prove?', choices: ['The debit rolled back', 'The response did not reach the client', 'Another API worker should debit again'], answer: 1, explanation: 'A timeout is ambiguous. The original transfer may already be committed, so a retry must identify the same logical operation.' },
  newKey: { question: 'A retry reaches another worker. Which key should it carry?', choices: ['A fresh key for each network request', 'The same key for every customer', 'The original transfer’s key'], answer: 2, explanation: 'Keep the original key and parameters for retries. A different transfer needs a different key. The record must be shared across workers.' },
  workerMemory: { question: 'A different worker gets the retry. Where can it find the saved response?', choices: ['In the first worker’s private memory', 'In a shared durable transfer record', 'In the CPU graph'], answer: 1, explanation: 'A shared PostgreSQL record survives worker changes and restarts. Local memory cannot guarantee that another worker will recognize the key.' },
  cacheOnly: { question: 'Does a balance-read cache automatically deduplicate transfer writes?', choices: ['Yes, because Redis is fast', 'No, the API must recognize and replay the same intent', 'Yes, if API CPU is low'], answer: 1, explanation: 'Caching reads reduces repeated reads. Safe transfer retries need a stable key and backend logic that reuses a committed response.' },
  unconfirmed: { question: 'Turning off retries removed duplicates. Is the incident solved?', choices: ['Yes, zero duplicates is the only requirement', 'No, some transfers still have no confirmation', 'Yes, the database is healthy'], answer: 1, explanation: 'A lost response leaves the client uncertain. Safe retries recover the original receipt without creating another debit.' },
  success: { question: 'What must commit together for safe retries?', choices: ['Only the key, before the debit', 'Only the receipt, after the response', 'The key reservation, debit, and receipt'], answer: 2, explanation: 'The model commits all three atomically in shared PostgreSQL storage. Separating them can leave a window for duplicate effects or missing receipts.' },
};

export interface Quiz { question: string; choices: string[]; answer: number; explanation: string }

/** Pick the quick check for a mission topic. Labs pass their own question instead. */
export function checkpointFor(topic: string, scenarioId: string): Quiz {
  return scenarioId === 'double-debit'
    ? transferCheckpoints[topic] ?? checkpoints[topic as keyof typeof checkpoints] ?? transferCheckpoints.duplicate
    : checkpoints[topic as keyof typeof checkpoints] ?? checkpoints.database;
}

export function EngineerCheckpoint({ quiz, onAnswer }: { quiz: Quiz; onAnswer?: (correct: boolean) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const correct = selected === quiz.answer;
  return <section className="engineer-checkpoint" aria-label="Engineer checkpoint">
    <div className="eyebrow"><Lightbulb size={13} /> BOB’S QUICK CHECK</div>
    <h3>{quiz.question}</h3>
    <div className="checkpoint-options">
      {quiz.choices.map((choice, index) => (
        <button
          key={choice} aria-pressed={selected === index}
          className={selected === index ? correct ? 'is-correct' : 'try-again' : ''}
          onClick={() => { setSelected(index); onAnswer?.(index === quiz.answer); }}
        >
          <span>{selected === index && correct ? <Check size={12} /> : String.fromCharCode(65 + index)}</span>{choice}
        </button>
      ))}
    </div>
    {selected !== null && <p className="checkpoint-feedback" role="status">
      <strong>{correct ? 'You’ve got it! ' : 'Good hypothesis. Think about this: '}</strong>{quiz.explanation}
    </p>}
  </section>;
}
