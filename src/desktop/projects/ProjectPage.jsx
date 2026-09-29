import { state, svc, can, toast, inr, fmtD } from '../../shared/core.js';
import { TODAY, PHASES } from '../../shared/data.js';
import { Btn, Pill, DataTable, PageHeader, Empty } from '../../ui/ui';
import { DLink, href } from '../nav';
import { STAGE_TEMPLATE } from '../data.js';
import { SiteLink, ChatLink } from '../parts';
import { role, name } from '../helpers';
import { openDialog } from '../session';
import { ProjectOwner, ProjectBudgetStatus, projectMilestones, openIssues } from './common';
import { OverviewTab } from './Overview';
import { DrawingsTab } from './Drawings';
import {
  FilesTab, ApprovalsTab, IntakeTab, ReferencesTab, TasksTab, ChangesTab, MeetingsTab, DocsTab,
} from './TabsA';
import {
  FinishesTab, SelectionsTab, ChecklistsTab, BudgetTab, FeesTab, TeamTab, DecisionsTab, MoodboardTab, HandoverTab,
} from './TabsB';

// ---------- list ----------
function ProjectCards({ projects }) {
  if (!projects.length) {
    return <div className="my-5"><Empty>No projects in this view. Choose All to see the full register.</Empty></div>;
  }
  return (
    <div className="my-5 grid gap-4 md:grid-cols-2">
      {projects.map((p) => {
        const milestone = projectMilestones(p).find((m) => !m.done);
        const issues = openIssues(p.id);
        return (
          <article key={p.id} className="min-w-0 rounded-r3 border border-line bg-surface p-5">
            <div className="flex items-start gap-3.5">
              <span className="grid h-[46px] w-[46px] flex-none place-items-center rounded-r3 bg-surface-3 text-base font-semibold text-ink-2" aria-hidden="true">
                {(p.code || p.name).slice(-4)}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="m-0 mb-1 text-[21px] leading-snug">
                  <DLink to={`#/projects/${p.id}`} className="text-ink no-underline hover:underline" style={{ color: 'var(--ink)' }}>{p.name}</DLink>
                </h2>
                <span className="text-ink-3">{p.kind} · {p.city}</span>
              </div>
              <Pill>{p.status === 'finished' ? 'Finished' : PHASES[p.phase]}</Pill>
            </div>
            <div className="my-6 flex h-[5px] gap-[5px]" aria-label={`Phase: ${PHASES[p.phase]}`}>
              {PHASES.map((phase, i) => (
                <span key={phase} title={phase} className={`flex-1 rounded-sm ${i <= p.phase ? 'bg-accent' : 'bg-surface-3'}`} />
              ))}
            </div>
            <div className="grid gap-1.5 text-base">
              <span className="text-[13px] text-ink-3">Next milestone</span>
              <b>{milestone ? milestone.name : 'No upcoming milestone'}</b>
              {milestone && (
                <small className={`text-sm ${milestone.date < TODAY ? 'text-crit' : 'text-ink-3'}`}>
                  {fmtD(milestone.date)}{milestone.date < TODAY ? ' · Overdue' : ''}
                </small>
              )}
            </div>
            <div className="mt-5 flex justify-between gap-3.5 border-t border-line pt-3.5 text-[13px]">
              <span>
                {can('issue', 'r', role())
                  ? (issues.length ? `${issues.length} open issue${issues.length === 1 ? '' : 's'}` : 'No open issues')
                  : 'Project resources'}
              </span>
              <span className="text-right"><ProjectOwner p={p} /></span>
            </div>
            {can('budget', 'r', role()) && <div className="mt-3"><ProjectBudgetStatus p={p} /></div>}
          </article>
        );
      })}
    </div>
  );
}

function ProjectList({ status }) {
  const all = svc.projects();
  const ps = status === 'all' ? all : all.filter((p) => (p.status || 'active') === status);
  const chip = (k, l) => <Btn key={k} sm kind={status === k ? 'primary' : 'default'} to={href(`#/projects?status=${k}`)}>{l}</Btn>;
  const budget = can('budget', 'r', role());
  return (
    <>
      <PageHeader title="Projects">
        {chip('active', 'Active')}{chip('finished', 'Finished')}{chip('all', 'All')}
        {can('project', 'w', role()) && (
          <Btn kind="primary" onClick={() => openDesktopTemplate()}>New from template</Btn>
        )}
      </PageHeader>
      <ProjectCards projects={ps} />
      <details className="my-5">
        <summary className="min-h-11 cursor-pointer py-2.5 font-medium text-ink-2">Project list · owners and deadlines</summary>
        <DataTable
          cols={['Project', 'Owner', 'Next milestone', 'Needs attention']}
          rows={ps.map((p) => {
            const nm = projectMilestones(p).find((m) => !m.done);
            const issues = openIssues(p.id);
            const finished = p.status === 'finished';
            return [
              <>
                <DLink to={`#/projects/${p.id}`} className="font-semibold text-accent-text">{p.name}</DLink>
                <small className="block text-ink-3">{p.code} · {PHASES[p.phase]}{finished ? ' · Finished ' + fmtD(p.finishedAt) : ''}</small>
              </>,
              <ProjectOwner p={p} />,
              nm ? (
                <>
                  {nm.name}
                  <small className="block text-ink-3">
                    {fmtD(nm.date)}{nm.date < TODAY && <> · <span className="text-crit">Overdue</span></>}
                  </small>
                </>
              ) : <span className="text-ink-3">No upcoming milestone</span>,
              <>
                {issues.length
                  ? <DLink to={`#/sites/${p.siteId}?tab=${role() === 'contractor' ? 'feed' : 'issues'}`} className="text-accent-text underline">{issues.length} open issue{issues.length === 1 ? '' : 's'}</DLink>
                  : 'No open issues'}
                {budget && <small className="block"><ProjectBudgetStatus p={p} /></small>}
              </>,
            ];
          })}
        />
      </details>
      <details className="my-5">
        <summary className="min-h-11 cursor-pointer py-2.5 font-medium text-ink-2">
          Compare project details{budget ? ' · team and budget' : ' · team and phase'}
        </summary>
        <DataTable
          cols={['Project', 'Phase', 'Team', ...(budget ? ['₹Budget', '₹Spent', 'Budget status'] : []), 'Status']}
          rows={ps.map((p) => [
            <DLink to={`#/projects/${p.id}`} className="text-accent-text underline">{p.name}</DLink>,
            PHASES[p.phase],
            p.teamIds.map((id) => name(id)).join(', '),
            ...(budget ? [inr(p.budget), inr(p.actual), <ProjectBudgetStatus p={p} />] : []),
            p.status === 'finished' ? 'Finished ' + fmtD(p.finishedAt) : 'Active',
          ])}
        />
      </details>
    </>
  );
}

// "New from template" opens the template dialog (owned by the resources module).
function openDesktopTemplate() {
  openDialog({ kind: 'template', name: STAGE_TEMPLATE.name, tkind: 'Project' });
}

// ---------- tabs ----------
const PTABS = [
  ['overview', 'Overview'], ['intake', 'Intake'], ['tasks', 'Tasks'], ['drawings', 'Drawings'], ['files', 'Files'],
  ['changes', 'Changes & RFIs'], ['meetings', 'Meetings'], ['docs', 'Documents'], ['finishes', 'Finishes'],
  ['selections', 'Selections & POs'], ['checklists', 'Checklists'], ['budget', 'Budget'], ['fees', 'Fees'],
  ['team', 'Team'], ['decisions', 'Decisions'], ['moodboard', 'Moodboard'], ['references', 'References'],
  ['approvals', 'Approvals'], ['handover', 'Handover'],
];
const CLIENT_TABS = ['overview', 'intake', 'drawings', 'changes', 'meetings', 'docs', 'selections', 'decisions', 'moodboard', 'references', 'handover'];
const PROJECT_GROUPS = [
  ['Overview', ['overview', 'intake']],
  ['Design', ['drawings', 'finishes', 'moodboard', 'references', 'docs', 'files']],
  ['Delivery', ['tasks', 'changes', 'decisions', 'checklists', 'approvals', 'handover']],
  ['Commercial', ['selections', 'budget', 'fees']],
  ['Team', ['meetings', 'team']],
];
const PTAB = {
  files: FilesTab, approvals: ApprovalsTab, intake: IntakeTab, references: ReferencesTab, overview: OverviewTab,
  tasks: TasksTab, drawings: DrawingsTab, changes: ChangesTab, meetings: MeetingsTab, docs: DocsTab,
  finishes: FinishesTab, selections: SelectionsTab, checklists: ChecklistsTab, budget: BudgetTab, fees: FeesTab,
  team: TeamTab, decisions: DecisionsTab, moodboard: MoodboardTab, handover: HandoverTab,
};

const navLink = 'flex min-h-11 items-center border-b-2 px-3.5 py-2.5 font-medium no-underline hover:bg-surface-2';
function ProjectTabs({ projectId, list, current }) {
  const frequent = ['overview', 'tasks', 'drawings', 'files', 'decisions'];
  const direct = [...frequent, ...(!frequent.includes(current) ? [current] : [])]
    .map((key) => list.find(([id]) => id === key)).filter(Boolean);
  const destination = ([key, label]) => (
    <DLink
      key={key}
      to={`#/projects/${projectId}?tab=${key}`}
      aria-current={current === key ? 'page' : undefined}
      className={`${navLink} ${current === key ? 'border-accent font-semibold' : 'border-transparent'}`}
      style={{ color: current === key ? 'var(--accent-text)' : 'var(--ink-2)' }}
    >
      {label}
    </DLink>
  );
  const more = PROJECT_GROUPS.map(([label, keys]) => {
    const entries = list.filter(([key]) => keys.includes(key) && !direct.some(([id]) => id === key));
    return entries.length ? (
      <div key={label}>
        <h3 className="mb-1.5 mt-0 text-xs font-semibold text-ink-3">{label}</h3>
        {entries.map(([key, l]) => (
          <DLink key={key} to={`#/projects/${projectId}?tab=${key}`} className="block rounded p-2 text-ink no-underline hover:bg-accent-soft" style={{ color: 'var(--ink)' }}>{l}</DLink>
        ))}
      </div>
    ) : null;
  }).filter(Boolean);
  return (
    <nav className="relative mb-4 border-b border-line" aria-label="Project sections">
      <div className="flex flex-wrap items-stretch gap-1">
        {direct.map(destination)}
        {more.length > 0 && (
          <details className="group static">
            <summary className="flex min-h-11 cursor-pointer items-center px-3.5 py-2.5 font-medium text-ink-2 hover:bg-surface-2">More project tools</summary>
            <div className="absolute left-0 top-full z-10 grid w-[min(680px,100%)] gap-4 rounded-r2 border border-line-2 bg-surface p-5 shadow-s2 sm:grid-cols-2 lg:grid-cols-3">{more}</div>
          </details>
        )}
      </div>
    </nav>
  );
}

function ProjectPage({ id, tab: wanted }) {
  const p = svc.project(id);
  if (!p) return <Empty>No access to this project.</Empty>;
  const list = role() === 'client'
    ? PTABS.filter(([k]) => CLIENT_TABS.includes(k))
    : PTABS.filter(([k]) => (k !== 'budget' && k !== 'fees') || can('budget', 'r', role()));
  const tab = list.some(([k]) => k === wanted) ? wanted : 'overview';
  const site = state.db.SITES.find((s) => s.id === p.siteId);
  const thread = state.db.THREADS.find((t) => t.projectId === p.id && t.kind === (role() === 'client' ? 'client' : 'internal'));
  const Tab = PTAB[tab];
  const finished = p.status === 'finished';
  return (
    <>
      <header className="mb-4">
        <div className="mb-1.5 text-[13px] text-ink-3">
          <DLink to="#/projects" className="text-inherit underline">Projects</DLink> / {p.code} <span className="ml-2">· {PHASES[p.phase]}</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[230px] flex-1">
            <h1 className="m-0 text-[28px] font-semibold leading-tight tracking-tight">{p.name}</h1>
            <p className="mb-0 mt-2 text-[13px] text-ink-3">
              {p.kind} · {p.area} · {p.city} · Client {name(p.clientId)}
              {finished && <> · <Pill kind="soft">Finished {fmtD(p.finishedAt)}</Pill> hidden from phones</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3.5 text-[13px]">
            {site && <SiteLink id={site.id}>Open site</SiteLink>}
            <ChatLink thread={thread}>Open chat</ChatLink>
            {role() === 'partner' && (
              <details className="relative">
                <summary className="cursor-pointer whitespace-nowrap py-1.5 font-medium text-ink-2">Project actions</summary>
                <div className="absolute right-0 top-10 z-10 w-[260px] max-w-[calc(100vw-40px)] rounded-r2 border border-line-2 bg-surface p-4 shadow-s2">
                  <p className="mb-3 mt-0 text-sm">
                    {finished
                      ? 'Reopen this project to make it available to site teams again.'
                      : 'Finish this project when its work is complete. It will leave active project lists and phones.'}
                  </p>
                  <Btn sm onClick={() => (finished ? reopenProject(p.id) : finishProject(p.id))}>
                    {finished ? 'Reopen project' : 'Mark finished'}
                  </Btn>
                </div>
              </details>
            )}
          </div>
        </div>
      </header>
      <ProjectTabs projectId={p.id} list={list} current={tab} />
      <Tab p={p} />
    </>
  );
}

function finishProject(id) {
  if (!window.confirm("Finished projects disappear from everyone's phone. Clients and contractors keep 30 days for warranty chat. Only a partner can reopen.")) return;
  svc.finishProject(id);
  toast('Project finished.');
}
function reopenProject(id) {
  svc.reopenProject(id);
  toast('Project reopened.');
}

export default function ProjectsPage({ parts, q }) {
  const [id] = parts;
  return id ? <ProjectPage id={id} tab={q.tab || 'overview'} /> : <ProjectList status={q.status || 'active'} />;
}
