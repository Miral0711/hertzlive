import { useEffect, useState } from 'react';
import { state, svc, can, fmtDT, render, toast } from '../../shared/core.js';
import { Btn, Field, Input, Select, StatusPill, Textarea } from '../../ui/ui';
import Modal, { ModalActions } from '../Modal';
import { DLink } from '../nav';
import { closeDialog, openDialog } from '../session';
import { name } from '../helpers';
import { SRC, leaveClashes } from './common';
import { createHoliday, updateHoliday } from '../../api/leaveClient';
import { approveLeaveRequest, listLeaveRequests } from '../../api/leaveClient';
import { fmtD } from '../../shared/core.js';


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

// Approve an org leave request with an emergency stand-in: clash warnings, suggested replacements and task handover.
export function OrgLeaveApproveDialog({ d }) {
  const [state_, setReq] = useState(undefined);
  useEffect(() => { listLeaveRequests({}).then((rows) => setReq(rows.find((r) => r.id === d.id) || null)).catch(() => setReq(null)); }, [d.id]);
  if (state_ === undefined) return <Modal title="Approve leave"><p className="text-ink-3">Loading…</p></Modal>;
  const r = state_;
  if (!r) return <Modal title="Leave unavailable"><ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions></Modal>;
  const uid_ = r.employeeId;
  const from = r.startDate.slice(0, 10), to = r.endDate.slice(0, 10);
  const { visits, sites } = leaveClashes(uid_, from, to);
  const stand = svc.standIns(uid_);
  const tasks = state.db.TASKS.filter((t) => t.owner === uid_ && t.status === 'open' && t.due && t.due >= from && t.due <= to);
  const save = (e) => {
    e.preventDefault();
    const p = Object.fromEntries(new FormData(e.currentTarget));
    approveLeaveRequest(r.id)
      .then(() => {
        const moved = p.to ? svc.reassignTasks(uid_, p.to, from, to, p.note) : [];
        state.desk.leaveRev = (state.desk.leaveRev || 0) + 1;
        state.desk.dialog = null;
        toast(moved.length ? `Leave approved. ${moved.length} task${moved.length === 1 ? '' : 's'} moved to ${first_(p.to)}.` : 'Leave approved.');
        render();
      })
      .catch((err) => toast(err.message));
  };
  const first_ = (id) => name(id).split(' ')[0];
  return (
    <Modal wide title={`Approve leave · ${name(uid_)}`}>
      <p className="mt-0 text-ink-2">{r.leaveType?.name} · {fmtD(from)}{to !== from ? ` to ${fmtD(to)}` : ''} · {r.totalDays} day{r.totalDays === 1 ? '' : 's'}{r.reason ? ` · ${r.reason}` : ''}</p>
      {(visits.length > 0 || sites.length > 0) ? (
        <div className="mb-4 rounded-r2 bg-warn-soft px-3.5 py-3 text-warn">
          <b className="block">Clashes with site work</b>
          <ul className="m-0 mt-1 list-disc pl-5 text-[13px]">
            {visits.map((b) => <li key={b.id}>{fmtD(b.date)} · {b.title}</li>)}
            {sites.map((s) => <li key={s.id}>Site manager for {s.name}</li>)}
          </ul>
        </div>
      ) : <p className="mb-4 rounded-r2 bg-ok-soft px-3.5 py-3 text-ok">No site visits clash with these dates.</p>}
      <form onSubmit={save}>
        <fieldset className="mb-3 rounded-r2 border border-line px-3.5 py-3">
          <legend className="px-1 text-[13px] font-semibold text-ink-2">Emergency replacement</legend>
          <p className="mb-2 mt-0 text-[13px] text-ink-3">Suggested stand-ins share a skill, are in today and have the fewest open tasks. {tasks.length ? `${tasks.length} open task${tasks.length === 1 ? '' : 's'} fall due while ${first_(uid_)} is away.` : 'No open tasks fall due in these dates.'}</p>
          <label className="flex min-h-9 items-center gap-2"><input type="radio" name="to" value="" defaultChecked /> Don&apos;t reassign</label>
          {stand.map((x) => (
            <label key={x.u.id} className="flex min-h-9 items-center gap-2"><input type="radio" name="to" value={x.u.id} /> <b>{x.u.name}</b> <span className="text-ink-3">· {x.load} open · shares {x.overlap.join(', ')}</span></label>
          ))}
          {stand.length === 0 && <p className="m-0 text-ink-3">No qualified stand-in is in today.</p>}
        </fieldset>
        <Field label="Handover note"><Textarea name="note" rows={3} /></Field>
        <ModalActions>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn kind="primary" type="submit">Approve leave</Btn>
        </ModalActions>
      </form>
    </Modal>
  );
}

export function RecognitionDialog({ d }) {
  const people = svc.people().filter((p) => p.id !== state.userId);
  const projects = svc.projects();
  const save = (e) => {
    e.preventDefault();
    const p = Object.fromEntries(new FormData(e.currentTarget));
    try {
      svc.addRecognition({ userId: p.userId, message: p.message, projectId: p.projectId || null });
      state.desk.dialog = null;
      toast('Recognition saved.');
    } catch (err) { toast(err.message); }
    render();
  };
  return (
    <Modal title="Recognize someone">
      <form onSubmit={save}>
        <Field label="Person">
          <Select name="userId" defaultValue={d.userId || people[0]?.id}>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="What they did"><Textarea name="message" required placeholder="Great work on site coordination." /></Field>
        <Field label="Project, optional">
          <Select name="projectId" defaultValue="">
            <option value="">None</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <p className="text-[13px] text-ink-3">Recognition is a note. It does not add points by itself.</p>
        <ModalActions><Btn onClick={closeDialog}>Cancel</Btn><Btn kind="primary" type="submit">Save</Btn></ModalActions>
      </form>
    </Modal>
  );
}

export function GoalDialog({ d }) {
  const people = svc.people();
  const save = (e) => {
    e.preventDefault();
    const p = Object.fromEntries(new FormData(e.currentTarget));
    try {
      svc.addGoal({ name: p.name, description: p.description, scope: p.scope, userId: p.userId, metric: p.metric, target: p.target, periodId: d.periodId });
      state.desk.dialog = null;
      toast('Goal added.');
    } catch (err) { toast(err.message); }
    render();
  };
  return (
    <Modal title="Add a goal">
      <form onSubmit={save}>
        <Field label="Name"><Input name="name" required placeholder="Complete 90% of assigned tasks on time" /></Field>
        <Field label="Description"><Textarea name="description" /></Field>
        <Field label="Who">
          <Select name="scope" defaultValue="team">
            <option value="team">Whole team</option>
            <option value="individual">One person</option>
          </Select>
        </Field>
        <Field label="Person, if individual">
          <Select name="userId" defaultValue={people[0]?.id}>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Measured from">
          <Select name="metric" defaultValue="task_ontime_pct">
            <option value="task_ontime_pct">Tasks completed on time</option>
            <option value="issue_sla_pct">Issues closed within SLA</option>
          </Select>
        </Field>
        <Field label="Target, percent"><Input name="target" type="number" min="1" max="100" defaultValue="90" /></Field>
        <ModalActions><Btn onClick={closeDialog}>Cancel</Btn><Btn kind="primary" type="submit">Add goal</Btn></ModalActions>
      </form>
    </Modal>
  );
}
