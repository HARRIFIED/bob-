import { useState } from 'react';
import { Download, FolderOpen, Save } from 'lucide-react';
import { useSimulator } from '../../store/simulator-store';
import { sandboxStorageKey } from '../../simulation/sandbox';
import type { SandboxProject } from '../../simulation/sandbox';

export function SandboxControls() {
  const s = useSimulator();
  const [feedback, setFeedback] = useState('');
  const [template, setTemplate] = useState<'capacity' | 'transfers' | 'blank'>('capacity');
  if (!s.sandbox) return null;
  const settings = s.sandbox;
  const project = (): SandboxProject => ({ version: 1, name: s.projectName.trim() || 'Untitled experiment', settings, architecture: s.architecture });
  const report = (action: () => void, message: string) => {
    try { action(); setFeedback(message); }
    catch (error) { setFeedback(error instanceof Error ? error.message : 'Unable to access this project.'); }
  };
  return <div className="sandbox-controls">
    <p>Build freely, choose a workload, and compare measured runs. No mission to complete.</p>
    <fieldset disabled={s.running}>
      <legend>Project</legend>
      <label>Project name<input value={s.projectName} maxLength={80} onChange={e => s.setProjectName(e.target.value)} /></label>
      <div className="sandbox-actions">
        <button className="button secondary" onClick={() => report(() => localStorage.setItem(sandboxStorageKey, JSON.stringify(project())), 'Saved in this browser.')}><Save size={14} />Save</button>
        <button className="button secondary" onClick={() => report(() => {
          const saved = localStorage.getItem(sandboxStorageKey);
          if (!saved) throw new Error('No saved sandbox in this browser yet.');
          s.importSandbox(saved);
        }, 'Saved sandbox loaded.')}><FolderOpen size={14} />Load saved</button>
        <button className="button secondary" onClick={() => report(() => {
          const url = URL.createObjectURL(new Blob([JSON.stringify(project(), null, 2)], { type: 'application/json' }));
          const link = document.createElement('a');
          link.href = url; link.download = 'bob-sandbox.json'; link.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 'Sandbox exported as JSON.')}><Download size={14} />Export JSON</button>
      </div>
      <label>Import JSON<input type="file" accept=".json,application/json" onChange={async e => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (file.size > 500000) { setFeedback('File is too large. Maximum 500 KB.'); return; }
        try { const source = await file.text(); s.importSandbox(source); setFeedback('Sandbox imported. Run to measure this design.'); }
        catch (error) { setFeedback(error instanceof Error ? error.message : 'Unable to read this file.'); }
      }} /></label>
      <p className="empty-copy">Save stores one project locally. Export to keep multiple versions. Loading replaces the current workspace.</p>
      <label>Starting template<select value={template} onChange={e => setTemplate(e.target.value === 'blank' ? 'blank' : e.target.value === 'transfers' ? 'transfers' : 'capacity')}>
        <option value="capacity">Balance service</option><option value="transfers">Transfer service</option><option value="blank">Empty board</option>
      </select></label>
      <button className="button secondary" onClick={() => s.sandboxTemplate(template)}>Use template</button>
      <p className="empty-copy">Templates replace the diagram and clear results.</p>
    </fieldset>
    <fieldset disabled={s.running}>
      <legend>Workload</legend>
      <label>Simulation model<select value={settings.workload} onChange={e => s.configureSandbox({ ...settings, workload: e.target.value === 'transfers' ? 'transfers' : 'capacity' })}>
        <option value="capacity">Balance reads &amp; writes</option><option value="transfers">Transfer retries &amp; ledger</option>
      </select></label>
      <label>Peak traffic (req/s)<input type="number" min={1} max={100000} value={settings.peak} onChange={e => {
        const value = e.target.valueAsNumber;
        if (Number.isFinite(value) && value >= 1 && value <= 100000) s.configureSandbox({ ...settings, peak: value });
      }} /></label>
      {settings.workload === 'capacity' ? <label>Balance reads: {Math.round(settings.readFraction * 100)}%<input aria-label="Read percentage" type="range" min={0} max={100} value={settings.readFraction * 100} onChange={e => s.configureSandbox({ ...settings, readFraction: Number(e.target.value) / 100 })} /></label> : <>
        <label className="sandbox-check"><input type="checkbox" checked={settings.lostResponses} onChange={e => s.configureSandbox({ ...settings, lostResponses: e.target.checked })} />Lose two responses after commit</label>
        <label className="sandbox-check"><input type="checkbox" checked={settings.restartWorker} onChange={e => s.configureSandbox({ ...settings, restartWorker: e.target.checked })} />Restart worker before final retry</label>
        <p className="empty-copy">Three fixed transfers are replayed separately from the background load. Inspect Clients for retries and APIs for key lookup. No final retry or restart occurs when responses are delivered.</p>
      </>}
      <p className="empty-copy">To break a connection, remove it in the source component’s inspector and rerun.</p>
    </fieldset>
    <fieldset disabled={s.running}>
      <legend>Optional targets</legend>
      <label className="sandbox-check"><input type="checkbox" checked={settings.targets} onChange={e => s.configureSandbox({ ...settings, targets: e.target.checked })} />Evaluate model targets</label>
      <label>Monthly budget ($)<input type="number" min={0} max={1000000} value={settings.budget} onChange={e => {
        const value = e.target.valueAsNumber;
        if (Number.isFinite(value) && value >= 0 && value <= 1000000) s.configureSandbox({ ...settings, budget: value });
      }} /></label>
      {settings.targets && <ul>{s.scenario.objectives.map(o => <li key={o.id}>{o.label}: {o.comparison} {o.target}{o.unit}</li>)}</ul>}
    </fieldset>
    {s.runBlocker && <p className="inline-notice">{s.runBlocker}</p>}
    <p role="status">{feedback}</p>
  </div>;
}
