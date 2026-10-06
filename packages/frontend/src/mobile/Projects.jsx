import { Link, useParams } from 'react-router-dom';
import { useStore } from '../shared/store';
import Icon from './Icon';
import {
  svc, projectOf, siteFor, openIssues, projectWork, me, firstName, can, audience, state, onPhone,
} from './model';
import { t } from './copy';
import { Avatar, ThreadAvatar } from './faces';
import { photoUrl } from '../ui/Ph';

export default function Projects() {
  useStore();
  const list = svc.projects().filter((p) => onPhone(p.id));
  const person = me();

  return (
    <div className="screen">
      <header className="top">
        <h1>{t('projects')}<span>Drawings, people and site work</span></h1>
        <Link className="icon-btn" to="/mobile/profile" aria-label="Profile">
          <Avatar person={person} size="sm" />
        </Link>
      </header>
      <div className="body canvas">
        {list.map((p) => {
          const site = siteFor(p.id);
          const issues = openIssues(p.id);
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
                  {issues.length ? `${issues.length} open` : 'No open issues'}
                </span>
              </span>
              <Icon name="chev" />
            </Link>
          );
        })}
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
  const work = projectWork(project.id);
  const threads = svc.threads().filter((t) => t.projectId === project.id);
  const materials = svc.materials({ projectId: project.id });
  const drawings = can('drawing', 'r') ? (project.drawings || []) : [];

  return (
    <div className="screen">
      <header className="top thread-top">
        <Link className="icon-btn" to="/mobile/projects" aria-label="Back to projects">
          <Icon name="back" /><span>Projects</span>
        </Link>
        <div className="thread-heading">
          <h1>{project.name}</h1>
          <span>{project.code} · {project.city}</span>
        </div>
      </header>
      <div className="body canvas">
        <p className="place">{site ? site.stage : project.kind}</p>
        {work.length > 0 && (
          <section>
            <h2>Needs you here</h2>
            {work.slice(0, 3).map((item) => (
              <div key={item.key} className="task hot">
                <small>{item.kind}</small>
                <b>{item.title}</b>
                <span>{item.meta}</span>
              </div>
            ))}
          </section>
        )}
        <div className="shortcuts">
          {threads[0] && (
            <Link to={`/mobile/chats/${(threads.find((item) => item.kind === 'site') || threads.find((item) => item.kind === 'client') || threads[0]).id}`}>
              <Icon name="chat" /><b>{t('chat')}</b><small>{threads.length} conversations</small>
            </Link>
          )}
          <Link to={`/mobile/photos?project=${project.id}`}>
            <Icon name="photos" /><b>Photos</b><small>Filed site updates</small>
          </Link>
          {can('drawing', 'r') && (
            <Link to={`/mobile/projects/${project.id}/drawings`}>
              <Icon name="drawing" /><b>Drawings</b><small>{drawings.length} shared</small>
            </Link>
          )}
          <Link to={`/mobile/projects/${project.id}/people`}>
            <Icon name="people" /><b>People</b><small>Contacts</small>
          </Link>
        </div>
        <details className="waiting">
          <summary>{t('more')}</summary>
          <div className="shortcuts">
            {can('material', 'r') && (
              <Link to={`/mobile/projects/${project.id}/materials`}>
                <Icon name="sample" /><b>Materials</b><small>{materials.length} shared</small>
              </Link>
            )}
            <Link to={`/mobile/projects/${project.id}/attention`}>
              <Icon name="warn" /><b>Needs you</b><small>{work.length}</small>
            </Link>
            <Link to={`/mobile/projects/${project.id}/changes`}>
              <Icon name="bell" /><b>Changes</b><small>Recorded</small>
            </Link>
            {can('drawing', 'r') && (
              <Link to={`/mobile/projects/${project.id}/index`}>
                <Icon name="drawing" /><b>Drawing index</b><small>By stage</small>
              </Link>
            )}
            {can('ref', 'r') && (
              <Link to={`/mobile/projects/${project.id}/refs`}>
                <Icon name="photos" /><b>References</b><small>Client links</small>
              </Link>
            )}
            {can('intake', 'r') && (
              <Link to={`/mobile/projects/${project.id}/intake`}>
                <Icon name="check" /><b>Checklist</b><small>Client data</small>
              </Link>
            )}
            {can('share', 'r') && (
              <Link to={`/mobile/projects/${project.id}/share`}>
                <Icon name="clip" /><b>Share</b><small>Expiring link</small>
              </Link>
            )}
            {svc.assistKinds().includes('ask') && (
              <Link to={`/mobile/projects/${project.id}/assist?kind=ask`}>
                <Icon name="ai" /><b>Ask</b><small>From project records</small>
              </Link>
            )}
            {svc.assistKinds().includes('client') && threads.some((item) => item.kind === 'client') && (
              <Link to={`/mobile/projects/${project.id}/assist?kind=client`}>
                <Icon name="chat" /><b>Client update</b><small>From this chat</small>
              </Link>
            )}
            {svc.assistKinds().includes('concept') && (
              <Link to={`/mobile/projects/${project.id}/assist?kind=concept`}>
                <Icon name="samples" /><b>Finish ideas</b><small>From a photo</small>
              </Link>
            )}
          </div>
        </details>
        {materials.length > 0 && (
          <section>
            <h2>Materials</h2>
            {materials.slice(0, 3).map((m) => (
              <div key={m.id} className="material">
                <b>{m.name}</b>
                <span>{(m.status || '').replace(/_/g, ' ')} · {m.vendor}</span>
              </div>
            ))}
          </section>
        )}
        <section id="conversations">
          <h2>Conversations</h2>
          {threads.map((t) => (
            <Link key={t.id} className="row slim" to={`/mobile/chats/${t.id}`}>
              <ThreadAvatar thread={t} size="sm" />
              <span className="row-copy">
                <b>{audience(t)}</b>
                <span>{t.name}</span>
              </span>
              <Icon name="chev" />
            </Link>
          ))}
          {!threads.length && <p className="note">No conversations for you on this project.</p>}
        </section>
        {site && can('site', 'r') && (
          <section className="site-card">
            <h2>Site</h2>
            <b>{site.name}</b>
            <p>{site.stage}</p>
            {site.managerId && <p>Site manager · {firstName(site.managerId)}</p>}
          </section>
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
      <header className="top thread-top">
        <Link className="icon-btn" to={`/mobile/projects/${projectId}`} aria-label="Back to project">
          <Icon name="back" /><span>Project</span>
        </Link>
        <div className="thread-heading">
          <h1>Drawings</h1>
          <span>{project?.name}</span>
        </div>
      </header>
      <div className="body canvas">
        {!allowed && <div className="empty"><h3>Drawings aren’t available for this login</h3></div>}
        {allowed && <p className="note">Check the revision and purpose before anyone builds from it.</p>}
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
