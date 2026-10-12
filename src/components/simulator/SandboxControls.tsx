import { useState } from 'react';
import { Download, FileText, FolderOpen, Link2, Save, Trophy } from 'lucide-react';
import { useSimulator } from '../../store/simulator-store';
import { designDoc } from '../../learning/design-doc';
import { challengeById, challenges, workloadPresets } from '../../scenarios/challenges';
import { sandboxStorageKey } from '../../simulation/sandbox';
import type { SandboxProject } from '../../simulation/sandbox';
import { encodeShare, shareHashPrefix } from '../../store/share-link';

function download(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fileSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bob-design';

export function SandboxControls() {
  const s = useSimulator();
  const [feedback, setFeedback] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [template, setTemplate] = useState<'capacity' | 'transfers' | 'blank'>('capacity');
  if (!s.sandbox) return null;
  const settings = s.sandbox;
  const capacity = settings.workload === 'capacity';
  const challenge = capacity ? challengeById(settings.challenge) : undefined;
  const workload = { peak: challenge?.peak ?? settings.peak, readFraction: challenge?.readFraction ?? settings.readFraction };
  const preset = workloadPresets.find(item => item.peak === workload.peak && item.readFraction === workload.readFraction)?.id ?? 'custom';
  const measured = s.result && !s.stale && !s.running ? s.result : null;
  const challengeMet = !!challenge && measured?.missionState === 'stable';
  const project = (): SandboxProject => ({ version: 1, name: s.projectName.trim() || 'Untitled experiment', settings, architecture: s.architecture });
  const report = (action: () => void, message: string) => {
    try { action(); setFeedback(message); }
    catch (error) { setFeedback(error instanceof Error ? error.message : 'Unable to access this project.'); }
  };
  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}${shareHashPrefix}${encodeShare(project())}`;
    setShareUrl(url);
    try {
      await navigator.clipboard.writeText(url);
      setFeedback('Share link copied. Anyone who opens it gets this design in Sandbox.');
    } catch {
      setFeedback('Copy the share link below. Your browser blocked automatic copying.');
    }
  };
  return <div className="sandbox-controls">
    <p className="sandbox-intro">Build freely, choose a workload, and compare measured runs. Every diagram can run.</p>
    <fieldset disabled={s.running}>
      <legend>Workload</legend>
      <label>Simulation model
        <select value={settings.workload} onChange={e => s.configureSandbox({ ...settings, workload: e.target.value === 'transfers' ? 'transfers' : 'capacity' })}>
          <option value="capacity">Reads &amp; writes (flow model)</option>
          <option value="transfers">Transfer retries &amp; ledger</option>
        </select>
      </label>
      {capacity && <label>Preset
        <select aria-label="Workload preset" value={preset} disabled={!!challenge} onChange={e => {
          const chosen = workloadPresets.find(item => item.id === e.target.value);
          if (chosen) s.configureSandbox({ ...settings, peak: chosen.peak, readFraction: chosen.readFraction });
        }}>
          {workloadPresets.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          <option value="custom" disabled>Custom</option>
        </select>
      </label>}
      <label>Peak traffic (req/s)
        <input type="number" min={1} max={100000} value={challenge?.peak ?? settings.peak} disabled={!!challenge} onChange={e => {
          const value = e.target.valueAsNumber;
          if (Number.isFinite(value) && value >= 1 && value <= 100000) s.configureSandbox({ ...settings, peak: value });
        }} />
      </label>
      {capacity ? <label>Reads: {Math.round((challenge?.readFraction ?? settings.readFraction) * 100)}%
        <input aria-label="Read percentage" type="range" min={0} max={100} disabled={!!challenge} value={(challenge?.readFraction ?? settings.readFraction) * 100}
          onChange={e => s.configureSandbox({ ...settings, readFraction: Number(e.target.value) / 100 })} />
      </label> : <>
        <label className="sandbox-check"><input type="checkbox" checked={settings.lostResponses} onChange={e => s.configureSandbox({ ...settings, lostResponses: e.target.checked })} />Lose two responses after commit</label>
        <label className="sandbox-check"><input type="checkbox" checked={settings.restartWorker} onChange={e => s.configureSandbox({ ...settings, restartWorker: e.target.checked })} />Restart worker before final retry</label>
        <p className="empty-copy">Three fixed transfers are replayed separately from the background load. Inspect Clients for retries and APIs for key lookup.</p>
      </>}
      {challenge && <p className="empty-copy">This challenge sets the workload.</p>}
      <label className="sandbox-check">
        <input type="checkbox" checked={settings.live} onChange={e => s.configureSandbox({ ...settings, live: e.target.checked })} />
        Live mode: re-measure after every change
      </label>
    </fieldset>
    {capacity && <fieldset disabled={s.running}>
      <legend>Design challenge</legend>
      <label>Challenge
        <select aria-label="Design challenge" value={settings.challenge ?? ''} onChange={e => s.configureSandbox({ ...settings, challenge: e.target.value || null })}>
          <option value="">Free play · no goals</option>
          {challenges.map(item => <option key={item.id} value={item.id}>{s.progress.challenges.includes(item.id) ? '✓ ' : ''}{item.title}</option>)}
        </select>
      </label>
      {challenge && <p className="challenge-prompt">{challenge.prompt}</p>}
      {challengeMet && <p className="challenge-met" role="status"><Trophy size={14} aria-hidden="true" /> Challenge complete. Every goal passes.</p>}
      {challenge && !measured && <p className="empty-copy">Goals are listed below. Run your design to measure them.</p>}
    </fieldset>}
    {!challenge && <fieldset disabled={s.running}>
      <legend>Optional targets</legend>
      <label className="sandbox-check"><input type="checkbox" checked={settings.targets} onChange={e => s.configureSandbox({ ...settings, targets: e.target.checked })} />Evaluate model targets</label>
      <label>Monthly budget ($)
        <input type="number" min={0} max={1000000} value={settings.budget} onChange={e => {
          const value = e.target.valueAsNumber;
          if (Number.isFinite(value) && value >= 0 && value <= 1000000) s.configureSandbox({ ...settings, budget: value });
        }} />
      </label>
    </fieldset>}
    {s.modelNotes.length > 0 && (
      <section className="model-notes" aria-label="Model notes">
        <h3>Model notes</h3>
        <ul>{s.modelNotes.map(note => <li key={note}>{note}</li>)}</ul>
      </section>
    )}
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
        <button className="button secondary" onClick={() => void share()}><Link2 size={14} />Share link</button>
        <button className="button secondary" onClick={() => report(() => download(JSON.stringify(project(), null, 2), 'bob-sandbox.json', 'application/json'), 'Sandbox exported as JSON.')}><Download size={14} />Export JSON</button>
        <button className="button secondary" onClick={() => report(() => download(
          designDoc({ name: project().name, scenario: s.scenario, architecture: s.architecture, result: measured }),
          `${fileSlug(project().name)}.md`, 'text/markdown',
        ), measured ? 'Design notes exported with your latest measurements.' : 'Design notes exported. Run first to include measurements.')}><FileText size={14} />Design notes</button>
      </div>
      {shareUrl && <label>Share link<input readOnly value={shareUrl} onFocus={e => e.currentTarget.select()} /></label>}
      <label>Import JSON<input type="file" accept=".json,application/json" onChange={async e => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (file.size > 500000) { setFeedback('File is too large. Maximum 500 KB.'); return; }
        try { const source = await file.text(); s.importSandbox(source); setFeedback('Sandbox imported. Run to measure this design.'); }
        catch (error) { setFeedback(error instanceof Error ? error.message : 'Unable to read this file.'); }
      }} /></label>
      <p className="empty-copy">Save keeps one project in this browser. Export or share to keep versions. Nothing is uploaded: share links carry the design in the URL.</p>
      <label>Starting template<select value={template} onChange={e => setTemplate(e.target.value === 'blank' ? 'blank' : e.target.value === 'transfers' ? 'transfers' : 'capacity')}>
        <option value="capacity">Balance service</option><option value="transfers">Transfer service</option><option value="blank">Empty board</option>
      </select></label>
      <button className="button secondary" onClick={() => s.sandboxTemplate(template)}>Use template</button>
      <p className="empty-copy">Templates replace the diagram and clear results. Undo restores it.</p>
    </fieldset>
    <p role="status">{feedback}</p>
  </div>;
}
