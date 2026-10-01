import { state, svc, can, toast, persist, render, uid, go, fmtD, tenantProjectImage, safeAssetUrl } from '../../shared/core.js';
import { TODAY, PHASES } from '../../shared/data.js';
import { Btn, Card, DataTable, Input, Pill, StatusPill } from '../../ui/ui';
import Icon from '../../ui/Icon';
import { DLink } from '../nav';
import { filedRows } from '../parts';
import { P, first, name } from '../helpers';
import { formData, openDialog } from '../session';
import { AssistTools, ProjectUpdates } from '../chat/assist';
import {
  role, staff, projectMilestones, FromChat, Ph, Photos, Figure, Sub, H2, H3, Muted, Details, FormRow, openIssues,
} from './common';

// ---------- actions ----------
function vastuAdd(e, projectId) {
  e.preventDefault();
  const p = formData(e.currentTarget);
  e.currentTarget.reset();
  const pr = P(projectId);
  (pr.vastu = pr.vastu || []).push({ room: p.room.trim(), note: p.note.trim() });
  persist();
  toast('Note added. Client can read it on the project page.');
  render();
}
function vastuDel(projectId, i) {
  P(projectId).vastu.splice(i, 1);
  persist();
  render();
}
function decisionAdd(e, projectId) {
  e.preventDefault();
  const p = formData(e.currentTarget);
  e.currentTarget.reset();
  const proj = P(projectId);
  const t = svc.threads().find((x) => x.kind === 'client' && x.projectId === proj.id);
  state.db.DECISIONS_DUE.push({
    id: uid(), projectId: proj.id, threadId: t?.id, title: p.title, due: p.due, status: 'open', askedBy: state.userId,
  });
  if (t) svc.addMessage(t.id, { text: p.title });
  persist();
  toast('Decision asked.');
  render();
}
function decisionDone(id) {
  svc.decideDecision(id);
  toast('Marked decided.');
  render();
}
// The review page (owned by another module) takes over at #/review/<id>.
function reviewIssue(id) {
  if (!svc.siteIssueDetails(id)) return;
  state.desk.dialog = null;
  go(`#/review/${encodeURIComponent(id)}`);
}

// ---------- Vastu ----------
function VastuCard({ p }) {
  const v = p.vastu || [];
  if (!v.length && !staff()) return null;
  return (
    <Card title="Vastu notes">
      <Sub>{staff() ? 'Architect fills, client reads. Text only, nothing is checked by the app.' : 'Notes from your architect.'}</Sub>
      {v.length ? (
        <div className="flex flex-col gap-1.5">
          {v.map((x, i) => (
            <div key={i} className="flex min-h-11 items-center gap-3 rounded-r2 border border-line bg-surface px-3.5 py-2.5">
              <b>{x.room}</b>
              <span className="min-w-0 flex-1">{x.note}</span>
              {staff() && <Btn sm onClick={() => vastuDel(p.id, i)}>Remove</Btn>}
            </div>
          ))}
        </div>
      ) : <p className="text-ink-3">No notes yet.</p>}
      {staff() && (
        <FormRow onSubmit={(e) => vastuAdd(e, p.id)}>
          <Input name="room" placeholder="Room" required style={{ width: 140 }} aria-label="Room" />
          <Input name="note" placeholder="Note for the client" required aria-label="Note" />
          <Btn type="submit">Add note</Btn>
        </FormRow>
      )}
    </Card>
  );
}

// ---------- attention ----------
function Row({ children, action }) {
  return (
    <div className="border-t border-line py-3">
      {children}
      <div className="mt-2">{action}</div>
    </div>
  );
}
const RowText = ({ title, children }) => (
  <span className="min-w-0">
    <b className="block font-medium">{title}</b>
    <small className="mt-1 block text-[13px] text-ink-2">{children}</small>
  </span>
);
const Eyebrow = ({ children }) => <p className="m-0 mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">{children}</p>;

function ProjectAttention({ p, issues, decisions }) {
  const lead = issues.find((i) => {
    const d = svc.siteIssueDetails(i.id);
    return d?.canAnswer && d.needsAnswer;
  });
  const detail = lead && svc.siteIssueDetails(lead.id);
  const source = detail?.sources.at(-1);
  const groups = new Map();
  const add = (label, row) => groups.set(label, [...(groups.get(label) || []), row]);
  for (const i of issues.filter((i) => i !== lead)) {
    const d = svc.siteIssueDetails(i.id);
    const latest = d?.answers.at(-1);
    const label = d?.needsAnswer
      ? (d.canAnswer ? 'Needs our answer' : 'Awaiting office response')
      : latest && !latest.siteAnswer.response ? 'Waiting on site' : 'Open issues';
    const action = d
      ? <Btn sm onClick={() => reviewIssue(i.id)}>{d.canAnswer && d.needsAnswer ? 'Review / reply' : 'View issue'}</Btn>
      : <DLink to={`#/sites/${encodeURIComponent(i.siteId)}?tab=issues&filter=open&record=${encodeURIComponent(i.id)}`} className="text-[13px] text-accent-text underline">View issue</DLink>;
    const site = svc.site(i.siteId);
    add(label, (
      <Row key={i.id} action={action}>
        <RowText title={i.title}>
          {i.assignee ? name(i.assignee) : 'Owner not assigned'} · {i.due ? 'Due ' + fmtD(i.due) : 'Due date not set'}{site ? ' · ' + site.name : ''}
          {label === 'Waiting on site' && <small className="mt-1 block">Office answer sent · acknowledgement pending</small>}
        </RowText>
      </Row>
    ));
  }
  for (const d of decisions) {
    add('Client decisions', (
      <Row key={d.id} action={<Btn sm onClick={() => viewDecision(d.id)}>View decision</Btn>}>
        <RowText title={d.title}>
          Decision: {name(p.clientId)} · {d.due ? 'Due ' + fmtD(d.due) : 'Due date not set'}<br />Requested by {name(d.askedBy)}
        </RowText>
      </Row>
    ));
  }
  const remainder = ['Needs our answer', 'Awaiting office response', 'Waiting on site', 'Open issues', 'Client decisions']
    .filter((label) => groups.has(label))
    .map((label) => {
      const rows = groups.get(label);
      return (
        <section key={label}>
          <h2 className="mb-2 mt-0 text-[15px] font-semibold">{label} <Muted>{rows.length}</Muted></h2>
          {rows.slice(0, 2)}
          {rows.length > 2 && (
            <details className="group">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 py-2 font-semibold text-accent-text hover:underline [&::-webkit-details-marker]:hidden"><svg viewBox="0 0 24 24" className="h-4 w-4 flex-none transition group-open:rotate-90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>Show {rows.length - 2} more</summary>
              {rows.slice(2)}
            </details>
          )}
        </section>
      );
    });
  const leadBlock = lead && (
    <section className="min-w-0">
      <Eyebrow>Needs our answer{lead.due ? ' · earliest due question' : ''}</Eyebrow>
      <h2 className="mb-3 mt-2 text-[24px] font-semibold leading-tight">{lead.title}</h2>
      <p className="my-2 text-base leading-relaxed text-ink-2">
        “{(source.transcript || source.text || 'Photo update').slice(0, 240)}”
      </p>
      <p className="text-ink-3">
        {name(source.by)} · {svc.site(lead.siteId)?.name || p.name}{lead.due ? ' · Due ' + fmtD(lead.due) : ' · Due date not set'}
      </p>
      <Btn kind="primary" className="mt-2" onClick={() => reviewIssue(lead.id)}>Review and reply <Icon name="chev" small /></Btn>
    </section>
  );
  if (lead) {
    // Lead question and the first group sit on the left; the remaining groups fill the right column.
    const [firstGroup, ...restGroups] = remainder;
    return (
      <div className={`grid gap-gap-lg ${remainder.length ? 'lg:grid-cols-2' : ''} [&>*]:min-w-0`}>
        <div className="flex flex-col gap-gap-lg">
          {leadBlock}
          {firstGroup && <div className="border-t border-line pt-4"><Eyebrow>Also in this project</Eyebrow><div className="mt-2">{firstGroup}</div></div>}
        </div>
        {restGroups.length > 0 && (
          <div className="grid content-start gap-gap-lg border-t border-line pt-4 lg:border-l lg:border-t-0 lg:pl-gap-lg lg:pt-0">{restGroups}</div>
        )}
      </div>
    );
  }
  const cols = { 1: '', 2: 'md:grid-cols-2', 3: 'md:grid-cols-2 lg:grid-cols-3' }[Math.min(remainder.length, 3)] || 'md:grid-cols-2 lg:grid-cols-3';
  return remainder.length
    ? <div className={`grid gap-gap-lg ${cols}`}>{remainder}</div>
    : <p className="text-ink-3">No issue or client-decision records to show.</p>;
}
function viewDecision(id) {
  if (!svc.decisionsDue({ all: true }).some((d) => d.id === id && svc.thread(d.threadId))) return;
  openDialog({ kind: 'project-decision', id });
}

// ---------- overview ----------
export function OverviewTab({ p }) {
  const filedPhotos = filedRows({ projectId: p.id, kind: 'photo' });
  const referenceImage = tenantProjectImage(p.id);
  const refSrc = referenceImage && safeAssetUrl(referenceImage.src);
  const milestones = projectMilestones(p);
  const pending = milestones.filter((m) => !m.done);
  const completed = milestones.filter((m) => m.done);
  const issues = openIssues(p.id).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const decisions = svc.decisionsDue({ projectId: p.id }).filter((d) => svc.thread(d.threadId))
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const upcomingTasks = staff() ? state.db.TASKS.filter((t) => t.projectId === p.id && t.status === 'open' && t.due) : [];
  const deadlines = [
    ...pending.filter((m) => m.date).map((m) => ({ title: m.name, date: m.date, owner: null, kind: 'Milestone', href: `#/projects/${p.id}` })),
    ...upcomingTasks.map((t) => ({ title: t.title, date: t.due, owner: t.owner, kind: 'Task', href: `#/projects/${p.id}?tab=tasks` })),
    ...issues.filter((i) => i.due).map((i) => ({ title: i.title, date: i.due, owner: i.assignee, kind: 'Issue', href: `#/sites/${p.siteId}?tab=${role() === 'contractor' ? 'feed' : 'issues'}` })),
    ...decisions.filter((d) => d.due).map((d) => ({ title: d.title, date: d.due, owner: p.clientId, kind: 'Client decision', href: `#/projects/${p.id}?tab=decisions` })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const next = deadlines[0];
  const milestoneTable = (rows) => (
    <DataTable
      cols={['Milestone', 'Date', 'Status', ...(staff() ? ['Client sees'] : [])]}
      rows={rows.map((m) => [
        <>{m.name}{m.muhurat && <> <Pill>muhurat</Pill></>}</>,
        fmtD(m.date),
        <StatusPill status={m.done ? 'done' : m.date < TODAY ? 'overdue' : 'planned'} />,
        ...(staff() ? [m.clientVisible ? 'Yes' : 'No'] : []),
      ])}
    />
  );
  const brief = state.db.BRIEFS?.[p.id];
  const dd = svc.decisionsDue({ projectId: p.id, all: true });
  return (
    <>
      <AssistTools projectId={p.id} />
      <section className="mb-5 rounded-r3 border border-line bg-surface p-5" aria-label="Current project priorities">
        <div className="mb-4 flex flex-wrap items-baseline gap-x-5 gap-y-2 border-b border-line pb-4">
          <h2 className="m-0 text-[13px] font-semibold text-ink-3">{next && next.date.slice(0, 10) < TODAY ? 'Oldest open deadline' : 'Next deadline'}</h2>
          {next ? (
            <>
              <p className="m-0 text-xl font-medium">
                {fmtD(next.date)}{next.date.slice(0, 10) < TODAY && <> <Pill kind="crit">Overdue</Pill></>}
              </p>
              <h3 className="m-0 text-lg font-semibold">{next.title}</h3>
              <p className="m-0 text-ink-3">{next.kind} · {next.owner ? name(next.owner) : 'Owner not assigned to milestone'}</p>
              {next.kind !== 'Milestone' && <DLink to={next.href} className="text-[13px] text-accent-text underline">View {next.kind.toLowerCase()}</DLink>}
            </>
          ) : <p className="m-0">No open deadlines recorded.</p>}
        </div>
        <div><ProjectAttention p={p} issues={issues} decisions={decisions} /></div>
      </section>
      <div className="mb-5 grid gap-5 md:grid-cols-2 [&>*]:h-full [&>*]:min-w-0">
        <ProjectUpdates projectId={p.id} />
        <Card>
          <h2 className="mb-2.5 mt-0 text-lg font-semibold">Project plan</h2>
          {p.canvaDeck && staff() && svc.connection('canva') && (
            <p><a className="inline-flex min-h-8 items-center rounded-r1 border border-line-2 px-2.5 text-[13px] font-semibold no-underline" href={p.canvaDeck} target="_blank" rel="noopener noreferrer">Open concept deck in Canva</a></p>
          )}
          <div className="mb-6 mt-2 grid grid-cols-5 gap-[3px] max-[620px]:grid-cols-1">
            {PHASES.map((n, i) => (
              <div key={n} className={`rounded p-[7px] text-[11px] max-[620px]:text-xs ${i < p.phase ? 'bg-accent-soft text-accent-text' : i === p.phase ? 'bg-accent font-semibold text-accent-ink' : 'bg-surface-2 text-ink-2'}`}>{n}</div>
            ))}
          </div>
          <H3>Upcoming milestones</H3>
          {pending.length ? milestoneTable(pending) : <p className="text-ink-3">No upcoming milestones.</p>}
          {completed.length > 0 && <Details summary={`Completed milestones · ${completed.length}`}>{milestoneTable(completed)}</Details>}
        </Card>
      </div>
      <Details summary="Project brief, research & Vastu notes" className="my-0 border-t border-line py-2">
        <Card className="mb-3.5">
          {refSrc && (
            <figure className="mb-5 mt-0 max-w-[600px]">
              <img src={refSrc} alt={referenceImage.alt} loading="lazy" className="block max-h-[220px] w-full rounded object-cover" onError={(e) => { e.currentTarget.closest('figure').hidden = true; }} />
              <figcaption className="mt-2 text-xs text-ink-3">Studio portfolio · reference image</figcaption>
            </figure>
          )}
          <H2>Research and options</H2>
          <DataTable
            cols={['Item', 'Status', 'Owner']}
            rows={p.rnd.filter((r) => staff() || r.clientVisible).map((r) => [r.name, r.status, first(r.owner)])}
          />
          {brief && (
            <>
              <H2>Brief</H2>
              <div className="flex flex-col gap-1.5">
                {Object.entries(brief).filter(([key]) => key !== 'budget' || can('budget', 'r', role())).map(([k, v]) => (
                  <div key={k} className="flex min-h-11 items-center gap-3 rounded-r2 border border-line bg-surface px-3.5 py-2.5">
                    <b>{k}</b><span className="min-w-0 flex-1">{Array.isArray(v) ? v.join(', ') : v}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
        <VastuCard p={p} />
      </Details>
      <Details summary={`Photos filed from chat · ${filedPhotos.length}`} className="my-0 border-t border-line py-2">
        <Card>
          {filedPhotos.length ? (
            <Photos>
              {filedPhotos.slice(0, 6).map((x) => (
                <Figure
                  key={x.m.id}
                  caption={<>{x.room || ''} {(x.m.text || '').slice(0, 60)} <FromChat msgId={x.m.id} /></>}
                >
                  <Ph hue={x.m.link?.hue || p.hue} seed={x.m.link?.seed || x.m.id.length * 7} />
                </Figure>
              ))}
            </Photos>
          ) : <div className="rounded-r2 bg-surface-2 p-7 text-center text-ink-3">Photos shared in chat will appear here by room.</div>}
        </Card>
      </Details>
      <Details summary="Client decision register & new request" className="my-0 border-t border-line py-2">
        <Card>
          <h2 className="mb-2.5 mt-0 text-lg font-semibold">Client decisions</h2>
          <DataTable
            cols={['Question', 'Due', 'Status', '']}
            rows={dd.map((d) => [
              d.title,
              fmtD(d.due),
              <StatusPill status={d.status === 'open' && d.late ? 'overdue' : d.status} />,
              d.status === 'open' && staff() ? <Btn sm onClick={() => decisionDone(d.id)}>Mark decided</Btn> : '',
            ])}
          />
          {staff() && can('thread', 'w') && (
            <FormRow onSubmit={(e) => decisionAdd(e, p.id)}>
              <Input name="title" placeholder="Ask for a decision" required aria-label="Decision question" />
              <Input type="date" name="due" required aria-label="Due" />
              <Btn sm type="submit">Ask</Btn>
            </FormRow>
          )}
        </Card>
      </Details>
    </>
  );
}
