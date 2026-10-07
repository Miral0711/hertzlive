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
        <Link className="icon-btn" to="/mobile/profile" aria-label="Profile">
          <Avatar person={person} size="sm" />
        </Link>
      </header>
      <div className="body canvas proj">
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
          return (
            <Link key={p.id} className="project" to={`/mobile/projects/${p.id}`}>
              <span className="project-id photo" aria-hidden="true"><img src={photoUrl(p.hue, p.id)} alt="" /></span>
              <span className="project-copy">
                <b>{p.name}</b>
                <small>{p.code}</small>
                <span className="stage">{site ? site.stage : p.kind}</span>
                <span className="meta">
                  {can('drawing', 'r') && (p.drawings || []).length
                    ? `${(p.drawings || []).length === 1 ? '1 drawing' : `${p.drawings.length} drawings`} · `
                    : ''}
                  {can('issue', 'r') ? (issues.length ? `${issues.length} open` : 'No open issues') : 'Open resources'}
                </span>
                {due && <span className="meta">{due.title} · {due.date < TODAY ? 'overdue' : 'due'} {fmtD(due.date)}</span>}
              </span>
              <Icon name="chev" />
            </Link>
          );
        })}
        {list.length > 0 && !shown.length && <div className="empty"><h3>No project matches</h3></div>}
        {!list.length && <div className="empty"><h3>No projects for this login</h3><p>Your role only sees the work assigned to you.</p></div>}
        <Link className="row" to="/mobile/photos"><span className="av"><Icon name="photos" /></span><span className="row-copy"><b>All project photos</b><span>Browse across your projects</span></span></Link>
        {state.role === 'client' && <Link className="row" to="/mobile/portfolio"><span className="av"><Icon name="photos" /></span><span className="row-copy"><b>Studio portfolio</b><span>Completed work</span></span></Link>}
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
  const here = `/mobile/projects/${project.id}`;
  const chatTo = (id) => `/mobile/chats/${id}?from=${encodeURIComponent(here)}`;
  const groups = [
    {
      title: 'Work',
      items: [
        { to: `/mobile/photos?project=${project.id}`, title: 'Photos', meta: 'Filed site updates' },
        can('drawing', 'r') && { to: `${here}/drawings`, title: 'Drawings', meta: `${drawings.length} shared` },
        can('material', 'r') && { to: `${here}/materials`, title: 'Materials', meta: waitingMats ? `${materials.length} shared · ${waitingMats} waiting on the client` : `${materials.length} shared` },
        { to: `${here}/changes`, title: 'Changes', meta: changes.length ? `${changes.length} recorded` : 'Recorded' },
        { to: `${here}/attention`, title: 'Needs you', meta: work.length ? `${work.length} open` : 'Nothing waiting' },
        { to: `${here}/people`, title: 'People', meta: 'Contacts' },
      ].filter(Boolean),
    },
    {
      title: 'Records',
      items: [
        can('drawing', 'r') && { to: `${here}/index`, title: 'Drawing index', meta: `${indexCount} sheets` },
        can('ref', 'r') && { to: `${here}/refs`, title: 'References', meta: `${svc.clientRefs(project.id).length} saved` },
        can('intake', 'r') && { to: `${here}/intake`, title: 'Client data checklist', meta: `${svc.intake(project.id).length} items` },
        can('share', 'r') && { to: `${here}/share`, title: 'Share a link', meta: 'Expiring web link' },
      ].filter(Boolean),
    },
    {
      title: 'Studio',
      items: [
        studio && { to: chatTo(studio.id), title: 'Studio chat', meta: 'The client never sees it' },
        office && project.driveFolder && svc.connection('google') && { href: project.driveFolder, title: 'Drive archive', meta: 'Older folders' },
        office && project.canvaDeck && svc.connection('canva') && { href: project.canvaDeck, title: 'Concept deck', meta: 'Opens in Canva' },
        svc.assistKinds().includes('client') && threads.some((item) => item.kind === 'client') && { to: `${here}/assist?kind=client`, title: 'Client update', meta: 'From this chat' },
        svc.assistKinds().includes('concept') && { to: `${here}/assist?kind=concept`, title: 'Finish ideas', meta: 'From a photo' },
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
      <div className="body canvas proj">
        <p className="place">{site ? site.stage : project.kind}</p>
        {work.length > 0 && (
          <section>
            <div className="section-head">
              <h2>Needs you here</h2>
              {work.length > 3 && <Link to={`/mobile/projects/${project.id}/attention`}>View all {work.length}</Link>}
            </div>
            {work.slice(0, 3).map((item) => <WorkRow key={item.key} item={item} onDone={finishTask} />)}
          </section>
        )}
        {postThread && can('thread', 'w') && (
          <Link className="day-row" to={`/mobile/camera?thread=${postThread.id}&from=${encodeURIComponent(`/mobile/projects/${project.id}`)}`}>
            <b>Post a site update</b>
            <span>Photo, voice, delivery or attendance</span>
          </Link>
        )}
        {groups.map((group) => (
          <section key={group.title}>
            <h2>{group.title}</h2>
            {group.items.map((item) => {
              const inner = (<><b>{item.title}</b><span>{item.meta}</span></>);
              return item.href
                ? <a key={item.title} className="day-row" href={item.href} target="_blank" rel="noopener noreferrer">{inner}</a>
                : <Link key={item.title} className="day-row" to={item.to}>{inner}</Link>;
            })}
          </section>
        ))}
        {changes.length > 0 && (
          <section>
            <div className="section-head">
              <h2>Recent changes</h2>
              {changes.length > 2 && <Link to={`/mobile/projects/${project.id}/changes`}>View all {changes.length}</Link>}
            </div>
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
          </section>
        )}
        <section id="conversations">
          <h2>Conversations</h2>
          {threads.map((thread) => (
            <Link key={thread.id} className="day-row" to={chatTo(thread.id)}>
              <span className="proj-chat">
                <ThreadAvatar thread={thread} size="sm" />
                <span><b>{audience(thread)}</b><span>{thread.name}</span></span>
              </span>
            </Link>
          ))}
          {!threads.length && <p className="note">No conversations for you on this project.</p>}
        </section>
        {site && can('site', 'r') && (
          <section>
            <h2>Site</h2>
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
          )
          }
          </section>
        )}
        {svc.assistKinds().includes('ask') && (
          <Link className="day-row" to={`/mobile/projects/${project.id}/assist?kind=ask`}>
            <b>Ask about this project</b>
            <span>Answers from shared records</span>
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
      <div className="body canvas proj">
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
