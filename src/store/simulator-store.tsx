import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { defaultSandboxSettings, parseSandboxProject, sandboxScenario } from '../simulation/sandbox';
import type { SandboxProject, SandboxSettings } from '../simulation/sandbox';
import { scenarios } from '../scenarios';
import { labById } from '../scenarios/labs';
import { addComponent, arrange, configureNode, configureRequestHandling, connect, removeComponent, setNodeFault } from '../simulation/architecture';
import { simulate } from '../simulation/engine';
import { analyzeGraph } from '../simulation/flow';
import { definitions, isApi } from '../data/component-definitions';
import { guideKeyFor } from '../learning/component-guides';
import type { GuideKey } from '../learning/component-guides';
import { answerCheck, completeChallenge, completeLab, completeMission, emptyProgress, parseProgress, progressStorageKey, readGuide } from '../learning/progress';
import { decodeShare, shareHashPrefix } from './share-link';
import type { Progress } from '../learning/progress';
import type { ArchitectureState, ComponentKind, NodeConfig, NodeFault, RequestHandling, RetryPolicy, SimulationResult, TelemetrySnapshot } from '../simulation/types';

export type DockTab = 'Metrics' | 'Logs' | 'Traces' | 'Cost' | 'Ledger';
const evidenceTabs: DockTab[] = ['Traces', 'Logs', 'Ledger'];
interface State {
  sandbox: SandboxSettings | null; projectName: string; past: ArchitectureState[]; future: ArchitectureState[];
  scenarioId: string;
  /** Active Component Lab, if any. Labs use their own scenario and never touch mission state. */
  labId: string | null;
  /** Open Field Guide entry, shown as a dialog on any screen. */
  guide: GuideKey | null;
  /** The learner opened traces, logs, or the ledger after a failing run, before changing the design. */
  evidenceSeen: boolean;
  screen: 'entry' | 'brief' | 'simulator'; architecture: ArchitectureState; selectedId: string | null;
  result: SimulationResult | null; completedResult: SimulationResult | null; previousResult: SimulationResult | null;
  history: TelemetrySnapshot[]; phase: number; runCount: number;
  revision: number; lastRunRevision: number; showCompletion: boolean; tab: DockTab; notice: string;
}
const initialState = (scenarioId = 'payday-surge', labId: string | null = null): State => {
  const scenario = labById(labId)?.scenario ?? scenarios[scenarioId];
  return {
    sandbox: null, projectName: 'Untitled experiment', past: [], future: [], scenarioId, labId: labById(labId) ? labId : null,
    guide: null, evidenceSeen: false, screen: 'entry', architecture: structuredClone(scenario.initialArchitecture), selectedId: null,
    result: null, completedResult: null, previousResult: null, history: [], phase: -1, runCount: 0, revision: 0, lastRunRevision: -1,
    showCompletion: false, tab: scenario.presentation.initialTab, notice: '',
  };
};
const scenarioFor = (state: State) => labById(state.labId)?.scenario ?? (state.sandbox ? sandboxScenario(state.sandbox) : scenarios[state.scenarioId]);
const performanceKey = (a: ArchitectureState) => JSON.stringify({
  nodes: a.nodes.map(n => ({ id: n.id, kind: n.kind, retryPolicy: n.retryPolicy, config: n.config, fault: n.fault })),
  edges: a.edges, requestHandling: a.requestHandling,
});
function finish(state: State): State {
  const scenario = scenarioFor(state);
  const result = simulate({ scenario, architecture: state.architecture });
  const lab = !!state.labId;
  return {
    ...state, result, completedResult: result, previousResult: state.completedResult, phase: -1, runCount: state.runCount + 1, lastRunRevision: state.revision,
    history: scenario.trafficProfile.ramp.map((ratio, phase) => simulate({ scenario, architecture: state.architecture, traffic: ratio * scenario.trafficProfile.peak, phase }).telemetry),
    showCompletion: !state.sandbox && result.missionState === 'stable',
    evidenceSeen: state.evidenceSeen || (result.missionState === 'incident' && evidenceTabs.includes(state.tab)),
    notice: state.sandbox ? 'Experiment complete. Inspect the measurements and compare with your previous run.'
      : result.missionState === 'stable' ? lab ? 'Lab goal met. All objectives passed.' : 'Mission stable. All objectives passed.'
      : 'Simulation complete. Inspect telemetry to diagnose the incident.',
  };
}
/** A #share= link opens the shared design in Sandbox; an invalid link falls back to the landing page. */
function initialFromLocation(): State {
  try {
    const hash = window.location.hash;
    if (hash.startsWith(shareHashPrefix)) {
      const project = parseSandboxProject(decodeShare(hash.slice(shareHashPrefix.length)));
      return {
        ...initialState(), screen: 'simulator', sandbox: project.settings, projectName: project.name, architecture: project.architecture,
        tab: project.settings.workload === 'transfers' ? 'Ledger' : 'Metrics', notice: 'Shared design loaded. Run it to measure.',
      };
    }
  } catch {
    // Ignore malformed links and open the normal landing page.
  }
  return initialState();
}
function loadProgress(): Progress {
  try {
    return parseProgress(window.localStorage.getItem(progressStorageKey));
  } catch {
    return emptyProgress;
  }
}
function useSimulatorState() {
  const [state, setState] = useState<State>(initialFromLocation);
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const scenario = useMemo(() => scenarioFor(state), [state.scenarioId, state.sandbox, state.labId]);
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

  // Record a measured success once per completed run. Recording functions are idempotent (Strict Mode safe).
  const solved = !running && !state.sandbox && state.revision === state.lastRunRevision && state.completedResult?.missionState === 'stable' ? state.completedResult : null;
  useEffect(() => {
    if (!solved) return;
    if (state.labId) setProgress(current => completeLab(current, state.labId ?? ''));
    else setProgress(current => completeMission(current, state.scenarioId, {
      evidence: state.evidenceSeen, efficient: solved.telemetry.cost <= (scenario.stretchBudget ?? 0),
    }));
  }, [solved]);
  // Sandbox challenges are recorded the same way once every goal passes.
  const challenge = state.sandbox?.challenge ?? null;
  const challengeMet = !running && !!challenge && state.revision === state.lastRunRevision && !!state.completedResult?.objectives.length && state.completedResult.missionState === 'stable';
  useEffect(() => {
    if (challengeMet && challenge) setProgress(current => completeChallenge(current, challenge));
  }, [challengeMet, challenge]);
  // Live mode re-measures after every performance-affecting change, using the same pure model.
  useEffect(() => {
    if (!state.sandbox?.live) return;
    setState(current => current.sandbox?.live && current.phase < 0 && current.revision !== current.lastRunRevision ? finish(current) : current);
  }, [state.revision, state.sandbox?.live]);
  useEffect(() => {
    if (window.location.hash.startsWith(shareHashPrefix)) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(progressStorageKey, JSON.stringify(progress));
    } catch {
      // Storage can be blocked; progress still works for this visit.
    }
  }, [progress]);

  const edit = (fn: (a: ArchitectureState) => ArchitectureState, notice: string) => setState(current => {
    if (current.phase >= 0) return current;
    const architecture = fn(current.architecture);
    if (architecture === current.architecture) return current;
    return { ...current, architecture, past: [...current.past.slice(-49), current.architecture], future: [], revision: current.revision + 1, notice, showCompletion: false };
  });
  return {
    ...state, running, stale: state.result !== null && !running && state.revision !== state.lastRunRevision,
    scenario,
    lab: labById(state.labId) ?? null,
    progress,
    modelNotes: useMemo(() => analyzeGraph(state.architecture).notes, [state.architecture]),
    faultsEnabled: !!state.sandbox,
    baseline: useMemo(() => simulate({ scenario, architecture: scenario.initialArchitecture }), [scenario]),
    navigate: (screen: State['screen']) => setState(c => c.phase >= 0 ? c : ({ ...c, screen })),
    selectMission: (id: string) => setState(c => {
      if (c.phase >= 0 || !scenarios[id]) return c;
      return !c.sandbox && !c.labId && id === c.scenarioId ? { ...c, screen: 'brief', showCompletion: false, guide: null } : { ...initialState(id), screen: 'brief' };
    }),
    startLab: (id: string) => setState(c => {
      if (c.phase >= 0 || !labById(id)) return c;
      return c.labId === id ? { ...c, screen: 'simulator', guide: null } : { ...initialState('payday-surge', id), screen: 'simulator' };
    }),
    startSandbox: () => setState(c => c.phase >= 0 ? c : c.sandbox ? { ...c, screen: 'simulator', guide: null } : {
      ...initialState(), sandbox: { ...defaultSandboxSettings }, screen: 'simulator',
    }),
    openGuide: (kind: ComponentKind | GuideKey) => {
      const key = guideKeyFor(kind);
      setState(c => ({ ...c, guide: key }));
      setProgress(current => readGuide(current, key));
    },
    closeGuide: () => setState(c => ({ ...c, guide: null })),
    answerCheck: (id: string, correct: boolean) => setProgress(current => answerCheck(current, id, correct)),
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
      setState(c => c.phase >= 0 ? c : {
        ...initialState(), screen: 'simulator', sandbox: project.settings, projectName: project.name, architecture: project.architecture,
        tab: project.settings.workload === 'transfers' ? 'Ledger' : 'Metrics', notice: 'Sandbox loaded. Run to measure this design.',
      });
    },
    undo: () => setState(c => {
      const architecture = c.past.at(-1);
      return !architecture || c.phase >= 0 ? c : {
        ...c, architecture, past: c.past.slice(0, -1), future: [c.architecture, ...c.future], selectedId: null, showCompletion: false,
        revision: c.revision + Number(performanceKey(architecture) !== performanceKey(c.architecture)), notice: 'Undid the last diagram edit.',
      };
    }),
    redo: () => setState(c => {
      const architecture = c.future[0];
      return !architecture || c.phase >= 0 ? c : {
        ...c, architecture, past: [...c.past, c.architecture], future: c.future.slice(1), selectedId: null, showCompletion: false,
        revision: c.revision + Number(performanceKey(architecture) !== performanceKey(c.architecture)), notice: 'Redid the diagram edit.',
      };
    }),
    rename: (id: string, label: string) => setState(c => c.phase >= 0 || !label.trim() ? c : {
      ...c, past: [...c.past.slice(-49), c.architecture], future: [],
      architecture: { ...c.architecture, nodes: c.architecture.nodes.map(n => n.id === id ? { ...n, label: label.trim().slice(0, 80) } : n) },
    }),
    select: (selectedId: string | null) => setState(c => ({ ...c, selectedId })),
    setTab: (tab: DockTab) => setState(c => {
      if (tab === 'Ledger' && scenarioFor(c).engine !== 'transfers') return c;
      const investigating = evidenceTabs.includes(tab) && c.phase < 0 && c.revision === c.lastRunRevision && c.completedResult?.missionState === 'incident';
      return { ...c, tab, evidenceSeen: c.evidenceSeen || investigating };
    }),
    add: (kind: ComponentKind, position?: { x: number; y: number }) => edit(a => addComponent(a, kind, position, !!state.sandbox), `${definitions[kind].name} added without connections. Connect it using handles or its inspector.`),
    setRetryPolicy: (policy: RetryPolicy) => edit(a => ({ ...a, nodes: a.nodes.map(node => node.kind === 'users' ? { ...node, retryPolicy: { ...policy } } : node) }), 'Retry policy changed. Replay the incident to check the ledger and confirmations.'),
    setRequestHandling: (policy: RequestHandling) => edit(a => configureRequestHandling(a, policy), 'API request handling updated for all workers. Rerun to test the behavior.'),
    remove: (id: string) => { edit(a => removeComponent(a, id, !!state.sandbox), 'Component removed. Monthly cost updated.'); setState(c => ({ ...c, selectedId: null })); },
    resize: (id: string, kind: 'api-small' | 'api-medium') => edit(a => ({ ...a, nodes: a.nodes.map(n => n.id === id && isApi(n.kind) ? { ...n, kind } : n) }), 'API resized. Run again to measure its capacity.'),
    configure: (id: string, config: NodeConfig) => edit(a => configureNode(a, id, config), 'Component settings changed. Run again to measure the effect.'),
    setFault: (id: string, fault: NodeFault | null) => edit(a => setNodeFault(a, id, fault), fault ? 'Fault injected. Run the same workload to see how the design copes.' : 'Fault cleared. Run again to compare.'),
    connect: (source: string, target: string) => edit(a => connect(a, source, target, !!state.sandbox), 'Connection added. Run again to measure the change.'),
    disconnect: (id: string) => edit(a => ({ ...a, edges: a.edges.filter(e => e.id !== id) }), 'Connection removed. Check that requests still have a complete path.'),
    move: (id: string, position: { x: number; y: number }) => setState(c => c.phase >= 0 ? c : ({
      ...c, past: [...c.past.slice(-49), c.architecture], future: [],
      architecture: { ...c.architecture, nodes: c.architecture.nodes.map(n => n.id === id ? { ...n, position } : n) },
    })),
    arrange: () => setState(c => c.phase >= 0 ? c : ({ ...c, past: [...c.past.slice(-49), c.architecture], future: [], architecture: arrange(c.architecture) })),
    run: () => setState(c => {
      if (c.phase >= 0) return c;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return finish(c);
      const activeScenario = scenarioFor(c);
      const result = simulate({ scenario: activeScenario, architecture: c.architecture, traffic: activeScenario.trafficProfile.normal, phase: 0 });
      return { ...c, phase: 0, result, history: [result.telemetry], showCompletion: false, notice: `Simulation running. Replaying ${activeScenario.title}.` };
    }),
    skip: () => setState(c => c.phase >= 0 ? finish(c) : c),
    replay: () => setState(c => c.phase >= 0 ? c : { ...initialState(c.scenarioId, c.labId), screen: 'simulator' }),
    closeCompletion: () => setState(c => ({ ...c, showCompletion: false })),
    openCompletion: () => setState(c => !c.sandbox && c.phase < 0 && c.revision === c.lastRunRevision && c.completedResult?.missionState === 'stable' ? { ...c, showCompletion: true } : c),
  };
}
type SimulatorStore = ReturnType<typeof useSimulatorState>;
const Context = createContext<SimulatorStore | null>(null);
export function SimulatorProvider({ children }: { children: ReactNode }) {
  const store = useSimulatorState();
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useSimulator() {
  const store = useContext(Context);
  if (!store) throw new Error('SimulatorProvider is required');
  return store;
}
