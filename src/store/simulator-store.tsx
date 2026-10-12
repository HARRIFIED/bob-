import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { defaultSandboxSettings, parseSandboxProject, sandboxRunBlocker, sandboxScenario } from '../simulation/sandbox';
import type { SandboxProject, SandboxSettings } from '../simulation/sandbox';
import { scenarios } from '../scenarios';
import { addComponent, arrange, configureRequestHandling, connect, removeComponent } from '../simulation/architecture';
import { simulate } from '../simulation/engine';
import { definitions, isApi } from '../data/component-definitions';
import type { ArchitectureState, ComponentKind, RequestHandling, RetryPolicy, SimulationResult, TelemetrySnapshot } from '../simulation/types';

export type DockTab = 'Metrics' | 'Logs' | 'Traces' | 'Cost' | 'Ledger';
interface State {
  sandbox: SandboxSettings | null; projectName: string; past: ArchitectureState[]; future: ArchitectureState[];
  scenarioId: string;
  screen: 'entry' | 'brief' | 'simulator'; architecture: ArchitectureState; selectedId: string | null;
  result: SimulationResult | null; completedResult: SimulationResult | null; previousResult: SimulationResult | null;
  history: TelemetrySnapshot[]; phase: number; runCount: number;
  revision: number; lastRunRevision: number; showCompletion: boolean; tab: DockTab; notice: string;
}
const initialState = (scenarioId = 'payday-surge'): State => ({ sandbox: null, projectName: 'Untitled experiment', past: [], future: [], scenarioId, screen: 'entry', architecture: structuredClone(scenarios[scenarioId].initialArchitecture), selectedId: null,
  result: null, completedResult: null, previousResult: null, history: [], phase: -1, runCount: 0, revision: 0, lastRunRevision: -1, showCompletion: false, tab: scenarios[scenarioId].presentation.initialTab, notice: '' });
const scenarioFor = (state: State) => state.sandbox ? sandboxScenario(state.sandbox) : scenarios[state.scenarioId];
const performanceKey = (a: ArchitectureState) => JSON.stringify({ nodes: a.nodes.map(n => ({ id: n.id, kind: n.kind, retryPolicy: n.retryPolicy })), edges: a.edges, requestHandling: a.requestHandling });
function finish(state: State): State {
  const scenario = scenarioFor(state);
  const result = simulate({ scenario, architecture: state.architecture });
  return { ...state, result, completedResult: result, previousResult: state.completedResult, phase: -1, runCount: state.runCount + 1, lastRunRevision: state.revision,
    history: scenario.trafficProfile.ramp.map((ratio, phase) => simulate({ scenario, architecture: state.architecture, traffic: ratio * scenario.trafficProfile.peak, phase }).telemetry),
    showCompletion: !state.sandbox && result.missionState === 'stable', notice: state.sandbox ? 'Experiment complete. Inspect the measurements and compare with your previous run.' : result.missionState === 'stable' ? 'Mission stable. All objectives passed.' : 'Simulation complete. Inspect telemetry to diagnose the incident.' };
}
function useSimulatorState() {
  const [state, setState] = useState<State>(() => initialState());
  const scenario = useMemo(() => scenarioFor(state), [state.scenarioId, state.sandbox]);
  const running = state.phase >= 0;
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setState(current => {
      if (current.phase < 0) return current;
      const activeScenario = scenarioFor(current);
      if (current.phase >= activeScenario.scriptedEvents.length - 1) return finish(current);
      const phase = current.phase + 1;
      const result = simulate({ scenario: activeScenario, architecture: current.architecture, traffic: activeScenario.trafficProfile.peak * activeScenario.trafficProfile.ramp[phase], phase });
      return { ...current, phase, result, history: [...current.history, result.telemetry] };
    }), 650);
    return () => window.clearTimeout(timer);
  }, [state.phase, running]);
  const edit = (fn: (a: ArchitectureState) => ArchitectureState, notice: string) => setState(current => {
    if (current.phase >= 0) return current;
    const architecture = fn(current.architecture);
    if (architecture === current.architecture) return current;
    return { ...current, architecture, past: [...current.past.slice(-49), current.architecture], future: [], revision: current.revision + 1, notice, showCompletion: false };
  });
  return {
    ...state, running, stale: state.result !== null && !running && state.revision !== state.lastRunRevision,
    scenario,
    runBlocker: state.sandbox ? sandboxRunBlocker(state.architecture) : null,
    baseline: useMemo(() => simulate({ scenario, architecture: scenario.initialArchitecture }), [scenario]),
    navigate: (screen: State['screen']) => setState(c => c.phase >= 0 ? c : ({ ...c, screen })),
    selectMission: (id: string) => setState(c => {
      if (c.phase >= 0 || !scenarios[id]) return c;
      return !c.sandbox && id === c.scenarioId ? { ...c, screen: 'brief', showCompletion: false } : { ...initialState(id), screen: 'brief' };
    }),
    startSandbox: () => setState(c => c.phase >= 0 ? c : c.sandbox ? { ...c, screen: 'simulator' } : {
      ...initialState(), sandbox: { ...defaultSandboxSettings }, screen: 'simulator',
    }),
    setProjectName: (projectName: string) => setState(c => c.phase >= 0 ? c : { ...c, projectName: projectName.slice(0, 80) }),
    configureSandbox: (settings: SandboxSettings) => setState(c => !c.sandbox || c.phase >= 0 ? c : {
      ...c, sandbox: settings, revision: c.revision + 1, showCompletion: false,
      ...(settings.workload !== c.sandbox.workload ? { result: null, completedResult: null, previousResult: null, history: [], runCount: 0, tab: settings.workload === 'transfers' ? 'Ledger' : 'Metrics' } : {}),
    }),
    sandboxTemplate: (template: 'capacity' | 'transfers' | 'blank') => setState(c => !c.sandbox || c.phase >= 0 ? c : {
      ...initialState(template === 'transfers' ? 'double-debit' : 'payday-surge'), screen: 'simulator', projectName: c.projectName,
      sandbox: { ...c.sandbox, workload: template === 'transfers' ? 'transfers' : 'capacity', peak: template === 'transfers' ? 1200 : 12000 },
      architecture: template === 'blank' ? { nodes: [], edges: [] } : structuredClone(scenarios[template === 'transfers' ? 'double-debit' : 'payday-surge'].initialArchitecture),
      past: [...c.past.slice(-49), c.architecture], notice: 'Template loaded. Undo restores the previous diagram.',
    }),
    importSandbox: (source: string) => {
      const project: SandboxProject = parseSandboxProject(source);
      setState(c => c.phase >= 0 ? c : { ...initialState(), screen: 'simulator', sandbox: project.settings, projectName: project.name, architecture: project.architecture, tab: project.settings.workload === 'transfers' ? 'Ledger' : 'Metrics', notice: 'Sandbox loaded. Run to measure this design.' });
    },
    undo: () => setState(c => {
      const architecture = c.past.at(-1);
      return !architecture || c.phase >= 0 ? c : { ...c, architecture, past: c.past.slice(0, -1), future: [c.architecture, ...c.future], selectedId: null, showCompletion: false,
        revision: c.revision + Number(performanceKey(architecture) !== performanceKey(c.architecture)), notice: 'Undid the last diagram edit.' };
    }),
    redo: () => setState(c => {
      const architecture = c.future[0];
      return !architecture || c.phase >= 0 ? c : { ...c, architecture, past: [...c.past, c.architecture], future: c.future.slice(1), selectedId: null, showCompletion: false,
        revision: c.revision + Number(performanceKey(architecture) !== performanceKey(c.architecture)), notice: 'Redid the diagram edit.' };
    }),
    rename: (id: string, label: string) => setState(c => c.phase >= 0 || !label.trim() ? c : { ...c, past: [...c.past.slice(-49), c.architecture], future: [],
      architecture: { ...c.architecture, nodes: c.architecture.nodes.map(n => n.id === id ? { ...n, label: label.trim().slice(0, 80) } : n) } }),
    select: (selectedId: string | null) => setState(c => ({ ...c, selectedId })),
    setTab: (tab: DockTab) => setState(c => tab === 'Ledger' && scenarioFor(c).engine !== 'transfers' ? c : ({ ...c, tab })),
    add: (kind: ComponentKind, position?: { x: number; y: number }) => edit(a => addComponent(a, kind, position, !!state.sandbox), `${definitions[kind].name} added without connections. Connect it using handles or its inspector.`),
    setRetryPolicy: (policy: RetryPolicy) => edit(a => ({ ...a, nodes: a.nodes.map(node => node.kind === 'users' ? { ...node, retryPolicy: { ...policy } } : node) }), 'Retry policy changed. Replay the incident to check the ledger and confirmations.'),
    setRequestHandling: (policy: RequestHandling) => edit(a => configureRequestHandling(a, policy), 'API request handling updated for all workers. Rerun to test the behavior.'),
    remove: (id: string) => { edit(a => removeComponent(a, id, !!state.sandbox), 'Component removed. Monthly cost updated.'); setState(c => ({ ...c, selectedId: null })); },
    resize: (id: string, kind: 'api-small' | 'api-medium') => edit(a => ({ ...a, nodes: a.nodes.map(n => n.id === id && isApi(n.kind) ? { ...n, kind } : n) }), 'API resized. Run again to measure its capacity.'),
    connect: (source: string, target: string) => edit(a => connect(a, source, target, !!state.sandbox), 'Connection added. Run again to measure the change.'),
    disconnect: (id: string) => edit(a => ({ ...a, edges: a.edges.filter(e => e.id !== id) }), 'Connection removed. Check that requests can still reach PostgreSQL.'),
    move: (id: string, position: { x: number; y: number }) => setState(c => c.phase >= 0 ? c : ({ ...c, past: [...c.past.slice(-49), c.architecture], future: [], architecture: { ...c.architecture, nodes: c.architecture.nodes.map(n => n.id === id ? { ...n, position } : n) } })),
    arrange: () => setState(c => c.phase >= 0 ? c : ({ ...c, past: [...c.past.slice(-49), c.architecture], future: [], architecture: arrange(c.architecture) })),
    run: () => setState(c => {
      if (c.phase >= 0) return c;
      const blocked = c.sandbox ? sandboxRunBlocker(c.architecture) : null;
      if (blocked) return { ...c, notice: blocked };
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return finish(c);
      const activeScenario = scenarioFor(c);
      const result = simulate({ scenario: activeScenario, architecture: c.architecture, traffic: activeScenario.trafficProfile.normal, phase: 0 });
      return { ...c, phase: 0, result, history: [result.telemetry], showCompletion: false, notice: `Simulation running. Replaying ${activeScenario.title}.` };
    }),
    skip: () => setState(c => c.phase >= 0 ? finish(c) : c),
    replay: () => setState(c => c.phase >= 0 ? c : { ...initialState(c.scenarioId), screen: 'simulator' }),
    closeCompletion: () => setState(c => ({ ...c, showCompletion: false })),
    openCompletion: () => setState(c => !c.sandbox && c.phase < 0 && c.revision === c.lastRunRevision && c.completedResult?.missionState === 'stable' ? { ...c, showCompletion: true } : c),
  };
}
type SimulatorStore = ReturnType<typeof useSimulatorState>;
const Context = createContext<SimulatorStore | null>(null);
export function SimulatorProvider({ children }: { children: ReactNode }) { const store = useSimulatorState(); return <Context.Provider value={store}>{children}</Context.Provider>; }
export function useSimulator() { const store = useContext(Context); if (!store) throw new Error('SimulatorProvider is required'); return store; }
