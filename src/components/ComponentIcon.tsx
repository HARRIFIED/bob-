import type { ComponentKind } from '../simulation/types';

const logos: Partial<Record<ComponentKind, string>> = {
  redis: 'redis-original.svg',
  postgres: 'postgresql-original.svg',
  'read-replica': 'postgresql-original.svg',
  kafka: 'apachekafka-original.svg',
  queue: 'rabbitmq-original.svg',
};

/** Branded services use local Devicon artwork; vendor-neutral components keep their own symbols. */
export function ComponentIcon({ kind, size = 22 }: { kind: ComponentKind; size?: number }) {
  const logo = logos[kind];
  if (logo) return <span className={`technology-icon technology-${kind}`} style={{ width: size, height: size }} aria-hidden="true"><img src={`${import.meta.env.BASE_URL}icons/${logo}`} width={size} height={size} alt="" draggable={false} />{kind === 'read-replica' && <span className="replica-mark">2</span>}</span>;
  return <svg className={`technology-icon technology-${kind}`} width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false" strokeLinejoin="round" strokeLinecap="round">
    {kind.startsWith('api') ? <>
      <rect x="4" y="3" width="24" height="26" rx="4" fill="#2d5465" stroke="#8ecddd" strokeWidth="1.5" />
      <rect x="7" y="7" width="18" height="7" rx="2" fill="#162f3d" /><rect x="7" y="18" width="18" height="7" rx="2" fill="#162f3d" />
      <circle className="server-led" cx="11" cy="10.5" r="1.7" fill="#d3edab" /><circle className="server-led" cx="11" cy="21.5" r="1.7" fill="#d3edab" />
      <path d="M17 10.5h5M17 21.5h5" stroke="#8ecddd" strokeWidth="1.5" />
    </> : kind === 'load-balancer' ? <>
      <path d="M6 16h9m0 0v-9h9m-9 9h9m-9 0v9h9" stroke="#b6a4e7" strokeWidth="2.5" />
      <rect x="2" y="12" width="8" height="8" rx="2" fill="#b6a4e7" /><rect x="23" y="3" width="7" height="7" rx="2" fill="#e5d9ff" /><rect x="23" y="12" width="7" height="7" rx="2" fill="#c7b5ef" /><rect x="23" y="21" width="7" height="7" rx="2" fill="#a995d8" />
    </> : kind === 'users' ? <>
      <circle cx="21" cy="10" r="5" fill="#efb777" /><path d="M13 28v-7a8 8 0 0 1 16 0v7" fill="#d3955d" />
      <circle cx="11" cy="11" r="5.5" fill="#d3edab" /><path d="M2 28v-7a9 9 0 0 1 18 0v7" fill="#93bc85" />
    </> : <>
      <rect x="3" y="9" width="23" height="19" rx="3" fill="#625037" stroke="#efb777" strokeWidth="1.5" /><path d="m5 11 10 8 9-7" stroke="#efb777" strokeWidth="2" /><path d="M19 5h10m-4-4 4 4-4 4" stroke="#d3edab" strokeWidth="2.5" />
    </>}
  </svg>;
}
