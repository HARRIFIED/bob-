import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronRight, CircleDot, LockKeyhole, Radio, Terminal, TriangleAlert } from 'lucide-react';
import { missionPreviews } from '../../scenarios';
import { useSimulator } from '../../store/simulator-store';
import { BobMessage, ComponentIcon, EstimateNote, Logo } from '../shared';

export function LandingExperience() {
  const { selectMission, startSandbox } = useSimulator();
  return <div className="landing-shell">
    <header className="site-header"><Logo /><span className="header-label"><span className="status-dot" /> SYSTEM DESIGN, HANDS ON</span><a href="#missions" className="text-link">Explore missions <ArrowUpRight size={15} /></a></header>
    <main id="main-content" className="landing-main">
      <section className="landing-hero">
        <div className="hero-copy"><div className="eyebrow"><Terminal size={15} /> YOUR SHIFT STARTS HERE</div><h1>Build it.<br />Break it.<br /><span>Understand it.</span></h1><p className="hero-description">Step into realistic production scenarios, inspect what is failing, redesign the architecture and see the consequences of your decisions.</p>
          <div className="hero-actions"><button className="button primary" onClick={() => selectMission('payday-surge')}>Start a Mission <ArrowRight size={17} /></button><button className="button secondary" onClick={startSandbox}>Sandbox Mode <ArrowRight size={17} /></button></div>
          <div className="hero-footnote"><Check size={14} /> Learn by doing <span>·</span> Runs in your browser <span>·</span> No cloud bill</div>
        </div>
        <div className="hero-console" aria-label="Preview of the Payday Surge incident">
          <div className="console-title"><span><span className="status-dot amber" /> SWIFTPAY / PRODUCTION</span><span className="mono">08:00:04</span></div>
          <div className="console-incident"><span className="incident-icon"><TriangleAlert size={21} /></span><div><span className="eyebrow">INCIDENT OPEN</span><h2>It’s payday. Something’s breaking.</h2></div><span className="severity">SEV 2</span></div>
          <div className="preview-architecture"><div className="preview-node"><ComponentIcon kind="users" size={23} /><span>Customers</span></div><div className="preview-wire"><span>12k req/s</span></div><div className="preview-node"><ComponentIcon kind="api-medium" size={23} /><span>API × 2</span></div><div className="preview-wire danger"><span>overloaded</span></div><div className="preview-node critical"><ComponentIcon kind="postgres" size={23} /><span>PostgreSQL</span><span className="preview-cpu">97% CPU</span></div></div>
          <div className="console-metrics"><div><span>p95 LATENCY</span><strong className="text-amber">827<small>ms</small></strong><span className="metric-mini-line">▁▁▂▂▃▄▅▆▆▇█</span></div><div><span>ERROR RATE</span><strong className="text-red">13.84<small>%</small></strong><span className="metric-mini-line red-line">▁▁▁▂▂▃▄▅▆▇█</span></div><div><span>TRAFFIC</span><strong>12,000<small>/s</small></strong><span className="text-muted">10× normal load <ArrowUpRight size={13} /></span></div></div>
          <div className="console-log"><span>08:00:03</span><b>ERROR</b> database connection timeout<span className="terminal-cursor" aria-hidden="true" /></div>
          <div className="console-bottom"><Radio size={13} /><span>One system. Real trade-offs. Your decisions.</span><span className="mono">SIMULATED</span></div>
        </div>
      </section>
      <section className="intro-strip"><BobMessage label="MEET YOUR MENTOR">“I’m Bob, your staff engineer. I’ll help you ask better questions. You’ll make the engineering decisions.”</BobMessage><div className="loop-steps"><span><b>01</b> Observe</span><ChevronRight size={16} /><span><b>02</b> Diagnose</span><ChevronRight size={16} /><span><b>03</b> Rebuild</span></div></section>
      <section id="missions" className="missions-section">
        <div className="section-heading"><div><div className="eyebrow">THE ON-CALL ROTATION</div><h2>Pick your first incident.</h2></div><span className="text-muted"><ArrowDown size={14} /> Start with the evidence.</span></div>
        <div className="mission-cards">{missionPreviews.map(m => (
          <button key={m.id} className={`mission-card ${m.available ? 'available' : ''}`} disabled={!m.available} onClick={() => selectMission(m.id)}>
            <div className="mission-card-top"><span className="mono">MISSION {m.number}</span>{m.available ? <span className="live-label"><CircleDot size={11} /> PLAYABLE</span> : <LockKeyhole size={14} />}</div>
            <span className="mission-company">{m.company}</span><h3>{m.title}</h3><p>{m.topic}</p>
            <div className="mission-card-bottom">{m.available ? <>Investigate incident <ArrowRight size={16} /></> : 'Coming soon'}</div>
          </button>
        ))}</div>
      </section>
    </main><footer className="landing-footer"><span>Bob the System Builder <span className="text-muted">/ Production is your classroom.</span></span><span>100% client-side · Scripted mentor · No AI API</span></footer><div className="estimate-note landing-estimate"><EstimateNote /></div>
  </div>;
}
