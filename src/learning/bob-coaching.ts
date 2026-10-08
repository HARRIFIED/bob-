import type { BobMood } from '../components/bob/BobAvatar';
import type { ArchitectureState, ScenarioDefinition, SimulationResult } from '../simulation/types';

export type BobAction = 'run' | 'Traces' | 'Metrics' | 'Logs' | 'Cost' | 'debrief';
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
  const latency = Math.round((current.telemetry.p95 - previous.telemetry.p95) * 100) / 100;
  const errors = Math.round((current.telemetry.errorRate - previous.telemetry.errorRate) * 100) / 100;
  const passed = current.objectives.filter(objective => objective.passed).length;
  const latencyNote = latency === 0 ? 'Latency unchanged' : `Latency ${Math.abs(latency)} ms ${latency < 0 ? 'lower' : 'higher'}`;
  const errorNote = errors === 0 ? 'errors unchanged' : `errors ${Math.abs(errors)} percentage points ${errors < 0 ? 'lower' : 'higher'}`;
  return `${latencyNote}; ${errorNote} vs. your last run. ${passed}/${current.objectives.length} requirements passed.`;
}
