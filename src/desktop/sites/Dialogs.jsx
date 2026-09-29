import { state, svc, can, fmtD, clone, uid, persist, toast, go, render } from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import { DAILYLOG, STAGE_TEMPLATE } from '../data';
import Modal, { ModalActions } from '../Modal';
import { Btn, Field, Input, Select, Textarea } from '../../ui/ui';
import { P, V, role } from '../helpers';
import { closeDialog, formData } from '../session';
import { deliveryFacts } from './Work';

const Cancel = () => <Btn onClick={closeDialog}>Cancel</Btn>;

export function LogDialog({ d }) {
  const save = (e) => {
    e.preventDefault();
    const p = formData(e.currentTarget);
    DAILYLOG.unshift({
      siteId: d.siteId, date: TODAY, weather: p.weather,
      labour: { Civil: +p.Civil, Electrical: +p.Electrical, Plumbing: +p.Plumbing },
      equipment: p.equipment.split(/,\s*/).filter(Boolean), delays: p.delays, by: state.userId,
    });
    state.desk.dialog = null;
    toast('Log saved.');
  };
  return (
    <Modal title="Today's site log">
      <form onSubmit={save}>
        <Field label="Weather"><Input name="weather" defaultValue="Clear, 33°C" /></Field>
        <div className="grid grid-cols-3 gap-2.5">
          <Field label="Civil"><Input name="Civil" type="number" defaultValue="14" /></Field>
          <Field label="Electrical"><Input name="Electrical" type="number" defaultValue="3" /></Field>
          <Field label="Plumbing"><Input name="Plumbing" type="number" defaultValue="0" /></Field>
        </div>
        <Field label="Equipment"><Input name="equipment" defaultValue="Mixer, Vibrator ×2" /></Field>
        <Field label="Delays"><Textarea name="delays" rows={2} defaultValue="None" /></Field>
        <ModalActions><Cancel /><Btn kind="primary" type="submit">Save log</Btn></ModalActions>
      </form>
    </Modal>
  );
}

// Chat drafts live in the chat module; this uses the same storage key so the draft shows up there.
function setChatDraft(thread, value) {
  try {
    const all = JSON.parse(localStorage.getItem('archos-desktop-drafts') || '{}');
    all[`${state.userId}:${thread}`] = value;
    localStorage.setItem('archos-desktop-drafts', JSON.stringify(all));
    return true;
  } catch (_) { return false; }
}
function chatDraft(thread) {
  try {
    const v = JSON.parse(localStorage.getItem('archos-desktop-drafts') || '{}')[`${state.userId}:${thread}`];
    return typeof v === 'string' ? v : '';
  } catch (_) { return ''; }
}

export function TemplateDialog({ d }) {
  const run = (e) => {
    e.preventDefault();
    const p = formData(e.currentTarget);
    state.desk.dialog = null;
    if (d.tkind === 'Project') {
      const base = clone(P('p1'));
      const id = uid();
      Object.assign(base, {
        id, code: `HA-24${10 + state.db.PROJECTS.length}`, name: p.name, clientId: null, siteId: null, phase: 0,
        teamIds: [state.userId], actual: 0, hue: 150, budgetVisible: false, decisions: [],
        milestones: base.milestones.map((m) => ({ ...m, done: false, date: `2026-1${1 + Math.floor(Math.random() * 2)}-15` })),
        drawings: base.drawings.map((x) => ({ ...x, rev: 'R0', status: 'Not started', date: TODAY })),
        budgetLines: base.budgetLines.map((l) => ({ ...l, actual: 0 })),
      });
      state.db.PROJECTS.push(base);
      persist();
      go(`#/projects/${id}`);
      toast('Project created from template.');
    } else if (d.tkind === 'Checklist') {
      state.desk.checklists.push({
        id: uid(), siteId: p.siteId, stage: p.name, due: '2026-09-30',
        items: Array.from({ length: 4 }, (_, i) => [`Check ${i + 1} from template`, false, null]),
      });
      persist();
      go(`#/sites/${p.siteId}?tab=checklists`);
      toast('Checklist added.');
    } else {
      const draft = d.name === 'Weekly client update'
        ? 'This week: slab 2 shuttering is 80% done. Decisions taken: handle-less shutters. We need from you: the living floor choice. Next visit: Saturday 10:30.'
        : `${d.name}: `;
      state.desk.thread ||= svc.threads()[0]?.id;
      if (!state.desk.thread) { toast('Open a conversation before applying a message template.'); return; }
      if (chatDraft(state.desk.thread)) { toast('Your existing draft is kept. Send or clear it before using a template.'); return; }
      setChatDraft(state.desk.thread, draft);
      state.desk.chatHidden = false;
      state.desk.chatList = false;
      render();
      toast('Template loaded into the message box.');
    }
  };
  return (
    <Modal title={`New from ${d.name}`}>
      <form onSubmit={run}>
        <Field label="Name"><Input name="name" defaultValue={d.tkind === 'Project' ? 'Mehta Bungalow' : d.name} required /></Field>
        {d.tkind === 'Project' && <Field label="Client"><Input name="client" defaultValue="Mehta family" /></Field>}
        {d.tkind === 'Checklist' && (
          <Field label="Site"><Select name="siteId">{state.db.SITES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        )}
        <ModalActions><Cancel /><Btn kind="primary" type="submit">Create</Btn></ModalActions>
      </form>
    </Modal>
  );
}
export const openNewProject = (openDialog) => openDialog({ kind: 'template', name: STAGE_TEMPLATE.name, tkind: 'Project' });

export function ImportContactsDialog({ d }) {
  const rows = svc.phoneContacts();
  const save = (e) => {
    e.preventDefault();
    const picked = new FormData(e.currentTarget).getAll('pick').map((i) => rows[+i]);
    try {
      svc.importContacts(picked);
      state.desk.dialog = null;
      toast(`${picked.length} contact${picked.length === 1 ? '' : 's'} imported.`);
    } catch (err) { d.error = err.message; }
    render();
  };
  return (
    <Modal title="Import from phone">
      <form onSubmit={save}>
        <p className="text-ink-3">Pick contacts individually. Numbers stay on the device until you confirm.</p>
        {rows.length ? rows.map((c, i) => (
          <label key={c.phone} className="mb-1.5 flex min-h-11 items-center gap-3 rounded-r2 border border-line bg-surface px-3.5 py-2.5">
            <input type="checkbox" name="pick" value={i} />
            <span>{c.name} · {c.phone}{c.guess ? ` · looks like ${c.guess}` : ''}</span>
          </label>
        )) : <p className="rounded-r2 bg-surface-2 p-4 text-center text-ink-3">All simulated contacts are already imported.</p>}
        {d.error && <p role="alert" className="text-crit">{d.error}</p>}
        <ModalActions><Cancel /><Btn kind="primary" type="submit">Import selected</Btn></ModalActions>
      </form>
    </Modal>
  );
}

// Opened from a short delivery: posts a follow-up into the site conversation.
export function RaiseVendorDialog({ d }) {
  const g = state.db.GRNS.find((x) => x.id === d.grnId && svc.site(x.siteId));
  const t = g && svc.threads().find((x) => x.kind === 'site' && x.siteId === g.siteId);
  if (!g || !t || !can('thread', 'w', role())) {
    return (
      <Modal title="Delivery unavailable">
        <p>This record or site conversation is no longer available.</p>
        <ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions>
      </Modal>
    );
  }
  const vendor = g.vendorId ? V(g.vendorId).name : null;
  const facts = deliveryFacts(g);
  const initial = d.text ?? `${vendor ? `Hi ${vendor}, ` : ''}${g.item} received on ${fmtD(g.date)}: ${g.qty} ${g.unit}.${facts.known ? ` Ordered: ${g.ordered} ${g.unit}. Outstanding: ${facts.remaining} ${g.unit}.` : ' The delivery is recorded as short; please confirm the ordered and remaining quantities.'} Please confirm when the balance can arrive.`;
  const send = (e) => {
    e.preventDefault();
    const text = String(formData(e.currentTarget).text || '').trim();
    d.text = text;
    try {
      const grn = state.db.GRNS.find((x) => x.id === g.id && svc.site(x.siteId));
      const th = grn && svc.threads().find((x) => x.kind === 'site' && x.siteId === grn.siteId);
      if (!grn || !th || !can('thread', 'w', role())) throw new Error('This site conversation is no longer available.');
      if (!text) throw new Error('Write a follow-up before sending.');
      if (!svc.addMessage(th.id, { text })) throw new Error(state.storageError || 'Could not send. Your draft is still here.');
      state.desk.dialog = null;
      toast('Sent to site thread.');
    } catch (error) {
      d.error = error.message;
      toast(error.message);
    }
  };
  return (
    <Modal title={`Follow up on ${g.item}`}>
      <form onSubmit={send}>
        <p className="text-ink-3">To: {t.name}. This posts to the site conversation, not directly to the supplier.</p>
        <Field label="Message"><Textarea name="text" rows={5} required defaultValue={initial} /></Field>
        {d.error && <p role="alert" className="text-crit">{d.error}</p>}
        <ModalActions><Cancel /><Btn kind="primary" type="submit">Send to site thread</Btn></ModalActions>
      </form>
    </Modal>
  );
}
