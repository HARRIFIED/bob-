import type { MentorMessage } from '../simulation/types';

/** Evidence-based messages for any capacity workload. Missions override the keys they phrase differently. */
export const capacityMentorRules: Record<string, MentorMessage> = {
  initial: { id: 'initial', text: 'Run the workload before changing anything. The measurements will show where requests spend their time.' },
  database: { id: 'database', text: 'The primary database is saturated and its connection pool is filling up. Open the trace: where does the slow request wait?' },
  computeOnly: { id: 'computeOnly', text: 'More compute did not relieve the database. Every API still sends the same reads to it. What could answer repeated reads first?' },
  compute: { id: 'compute', text: 'The API layer is the bottleneck. Compare incoming traffic with the combined capacity of the connected workers.' },
  disconnected: { id: 'disconnected', text: 'Some requests have no complete path. Follow the connections from the clients through the load balancer and APIs to a database.' },
  budget: { id: 'budget', text: 'Performance looks good, but the design costs more than the budget. Find capacity you can remove and measure again.' },
  success: { id: 'success', text: 'Every target passes at this load. Explain which change mattered most and what it costs.' },
  stale: { id: 'stale', text: 'Some customers may read a balance that is missing their own latest write. A lagging replica, a TTL-only cache, or a queued write can serve old data. Logs name the source.' },
  backlog: { id: 'backlog', text: 'Writes are queuing faster than consumers apply them. The queue protects the database, but the backlog and its delay keep growing.' },
  replica: { id: 'replica', text: 'A read replica is overloaded. It serves reads and also replays every write from its primary, so its lag grows.' },
  outage: { id: 'outage', text: 'An offline component is failing requests. Can traffic route around it? Redundant instances behind a load balancer survive one failure.' },
  healthy: { id: 'healthy', text: 'No component is overloaded at this load. Raise the traffic, change the read mix, or inject a fault to find the next limit.' },
};
