import { useState } from 'react';
import { ArrowRight, Check, ChevronDown, ChevronUp, Lightbulb, Pause, Play, Sparkles } from 'lucide-react';
import { useSimulator } from '../../store/simulator-store';
import { compareRuns, getBobNote } from '../../learning/bob-coaching';
import type { BobAction } from '../../learning/bob-coaching';
import { BobAvatar } from './BobAvatar';

const highFives = [
  'High-five! Zero downtime on that one.',
  'That high-five had excellent throughput.',
  'Teamwork: the one thing we don’t need to cache.',
  'Achievement unlocked: made a tiny robot’s day.',
];

export function BobCoach({ onAction }: { onAction: (action: BobAction) => void }) {
  const s = useSimulator();
  const note = getBobNote(s);
  const [collapsedAt, setCollapsedAt] = useState<number | null>(null);
  const [still, setStill] = useState(false);
  const [hintKey, setHintKey] = useState('');
  const [reaction, setReaction] = useState({ key: '', count: 0 });
  // A completed run always brings Bob back; inspecting nodes never hides his notes.
  const collapsed = collapsedAt === s.runCount;
  const noteKey = `${s.runCount}-${s.revision}-${s.running}`;
  const showHint = hintKey === noteKey;
  const settled = !s.stale && !s.running ? s.result : null;
  const solved = settled?.missionState === 'stable';
  const stage = solved ? 3 : s.stale || (!s.result && s.revision > 0) ? 2 : s.runCount > 0 ? 1 : 0;
  const message = reaction.key === noteKey ? highFives[(reaction.count - 1) % highFives.length] : note.quip;

  return <section className={`bob-coach${collapsed ? ' bob-coach-collapsed' : ''}${solved ? ' bob-coach-success' : ''}`} aria-label="Bob’s engineering notes" data-mood={note.mood}>
    <div className="bob-coach-mascot">
      <BobAvatar mood={note.mood} size={116} still={still} onInteract={() => setReaction(previous => ({ key: noteKey, count: previous.count + 1 }))} />
      <span className="bob-name-tag">BOB <span>STAFF ENGINEER</span></span>
    </div>
    <div className="bob-coach-content">
      <div className="bob-coach-topline"><span className="bob-note-label"><span className="status-dot" /> YOUR ENGINEERING SIDEKICK</span><ol className="bob-learning-steps" aria-label="Learning progress">{['Observe', 'Diagnose', 'Experiment', 'Stabilize'].map((label, index) => <li key={label} className={index === stage ? 'current' : index < stage ? 'done' : ''} aria-current={index === stage ? 'step' : undefined}><span>{index < stage ? <Check size={10} /> : `0${index + 1}`}</span>{label}</li>)}</ol></div>
      <div className="bob-note" aria-live="polite" aria-atomic="true"><h2>{note.title}</h2>{!collapsed && <p>{note.text}</p>}</div>
      {!collapsed && <>
        <div className="bob-coach-bottom"><p className="bob-quip" role="status"><Sparkles size={12} />{message}</p><div className="bob-coach-actions"><button className="text-link bob-hint-button" aria-expanded={showHint} aria-controls="bob-hint" onClick={() => setHintKey(showHint ? '' : noteKey)}><Lightbulb size={14} />{showHint ? 'Hide hint' : 'Give me a hint'}</button><button className="bob-action" onClick={() => onAction(note.action)}>{note.actionLabel}<ArrowRight size={14} /></button></div></div>
        {settled && <p className="bob-run-comparison"><span>RUN {String(s.runCount).padStart(2, '0')}</span>{compareRuns(settled, s.previousResult)}</p>}
        <div id="bob-hint" className="bob-hint" hidden={!showHint}><Lightbulb size={16} /><p>{note.hint}</p></div>
      </>}
    </div>
    <div className="bob-coach-controls"><button className="icon-button" onClick={() => setCollapsedAt(collapsed ? null : s.runCount)} aria-label={collapsed ? 'Show Bob’s notes' : 'Minimize Bob’s notes'} aria-expanded={!collapsed}>{collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</button>{!collapsed && <button className="icon-button" onClick={() => setStill(value => !value)} aria-label={still ? 'Resume Bob’s animations' : 'Pause Bob’s animations'} aria-pressed={still}>{still ? <Play size={13} /> : <Pause size={13} />}</button>}</div>
  </section>;
}
