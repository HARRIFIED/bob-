import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { scenarios } from '../scenarios';
import { addComponent, arrange, configureRequestHandling, connect, removeComponent } from '../simulation/architecture';
import { simulate } from '../simulation/engine';
import { definitions, isApi } from '../data/component-definitions';
import type { ArchitectureState, ComponentKind, RequestHandling, RetryPolicy, SimulationResult, TelemetrySnapshot } from '../simulation/types';

export type DockTab = 'Metrics' | 'Logs' | 'Traces' | 'Cost' | 'Ledger';
interface State {
  scenarioId: string;
  screen: 'entry' | 'brief' | 'simulator'; architecture: ArchitectureState; selectedId: string | null;
  result: SimulationResult | null; completedResult: SimulationResult | null; previousResult: SimulationResult | null;
  history: TelemetrySnapshot[]; phase: number; runCount: number;
  revision: number; lastRunRevision: number; showCompletion: boolean; tab: DockTab; notice: string;
}
const initialState = (scenarioId = 'payday-surge'): State => ({ scenarioId, screen: 'entry', architecture: structuredClone(scenarios[scenarioId].initialArchitecture), selectedId: null,
  result: null, completedResult: null, previousResult: null, history: [], phase: -1, runCount: 0, revision: 0, lastRunRevision: -1, showCompletion: false, tab: scenarios[scenarioId].presentation.initialTab, notice: '' });
function finish(state: State): State {
  const scenario = scenarios[state.scenarioId];
  const result = simulate({ scenario, architecture: state.architecture });
  return { ...state, result, completedResult: result, previousResult: state.completedResult, phase: -1, runCount: state.runCount + 1, lastRunRevision: state.revision,
    history: scenario.trafficProfile.ramp.map((ratio, phase) => simulate({ scenario, architecture: state.architecture, traffic: ratio * scenario.trafficProfile.peak, phase }).telemetry),
    showCompletion: result.missionState === 'stable', notice: result.missionState === 'stable' ? 'Mission stable. All objectives passed.' : 'Simulation complete. Inspect telemetry to diagnose the incident.' };
}
function useSimulatorState() {
  const [state, setState] = useState<State>(() => initialState());
  const scenario = scenarios[state.scenarioId];
  const running = state.phase >= 0;
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setState(current => {
      if (current.phase < 0) return current;
      const activeScenario = scenarios[current.scenarioId];
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
    return { ...current, architecture, revision: current.revision + 1, notice, showCompletion: false };
  });
  return {
    ...state, running, stale: state.result !== null && !running && state.revision !== state.lastRunRevision,
    scenario,
    baseline: useMemo(() => simulate({ scenario, architecture: scenario.initialArchitecture }), [scenario]),
    navigate: (screen: State['screen']) => setState(c => c.phase >= 0 ? c : ({ ...c, screen })),
    selectMission: (id: string) => setState(c => {
      if (c.phase >= 0 || !scenarios[id]) return c;
      return id === c.scenarioId ? { ...c, screen: 'brief', showCompletion: false } : { ...initialState(id), screen: 'brief' };
    }),
    select: (selectedId: string | null) => setState(c => ({ ...c, selectedId })),
    setTab: (tab: DockTab) => setState(c => tab === 'Ledger' && scenarios[c.scenarioId].engine !== 'transfers' ? c : ({ ...c, tab })),
    add: (kind: ComponentKind) => edit(a => addComponent(a, kind), `${definitions[kind].name} added and connected. Run again to measure the change.`),
    setRetryPolicy: (policy: RetryPolicy) => edit(a => ({ ...a, nodes: a.nodes.map(node => node.kind === 'users' ? { ...node, retryPolicy: { ...policy } } : node) }), 'Retry policy changed. Replay the incident to check the ledger and confirmations.'),
    setRequestHandling: (policy: RequestHandling) => edit(a => configureRequestHandling(a, policy), 'API request handling updated for all workers. Rerun to test the behavior.'),
    remove: (id: string) => { edit(a => removeComponent(a, id), 'Component removed. Monthly cost updated.'); setState(c => ({ ...c, selectedId: null })); },
    resize: (id: string, kind: 'api-small' | 'api-medium') => edit(a => ({ ...a, nodes: a.nodes.map(n => n.id === id && isApi(n.kind) ? { ...n, kind } : n) }), 'API resized. Run again to measure its capacity.'),
    connect: (source: string, target: string) => edit(a => connect(a, source, target), 'Connection added. Run again to measure the change.'),
    disconnect: (id: string) => edit(a => ({ ...a, edges: a.edges.filter(e => e.id !== id) }), 'Connection removed. Check that requests can still reach PostgreSQL.'),
    move: (id: string, position: { x: number; y: number }) => setState(c => ({ ...c, architecture: { ...c.architecture, nodes: c.architecture.nodes.map(n => n.id === id ? { ...n, position } : n) } })),
    arrange: () => setState(c => ({ ...c, architecture: arrange(c.architecture) })),
    run: () => setState(c => {
      if (c.phase >= 0) return c;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return finish(c);
      const activeScenario = scenarios[c.scenarioId];
      const result = simulate({ scenario: activeScenario, architecture: c.architecture, traffic: activeScenario.trafficProfile.normal, phase: 0 });
      return { ...c, phase: 0, result, history: [result.telemetry], showCompletion: false, notice: `Simulation running. Replaying ${activeScenario.title}.` };
    }),
    skip: () => setState(c => c.phase >= 0 ? finish(c) : c),
    replay: () => setState(c => c.phase >= 0 ? c : { ...initialState(c.scenarioId), screen: 'simulator' }),
    closeCompletion: () => setState(c => ({ ...c, showCompletion: false })),
    openCompletion: () => setState(c => c.phase < 0 && c.revision === c.lastRunRevision && c.completedResult?.missionState === 'stable' ? { ...c, showCompletion: true } : c),
  };
}
type SimulatorStore = ReturnType<typeof useSimulatorState>;
const Context = createContext<SimulatorStore | null>(null);
export function SimulatorProvider({ children }: { children: ReactNode }) { const store = useSimulatorState(); return <Context.Provider value={store}>{children}</Context.Provider>; }
export function useSimulator() { const store = useContext(Context); if (!store) throw new Error('SimulatorProvider is required'); return store; }
