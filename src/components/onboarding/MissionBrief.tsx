import { ArrowLeft, ArrowRight, Clock3, FileText, Radio, TrendingUp, TriangleAlert } from 'lucide-react';
import { useSimulator } from '../../store/simulator-store';
import { BobMessage, Logo } from '../shared';
import { monthlyCost, money } from '../../simulation/cost';
import { objectiveTarget } from '../../simulation/format';

export function MissionBrief() {
  const { navigate, scenario } = useSimulator();
  const { presentation, transfers } = scenario;
  return (
    <div className="brief-shell">
      <header className="site-header">
        <Logo onClick={() => navigate('entry')} />
        <span className="header-label">MISSION BRIEFING</span>
        <span className="mono text-muted">{scenario.number} / 04</span>
      </header>
      <main id="main-content" className="brief-main">
        <button className="text-link" onClick={() => navigate('entry')}><ArrowLeft size={15} /> All missions</button>
        <div className="brief-top">
          <div>
            <div className="eyebrow text-amber"><Radio size={14} /> {scenario.company.toUpperCase()} · ENGINEERING ON CALL</div>
            <h1>{scenario.title}<span>.</span></h1>
            <p>{presentation.subtitle}</p>
          </div>
          <div className="brief-stamp"><TriangleAlert size={26} /><strong>SEV 2</strong><span>ACTIVE INCIDENT</span></div>
        </div>
        <div className="brief-grid">
          <section className="brief-context panel">
            <div className="panel-title"><FileText size={16} /><h2>Incident report</h2><span className="mono">{scenario.incidentId}</span></div>
            <p>{scenario.description}</p>
            <div className="traffic-comparison">
              <div>
                <span>{transfers ? 'INTENDED TRANSFERS' : 'BUSINESS AS USUAL'}</span>
                <strong>{transfers ? transfers.intents.length : scenario.trafficProfile.normal.toLocaleString('en-US')} <small>{transfers ? 'intents' : 'req/s'}</small></strong>
              </div>
              <TrendingUp size={27} />
              <div>
                <span>{transfers ? 'WITH CLIENT RETRIES' : '08:00 · PAYDAY'}</span>
                <strong className="text-amber">{transfers ? transfers.attempts.length : scenario.trafficProfile.peak.toLocaleString('en-US')} <small>{transfers ? 'attempts' : 'req/s'}</small></strong>
              </div>
            </div>
            <div className="support-report">
              <span className="eyebrow">FROM THE SUPPORT CHANNEL</span>
              <blockquote>“{presentation.supportQuote}”</blockquote>
              <p>{presentation.symptoms}</p>
            </div>
            <div className="brief-infrastructure">
              <span className="eyebrow">WHAT YOU’RE INHERITING</span><p>{presentation.infrastructure}</p>
              <span>Estimated infrastructure cost <strong>{money(monthlyCost(scenario.initialArchitecture))} / month</strong></span>
            </div>
          </section>
          <section className="requirements panel">
            <div className="panel-title"><h2>Engineering requirements</h2><span className="mono">SLOs</span></div>
            <p>Restore service. Preserve correctness. Stay within budget.</p>
            <dl>{scenario.objectives.map(objective => (
              <div key={objective.id}><dt>{objective.label}</dt><dd>{objectiveTarget(objective)}</dd></div>
            ))}</dl>
            <div className="requirement-note">All {scenario.objectives.length} requirements must pass after the full {transfers ? 'retry sequence' : 'traffic ramp'}.</div>
          </section>
        </div>
        <BobMessage>{scenario.mentorRules.brief.text}</BobMessage>
        <div className="brief-footer">
          <span><Clock3 size={15} /> Learn at your pace. Every run is repeatable.</span>
          <button className="button primary" onClick={() => navigate('simulator')}>Open Production Simulator <ArrowRight size={17} /></button>
        </div>
      </main>
    </div>
  );
}
