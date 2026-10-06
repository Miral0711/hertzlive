import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../shared/store';
import { Page, Note } from './frame';
import Icon from './Icon';
import {
  svc, state, user, firstName, fmtT, messagesOf, audience, threadTitle, postMessage, projectName, phoneOf, stamp, render,
  toggleReaction, deleteMessage, hideMessage, toggleDecision, editMessage, can, myThreads, preview,
} from './model';
import { filingLabel } from '../shared/filing';
import { Avatar, ThreadAvatar } from './faces';

export function GroupInfo() {
  useStore();
  const { threadId } = useParams();
  const thread = svc.thread(threadId);
  if (!thread) return <Page back="/mobile/chats" title="Chat"><div className="empty"><h3>This chat isn’t available</h3></div></Page>;
  const members = thread.memberIds.map((id) => user(id)).filter((u) => u?.id);
  const muted = sessionStorage.getItem(`field-mute-${threadId}`) === '1';
  const pinned = messagesOf(threadId).filter((m) => m.decision && !m.deleted);
  return (
    <Page back={`/mobile/chats/${threadId}`} backLabel="Chat" title={threadTitle(thread)} sub={`${audience(thread)} · ${members.length} people`} bare>
      {thread.kind === 'internal' ? <Note>Office only. The client never sees this.</Note> : null}
      <button type="button" className="row" onClick={() => {
        if (muted) sessionStorage.removeItem(`field-mute-${threadId}`);
        else sessionStorage.setItem(`field-mute-${threadId}`, '1');
        render();
      }}>
        <span className="row-copy"><b>{muted ? 'Unmute this chat' : 'Mute this chat'}</b><span>Stops the unread mark on this phone</span></span>
      </button>
      {pinned.map((m) => (
        <Link className="row" key={m.id} to={`/mobile/chats/${threadId}#${m.id}`}>
          <span className="row-copy"><b>Pinned decision</b><span>{(m.text || 'Decision').slice(0, 80)}</span></span>
        </Link>
      ))}
      {members.map((u) => (
        <div className="row" key={u.id}>
          <Avatar person={u} />
          <span className="row-copy"><b>{u.name}</b><span>{u.title} · {phoneOf(u)}</span></span>
          {u.id !== state.userId ? <a className="icon-btn" href={`tel:${phoneOf(u).replace(/\s/g, '')}`}>Call</a> : <span className="chip-status">You</span>}
        </div>
      ))}
    </Page>
  );
}

let playingNote = null;

export function VoicePlay({ src, dur = '' }) {
  const id = useId();
  const audioRef = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => () => {
    if (playingNote?.id === id) {
      playingNote.el.pause();
      playingNote = null;
    }
  }, [id]);
  function play(e) {
    e.preventDefault();
    e.stopPropagation();
    const el = audioRef.current;
    if (!el || !src) return;
    if (on) {
      el.pause();
      el.currentTime = 0;
      if (playingNote?.id === id) playingNote = null;
      setOn(false);
      return;
    }
    if (playingNote && playingNote.id !== id) {
      playingNote.el.pause();
      playingNote.el.currentTime = 0;
      playingNote.setOn(false);
    }
    el.play().then(() => {
      playingNote = { id, el, setOn };
      setOn(true);
    }).catch(() => setOn(false));
  }
  return (
    <button type="button" className={`voice-play ${on ? 'on' : ''}`} onPointerDown={(e) => e.stopPropagation()} onClick={play} aria-label={on ? 'Stop voice note' : 'Play voice note'}>
      <audio ref={audioRef} className="voice-audio" src={src || undefined} preload="none" onEnded={() => { if (playingNote?.id === id) playingNote = null; setOn(false); }} />
      <span className="voice-go" aria-hidden="true">{on ? <i className="pause" /> : <Icon name="play" />}</span>
      <span className="voice-track" />
      <span className="voice-dur">{dur}</span>
    </button>
  );
}

export function Voice() {
  useStore();
  const { threadId } = useParams();
  const navigate = useNavigate();
  const thread = svc.thread(threadId);
  const [phase, setPhase] = useState('idle');
  const [audio, setAudio] = useState('');
  const [dur, setDur] = useState('0:00');
  const [micNote, setMicNote] = useState('');
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const chunks = useRef([]);
  const timer = useRef(null);
  const started = useRef(0);
  useEffect(() => () => {
    clearInterval(timer.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);
  if (!thread) return <Page back="/mobile/chats" title="Voice"><div className="empty"><h3>This chat isn’t available</h3></div></Page>;

  const clock = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  async function start() {
    setMicNote('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = window.MediaRecorder?.isTypeSupported?.('audio/webm') ? 'audio/webm' : '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          setAudio(String(reader.result || ''));
          setPhase('ready');
        };
        reader.readAsDataURL(blob);
      };
      recRef.current = rec;
      started.current = Date.now();
      setDur('0:00');
      timer.current = setInterval(() => setDur(clock(Date.now() - started.current)), 200);
      rec.start();
      setPhase('recording');
    } catch {
      setMicNote('The microphone did not open. Allow the microphone, then try again.');
    }
  }

  function stop() {
    clearInterval(timer.current);
    setDur(clock(Date.now() - started.current));
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
  }

  function again() {
    setAudio('');
    setDur('0:00');
    setPhase('idle');
  }

  return (
    <Page back={`/mobile/chats/${threadId}`} backLabel="Chat" title="Voice note" sub={threadTitle(thread)}>
      {phase === 'idle' && (
        <div className="stack">
          <Note>Tap once to record. You can listen to it, then send it into this chat.</Note>
          <button type="button" className="primary" onClick={start}>Tap to record</button>
          {micNote ? <p className="note">{micNote}</p> : null}
        </div>
      )}
      {phase === 'recording' && (
        <div className="stack">
          <p className="voice-line">Recording · {dur}</p>
          <button type="button" className="primary" onClick={stop}>Stop</button>
        </div>
      )}
      {phase === 'ready' && (
        <form className="stack" onSubmit={(e) => {
          e.preventDefault();
          if (!audio) return;
          postMessage(threadId, { voice: { dur, audio } });
          navigate(`/mobile/chats/${threadId}`);
        }}>
          <VoicePlay src={audio} dur={dur} />
          <Note>Tap play to hear the recording, then send it.</Note>
          <button className="primary" type="submit">Send to this chat</button>
          <button type="button" className="text-btn" onClick={again}>Record again</button>
        </form>
      )}
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

export function MessageActions({ thread, message, onReply, onDeleted, onForward }) {
  useStore();
  const filing = state.filings?.[message.id];
  const [edit, setEdit] = useState(message.text || '');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);
  const [reminded, setReminded] = useState('');
  const mine = message.by === state.userId;
  const canPin = !message.deleted && can('thread', 'w') && (state.role === 'partner' || state.role === 'site_manager');
  const others = (thread.memberIds || []).filter((id) => id !== message.by);
  if (confirmDelete) {
    return (
      <div className="msg-actions">
        <h2>Delete this message?</h2>
        <button type="button" className="ghost warn-text" onClick={() => { hideMessage(message); onDeleted?.(); }}>Delete for me</button>
        {mine && !message.deleted && (
          <button type="button" className="ghost warn-text" onClick={() => { deleteMessage(message); onDeleted?.(); }}>Delete for everyone</button>
        )}
        <button type="button" className="ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
      </div>
    );
  }
  return (
    <div className="msg-actions">
      {!message.deleted && (
        <div className="emoji-row" role="group" aria-label="Reactions">
          {EMOJI.map((emoji) => (
            <button type="button" key={emoji} className={message.reactions?.[emoji]?.includes(state.userId) ? 'on' : ''} aria-label={`React ${emoji}`} onClick={() => toggleReaction(message, emoji)}>{emoji}</button>
          ))}
        </div>
      )}
      {filing && !message.deleted ? <p className="note">Filed · {filingLabel(filing) || 'this chat'}</p> : null}
      {!message.deleted && <button type="button" className="ghost" onClick={onReply}>Reply</button>}
      {!message.deleted && <button type="button" className="ghost" onClick={onForward}>Forward</button>}
      <button type="button" className="ghost warn-text" onClick={() => setConfirmDelete(true)}>Delete</button>
      {!message.deleted && <Link className="ghost" to={`/mobile/chats/${thread.id}/messages/${message.id}/filing`}>Change where this is filed</Link>}
      {message.issueId ? <Link className="ghost" to={`/mobile/issues/${message.issueId}`}>Open linked issue</Link> : null}
      {!message.deleted && thread.projectId && svc.assistKinds().includes('followup') && (message.text || message.transcript) ? (
        <Link className="ghost" to={`/mobile/assist?kind=followup&message=${message.id}`}>Suggest a follow-up</Link>
      ) : null}
      {!message.deleted && message.photo && svc.assistKinds().includes('concept') ? (
        <Link className="ghost" to={`/mobile/assist?kind=concept&message=${message.id}&project=${thread.projectId || ''}`}>Finish palette from this photo</Link>
      ) : null}
      {canPin && (
        <button type="button" className="ghost" onClick={() => toggleDecision(message)}>{message.decision ? 'Unpin decision' : 'Pin as decision'}</button>
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
      {!message.deleted && !remindOpen && (
        <button type="button" className="ghost" onClick={() => setRemindOpen(true)}>Remind me</button>
      )}
      {!message.deleted && remindOpen && (
        <>
          <button type="button" className="ghost" onClick={() => { svc.addFollowup(message.id, reminderAt('tomorrow')); setReminded('Reminder set for tomorrow at 9am.'); render(); }}>Tomorrow 9am</button>
          <button type="button" className="ghost" onClick={() => { svc.addFollowup(message.id, reminderAt('monday')); setReminded('Reminder set for Monday at 9am.'); render(); }}>Monday 9am</button>
        </>
      )}
      {reminded ? <p className="note">{reminded}</p> : null}
      {mine && !message.deleted && message.text && !message.voice && !editing && (
        <button type="button" className="ghost" onClick={() => setEditing(true)}>Edit</button>
      )}
      {mine && !message.deleted && message.text && !message.voice && editing && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); editMessage(message, edit); setEditing(false); }}>
          <label>Edit<textarea rows={3} value={edit} onChange={(e) => setEdit(e.target.value)} aria-label="Edit message" /></label>
          <button className="primary" type="submit">Save</button>
        </form>
      )}
    </div>
  );
}

export function ForwardPick({ message, onClose }) {
  const navigate = useNavigate();
  const [picked, setPicked] = useState([]);
  function send() {
    const fields = { text: message.text || preview(message), forwarded: true };
    if (message.photo) fields.photo = message.photo;
    if (message.voice) fields.voice = message.voice;
    if (message.kind && !message.photo) fields.kind = message.kind;
    const sent = picked.filter((id) => postMessage(id, fields));
    onClose();
    if (sent.length === 1) navigate(`/mobile/chats/${sent[0]}`);
  }
  return (
    <>
      <header className="top">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Back to chat"><Icon name="back" /></button>
        <h1>Forward to</h1>
      </header>
      <div className="body">
        {myThreads().map(({ t: dest }) => {
          const on = picked.includes(dest.id);
          const title = threadTitle(dest);
          return (
            <button type="button" key={dest.id} className={`row ${on ? 'picked' : ''}`} onClick={() => setPicked((ids) => on ? ids.filter((id) => id !== dest.id) : [...ids, dest.id])}>
              <ThreadAvatar thread={dest} />
              <span className="row-copy">
                <b><span>{title}</span></b>
                <span>{audience(dest)}</span>
              </span>
              <span className="pick" aria-hidden="true">{on ? <Icon name="check" /> : null}</span>
            </button>
          );
        })}
      </div>
      {picked.length > 0 && (
        <div className="composer">
          <span className="row-copy"><b>{picked.length} selected</b></span>
          <button type="button" className="round send" aria-label="Forward message" onClick={send}><Icon name="send" /></button>
        </div>
      )}
    </>
  );
}

export function MessagePage() {
  useStore();
  const { threadId, messageId } = useParams();
  const navigate = useNavigate();
  const thread = svc.thread(threadId);
  const message = messagesOf(threadId).find((m) => m.id === messageId);
  const [reply, setReply] = useState('');
  if (!thread || !message) return <Page back={`/mobile/chats/${threadId || ''}`} title="Message"><div className="empty"><h3>This message isn’t available</h3></div></Page>;
  return (
    <Page back={`/mobile/chats/${threadId}`} backLabel="Chat" title="Message" sub={`${firstName(message.by)} · ${fmtT(message.at)}`}>
      <article className="view-card">
        {message.deleted ? <p className="gone">This message was deleted</p> : <p>{message.text}</p>}
        {message.edited ? <span>Edited</span> : null}
      </article>
      <MessageActions thread={thread} message={message} onReply={() => document.querySelector('[aria-label="Reply"]')?.focus()} onDeleted={() => navigate(`/mobile/chats/${threadId}`)} onForward={() => navigate(`/mobile/chats/${threadId}`, { state: { forward: message.id } })} />
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

