import { useEffect, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';

export type BobMood = 'idle' | 'curious' | 'working' | 'thinking' | 'worried' | 'celebrating';

interface BobAvatarProps {
  mood?: BobMood;
  size?: number;
  interactive?: boolean;
  still?: boolean;
  onInteract?: () => void;
}

/** Original, articulated vector character. No image service or runtime request needed. */
export function BobAvatar({ mood = 'idle', size = 112, interactive = true, still = false, onInteract }: BobAvatarProps) {
  const [waving, setWaving] = useState(false);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!waving) return;
    const timer = window.setTimeout(() => setWaving(false), 1600);
    return () => window.clearTimeout(timer);
  }, [waving]);
  const look = (event: PointerEvent<HTMLElement>) => {
    if (still || event.pointerType !== 'mouse') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setGaze({ x: (event.clientX - bounds.left) / bounds.width * 6 - 3, y: (event.clientY - bounds.top) / bounds.height * 4 - 2 });
  };
  const expression = waving ? 'celebrating' : mood;
  const faceHappy = expression === 'celebrating';
  const faceWorried = expression === 'worried';
  const character = <svg viewBox="0 0 180 190" fill="none" aria-hidden="true" focusable="false">
    <ellipse className="bob-shadow" cx="90" cy="179" rx="45" ry="7" fill="#080f11" opacity=".3" />
    <g className="bob-body">
      <g className="bob-legs" stroke="#172d32" strokeWidth="3" strokeLinejoin="round">
        <path d="M64 151v18H51q-7 0-7 8h35v-26" fill="#86b9a9" />
        <path d="M101 151v26h35q0-8-7-8h-13v-18" fill="#86b9a9" />
        <path d="M45 177h34m22 0h34" strokeWidth="5" strokeLinecap="round" />
      </g>
      <g className="bob-arm bob-arm-left" stroke="#172d32" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M58 119Q38 114 32 136" stroke="#86b9a9" strokeWidth="13" />
        <path d="M26 133q-9 6-4 14l8 4 8-8-4-10" fill="#cee6ca" />
        <path d="m27 141 4 2" />
      </g>
      <g className="bob-arm bob-arm-right" stroke="#172d32" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M122 119q23 4 26-17" stroke="#86b9a9" strokeWidth="13" />
        <path d="m143 104-7-8q-2-4 2-5l5 4-1-15q0-5 4-4l3 15 2-19q1-5 5-2l-1 21 5-14q3-5 6-1l-5 19q-1 12-12 13" fill="#cee6ca" />
      </g>
      <path d="M66 105h48l10 14-5 38q-29 10-58 0l-5-38z" fill="#74a897" stroke="#172d32" strokeWidth="3.5" />
      <path d="m66 109 5 31h38l5-31" stroke="#f8ca63" strokeWidth="9" />
      <rect x="70" y="132" width="40" height="25" rx="8" fill="#254149" stroke="#172d32" strokeWidth="3" />
      <path d="m78 141 5 4-5 4m12 0h10" stroke="#d3edab" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="69" cy="125" r="3" fill="#fff0ac" /><circle cx="111" cy="125" r="3" fill="#fff0ac" />
      <g className="bob-head">
        <rect x="32" y="63" width="14" height="24" rx="6" fill="#74a897" stroke="#172d32" strokeWidth="3" />
        <rect x="134" y="63" width="14" height="24" rx="6" fill="#74a897" stroke="#172d32" strokeWidth="3" />
        <rect x="41" y="42" width="98" height="72" rx="27" fill="#cce4c9" stroke="#172d32" strokeWidth="3.5" />
        <rect x="49" y="54" width="82" height="51" rx="21" fill="#233e44" />
        <path d="M56 66q4-8 12-8" stroke="#567479" strokeWidth="3" strokeLinecap="round" />
        <g className="bob-eyes">
          {faceHappy ? <g stroke="#f4f6da" strokeWidth="5" strokeLinecap="round"><path d="M62 78q7-12 14 0m28 0q7-12 14 0" /></g> : <>
            <ellipse cx="70" cy="77" rx="10" ry={faceWorried ? 12 : 13} fill="#f4f6da" />
            <ellipse cx="110" cy="77" rx="10" ry={faceWorried ? 12 : 13} fill="#f4f6da" />
            <g className="bob-pupils"><ellipse cx="72" cy="79" rx="4.5" ry="6.5" fill="#172d32" /><ellipse cx="108" cy="79" rx="4.5" ry="6.5" fill="#172d32" /><circle cx="73" cy="76" r="1.7" fill="white" /><circle cx="109" cy="76" r="1.7" fill="white" /></g>
          </>}
        </g>
        {faceWorried && <g stroke="#f4f6da" strokeWidth="3" strokeLinecap="round"><path d="m61 63 14-4m30 0 14 4" /></g>}
        <ellipse cx="59" cy="91" rx="5" ry="2.8" fill="#ee9990" opacity=".7" /><ellipse cx="121" cy="91" rx="5" ry="2.8" fill="#ee9990" opacity=".7" />
        {faceWorried ? <path d="M83 96q7-7 14 0" stroke="#f4f6da" strokeWidth="3" strokeLinecap="round" /> : faceHappy ? <path d="M79 90h22q-1 13-11 13T79 90" fill="#f4f6da" /> : expression === 'thinking' ? <path d="M87 95h10" stroke="#f4f6da" strokeWidth="3" strokeLinecap="round" /> : <path d="M82 92q8 9 16 0" stroke="#f4f6da" strokeWidth="3" strokeLinecap="round" />}
        <g className="bob-hat" stroke="#624a25" strokeWidth="3" strokeLinejoin="round">
          <path d="M49 46q0-32 41-33 41 1 41 33" fill="#f6c458" />
          <path d="M83 15V9q7-3 14 0v36H83z" fill="#ffda78" />
          <path d="M46 42h88q9 1 7 9-51 12-102 0-2-8 7-9Z" fill="#f6c458" />
          <path d="M60 34q3-11 12-14" stroke="#fff0b0" strokeWidth="4" strokeLinecap="round" />
          <path d="m89 23-4 7h8l-4 7" stroke="#624a25" strokeWidth="2.5" strokeLinecap="round" />
        </g>
        {faceWorried && <path className="bob-sweat" d="M143 48q-12 15 0 16 12-1 0-16" fill="#8acddd" />}
      </g>
    </g>
    {faceHappy && <g className="bob-sparkles" stroke="#f6c458" strokeWidth="3" strokeLinecap="round"><path d="M21 55v12m-6-6h12m128-37v10m-5-5h10M17 103l-4 4m143 36 5 5" /><path d="m25 25 3 6m116 103 5-3" stroke="#d3edab" /></g>}
  </svg>;
  const className = `bob-character bob-mood-${expression}${still ? ' bob-still' : ''}`;
  const style = { width: size, '--bob-look-x': `${gaze.x}px`, '--bob-look-y': `${gaze.y}px` } as CSSProperties;
  return interactive ? <button type="button" className={className} style={style} aria-label="High-five Bob" title="Go on. High-five your engineer." onPointerMove={look} onPointerLeave={() => setGaze({ x: 0, y: 0 })} onClick={() => { setWaving(true); onInteract?.(); }}>{character}</button> : <span className={className} style={style} role="img" aria-label={`Bob the robot engineer, ${expression}`}>{character}</span>;
}
