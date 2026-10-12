import { useEffect, useRef, useState } from 'react';
import { Award, LockKeyhole, RotateCcw, Star, X } from 'lucide-react';
import { componentGuides } from '../../learning/component-guides';
import { badges, missedChecks, starCount } from '../../learning/progress';
import { missionPreviews } from '../../scenarios';
import { labById, labs } from '../../scenarios/labs';
import { useSimulator } from '../../store/simulator-store';
import { EngineerCheckpoint, checkpointFor } from '../bob/EngineerCheckpoint';
import type { Quiz } from '../bob/EngineerCheckpoint';

function quizFor(id: string): Quiz | null {
  if (id.startsWith('lab:')) return labById(id.slice(4))?.quiz ?? null;
  const [scenarioId, topic] = id.split(':');
  return scenarioId && topic ? checkpointFor(topic, scenarioId) : null;
}

/** Saved learning record: stars, badges, and a spaced review of missed quick checks. */
export function ProgressPanel() {
  const { progress, answerCheck } = useSimulator();
  const [session, setSession] = useState<string[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const summary = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (session.length && !dialog.current?.open) dialog.current?.showModal();
    if (!session.length && dialog.current?.open) {
      dialog.current.close();
      // The opener is disabled once nothing is left to review; focus its message instead.
      if (opener.current && !opener.current.disabled) opener.current.focus();
      else summary.current?.focus();
    }
  }, [session]);
  const missed = missedChecks(progress).filter(id => quizFor(id));
  const earned = badges(progress);
  const missions = missionPreviews.filter(mission => mission.available);
  return <section className="record-section" aria-labelledby="record-title">
    <div className="section-heading">
      <div>
        <div className="eyebrow"><Award size={13} aria-hidden="true" /> YOUR ENGINEERING RECORD</div>
        <h2 id="record-title">Progress you can see.</h2>
        <p className="section-lede">Saved in this browser. Stars reward habits: finish, look at evidence before changing things, and spend wisely.</p>
      </div>
    </div>
    <div className="record-grid">
      <dl className="record-stats">
        {missions.map(mission => {
          const stars = starCount(progress.missions[mission.id]);
          return <div key={mission.id}>
            <dt>{mission.title}</dt>
            <dd>
              {[0, 1, 2].map(index => <Star key={index} size={15} aria-hidden="true" className={index < stars ? 'is-earned' : ''} fill={index < stars ? 'currentColor' : 'none'} />)}
              <span className="sr-only">{stars} of 3 stars</span>
            </dd>
          </div>;
        })}
        <div><dt>Component labs</dt><dd className="mono">{progress.labs.length}/{labs.length}</dd></div>
        <div><dt>Field guide entries read</dt><dd className="mono">{progress.guides.length}/{Object.keys(componentGuides).length}</dd></div>
        <div><dt>Quick checks answered correctly</dt><dd className="mono">{Object.values(progress.checks).filter(Boolean).length}</dd></div>
      </dl>
      <ul className="badge-grid" aria-label="Badges">
        {earned.map(badge => <li key={badge.id} className={badge.earned ? 'is-earned' : ''}>
          <span className="badge-icon" aria-hidden="true">{badge.earned ? <Award size={18} /> : <LockKeyhole size={15} />}</span>
          <span><strong>{badge.title}</strong><small>{badge.description}</small></span>
          <span className="badge-state">{badge.earned ? 'Earned' : 'Locked'}</span>
        </li>)}
      </ul>
    </div>
    <div className="review-strip">
      <RotateCcw size={16} aria-hidden="true" />
      <p ref={summary} tabIndex={-1}>{missed.length
        ? `Bob kept ${missed.length} quick ${missed.length === 1 ? 'check' : 'checks'} you missed. Coming back to them later helps the idea stick.`
        : 'Quick checks you miss in missions and labs come back here for review.'}</p>
      <button ref={opener} className="button secondary" disabled={!missed.length} onClick={() => setSession(missed)}>Review with Bob</button>
    </div>
    <dialog ref={dialog} className="completion-dialog review-dialog" aria-labelledby="review-title" onCancel={event => { event.preventDefault(); setSession([]); }}>
      <button className="icon-button dialog-close" aria-label="Close review" onClick={() => setSession([])}><X size={19} /></button>
      <div className="eyebrow">BOB’S REVIEW</div>
      <h2 id="review-title">Try these again.</h2>
      <p className="completion-subtitle">No pressure and no score. A correct answer leaves the review list.</p>
      {session.map(id => {
        const quiz = quizFor(id);
        return quiz && <EngineerCheckpoint key={id} quiz={quiz} onAnswer={correct => answerCheck(id, correct)} />;
      })}
      <div className="completion-actions"><button className="button primary" onClick={() => setSession([])}>Done</button></div>
    </dialog>
  </section>;
}
