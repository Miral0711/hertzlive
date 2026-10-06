import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../shared/store';
import { Page, Note } from './frame';
import {
  svc, state, user, firstName, fmtT, messagesOf, audience, threadTitle, postMessage, projectName, phoneOf, stamp, render,
  toggleReaction, deleteMessage, toggleDecision, editMessage, can,
} from './model';
import { filingLabel } from '../shared/filing';

export function GroupInfo() {
  useStore();
  const { threadId } = useParams();
  const thread = svc.thread(threadId);
  if (!thread) return <Page back="/mobile/chats" title="Chat"><div className="empty"><h3>This chat isn’t available</h3></div></Page>;
  const members = thread.memberIds.map((id) => user(id)).filter((u) => u?.id);
  return (
    <Page back={`/mobile/chats/${threadId}`} backLabel="Chat" title={threadTitle(thread)} sub={`${audience(thread)} · ${members.length} people`} bare>
      {thread.kind === 'internal' ? <Note>Internal only. The client never sees this.</Note> : null}
      {members.map((u) => (
        <div className="row" key={u.id}>
          <span className={`av ${u.role === 'client' ? 'client' : ''}`}>{u.ini}</span>
          <span className="row-copy"><b>{u.name}</b><span>{u.title} · {phoneOf(u)}</span></span>
          {u.id !== state.userId ? <a className="icon-btn" href={`tel:${phoneOf(u).replace(/\s/g, '')}`}>Call</a> : <span className="chip-status">You</span>}
        </div>
      ))}
    </Page>
  );
}

export function Voice() {
  useStore();
  const { threadId } = useParams();
  const navigate = useNavigate();
  const thread = svc.thread(threadId);
  const sample = {
    site_manager: ['0:24', 'Bathroom tile batch came today, 40 boxes short. Vendor says balance Friday.'],
    contractor: ['0:19', 'Column C4 rebar is ready. Need an engineer to check before we pour at 9 tomorrow.'],
    designer: ['0:15', 'Sharing the latest drawing. Please confirm on site before the mason starts.'],
    partner: ['0:12', 'Good work on the terrace. Send me the sample photo before Saturday.'],
    client: ['0:14', 'Can we look at a darker wood for the pantry doors?'],
  }[state.role] || ['0:15', 'Sharing the latest drawing. Please confirm on site before the mason starts.'];
  const [text, setText] = useState(sample[1]);
  if (!thread) return <Page back="/mobile/chats" title="Voice"><div className="empty"><h3>This chat isn’t available</h3></div></Page>;
  return (
    <Page back={`/mobile/chats/${threadId}`} backLabel="Chat" title="Review voice update" sub={threadTitle(thread)}>
      <Note>Demo recording. Edit the example transcript before sending.</Note>
      <p className="voice-line">Example voice note · {sample[0]}</p>
      <form className="stack" onSubmit={(e) => {
        e.preventDefault();
        postMessage(threadId, { text: text.trim() || sample[1], voice: sample[0] });
        navigate(`/mobile/chats/${threadId}`);
      }}>
        <label>Transcript<textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} aria-label="Voice transcript" /></label>
        <button className="primary" type="submit">Send voice update</button>
      </form>
    </Page>
  );
}

const EMOJI = ['👍', '✅', '❓', '🙏', '❌'];

function reminderAt(which) {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  if (which === 'monday') {
    do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 1);
  } else {
    d.setDate(d.getDate() + 1);
  }
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T09:00`;
}

export function MessagePage() {
  useStore();
  const { threadId, messageId } = useParams();
  const navigate = useNavigate();
  const thread = svc.thread(threadId);
  const message = messagesOf(threadId).find((m) => m.id === messageId);
  const filing = state.filings?.[messageId];
  const [reply, setReply] = useState('');
  const [edit, setEdit] = useState(message?.text || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [reminded, setReminded] = useState('');
  if (!thread || !message) return <Page back={`/mobile/chats/${threadId || ''}`} title="Message"><div className="empty"><h3>This message isn’t available</h3></div></Page>;
  const mine = message.by === state.userId;
  const canPin = !message.deleted && can('thread', 'w') && (state.role === 'partner' || state.role === 'site_manager');
  const others = (thread.memberIds || []).filter((id) => id !== message.by);
  return (
    <Page back={`/mobile/chats/${threadId}`} backLabel="Chat" title="Message" sub={`${firstName(message.by)} · ${fmtT(message.at)}`}>
      <article className="view-card">
        {message.deleted ? <p className="gone">This message was deleted</p> : <p>{message.text}</p>}
        {message.edited ? <span>Edited</span> : null}
      </article>
      {!message.deleted && (
        <div className="emoji-row" role="group" aria-label="Reactions">
          {EMOJI.map((emoji) => (
            <button
              type="button"
              key={emoji}
              className={message.reactions?.[emoji]?.includes(state.userId) ? 'on' : ''}
              aria-label={`React ${emoji}`}
              onClick={() => toggleReaction(message, emoji)}
            >{emoji}</button>
          ))}
        </div>
      )}
      {filing && !message.deleted ? <p className="note">Filed · {filingLabel(filing) || 'this chat'}</p> : null}
      <div className="stack">
        {!message.deleted && <Link className="ghost" to={`/mobile/chats/${threadId}/messages/${messageId}/filing`}>Change where this is filed</Link>}
        {message.issueId ? <Link className="ghost" to={`/mobile/issues/${message.issueId}`}>Open linked issue</Link> : null}
        {!message.deleted && thread.projectId && svc.assistKinds().includes('followup') && (message.text || message.transcript) ? (
          <Link className="ghost" to={`/mobile/assist?kind=followup&message=${messageId}`}>Suggest a follow-up</Link>
        ) : null}
        {!message.deleted && message.photo && svc.assistKinds().includes('concept') ? (
          <Link className="ghost" to={`/mobile/assist?kind=concept&message=${messageId}&project=${thread.projectId || ''}`}>Finish palette from this photo</Link>
        ) : null}
        {canPin && (
          <button type="button" className="ghost" onClick={() => toggleDecision(message)}>
            {message.decision ? 'Unpin decision' : 'Pin as decision'}
          </button>
        )}
        <button type="button" className="ghost" onClick={() => setShowInfo((v) => !v)}>Info · sent, delivered, read</button>
        {showInfo && (
          <article className="view-card">
            <p>Sent · {fmtT(message.at)}</p>
            <p>Delivered · {fmtT(message.at)}</p>
            {others.map((id) => {
              const person = user(id);
              const read = id.charCodeAt(0) % 3 !== 0;
              return <p key={id}>{person.name} · {read ? `read ${fmtT(message.at)}` : 'not yet read'}</p>;
            })}
          </article>
        )}
        {!message.deleted && (
          <>
            <button type="button" className="ghost" onClick={() => { svc.addFollowup(messageId, reminderAt('tomorrow')); setReminded('Reminder set for tomorrow at 9am.'); render(); }}>Remind me tomorrow 9am</button>
            <button type="button" className="ghost" onClick={() => { svc.addFollowup(messageId, reminderAt('monday')); setReminded('Reminder set for Monday at 9am.'); render(); }}>Remind me Monday 9am</button>
          </>
        )}
        {reminded ? <p className="note">{reminded}</p> : null}
      </div>
      {mine && !message.deleted && message.text && !message.voice && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); editMessage(message, edit); }}>
          <label>Edit<textarea rows={3} value={edit} onChange={(e) => setEdit(e.target.value)} aria-label="Edit message" /></label>
          <button className="primary" type="submit">Save · everyone sees edited</button>
        </form>
      )}
      {mine && !message.deleted && (
        confirmDelete ? (
          <div className="stack">
            <p>Everyone in this chat will see “This message was deleted”. The original stays in the studio log.</p>
            <button type="button" className="primary crit" onClick={() => { deleteMessage(message); navigate(`/mobile/chats/${threadId}`); }}>Delete for everyone</button>
            <button type="button" className="ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="ghost" onClick={() => setConfirmDelete(true)}>Delete for everyone</button>
        )
      )}
      {!message.deleted && (
        <form className="stack" onSubmit={(e) => {
          e.preventDefault();
          if (!reply.trim()) return;
          postMessage(threadId, { text: reply.trim(), replyTo: messageId });
          navigate(`/mobile/chats/${threadId}`);
        }}>
          <label>Reply<textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Reply" /></label>
          <button className="primary" type="submit">Send reply</button>
        </form>
      )}
    </Page>
  );
}

export function Filing() {
  useStore();
  const { threadId, messageId } = useParams();
  const navigate = useNavigate();
  const projects = svc.projects();
  const rooms = ['Kitchen', 'Living', 'Bathroom', 'Structure', 'Facade', 'Not set'];
  const current = state.filings?.[messageId] || {};
  const [projectId, setProjectId] = useState(current.projectId || projects[0]?.id || '');
  const [room, setRoom] = useState(current.room || 'Not set');
  const [error, setError] = useState('');
  return (
    <Page back={`/mobile/chats/${threadId}/messages/${messageId}`} backLabel="Message" title="Where should this go?">
      <form className="stack" onSubmit={(e) => {
        e.preventDefault();
        try {
          const saved = svc.fileMessage(messageId, { projectId, room: room === 'Not set' ? '' : room });
          if (!saved) throw new Error('Filing could not be saved on this device.');
          navigate(`/mobile/chats/${threadId}/messages/${messageId}`);
        } catch (err) { setError(err.message); }
      }}>
        <label>Project
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>Room
          <select value={room} onChange={(e) => setRoom(e.target.value)} aria-label="Room">
            {rooms.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        {error ? <p className="warn-text">{error}</p> : null}
        <button className="primary" type="submit">Save filing</button>
      </form>
    </Page>
  );
}

export function Issue() {
  useStore();
  const { issueId } = useParams();
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const detail = svc.siteIssueDetails(issueId);
  if (!detail) return <Page back="/mobile/today" title="Issue"><div className="empty"><h3>This issue isn’t available</h3></div></Page>;
  const { issue } = detail;
  return (
    <Page back="/mobile/today" backLabel="Today" title={issue.title} sub={`${issue.status}${issue.due ? ` · reply by ${fmtT(issue.due)}` : ''}`}>
      <p className="note">{issue.type}{issue.drawing ? ` · ${issue.drawing}` : ''} · raised by {firstName(issue.raisedBy)}</p>
      <h2 className="sect">Linked site updates</h2>
      {detail.sources.map((m) => (
        <Link key={m.id} className="row" to={`/mobile/chats/${m.threadId}`}>
          <span className="row-copy"><b>{firstName(m.by)}</b><span>{m.text}</span></span>
        </Link>
      ))}
      <h2 className="sect">Office answers</h2>
      {detail.answers.length ? detail.answers.map((m) => (
        <article key={m.id} className="view-card"><p>{m.text}</p></article>
      )) : <p className="note">No answer yet.</p>}
      {detail.canAnswer && (
        <form className="stack" onSubmit={(e) => {
          e.preventDefault();
          try { svc.answerSiteIssue(issueId, answer); setAnswer(''); setError(''); render(); }
          catch (err) { setError(err.message); }
        }}>
          <label>Office answer<textarea rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} /></label>
          {error ? <p className="warn-text">{error}</p> : null}
          <button className="primary" type="submit">Send answer</button>
        </form>
      )}
      {svc.assistKinds().includes('ask') ? (
        <Link className="ghost" to={`/mobile/projects/${issue.projectId}/assist?kind=ask&issue=${issueId}`}>Summarise this issue</Link>
      ) : null}
    </Page>
  );
}

export function Assist() {
  useStore();
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const kind = params.get('kind') || 'ask';
  const issueId = params.get('issue') || '';
  const messageId = params.get('message') || '';
  const projects = svc.projects();
  const sites = svc.sites();
  const [pid, setPid] = useState(params.get('project') || projectId || projects[0]?.id || '');
  const [siteId, setSiteId] = useState(params.get('site') || sites[0]?.id || '');
  const [question, setQuestion] = useState(issueId ? '' : 'What is still open?');
  const [picked, setPicked] = useState({});
  const [result, setResult] = useState(null);
  const [options, setOptions] = useState(null);
  const [owner, setOwner] = useState('');
  const [due, setDue] = useState(stamp().slice(0, 10));
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const allowed = svc.assistKinds().includes(kind);
  const materials = svc.materials({ projectId: pid });
  const clientThread = svc.threads().find((t) => t.projectId === pid && t.kind === 'client');
  const clientMessages = clientThread ? messagesOf(clientThread.id).filter((m) => !m.deleted && (m.text || m.transcript)).slice(-12) : [];
  const photos = svc.threads().filter((t) => !pid || t.projectId === pid).flatMap((t) => messagesOf(t.id).filter((m) => m.photo && !m.deleted).map((m) => ({ ...m, threadName: threadTitle(t) })));
  const title = {
    ask: 'Ask about this project', compare: 'Compare materials', daily: 'Review day report',
    client: 'Client update', concept: 'Finish palette', followup: 'Suggested follow-up',
  }[kind] || 'Draft';

  async function run(e) {
    e.preventDefault();
    setError('');
    setSaved('');
    try {
      const next = kind === 'compare'
        ? { projectId: pid, materialIds: Object.keys(picked).filter((id) => picked[id]) }
        : kind === 'daily'
          ? { siteId, date: stamp().slice(0, 10) }
          : kind === 'client'
            ? { threadId: clientThread?.id, messageIds: Object.keys(picked).filter((id) => picked[id]) }
            : kind === 'concept'
              ? { messageId: Object.keys(picked).find((id) => picked[id]) || messageId }
              : kind === 'followup'
                ? { messageId }
                : { projectId: pid, question, ...(issueId ? { issueId } : {}) };
      const draft = await svc.aiAssist(kind, next);
      setOptions(next);
      setResult(draft);
      setOwner(draft.proposal?.owners?.[0]?.id || '');
    } catch (err) { setError(err.message); }
  }

  async function sendDraft() {
    setError('');
    try {
      await svc.sendAssist(kind, options, result.text, result.sources);
      render();
      navigate(`/mobile/chats/${result.destinationThreadId}`);
    } catch (err) { setError(err.message); }
  }

  function saveFollowup(e) {
    e.preventDefault();
    setError('');
    try {
      svc.confirmFollowup({
        messageId,
        title: (result.proposal?.title || result.text || '').slice(0, 200),
        owner,
        due,
        reviewedSource: result.sources[0],
      });
      render();
      setSaved('Follow-up saved. It shows in Today for the person you chose.');
    } catch (err) { setError(err.message); }
  }

  return (
    <Page back={messageId ? `/mobile/chats/${state.db.MESSAGES.find((m) => m.id === messageId)?.threadId || ''}/messages/${messageId}` : projectId ? `/mobile/projects/${projectId}` : '/mobile/today'} title={title} sub={projectName(pid)}>
      {!allowed && <div className="empty"><h3>This draft isn’t available for you</h3><p>Switch person if you need this action.</p></div>}
      {allowed && (
        <form className="stack" onSubmit={run}>
          {!['daily', 'followup', 'concept'].includes(kind) && (
            <label>Project
              <select value={pid} onChange={(e) => { setPid(e.target.value); setPicked({}); }} aria-label="Project">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}
          {kind === 'daily' && (
            <label>Site
              <select value={siteId} onChange={(e) => setSiteId(e.target.value)} aria-label="Site">
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
          {kind === 'ask' && !issueId && (
            <label>Your question<textarea rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} /></label>
          )}
          {kind === 'compare' && materials.map((m) => (
            <label key={m.id} className="check"><input type="checkbox" checked={!!picked[m.id]} onChange={(e) => setPicked({ ...picked, [m.id]: e.target.checked })} /> {m.name}</label>
          ))}
          {kind === 'client' && (
            clientMessages.length ? clientMessages.map((m) => (
              <label key={m.id} className="check"><input type="checkbox" checked={!!picked[m.id]} onChange={(e) => setPicked({ ...picked, [m.id]: e.target.checked })} /> {(m.text || m.transcript).slice(0, 120)}</label>
            )) : <p className="note">No client conversation to draft from.</p>
          )}
          {kind === 'concept' && !messageId && (
            photos.length ? photos.slice(0, 8).map((m) => (
              <label key={m.id} className="check"><input type="radio" name="concept" checked={!!picked[m.id]} onChange={() => setPicked({ [m.id]: true })} /> {m.threadName}: {(m.text || 'Photo').slice(0, 80)}</label>
            )) : <p className="note">Send a photo in a project chat first.</p>
          )}
          {error ? <p className="warn-text">{error}</p> : null}
          <button className="primary" type="submit">Prepare draft</button>
        </form>
      )}
      {result && (
        <article className="view-card">
          <b>AI draft · demo</b>
          <p style={{ whiteSpace: 'pre-wrap' }}>{result.text}</p>
          {result.concepts?.map((c) => (
            <p key={c.name}><b>{c.name}</b> · {c.note}</p>
          ))}
          {result.missing?.length ? <p className="warn-text">{result.missing.join(' ')}</p> : null}
          {['daily', 'client'].includes(kind) && (
            <button type="button" className="primary" onClick={sendDraft}>Send this draft</button>
          )}
        </article>
      )}
      {result && kind === 'followup' && (
        <form className="stack" onSubmit={saveFollowup}>
          <label>Who
            <select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">
              {(result.proposal?.owners || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
          <label>Needed by<input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Needed by" /></label>
          {saved ? <p className="note">{saved}</p> : <button className="primary" type="submit">Save follow-up</button>}
        </form>
      )}
    </Page>
  );
}

export function Call() {
  useStore();
  const { threadId } = useParams();
  const [made, setMade] = useState(null);
  const [error, setError] = useState('');
  const thread = svc.thread(threadId);
  if (!thread) return <Page back="/mobile/chats" title="Video call"><div className="empty"><h3>This chat isn’t available</h3></div></Page>;
  return (
    <Page back={`/mobile/chats/${threadId}`} backLabel="Chat" title="Start video call" sub={threadTitle(thread)}>
      <Note>Posts a call card into this chat. Meet for the studio.</Note>
      {error ? <p className="warn-text">{error}</p> : null}
      <button type="button" className="primary" onClick={() => {
        try { setMade(svc.startCall(threadId)); setError(''); render(); }
        catch (err) { setError(err.message); }
      }}>Start Google Meet</button>
      {made ? <p className="note"><a href={made.url} target="_blank" rel="noopener noreferrer">{made.url}</a></p> : null}
    </Page>
  );
}

