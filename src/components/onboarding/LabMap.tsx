import { ArrowRight, BookOpen, Check, FlaskConical } from 'lucide-react';
import { componentGuides } from '../../learning/component-guides';
import type { GuideKey } from '../../learning/component-guides';
import { labs } from '../../scenarios/labs';
import { useSimulator } from '../../store/simulator-store';
import { ComponentIcon } from '../shared';

const tracks = [...new Set(labs.map(item => item.component))];
const guideOnly = (Object.keys(componentGuides) as GuideKey[]).filter(key => !tracks.includes(key));

/** Component Labs: short, measured experiments that teach one building block at a time. */
export function LabMap() {
  const { startLab, openGuide, progress } = useSimulator();
  const done = labs.filter(item => progress.labs.includes(item.id)).length;
  const next = labs.find(item => !progress.labs.includes(item.id));
  return <section id="labs" className="labs-section" aria-labelledby="labs-title">
    <div className="section-heading">
      <div>
        <div className="eyebrow"><FlaskConical size={13} aria-hidden="true" /> COMPONENT LABS</div>
        <h2 id="labs-title">Learn one building block at a time.</h2>
        <p className="section-lede">Each lab is a five-minute experiment with one goal. Read the field guide, break something, and measure the fix.</p>
      </div>
      <div className="labs-progress">
        <span className="mono">{done}/{labs.length} LABS</span>
        <span className="progress-track" aria-hidden="true"><span style={{ width: `${done / labs.length * 100}%` }} /></span>
        {next && <button className="button primary" onClick={() => startLab(next.id)}>
          {done ? 'Next up' : 'Start the first lab'}: {next.title} <ArrowRight size={16} aria-hidden="true" />
        </button>}
      </div>
    </div>
    <div className="lab-tracks">
      {tracks.map(key => {
        const guide = componentGuides[key];
        const trackLabs = labs.filter(item => item.component === key);
        const finished = trackLabs.filter(item => progress.labs.includes(item.id)).length;
        return <article key={key} className={`lab-track${finished === trackLabs.length ? ' is-mastered' : ''}`}>
          <header>
            <span className="lab-track-icon"><ComponentIcon kind={key} size={26} /></span>
            <div>
              <h3>{guide.title}</h3>
              <span className="mono">{finished}/{trackLabs.length} complete</span>
            </div>
          </header>
          <p>{guide.summary}</p>
          <ol>
            {trackLabs.map(item => {
              const complete = progress.labs.includes(item.id);
              return <li key={item.id}>
                <button className="lab-link" onClick={() => startLab(item.id)}>
                  <span className={`lab-status${complete ? ' is-done' : ''}`} aria-hidden="true">{complete ? <Check size={12} /> : <FlaskConical size={12} />}</span>
                  <span>{item.title}<small>{complete ? 'Completed · replay' : `About ${item.minutes} min`}</small></span>
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </li>;
            })}
          </ol>
          <button className="text-link" onClick={() => openGuide(key)}><BookOpen size={13} aria-hidden="true" /> {guide.title} field guide</button>
        </article>;
      })}
    </div>
    <div className="guide-shelf">
      <span>More in the field guide</span>
      <ul>
        {guideOnly.map(key => <li key={key}>
          <button className="guide-chip" onClick={() => openGuide(key)}>
            <ComponentIcon kind={key} size={16} /> {componentGuides[key].title}
          </button>
        </li>)}
      </ul>
    </div>
  </section>;
}
