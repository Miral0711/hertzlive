// Feature module: home (tasks, dashboard, today). Exports page components and dialogs (see registry.js).
import { useEffect, useState } from 'react';
import { state, svc, can, fmtD, fmtDT, go, toast, render, me, tenantProjectImage } from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import { ANNOUNCEMENTS } from '../data';
import { Btn, Card, Grid2, Item, ItemBody, Kpi, Kpis, List, PageHeader, DataTable, Field, Input, Select } from '../../ui/ui';
import Ph from '../../ui/Ph';
import Icon from '../../ui/Icon';
import { DLink, href } from '../nav';
import { P, name, first, role } from '../helpers';
import Modal, { ModalActions } from '../Modal';
import { closeDialog, formData } from '../session';
import { ProjectUpdates, SiteReviewQueue } from '../chat/assist';
import {
  PartnerHome, DesignerHome, SiteManagerHome, HrHome, ClientHome, ContractorHome,
} from '../home/homes';

// ---------- All tasks ----------
function Tasks({ q }) {
  let rows = svc.tasks();
  if (q.person) rows = rows.filter((t) => t.owner === q.person);
  if (q.project) rows = rows.filter((t) => t.projectId === q.project);
  if (q.critical) rows = rows.filter((t) => t.critical);
  if (q.week) {
    const end = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    rows = rows.filter((t) => t.due && t.due <= end);
  }
  const byPerson = {};
  rows.forEach((t) => { (byPerson[t.owner] ||= []).push(t); });
  const people = svc.people();
  const projects = svc.projects();
  const apply = (e) => {
    e.preventDefault();
    const p = formData(e.currentTarget);
    const sp = new URLSearchParams();
    if (p.person) sp.set('person', p.person);
    if (p.project) sp.set('project', p.project);
    if (p.week) sp.set('week', '1');
    if (p.critical) sp.set('critical', '1');
    go(`#/tasks${sp.toString() ? `?${sp.toString()}` : ''}`);
  };
  const owners = Object.keys(byPerson);
  return (
    <>
      <PageHeader title="All tasks">
        <Btn kind="primary" onClick={() => openAddTask('')}>Add task</Btn>
      </PageHeader>
      <form
        key={JSON.stringify(q)}
        className="mb-4 flex flex-wrap items-end gap-3"
        onSubmit={apply}
      >
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-2">Person
          <Select name="person" defaultValue={q.person || ''}>
            <option value="">Everyone</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-2">Project
          <Select name="project" defaultValue={q.project || ''}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </label>
        <label className="flex min-h-9 items-center gap-1.5"><input type="checkbox" name="week" defaultChecked={!!q.week} /> Due this week</label>
        <label className="flex min-h-9 items-center gap-1.5"><input type="checkbox" name="critical" defaultChecked={!!q.critical} /> Critical only</label>
        <Btn type="submit">Apply</Btn>
      </form>
      <List empty="No open tasks match these filters.">
        {owners.map((owner) => (
          <Card key={owner} title={name(owner)}>
            <DataTable
              cols={['Project', 'Task', 'Due', 'Critical']}
              rows={byPerson[owner].map((t) => [P(t.projectId)?.name || '', t.title, t.due ? fmtD(t.due) : 'Not set', t.critical ? 'Yes' : 'No'])}
            />
          </Card>
        ))}
      </List>
    </>
  );
}
function openAddTask(projectId) {
  state.desk.dialog = { kind: 'add-task-all', projectId: projectId || '' };
  render();
}

// ---------- Dashboard ----------
function Dashboard() {
  // Prototype refreshed the dashboard every 30 s while it was showing.
  useEffect(() => {
    const t = setInterval(() => render(), 30000);
    return () => clearInterval(t);
  }, []);
  const r = role();
  const notes = svc.notifications();
  const checks = svc.checks();
  const addCheck = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const text = formData(form).text?.trim();
    if (!text) return;
    svc.addCheck(text);
    form.reset();
    render();
  };
  return (
    <>
      <PageHeader title="Dashboard" sub="Live for your role, refreshed every 30 seconds in this browser. Not a server push.">
        <Btn onClick={() => { render(); toast('Dashboard refreshed.'); }}>Refresh</Btn>
      </PageHeader>
      <Kpis>
        <Kpi label="Open tasks" value={svc.tasks({ mine: true }).length} />
        <Kpi label="Notifications" value={notes.length} />
        {can('enquiry', 'r') && <Kpi label="New enquiries" value={svc.myEnquiries().length} />}
        {can('leave', 'a') && <Kpi label="Leave to approve" value={svc.leaves({ status: 'pending' }).length} />}
        {r === 'partner' && <Kpi label="All open tasks" value={svc.tasks().length} />}
      </Kpis>
      <Grid2>
        <Card title="Notifications">
          <List empty="Nothing new.">
            {notes.map((n, i) => (
              <Item key={n.id || i} to={href(n.ref || '#/today')}>
                <ItemBody title={n.text} sub={fmtDT(n.at)} />
              </Item>
            ))}
          </List>
        </Card>
        <Card title="Your checklist">
          <form className="mb-2.5 flex gap-2" onSubmit={addCheck}>
            <Input name="text" placeholder="Add a to-do for today" required aria-label="Add a to-do for today" className="min-w-0 flex-1" />
            <Btn type="submit">Add</Btn>
          </form>
          <List empty="No items yet.">
            {checks.map((c) => (
              <label key={c.id} className="flex min-h-11 items-center gap-3 rounded-r2 border border-line bg-surface px-3.5 py-2.5">
                <input type="checkbox" checked={!!c.done} onChange={() => { svc.toggleCheck(c.id); render(); }} />
                <span className={c.done ? 'text-ink-3 line-through' : ''}>{c.text}</span>
              </label>
            ))}
          </List>
        </Card>
      </Grid2>
    </>
  );
}

// ---------- Today ----------
const TAGLINE = {
  designer: 'Move drawings forward. Keep decisions clear.',
  site_manager: 'Coordinate the site. Close the loop with the studio.',
  hr: 'Keep your team and the studio moving.',
};
// Real clock time (not fabricated) — a small, honest touch the reference's editorial hero leans on.
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
function HeroImage({ p }) {
  const img = p && tenantProjectImage(p.id);
  const [broken, setBroken] = useState(false);
  if (!p) return null;
  if (img && !broken) {
    return <img src={img.src} alt={img.alt || p.name} className="h-full w-full object-cover" onError={() => setBroken(true)} />;
  }
  return <Ph hue={p.hue ?? 30} seed={p.id} ar={1.5} className="h-full" />;
}
function TodayHero({ u, r }) {
  const p = svc.projects().find((x) => (x.status || 'active') === 'active') || svc.projects()[0];
  return (
    <div className="mb-7 grid items-stretch gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col justify-center">
        <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">{fmtD(TODAY)} · {u.title || u.role}</p>
        <h1 className="m-0 text-[40px] font-semibold leading-[1.05] tracking-tight">
          {greeting()}, <span className="text-accent-text">{first(u.id)}.</span>
        </h1>
        <p className="mt-3 max-w-[48ch] text-ink-2">{TAGLINE[r] || 'The decisions, projects and people that need your attention.'}</p>
        <DLink to="#/schedule" className="mt-4 inline-flex w-fit items-center gap-1.5 font-semibold text-accent-text no-underline hover:underline">
          View schedule <Icon name="chev" small />
        </DLink>
      </div>
      {p && <div className="hidden h-56 overflow-hidden rounded-r3 bg-surface-2 lg:block"><HeroImage p={p} /></div>}
    </div>
  );
}
function Today() {
  const r = role();
  if (r === 'client') return <><ClientHome /><ProjectUpdates /></>;
  if (r === 'contractor') return <><ContractorHome /><ProjectUpdates /></>;
  const ann = ANNOUNCEMENTS.find((a) => a.pinned) || ANNOUNCEMENTS[0];
  const Home = { designer: DesignerHome, site_manager: SiteManagerHome, hr: HrHome }[r] || PartnerHome;
  const u = me();
  return (
    <>
      <TodayHero u={u} r={r} />
      <Home />
      {r !== 'partner' && <div className="mb-3.5"><SiteReviewQueue /></div>}
      <ProjectUpdates />
      {ann && (
        <details className="mt-4 rounded-r3 border border-line bg-surface-2 px-4 py-3">
          <summary className="cursor-pointer font-semibold">
            Studio notice <span className="ml-2 font-normal text-ink-3">{ann.text.slice(0, 90)}{ann.text.length > 90 ? '…' : ''}</span>
          </summary>
          <p>{ann.text}</p>
          <small className="text-ink-3">{first(ann.by)} · {fmtD(ann.at)}</small>
        </details>
      )}
    </>
  );
}

// ---------- Dialog: add-task-all ----------
function AddTaskAll({ d }) {
  const projects = svc.projects();
  const people = svc.people();
  const save = (e) => {
    e.preventDefault();
    const p = formData(e.currentTarget);
    try {
      svc.addTask({ projectId: p.projectId, title: p.title, owner: p.owner, due: p.due, critical: !!p.critical });
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
        <label className="flex items-center gap-1.5"><input type="checkbox" name="critical" /> Critical</label>
        {d.error && <p role="alert" className="text-crit">{d.error}</p>}
        <ModalActions>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn kind="primary" type="submit">Add</Btn>
        </ModalActions>
      </form>
    </Modal>
  );
}

export const pages = {
  tasks: ({ q }) => <Tasks q={q || {}} />,
  dashboard: () => <Dashboard />,
  today: () => <Today />,
};
export const dialogs = { 'add-task-all': AddTaskAll };
