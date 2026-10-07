import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStore } from '../shared/store';
import { persist } from '../shared/core';
import Icon from './Icon';
import { Page, Note } from './frame';
import { Avatar } from './faces';
import {
  svc, can, projectOf, projectNeeds, fmtD, firstName, state, user, phoneOf, render, staff,
  phoneDrawings, rememberPhoneDrawing,
} from './model';

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
        <div className="day-acts"><button type="button" onClick={() => onDone(item.taskId)}>Done</button></div>
      </div>
    );
  }
  return <div className="day-row">{body}</div>;
}

export function finishTask(taskId) {
  const task = (state.db.TASKS || []).find((row) => row.id === taskId);
  if (!task || task.owner !== state.userId) return;
  const previous = task.status;
  task.status = 'done';
  if (!persist()) task.status = previous;
  else render();
}

function Missing({ id }) {
  return <Page sheet back={`/mobile/projects/${id || ''}`} title="Project"><div className="empty"><h3>This project isn’t available</h3></div></Page>;
}

export function Materials() {
  useStore();
  const { projectId } = useParams();
  const project = projectOf(projectId);
  const rows = project ? svc.materials({ projectId }) : [];
  if (!project) return <Missing id={projectId} />;
  if (!can('material', 'r')) {
    return <Page sheet back={`/mobile/projects/${projectId}`} backLabel="Project" title="Materials"><div className="empty"><h3>Materials aren’t available for this login</h3></div></Page>;
  }
  return (
    <Page sheet back={`/mobile/projects/${projectId}`} backLabel="Project" title="Materials" sub={project.name}>
      <Note>Samples and decisions shared with you.</Note>
      {rows.map((m) => (
        <article key={m.id} className="view-card">
          <b>{m.name}</b>
          <span>{m.vendor || 'Supplier not recorded'}</span>
          <em className={m.status === 'approved' ? 'issued' : ''}>{(m.status || 'Status not recorded').replace(/_/g, ' ')}</em>
          {m.status === 'client_pending' && state.role === 'client' ? (
            <div className="mat-acts">
              <button type="button" onClick={() => { svc.approveMaterial(m.id, true); render(); }}>Approve</button>
              <button type="button" className="quiet" onClick={() => { svc.approveMaterial(m.id, false); render(); }}>Not this one</button>
            </div>
          ) : null}
          {m.status === 'client_pending' && staff() && project.clientId ? (
            <span>Waiting on {firstName(project.clientId)}</span>
          ) : null}
        </article>
      ))}
      {svc.assistKinds().includes('compare') && rows.length >= 2 ? (
        <Link className="primary" to={`/mobile/projects/${projectId}/assist?kind=compare`}>Compare materials</Link>
      ) : null}
      {!rows.length && <div className="empty"><h3>No materials shared yet</h3></div>}
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
    <Page sheet back={`/mobile/projects/${projectId}`} backLabel="Project" title="People" sub={project.name} bare>
      <Note>People in this project.</Note>
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
              <div className="row" key={u.id}>
                {person?.id ? <Avatar person={person} /> : <span className="av">{(u.name || '?').slice(0, 2)}</span>}
                <span className="row-copy"><b>{u.name}</b><span>{u.title}{u.last ? ` · last active ${fmtD(u.last)}` : ''}</span></span>
                {known ? (
                  <span className="person-acts">
                    {dm ? <Link to={`/mobile/chats/${dm.id}?from=${encodeURIComponent(`/mobile/projects/${projectId}/people`)}`}>Message</Link> : null}
                    <a href={`tel:${phoneOf(person).replace(/\s/g, '')}`}>Call</a>
                  </span>
                ) : null}
              </div>
            );
          })}
        </section>
      ))}
      {!groups.some((g) => g.people.length) && <div className="empty"><h3>No people recorded</h3></div>}
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
    <Page sheet back={`/mobile/projects/${projectId}`} backLabel="Project" title="Needs attention" sub={project.name}>
      <Note>Your actions and waiting items for this project. Shared with Today.</Note>
      {work.map((item) => <WorkRow key={item.key} item={item} onDone={finishTask} />)}
      {!work.length && <div className="empty"><h3>Nothing needs you here</h3></div>}
    </Page>
  );
}

export function Changes() {
  useStore();
  const { projectId } = useParams();
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
    <Page sheet back={`/mobile/projects/${projectId}`} backLabel="Project" title="Important changes" sub={project.name} bare>
      <Note>Recorded changes with their original sources.</Note>
      {pending.map((c) => (
        <article className="view-card" key={c.id}>
          <small>Your approval · {c.no}</small>
          <b>{c.title}</b>
          <span>{c.reason}</span>
          <div className="mat-acts">
            <button type="button" onClick={() => decide(c.id, true)}>Approve</button>
            <button type="button" className="quiet" onClick={() => decide(c.id, false)}>Decline</button>
          </div>
        </article>
      ))}
      {rows.map((u) => {
        const inner = (
          <>
            <span className="row-copy"><small>{u.kind} · {fmtD(u.at)}</small><b>{u.title}</b><span>{u.detail}</span></span>
            <Icon name="chev" />
          </>
        );
        return u.source?.threadId ? (
          <Link key={u.id} className="row" to={`/mobile/chats/${u.source.threadId}?from=${encodeURIComponent(`/mobile/projects/${projectId}/changes`)}`}>{inner}</Link>
        ) : (
          <div key={u.id} className="row">{inner}</div>
        );
      })}
      {!rows.length && !pending.length && <div className="empty"><h3>No recorded changes</h3></div>}
    </Page>
  );
}

export function Refs() {
  useStore();
  const { projectId } = useParams();
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
    } catch (err) { setError(err.message); }
  }
  return (
    <Page sheet back={`/mobile/projects/${projectId}`} backLabel="Project" title="References" sub={project.name}>
      <Note>Client references and inspiration links.</Note>
      {rows.map((r) => (
        <div className="row" key={r.id}>
          <span className="row-copy"><b>{r.title || r.url}</b><span>{r.src}{r.room ? ` · ${r.room}` : ''}</span></span>
          <a className="icon-btn" href={r.url} target="_blank" rel="noopener noreferrer">Open</a>
          {state.role !== 'client' && !r.promoted && can('moodboard', 'w') ? (
            <button type="button" className="text-btn" onClick={() => { svc.promoteRef(r.id); render(); }}>Moodboard</button>
          ) : r.promoted ? <span className="chip-status">On moodboard</span> : null}
        </div>
      ))}
      {can('ref', 'w') && (
        <form className="stack" onSubmit={add}>
          <label>Link<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" aria-label="Link" /></label>
          <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" /></label>
          {error ? <p className="warn-text">{error}</p> : null}
          <button className="primary" type="submit">Add a link</button>
        </form>
      )}
      {!rows.length && <div className="empty"><h3>No references saved yet</h3></div>}
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
    <Page sheet back={`/mobile/projects/${projectId}`} backLabel="Project" title="Client data checklist" sub={project.name}>
      {rows.map((i) => (
        <div className="row" key={i.id}>
          <span className="row-copy">
            <b>{i.item}</b>
            {i.at ? <span>{fmtD(i.at)}{i.file ? ` · ${i.file}` : ''}</span> : null}
          </span>
          <span className="chip-status">{i.status}</span>
          {i.status === 'missing' && can('intake', 'w') ? (
            <button type="button" className="text-btn" onClick={() => { try { svc.askIntake(i.id); render(); } catch (err) { setError(err.message); } }}>Ask client</button>
          ) : null}
          {state.role === 'client' && i.status !== 'received' ? (
            <button type="button" className="text-btn" onClick={() => { svc.receiveIntake(i.id, 'Uploaded from phone'); render(); }}>Upload</button>
          ) : null}
        </div>
      ))}
      {error ? <p className="warn-text">{error}</p> : null}
      {can('intake', 'w') && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); try { svc.addIntake(projectId, item); setItem(''); render(); } catch (err) { setError(err.message); } }}>
          <label>New item<input value={item} onChange={(e) => setItem(e.target.value)} aria-label="Checklist item" /></label>
          <button className="primary" type="submit">Add item</button>
        </form>
      )}
      {!rows.length && <div className="empty"><h3>No checklist items yet</h3></div>}
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
    <Page sheet back={`/mobile/projects/${projectId}`} backLabel="Project" title="Drawing index" sub={project.name} bare>
      <Note>Planned sheets per stage. Struck through once finalised.</Note>
      {stages.map((stage) => (
        <section key={stage}>
          <h2 className="sect">{stage}</h2>
          {rows.filter((r) => r.stage === stage).map((r) => (
            <div className="row" key={r.id}>
              <span className="row-copy">
                <b className={r.done ? 'done-line' : ''}>{r.no} {r.name}</b>
                {r.done ? <span>{r.how}</span> : null}
              </span>
              {!r.done && can('drawing', 'w') ? (
                <button type="button" className="text-btn" onClick={() => {
                  if (!reason.trim()) { setError('Say why this is finalised.'); return; }
                  try { svc.finaliseDrawing(r.id, reason.trim()); setError(''); render(); } catch (err) { setError(err.message); }
                }}>Finalise</button>
              ) : null}
            </div>
          ))}
        </section>
      ))}
      {can('drawing', 'w') && (
        <form className="stack" onSubmit={(e) => e.preventDefault()}>
          <label>Reason when you finalise<input value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Finalise reason" /></label>
        </form>
      )}
      {error ? <p className="warn-text">{error}</p> : null}
      {!rows.length && <div className="empty"><h3>No drawing index yet</h3></div>}
    </Page>
  );
}

export function Drawing() {
  useStore();
  const { projectId, drawingNo } = useParams();
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
    <Page sheet back={`/mobile/projects/${projectId}/drawings`} backLabel="Drawings" title={drawing.name} sub={project.name}>
      <Note>Check the revision and purpose before anyone builds from it. This demo does not attach the original file.</Note>
      <article className="view-card">
        <span className="rev">{drawing.rev}</span>
        <b>{drawing.no}</b>
        <em className={drawing.status === 'Issued for construction' ? 'issued' : ''}>{drawing.status || 'Purpose not recorded'}</em>
        <p>{drawing.date ? `Dated ${fmtD(drawing.date)}` : 'Date not recorded'}{drawing.by ? ` · ${firstName(drawing.by)}` : ''}</p>
        <button type="button" className="text-btn" onClick={() => { rememberPhoneDrawing(projectId, drawing.no, true); render(); }}>
          {saved ? 'Saved on this phone' : 'Save on this phone'}
        </button>
      </article>
      {related.length > 0 && (
        <section>
          <h2 className="sect">Open on this sheet</h2>
          {related.map((issue) => (
            <Link key={issue.id} className="row" to={`/mobile/issues/${issue.id}?from=${encodeURIComponent(`/mobile/projects/${projectId}/drawings/${encodeURIComponent(drawing.no)}`)}`}>
              <span className="row-copy"><b>{issue.title}</b><span>{issue.status}</span></span>
              <Icon name="chev" />
            </Link>
          ))}
        </section>
      )}
      {svc.assistKinds().includes('ask') && (
        <Link className="primary" to={`/mobile/projects/${projectId}/assist?kind=ask&q=${encodeURIComponent(`What is open on drawing ${drawing.no}?`)}`}>Ask about this sheet</Link>
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
    <Page sheet back={`/mobile/projects/${projectId}`} backLabel="Project" title="Share a link" sub={project.name}>
      <Note>An expiring web link. Anyone with the link can view until it expires.</Note>
      {can('share', 'w') && (
        <form className="stack" onSubmit={(e) => {
          e.preventDefault();
          try { setMade(svc.createShare({ projectId, label, days: 7 })); setError(''); render(); }
          catch (err) { setError(err.message); }
        }}>
          <label>What you are sharing<input value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Share label" /></label>
          <button className="primary" type="submit">Create a 7-day link</button>
        </form>
      )}
      {error ? <p className="warn-text">{error}</p> : null}
      {made ? <p className="note">Link ready until {fmtD(made.expires)} · {svc.shareUrl(made)}</p> : null}
      {links.map((l) => (
        <div className="row" key={l.id}>
          <span className="row-copy"><b>{l.label}</b><span>{l.status} · until {fmtD(l.expires)} · {l.views} views</span></span>
          {l.status === 'active' ? <button type="button" className="text-btn" onClick={() => { try { svc.revokeShare(l.id); render(); } catch (err) { setError(err.message); } }}>Revoke</button> : null}
        </div>
      ))}
    </Page>
  );
}

