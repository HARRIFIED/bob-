import { useEffect, useRef } from 'react';
import { ArrowRight, BookOpen, Check, Clock, ExternalLink, FlaskConical, X } from 'lucide-react';
import { definitions } from '../../data/component-definitions';
import { componentGuides } from '../../learning/component-guides';
import { labsFor } from '../../scenarios/labs';
import { useSimulator } from '../../store/simulator-store';
import { BobAvatar } from '../bob/BobAvatar';
import { ComponentIcon } from '../shared';

function GuideList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="field-guide-section">
      <h3>{title}</h3>
      <ul>{items.map(item => <li key={item}>{item}</li>)}</ul>
    </section>
  );
}

/** Field Guide entry for one component: concepts, failure modes, labs, and primary references. */
export function FieldGuide() {
  const { guide, closeGuide, startLab, startSandbox, progress, screen, sandbox, lab: activeLab, running } = useSimulator();
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (guide && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    }
    if (!guide && dialog.open) {
      dialog.close();
      opener.current?.focus();
    }
  }, [guide]);
  const entry = guide ? componentGuides[guide] : null;
  const guideLabs = guide ? labsFor(guide) : [];
  const replacesBoard = screen === 'simulator';
  return (
    <dialog
      ref={ref} className="field-guide" aria-labelledby="field-guide-title"
      onCancel={event => { event.preventDefault(); closeGuide(); }}
    >
      {guide && entry && <>
        <button className="icon-button dialog-close" aria-label="Close field guide" onClick={closeGuide}><X size={19} /></button>
        <header className="field-guide-header">
          <span className="field-guide-icon"><ComponentIcon kind={guide} size={34} /></span>
          <div>
            <span className="eyebrow"><BookOpen size={13} aria-hidden="true" /> FIELD GUIDE · {definitions[guide].category}</span>
            <h2 id="field-guide-title">{entry.title}</h2>
          </div>
        </header>
        <p className="field-guide-summary">{entry.summary}</p>
        <div className="field-guide-bob">
          <BobAvatar mood="curious" size={58} interactive={false} />
          <p><strong>Bob’s version:</strong> {entry.analogy}</p>
        </div>
        <div className="field-guide-columns">
          <GuideList title="Use it when" items={entry.useWhen} />
          <GuideList title="Think twice when" items={entry.avoidWhen} />
        </div>
        <GuideList title="Try it in Bob" items={entry.tryInBob} />
        <GuideList title="How it fails" items={entry.failureModes} />
        <p className="field-guide-model"><strong>In this simulator:</strong> {entry.modelNote}</p>

        <section className="field-guide-section field-guide-labs" aria-labelledby="field-guide-labs">
          <h3 id="field-guide-labs"><FlaskConical size={14} aria-hidden="true" /> Hands-on labs</h3>
          {guideLabs.length ? <ol>
            {guideLabs.map(item => {
              const done = progress.labs.includes(item.id);
              const current = activeLab?.id === item.id;
              return (
                <li key={item.id} className={done ? 'is-done' : ''}>
                  <span className="lab-status" aria-hidden="true">{done ? <Check size={13} /> : <FlaskConical size={13} />}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.summary}</p>
                    <small><Clock size={11} aria-hidden="true" /> about {item.minutes} min{done ? ' · completed' : ''}</small>
                  </div>
                  <button className="button secondary" disabled={running} onClick={() => startLab(item.id)}>
                    {current ? 'Continue' : done ? 'Replay' : 'Start'}<span className="sr-only"> {item.title}</span> <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ol> : <p className="field-guide-empty">
            No guided lab yet. Experiment with it freely in Sandbox.
            {!sandbox && <button className="text-link" disabled={running} onClick={startSandbox}>Open Sandbox <ArrowRight size={13} aria-hidden="true" /></button>}
          </p>}
          {replacesBoard && guideLabs.length > 0 && <p className="field-guide-note">Starting a lab replaces the board you are on. Save Sandbox work first.</p>}
        </section>

        <section className="field-guide-section">
          <h3>Go deeper</h3>
          <ul className="field-guide-links">
            {entry.reading.map(link => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.label} <ExternalLink size={12} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </>}
    </dialog>
  );
}
