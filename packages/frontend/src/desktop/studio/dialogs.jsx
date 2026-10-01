import { state, svc, can, fmtDT, render, toast } from '../../shared/core.js';
import { Btn, Field, Input, Select, StatusPill, Textarea } from '../../ui/ui';
import Modal, { ModalActions } from '../Modal';
import { DLink } from '../nav';
import { closeDialog, openDialog } from '../session';
import { name } from '../helpers';
import { SRC } from './common';
import { createHoliday, updateHoliday } from '../../api/leaveClient';


export function EnquiryDialog({ d }) {
  const e = state.db.ENQUIRIES.find((x) => x.id === d.id);
  if (!e) return null;
  const own = e.status === 'new' && (can('enquiry', 'a') || e.assignee === state.userId);
  const decide = (status) => {
    state.desk.dialog = null;
    const x = svc.decideEnquiry(e.id, status);
    toast(x.status === 'accepted' ? `${x.name} can now book a meeting.` : `Marked ${x.status.replace('_', ' ')}.`);
    render();
  };
  const wa = e.phone ? `https://wa.me/${e.phone.replace(/\D/g, '')}` : '';
  const facts = [
    ['Wants', svc.serviceType(e.typeId)], ['Came via', SRC[e.source] || e.source], ['City', e.city || '—'],
    ['Received', fmtDT(e.at)], ['Owner', e.assignee ? name(e.assignee) : 'Unassigned'], ['Email', e.email || '—'],
  ];
  const act = 'inline-flex min-h-9 items-center rounded-r1 border px-3.5 font-semibold no-underline';
  return (
    <Modal wide label={e.name} title={<span className="flex flex-wrap items-center gap-2">{e.name} <StatusPill status={e.status === 'new' ? 'pending' : e.status} /></span>}>
      <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0"><dt className="text-xs text-ink-3">{k}</dt><dd className="m-0 truncate font-medium">{v}</dd></div>
        ))}
      </dl>
      <p className="mb-1.5 mt-0 text-xs font-semibold uppercase tracking-[0.1em] text-accent-text">Their message</p>
      <p className="mb-4 mt-0 rounded-r2 border-l-4 border-accent bg-surface-2 px-3.5 py-2.5">{e.msg || 'No message left.'}</p>
      {e.note && <p className="mb-4 mt-0 text-[13px] text-ink-2"><b>Note:</b> {e.note}</p>}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {own && can('enquiry', 'a') && (
          <div className="min-w-[200px] flex-1">
            <Field label="Assign enquiry">
              <Select
                name="assignee"
                defaultValue={e.assignee}
                onChange={(ev) => { svc.decideEnquiry(e.id, 'new', ev.target.value); toast('Reassigned.'); render(); }}
              >
                {svc.people().filter((u) => u.role === 'partner').map((u) => <option key={u.id} value={u.id}>{name(u.id)}</option>)}
              </Select>
            </Field>
          </div>
        )}
        {wa && <a className={`${act} mb-2.5 border-line-2 bg-surface text-accent-text hover:border-accent hover:bg-accent-soft`} href={wa} target="_blank" rel="noopener noreferrer">WhatsApp {e.phone}</a>}
      </div>
      {e.status === 'accepted' && (
        <div className="mb-2 rounded-r2 bg-accent-soft px-3.5 py-3">
          <b className="block text-accent-text">Accepted</b>
          <span className="text-[13px] text-ink-2">Next: send a proposal and book a first meeting.</span>
        </div>
      )}
      <ModalActions>
        <Btn onClick={closeDialog}>Close</Btn>
        {own && (
          <>
            <Btn onClick={() => decide('rejected')}>Reject</Btn>
            <Btn onClick={() => decide('not_eligible')}>Not eligible</Btn>
            <Btn kind="primary" onClick={() => decide('accepted')}>Accept</Btn>
          </>
        )}
        {e.status === 'accepted' && (
          <>
            {e.proposalId
              ? <DLink className={`${act} border-line-2 bg-surface text-accent-text`} to="#/money?tab=proposals" onClick={closeDialog}>View proposal</DLink>
              : <Btn onClick={() => openDialog({ kind: 'proposal', enquiryId: e.id })}>Make proposal</Btn>}
            <DLink to={`#/schedule?tab=rooms&client=${e.clientId}`} onClick={closeDialog} className={`${act} border-accent bg-accent text-accent-ink`}>Book meeting</DLink>
          </>
        )}
      </ModalActions>
    </Modal>
  );
}

export function LeaveApproveDialog({ d }) {
  const l = state.db.LEAVES.find((x) => x.id === d.id);
  if (!l) {
    return (
      <Modal title="Leave unavailable"><ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions></Modal>
    );
  }
  const stand = svc.standIns(l.userId);
  const save = (e) => {
    e.preventDefault();
    const p = Object.fromEntries(new FormData(e.currentTarget));
    svc.decideLeave(l.id, true);
    if (p.to) svc.reassignForLeave(l.id, p.to, p.note);
    state.desk.dialog = null;
    toast('Leave approved.');
    render();
  };
  return (
    <Modal title={`Approve leave · ${name(l.userId)}`}>
      <form onSubmit={save}>
        <Field label="Reassign open tasks to">
          <Select name="to">
            <option value="">Don&apos;t reassign</option>
            {stand.map((x) => <option key={x.u.id} value={x.u.id}>{x.u.name} · {x.load} open</option>)}
          </Select>
        </Field>
        <Field label="Handover note"><Textarea name="note" rows={3} /></Field>
        <ModalActions>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn kind="primary" type="submit">Approve</Btn>
        </ModalActions>
      </form>
    </Modal>
  );
}

// Note: the Reviews dialog lives in desktop/resources/dialogs.jsx (`ReviewDialog`, wired as the
// 'review' kind in registry.js) — People.jsx opens it via openDialog({kind:'review',...}) same as
// any other module. A duplicate copy used to live here too; it was never wired to any registry
// entry, so it's been removed rather than kept as unreachable dead code.

// Org Holiday Management, backed by the mock ../../api/leaveClient.js (state.db.ORG_HOLIDAYS).
// `d.onSaved` is a plain callback the caller passes in (dialogs here aren't persisted to
// localStorage, so a function value in `d` is safe) - it's how the Schedule "Holidays" tab
// refetches its own list after this dialog saves, since that tab keeps its data in local
// component state, not directly rendered from `state.db`.
export function HolidayDialog({ d }) {
  const editing = Boolean(d.holiday);
  const save = (e) => {
    e.preventDefault();
    const p = Object.fromEntries(new FormData(e.currentTarget));
    const payload = { name: p.name, date: p.date, type: p.type, description: p.description || undefined };
    (editing ? updateHoliday(d.holiday.id, payload) : createHoliday(payload))
      .then(() => {
        closeDialog();
        toast(editing ? 'Holiday updated.' : 'Holiday added.');
        d.onSaved?.();
      })
      .catch((err) => { d.error = err.message; render(); });
  };
  return (
    <Modal title={editing ? 'Edit holiday' : 'Add holiday'}>
      <form onSubmit={save}>
        <Field label="Name"><Input name="name" defaultValue={d.holiday?.name} required /></Field>
        <Field label="Date"><Input type="date" name="date" defaultValue={d.holiday?.date?.slice(0, 10)} required /></Field>
        <Field label="Type">
          <Select name="type" defaultValue={d.holiday?.type || 'mandatory'}>
            <option value="mandatory">Mandatory</option>
            <option value="optional">Optional / floating</option>
          </Select>
        </Field>
        <Field label="Description"><Textarea name="description" defaultValue={d.holiday?.description || ''} rows={3} /></Field>
        {d.error && <p role="alert" className="text-crit">{d.error}</p>}
        <ModalActions>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn kind="primary" type="submit">{editing ? 'Save' : 'Add holiday'}</Btn>
        </ModalActions>
      </form>
    </Modal>
  );
}

export function ImportContactsDialog({ d }) {
  const rows = svc.phoneContacts();
  const save = (e) => {
    e.preventDefault();
    const picked = [...e.currentTarget.querySelectorAll('input[name="pick"]:checked')].map((c) => rows[+c.value]);
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
          <label key={i} className="mb-1.5 flex items-center gap-2.5 rounded-r2 border border-line px-3 py-2">
            <input type="checkbox" name="pick" value={i} />
            <span>{c.name} · {c.phone}{c.guess ? ` · looks like ${c.guess}` : ''}</span>
          </label>
        )) : <p className="rounded-r2 bg-surface-2 p-4 text-center text-ink-3">All simulated contacts are already imported.</p>}
        {d.error && <p role="alert" className="text-crit">{d.error}</p>}
        <ModalActions>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn kind="primary" type="submit">Import selected</Btn>
        </ModalActions>
      </form>
    </Modal>
  );
}
