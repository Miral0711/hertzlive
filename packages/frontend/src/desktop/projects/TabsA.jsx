import { state, svc, can, toast, persist, render, uid, fmtD, fmtDT, inr, parseRoute, award } from '../../shared/core.js';
import { TODAY, NAS_TREE } from '../../shared/data.js';
import { seedFilings } from '../../shared/filing.js';
import { Btn, Card, DataTable, Empty, Input, Select, List, Pill, StatusPill } from '../../ui/ui';
import Icon from '../../ui/Icon';
import { filedRows } from '../parts';
import { first, name } from '../helpers';
import { formData, openDialog } from '../session';
import {
  role, staff, FromChat, Sub, H2, Hdr, Muted, Details, FormRow, Ai,
} from './common';
import { FilesView } from './FilesView';

const extBtn = 'inline-flex min-h-9 items-center rounded-r1 border border-line-2 bg-surface px-3.5 font-semibold text-ink no-underline hover:bg-surface-2';
const rowCls = 'flex min-h-11 items-center gap-3 rounded-r2 border border-line bg-surface px-3.5 py-2.5';

// ---------- files ----------
export function FilesTab({ p }) {
  const entry = NAS_TREE.entries.find((e) => e.map === 'Project ' + p.id);
  if (!entry) return <Empty>No NAS folder mapped to this project yet.</Empty>;
  const scope = 'Projects/' + entry.p;
  const q = parseRoute().q.path;
  const gd = svc.connection('google');
  const nas = svc.connection('nas');
  return (
    <>
      {staff() && (gd || nas) && (
        <section className="mb-gap-lg flex flex-wrap items-center justify-between gap-gap rounded-r3 border border-line bg-surface p-card">
          <div className="min-w-[240px] flex-1">
            <h2 className="m-0 text-lg font-semibold">Archive and NAS</h2>
            <p className="mb-0 mt-1 text-[13px] text-ink-3">Working files live on the studio NAS. Older project folders stay on Google Drive.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {gd && p.driveFolder && <a className={extBtn} href={p.driveFolder} target="_blank" rel="noopener noreferrer">Open Drive archive</a>}
            {nas && <a className={extBtn} href={`${nas.url}/#/${scope}`} target="_blank" rel="noopener noreferrer">Open on NAS</a>}
          </div>
        </section>
      )}
      <FilesView base={`#/projects/${p.id}?tab=files`} path={q && q.startsWith(scope) ? q : scope} scope={scope} />
    </>
  );
}

// ---------- approvals ----------
function saField(id, k, value) {
  const a = state.db.STATUTORY.find((x) => x.id === id);
  a[k] = value || null;
  delete a.fromTemplate;
  persist();
  toast('Saved.');
  if (k === 'status' || k === 'followUp') render();
}
function saAdd(e, projectId) {
  e.preventDefault();
  const p = formData(e.currentTarget);
  e.currentTarget.reset();
  state.db.STATUTORY.push({
    id: 'sa' + Date.now(), projectId, name: p.name.trim(), authority: p.authority.trim(), ownerId: null, submitted: null, due: null, followUp: null, status: 'todo',
  });
  persist();
  render();
}
function saDel(id) {
  state.db.STATUTORY = state.db.STATUTORY.filter((x) => x.id !== id);
  persist();
  toast('Removed.');
  render();
}
export function ApprovalsTab({ p }) {
  // materialise template rows so edits stick
  svc.approvals(p.id).forEach((a) => {
    if (!state.db.STATUTORY.includes(a)) state.db.STATUTORY.push(a);
  });
  const rows = state.db.STATUTORY.filter((a) => a.projectId === p.id);
  const w = staff();
  const owners = state.db.USERS.filter((u) => u.role !== 'client' && u.role !== 'contractor');
  const dt = (a, k) => (w
    ? <Input type="date" defaultValue={a[k] || ''} key={a[k] || ''} aria-label={k} onChange={(e) => saField(a.id, k, e.target.value)} />
    : a[k] ? fmtD(a[k]) : '—');
  const fld = (label, node) => (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-ink-3">{label}<span className="text-[14px] font-normal text-ink">{node}</span></label>
  );
  const granted = rows.filter((a) => a.status === 'granted').length;
  return (
    <Card>
      <Hdr>
        <h2 className="m-0 text-lg font-semibold">Statutory approvals</h2>
        <span className="text-[13px] text-ink-3">{granted} of {rows.length} granted</span>
      </Hdr>
      <Sub>Checklist comes from the city template in Settings. Fill owner, dates and status here. Follow-up dates that have passed show on the partner's Today.</Sub>
      <div className="grid gap-3">
        {rows.map((a) => (
          <article key={a.id || a.name} className="rounded-r3 border border-line bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="m-0 text-[16px] font-semibold">
                {a.name}{a.fromTemplate && <small className="ml-2 font-normal text-ink-3">from checklist</small>}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {a.followUp && a.followUp <= TODAY && a.status !== 'granted' && <Pill kind="warn">follow up</Pill>}
                {!w && <StatusPill status={a.status} />}
                {w && <Btn sm onClick={() => saDel(a.id)}>Remove</Btn>}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {fld('Authority', w
                ? <Input defaultValue={a.authority || ''} key={a.authority || ''} placeholder="Who grants it" aria-label="Authority" onBlur={(e) => e.target.value !== (a.authority || '') && saField(a.id, 'authority', e.target.value)} />
                : a.authority || '—')}
              {fld('Owner', w
                ? (
                  <Select value={a.ownerId || ''} aria-label="Owner" onChange={(e) => saField(a.id, 'ownerId', e.target.value)}>
                    <option value="">—</option>
                    {owners.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </Select>
                )
                : a.ownerId ? name(a.ownerId) : '—')}
              {fld('Submitted', dt(a, 'submitted'))}
              {fld('Due', dt(a, 'due'))}
              {fld('Follow up', dt(a, 'followUp'))}
              {w && fld('Status', (
                <Select value={a.status} aria-label="Status" onChange={(e) => saField(a.id, 'status', e.target.value)}>
                  {['todo', 'submitted', 'granted', 'rejected'].map((x) => <option key={x}>{x}</option>)}
                </Select>
              ))}
            </div>
          </article>
        ))}
        {rows.length === 0 && <Empty>No approvals on the checklist yet.</Empty>}
      </div>
      {w && (
        <div className="mt-4 rounded-r2 bg-surface-2 p-3.5">
          <p className="mb-2 mt-0 text-xs font-semibold uppercase tracking-[0.1em] text-accent-text">Add an approval</p>
          <FormRow onSubmit={(e) => saAdd(e, p.id)}>
            <Input name="name" placeholder="Another approval, e.g. Lift licence" required aria-label="Approval name" className="min-w-[220px] flex-1" />
            <Input name="authority" placeholder="Authority" aria-label="Authority" className="min-w-[180px] flex-1" />
            <Btn type="submit" kind="primary">Add</Btn>
          </FormRow>
        </div>
      )}
    </Card>
  );
}

// ---------- intake ----------
export function IntakeTab({ p }) {
  const rows = svc.intake(p.id);
  const label = { received: 'Received', requested: 'Requested', missing: 'Missing' };
  return (
    <Card>
      <Hdr>
        <h2 className="m-0 text-lg font-semibold">Intake checklist</h2>
        {staff() && <Btn sm onClick={() => openDialog({ kind: 'intake-add', projectId: p.id })}>Add item</Btn>}
      </Hdr>
      <Sub>What the studio needs from the client to start and keep moving.</Sub>
      <List empty="No intake items yet.">
        {rows.map((r) => (
          <div key={r.id} className={rowCls}>
            <b>{r.item}</b> <StatusPill status={label[r.status] || r.status} />
            {r.at && <small className="text-ink-3">{fmtD(r.at)}</small>}
            <div className="ml-auto flex flex-wrap gap-2">
              {r.status !== 'received' && (
                <>
                  {staff() && <Btn sm onClick={() => { svc.askIntake(r.id); toast('Asked client.'); render(); }}>Ask client</Btn>}
                  <Btn sm onClick={() => openDialog({ kind: 'intake-upload', id: r.id })}>{staff() ? 'Mark received' : 'Upload'}</Btn>
                </>
              )}
            </div>
          </div>
        ))}
      </List>
    </Card>
  );
}

// ---------- references ----------
export function ReferencesTab({ p }) {
  const rows = svc.clientRefs(p.id);
  return (
    <Card>
      <Hdr>
        <h2 className="m-0 text-lg font-semibold">References</h2>
        {can('ref', 'w') && <Btn sm onClick={() => openDialog({ kind: 'client-ref-add', projectId: p.id })}>Add link</Btn>}
      </Hdr>
      <Sub>Pinterest, Instagram and web links the client has shared. Separate from the studio moodboard.</Sub>
      {rows.length ? (
        <div className="grid gap-gap [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {rows.map((r) => (
            <article key={r.id} className="flex flex-col rounded-r3 border border-line bg-surface p-card transition hover:border-accent hover:shadow-s1">
              <a className="font-semibold leading-snug text-accent-text underline-offset-2 [overflow-wrap:anywhere] hover:underline" href={r.url} target="_blank" rel="noopener noreferrer">{r.title || r.url}</a>
              <p className="m-0 mt-1.5 text-[13px] text-ink-3">{r.room || ''} · {r.src || 'Web'}</p>
              {staff() && (
                <div className="mt-auto pt-3">
                  <Btn sm onClick={() => { svc.promoteRef(r.id); toast('Added to moodboard.'); render(); }}>Promote to moodboard</Btn>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : <Empty>No references shared yet.</Empty>}
    </Card>
  );
}

// ---------- tasks ----------
function addTask(e, projectId) {
  e.preventDefault();
  const p = formData(e.currentTarget);
  e.currentTarget.reset();
  state.db.TASKS.push({ id: uid(), projectId, title: p.title, owner: state.userId, due: p.due, status: 'open' });
  persist();
  toast('Task added.');
}
function taskDone(id) {
  const t = state.db.TASKS.find((x) => x.id === id);
  t.status = 'done';
  award(state.userId, 5, 'Task closed');
  persist();
  toast('Done.');
}
function TaskLine({ t }) {
  return (
    <div className="flex items-center gap-4 border-b border-line py-5 last:border-b-0 max-[450px]:flex-wrap">
      <span className={`grid h-9 w-9 flex-none place-items-center rounded-lg ${t.critical ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-ink-2'}`}>
        <Icon name={t.status === 'done' ? 'check' : 'clock'} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="m-0 text-[17px] font-semibold [overflow-wrap:anywhere]">{t.title}</h3>
        <p className="mb-0 mt-1.5 text-sm text-ink-2">
          {name(t.owner)} · {t.due ? `Due ${fmtD(t.due)}` : 'Due date not set'}{t.critical ? ' · Critical' : ''}
        </p>
      </div>
      {t.status === 'open' && can('task', 'w')
        ? <Btn sm onClick={() => taskDone(t.id)}>Mark done</Btn>
        : <StatusPill status={t.status} />}
    </div>
  );
}
export function TasksTab({ p }) {
  const tasks = state.db.TASKS.filter((t) => t.projectId === p.id);
  const open = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');
  return (
    <Card>
      <Hdr><h2 className="m-0 text-lg font-semibold">Tasks <Muted>{open.length} open</Muted></h2></Hdr>
      {can('task', 'w') && (
        <details className="group mb-4">
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 py-2 font-semibold text-accent-text hover:underline [&::-webkit-details-marker]:hidden"><svg viewBox="0 0 24 24" className="h-4 w-4 flex-none transition group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>Add a task</summary>
          <form className="flex flex-wrap items-end gap-2.5 rounded-lg border border-line bg-surface p-3" onSubmit={(e) => addTask(e, p.id)}>
            <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">Task title<Input name="title" placeholder="What needs doing?" required /></label>
            <label className="flex flex-col gap-1.5">Due date<Input type="date" name="due" defaultValue={TODAY} aria-label="Due" /></label>
            <Btn type="submit">Add</Btn>
          </form>
        </details>
      )}
      <div>
        {open.map((t) => <TaskLine key={t.id} t={t} />)}
        {!open.length && <Empty>No open tasks. Completed work stays below.</Empty>}
      </div>
      {done.length > 0 && <Details summary={`Completed tasks · ${done.length}`}>{done.map((t) => <TaskLine key={t.id} t={t} />)}</Details>}
      <Details summary="Full task register">
        <DataTable
          cols={['Task', 'Owner', 'Due', 'Critical', 'Status']}
          rows={tasks.map((t) => [t.title, name(t.owner), t.due ? fmtD(t.due) : 'Not set', t.critical ? 'Yes' : 'No', <StatusPill status={t.status} />])}
        />
      </Details>
    </Card>
  );
}

// ---------- changes & RFIs ----------
function coApprove(id) {
  const c = state.db.CHANGES.find((x) => x.id === id);
  c.status = 'approved';
  c.signedAt = new Date().toISOString().slice(0, 16);
  state.db.SIGNATURES.push({ id: uid(), kind: 'change', refId: c.id, by: state.userId, at: c.signedAt, phone: '4412' });
  svc.log('Change order approved · ' + c.no, 'Change ' + c.id);
  persist();
  toast('Approved and signed.');
}
function coSend(id) {
  const c = state.db.CHANGES.find((x) => x.id === id);
  c.status = 'awaiting_client';
  svc.log('Change order sent to client · ' + c.no, 'Change ' + c.id);
  persist();
  toast('Sent to client.');
}
function rfiAnswer(e, id) {
  e.preventDefault();
  const r = state.db.RFIS.find((x) => x.id === id);
  r.answer = formData(e.currentTarget).a;
  r.status = 'answered';
  r.by = state.userId;
  persist();
  toast('Answered. Site has been told.');
}
export function ChangesTab({ p }) {
  const cos = state.db.CHANGES.filter((c) => c.projectId === p.id && (staff() || c.status !== 'draft'));
  const rfis = state.db.RFIS.filter((r) => r.projectId === p.id);
  return (
    <>
      <Card title="Change orders" className="mb-3.5">
        <DataTable
          cols={['No', 'Change', '₹Cost', 'Days', 'Status', '']}
          rows={cos.map((c) => [
            c.no,
            <>{c.title}<br /><small className="text-ink-3">{c.reason}</small></>,
            inr(c.cost),
            c.days,
            <StatusPill status={c.status} />,
            c.status === 'awaiting_client' && role() === 'client'
              ? <Btn sm kind="primary" onClick={() => coApprove(c.id)}>Approve and sign</Btn>
              : c.status === 'draft' && can('project', 'w')
                ? <Btn sm onClick={() => coSend(c.id)}>Send to client</Btn>
                : c.signedAt ? <small className="text-ink-3">Signed {fmtD(c.signedAt)}</small> : '',
          ])}
        />
      </Card>
      {staff() && (
        <Card title="Requests for information">
          <DataTable
            cols={['No', 'Question', 'From', 'Due', 'Status', 'Answer']}
            rows={rfis.map((r) => [
              r.no, r.title, first(r.from), fmtD(r.due), <StatusPill status={r.status} />,
              r.answer
                ? r.answer
                : can('drawing', 'w')
                  ? (
                    <form className="flex items-center gap-2.5" onSubmit={(e) => rfiAnswer(e, r.id)}>
                      <Input name="a" placeholder="Type the answer" required aria-label="Answer" />
                      <Btn sm type="submit">Answer</Btn>
                    </form>
                  )
                  : '',
            ])}
          />
        </Card>
      )}
    </>
  );
}

// ---------- meetings ----------
function mtApprove(id) {
  const m = state.db.MEETINGS.find((x) => x.id === id);
  m.approved = true;
  m.approvedAt = new Date().toISOString().slice(0, 16);
  const t = state.db.THREADS.find((x) => x.kind === 'client' && x.projectId === m.projectId);
  if (t) svc.addMessage(t.id, { text: m.summary });
  seedFilings();
  toast('Summary sent to client chat.');
}
export function MeetingsTab({ p }) {
  const ms = state.db.MEETINGS.filter((m) => m.projectId === p.id && (staff() || !m.internal));
  if (!ms.length) return <Empty>No meetings yet.</Empty>;
  return ms.map((m) => (
    <Card key={m.id} className="mb-3.5">
      <Hdr>
        <h2 className="m-0 text-lg font-semibold">{m.title}</h2>
        <span className="text-ink-3">{fmtDT(m.at)} · {m.attendees.map(first).join(', ')}</span>
      </Hdr>
      {staff() && <p className="mb-3 mt-0 text-ink-2">{m.notes}</p>}
      {m.summary && <div className="mb-3"><Ai><b>Summary for client</b>{'\n'}{m.summary}</Ai></div>}
      <DataTable
        cols={['Action', 'Owner', 'Due', 'Done']}
        rows={m.actions.map((a) => [a.text, first(a.owner), fmtD(a.due), <StatusPill status={a.done ? 'done' : 'open'} />])}
      />
      <div className="mt-2.5">
        {m.kind === 'client' && !m.approved && staff() && can('project', 'w')
          ? <Btn sm onClick={() => mtApprove(m.id)}>Send summary to client</Btn>
          : m.approved ? <small className="text-ink-3">Shared with client {m.approvedAt ? fmtD(m.approvedAt) : ''}</small> : null}
      </div>
    </Card>
  ));
}

// ---------- documents ----------
function docSign(id) {
  const d = state.db.DOCS.find((x) => x.id === id);
  d.signed = new Date().toISOString().slice(0, 16);
  persist();
  toast('Signed.');
}
export function DocsTab({ p }) {
  const docs = state.db.DOCS.filter((d) => d.projectId === p.id && (staff() || d.clientVisible));
  const receipts = filedRows({ projectId: p.id, kind: 'receipt' });
  const stat = (label, value) => (
    <div className="rounded-r3 border border-line bg-surface px-4 py-3">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="text-stat font-semibold leading-tight tracking-tight text-accent-text">{value}</div>
    </div>
  );
  return (
    <>
    <div className="mb-gap-lg grid grid-cols-2 gap-gap lg:grid-cols-4">
      {stat('Documents', docs.length)}
      {stat('Signed', docs.filter((d) => d.signed).length)}
      {stat('Awaiting signature', docs.filter((d) => d.kind === 'Agreement' && !d.signed).length)}
      {staff() && stat('Shared with client', docs.filter((d) => d.clientVisible).length)}
    </div>
    <Card title="Documents">
      <DataTable
        cols={['Document', 'Kind', 'Date', 'By', 'Signed', ...(staff() ? ['Client sees'] : [])]}
        rows={docs.map((d) => [
          d.name, d.kind, fmtD(d.at), first(d.by),
          d.signed
            ? <StatusPill status="signed" />
            : d.kind === 'Agreement' && role() === 'client'
              ? <Btn sm kind="primary" onClick={() => docSign(d.id)}>Sign</Btn>
              : '—',
          ...(staff() ? [d.clientVisible ? 'Yes' : 'No'] : []),
        ])}
      />
      {staff() && (
        <>
          <H2>Bills and receipts from chat</H2>
          <DataTable cols={['Who', 'Message', '']} rows={receipts.map((x) => [first(x.m.by), x.m.text, <FromChat msgId={x.m.id} />])} />
        </>
      )}
    </Card>
    </>
  );
}
