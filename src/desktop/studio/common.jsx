import { state, svc, isoDay, fmtD, hh, inr, toast, render } from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import { Btn } from '../../ui/ui';
import { P, name } from '../helpers';
import { DLink, href } from '../nav';

export const SRC = {
  web: 'Web form',
  whatsapp: 'WhatsApp',
  phone: 'Phone',
  instagram: 'Instagram',
  facebook: 'Facebook',
  vapi: 'AI call',
};
export const PURPOSE = {
  office: 'Office meeting',
  site: 'Site visit',
  video: 'Video call',
};

export const hours = (from, to) => {
  const a = [];
  for (let h = from; h < to; h += 0.5) a.push(h);
  return a;
};
export const dateShift = (d, n) => {
  const x = new Date(d + 'T00:00:00');
  x.setDate(x.getDate() + n);
  return isoDay(x);
};

export const tabBase = (page) => href(`#/${page}`);

// Plain link styled like the prototype's inline links.
export const TextLink = ({ to, children }) => (
  <DLink to={to} className="font-medium text-accent-text underline">{children}</DLink>
);

export const SubText = ({ children, className = '' }) => <p className={`mb-2.5 mt-0 text-[13px] text-ink-3 ${className}`}>{children}</p>;
export const Muted = ({ children, className = '' }) => <small className={`text-ink-3 ${className}`}>{children}</small>;
export const H2 = ({ children, className = '' }) => <h2 className={`mb-2.5 mt-[18px] text-lg font-semibold leading-snug first:mt-0 ${className}`}>{children}</h2>;
export const Mono = ({ children }) => <span className="font-mono text-[13px]">{children}</span>;

// ---------- booking helpers ----------
export function SlotBtns({ c }) {
  if (!c.slots.length) return <p className="text-ink-3">No free slot in the next two weeks.</p>;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {c.slots.map((x, i) => (
        <Btn
          key={i}
          sm
          onClick={() => {
            Object.assign(state.desk.bookForm || (state.desk.bookForm = {}), {
              date: x.date,
              start: x.start,
              len: x.end - x.start,
            });
            state.desk.clash = null;
            render();
          }}
        >
          {fmtD(x.date)} {hh(x.start)}
        </Btn>
      ))}
    </div>
  );
}
export const ClashBox = ({ c }) =>
  c ? (
    <div className="mt-3 rounded-r2 bg-accent-soft p-3 text-accent-text">
      <b>{c.msg}</b>
      <br />
      <small className="text-ink-3">Next free:</small>
      <SlotBtns c={c} />
    </div>
  ) : null;

// Submit handler shared by the office and client booking forms (ACT.book).
export function submitBook(e) {
  e.preventDefault();
  const p = Object.fromEntries(new FormData(e.currentTarget));
  state.desk.bookForm = p;
  const b = {
    title: p.title,
    purpose: p.purpose,
    date: p.date,
    start: +p.start,
    end: +p.start + +(p.len || 1),
    attendees: [...new Set([state.userId, p.who].filter(Boolean))],
    clientId: p.clientId || undefined,
    projectId: p.projectId || undefined,
    repeat: p.repeat || undefined,
  };
  if (b.clientId && !b.attendees.includes(b.clientId)) b.attendees.push(b.clientId);
  const r = svc.book(b);
  if (r.conflict) {
    state.desk.clash = {
      msg: (r.at && r.at !== b.date ? fmtD(r.at) + ': ' : '') + r.conflict.msg,
      slots: svc.freeSlots(svc.prepBooking(b)),
    };
    render();
  } else {
    state.desk.clash = null;
    state.desk.bookForm = null;
    toast(r.pending ? 'Requested. The studio will confirm.' : 'Booked.');
    render();
  }
}

export const approvalRecords = () => {
  if (state.approvals) return state.approvals;
  const out = [];
  state.db.MESSAGES.filter((m) => m.approval && m.approval.done).forEach((m) => {
    const t = svc.thread(m.threadId);
    out.push({
      kind: 'Chat approval',
      project: t ? P(t.projectId).name : '—',
      approver: name(m.by),
      value: m.approval.label,
      at: m.at,
    });
  });
  state.db.CHANGES.filter((c) => c.signedAt).forEach((c) => {
    out.push({
      kind: 'Change order',
      project: P(c.projectId).name,
      approver: name(c.signedBy || c.by),
      value: `${c.no} · ${inr(c.cost)}`,
      at: c.signedAt,
    });
  });
  state.db.MATERIALS.filter((m) => m.status === 'approved').forEach((m) => {
    out.push({ kind: 'Material', project: P(m.projectId).name, approver: '—', value: m.name, at: '—' });
  });
  return out.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
};

export { TODAY };
