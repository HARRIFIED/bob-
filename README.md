# Bob the System Builder

**Build it. Break it. Understand it.**

A browser-based system-design learning simulator. Respond to production incidents at SwiftPay, learn one building block at a time in Component Labs, and experiment freely in Sandbox. Every design runs through the same deterministic flow model, so learners see the consequences of their decisions instead of reading about them.

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
npm test            # Simulation, labs, challenges, progress, and coaching tests
npm run test:e2e    # Full browser, keyboard, offline, mobile, accessibility tests
```

Browser tests use installed Google Chrome via Playwright's `chrome` channel. No Playwright browser download is required on a machine with Chrome installed. Close a manually started dev server before tests if it points at a different checkout.

## What learners can do

- **Missions:** playable **Payday Surge** (capacity, caching, observability) and **Double Debit** (retries, ledger, idempotency) incidents with briefings, five objectives, evidence-based notes, quick checks, and a before/after debrief.
- **Component Labs:** ten five-minute experiments, each with one measurable goal, covering API scaling, N+1 redundancy, Redis (shielding, sizing, freshness, cold start), read replicas (offloading, read-your-writes), RabbitMQ, and Kafka partitions.
- **Field Guide:** an entry for every component with what it is, when to use or avoid it, what to try in Bob, how it fails, what the simulator does not model, and links to primary documentation. Open it from the landing page, the palette's book button, the inspector, or a lab.
- **Sandbox:** any diagram runs. Workload presets, live re-measuring, break-it faults, design challenges, share links, JSON export, and Markdown design notes.
- **Progress:** saved in the browser. Mission stars, lab completion, badges, and a review of quick checks the learner missed.
- **Working components:** load balancer, small/medium API servers, background workers, PostgreSQL, MySQL, MongoDB, Redis (memory, TTL, write policy), read replicas (read-your-writes routing), RabbitMQ, and Apache Kafka (partitions). **Kubernetes**, **Transactional Outbox**, and **Change Data Capture** remain design-only previews: traffic drawn through them passes unchanged, and they are unpriced.
- React Flow architecture with selectable nodes, editable positions, handles and accessible inspector connections, request animations, and textual health states. An original animated robot Bob with a hard hat, expressive faces, pointer-following eyes, and high-fives.
- Mobile panel switching, keyboard-friendly controls, accessible tab navigation, native modal dialogs, and no external assets or runtime API calls.

The app is fully client-side after initial load. Reloading requires the app's assets to be served again; there is no service worker. Learning progress and one Sandbox project can be saved in this browser; nothing is uploaded. Bob is an authored mentor, not an AI chatbot.

## Learning with Bob

Bob stays above the workspace while you inspect components. His expression follows the traffic and the measured bottleneck; healthy early traffic does not trigger a success celebration. After a completed run, his notes compare latency and error rate (capacity) or duplicate debits and confirmations (Double Debit) with your previous completed run. Editing the design replaces old conclusions with a prompt to test again. In Sandbox, his notes name the measured bottleneck, stale-read source, backlog, or outage.

Click **Give me a hint** for a nudge, or Bob's action button to open the relevant metrics, trace, ledger, logs, or cost panel. **Bob's quick check** explains the reasoning behind an answer without penalizing experimentation; missed checks return for review on the landing page. Click Bob for a high-five. His notes can be minimized and return after the next completed run; animations can be paused and respect the operating system's reduced-motion preference.

Bob is an editable SVG in `src/components/bob/BobAvatar.tsx`, with animation and layout in `src/bob.css`. Technology logos and their license are in `public/icons/`; see its README for pinned sources and attribution.

## Component Labs, the Field Guide, and progress

Open **Component Labs** from the landing page. Each lab starts from a failing design with one goal, suggested steps, a Field Guide link, and its own quick check. Success is measured from the objectives, never from a fixed graph, so other valid designs also pass. Completing a lab opens a debrief with before/after measurements and offers the next lab.

| Lab | Component | Lesson |
| --- | --- | --- |
| Scale out the API tier | API Server | Horizontal scaling within a budget |
| Survive an instance failure | Load Balancer | Health checks and N+1 capacity |
| Shield the database | Redis | Caching repeated reads where more compute cannot help |
| Right-size the cache | Redis | Memory below the hot-data size lowers the hit rate |
| Fresh balances, warm cache | Redis | Invalidate on write; a short TTL alone is not enough |
| Survive a cold cache | Redis | Read headroom behind a flushed cache |
| Offload reads to a replica | Read Replica | Read scaling, replication lag |
| Read your own writes | Read Replica | Routing a customer's follow-up reads to the primary |
| Absorb a write spike | RabbitMQ | Queues spread work over time; too many workers overload the database again |
| Partitions cap parallelism | Apache Kafka | One consumer per partition in a group |

Progress is stored under `bob.progress.v1` in this browser. Mission stars reward engineering habits, never avoiding help: one for a stable result, one for opening traces, logs, or the ledger after a failing run and before changing the design, and one for finishing under the mission's stretch budget ($1,300 for Payday, $920 for Double Debit). Badges are derived from that record.

## Adjusting the workspace

On desktop, drag the dividers beside **Components** and **Mission**, or above the observability dock, to resize those panels. Double-click a divider to reset that panel's size.

- Collapse Components with its header button to keep an icon-only palette. API icons show **S** or **M** for instance size; hover for the component name and estimate. The icons still add components.
- Collapse Mission with its header button; the narrow rail reopens it. Selecting a diagram node also opens the inspector automatically.
- Collapse the observability dock to its tab bar. Click any tab or the expand button to reopen it at its previous height.
- Scroll with a mouse wheel or trackpad to pan the diagram in any direction; Shift+wheel pans sideways. Zoom with Ctrl+scroll (⌘+scroll on macOS), a trackpad pinch, or the +/− buttons. Dragging empty canvas also pans.
- Click **Expand** in the architecture toolbar to use the whole workspace for the graph. **Restore layout** or **Escape** restores panel sizes, collapsed states, and the selected telemetry tab. Selecting a node opens its inspector.
- Keyboard users can Tab to each divider and use arrow keys to resize, Shift+arrows for larger steps, Enter to collapse/expand, Home to collapse, or End for maximum size.

The graph refits after a panel resize, browser resize, or expansion. Adding a node places it in a free spot in the current view without changing existing node positions; use **Fit architecture to view** (top right of the canvas) to see the whole design. Dragging preserves the viewport and updates the stored position only on release. At 900px and below, Components, Architecture, and Mission use the touch-friendly panel tabs. Layout choices last for the current workspace visit and do not change simulation results.

## Flow model

Capacity missions, labs, and Sandbox use one pure, deterministic flow engine (`src/simulation/flow.ts`). Requests start at client sources and follow the drawn connections in topological order:

- **Routing:** load balancers split traffic by downstream capacity and skip offline instances. APIs send reads to caches first, otherwise to databases and replicas; writes go to queues first, otherwise to primary databases, otherwise through a cache. Several databases behind one service are treated as shards and split by capacity.
- **Cache:** hit rate = TTL ceiling × memory coverage × saturation. Coverage is `√(memory ÷ hot data)` (4 GB of hot data by default), because popular keys receive most reads. TTL ceilings are 50% (10 s), 72% (1 min), 82% (5 min), and 88% (1 h). A flushed cache reaches 10% of its normal hit rate.
- **Replicas** answer reads only, replay every write from their primary, and lag `20 ms + 450 ms × max(0, primary load − 0.6)`, plus more when the replica itself is busy.
- **Queues** acknowledge writes once queued. Workers drain 1,200 messages/second each; Kafka gives at most one consumer per partition. Backlog is reported after one minute at the measured load. RabbitMQ rejects publishes beyond 500,000 waiting messages.
- **Staleness:** 30% of writes are followed by the same customer's balance read about a second later. Such a read is stale if it lands on a lagging replica, a TTL-only cache, or before a queued write is applied. In capacity scenarios, `incorrectBalances` counts these stale balance reads per second.
- **Latency and errors:** overloaded components add capped queueing delay and deterministic errors to the requests that pass through them. p95 is the latency that 95% of requests beat; failed requests count as 2-second timeouts. The trace shows the p95 request's path.
- **Honesty:** connections that make no sense in the model, such as a database calling an API, and loops are drawn but listed as model notes rather than simulated.

Faults injected in Sandbox (offline, +200 ms, or a flushed cache) are saved with the design and apply to every run until cleared.

## Structure

Typography uses self-hosted Ubuntu (400, 500, 700) for the interface and JetBrains Mono Variable for technical data. Fontsource packages bundle the webfonts with the app using `font-display: swap`; Ubuntu uses the Latin subset, and JetBrains Mono loads subsets as needed. Font families are defined in `src/styles.css`, with shared readability adjustments in `src/typography.css`. Font licenses ship in `public/fonts/`.

```text
src/
  app/App.tsx                         Screen flow and the global Field Guide dialog
  components/onboarding/             Landing page, lab map, progress panel, mission brief
  components/learning/FieldGuide.tsx  Field Guide dialog
  components/bob/                    Animated Bob, coaching strip, and quick checks
  components/ComponentIcon.tsx       Local technology logos and infrastructure symbols
  components/simulator/              Canvas, palette, inspector, component settings, sandbox controls, debrief
  components/telemetry/              Metrics, logs, traces, cost, ledger, HTTP evidence, retry controls
  data/component-definitions.ts      Roles, capacity, prices, settings options
  data/request-policies.ts           Transfer-handler choices and lookup overhead
  learning/bob-coaching.ts           Result-driven notes, hints, actions, and run comparisons
  learning/component-guides.ts       Field Guide content and primary references
  learning/progress.ts               Saved progress, stars, badges, and review
  learning/design-doc.ts             Markdown design notes export
  scenarios/                         Missions, Component Labs, Sandbox challenges, mentor messages
  simulation/
    types.ts                         Domain contracts without React dependencies
    architecture.ts                  Guided connections, graph editing, settings, and faults
    flow.ts                          Graph routing, load propagation, latency, staleness
    component-model.ts               Documented teaching assumptions and formulas
    engine.ts                        Telemetry, objectives, and mentor signals
    transfers.ts                     Deterministic ledger and idempotency model
    sandbox.ts                       Sandbox scenarios and validated project files
    cost.ts / telemetry.ts           Monthly estimates, logs, and traces
  store/simulator-store.tsx          React context, run orchestration, progress persistence
  store/share-link.ts                URL-fragment share links
tests/                               Playwright suites: learning flow, Double Debit, labs, sandbox, layout, Bob
```

React 19, TypeScript, Vite, Tailwind CSS 4, React Flow, and Lucide. Tiny SVG sparklines keep chart rendering lightweight without a separate chart library. Tailwind is connected through its [official Vite integration](https://tailwindcss.com/docs/installation/using-vite); canvas nodes use [React Flow's custom node interface](https://reactflow.dev/learn/customization/custom-nodes).

## A quick Payday demo

1. Start Payday Surge and read the incident briefing.
2. Run the starting system: 2 medium APIs, a load balancer, and PostgreSQL.
3. Inspect the 97% database CPU, full connection pool, logs, and trace.
4. Add two medium APIs. Connect the load balancer to each, then each API to PostgreSQL. Run again: the database is still saturated.
5. Add Redis. Replace each API → PostgreSQL connection with API → Redis, and connect Redis → PostgreSQL. Run again. All five requirements pass at $1,340/month.
6. Read the debrief, inspect the healthy system, replay, or select **Next Mission: Double Debit**.

You can also add Redis first. Database pressure improves, but two API workers still cannot handle the peak. Other designs can pass because success is evaluated from metrics rather than an exact graph.

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
- Broken end-to-end paths fail explicitly. Request distribution is simplified and weighted by API capacity. An API the load balancer cannot reach stays idle but still costs money; an API that receives traffic without a path to data fails those requests.
- All provisioned resources incur cost, including disconnected ones. Architectural edits invalidate the previous run's objective results.
- Every objective must pass: p95 < 300 ms, errors < 1%, zero incorrect balances, availability ≥ 99.9%, and monthly cost ≤ $1,500. Availability is approximated as `100 − errorRate` for the run, so it is a stricter reliability requirement than the error-rate target.
- Correctness: with the default invalidate-on-write cache, writes reach authoritative PostgreSQL and invalidate cache entries. Read replicas, TTL-only caching, or queued writes can serve stale balances, which fail the incorrect-balances objective. Payday does not simulate a balance ledger; Double Debit models duplicate transfers separately.

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

Double Debit replays the synchronous path only: replicas, queues, workers, and other databases add cost but are not part of the transfer replay, and the model says so in its notes. The API settings describe application code, not a deployable “guard” service. They apply to all current and subsequently added API workers and remain editable in every mission. Payday’s workload evaluates balance-read capacity and does not exercise these transfer-handler settings. Changing application or client policy invalidates prior results just like a graph edit.

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

## Sandbox

Choose **Sandbox Mode** from the landing page. Start from the balance-service or transfer-service template, or replace it with an empty board. All nodes can be removed in Sandbox, and any component can be connected to any other. Drag from the palette or click to place an unconnected component; neither adding nor deleting chooses connections for you. Use the inspector to rename nodes, edit X/Y positions with a keyboard, connect or disconnect paths, change component settings, and inject faults. Undo/redo covers the last 50 diagram edits (including positions); Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z work while focus is in the board. Auto-layout is an explicit action.

- **Every diagram runs.** Design-only previews pass traffic through unchanged. Connections the model does not use are listed as model notes in Experiment settings and in Logs.
- **Workload:** choose a preset (balance checks, social feed, checkout, flash sale, quiet night), or set peak traffic from 1 to 100,000 req/s and the read percentage. The six-snapshot ramp starts at 10% of peak. The transfer workload replays the authored three-transfer sample with optional lost responses and a worker restart.
- **Live mode** re-measures after every change and compares each result with the one before it.
- **Break it:** take any component offline, add 200 ms of latency, or flush a cache from its inspector.
- **Design challenges** fix the workload and goals while the architecture stays yours: *Payday on a shoestring*, *Design a URL shortener*, and *Survive a flash sale*. Completed challenges are saved with your progress.
- **Optional targets** reuse the balance workload's thresholds with an editable budget. Sandbox never opens a mission victory dialog.
- Metrics, logs, traces, costs, the transfer ledger, and comparisons with the previous completed run remain available. Graph, setting, fault, and workload edits invalidate old results; position and label changes do not.

**Save** stores one named project in this browser. **Load saved** replaces the workspace with that project. **Share link** copies a URL whose fragment carries the design; fragments are not sent to the server, and the receiver's app validates the design before opening it in Sandbox. **Export JSON** keeps multiple projects or versions; **Import JSON** restores a validated version 1 export, including component settings and faults. **Design notes** downloads a Markdown write-up of the components, connections, latest measurements, and trade-offs. These actions save settings, labels, positions, connections, and application policies, not telemetry or a running simulation. Invalid files leave the current workspace intact. Switching to a mission or lab replaces the working sandbox, so save or export before switching.

Sandbox contracts and file validation live in `src/simulation/sandbox.ts`, challenges in `src/scenarios/challenges.ts`, and settings and persistence UI in `src/components/simulator/SandboxControls.tsx`. Tests are in `src/simulation/sandbox.test.ts`, `src/scenarios/challenges.test.ts`, and `tests/sandbox.spec.ts`. The editor retains React Flow and follows its [controlled node-state](https://reactflow.dev/api-reference/hooks/use-nodes-state) and [drag/drop coordinate](https://reactflow.dev/examples/interaction/drag-and-drop) interfaces; it does not embed Excalidraw or add a drawing framework.

## Scope and next steps

Payday Surge, Double Debit, ten Component Labs, and three Sandbox challenges are playable. Missing Event and Global Expansion remain clearly marked mission previews; Kubernetes, Transactional Outbox, and Change Data Capture remain design-only components. The same catalog is available in every mission and lab; no component is locked to a mission. Load balancing and PostgreSQL are pre-provisioned in missions, where one client source, load balancer, PostgreSQL database, and Redis cache are allowed. The editor allows 12 API instances and 60 total nodes.

Mission selection resets architecture, retry policy, results, and comparisons when switching to a different mission or lab. Reopening the current mission's briefing preserves its working design; **Replay Mission** or **Replay Lab** starts it fresh. Moving nodes and adjusting workspace panels do not invalidate measured results. Architecture, setting, fault, and retry-policy changes do.

Future work can add **Missing Event** with an event-loss/outbox model that makes the Outbox and CDC previews functional, autoscaling for the Kubernetes preview, and a run-comparison timeline.
