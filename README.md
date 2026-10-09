# Bob the System Builder

**Build it. Break it. Understand it.**

A browser-based system-design learning simulator. You are on call at SwiftPay for a payday traffic surge or a duplicate-transfer incident: run the existing architecture, investigate an incident, change the system, and learn from the consequences.

Project conventions for coding agents and contributors are in [AGENTS.md](AGENTS.md), including typography, icon sourcing and attribution, Bob's branding, code organization, and verification.

## Run locally

Requires Node.js 22.12+ (tested with Node 24).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173`). On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

```sh
npm run build       # TypeScript validation and production build
npm run preview     # Serve dist locally
npm test            # Pure simulation and architecture tests
npm run test:e2e    # Full browser, keyboard, offline, mobile, accessibility tests
```

Browser tests use installed Google Chrome via Playwright's `chrome` channel. No Playwright browser download is required on a machine with Chrome installed. Close a manually started dev server before tests if it points at a different checkout.

## Playable missions

- Entry experience, mission previews, and playable **Payday Surge** and **Double Debit** briefings.
- React Flow architecture with selectable nodes, editable positions, request animations, and textual health states.
- A shared component catalog across missions: add small/medium API servers and Redis, resize APIs, and remove learner-added components. Unsupported components are global previews.
- Automatic connections when adding components, with manual connections through canvas handles or accessible inspector controls.
- Six-phase deterministic traffic or retry replays, a skip-animation control, and immediate results with reduced motion enabled.
- Metrics, readable logs, illustrative request traces, and live cost accounting. Double Debit adds a transaction ledger, HTTP request/response evidence, saved transfer records, client retry controls, and API request-handling settings.
- An original animated robot Bob with a hard hat, expressive faces, pointer-following eyes, and high-fives.
- Five mission objectives, evidence-based notes after every run, optional hints and quick checks, and a before/after debrief with reasoning and trade-offs.
- Local Redis, PostgreSQL, RabbitMQ, and Apache Kafka logos, plus colorful vendor-neutral infrastructure icons.
- Mobile panel switching, keyboard-friendly controls, accessible tab navigation, a native modal debrief, and no external assets or runtime API calls.

The app is fully client-side after initial load. Reloading requires the app's assets to be served again; there is no service worker or persistent progress yet. Bob is an authored mentor, not an AI chatbot.

## Learning with Bob

Bob stays above the workspace while you inspect components. His expression follows the traffic and the measured bottleneck; healthy early traffic does not trigger a success celebration. After a completed run, his notes compare latency and error rate (Payday) or duplicate debits and confirmations (Double Debit) with your previous completed run. Editing the design replaces old conclusions with a prompt to test again.

Click **Give me a hint** for a nudge, or Bob's action button to open the relevant metrics, trace, ledger, logs, or cost panel. The optional **Bob's quick check** in Mission explains the reasoning behind an answer without penalizing experimentation. Click Bob for a high-five. His notes can be minimized and return after the next completed run; animations can be paused and respect the operating system's reduced-motion preference.

Bob is an editable SVG in `src/components/bob/BobAvatar.tsx`, with animation and layout in `src/bob.css`. No custom image, animation account, or external API key is needed. Technology logos and their license are in `public/icons/`; see its README for pinned sources and attribution. Kafka and RabbitMQ remain future-mission previews, not functioning additions to the Payday simulator.

## A quick demo

1. Start Payday Surge and read the incident briefing.
2. Run the starting system: 2 medium APIs, a load balancer, and PostgreSQL.
3. Inspect the 97% database CPU, full connection pool, logs, and trace.
4. Add two medium APIs. Run again: the database is still saturated.
5. Add Redis, then run again. All five requirements pass at $1,340/month.
6. Read the debrief, inspect the healthy system, replay, or select **Next Mission: Double Debit**.

You can also add Redis first. Database pressure improves, but two API workers still cannot handle the peak. Other instance-size combinations can pass because success is evaluated from metrics rather than an exact graph.

## Adjusting the workspace

On desktop, drag the dividers beside **Components** and **Mission**, or above the observability dock, to resize those panels. Double-click a divider to reset that panel's size.

- Collapse Components with its header button to keep an icon-only palette. API icons show **S** or **M** for instance size; hover for the component name and estimate. The icons still add components.
- Collapse Mission with its header button; the narrow rail reopens it. Selecting a diagram node also opens the inspector automatically.
- Collapse the observability dock to its tab bar. Click any tab or the expand button to reopen it at its previous height.
- Click **Expand** in the architecture toolbar to use the whole workspace for the graph. **Restore layout** or **Escape** restores panel sizes, collapsed states, and the selected telemetry tab. Selecting a node opens its inspector.
- Keyboard users can Tab to each divider and use arrow keys to resize, Shift+arrows for larger steps, Enter to collapse/expand, Home to collapse, or End for maximum size.

The graph refits after a panel resize, browser resize, expansion, or instance addition. Panel sizes are bounded to keep the architecture usable on smaller desktops. At 900px and below, Components, Architecture, and Mission use the touch-friendly panel tabs. Layout choices last for the current workspace visit and do not change simulation results.

## Structure

Typography uses self-hosted Ubuntu (400, 500, 700) for the interface and JetBrains Mono Variable for technical data. Fontsource packages bundle the webfonts with the app using `font-display: swap`; Ubuntu uses the Latin subset, and JetBrains Mono loads subsets as needed. No external font service is needed at runtime. Font families are defined in `src/styles.css`, with shared readability adjustments in `src/typography.css`. Font licenses ship in `public/fonts/`.

```text
src/
  app/App.tsx                         Screen flow
  components/onboarding/             Entry and mission brief
  components/bob/                    Animated Bob, coaching strip, and optional quick checks
  components/ComponentIcon.tsx       Local technology logos and infrastructure symbols
  components/simulator/              Canvas, palette, inspector, objectives, debrief
    useWorkspaceLayout.ts            Panel dimensions and collapse/expand state
    ResizeHandle.tsx                 Pointer and keyboard resizing
    RequestHandlingControls.tsx       Application policy shared by API workers
  components/telemetry/              Metrics, logs, traces, cost, ledger, HTTP evidence, retry controls
  data/component-definitions.ts      Capacity, hardware, cost, descriptions
  data/request-policies.ts            Transfer-handler choices and lookup overhead
  learning/bob-coaching.ts           Result-driven notes, hints, actions, and run comparisons
  scenarios/index.ts                 Mission registry and availability
  scenarios/payday-surge.ts          Capacity mission, objectives, ramp, mentor strings
  scenarios/double-debit.ts          Retry incident, transfer fixture, objectives, mentor strings
  simulation/
    types.ts                         Domain contracts without React dependencies
    architecture.ts                  Valid connections and graph editing
    engine.ts                        Evaluator routing and Payday capacity model
    transfers.ts                     Deterministic ledger and idempotency model
    transfers.test.ts                Retry, correctness, routing, and ledger regressions
    formulas.ts                      Threshold evaluation and shared arithmetic
    cost.ts                          Immediate monthly estimates
    telemetry.ts                     Authored logs and illustrative traces
    engine.test.ts                   Domain and model regression checks
  store/simulator-store.tsx          Small React context and animation orchestration
  styles.css                         Responsive dark UI and reduced-motion styling
  workspace-layout.css               Adjustable desktop workspace and touch layouts
  bob.css                            Character animation, component art, and coaching layout
tests/bob-coach.spec.ts               Reactions, hints, comparisons, quick checks, and offline logos
tests/learning-flow.spec.ts           Payday learning and accessibility checks
tests/double-debit.spec.ts            Retry experiments, ledger evidence, mission switching, mobile/offline
tests/workspace-layout.spec.ts        Resizing, compact panels, expansion, and restoration
```

React 19, TypeScript, Vite, Tailwind CSS 4, React Flow, and Lucide. Tiny SVG sparklines keep chart rendering lightweight without a separate chart library. Tailwind is connected through its [official Vite integration](https://tailwindcss.com/docs/installation/using-vite); canvas nodes use [React Flow's custom node interface](https://reactflow.dev/learn/customization/custom-nodes).

## Payday Surge simulation rules

This is a deterministic teaching model, not a cloud capacity planner.

- Normal traffic is 1,200 req/s; the measured payday peak is 12,000 req/s.
- Requests are 90% repeated balance reads and 10% writes. A write costs twice as much database work as a read.
- Small APIs have 1,500 req/s of nominal capacity at $80/month; medium APIs have 2,500 req/s at $120/month.
- The starting cost is $80 for the load balancer + $240 for APIs + $600 for PostgreSQL = **$920/month**.
- Redis costs $180/month and serves 82% of repeated reads for the API capacity actually connected to it. Disconnected caches have no benefit but still cost money.
- Cache hits reduce API work by `0.4 × hitRate`, so peak effective compute demand with full cache coverage is `12,000 × (1 − 0.4 × 0.82) = 8,064 req/s`.
- Database demand is `traffic × (0.9 × (1 − hitRate) + 0.1 × 2)`. PostgreSQL has 6,000 weighted operations/sec of nominal capacity and a 100-connection pool.
- Overload creates capped queueing delay and deterministic errors. The base p95 is 145 ms. Database queue delay dominates the initial request trace.
- Broken end-to-end paths fail explicitly. Request distribution is simplified and weighted by API capacity.
- All provisioned resources incur cost, including disconnected ones. Architectural edits invalidate the previous run's objective results.
- Every objective must pass: p95 < 300 ms, errors < 1%, zero incorrect balances, availability ≥ 99.9%, and monthly cost ≤ $1,500. Availability is approximated as `100 − errorRate` for the run, so it is a stricter reliability requirement than the error-rate target.
- Correctness is an explicit scenario assumption: writes reach authoritative PostgreSQL and invalidate cache entries. Payday does not simulate stale-read races or a balance ledger; Double Debit models duplicate transfers separately.

| At peak traffic | Starting system | Redis only | 4 medium APIs + Redis |
| --- | ---: | ---: | ---: |
| p95 latency | 827 ms | 304 ms | 145 ms |
| Error rate | 13.84% | 1.27% | 0.04% |
| Database CPU | 97% | 67% | 67% |
| Database connections | 100/100 | 73/100 | 73/100 |
| Monthly cost | $920 | $1,100 | $1,340 |
| Result | Incident | Incident | Stable |

Simulation values and prices are simplified educational estimates inspired by cloud infrastructure. They are not production sizing recommendations.

## Double Debit demo and simulation rules

Start **Double Debit** from the mission card or Payday’s completion dialog. It opens with the same $920/month infrastructure and a different failure: a debit commits, its response is lost, and a retry reaches another API worker.

1. Run the baseline. In **Ledger**, inspect five postings for three intended transfers. The final balance is **₦32,000**, although it should be **₦40,000**.
2. Expand **Inspect request & response** on the original request and its retry. Both already carry the same `Idempotency-Key` and payload, but the API skips the lookup and creates a new debit.
3. Try more API capacity or Redis. The component catalog is the same in both missions. Redis forwards transfer writes to PostgreSQL, has zero read-cache hits for this workload, and adds cost; it does not automatically deduplicate.
4. In **API settings** in Ledger, or any API worker’s inspector, choose **Look up key in worker memory** and rerun. Another worker cannot see the first worker’s response, and a restart clears local records.
5. Choose **Look up key in PostgreSQL**. Rerun: three transfers create three debits; both retries return the original response JSON, including after a worker restart. Inspect **Saved transfer responses** to match each account/key to its receipt.
6. Experiment with **Retry settings**. A new key per request or no key defeats key lookup. Turning off retries avoids duplicates but leaves only **1/3 transfers confirmed**. Restore retries with a stable key and shared lookup to complete the mission.

The API settings describe application code, not a deployable “guard” service. They apply to all current and subsequently added API workers and remain editable in every mission. Payday’s workload evaluates balance-read capacity and does not exercise these transfer-handler settings. Changing application or client policy invalidates prior results just like a graph edit.

| Authored account sample | Baseline | Retries disabled | Shared lookup + original keys | Shared lookup + new keys | Worker-local lookup |
| --- | ---: | ---: | ---: | ---: | ---: |
| Intended transfers | 3 | 3 | 3 | 3 | 3 |
| Posted debits | 5 | 3 | 3 | 5 | 5 |
| Duplicate debits | 2 | 0 | 0 | 2 | 2 |
| Responses replayed | 0 | 0 | 2 | 0 | 0 |
| Confirmed transfers | 3/3 | 1/3 | 3/3 | 3/3 | 3/3 |
| Actual balance | ₦32,000 | ₦40,000 | ₦40,000 | ₦32,000 | ₦32,000 |
| Result | Incident | Incident | Stable | Incident | Incident |

The deterministic fixture starts Ada’s account at ₦50,000 and sends ₦5,000, ₦2,000, and ₦3,000. The first and third responses are lost after commit; the client retries after its authored 1,500 ms timeout. Before the final retry, its receiving worker restarts. That clears its private memory while preserving committed PostgreSQL data. Amounts and balances use integer minor units. Every run opens a fresh in-memory simulation; no real funds or database are involved.

Requests follow a repeatable worker sequence. The API can create each transfer unconditionally, look up keys in its own memory, or look them up in shared PostgreSQL transfer records. The response includes the receipt, transfer ID, recipient, amount, currency, and completion status. A matching key returns that exact saved response without another debit. A reused account/key with different parameters is rejected without moving money. The endpoint permits requests without a key, which are processed as new attempts.

A simple SELECT followed by an unprotected INSERT is insufficient under concurrency. The PostgreSQL mode assumes **UNIQUE(account, idempotency_key)** with the key reservation, debit, and response committed in one transaction. The evaluator executes that operation atomically; it does not simulate concurrent SQL transactions. Worker-local lookup adds a modeled 1 ms overhead, shared lookup 3 ms, and routing through Redis 5 ms. Application policies add no infrastructure line item. All provisioned infrastructure still costs money, even if disconnected.

All five objectives must pass: zero duplicate debits, zero incorrect account balances, 100% of intended transfers confirmed, accepted-request p95 < 300 ms, and cost ≤ $1,500/month. Healthy CPU or low processing latency alone does not imply correct behavior. The authored account sample is separate from the 1,200 req/s background-load estimates; its confirmation fraction is not a production availability SLO. The trace includes lookup, commit, timeout, and retry stages and is separate from the processing p95 estimate.

The model assumes committed PostgreSQL records survive the scripted worker restart and keys remain available for the retry window. It does not simulate transaction interleaving, mid-commit crashes, key expiry, insufficient funds, recipient credits, or external payment side effects. It illustrates repeated delivery with one debit effect, not a universal exactly-once delivery guarantee. Conceptual references: [Stripe’s idempotent request contract](https://docs.stripe.com/api/idempotent_requests), [PostgreSQL transaction atomicity](https://www.postgresql.org/docs/current/tutorial-transactions.html), and [unique-conflict handling](https://www.postgresql.org/docs/current/sql-insert.html).

## Scope and next steps

Payday Surge and Double Debit are playable. Read replicas, queues, outbox, Missing Event, and Global Expansion remain clearly marked previews. The same supported components are available in every mission; no component is locked to a mission. Load balancing and PostgreSQL are pre-provisioned, and the editor has a 12-API-instance limit.

Mission selection resets architecture, retry policy, results, and comparisons when switching to a different mission. Reopening the current mission’s briefing preserves its working design; **Replay Mission** starts that mission fresh. Moving nodes and adjusting workspace panels do not invalidate measured results. Architecture and retry-policy changes do.

Scenario definitions, graph editing, cost, telemetry, and UI remain separate. Future work can add **Missing Event** with a deterministic event-loss/outbox model, saved progress, and a run-comparison timeline.
