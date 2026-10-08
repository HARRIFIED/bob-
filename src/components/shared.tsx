import { Activity, Box } from 'lucide-react';
import type { Health } from '../simulation/types';
import type { ReactNode } from 'react';
import { BobAvatar } from './bob/BobAvatar';
import type { BobMood } from './bob/BobAvatar';

export { ComponentIcon } from './ComponentIcon';
export function Logo({ onClick }: { onClick?: () => void }) {
  return <button className="brand" onClick={onClick} aria-label="Bob the System Builder home"><span className="brand-mark"><Box size={22} strokeWidth={2.2} /></span><span>bob<span className="brand-slash">/</span><span className="brand-sub">system builder</span></span></button>;
}
export function HealthBadge({ health }: { health: Health | 'ready' }) {
  return <span className={`health-badge ${health}`}><span aria-hidden="true">{health === 'healthy' ? '✓' : health === 'critical' || health === 'failed' ? '!' : health === 'warning' ? '△' : '○'}</span>{health}</span>;
}
export function BobMessage({ children, label = 'A NOTE FROM YOUR STAFF ENGINEER', mood = 'curious' }: { children: ReactNode; label?: string; mood?: BobMood }) {
  return <div className="bob-message"><div className="bob-heading"><BobAvatar mood={mood} size={80} /><div><strong>Bob <span>Staff Engineer</span></strong><small>{label}</small></div></div><p>{children}</p><div className="bob-signature"><Activity size={12} /> Big ideas. Tiny hard hat. Here to help.</div></div>;
}
export function EstimateNote() { return <span>Simulation values and prices are simplified educational estimates inspired by cloud infrastructure. They are not production sizing recommendations.</span>; }
