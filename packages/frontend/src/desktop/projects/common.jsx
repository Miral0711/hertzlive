import { state, svc, can, inr, user } from '../../shared/core.js';
import { Photo } from '../../ui/Ph.jsx';
import { Pill, Btn } from '../../ui/ui';
import { role, staff, name } from '../helpers';
import { openMsg } from '../session';

export { role, staff, name, user };

// "From chat" link that jumps to the source message.
export const FromChat = ({ msgId }) => <Btn kind="link" onClick={() => openMsg(msgId)}>From chat</Btn>;

// Photo slot (real bundled photo, canvas fallback) — see ui/Ph.jsx.
export function Ph({ hue, seed, ar = 1.333, className = '' }) {
  return (
    <div className={`overflow-hidden ${className}`} style={{ aspectRatio: `${ar} / 1` }}>
      <Photo hue={hue} seed={seed} ar={ar} />
    </div>
  );
}

export const Photos = ({ children }) => (
  <div className="mt-3 grid items-start gap-gap [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">{children}</div>
);
export const Figure = ({ children, caption }) => (
  <figure className="m-0 overflow-hidden rounded-r3 border border-line bg-surface transition hover:border-accent">
    {children}
    <figcaption className="px-3 py-2.5 text-[13px] leading-snug">{caption}</figcaption>
  </figure>
);

export const Sub = ({ children }) => <p className="mb-3 mt-0 max-w-[75ch] text-[13px] leading-relaxed text-ink-3">{children}</p>;
export const H2 = ({ children }) => <h2 className="mb-2.5 mt-4 text-lg font-semibold leading-snug first:mt-0">{children}</h2>;
export const H3 = ({ children }) => <h3 className="mb-2 mt-3 text-base font-semibold">{children}</h3>;
export const Hdr = ({ children }) => <div className="mb-3 flex flex-wrap items-center justify-between gap-3">{children}</div>;
export const Muted = ({ children, className = '' }) => <span className={`text-ink-3 ${className}`}>{children}</span>;
export const Mono = ({ children }) => <span className="font-mono text-[13px]">{children}</span>;
export const Small = ({ children, className = '' }) => <small className={`block text-ink-3 ${className}`}>{children}</small>;
export const Details = ({ summary, children, className = '' }) => (
  <details className={`group my-5 ${className}`}>
    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-r1 py-2.5 font-semibold text-ink-2 hover:text-accent-text [&::-webkit-details-marker]:hidden">
      <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-ink-3 transition group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
      {summary}
    </summary>
    <div className="mt-2.5">{children}</div>
  </details>
);
export const FormRow = ({ children, ...p }) => <form className="mt-2.5 flex flex-wrap items-center gap-2.5" {...p}>{children}</form>;
export const Ai = ({ children }) => <div className="whitespace-pre-wrap rounded-r2 bg-accent-soft px-3.5 py-3">{children}</div>;
export const TextLink = ({ children, ...p }) => <button type="button" className="font-medium text-accent-text underline" {...p}>{children}</button>;

// ---------- project helpers ----------
export function projectMilestones(p) {
  return (p.milestones || [])
    .filter((m) => staff() || m.clientVisible)
    .slice()
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
}

export function ProjectOwner({ p }) {
  if (p.ownerId) return <b className="font-medium">{name(p.ownerId)}</b>;
  const partners = (p.teamIds || []).filter((id) => user(id).role === 'partner');
  return partners.length ? (
    <>
      <b className="font-medium">{partners.map((id) => name(id)).join(', ')}</b>
      <small className="block text-ink-3">Project partner{partners.length > 1 ? 's' : ''}</small>
    </>
  ) : <span className="text-ink-3">Not assigned</span>;
}

export function ProjectBudgetStatus({ p }) {
  if (!can('budget', 'r', role())) return null;
  if (!Number.isFinite(p.budget) || p.budget <= 0) return <Pill>Budget not set</Pill>;
  if (!Number.isFinite(p.actual)) return <Pill>Spend not recorded</Pill>;
  if (p.actual > p.budget) return <Pill kind="crit">Over budget by {inr(p.actual - p.budget)}</Pill>;
  return <Pill>{p.actual === p.budget ? 'At budget' : 'Within budget'}</Pill>;
}

export const openIssues = (projectId) => svc.issues({ projectId }).filter((i) => i.status !== 'closed');

// Personal drawing shortcuts (localStorage only; never caches original drawings).
export function desktopDrawingShortcuts(projectId, kind) {
  const p = svc.project(projectId);
  if (!p || !can('drawing', 'r', role())) return [];
  try {
    const data = JSON.parse(localStorage.getItem(`archos-desktop-drawings:${state.userId}:${role()}`) || '{}');
    return (Array.isArray(data[kind]) ? data[kind] : [])
      .filter((x) => x && x.projectId === projectId && typeof x.no === 'string' && typeof x.rev === 'string')
      .flatMap((x) => {
        const d = p.drawings.find((d) => d.no === x.no);
        return d ? [{ ...x, d }] : [];
      });
  } catch (_) {
    return [];
  }
}
