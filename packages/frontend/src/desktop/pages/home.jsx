// Feature module: home (tasks, dashboard). Exports page components and dialogs (see registry.js).
import { state, svc, fmtD, go, toast, render } from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import { Btn, Card, List, PageHeader, DataTable, Field, Input, Select } from '../../ui/ui';
import { P, name } from '../helpers';
import Modal, { ModalActions } from '../Modal';
import { closeDialog, formData } from '../session';
import Dashboard from '../home/Dashboard';

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
  today: () => <Dashboard />, // legacy route: Today now lives on the Dashboard
};
export const dialogs = { 'add-task-all': AddTaskAll };
