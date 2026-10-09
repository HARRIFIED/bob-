import type { BobMood } from '../components/bob/BobAvatar';
import type { ArchitectureState, ScenarioDefinition, SimulationResult } from '../simulation/types';

export type BobAction = 'run' | 'Traces' | 'Metrics' | 'Logs' | 'Cost' | 'Ledger' | 'debrief';
export interface BobNote {
  mood: BobMood;
  title: string;
  quip: string;
  text: string;
  hint: string;
  action: BobAction;
  actionLabel: string;
}
interface CoachingContext {
  scenario: ScenarioDefinition;
  architecture: ArchitectureState;
  result: SimulationResult | null;
  running: boolean;
  stale: boolean;
  phase: number;
  revision: number;
}

/** Feedback always follows the measured result, never a presumed successful edit. */
export function getBobNote({ scenario, architecture, result, running, stale, phase, revision }: CoachingContext): BobNote {
  if (scenario.engine === 'transfers') return transferNote({ scenario, architecture, result, running, stale, phase, revision });
  if (running) {
    const worried = Object.values(result?.nodes ?? {}).some(node => node.health === 'critical' || node.health === 'failed');
    return { mood: worried ? 'worried' : 'working', title: worried ? 'Okay. That is a lot of customers.' : 'Hard hat on. Here comes the traffic!',
      quip: worried ? 'My hat is rated for falling packets.' : 'Tiny robot. Very large clipboard.',
      text: `${scenario.scriptedEvents[phase]?.message ?? 'Watching the request path'}. We’re testing your design at increasing load.`,
      hint: 'Wait for peak traffic before judging the design. Looking healthy at low load does not mean the system can handle payday.', action: 'Metrics', actionLabel: 'Watch live metrics' };
  }
  if (stale || (!result && revision > 0)) {
    const cache = architecture.nodes.some(node => node.kind === 'redis');
    return { mood: 'thinking', title: 'A new design. A new hypothesis.', quip: 'My scientific method: less guessing, more graphing.',
      text: cache ? 'Redis is in your design. Rerun to check its hit rate, database pressure, and API capacity.' : 'You changed the architecture. Run the payday traffic to see what this design can actually handle.',
      hint: 'Keep the traffic the same between runs. Compare latency, error rate, and cost so you can explain the effect of your change.', action: 'run', actionLabel: 'Test this design' };
  }
  if (!result) return { mood: 'curious', title: 'Hey, engineer. Ready to break things?', quip: 'It’s a simulator. The only thing at risk is my coffee.',
    text: scenario.mentorRules.initial.text, hint: 'Start with the existing system. Then inspect the slowest span in Traces. An overloaded dependency can make every service before it look busy.', action: 'run', actionLabel: 'Run the baseline' };

  const notes: Record<string, Omit<BobNote, 'text'>> = {
    database: { mood: 'worried', title: 'We found a bottleneck. That’s progress!', quip: 'The database has one tiny straw. Payday brought a swimming pool.', hint: 'Most requests are repeated balance reads. What could serve those reads before they reach PostgreSQL? Follow the database wait in Traces.', action: 'Traces', actionLabel: 'Find the slow span' },
    computeOnly: { mood: 'thinking', title: 'More chefs. Still one tiny kitchen.', quip: 'The servers brought friends. The database did not.', hint: 'Adding API workers cannot remove repeated database reads. Try a Redis cache, then rerun and compare database CPU. Writes must still reach PostgreSQL.', action: 'Traces', actionLabel: 'Inspect the bottleneck' },
    compute: { mood: 'thinking', title: 'The bottleneck moved. Follow it!', quip: 'Postgres can breathe. The API workers would like a turn.', hint: 'Open Metrics and compare API CPU with database CPU. Add or resize an API worker, rerun the traffic, and check the budget too.', action: 'Metrics', actionLabel: 'Compare the pressure' },
    disconnected: { mood: 'worried', title: 'A request took a wrong turn.', quip: 'Even packets need directions. Mine come with doodles.', hint: 'Select a failed API node. In its inspector, connect it to PostgreSQL or to a Redis cache that connects to PostgreSQL. Check its load-balancer connection too.', action: 'Logs', actionLabel: 'Find the broken path' },
    budget: { mood: 'thinking', title: 'Fast system. Slightly spicy invoice.', quip: 'My hard hat is not a money printer. I checked.', hint: 'Use Cost to find an API worker you could downsize or remove. Rerun after each change to make sure performance still meets the requirements.', action: 'Cost', actionLabel: 'Follow the money' },
    success: { mood: 'celebrating', title: 'You did it, engineer. Payday saved!', quip: 'A high-five has been approved by the architecture committee.', hint: 'Explain the trade-off: caching lowers repeated read load, but costs money and needs a correct invalidation policy. More API capacity handles the remaining work.', action: 'debrief', actionLabel: 'See why it worked' },
  };
  return { ...(notes[result.mentor.id] ?? notes.compute), text: result.mentor.text };
}

export function compareRuns(current: SimulationResult, previous: SimulationResult | null): string {
  if (!previous) return 'Baseline captured. Your next completed run will be compared with this one.';
  if (current.ledger && previous.ledger) {
    const duplicates = current.telemetry.duplicateDebits - previous.telemetry.duplicateDebits;
    const duplicateNote = duplicates === 0 ? 'Duplicate debits unchanged' : `${Math.abs(duplicates)} ${duplicates < 0 ? 'fewer' : 'more'} duplicate debits`;
    return `${duplicateNote} vs. your last run. ${current.ledger.confirmedTransfers}/${current.ledger.plannedTransfers} transfers confirmed. ${current.objectives.filter(objective => objective.passed).length}/${current.objectives.length} requirements passed.`;
  }
  const latency = Math.round((current.telemetry.p95 - previous.telemetry.p95) * 100) / 100;
  const errors = Math.round((current.telemetry.errorRate - previous.telemetry.errorRate) * 100) / 100;
  const passed = current.objectives.filter(objective => objective.passed).length;
  const latencyNote = latency === 0 ? 'Latency unchanged' : `Latency ${Math.abs(latency)} ms ${latency < 0 ? 'lower' : 'higher'}`;
  const errorNote = errors === 0 ? 'errors unchanged' : `errors ${Math.abs(errors)} percentage points ${errors < 0 ? 'lower' : 'higher'}`;
  return `${latencyNote}; ${errorNote} vs. your last run. ${passed}/${current.objectives.length} requirements passed.`;
}

function transferNote({ scenario, result, running, stale, phase, revision }: CoachingContext): BobNote {
  if (running) return {
    mood: result?.telemetry.duplicateDebits ? 'worried' : 'working',
    title: result?.telemetry.duplicateDebits ? 'One intent just moved money twice.' : 'Follow the receipt, engineer.',
    quip: 'My clipboard keeps the receipts. Literally.',
    text: `${scenario.scriptedEvents[phase]?.message ?? 'Replaying the transfer sequence'}. The ledger is still being reconciled.`,
    hint: 'Wait for both retries. Zero duplicates before a retry arrives does not establish correctness.',
    action: 'Ledger', actionLabel: 'Watch the ledger',
  };
  if (stale || (!result && revision > 0)) return {
    mood: 'thinking', title: 'A new design. A new hypothesis.', quip: 'New code needs the same old incident.',
    text: 'The design or request policy changed. Replay the same incident and compare the actual debits with the intended transfers.',
    hint: 'Check duplicate debits, final balance, and confirmed transfers together. Disabling retries can leave a customer without confirmation.',
    action: 'run', actionLabel: 'Test this design',
  };
  if (!result) return {
    mood: 'curious', title: 'The graphs are calm. The ledger has a story.', quip: 'One coffee order. Two charges. I would investigate.',
    text: scenario.mentorRules.initial.text,
    hint: 'Start with the baseline. A timeout only tells the client that a response did not arrive; the debit may already have committed.',
    action: 'run', actionLabel: 'Run the baseline',
  };
  const notes: Record<string, Omit<BobNote, 'text'>> = {
    duplicate: { mood: 'worried', title: 'Healthy servers. Unhappy account balance.', quip: 'The retry brought a second receipt. Nobody ordered that.', hint: 'Open a request in Ledger. Does the retry carry the same key? Does the API look up that key before creating another transfer? Inspect an API worker’s request handling and compare the saved records.', action: 'Ledger', actionLabel: 'Compare the debits' },
    newKey: { mood: 'thinking', title: 'A new key looks like a new transfer.', quip: 'A lookup reads keys. It cannot read minds.', hint: 'In the client retry policy, reuse the original key. A new transfer gets a new key; a retry of the same transfer keeps its key and parameters.', action: 'Ledger', actionLabel: 'Check the retry keys' },
    missingKey: { mood: 'thinking', title: 'The intent needs an identity.', quip: 'Two identical coffee orders might still be two orders.', hint: 'Expand Client retry settings and compare the actual HTTP headers. Keep a key for each logical transfer across its retries; different transfers need different keys.', action: 'Ledger', actionLabel: 'Inspect the headers' },
    workerMemory: { mood: 'thinking', title: 'The receipt outlived the worker’s memory.', quip: 'A restarted clipboard is a blank clipboard.', hint: 'Compare the API worker IDs and the restart event. A successful debit remains in PostgreSQL. Where can another worker look up its saved response?', action: 'Ledger', actionLabel: 'Follow the saved response' },
    cacheOnly: { mood: 'thinking', title: 'These are writes, even with a read cache.', quip: 'A second coffee machine does not cancel a second order.', hint: 'Redis forwards these writes to PostgreSQL. Compare request keys, lookup results, and receipts. The API’s transfer handling decides whether to create a debit or return a saved response.', action: 'Ledger', actionLabel: 'Inspect transfer handling' },
    unconfirmed: { mood: 'thinking', title: 'No extra debit. Still no confirmation.', quip: 'Silence is not a receipt.', hint: 'Turn retries back on and make them safe with shared idempotency. All three intended transfers need a received acknowledgement.', action: 'Ledger', actionLabel: 'Inspect confirmations' },
    conflict: { mood: 'worried', title: 'That key already describes another transfer.', quip: 'Different coffee orders need different tickets.', hint: 'Bind keys to the caller and request parameters. Reject a reused key with a different payload; do not return an unrelated receipt.', action: 'Logs', actionLabel: 'Read the rejection' },
    disconnected: { mood: 'worried', title: 'The transfer never reached the ledger.', quip: 'No route, no receipt.', hint: 'Check the client, load balancer, API, and PostgreSQL path. Transfer writes still need a working path to the database.', action: 'Logs', actionLabel: 'Find the broken path' },
    budget: { mood: 'thinking', title: 'Safe retries. Oversized invoice.', quip: 'Duplicate servers still appear on the bill.', hint: 'Check Cost. Remove or downsize unnecessary capacity, then replay the same transfers to verify every requirement.', action: 'Cost', actionLabel: 'Follow the money' },
    compute: { mood: 'thinking', title: 'Correct writes still need enough capacity.', quip: 'Safe and slow is only half a fix.', hint: 'Compare API load and accepted request latency. Resize capacity and rerun without changing the retry contract.', action: 'Metrics', actionLabel: 'Inspect processing latency' },
    success: { mood: 'celebrating', title: 'Three transfers. Three debits. Nicely done!', quip: 'We can retry the high-five. The debit stays single.', hint: 'The shared key reservation, debit, and saved receipt are atomic. Retries may be delivered repeatedly, but replaying their stored receipt creates no additional ledger write.', action: 'debrief', actionLabel: 'See why it worked' },
  };
  return { ...(notes[result.mentor.id] ?? notes.duplicate), text: result.mentor.text };
}
