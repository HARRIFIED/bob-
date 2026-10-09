# Bob the System Builder: project instructions

Apply these conventions to work in this project unless the user's task explicitly changes them. Read the relevant implementation before editing; use `README.md` for the learning flow, model assumptions, and local setup. Keep changes focused and preserve unrelated user work.

## Product and stack

- This is a browser-based system-design learning simulator. Keep the experience friendly, interactive, and grounded in the consequences of the learner's decisions.
- Use the existing React, TypeScript, Vite, Tailwind CSS, React Flow, and Lucide stack. Prefer existing dependencies and small reusable helpers over new frameworks or packages.
- Preserve operation without network access after the initial assets load. Do not introduce runtime font/image CDNs, external APIs, or an AI service unless the task calls for them.
- Payday Surge and Double Debit are playable missions. Future components and missions must remain clearly marked as previews until their behavior is implemented.

## Typography

- Use **Ubuntu** for headings, body copy, buttons, inputs, and general interface text. Inherit the shared font or use `var(--font-sans)`.
- Use **JetBrains Mono Variable** for metrics, logs, traces, costs, capacities, identifiers, and technical labels. Reuse `.mono`, `var(--mono)`, or `var(--font-mono)`.
- Keep tabular numerals for changing values and aligned numeric columns. Preserve the log text's disabled ligatures.
- Fonts are imported through Fontsource in `src/main.tsx`. Keep them self-hosted, preserve the existing weights/subsets, and retain licenses in `public/fonts/`.
- Font tokens live in `src/styles.css`; shared readability rules live in `src/typography.css`. Extend these rather than introducing unrelated font families or scattered font overrides.
- Fix cramped layouts with wrapping, spacing, scrolling, or responsive structure. Do not shrink essential labels until they are difficult to read.

## Icons and missing artwork

Use the established icon system consistently:

- **Technology/component icons:** `ComponentIcon` in `src/components/ComponentIcon.tsx`, also exported by `src/components/shared.tsx`. Reuse it in the palette, canvas, inspector, and other component views.
- **Branded services:** use the real technology logo. Redis, PostgreSQL, Kafka, and RabbitMQ already have local SVGs in `public/icons/`. Do not replace these with generic database/server glyphs or emoji.
- **Vendor-neutral infrastructure:** extend the existing colorful SVG symbols in `ComponentIcon`; do not imply that a generic server or load balancer belongs to a particular vendor.
- **Interface actions:** use `lucide-react` for controls such as search, navigation, settings, resize, and close. Match surrounding size and stroke treatment.

When a new technology component has no icon:

1. Search the existing icon mapping and `public/icons/` first.
2. If missing, source the correct logo from the technology's official brand assets or a maintained icon project's source repository, preferably Devicon to match existing assets. Use primary sources and verify the product identity and license; do not guess a download URL or invent an official-looking logo.
3. Prefer SVG. Download the asset into `public/icons/` from a pinned release or commit when available. Inspect it for a usable `viewBox`, scripts, event handlers, and external resource references; use a safe, self-contained asset.
4. Record its exact source, version/commit, license, and any modifications in `public/icons/README.md`. Include any required license/attribution files and respect the source's brand-use rules.
5. Add an explicit mapping in `ComponentIcon`. Do not let a new kind accidentally display the existing unrelated fallback symbol. Keep public asset URLs compatible with `import.meta.env.BASE_URL`.
6. Check the icon at palette, node, and inspector sizes, including the dark theme and compact palette. Preserve recognizable proportions and colors; use an appropriate light variant or documented contrast treatment where necessary.

Source missing public icons as part of implementing the component; do not leave that routine work for the user. If a suitable licensed asset cannot be obtained, clearly identify a provisional, vendor-neutral fallback and report the limitation rather than misrepresenting it as the real logo.

Decorative icons next to text use `aria-hidden` or empty image `alt` text. Icon-only buttons need meaningful accessible names. Do not rely on color or a hover tooltip alone to communicate an action or health state.

## Bob and branding

- Preserve Bob's identity: a friendly robot engineer with a yellow hard hat, mint/teal body, expressive eyes, and supportive humor.
- Reuse `src/components/bob/BobAvatar.tsx`; extend its SVG parts and moods instead of making a competing character or adding a raster animation dependency for ordinary reactions.
- The shared `Logo` in `src/components/shared.tsx` and browser favicon use Bob's face in `public/favicon.svg`. Keep those coordinated with the avatar. Do not revert to the old box or letter icon.
- Keep reactions and coaching tied to actual state through `src/learning/bob-coaching.ts`. Do not celebrate a healthy low-load sample as a completed mission, claim untested edits worked, or compare a completed run with a transient ramp sample.
- Bob's notes should remain available while inspecting nodes. Hints and quick checks support exploration without shaming wrong answers or blocking the learner.
- Preserve animation pause controls and `prefers-reduced-motion`. Never nest an interactive `BobAvatar` button inside another button; use a decorative rendering when needed.

## Code organization and model behavior

| Concern | Primary location |
| --- | --- |
| Domain types and component kinds | `src/simulation/types.ts` |
| Component names, descriptions, capacity, availability, and prices | `src/data/component-definitions.ts` |
| Graph editing and valid connections | `src/simulation/architecture.ts` |
| Deterministic simulation, formulas, cost, logs, and traces | `src/simulation/` |
| Mission objectives, traffic profiles, and teaching assumptions | `src/scenarios/` |
| Shared simulation state and run orchestration | `src/store/simulator-store.tsx` |
| Mentor notes and comparisons | `src/learning/bob-coaching.ts` |
| UI grouped by feature | `src/components/` |
| Panel layout preferences | `src/components/simulator/useWorkspaceLayout.ts` |

- Keep the simulation pure and deterministic: identical input produces identical output. Do not mutate inputs or put timers, browser APIs, network calls, or uncontrolled randomness into domain calculations.
- Keep model rules and prices out of JSX. Derive labels and numeric formatting from shared definitions/helpers; do not duplicate cost or objective calculations across views.
- Architecture edits invalidate old results. Preserve that distinction, run guards, and comparisons between completed runs. Moving a node or resizing a panel must not change the simulated design's performance.
- Charge for provisioned resources even if disconnected. Evaluate success using all mission objectives and the budget, not a hardcoded winning graph.
- Explain educational assumptions honestly. Do not present simplified telemetry as measurements from deployed infrastructure.

For a new simulated component, update its type, definition, icon, allowed connections, add/remove behavior, engine effects, cost/telemetry, relevant inspector controls, and coaching as needed. Cover its important behavior with tests. Adding a palette item alone does not make the component functional; keep `available: false` and a clear preview explanation until the model supports it.

## React, TypeScript, and styling practices

- Keep strict TypeScript checks enabled. Use explicit prop/domain types, `import type` for type-only imports, and guards for nullable state. Avoid `any`, unnecessary assertions, or suppressing type errors.
- Use function components and hooks. Keep transient interaction state local and shared simulation state in the existing provider. Derive values instead of storing redundant state.
- Use immutable updates, stable keys, and functional state setters when the next value depends on the previous one. Clean up timers, listeners, and observers; keep effects safe under React Strict Mode.
- Split complex rendering or repeated behavior into focused helpers/components. Use readable multiline JSX for new or substantially edited code; do not copy long compressed lines as a style requirement.
- Follow the existing ES module imports, single-quoted TypeScript strings, semicolons, and two-space indentation. Avoid unrelated reformatting.
- Reuse theme tokens, shared button/badge styles, and existing spacing patterns. Keep the dark theme with mint, warm yellow, and restrained status colors unless the task changes the design.
- Place global theme rules in `src/styles.css`, workspace sizing in `src/workspace-layout.css`, shared type rules in `src/typography.css`, and Bob styling in `src/bob.css`. Preserve the intentional import order in `src/main.tsx`.
- Scope new selectors to their component. Prefer fixing the relevant rule over stacking broad overrides or adding `!important`. Use inline styles for dynamic values such as dimensions and SVG gaze, not duplicated static themes.
- Use semantic controls, visible keyboard focus, accessible names, and sensible focus restoration. Preserve native dialog behavior, keyboard tab navigation, and non-pointer alternatives for canvas operations.
- Maintain usable desktop, compact, and touch layouts. Preserve the 900px workspace breakpoint, panel resizing/collapse behavior, and architecture expansion unless the task intentionally changes them. Avoid horizontal page overflow.
- Do not edit generated `dist/`, `node_modules/`, build metadata, or test output as source. Update `package-lock.json` when dependencies change and keep documentation aligned with behavior.

## Verification and handoff

Use checks appropriate to the change; do not add tests that only repeat implementation details.

| Change | Verification |
| --- | --- |
| TypeScript, React, CSS, asset, or build changes | `npm run build` |
| Simulation, architecture, or coaching logic | Relevant Vitest tests with `npm test` |
| Interactive UI, layout, keyboard behavior, or accessibility | Relevant Playwright specs with `npm run test:e2e -- <spec>`; inspect screenshots for visual changes |
| Documentation only | Review accuracy, referenced paths, and commands; no application build needed |

- Add meaningful regression tests for new model behavior, state transitions, and fixed bugs. Reuse existing browser flows for small visual changes.
- Relevant browser suites are `tests/learning-flow.spec.ts`, `tests/workspace-layout.spec.ts`, and `tests/bob-coach.spec.ts`. They cover accessibility, mobile use, offline behavior, learning progression, and workspace interactions.
- Browser tests use installed Google Chrome through Playwright's `chrome` channel. On Windows PowerShell, use `npm.cmd` when execution policy blocks `npm.ps1`; do not weaken system execution policy.
- There is no lint script currently. Do not claim checks ran if they did not. If verification is blocked, state what remains unverified.
- Finish with what changed, the checks actually run, and any material limitations. For downloaded assets, keep the attribution alongside the files. Do not introduce unrelated infrastructure or dependencies to complete a small task.
