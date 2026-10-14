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
        <h1>{t('projects')}<span>{t('Drawings, people and site work')}</span></h1>
        <Link className="icon-btn" to="/mobile/profile?from=%2Fmobile%2Fprojects" aria-label={t('Profile')}>
          <Avatar person={person} size="sm" />
        </Link>
      </header>
      <div className="body canvas proj proj-board">
        {list.length > 1 && (
          <label className="search project-search">
            <Icon name="search" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Search projects')} aria-label={t('Search projects')} />
          </label>
        )}
        {shown.map((p) => {
          const site = siteFor(p.id);
          const issues = openIssues(p.id);
          const drawings = p.drawings || [];
          return (
            <Link key={p.id} className="project" to={`/mobile/projects/${p.id}`}>
              <span className="project-id photo" aria-hidden="true"><img src={photoUrl(p.hue, p.id)} alt="" /></span>
              <span className="project-copy">
                <b>{p.name}</b>
                <span className="project-line">{p.code}{p.city ? ` · ${p.city}` : ''}</span>
                <span className="project-pills">
                  <span className="pill kind">{site ? site.stage : p.kind}</span>
                  {can('drawing', 'r') && drawings.length ? <span className="pill">{drawings.length === 1 ? t('1 drawing') : t('{0} drawings', drawings.length)}</span> : null}
                  {can('issue', 'r') ? (
                    <span className={`pill${issues.length ? ' open' : ' ok'}`}>{issues.length ? t('{0} open', issues.length) : t('Clear')}</span>
                  ) : null}
                </span>
              </span>
              <Icon name="chev" />
            </Link>
          );
        })}
        {list.length > 0 && !shown.length && <div className="empty"><h3>{t('No project matches')}</h3></div>}
        {!list.length && <div className="empty"><h3>{t('No projects for this login')}</h3><p>{t('Your role only sees the work assigned to you.')}</p></div>}
        <div className="proj-card">
          <MenuLink to="/mobile/photos" icon="photos" title={t('All project photos')} meta={t('Browse across your projects')} />
          {state.role === 'client' ? <MenuLink to="/mobile/portfolio" icon="photos" title={t('Studio portfolio')} meta={t('Completed work')} /> : null}
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
        <header className="top"><Link className="icon-btn" to="/mobile/projects"><Icon name="back" /><span>{t('Projects')}</span></Link><h1>{t('Project')}</h1></header>
        <div className="empty"><h3>{t('This project isn’t available')}</h3></div>
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
      title: t('Work'),
      items: [
        { to: `/mobile/photos?project=${project.id}`, icon: 'photos', title: t('Photos'), meta: t('Filed site updates') },
        can('drawing', 'r') && { to: `${here}/drawings`, icon: 'drawing', title: t('Drawings'), meta: t('{0} shared', drawings.length) },
        can('material', 'r') && { to: `${here}/materials`, icon: 'sample', title: t('Materials'), meta: waitingMats ? t('{0} waiting on the client', waitingMats) : t('{0} shared', materials.length), tone: waitingMats ? 'wait' : '' },
        { to: `${here}/changes`, icon: 'change', title: t('Changes'), meta: changes.length ? t('{0} recorded', changes.length) : t('Recorded') },
        { to: `${here}/attention`, icon: 'warn', title: t('Needs you'), meta: work.length ? t('{0} open', work.length) : t('Nothing waiting'), tone: work.length ? 'hot' : '' },
        { to: `${here}/people`, icon: 'people', title: t('People'), meta: t('Contacts') },
      ].filter(Boolean),
    },
    {
      title: t('Records'),
      items: [
        can('drawing', 'r') && { to: `${here}/index`, icon: 'drawing', title: t('Drawing index'), meta: t('{0} sheets', indexCount) },
        can('ref', 'r') && { to: `${here}/refs`, icon: 'star', title: t('References'), meta: t('{0} saved', svc.clientRefs(project.id).length) },
        can('intake', 'r') && { to: `${here}/intake`, icon: 'check', title: t('Client data checklist'), meta: t('{0} items', svc.intake(project.id).length) },
        can('share', 'r') && { to: `${here}/share`, icon: 'clip', title: t('Share a link'), meta: t('Expiring web link') },
      ].filter(Boolean),
    },
    {
      title: t('Studio'),
      items: [
        studio && { to: chatTo(studio.id), icon: 'chat', title: t('Studio chat'), meta: t('The client never sees it') },
        office && project.driveFolder && svc.connection('google') && { href: project.driveFolder, icon: 'folder', title: t('Drive archive'), meta: t('Older folders') },
        office && project.canvaDeck && svc.connection('canva') && { href: project.canvaDeck, icon: 'samples', title: t('Concept deck'), meta: t('Opens in Canva') },
        svc.assistKinds().includes('client') && threads.some((item) => item.kind === 'client') && { to: `${here}/assist?kind=client`, icon: 'send', title: t('Client update'), meta: t('From this chat') },
        svc.assistKinds().includes('concept') && { to: `${here}/assist?kind=concept`, icon: 'ai', title: t('Finish ideas'), meta: t('From a photo') },
      ].filter(Boolean),
    },
  ].filter((group) => group.items.length);

  return (
    <div className="screen">
      <header className="top thread-top proj-top">
        <Link className="icon-btn" to={backTo} aria-label={t('Back to {0}', from ? backName(backTo) : t('projects'))}>
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
            <div className="proj-stat"><b>{drawings.length}</b><span>{drawings.length === 1 ? t('Drawing') : t('Drawings')}</span></div>
          )}
          {issueCount != null && (
            <div className={`proj-stat${issueCount ? ' open' : ' ok'}`}><b>{issueCount || t('None')}</b><span>{issueCount ? t('Open issues') : t('Issues clear')}</span></div>
          )}
          {due && (
            <div className={`proj-stat${late ? ' late' : ''}`}>
              <b>{fmtD(due.date)}</b>
              <span>{late ? t('Overdue') : t('Next due')}</span>
            </div>
          )}
        </div>
        {due && <p className={`proj-next${late ? ' late' : ''}`}>{due.title}</p>}
        {work.length > 0 && (
          <section className="proj-attention">
            <div className="section-head">
              <h2>{t('Needs you here')}</h2>
              {work.length > 3 && <Link to={`/mobile/projects/${project.id}/attention`}>{t('View all {0}', work.length)}</Link>}
            </div>
            <div className="proj-card warm">
              {work.slice(0, 3).map((item) => <WorkRow key={item.key} item={item} onDone={finishTask} />)}
            </div>
          </section>
        )}
        {postThread && can('thread', 'w') && (
          <Link className="proj-post" to={`/mobile/camera?thread=${postThread.id}&from=${encodeURIComponent(`/mobile/projects/${project.id}`)}`}>
            <span className="ic-well on-accent"><Icon name="camera" /></span>
            <span><b>{t('Post a site update')}</b><span>{t('Photo, voice, delivery or attendance')}</span></span>
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
              <h2>{t('Recent changes')}</h2>
              {changes.length > 2 && <Link to={`/mobile/projects/${project.id}/changes`}>{t('View all {0}', changes.length)}</Link>}
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
          <h2>{t('Conversations')}</h2>
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
          ) : <p className="note">{t('No conversations for you on this project.')}</p>}
        </section>
        {site && can('site', 'r') && (
          <section>
            <h2>{t('Site')}</h2>
            <div className="proj-card">
              {siteChat ? (
                <Link className="day-row" to={chatTo(siteChat.id)}>
                  <div>
                    <b>{site.name}</b>
                    <span>{site.stage}{site.address || site.location ? ` · ${site.address || site.location}` : ''}</span>
                    {issueCount != null && <span>{issueCount ? t('{0} open', issueCount) : t('No open issues')}</span>}
                    {lastFeed && <span>{t('Last update {0} · {1}', fmtD(lastFeed.at), firstName(lastFeed.by))}</span>}
                    {site.managerId && <span>{t('Site manager {0}', firstName(site.managerId))}</span>}
                  </div>
                </Link>
              ) : (
                <div className="day-row">
                  <div>
                    <b>{site.name}</b>
                    <span>{site.stage}</span>
                    {issueCount != null && <span>{issueCount ? t('{0} open', issueCount) : t('No open issues')}</span>}
                    {lastFeed && <span>{t('Last update {0} · {1}', fmtD(lastFeed.at), firstName(lastFeed.by))}</span>}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
        {svc.assistKinds().includes('ask') && (
          <Link className="proj-ask" to={`/mobile/projects/${project.id}/assist?kind=ask`}>
            <span className="ic-well"><Icon name="ai" /></span>
            <span className="proj-row-copy"><b>{t('Ask about this project')}</b><span>{t('Answers from shared records')}</span></span>
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
        <Link className="icon-btn" to={`/mobile/projects/${projectId}`} aria-label={t('Back to project')}>
          <Icon name="back" />
        </Link>
        <div className="thread-heading">
          <h1>{t('Drawings')}</h1>
          <span>{project?.name}</span>
        </div>
      </header>
      <div className="body canvas proj proj-board">
        {!allowed && <div className="empty"><h3>{t('Drawings aren’t available for this login')}</h3></div>}
        {allowed && <p className="note">{t('Check the revision and purpose before anyone builds from it.')}</p>}
        {allowed && ['saved', 'recent'].map((kind) => {
          const quick = phoneDrawings(projectId, kind).slice(0, kind === 'saved' ? 100 : 3);
          if (!quick.length) return null;
          return (
            <section key={kind}>
              <h2>{kind === 'saved' ? t('Saved by you') : t('Recently opened')}</h2>
              {quick.map((x) => (
                <Link key={x.no} className="drawing" to={`/mobile/projects/${projectId}/drawings/${encodeURIComponent(x.no)}`}>
                  <span className="rev">{x.d.rev}</span>
                  <div>
                    <b>{x.d.name}</b>
                    <span>{x.d.rev} · {x.d.status}</span>
                    {x.rev !== x.d.rev && <em className="revision-change">{t('Register changed since {0}. Review before use.', x.rev)}</em>}
                  </div>
                </Link>
              ))}
            </section>
          );
        })}
        {allowed && drawings.length > 0 && <h2>{t('All drawings')}</h2>}
        {drawings.map((d) => (
          <Link key={d.no} className="drawing" to={`/mobile/projects/${projectId}/drawings/${encodeURIComponent(d.no)}`}>
            <span className="rev">{d.rev}</span>
            <div>
              <b>{d.name}</b>
              <span>{d.no}</span>
              <em className={d.status === 'Issued for construction' ? 'issued' : ''}>{d.status || t('Purpose not recorded')}</em>
            </div>
          </Link>
        ))}
        {allowed && !drawings.length && <div className="empty"><h3>{t('No drawings shared')}</h3></div>}
      </div>
    </div>
  );
}
