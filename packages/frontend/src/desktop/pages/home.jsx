// Feature module: home (tasks, dashboard, today). Exports page components and dialogs (see registry.js).
import { useState } from 'react';
import { state, svc, can, fmtD, fmtDT, go, toast, render, persist, me } from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import {
  Btn, Card, List, Item, ItemBody, Pill, PageHeader, DataTable, Field, Input, Select, Textarea,
} from '../../ui/ui';
import Icon from '../../ui/Icon';
import { P, name, first, role } from '../helpers';
import Modal, { ModalActions } from '../Modal';
import { closeDialog, formData } from '../session';
import Dashboard from '../home/Dashboard';
import { ANNOUNCEMENTS } from '../data';
import { ProjectUpdates, SiteReviewQueue } from '../chat/assist';
import {
  PartnerHome, DesignerHome, SiteManagerHome, HrHome, ClientHome, ContractorHome, needsYou,
} from '../home/homes';
import {
  TodayBanner, TodayBriefing, TodayPriorities, WaitingOnOthers, DecisionsWaiting,
  SiteActivityToday, PaymentFollowUps, RecentUpdates, ScheduleCard, TasksCard,
} from '../home/YourDay';

// ---------- All tasks: "what needs doing, who's responsible, when it's due" ----------
// `status` stays the simple open/done flag every other page already reads (Dashboard, Today,
// projects/TabsA.jsx, projects/Overview.jsx, svc.load()) — never touched here except the one
// place it has to flip (stage -> 'done'). `stage`/`priority` are the richer, additive fields
// (shared/data.js) this page reads/writes; everything else keeps working exactly as before.
// Deliberately small surface: one filter row, one list, one simple detail view — see the
// "More filters"/"More details" disclosures for the few things that don't need to be up front.
const STAGES = [['todo', 'To do'], ['in_progress', 'In progress'], ['waiting', 'Waiting'], ['review', 'Review'], ['done', 'Done']];
const STAGE_TONE = { todo: '', in_progress: 'soft', waiting: 'warn', review: 'warn', done: 'ok' };
const PRIORITIES = [['critical', 'Critical'], ['high', 'High'], ['normal', 'Normal'], ['low', 'Low']];
const stageOf = (t) => t.stage || (t.status === 'done' ? 'done' : 'todo');
const priorityOf = (t) => t.priority || (t.critical ? 'critical' : 'normal');
const dueBucket = (t) => {
  if (!t.due) return 'none';
  if (t.due < TODAY) return 'overdue';
  if (t.due === TODAY) return 'today';
  if (t.due <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)) return 'week';
  return 'later';
};
const StagePill = ({ stage }) => <Pill kind={STAGE_TONE[stage]}>{STAGES.find(([k]) => k === stage)?.[1] || stage}</Pill>;
// Today/Overdue read faster than a date at a glance; anything further out stays the normal date.
const DueText = ({ t }) => {
  if (!t.due) return <span className="text-ink-3">Not set</span>;
  const b = dueBucket(t);
  if (b === 'overdue') return <span className="font-semibold text-crit">Overdue</span>;
  if (b === 'today') return <span className="font-semibold text-accent-text">Today</span>;
  return <span>{fmtD(t.due)}</span>;
};

// Same convention as the task-completion write already in projects/TabsA.jsx (taskDone): find the
// record on state.db.TASKS, mutate it directly, persist(), toast(). Not routed through svc.* only
// because none of this page's siblings route page-local writes through svc.* either.
function setTaskStage(id, stage) {
  if (!can('task', 'w')) return;
  const t = state.db.TASKS.find((x) => x.id === id);
  if (!t) return;
  t.stage = stage;
  t.status = stage === 'done' ? 'done' : 'open';
  toast(stage === 'done' ? 'Task marked complete.' : `Moved to ${STAGES.find(([k]) => k === stage)[1]}.`);
  persist();
}
function reassignTask(id, owner) {
  if (!can('task', 'w')) return;
  const t = state.db.TASKS.find((x) => x.id === id);
  if (!t) return;
  t.owner = owner;
  toast('Reassigned.');
  persist();
}
function setTaskPriority(id, priority) {
  if (!can('task', 'w')) return;
  const t = state.db.TASKS.find((x) => x.id === id);
  if (!t) return;
  t.priority = priority;
  t.critical = priority === 'critical';
  toast('Priority updated.');
  persist();
}
function toggleChecklistItem(taskId, itemId) {
  if (!can('task', 'w')) return;
  const t = state.db.TASKS.find((x) => x.id === taskId);
  const item = t?.checklist?.find((c) => c.id === itemId);
  if (!item) return;
  item.done = !item.done;
  persist();
  render();
}
function updateTaskFields(id, patch) {
  if (!can('task', 'w')) return;
  const t = state.db.TASKS.find((x) => x.id === id);
  if (!t) return;
  Object.assign(t, patch);
  toast('Task updated.');
  persist();
}
function openAddTask(projectId) {
  state.desk.dialog = { kind: 'add-task-all', projectId: projectId || '' };
  render();
}
function openTaskDetail(id) {
  state.desk.dialog = { kind: 'task-detail', id };
  render();
}

function Tasks({ q }) {
  const [search, setSearch] = useState('');
  const people = svc.people();
  const projects = svc.projects();

  // svc.tasks({all:true}) so a task doesn't disappear the instant it's marked done — it just
  // drops out of the default (open-only) view below, same as it always visually "went away"
  // before Done existed as a concept here.
  const openOnly = svc.tasks();
  let rows = svc.tasks({ all: true });
  if (q.person) rows = rows.filter((t) => (q.person === '__unassigned__' ? !t.owner : t.owner === q.person));
  if (q.project) rows = rows.filter((t) => t.projectId === q.project);
  if (q.due) rows = rows.filter((t) => dueBucket(t) === q.due);
  if (q.stage) rows = rows.filter((t) => stageOf(t) === q.stage);
  if (q.priority) rows = rows.filter((t) => priorityOf(t) === q.priority);
  if (q.critical) rows = rows.filter((t) => t.critical);
  if (q.overdue) rows = rows.filter((t) => dueBucket(t) === 'overdue');
  if (q.unassigned) rows = rows.filter((t) => !t.owner);
  if (q.week) {
    const end = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    rows = rows.filter((t) => t.due && t.due <= end);
  }
  // Done stays out of the default view (that's still "what needs doing") unless asked for.
  if (q.stage !== 'done') rows = rows.filter((t) => stageOf(t) !== 'done');
  if (search.trim()) {
    const needle = search.trim().toLowerCase();
    rows = rows.filter((t) => t.title.toLowerCase().includes(needle) || (P(t.projectId)?.name || '').toLowerCase().includes(needle));
  }

  const summary = `${openOnly.length} open · ${openOnly.filter((t) => t.critical).length} critical · ${openOnly.filter((t) => dueBucket(t) === 'today').length} due today`;

  // Filters apply the moment they change — no Apply button on the primary row. Each handler
  // merges one change into the current query string and navigates, same go()/hash-query
  // mechanism the page always used, just triggered on change instead of on submit.
  const FILTER_KEYS = ['person', 'project', 'due', 'stage', 'priority', 'week', 'critical', 'overdue', 'unassigned'];
  const setFilter = (patch) => {
    const merged = { ...q, ...patch };
    const sp = new URLSearchParams();
    FILTER_KEYS.forEach((k) => { if (merged[k]) sp.set(k, merged[k]); });
    go(`#/tasks${sp.toString() ? `?${sp.toString()}` : ''}`);
  };

  const byPerson = {};
  rows.forEach((t) => { (byPerson[t.owner] ||= []).push(t); });
  const owners = Object.keys(byPerson);
  const moreFiltersActive = q.stage || q.priority || q.critical || q.week || q.overdue || q.unassigned;
  const resetFilters = () => { setSearch(''); go('#/tasks'); };

  return (
    <>
      <PageHeader title="All tasks" sub={summary}>
        <Btn kind="primary" onClick={() => openAddTask('')}>Add task</Btn>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[13px] font-semibold text-ink-2">Search
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks" aria-label="Search tasks" />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-2">Person
          <Select value={q.person || ''} onChange={(e) => setFilter({ person: e.target.value })}>
            <option value="">Everyone</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-2">Project
          <Select value={q.project || ''} onChange={(e) => setFilter({ project: e.target.value })}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-2">Due
          <Select value={q.due || ''} onChange={(e) => setFilter({ due: e.target.value })}>
            <option value="">Any time</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="week">Due this week</option>
            <option value="none">No due date</option>
          </Select>
        </label>
        <Btn kind="primary" onClick={() => setFilter({})}>Apply</Btn>
        <Btn onClick={resetFilters}>Reset</Btn>
      </div>

      <details className="mb-4">
        <summary className={`group inline-flex cursor-pointer list-none items-center gap-1 text-[13px] font-medium [&::-webkit-details-marker]:hidden ${moreFiltersActive ? 'text-accent-text' : 'text-ink-2'}`}>
          More filters{moreFiltersActive ? ' · active' : ''}
          <Icon name="chev" small className="transition group-open:rotate-90" />
        </summary>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-2">Status
            <Select value={q.stage || ''} onChange={(e) => setFilter({ stage: e.target.value })}>
              <option value="">Any status</option>
              {STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-2">Priority
            <Select value={q.priority || ''} onChange={(e) => setFilter({ priority: e.target.value })}>
              <option value="">Any priority</option>
              {PRIORITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </label>
          <label className="flex min-h-9 items-center gap-1.5"><input type="checkbox" checked={!!q.overdue} onChange={(e) => setFilter({ overdue: e.target.checked ? '1' : '' })} /> Overdue</label>
          <label className="flex min-h-9 items-center gap-1.5"><input type="checkbox" checked={!!q.critical} onChange={(e) => setFilter({ critical: e.target.checked ? '1' : '' })} /> Critical only</label>
          <label className="flex min-h-9 items-center gap-1.5"><input type="checkbox" checked={!!q.unassigned} onChange={(e) => setFilter({ unassigned: e.target.checked ? '1' : '' })} /> Unassigned</label>
          <label className="flex min-h-9 items-center gap-1.5"><input type="checkbox" checked={!!q.week} onChange={(e) => setFilter({ week: e.target.checked ? '1' : '' })} /> Due this week</label>
          <Btn kind="primary" onClick={() => setFilter({})}>Apply</Btn>
          <Btn onClick={resetFilters}>Reset</Btn>
        </div>
      </details>

      <List empty="No tasks match these filters.">
        {owners.map((owner) => (
          <Card key={owner} title={`${name(owner)} · ${byPerson[owner].length} ${q.stage === 'done' ? 'done' : 'open'}`}>
            <DataTable
              cols={['Project', 'Task', 'Due', 'Status', '']}
              rows={byPerson[owner].map((t) => [
                P(t.projectId)?.name || '',
                <button type="button" onClick={() => openTaskDetail(t.id)} className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-left font-medium text-ink hover:text-accent-text hover:underline">
                  {t.critical && <i className="h-1.5 w-1.5 flex-none rounded-full bg-crit" aria-hidden="true" />}{t.title}
                </button>,
                <DueText t={t} />,
                <StagePill stage={stageOf(t)} />,
                <Btn sm onClick={() => openTaskDetail(t.id)}>Open</Btn>,
              ])}
            />
          </Card>
        ))}
      </List>
    </>
  );
}

// ---------- Today ----------
function Today() {
  const r = role();
  const u = me();
  if (r === 'client' || r === 'contractor') {
    const Home = r === 'client' ? ClientHome : ContractorHome;
    return (
      <>
        <PageHeader title="Today" sub={`${fmtD(TODAY)} · ${u.title || u.role}`} />
        <Home />
        <div className="mt-gap"><ProjectUpdates /></div>
      </>
    );
  }
  const ann = ANNOUNCEMENTS.find((a) => a.pinned) || ANNOUNCEMENTS[0];
  const Home = { designer: DesignerHome, site_manager: SiteManagerHome, hr: HrHome }[r] || PartnerHome;
  const attention = r === 'partner'
    ? { n: needsYou().length, label: 'Need your attention' }
    : { n: svc.notifications().length, label: 'Notifications' };
  // DesignerHome already lists open client decisions and PartnerHome already lists overdue
  // invoices ("Money this week") — only add the cards that aren't already ground that role's own
  // Home covers, so nothing repeats and nothing stretches a half-empty row next to a short card.
  const showDecisions = r !== 'designer';
  const showPayments = can('budget', 'r') && r !== 'partner';
  // Left: decisions waiting (what I'm waiting on). Right: site activity (what happened recently)
  // — visual emphasis decreases left-to-right/top-to-bottom the same way it does down the page.
  const bottomCards = [...(showDecisions ? [<DecisionsWaiting key="decisions" />] : []), <SiteActivityToday key="site-activity" />];
  return (
    <>
      <TodayBanner role={u.title || u.role} attention={attention} />
      <TodayBriefing />
      <div className="grid items-start gap-gap xl:grid-cols-[minmax(0,1fr)_340px] [&>*]:min-w-0">
        <div className="flex flex-col gap-gap">
          <TodayPriorities />
          <WaitingOnOthers />
          <Home />
        </div>
        <aside className="flex flex-col gap-gap">
          <ScheduleCard />
          <TasksCard />
          <SiteReviewQueue />
        </aside>
      </div>
      <div className={`mt-gap grid items-start gap-gap [&>*]:min-w-0 ${bottomCards.length > 1 ? 'md:grid-cols-2' : ''}`}>
        {bottomCards}
      </div>
      {showPayments && <div className="mt-gap"><PaymentFollowUps /></div>}
      <div className="mt-gap flex flex-col gap-2.5">
        <RecentUpdates />
        {ann && (
          <details className="rounded-r3 border border-line bg-accent-soft px-4 py-3">
            <summary className="cursor-pointer font-semibold">
              Studio notice <span className="ml-2 font-normal text-ink-2">{ann.text.slice(0, 90)}{ann.text.length > 90 ? '…' : ''}</span>
            </summary>
            <p>{ann.text}</p>
            <small className="text-ink-3">{first(ann.by)} · {fmtD(ann.at)}</small>
          </details>
        )}
      </div>
    </>
  );
}

// ---------- Dialog: add-task-all ----------
// Same creation flow as before (svc.addTask, same required fields, same owner-load hint) — the
// only addition is a priority select in place of the old bare "Critical" checkbox, so a new task
// starts with the same priority the rest of the page now understands. svc.addTask itself is
// untouched (other callers still work unchanged); the priority is stamped on the new record
// straight after, the same direct state.db.TASKS write every other mutation on this page already
// uses.
function AddTaskAll({ d }) {
  const projects = svc.projects();
  const people = svc.people();
  const save = (e) => {
    e.preventDefault();
    const p = formData(e.currentTarget);
    try {
      const rec = svc.addTask({ projectId: p.projectId, title: p.title, owner: p.owner, due: p.due, critical: p.priority === 'critical' });
      rec.priority = p.priority || 'normal';
      rec.stage = 'todo';
      persist();
      state.desk.dialog = null;
      toast('Task added.');
    } catch (err) {
      d.error = err.message;
      render();
    }
  };
  return (
    <Modal title="Add task">
      <form onSubmit={save}>
        <Field label="Project">
          <Select name="projectId" defaultValue={d.projectId}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Title"><Input name="title" required defaultValue={d.title || ''} /></Field>
        <Field label="Owner">
          <Select name="owner">
            {people.map((p) => <option key={p.id} value={p.id}>{p.name} · {svc.load(p.id)} open</option>)}
          </Select>
        </Field>
        <Field label="Due"><Input type="date" name="due" defaultValue={TODAY} /></Field>
        <Field label="Priority">
          <Select name="priority" defaultValue="normal">
            {PRIORITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        {d.error && <p role="alert" className="text-crit">{d.error}</p>}
        <ModalActions>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn kind="primary" type="submit">Add</Btn>
        </ModalActions>
      </form>
    </Modal>
  );
}

// ---------- Dialog: task-detail ----------
// Simple by default: name, project/site, assignee, due, description, checklist, one primary
// action (Mark complete). Dependencies/activity/editing/status-stage/priority — the things that
// answer questions beyond "what, who, when" — sit behind one "More details" disclosure instead of
// all being visible at once.
function TaskDetailDialog({ d }) {
  const [editing, setEditing] = useState(false);
  const t = state.db.TASKS.find((x) => x.id === d.id);
  if (!t) return <Modal title="Task"><p className="text-ink-3">This task no longer exists.</p></Modal>;
  const project = P(t.projectId);
  const site = svc.sites().find((s) => s.projectId === t.projectId);
  const people = svc.people();
  const projects = svc.projects();
  const checklist = t.checklist || [];
  const doneCount = checklist.filter((c) => c.done).length;
  const blockedBy = (t.blockedBy || []).map((id) => state.db.TASKS.find((x) => x.id === id)).filter(Boolean);
  const blocks = (t.blocks || []).map((id) => state.db.TASKS.find((x) => x.id === id)).filter(Boolean);
  const issue = t.issueId ? state.db.ISSUES.find((i) => i.id === t.issueId) : null;
  const done = stageOf(t) === 'done';
  const saveEdit = (e) => {
    e.preventDefault();
    const p = formData(e.currentTarget);
    updateTaskFields(t.id, { title: p.title, projectId: p.projectId, due: p.due, description: p.description });
    setEditing(false);
  };
  if (editing) {
    return (
      <Modal title="Edit task">
        <form onSubmit={saveEdit}>
          <Field label="Title"><Input name="title" required defaultValue={t.title} /></Field>
          <Field label="Project">
            <Select name="projectId" defaultValue={t.projectId}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Due"><Input type="date" name="due" defaultValue={t.due || ''} /></Field>
          <Field label="Description"><Textarea name="description" defaultValue={t.description || ''} /></Field>
          <ModalActions>
            <Btn onClick={() => setEditing(false)}>Cancel</Btn>
            <Btn kind="primary" type="submit">Save</Btn>
          </ModalActions>
        </form>
      </Modal>
    );
  }
  return (
    <Modal label={t.title} title={<span className="flex flex-wrap items-center gap-2">{t.title} {t.critical && <Pill kind="crit">Critical</Pill>}{done && <StagePill stage="done" />}</span>}>
      <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-3">
        <div><dt className="text-xs text-ink-3">Project</dt><dd className="m-0 font-medium">{project?.name || '—'}</dd></div>
        {site && <div><dt className="text-xs text-ink-3">Site</dt><dd className="m-0 font-medium">{site.name}</dd></div>}
        <div><dt className="text-xs text-ink-3">Due</dt><dd className="m-0 font-medium"><DueText t={t} /></dd></div>
        <div>
          <dt className="text-xs text-ink-3">Assignee</dt>
          <dd className="m-0">
            <Select value={t.owner || ''} onChange={(e) => reassignTask(t.id, e.target.value)} disabled={!can('task', 'w')} className="!min-h-8 !py-1 font-medium">
              <option value="">Unassigned</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </dd>
        </div>
      </dl>

      {t.description && <p className="mb-4 mt-0 rounded-r2 border-l-4 border-accent bg-surface-2 px-3.5 py-2.5">{t.description}</p>}

      {checklist.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 mt-0 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">
            Checklist <span className="normal-case tracking-normal text-ink-2">{doneCount} / {checklist.length} complete</span>
          </p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {checklist.map((c) => (
              <li key={c.id}>
                <label className="flex min-h-9 items-center gap-2.5 rounded-r1 border border-line bg-surface px-2.5 py-1.5">
                  <input type="checkbox" checked={!!c.done} disabled={!can('task', 'w')} onChange={() => toggleChecklistItem(t.id, c.id)} />
                  <span className={c.done ? 'text-ink-3 line-through' : ''}>{c.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="mb-4">
        <summary className="group inline-flex cursor-pointer list-none items-center gap-1 text-[13px] font-medium text-ink-2 [&::-webkit-details-marker]:hidden">
          More details
          <Icon name="chev" small className="transition group-open:rotate-90" />
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Status" className="mb-0 min-w-[160px] flex-1">
              <Select value={stageOf(t)} onChange={(e) => setTaskStage(t.id, e.target.value)} disabled={!can('task', 'w')}>
                {STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Priority" className="mb-0 min-w-[160px] flex-1">
              <Select value={priorityOf(t)} onChange={(e) => setTaskPriority(t.id, e.target.value)} disabled={!can('task', 'w')}>
                {PRIORITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
            {can('task', 'w') && <Btn sm onClick={() => setEditing(true)}>Edit title, project, due or description</Btn>}
          </div>

          {(blockedBy.length > 0 || blocks.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {blockedBy.length > 0 && (
                <div>
                  <p className="mb-1.5 mt-0 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">Blocked by</p>
                  <List>{blockedBy.map((x) => (
                    <Item key={x.id} onClick={() => openTaskDetail(x.id)}><ItemBody title={x.title} sub={P(x.projectId)?.name} /><StagePill stage={stageOf(x)} /></Item>
                  ))}</List>
                </div>
              )}
              {blocks.length > 0 && (
                <div>
                  <p className="mb-1.5 mt-0 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">Blocks</p>
                  <List>{blocks.map((x) => (
                    <Item key={x.id} onClick={() => openTaskDetail(x.id)}><ItemBody title={x.title} sub={P(x.projectId)?.name} /><StagePill stage={stageOf(x)} /></Item>
                  ))}</List>
                </div>
              )}
            </div>
          )}

          {issue && (
            <div>
              <p className="mb-1.5 mt-0 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">Activity from the related site issue</p>
              <List empty="No updates logged yet.">
                {issue.updates.map((u, i) => <Item key={i}><ItemBody title={u.text} sub={`${name(u.by)} · ${fmtDT(u.at)}`} /></Item>)}
              </List>
            </div>
          )}
        </div>
      </details>

      <ModalActions>
        <Btn onClick={closeDialog}>Close</Btn>
        {can('task', 'w') && !done && <Btn kind="primary" onClick={() => setTaskStage(t.id, 'done')}>Mark complete</Btn>}
      </ModalActions>
    </Modal>
  );
}

export const pages = {
  tasks: ({ q }) => <Tasks q={q || {}} />,
  dashboard: () => <Dashboard />,
  today: () => <Today />,
};
export const dialogs = { 'add-task-all': AddTaskAll, 'task-detail': TaskDetailDialog };
