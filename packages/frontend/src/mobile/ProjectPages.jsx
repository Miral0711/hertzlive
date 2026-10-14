import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../shared/store';
import { persist } from '../shared/core';
import { photoUrl } from '../ui/Ph';
import Icon from './Icon';
import { Page, Note, backName } from './frame';
import { Avatar } from './faces';
import {
  svc, can, projectOf, projectNeeds, fmtD, firstName, state, user, phoneOf, render, staff,
  phoneDrawings, rememberPhoneDrawing,
} from './model';
import { t } from '../shared/i18n';

export function WorkRow({ item, onDone }) {
  const body = (
    <div>
      <small>{item.kind}</small>
      <b>{item.title}</b>
      {item.meta ? <span>{item.meta}</span> : null}
    </div>
  );
  if (item.to) return <Link className="day-row" to={item.to}>{body}</Link>;
  if (item.taskId) {
    return (
      <div className="day-row">
        {body}
        <div className="day-acts"><button type="button" onClick={() => onDone(item.taskId)}>{t('Done')}</button></div>
      </div>
    );
  }
  return <div className="day-row">{body}</div>;
}

export function finishTask(taskId) {
  const task = (state.db.TASKS || []).find((row) => row.id === taskId);
  if (!task || task.owner !== state.userId) return;
  try { svc.completeTask(task.id); } catch (err) { return; }
  render();
}

function Missing({ id }) {
  return <Page sheet back={`/mobile/projects/${id || ''}`} title={t('Project')}><div className="empty"><h3>{t('This project isn’t available')}</h3></div></Page>;
}

function materialFace(status) {
  if (status === 'approved') return { label: t('Approved'), tone: 'ok' };
  if (status === 'client_pending') return { label: t('Needs a decision'), tone: 'open' };
  if (status === 'rejected') return { label: t('Not this one'), tone: 'late' };
  if (status === 'internal_review') return { label: t('In review'), tone: '' };
  return { label: status ? status.replace(/_/g, ' ') : t('Status not recorded'), tone: '' };
}

function materialsLead(rows) {
  const waiting = rows.filter((m) => m.status === 'client_pending').length;
  if (!waiting) return t('Every shared sample has a decision.');
  if (state.role === 'client') {
    return waiting === 1 ? '1 sample needs your decision.' : `${waiting} samples need your decision.`;
  }
  return waiting === 1 ? '1 sample waiting on the client.' : `${waiting} samples waiting on the client.`;
}

export function Materials() {
  useStore();
  const { projectId } = useParams();
  const project = projectOf(projectId);
  const rows = project ? svc.materials({ projectId }) : [];
  if (!project) return <Missing id={projectId} />;
  if (!can('material', 'r')) {
    return <Page sheet back={`/mobile/projects/${projectId}`} backLabel={t('Project')} title={t('Materials')}><div className="empty"><h3>{t('Materials aren’t available for this login')}</h3></div></Page>;
  }
  return (
    <Page className="mat-screen" sheet back={`/mobile/projects/${projectId}`} backLabel={t('Project')} title={t('Materials')} sub={project.name}>
      {rows.length ? <p className="mat-summary">{materialsLead(rows)}</p> : <Note>{t('Samples and decisions shared with you.')}</Note>}
      {rows.map((m) => {
        const face = materialFace(m.status);
        return (
          <article key={m.id} className="mat-card">
            <img className="mat-shot" src={photoUrl(m.hue ?? 28, m.seed ?? m.id)} alt="" />
            <div className="mat-copy">
              <div className="mat-head">
                <b>{m.name}</b>
                <span className={`pill${face.tone ? ` ${face.tone}` : ''}`}>{face.label}</span>
              </div>
              <span className="mat-vendor">{m.vendor || t('Supplier not recorded')}</span>
              {m.status === 'client_pending' && staff() && project.clientId ? (
                <span className="mat-wait">{t('Waiting on {0}', firstName(project.clientId))}</span>
              ) : null}
              {m.status === 'client_pending' && state.role === 'client' ? (
                <div className="mat-acts">
                  <button type="button" onClick={() => { svc.approveMaterial(m.id, true); render(); }}>{t('Approve')}</button>
                  <button type="button" className="quiet" onClick={() => { svc.approveMaterial(m.id, false); render(); }}>{t('Not this one')}</button>
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
      {svc.assistKinds().includes('compare') && rows.length >= 2 ? (
        <Link className="mat-compare" to={`/mobile/projects/${projectId}/assist?kind=compare`}>{t('Compare materials')}</Link>
      ) : null}
      {!rows.length && <div className="empty"><h3>{t('No materials shared yet')}</h3></div>}
    </Page>
  );
}

export function Contacts() {
  useStore();
  const { projectId } = useParams();
  const project = projectOf(projectId);
  const groups = project ? svc.peopleFolder(projectId) : [];
  if (!project) return <Missing id={projectId} />;
  return (
    <Page className="sheet-cards" sheet back={`/mobile/projects/${projectId}`} backLabel={t('Project')} title={t('People')} sub={project.name}>
      <p className="sheet-lead">{t('People in this project.')}</p>
      {groups.filter((g) => g.people.length).map((g) => (
        <section key={g.name}>
          <h2 className="sect">{g.name}</h2>
          {g.people.map((u) => {
            const person = user(u.id);
            const known = state.db.USERS.some((x) => x.id === u.id);
            const dm = known
              ? state.db.THREADS.find((t) => t.kind === 'dm' && (t.memberIds || []).includes(u.id) && (t.memberIds || []).includes(state.userId))
              : null;
            return (
              <article className="person-card" key={u.id}>
                {person?.id ? <Avatar person={person} /> : <span className="av">{(u.name || '?').slice(0, 2)}</span>}
                <div className="person-copy">
                  <b>{u.name}</b>
                  {u.title ? <span>{u.title}</span> : null}
                  {u.last ? <span className="person-when">{t('Last active {0}', fmtD(u.last))}</span> : null}
                  {known ? (
                    <div className="sheet-acts">
                      {dm ? <Link className="sheet-btn" to={`/mobile/chats/${dm.id}?from=${encodeURIComponent(`/mobile/projects/${projectId}/people`)}`}>{t('Message')}</Link> : null}
                      <a className="sheet-btn quiet" href={`tel:${phoneOf(person).replace(/\s/g, '')}`}>{t('Call')}</a>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      ))}
      {!groups.some((g) => g.people.length) && <div className="empty"><h3>{t('No people recorded')}</h3></div>}
    </Page>
  );
}

export function Attention() {
  useStore();
  const { projectId } = useParams();
  const project = projectOf(projectId);
  const work = project ? projectNeeds(projectId) : [];
  if (!project) return <Missing id={projectId} />;
  return (
    <Page sheet back={`/mobile/projects/${projectId}`} backLabel={t('Project')} title={t('Needs attention')} sub={project.name}>
      <Note>{t('Your actions and waiting items for this project. Shared with Today.')}</Note>
      {work.map((item) => <WorkRow key={item.key} item={item} onDone={finishTask} />)}
      {!work.length && <div className="empty"><h3>{t('Nothing needs you here')}</h3></div>}
    </Page>
  );
}

export function Changes() {
  useStore();
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const from = params.get('from');
  const back = from && from.startsWith('/mobile/') ? from : `/mobile/projects/${projectId}`;
  const backLabel = from && from.startsWith('/mobile/') ? backName(from) : t('Project');
  const project = projectOf(projectId);
  const rows = project ? svc.projectUpdates({ projectId }) : [];
  const pending = project && state.role === 'client'
    ? (state.db.CHANGES || []).filter((c) => c.projectId === projectId && c.status === 'awaiting_client')
    : [];
  if (!project) return <Missing id={projectId} />;
  function decide(id, ok) {
    const change = (state.db.CHANGES || []).find((c) => c.id === id);
    if (!change || state.role !== 'client') return;
    change.status = ok ? 'approved' : 'declined';
    change.signedAt = new Date().toISOString().slice(0, 16);
    svc.log(`Change ${change.status} · ${change.no}`, `Change ${change.id}`);
    if (ok) svc.recordApproval({ kind: 'change', projectId: change.projectId, value: change.no, instruction: change.title });
    persist();
    render();
  }
  return (
    <Page className="sheet-cards" sheet back={back} backLabel={backLabel} title={t('Important changes')} sub={project.name}>
      <p className="sheet-lead">{t('Recorded changes with their original sources.')}</p>
      {pending.map((c) => (
        <article className="sheet-card" key={c.id}>
          <div className="sheet-meta"><span className="pill open">{t('Your approval')}</span><span className="sheet-date">{c.no}</span></div>
          <b>{c.title}</b>
          <span className="sheet-detail">{c.reason}</span>
          <div className="sheet-acts">
            <button type="button" className="sheet-btn" onClick={() => decide(c.id, true)}>{t('Approve')}</button>
            <button type="button" className="sheet-btn quiet" onClick={() => decide(c.id, false)}>{t('Decline')}</button>
          </div>
        </article>
      ))}
      {rows.map((u) => {
        const here = `/mobile/projects/${projectId}/changes${from ? `?from=${encodeURIComponent(from)}` : ''}`;
        const backQuery = `?from=${encodeURIComponent(here)}`;
        const siteChat = u.source?.type === 'delivery' && u.source.siteId
          ? svc.threads().find((t) => t.kind === 'site' && t.siteId === u.source.siteId)
          : null;
        const to = u.source?.threadId
          ? `/mobile/chats/${u.source.threadId}${backQuery}`
          : u.source?.type === 'drawing' && u.source.id
            ? `/mobile/projects/${projectId}/drawings/${encodeURIComponent(u.source.id)}${backQuery}`
            : siteChat
              ? `/mobile/chats/${siteChat.id}${backQuery}`
              : '';
        const tone = u.kind === 'drawing' ? 'kind' : /short/i.test(u.title) ? 'late' : u.kind === 'delivery' || u.kind === 'approval' ? 'ok' : '';
        const label = u.kind === 'delivery' ? t('Delivery') : u.kind === 'drawing' ? t('Drawing') : u.kind === 'approval' ? t('Approval') : u.kind === 'answer' ? t('Answer') : u.kind;
        return (
          <article className="sheet-card" key={u.id}>
            <div className="sheet-meta">
              <span className={`pill${tone ? ` ${tone}` : ''}`}>{label}</span>
              <span className="sheet-date">{fmtD(u.at)}</span>
            </div>
            <b>{u.title}</b>
            <span className="sheet-detail">{u.detail}</span>
            {to ? <Link className="sheet-btn" to={to}>{t('Open source')}</Link> : <span className="sheet-quiet">{t('No conversation recorded for this.')}</span>}
          </article>
        );
      })}
      {!rows.length && !pending.length && <div className="empty"><h3>{t('No recorded changes')}</h3></div>}
    </Page>
  );
}

export function Refs() {
  useStore();
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const from = params.get('from');
  const back = from && from.startsWith('/mobile/') ? from : `/mobile/projects/${projectId}`;
  const backLabel = from && from.startsWith('/mobile/') ? backName(from) : t('Project');
  const project = projectOf(projectId);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const rows = project ? svc.clientRefs(projectId) : [];
  if (!project) return <Missing id={projectId} />;
  function add(e) {
    e.preventDefault();
    try {
      svc.addClientRef({ projectId, url, title });
      setUrl(''); setTitle(''); setError('');
      render();
    } catch (err) { setError(t(err.message)); }
  }
  return (
    <Page className="sheet-cards" sheet back={back} backLabel={backLabel} title={t('References')} sub={project.name}>
      <p className="sheet-lead">{t('Client references and inspiration links.')}</p>
      {rows.map((r) => (
        <article className="sheet-card" key={r.id}>
          <b>{r.title || r.url}</b>
          <span className="sheet-detail">{r.src}{r.room ? ` · ${r.room}` : ''}</span>
          <div className="sheet-acts">
            <a className="sheet-btn" href={r.url} target="_blank" rel="noopener noreferrer">{t('Open')}</a>
            {state.role !== 'client' && !r.promoted && can('moodboard', 'w') ? (
              <button type="button" className="sheet-btn quiet" onClick={() => { svc.promoteRef(r.id); render(); }}>{t('Moodboard')}</button>
            ) : r.promoted ? <span className="pill ok">{t('On moodboard')}</span> : null}
          </div>
        </article>
      ))}
      {can('ref', 'w') && (
        <form className="stack sheet-form" onSubmit={add}>
          <label>{t('Link')}<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" aria-label={t('Link')} /></label>
          <label>{t('Title')}<input value={title} onChange={(e) => setTitle(e.target.value)} aria-label={t('Title')} /></label>
          {error ? <p className="warn-text">{error}</p> : null}
          <button className="sheet-submit" type="submit">{t('Add a link')}</button>
        </form>
      )}
      {!rows.length && <div className="empty"><h3>{t('No references saved yet')}</h3></div>}
    </Page>
  );
}

export function Intake() {
  useStore();
  const { projectId } = useParams();
  const project = projectOf(projectId);
  const [item, setItem] = useState('');
  const [error, setError] = useState('');
  const rows = project ? svc.intake(projectId) : [];
  if (!project) return <Missing id={projectId} />;
  return (
    <Page sheet back={`/mobile/projects/${projectId}`} backLabel={t('Project')} title={t('Client data checklist')} sub={project.name}>
      {rows.map((i) => (
        <div className="row" key={i.id}>
          <span className="row-copy">
            <b>{i.item}</b>
            {i.at ? <span>{fmtD(i.at)}{i.file ? ` · ${i.file}` : ''}</span> : null}
          </span>
          <span className="chip-status">{i.status}</span>
          {i.status === 'missing' && can('intake', 'w') ? (
            <button type="button" className="text-btn" onClick={() => { try { svc.askIntake(i.id); render(); } catch (err) { setError(t(err.message)); } }}>{t('Ask client')}</button>
          ) : null}
          {state.role === 'client' && i.status !== 'received' ? (
            <button type="button" className="text-btn" onClick={() => { svc.receiveIntake(i.id, 'Uploaded from phone'); render(); }}>{t('Upload')}</button>
          ) : null}
        </div>
      ))}
      {error ? <p className="warn-text">{error}</p> : null}
      {can('intake', 'w') && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); try { svc.addIntake(projectId, item); setItem(''); render(); } catch (err) { setError(t(err.message)); } }}>
          <label>{t('New item')}<input value={item} onChange={(e) => setItem(e.target.value)} aria-label={t('Checklist item')} /></label>
          <button className="primary" type="submit">{t('Add item')}</button>
        </form>
      )}
      {!rows.length && <div className="empty"><h3>{t('No checklist items yet')}</h3></div>}
    </Page>
  );
}

export function DrawingIndex() {
  useStore();
  const { projectId } = useParams();
  const project = projectOf(projectId);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const rows = project ? svc.drawingIndex(projectId) : [];
  const stages = [...new Set(rows.map((r) => r.stage))];
  if (!project) return <Missing id={projectId} />;
  return (
    <Page className="sheet-cards" sheet back={`/mobile/projects/${projectId}`} backLabel={t('Project')} title={t('Drawing index')} sub={project.name}>
      <p className="sheet-lead">{t('Planned sheets per stage. Struck through once finalised.')}</p>
      {stages.map((stage) => (
        <section key={stage}>
          <h2 className="sect">{stage}</h2>
          {rows.filter((r) => r.stage === stage).map((r) => (
            <article className="sheet-card" key={r.id}>
              <span className="sheet-no">{r.no}</span>
              <b className={r.done ? 'done-line' : ''}>{r.name}</b>
              {r.done ? <span className="pill ok">{r.how}</span> : null}
              {!r.done && can('drawing', 'w') ? (
                <button type="button" className="sheet-btn" onClick={() => {
                  if (!reason.trim()) { setError(t('Say why this is finalised.')); return; }
                  try { svc.finaliseDrawing(r.id, reason.trim()); setError(''); render(); } catch (err) { setError(t(err.message)); }
                }}>{t('Finalise')}</button>
              ) : null}
            </article>
          ))}
        </section>
      ))}
      {can('drawing', 'w') && (
        <form className="stack sheet-form" onSubmit={(e) => e.preventDefault()}>
          <label>{t('Reason when you finalise')}<input value={reason} onChange={(e) => setReason(e.target.value)} aria-label={t('Finalise reason')} /></label>
        </form>
      )}
      {error ? <p className="warn-text">{error}</p> : null}
      {!rows.length && <div className="empty"><h3>{t('No drawing index yet')}</h3></div>}
    </Page>
  );
}

export function Drawing() {
  useStore();
  const { projectId, drawingNo } = useParams();
  const [params] = useSearchParams();
  const from = params.get('from');
  const back = from && from.startsWith('/mobile/') ? from : `/mobile/projects/${projectId}/drawings`;
  const backLabel = from && from.startsWith('/mobile/') ? backName(from) : t('Drawings');
  const no = decodeURIComponent(drawingNo || '');
  const project = projectOf(projectId);
  const drawing = (project?.drawings || []).find((d) => d.no === no);
  const saved = phoneDrawings(projectId, 'saved').some((x) => x.no === no);
  const related = drawing && can('issue', 'r')
    ? svc.issues({ projectId }).filter((i) => i.status !== 'closed' && i.drawing === drawing.no)
    : [];
  useEffect(() => {
    if (drawing) rememberPhoneDrawing(projectId, drawing.no, false);
  }, [projectId, no, drawing]);
  if (!project || !drawing) return <Missing id={projectId} />;
  return (
    <Page sheet back={back} backLabel={backLabel} title={drawing.name} sub={project.name}>
      <Note>{t('Check the revision and purpose before anyone builds from it. This demo does not attach the original file.')}</Note>
      <article className="view-card">
        <span className="rev">{drawing.rev}</span>
        <b>{drawing.no}</b>
        <em className={drawing.status === 'Issued for construction' ? 'issued' : ''}>{drawing.status || t('Purpose not recorded')}</em>
        <p>{drawing.date ? t('Dated {0}', fmtD(drawing.date)) : t('Date not recorded')}{drawing.by ? ` · ${firstName(drawing.by)}` : ''}</p>
        <button type="button" className="text-btn" onClick={() => { rememberPhoneDrawing(projectId, drawing.no, true); render(); }}>
          {saved ? t('Saved on this phone') : t('Save on this phone')}
        </button>
      </article>
      {related.length > 0 && (
        <section>
          <h2 className="sect">{t('Open on this sheet')}</h2>
          {related.map((issue) => (
            <Link key={issue.id} className="row" to={`/mobile/issues/${issue.id}?from=${encodeURIComponent(`/mobile/projects/${projectId}/drawings/${encodeURIComponent(drawing.no)}${from ? `?from=${encodeURIComponent(from)}` : ''}`)}`}>
              <span className="row-copy"><b>{issue.title}</b><span>{issue.status}</span></span>
              <Icon name="chev" />
            </Link>
          ))}
        </section>
      )}
      {svc.assistKinds().includes('ask') && (
        <Link className="day-row" to={`/mobile/projects/${projectId}/assist?kind=ask&drawing=${encodeURIComponent(drawing.no)}&q=${encodeURIComponent(`What is open on drawing ${drawing.no}?`)}&from=${encodeURIComponent(`/mobile/projects/${projectId}/drawings/${encodeURIComponent(drawing.no)}${from ? `?from=${encodeURIComponent(from)}` : ''}`)}`}>
          <b>{t('Ask about this sheet')}</b>
          <span>{drawing.no}</span>
        </Link>
      )}
    </Page>
  );
}

export function Share() {
  useStore();
  const { projectId } = useParams();
  const project = projectOf(projectId);
  const [label, setLabel] = useState('Issued drawings');
  const [made, setMade] = useState(null);
  const [error, setError] = useState('');
  const links = project ? svc.shareLinks(projectId) : [];
  if (!project) return <Missing id={projectId} />;
  return (
    <Page sheet back={`/mobile/projects/${projectId}`} backLabel={t('Project')} title={t('Share a link')} sub={project.name}>
      <Note>{t('An expiring web link. Anyone with the link can view until it expires.')}</Note>
      {can('share', 'w') && (
        <form className="stack" onSubmit={(e) => {
          e.preventDefault();
          try { setMade(svc.createShare({ projectId, label, days: 7 })); setError(''); render(); }
          catch (err) { setError(t(err.message)); }
        }}>
          <label>{t('What you are sharing')}<input value={label} onChange={(e) => setLabel(e.target.value)} aria-label={t('Share label')} /></label>
          <button className="primary" type="submit">{t('Create a 7-day link')}</button>
        </form>
      )}
      {error ? <p className="warn-text">{error}</p> : null}
      {made ? <p className="note">{t('Link ready until {0} · {1}', fmtD(made.expires), svc.shareUrl(made))}</p> : null}
      {links.map((l) => (
        <div className="row" key={l.id}>
          <span className="row-copy"><b>{l.label}</b><span>{t('{0} · until {1} · {2} views', l.status, fmtD(l.expires), l.views)}</span></span>
          {l.status === 'active' ? <button type="button" className="text-btn" onClick={() => { try { svc.revokeShare(l.id); render(); } catch (err) { setError(t(err.message)); } }}>{t('Revoke')}</button> : null}
        </div>
      ))}
    </Page>
  );
}

