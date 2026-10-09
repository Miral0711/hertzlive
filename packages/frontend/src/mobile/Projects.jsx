import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../shared/store';
import { TODAY } from '../shared/data';
import Icon from './Icon';
import { backName } from './frame';
import { WorkRow, finishTask } from './ProjectPages';
import {
  svc, projectOf, siteFor, openIssues, projectNeeds, nextDeadline, me, firstName, can, audience, state, onPhone,
  fmtD, phoneDrawings,
} from './model';
import { t } from './copy';
import { Avatar, ThreadAvatar } from './faces';
import { photoUrl } from '../ui/Ph';

function Tile({ to, href, icon, title, meta, tone }) {
  const cls = `proj-tile${tone ? ` ${tone}` : ''}`;
  const inner = (
    <>
      <span className="ic-well"><Icon name={icon} /></span>
      <b>{title}</b>
      <span>{meta}</span>
    </>
  );
  if (href) return <a className={cls} href={href} target="_blank" rel="noopener noreferrer">{inner}</a>;
  return <Link className={cls} to={to}>{inner}</Link>;
}

function MenuLink({ to, href, icon, title, meta }) {
  const inner = (
    <>
      <span className="ic-well"><Icon name={icon} /></span>
      <span className="proj-row-copy"><b>{title}</b><span>{meta}</span></span>
      <Icon name="chev" />
    </>
  );
  if (href) return <a className="proj-row" href={href} target="_blank" rel="noopener noreferrer">{inner}</a>;
  if (to) return <Link className="proj-row" to={to}>{inner}</Link>;
  return <div className="proj-row">{inner}</div>;
}

export default function Projects() {
  useStore();
  const [query, setQuery] = useState('');
  const list = svc.projects().filter((p) => onPhone(p.id));
  const person = me();
  const q = query.trim().toLowerCase();
  const shown = q
    ? list.filter((p) => {
      const site = siteFor(p.id);
      return [p.name, p.code, p.city, site?.stage, p.kind].filter(Boolean).join(' ').toLowerCase().includes(q);
    })
    : list;

  return (
    <div className="screen">
      <header className="top">
        <h1>{t('projects')}<span>Drawings, people and site work</span></h1>
        <Link className="icon-btn" to="/mobile/profile?from=%2Fmobile%2Fprojects" aria-label="Profile">
          <Avatar person={person} size="sm" />
        </Link>
      </header>
      <div className="body canvas proj proj-board">
        {list.length > 1 && (
          <label className="search project-search">
            <Icon name="search" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects" aria-label="Search projects" />
          </label>
        )}
        {shown.map((p) => {
          const site = siteFor(p.id);
          const issues = openIssues(p.id);
          const due = nextDeadline(p);
          const late = due && due.date < TODAY;
          const drawings = p.drawings || [];
          return (
            <Link key={p.id} className={`project${late ? ' late' : ''}`} to={`/mobile/projects/${p.id}`}>
              <span className="project-id photo" aria-hidden="true"><img src={photoUrl(p.hue, p.id)} alt="" /></span>
              <span className="project-copy">
                <b>{p.name}</b>
                <span className="project-line">{p.code}{p.city ? ` · ${p.city}` : ''}</span>
                <span className="project-pills">
                  <span className="pill kind">{site ? site.stage : p.kind}</span>
                  {can('drawing', 'r') && drawings.length ? <span className="pill">{drawings.length === 1 ? '1 drawing' : `${drawings.length} drawings`}</span> : null}
                  {can('issue', 'r') ? (
                    <span className={`pill${issues.length ? ' open' : ' ok'}`}>{issues.length ? `${issues.length} open` : 'Clear'}</span>
                  ) : null}
                </span>
                {due ? <span className={`project-due${late ? ' late' : ''}`}>{due.title} · {late ? 'overdue' : 'due'} {fmtD(due.date)}</span> : null}
              </span>
              <Icon name="chev" />
            </Link>
          );
        })}
        {list.length > 0 && !shown.length && <div className="empty"><h3>No project matches</h3></div>}
        {!list.length && <div className="empty"><h3>No projects for this login</h3><p>Your role only sees the work assigned to you.</p></div>}
        <div className="proj-card">
          <MenuLink to="/mobile/photos" icon="photos" title="All project photos" meta="Browse across your projects" />
          {state.role === 'client' ? <MenuLink to="/mobile/portfolio" icon="photos" title="Studio portfolio" meta="Completed work" /> : null}
        </div>
      </div>
    </div>
  );
}

export function Project() {
  useStore();
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const from = params.get('from');
  const backTo = from && from.startsWith('/mobile/') ? from : '/mobile/projects';
  const project = projectOf(projectId);
  if (!project || !onPhone(project.id)) {
    return (
      <div className="screen">
        <header className="top"><Link className="icon-btn" to="/mobile/projects"><Icon name="back" /><span>Projects</span></Link><h1>Project</h1></header>
        <div className="empty"><h3>This project isn’t available</h3></div>
      </div>
    );
  }
  const site = siteFor(project.id);
  const work = projectNeeds(project.id);
  const threads = svc.threads().filter((t) => t.projectId === project.id);
  const materials = svc.materials({ projectId: project.id });
  const drawings = can('drawing', 'r') ? (project.drawings || []) : [];
  const siteChat = svc.threads().find((item) => item.kind === 'site' && item.projectId === project.id);
  const postThread = svc.threads().find((item) => item.kind === 'site' && item.projectId === project.id && (item.memberIds || []).includes(state.userId));
  const changes = svc.projectUpdates({ projectId: project.id });
  const studio = state.role !== 'client' ? svc.brainstorm(project.id) : null;
  const office = !['client', 'contractor'].includes(state.role);
  const lastFeed = site && can('feed', 'r') ? svc.feed(site.id)[0] : null;
  const issueCount = can('issue', 'r') ? openIssues(project.id).length : null;
  const waitingMats = materials.filter((m) => m.status === 'client_pending').length;
  const indexCount = can('drawing', 'r') ? svc.drawingIndex(project.id).length : 0;
  const due = nextDeadline(project);
  const late = due && due.date < TODAY;
  const here = `/mobile/projects/${project.id}`;
  const chatTo = (id) => `/mobile/chats/${id}?from=${encodeURIComponent(here)}`;
  const groups = [
    {
      title: 'Work',
      items: [
        { to: `/mobile/photos?project=${project.id}`, icon: 'photos', title: 'Photos', meta: 'Filed site updates' },
        can('drawing', 'r') && { to: `${here}/drawings`, icon: 'drawing', title: 'Drawings', meta: `${drawings.length} shared` },
        can('material', 'r') && { to: `${here}/materials`, icon: 'sample', title: 'Materials', meta: waitingMats ? `${waitingMats} waiting on the client` : `${materials.length} shared`, tone: waitingMats ? 'wait' : '' },
        { to: `${here}/changes`, icon: 'change', title: 'Changes', meta: changes.length ? `${changes.length} recorded` : 'Recorded' },
        { to: `${here}/attention`, icon: 'warn', title: 'Needs you', meta: work.length ? `${work.length} open` : 'Nothing waiting', tone: work.length ? 'hot' : '' },
        { to: `${here}/people`, icon: 'people', title: 'People', meta: 'Contacts' },
      ].filter(Boolean),
    },
    {
      title: 'Records',
      items: [
        can('drawing', 'r') && { to: `${here}/index`, icon: 'drawing', title: 'Drawing index', meta: `${indexCount} sheets` },
        can('ref', 'r') && { to: `${here}/refs`, icon: 'star', title: 'References', meta: `${svc.clientRefs(project.id).length} saved` },
        can('intake', 'r') && { to: `${here}/intake`, icon: 'check', title: 'Client data checklist', meta: `${svc.intake(project.id).length} items` },
        can('share', 'r') && { to: `${here}/share`, icon: 'clip', title: 'Share a link', meta: 'Expiring web link' },
      ].filter(Boolean),
    },
    {
      title: 'Studio',
      items: [
        studio && { to: chatTo(studio.id), icon: 'chat', title: 'Studio chat', meta: 'The client never sees it' },
        office && project.driveFolder && svc.connection('google') && { href: project.driveFolder, icon: 'folder', title: 'Drive archive', meta: 'Older folders' },
        office && project.canvaDeck && svc.connection('canva') && { href: project.canvaDeck, icon: 'samples', title: 'Concept deck', meta: 'Opens in Canva' },
        svc.assistKinds().includes('client') && threads.some((item) => item.kind === 'client') && { to: `${here}/assist?kind=client`, icon: 'send', title: 'Client update', meta: 'From this chat' },
        svc.assistKinds().includes('concept') && { to: `${here}/assist?kind=concept`, icon: 'ai', title: 'Finish ideas', meta: 'From a photo' },
      ].filter(Boolean),
    },
  ].filter((group) => group.items.length);

  return (
    <div className="screen">
      <header className="top thread-top proj-top">
        <Link className="icon-btn" to={backTo} aria-label={`Back to ${from ? backName(backTo) : 'projects'}`}>
          <Icon name="back" />
        </Link>
        <div className="thread-heading">
          <h1>{project.name}</h1>
          <span>{project.code} · {project.city}</span>
        </div>
      </header>
      <div className="body canvas proj proj-board">
        <div className="proj-cover">
          <img src={photoUrl(project.hue, project.id)} alt="" />
          <div className="proj-cover-bar"><span>{site ? site.stage : project.kind}</span></div>
        </div>
        <div className="proj-stats">
          {can('drawing', 'r') && (
            <div className="proj-stat"><b>{drawings.length}</b><span>{drawings.length === 1 ? 'Drawing' : 'Drawings'}</span></div>
          )}
          {issueCount != null && (
            <div className={`proj-stat${issueCount ? ' open' : ' ok'}`}><b>{issueCount || 'None'}</b><span>{issueCount ? 'Open issues' : 'Issues clear'}</span></div>
          )}
          {due && (
            <div className={`proj-stat${late ? ' late' : ''}`}>
              <b>{fmtD(due.date)}</b>
              <span>{late ? 'Overdue' : 'Next due'}</span>
            </div>
          )}
        </div>
        {due && <p className={`proj-next${late ? ' late' : ''}`}>{due.title}</p>}
        {work.length > 0 && (
          <section className="proj-attention">
            <div className="section-head">
              <h2>Needs you here</h2>
              {work.length > 3 && <Link to={`/mobile/projects/${project.id}/attention`}>View all {work.length}</Link>}
            </div>
            <div className="proj-card warm">
              {work.slice(0, 3).map((item) => <WorkRow key={item.key} item={item} onDone={finishTask} />)}
            </div>
          </section>
        )}
        {postThread && can('thread', 'w') && (
          <Link className="proj-post" to={`/mobile/camera?thread=${postThread.id}&from=${encodeURIComponent(`/mobile/projects/${project.id}`)}`}>
            <span className="ic-well on-accent"><Icon name="camera" /></span>
            <span><b>Post a site update</b><span>Photo, voice, delivery or attendance</span></span>
          </Link>
        )}
        {groups.map((group) => (
          <section key={group.title}>
            <h2>{group.title}</h2>
            {group.title === 'Work' ? (
              <div className="proj-tiles">
                {group.items.map((item) => <Tile key={item.title} {...item} />)}
              </div>
            ) : (
              <div className="proj-card">
                {group.items.map((item) => <MenuLink key={item.title} {...item} />)}
              </div>
            )}
          </section>
        ))}
        {changes.length > 0 && (
          <section>
            <div className="section-head">
              <h2>Recent changes</h2>
              {changes.length > 2 && <Link to={`/mobile/projects/${project.id}/changes`}>View all {changes.length}</Link>}
            </div>
            <div className="proj-card">
              {changes.slice(0, 2).map((u) => {
                const inner = (
                  <div>
                    <small>{u.kind} · {fmtD(u.at)}</small>
                    <b>{u.title}</b>
                    <span>{u.detail}</span>
                  </div>
                );
                return u.source?.threadId ? (
                  <Link key={u.id} className="day-row" to={chatTo(u.source.threadId)}>{inner}</Link>
                ) : (
                  <div key={u.id} className="day-row">{inner}</div>
                );
              })}
            </div>
          </section>
        )}
        <section id="conversations">
          <h2>Conversations</h2>
          {threads.length ? (
            <div className="proj-card">
              {threads.map((thread) => (
                <Link key={thread.id} className="proj-row" to={chatTo(thread.id)}>
                  <ThreadAvatar thread={thread} size="sm" />
                  <span className="proj-row-copy"><b>{audience(thread)}</b><span>{thread.name}</span></span>
                  <Icon name="chev" />
                </Link>
              ))}
            </div>
          ) : <p className="note">No conversations for you on this project.</p>}
        </section>
        {site && can('site', 'r') && (
          <section>
            <h2>Site</h2>
            <div className="proj-card">
              {siteChat ? (
                <Link className="day-row" to={chatTo(siteChat.id)}>
                  <div>
                    <b>{site.name}</b>
                    <span>{site.stage}{site.address || site.location ? ` · ${site.address || site.location}` : ''}</span>
                    {issueCount != null && <span>{issueCount ? `${issueCount} open` : 'No open issues'}</span>}
                    {lastFeed && <span>Last update {fmtD(lastFeed.at)} · {firstName(lastFeed.by)}</span>}
                    {site.managerId && <span>Site manager {firstName(site.managerId)}</span>}
                  </div>
                </Link>
              ) : (
                <div className="day-row">
                  <div>
                    <b>{site.name}</b>
                    <span>{site.stage}</span>
                    {issueCount != null && <span>{issueCount ? `${issueCount} open` : 'No open issues'}</span>}
                    {lastFeed && <span>Last update {fmtD(lastFeed.at)} · {firstName(lastFeed.by)}</span>}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
        {svc.assistKinds().includes('ask') && (
          <Link className="proj-ask" to={`/mobile/projects/${project.id}/assist?kind=ask`}>
            <span className="ic-well"><Icon name="ai" /></span>
            <span className="proj-row-copy"><b>Ask about this project</b><span>Answers from shared records</span></span>
          </Link>
        )}
      </div>
    </div>
  );
}

export function Drawings() {
  useStore();
  const { projectId } = useParams();
  const project = projectOf(projectId);
  const allowed = project && onPhone(project.id) && can('drawing', 'r');
  const drawings = allowed ? (project.drawings || []) : [];
  return (
    <div className="screen">
      <header className="top thread-top proj-top">
        <Link className="icon-btn" to={`/mobile/projects/${projectId}`} aria-label="Back to project">
          <Icon name="back" />
        </Link>
        <div className="thread-heading">
          <h1>Drawings</h1>
          <span>{project?.name}</span>
        </div>
      </header>
      <div className="body canvas proj proj-board">
        {!allowed && <div className="empty"><h3>Drawings aren’t available for this login</h3></div>}
        {allowed && <p className="note">Check the revision and purpose before anyone builds from it.</p>}
        {allowed && ['saved', 'recent'].map((kind) => {
          const quick = phoneDrawings(projectId, kind).slice(0, kind === 'saved' ? 100 : 3);
          if (!quick.length) return null;
          return (
            <section key={kind}>
              <h2>{kind === 'saved' ? 'Saved by you' : 'Recently opened'}</h2>
              {quick.map((x) => (
                <Link key={x.no} className="drawing" to={`/mobile/projects/${projectId}/drawings/${encodeURIComponent(x.no)}`}>
                  <span className="rev">{x.d.rev}</span>
                  <div>
                    <b>{x.d.name}</b>
                    <span>{x.d.rev} · {x.d.status}</span>
                    {x.rev !== x.d.rev && <em className="revision-change">Register changed since {x.rev}. Review before use.</em>}
                  </div>
                </Link>
              ))}
            </section>
          );
        })}
        {allowed && drawings.length > 0 && <h2>All drawings</h2>}
        {drawings.map((d) => (
          <Link key={d.no} className="drawing" to={`/mobile/projects/${projectId}/drawings/${encodeURIComponent(d.no)}`}>
            <span className="rev">{d.rev}</span>
            <div>
              <b>{d.name}</b>
              <span>{d.no}</span>
              <em className={d.status === 'Issued for construction' ? 'issued' : ''}>{d.status || 'Purpose not recorded'}</em>
            </div>
          </Link>
        ))}
        {allowed && !drawings.length && <div className="empty"><h3>No drawings shared</h3></div>}
      </div>
    </div>
  );
}
