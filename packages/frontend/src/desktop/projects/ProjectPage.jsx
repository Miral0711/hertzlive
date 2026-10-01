import { useEffect, useRef, useState } from 'react';
import { state, svc, can, toast, inr, fmtD, tenantProjectImage } from '../../shared/core.js';
import { TODAY, PHASES } from '../../shared/data.js';
import { Btn, Pill, DataTable, PageHeader, Empty } from '../../ui/ui';
import Ph from '../../ui/Ph';
import { DLink } from '../nav';
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

// Real tenant photography wins when the studio has attached one (see AGENCY.brand.projects in
// shared/data2.js, edited from Settings) — but those source files stay local/private per that
// file's own comment, so this also has to degrade gracefully to the placeholder if the asset
// 404s (e.g. this preview build, which never packages the private source portfolio).
function ProjectImage({ p, className = '' }) {
  const img = tenantProjectImage(p.id);
  const [broken, setBroken] = useState(false);
  if (img && !broken) {
    return <img src={img.src} alt={img.alt || p.name} className={`h-full w-full object-cover ${className}`} onError={() => setBroken(true)} />;
  }
  return <Ph hue={p.hue ?? 30} seed={p.id} ar={1.6} className={`h-full ${className}`} />;
}

// ---------- list ----------
function ProjectCards({ projects }) {
  if (!projects.length) {
    return <div className="my-5"><Empty>No projects in this view. Choose All to see the full register.</Empty></div>;
  }
  return (
    <div className="mb-6 mt-2 grid gap-gap-lg sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((p) => {
        const milestone = projectMilestones(p).find((m) => !m.done);
        const issues = openIssues(p.id);
        return (
          <article key={p.id} className="flex min-w-0 flex-col overflow-hidden rounded-r3 border border-line bg-surface transition hover:border-accent hover:shadow-s1">
            <DLink to={`#/projects/${p.id}`} className="block no-underline" aria-hidden="true" tabIndex={-1}>
              <div className="h-36 w-full overflow-hidden bg-surface-2">
                <ProjectImage p={p} />
              </div>
            </DLink>
            <div className="flex flex-1 flex-col p-card">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="m-0 mb-0.5 text-lg font-semibold leading-snug">
                    <DLink to={`#/projects/${p.id}`} className="text-ink no-underline hover:underline" style={{ color: 'var(--ink)' }}>{p.name}</DLink>
                  </h2>
                  <span className="block min-h-[2.6em] text-[13px] leading-snug text-ink-3">{p.kind} · {p.city}</span>
                </div>
                <Pill>{p.status === 'finished' ? 'Finished' : PHASES[p.phase]}</Pill>
              </div>
              <div className="my-3 flex h-[5px] gap-[5px]" aria-label={`Phase: ${PHASES[p.phase]}`}>
                {PHASES.map((phase, i) => (
                  <span key={phase} title={phase} className={`flex-1 rounded-sm ${i <= p.phase ? 'bg-accent' : 'bg-surface-3'}`} />
                ))}
              </div>
              <div className="grid gap-0.5 rounded-r2 bg-surface-2 px-3 py-2.5 text-[15px]">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">Next milestone</span>
                <b>{milestone ? milestone.name : 'No upcoming milestone'}</b>
                {milestone && (
                  <small className={`text-sm ${milestone.date < TODAY ? 'text-crit' : 'text-ink-3'}`}>
                    {fmtD(milestone.date)}{milestone.date < TODAY ? ' · Overdue' : ''}
                  </small>
                )}
              </div>
              <div className="mt-auto flex flex-wrap items-start justify-between gap-gap border-t border-line pt-3 text-[13px] [&]:mt-3.5">
                <span>
                  {can('issue', 'r', role())
                    ? (issues.length ? `${issues.length} open issue${issues.length === 1 ? '' : 's'}` : 'No open issues')
                    : 'Project resources'}
                </span>
                <span className="text-right"><ProjectOwner p={p} /></span>
              </div>
              {can('budget', 'r', role()) && <div className="mt-3"><ProjectBudgetStatus p={p} /></div>}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function ProjectList({ status }) {
  const all = svc.projects();
  const ps = status === 'all' ? all : all.filter((p) => (p.status || 'active') === status);
  const chip = (k, l) => (
    <DLink key={k} to={`#/projects?status=${k}`} aria-current={status === k ? 'true' : undefined} className={`inline-flex min-h-9 items-center px-4 text-[13px] font-semibold no-underline ${status === k ? 'bg-accent' : 'bg-surface hover:bg-surface-2'}`} style={{ color: status === k ? 'var(--accent-ink)' : 'var(--ink-2)' }}>{l}</DLink>
  );
  const budget = can('budget', 'r', role());
  return (
    <>
      <PageHeader title="Projects" sub="Every job in the studio, with its next milestone and budget status.">
        <div className="inline-flex divide-x divide-line-2 overflow-hidden rounded-r1 border border-line-2" role="group" aria-label="Project status">{chip('active', 'Active')}{chip('finished', 'Finished')}{chip('all', 'All')}</div>
        {can('project', 'w', role()) && (
          <Btn kind="primary" onClick={() => openDesktopTemplate()}>New from template</Btn>
        )}
      </PageHeader>
      <ProjectCards projects={ps} />
      <details className="group mb-3.5 rounded-r3 border border-line bg-surface px-card">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 font-semibold text-ink-2 hover:text-accent-text [&::-webkit-details-marker]:hidden"><svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-ink-3 transition group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>Project list · owners and deadlines</summary>
        <div className="pb-card">
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
        </div>
      </details>
      <details className="group mb-3.5 rounded-r3 border border-line bg-surface px-card">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 font-semibold text-ink-2 hover:text-accent-text [&::-webkit-details-marker]:hidden">
          <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-ink-3 transition group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
          Compare project details{budget ? ' · team and budget' : ' · team and phase'}
        </summary>
        <div className="pb-card">
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
        </div>
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

const navLink = '-mb-px flex min-h-11 items-center whitespace-nowrap border-b-2 px-3.5 py-2.5 font-medium no-underline hover:text-accent-text';
function ProjectTabs({ projectId, list, current }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const frequent = ['overview', 'tasks', 'drawings', 'files', 'decisions'];
  const direct = [...frequent, ...(!frequent.includes(current) ? [current] : [])]
    .map((key) => list.find(([id]) => id === key)).filter(Boolean);
  // Close the menu after choosing a tool, on Escape, and on a click anywhere else.
  useEffect(() => { setOpen(false); }, [current, projectId]);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
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
    const entries = list.filter(([key]) => keys.includes(key) && !frequent.includes(key));
    return entries.length ? { label, entries } : null;
  }).filter(Boolean);
  // Spread the groups over three columns by size so the menu has no empty gaps.
  const balanced = [[], [], []];
  const sizes = [0, 0, 0];
  more.forEach((g) => {
    const i = sizes.indexOf(Math.min(...sizes));
    balanced[i].push(g);
    sizes[i] += g.entries.length + 1;
  });
  const used = balanced.filter((c) => c.length);
  return (
    <nav className="mb-5 border-b border-line" aria-label="Project sections">
      <div className="flex flex-wrap items-stretch gap-1">
        {direct.map(destination)}
        {more.length > 0 && (
          <div ref={box} className="relative">
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className={`-mb-px flex min-h-11 cursor-pointer items-center gap-1.5 border-0 border-b-2 border-transparent bg-transparent px-3.5 py-2.5 font-medium hover:text-accent-text ${open ? 'text-accent-text' : 'text-ink-2'}`}
            >
              More project tools
              <svg viewBox="0 0 24 24" className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {open && (
              <div className="absolute left-0 top-full z-20 mt-1.5 w-[min(720px,calc(100vw-2rem))] max-md:fixed max-md:inset-x-4 max-md:top-auto max-md:w-auto rounded-r3 border border-line bg-surface p-3 shadow-s2">
                <div className="grid gap-3 md:grid-cols-3">
                  {used.map((col, ci) => (
                    <div key={ci} className="flex min-w-0 flex-col gap-3">
                  {col.map(({ label, entries }) => (
                    <section key={label} className="rounded-r2 bg-surface-2 p-2.5 last:flex-1">
                      <h3 className="m-0 px-2 pb-1.5 pt-0.5 font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-text">{label}</h3>
                      {entries.map(([key, l]) => (
                        <DLink
                          key={key}
                          to={`#/projects/${projectId}?tab=${key}`}
                          onClick={() => setOpen(false)}
                          aria-current={current === key ? 'page' : undefined}
                          className={`flex items-center justify-between gap-2 rounded-r1 px-2 py-1.5 text-[14px] no-underline hover:bg-surface ${current === key ? 'bg-surface font-semibold' : ''}`}
                          style={{ color: current === key ? 'var(--accent-text)' : 'var(--ink)' }}
                        >
                          {l}
                          {current === key && <span className="h-1.5 w-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />}
                        </DLink>
                      ))}
                    </section>
                  ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
      <header className="mb-5 rounded-r3 border border-line bg-surface p-card">
        <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-3">
          <DLink to="#/projects" className="text-accent-text no-underline hover:underline">Projects</DLink>
          <span aria-hidden="true">/</span>
          <span>{p.code}</span>
          <span className="ml-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-text">{PHASES[p.phase]}</span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-gap-lg">
          <div className="min-w-[230px] flex-1">
            <h1 className="m-0 text-title font-semibold leading-tight tracking-tight">{p.name}</h1>
            <p className="mb-0 mt-2 text-[13px] leading-relaxed text-ink-3">
              {p.kind} · {p.area} · {p.city} · Client {name(p.clientId)}
              {finished && <> · <Pill kind="soft">Finished {fmtD(p.finishedAt)}</Pill> hidden from phones</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[13px] [&_a]:inline-flex [&_a]:min-h-9 [&_a]:items-center [&_a]:rounded-r1 [&_a]:border [&_a]:border-line-2 [&_a]:bg-surface [&_a]:px-3.5 [&_a]:font-semibold [&_a]:no-underline hover:[&_a]:border-accent hover:[&_a]:bg-accent-soft">
            {site && <SiteLink id={site.id}>Open site</SiteLink>}
            <ChatLink thread={thread}>Open chat</ChatLink>
            {role() === 'partner' && (
              <details className="group relative">
                <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 whitespace-nowrap rounded-r1 border border-line-2 bg-surface px-3.5 font-semibold text-accent-text hover:border-accent hover:bg-accent-soft [&::-webkit-details-marker]:hidden">
                  Project actions
                  <svg viewBox="0 0 24 24" className="h-4 w-4 transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </summary>
                <div className="absolute right-0 top-11 z-10 w-[260px] max-w-[calc(100vw-40px)] rounded-r3 border border-line bg-surface p-4 shadow-s2">
                  <p className="mb-3 mt-0 text-sm text-ink-2">
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
      <div className="min-w-0 [&_.grid>*]:min-w-0"><Tab p={p} /></div>
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
