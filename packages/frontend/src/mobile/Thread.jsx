import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../shared/store';
import { AIProvider, toast } from '../shared/core';
import { filingLabel } from '../shared/filing';
import { siteHasSuggestion } from '../shared/chatExtras';
import Icon from './Icon';
import { useField } from './FieldContext';
import { Swatch } from './frame';
import { ThreadHeader } from './Chats';
import PhotoEdit from './PhotoEdit';
import { ForwardPick, MessageActions, VoicePlay } from './ChatPages';
import { t } from './copy';
import {
  svc, siblings, messagesOf, audience, firstName, fmtT, fmtD, dayLabel, preview, state, can, onPhone,
  postMessage, toggleReaction, toggleDecision, projectOf, siteFor, staff, user,
} from './model';

const BASICS = [
  ['photo', 'Photo', 'photos'],
  ['camera', 'Camera', 'camera'],
  ['voice', 'Voice note', 'mic'],
  ['drawing', 'Drawing', 'drawing'],
  ['delivery', 'Delivery', 'delivery'],
  ['sample', 'Sample', 'sample'],
];
const MORE = [
  ['location', 'Location', 'location'],
  ['bill', 'Bill / expense', 'bill'],
  ['material', 'Material request', 'delivery', ['site_manager', 'contractor', 'partner', 'designer']],
  ['attendance', 'Attendance', 'people', ['site_manager', 'contractor']],
  ['file', 'File', 'file'],
  ['checkin', 'Check in', 'today', ['site_manager', 'contractor']],
  ['daylog', "Today's log", 'today', ['site_manager', 'partner', 'designer']],
  ['poll', 'Poll', 'checkcheck'],
  ['contact', 'Contact', 'people'],
  ['document', 'Document', 'file'],
  ['audio', 'Audio', 'mic'],
];
const STEP = {
  photo: 'Choose a photo. You can crop it, draw on it, and add a note before it is sent.',
  drawing: 'Pick a drawing. This chat gets its name and revision.',
  delivery: 'Say what arrived. This chat gets that line.',
  sample: 'Add a picture of a finish or material, and say what it is.',
  location: 'This sends the place below into the chat.',
  bill: 'Write the amount you paid. A partner can approve it later.',
  material: 'Say what the site needs. It is posted in this chat.',
  attendance: 'This posts today’s attendance into this chat.',
  file: 'Choose a file. This chat shows the file name.',
  document: 'Choose a document. This chat keeps the file.',
  audio: 'Choose an audio file.',
  poll: 'Ask the chat a question with two or more answers.',
  contact: 'Share someone from this chat, or type a name and phone.',
  checkin: 'This tells the site chat that you have arrived.',
  daylog: 'This writes what happened on site today. You can read it before anyone else sees it.',
};

function allowed(roles) {
  return !roles || roles.includes(state.role);
}

function ChatBubble({ mine, same, pinned, deleted, onOpen, onReply, children }) {
  const node = useRef(null);
  const icon = useRef(null);
  const gesture = useRef(null);

  useEffect(() => () => {
    const g = gesture.current;
    if (!g) return;
    window.removeEventListener('pointermove', g.onMove);
    window.removeEventListener('pointerup', g.onEnd);
    window.removeEventListener('pointercancel', g.onEnd);
  }, []);

  function paint(shift, animate) {
    if (node.current) {
      node.current.style.transition = animate ? 'transform 0.18s ease-out' : 'none';
      node.current.style.transform = shift ? `translateX(${shift}px)` : '';
    }
    const shown = Math.min(shift / 64, 1);
    if (icon.current) {
      icon.current.style.transition = animate ? 'opacity 0.18s ease-out, transform 0.18s ease-out' : 'none';
      icon.current.style.opacity = String(shown);
      icon.current.style.transform = `scale(${0.55 + 0.45 * shown})`;
    }
  }

  function down(e) {
    if (gesture.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    document.querySelectorAll('.bubble').forEach((bubble) => {
      if (bubble === node.current) return;
      bubble.style.transition = '';
      bubble.style.transform = '';
    });
    document.querySelectorAll('.swipe-reply').forEach((mark) => {
      if (mark === icon.current) return;
      mark.style.opacity = '0';
    });
    const g = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, locked: null };
    g.onMove = (ev) => {
      if (ev.pointerId !== g.id || !gesture.current) return;
      const dx = ev.clientX - g.x;
      const dy = ev.clientY - g.y;
      if (!g.locked) {
        if (Math.hypot(dx, dy) < 8) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          g.locked = 'scroll';
          g.onEnd(ev);
          return;
        }
        g.locked = 'swipe';
      }
      if (g.locked !== 'swipe') return;
      const shift = dx <= 0 ? 0 : dx < 72 ? dx : 72 + (dx - 72) * 0.12;
      g.dx = shift;
      paint(shift);
      if (ev.cancelable) ev.preventDefault();
    };
    g.onEnd = (ev) => {
      if (ev.pointerId !== g.id) return;
      window.removeEventListener('pointermove', g.onMove);
      window.removeEventListener('pointerup', g.onEnd);
      window.removeEventListener('pointercancel', g.onEnd);
      gesture.current = null;
      const reply = g.locked === 'swipe' && g.dx > 56 && !deleted;
      paint(0, true);
      if (reply) onReply();
    };
    gesture.current = g;
    window.addEventListener('pointermove', g.onMove, { passive: false });
    window.addEventListener('pointerup', g.onEnd);
    window.addEventListener('pointercancel', g.onEnd);
  }

  return (
    <div className="bubble-row">
      <span className="swipe-reply" ref={icon} aria-hidden="true"><Icon name="undo" /></span>
      <article
        ref={node}
        className={`bubble ${mine ? 'mine' : 'theirs'} ${same ? 'cont' : ''} ${pinned ? 'pinned' : ''}`}
        onPointerDown={down}
      >
        {children}
        <button
          type="button"
          className="bubble-more"
          aria-label="Message options"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
        >
          <Icon name="chev" />
        </button>
      </article>
    </div>
  );
}

function FileChip({ threadId, m }) {
  if (m.deleted || m.notice) return null;
  const f = state.filings?.[m.id];
  const status = f?.status === 'check' ? 'check' : f?.status === 'ask' ? 'ask' : '';
  const who = !f ? '' : f.by === 'user' ? 'Filed' : f.status === 'filed' ? 'AI filed' : f.status === 'check' ? 'AI check' : 'AI needs context';
  const label = !f ? 'File message' : `${who} · ${f.status === 'ask' ? 'Which project?' : (filingLabel(f) || 'Note')}`;
  return <Link className={`file-chip ${status}`} to={`/mobile/chats/${threadId}/messages/${m.id}/filing`}>{label}</Link>;
}

export default function Thread() {
  useStore();
  const { threadId } = useParams();
  const navigate = useNavigate();
  const thread = svc.thread(threadId);
  const { markRead, drafts, setDraft } = useField();
  const [sheet, setSheet] = useState(null);
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [shot, setShot] = useState('');
  const [fileName, setFileName] = useState('');
  const [drawingNo, setDrawingNo] = useState('');
  const [error, setError] = useState('');
  const [showPins, setShowPins] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [menu, setMenu] = useState(null);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [editor, setEditor] = useState(null);
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState(['', '']);
  const [pollMulti, setPollMulti] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const location = useLocation();
  const [params] = useSearchParams();
  const from = params.get('from');
  const backTo = from && from.startsWith('/mobile/') ? from : '/mobile/chats';
  const scroller = useRef(null);
  const text = drafts[threadId] || '';

  const count = thread ? messagesOf(thread.id).length : 0;

  useEffect(() => {
    if (threadId) markRead(threadId);
  }, [threadId, markRead]);

  useEffect(() => {
    const id = location.state?.forward;
    if (!id) return;
    const message = messagesOf(threadId).find((m) => m.id === id);
    if (message) setForwardMsg(message);
    navigate(`/mobile/chats/${threadId}`, { replace: true, state: null });
  }, [location.state, threadId, navigate]);

  useEffect(() => {
    const el = scroller.current;
    const id = window.location.hash.slice(1);
    if (id && document.getElementById(id)) {
      document.getElementById(id).scrollIntoView({ block: 'center' });
      return;
    }
    if (el) el.scrollTop = el.scrollHeight;
  }, [threadId, count]);

  if (forwardMsg) {
    return (
      <div className="screen">
        <ForwardPick message={forwardMsg} onClose={() => setForwardMsg(null)} />
      </div>
    );
  }

  if (!thread || !onPhone(thread.projectId)) {
    return (
      <div className="screen">
        <header className="top"><h1>Chat</h1></header>
        <div className="empty"><h3>This chat isn’t available</h3><Link to="/mobile/chats">Back to chats</Link></div>
      </div>
    );
  }

  if (editor) {
    const ask = { sample: 'What is this sample?', delivery: 'What arrived?' }[editor.what];
    return (
      <div className="screen">
        <PhotoEdit
          src={editor.src}
          noteLabel={ask || 'Add a note'}
          noteRequired={Boolean(ask)}
          onCancel={() => setEditor(null)}
          onSend={sendEdited}
        />
      </div>
    );
  }

  const msgs = messagesOf(thread.id);
  const related = siblings(thread);
  const pinned = msgs.filter((m) => m.decision && !m.deleted);
  const canPin = can('thread', 'w') && (state.role === 'partner' || state.role === 'site_manager');

  function send(e) {
    e?.preventDefault();
    const value = text.trim();
    if (!value) return;
    postMessage(thread.id, { text: value, ...(replyTo ? { replyTo: replyTo.id } : {}) });
    setDraft(thread.id, '');
    setReplyTo(null);
    markRead(thread.id);
  }

  function openForm(item) {
    setError('');
    setNote('');
    setAmount('');
    setShot('');
    setFileName('');
    setDrawingNo('');
    setPollQ('');
    setPollOpts(['', '']);
    setPollMulti(false);
    setContactName('');
    setContactPhone('');
    setDocUrl('');
    setSheet({ what: item[0], label: item[1] });
  }

  function readPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || '');
      if (sheet && ['photo', 'sample', 'delivery'].includes(sheet.what)) {
        setEditor({ what: sheet.what, src });
        setSheet(null);
        return;
      }
      setShot(src);
    };
    reader.readAsDataURL(file);
  }

  function placeLine() {
    const project = thread.projectId ? projectOf(thread.projectId) : null;
    const site = thread.siteId ? svc.site(thread.siteId) : (thread.projectId ? siteFor(thread.projectId) : null);
    return [site?.name, project?.city].filter(Boolean).join(', ') || 'the studio';
  }

  function pick(item) {
    const key = item[0];
    if (key === 'voice') {
      navigate(`/mobile/chats/${thread.id}/voice`);
      return;
    }
    if (key === 'camera') {
      navigate(`/mobile/camera?thread=${thread.id}`);
      return;
    }
    openForm(item);
  }

  function doCheckin() {
    const siteId = thread.siteId || svc.mySiteIds()[0];
    if (!siteId) {
      setError('No site to use here.');
      return;
    }
    svc.siteCheckin(siteId);
    const siteThread = svc.threads().find((t) => t.kind === 'site' && t.siteId === siteId);
    const dest = siteThread?.id || thread.id;
    postMessage(dest, { text: 'Checked in at site', kind: 'checkin' });
    setSheet(null);
    markRead(dest);
    if (dest !== thread.id) navigate(`/mobile/chats/${dest}`);
  }

  function openDayLog() {
    const siteId = thread.siteId || svc.mySiteIds()[0];
    if (!siteId) {
      setError('No site to use here.');
      return;
    }
    navigate(`/mobile/projects/${svc.site(siteId)?.projectId || thread.projectId}/assist?kind=daily&site=${siteId}`);
  }

  function sendEdited(dataUrl, words) {
    const what = editor.what;
    const fields = { kind: what, photo: { dataUrl, hue: 28, seed: 4 } };
    if (what === 'sample') fields.text = `Sample: ${words}`;
    else if (what === 'delivery') fields.text = `Delivery: ${words}`;
    else fields.text = words || 'Photo';
    postMessage(thread.id, fields);
    setEditor(null);
    markRead(thread.id);
  }

  function sendAttach(e) {
    e.preventDefault();
    const what = sheet.what;
    const words = note.trim();
    const fields = { kind: what, text: words };
    if (what === 'photo') {
      if (!shot) { setError('Choose a photo first.'); return; }
      fields.text = words || 'Photo';
      fields.photo = { dataUrl: shot, hue: 28, seed: 4 };
    } else if (what === 'sample') {
      if (!words) { setError('Say what this sample is.'); return; }
      fields.text = `Sample: ${words}`;
      if (shot) fields.photo = shot.startsWith('data:') ? { dataUrl: shot, hue: 28, seed: 4 } : { hue: 28, seed: 4 };
    } else if (what === 'delivery') {
      if (!words) { setError('Say what arrived.'); return; }
      fields.text = `Delivery: ${words}`;
      if (shot.startsWith('data:')) fields.photo = { dataUrl: shot, hue: 28, seed: 4 };
    } else if (what === 'drawing') {
      const drawing = (projectOf(thread.projectId)?.drawings || []).find((d) => d.no === drawingNo);
      if (!drawing) { setError('Pick a drawing.'); return; }
      fields.text = `${drawing.name} · ${drawing.no} ${drawing.rev}`;
    } else if (what === 'location') {
      fields.text = words ? `Location: ${placeLine()}. ${words}` : `Location: ${placeLine()}`;
    } else if (what === 'bill') {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) { setError('Enter an amount greater than zero.'); return; }
      if (!words) { setError('Say what the money was for.'); return; }
      fields.bill = { amount: value, status: 'asked', paidBy: 'cash', projectId: thread.projectId };
      fields.text = `${words} · ₹${value.toLocaleString('en-IN')}`;
    } else if (what === 'material') {
      if (!words) { setError('Say what you need.'); return; }
      fields.text = `Material needed: ${words}`;
    } else if (what === 'file') {
      if (!fileName) { setError('Choose a file first.'); return; }
      fields.text = words ? `File: ${fileName}. ${words}` : `File: ${fileName}`;
    } else if (what === 'attendance') {
      fields.text = words ? `Attendance recorded for today. ${words}` : 'Attendance recorded for today';
    } else if (what === 'poll') {
      const options = pollOpts.map((o) => o.trim()).filter(Boolean);
      if (!pollQ.trim() || options.length < 2) { setError('Add a question and at least two options.'); return; }
      fields.poll = { question: pollQ.trim(), multi: pollMulti, options: options.map((text) => ({ text, votes: [] })) };
      fields.text = pollQ.trim();
    } else if (what === 'contact') {
      if (!contactName.trim()) { setError('Enter a name.'); return; }
      fields.contact = { name: contactName.trim(), phone: contactPhone.trim() };
      fields.text = contactName.trim();
    } else if (what === 'document' || what === 'audio') {
      if (!fileName) { setError(what === 'audio' ? 'Choose an audio file.' : 'Choose a document.'); return; }
      if (what === 'audio') fields.audio = { dataUrl: docUrl, name: fileName };
      else fields.file = { name: fileName, dataUrl: docUrl };
      fields.text = words ? `${fileName}. ${words}` : fileName;
      delete fields.kind;
    } else {
      if (!words) { setError('Write a note first.'); return; }
    }
    postMessage(thread.id, fields);
    setSheet(null);
    markRead(thread.id);
  }

  const tiles = sheet === 'plus' ? BASICS : sheet === 'more' ? MORE.filter((item) => allowed(item[3])) : [];
  const drawings = thread.projectId && can('drawing', 'r') ? (projectOf(thread.projectId)?.drawings || []) : [];

  return (
    <div className="screen">
      <ThreadHeader thread={thread} backTo={backTo} />
      {(related.length > 0 || (thread.projectId && thread.kind !== 'dm' && thread.groupType !== 'work')) && (
        <div className="switcher" role="tablist" aria-label="Conversations in this project">
          {related.map((t) => (
            <Link key={t.id} role="tab" aria-selected={t.id === thread.id} className={t.id === thread.id ? 'on' : ''} to={`/mobile/chats/${t.id}${from ? `?from=${encodeURIComponent(from)}` : ''}`}>
              {audience(t)}
            </Link>
          ))}
          {thread.projectId && thread.kind !== 'dm' && thread.groupType !== 'work' && (
            <Link role="tab" aria-selected={false} to={`/mobile/chats/${thread.id}/work`}>Work groups</Link>
          )}
        </div>
      )}
      {thread.kind === 'internal' && <p className="office-note">{t('officeOnly')}</p>}
      {pinned.length > 0 && (
        <button type="button" className="pinbar" onClick={() => setShowPins((v) => !v)}>
          {pinned.length} decision{pinned.length === 1 ? '' : 's'} pinned
        </button>
      )}
      {showPins && (
        <div className="pinlist">
          {pinned.map((m) => (
            <div className="pinrow" key={m.id}>
              <button type="button" className="jump" onClick={() => document.getElementById(m.id)?.scrollIntoView({ block: 'center' })}>
                <b>{(m.text || 'Decision').slice(0, 80)}</b>
                <span>{firstName(m.by)} · {fmtT(m.at)}</span>
              </button>
              {canPin && <button type="button" className="unpin" onClick={() => toggleDecision(m)}>Unpin</button>}
            </div>
          ))}
        </div>
      )}
      <div className="body chat chat-wallpaper" ref={scroller}>
        {svc.decisionsDue({ threadId: thread.id }).map((d) => (
          <div className="day-row" id={`decision-${d.id}`} key={d.id}>
            <div>
              <small>Still open · due {fmtD(d.due)}</small>
              <b>{d.title}</b>
            </div>
          </div>
        ))}
        {msgs.map((m, i) => {
          const prev = msgs[i - 1];
          const day = m.at.slice(0, 10);
          const showDay = !prev || prev.at.slice(0, 10) !== day;
          const mine = m.by === state.userId;
          const same = prev && prev.by === m.by && prev.at.slice(0, 10) === day;
          const reacts = Object.entries(m.reactions || {}).filter(([, ids]) => ids.length);
          const later = msgs.slice(i + 1).filter((x) => !x.deleted);
          const seen = mine && later.some((x) => x.by !== m.by);
          const delivered = mine && !seen && later.some((x) => x.by === m.by);
          const receipt = !mine || m.deleted ? null : seen ? 'seen' : delivered ? 'delivered' : 'sent';
          return (
            <Fragment key={m.id}>
              {showDay && <div className="day">{dayLabel(m.at)}</div>}
              <div id={m.id} className={`cluster ${mine ? 'mine' : 'theirs'} ${same ? 'cont' : ''}`}>
              <ChatBubble
                mine={mine}
                same={same}
                pinned={m.decision}
                deleted={m.deleted}
                onOpen={() => setMenu(m)}
                onReply={() => setReplyTo(m)}
              >
                {!mine && !same && <span className="who">{user(m.by).name || firstName(m.by)}</span>}
                {m.decision && !m.deleted && <span className="tag">Decision</span>}
                {m.deleted ? <p className="gone">This message was deleted</p> : (
                  <>
                    {m.forwarded && <span className="fwd">Forwarded</span>}
                    {m.replyTo && (() => {
                      const quoted = msgs.find((x) => x.id === m.replyTo);
                      return <span className="quote"><b>{quoted ? firstName(quoted.by) : ''}</b><span>{preview(quoted)}</span></span>;
                    })()}
                    {m.voice && <VoicePlay src={typeof m.voice === 'object' ? m.voice.audio : ''} dur={typeof m.voice === 'string' ? m.voice : (m.voice.dur || '')} />}
                    {m.photo?.dataUrl && <img className="shot" src={m.photo.dataUrl} alt="" />}
                    {m.photo && !m.photo.dataUrl && <Swatch hue={m.photo.hue} seed={m.photo.seed} />}
                    {(m.kind && !m.photo) && !m.voice && <span className="chip">{({ drawing: 'Drawing', delivery: 'Delivery', sample: 'Sample', location: 'Location', bill: 'Bill', material: 'Material', file: 'File', attendance: 'Attendance', checkin: 'Checked in' })[m.kind] || m.kind}</span>}
                    {m.media?.kind === 'video' && m.media.url && <video src={m.media.url} controls className="shot" />}
                    {m.media?.dataUrl && m.media.kind !== 'video' && <img className="shot" src={m.media.dataUrl} alt="" />}
                    {m.audio?.dataUrl && <audio src={m.audio.dataUrl} controls />}
                    {m.contact && <p><b>{m.contact.name}</b>{m.contact.phone ? <><br />{m.contact.phone}</> : null}</p>}
                    {m.poll && (
                      <div>
                        <b>{m.poll.question}</b>
                        {m.poll.options.map((o, i) => (
                          <button type="button" key={i} onClick={() => svc.votePoll(m.id, i)}>{o.text} · {o.votes.length}</button>
                        ))}
                      </div>
                    )}
                    {m.link && <p><b>{m.link.title}</b><br />{m.link.src}</p>}
                    {m.call && <p><b>Video call</b> · {m.call.provider}<br /><a href={m.call.url} target="_blank" rel="noopener noreferrer">{m.call.url}</a></p>}
                    {m.file?.dataUrl && <p><a href={m.file.dataUrl} download={m.file.name}>Download {m.file.name}</a></p>}
                    {m.imported && <small>imported from WhatsApp</small>}
                    {m.options?.length > 0 && m.options.map((o) => <button type="button" key={o} onClick={() => svc.recordChatDecision(m, o)}>{o}</button>)}
                    {m.approval && (m.approval.done ? <span className="chip">approved</span> : state.role === 'client' ? <button type="button" onClick={() => svc.approveChatMessage(m)}>{m.approval.label}</button> : <span className="chip">{m.approval.label} · waiting</span>)}
                    {m.bill && state.role === 'partner' && m.bill.status === 'asked' && m.by !== state.userId && (
                      <p>
                        <button type="button" onClick={() => svc.decideBill(m, true)}>Approve</button>
                        <button type="button" onClick={() => svc.decideBill(m, false)}>Ask for bill</button>
                      </p>
                    )}
                    {!m.deleted && m.issueId && <Link className="extra" to={`/mobile/issues/${m.issueId}`}>Open linked issue</Link>}
                    {!m.deleted && siteHasSuggestion(svc.siteUpdateReview(m.id)) && <Link className="extra" to={`/mobile/chats/${thread.id}/messages/${m.id}`}>Review site update</Link>}
                    {m.text && !m.voice ? <p><span className="say">{m.text}</span></p> : null}
                    {staff() && m.text && !m.deleted && (
                      <details className="assist">
                        <summary>Help with this update</summary>
                        <Link className="extra" to={`/mobile/chats/${thread.id}/messages/${m.id}`}>Open this update</Link>
                      </details>
                    )}
                    <div className="meta">
                      {staff() && <FileChip threadId={thread.id} m={m} />}
                      <time title={receipt === 'seen' ? 'Seen' : receipt === 'delivered' ? 'Delivered' : receipt === 'sent' ? 'Sent' : undefined}>
                        {m.edited ? 'Edited · ' : ''}{fmtT(m.at)}
                        {receipt && (
                          <Icon
                            name={receipt === 'sent' ? 'check' : 'checkcheck'}
                            className={receipt === 'seen' ? 'tick seen' : 'tick'}
                          />
                        )}
                      </time>
                    </div>
                  </>
                )}
                {m.deleted && <time>{fmtT(m.at)}</time>}
                {reacts.length > 0 && (
                  <div className="reacts">
                    {reacts.map(([emoji, ids]) => (
                      <button type="button" key={emoji} className={ids.includes(state.userId) ? 'on' : ''} onClick={() => toggleReaction(m, emoji)} aria-label={`React ${emoji}`}>
                        {emoji} {ids.length}
                      </button>
                    ))}
                  </div>
                )}
              </ChatBubble>
              </div>
            </Fragment>
          );
        })}
        {!msgs.length && <div className="empty"><h3>{thread.groupType === 'work' ? 'No messages yet' : 'Say hello'}</h3>{thread.groupType !== 'work' && <p>Photos and voice notes stay with this project.</p>}</div>}
      </div>
      {staff() && can('thread', 'w') && (() => {
        const last = [...msgs].reverse().find((m) => !m.deleted);
        if (!last || last.by === state.userId) return null;
        return <button type="button" className="suggest" onClick={async () => {
          if ((drafts[thread.id] || '').trim()) { toast('Your draft was kept. Clear it before requesting an AI suggestion.'); return; }
          try { setDraft(thread.id, await AIProvider.draftReply(thread, last)); }
          catch (_) { toast('AI reply unavailable. Your conversation and draft are unchanged.'); }
        }}>Suggest reply</button>;
      })()}
      {can('thread', 'w') && (() => {
        const last = [...msgs].reverse().find((m) => !m.deleted);
        if (!last || last.by === state.userId || !/\?/.test(last.text || '')) return null;
        return (
          <div className="quick">
            {[t('yes'), t('ok'), t('onMyWay')].map((label) => (
              <button type="button" key={label} onClick={() => { postMessage(thread.id, { text: label, replyTo: last.id }); markRead(thread.id); }}>{label}</button>
            ))}
          </div>
        );
      })()}
      {replyTo && (
        <div className="replybar">
          <span><b>{firstName(replyTo.by)}</b>{preview(replyTo)}</span>
          <button type="button" aria-label="Cancel reply" onClick={() => setReplyTo(null)}><Icon name="x" /></button>
        </div>
      )}
      {can('thread', 'w') && <form className="composer" onSubmit={send}>
        <div className="pill">
          <button type="button" className="round" aria-label="Add a photo, drawing or note" onClick={() => { setError(''); setSheet('plus'); }}>
            <Icon name="plus" />
          </button>
          <textarea
            rows={1}
            placeholder={t('message')}
            aria-label={`Message to ${audience(thread)}`}
            value={text}
            onChange={(e) => setDraft(thread.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
          />
          <Link className="round" to={`/mobile/chats/${thread.id}/voice`} aria-label="Record a voice note">
            <Icon name="mic" />
          </Link>
        </div>
        <button type="submit" className="round send" aria-label={t('send')}>
          <Icon name="send" />
        </button>
      </form>}
      {sheet && (
        <div className="sheet-back" onClick={() => setSheet(null)} role="presentation">
          <div className="sheet" role="dialog" aria-label="Add to chat" onClick={(e) => e.stopPropagation()}>
            {sheet === 'plus' || sheet === 'more' ? (
              <>
                <h2>{sheet === 'plus' ? 'Add to this chat' : 'More site updates'}</h2>
                <p className="help">Tap one. The next step tells you what gets sent.</p>
                {error ? <p className="warn-text">{error}</p> : null}
                <div className="tiles">
                  {tiles.map((item) => (
                    <button type="button" key={item[0]} onClick={() => pick(item)}>
                      <Icon name={item[2]} />
                      {t(item[0]) === item[0] ? item[1] : t(item[0])}
                    </button>
                  ))}
                  {sheet === 'plus' && (
                    <button type="button" onClick={() => setSheet('more')}>
                      <Icon name="plus" />
                      {t('more')}
                    </button>
                  )}
                </div>
                {sheet === 'more' && <button type="button" className="text-btn" onClick={() => setSheet('plus')}>Back to common updates</button>}
                <button type="button" className="text-btn" onClick={() => setSheet(null)}>Cancel</button>
              </>
            ) : (
              <form className="stack" onSubmit={sendAttach}>
                <h2>{sheet.label}</h2>
                <p className="help">{STEP[sheet.what]}</p>
                {(sheet.what === 'photo' || sheet.what === 'sample' || sheet.what === 'delivery') && (
                  <>
                    {shot ? <img className="cam-preview" src={shot} alt="" /> : null}
                    <label className="ghost file-pick">{shot ? 'Choose a different photo' : (sheet.what === 'delivery' ? 'Add a photo' : 'Choose a photo')}<input type="file" accept="image/*" onChange={readPhoto} /></label>
                    {sheet.what === 'sample' && !shot && (
                      <button type="button" className="text-btn" onClick={() => { setEditor({ what: 'sample', src: '/images/p01.jpg' }); setSheet(null); }}>Use a sample picture</button>
                    )}
                  </>
                )}
                {sheet.what === 'drawing' && (
                  drawings.length ? drawings.map((d) => (
                    <button type="button" className={`row ${drawingNo === d.no ? 'picked' : ''}`} key={d.no} onClick={() => setDrawingNo(d.no)}>
                      <span className="row-copy"><b>{d.name}</b><span>{d.no} · {d.rev}</span></span>
                      <span className="pick" aria-hidden="true">{drawingNo === d.no ? <Icon name="check" /> : null}</span>
                    </button>
                  )) : <p className="note">{can('drawing', 'r') ? 'No drawings on this project yet.' : 'Drawings aren’t available for this login.'}</p>
                )}
                {sheet.what === 'location' && <p className="voice-line">{placeLine()}</p>}
                {sheet.what === 'file' && (
                  <>
                    <label className="ghost file-pick">{fileName || 'Choose a file'}<input type="file" onChange={(e) => { setFileName(e.target.files?.[0]?.name || ''); e.target.value = ''; }} /></label>
                    {fileName ? <p className="note">Only the name is sent. The file stays on this phone.</p> : null}
                  </>
                )}
                {(sheet.what === 'document' || sheet.what === 'audio') && (
                  <label className="ghost file-pick">{fileName || (sheet.what === 'audio' ? 'Choose audio' : 'Choose a document')}
                    <input type="file" accept={sheet.what === 'audio' ? 'audio/*' : undefined} onChange={(e) => {
                      const file = e.target.files?.[0];
                      setFileName(file?.name || '');
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setDocUrl(String(reader.result || ''));
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }} />
                  </label>
                )}
                {sheet.what === 'poll' && (
                  <>
                    <label>Question<input value={pollQ} onChange={(e) => setPollQ(e.target.value)} /></label>
                    {pollOpts.map((o, i) => (
                      <label key={i}>Option {i + 1}<input value={o} onChange={(e) => setPollOpts((list) => list.map((x, j) => (j === i ? e.target.value : x)))} /></label>
                    ))}
                    {pollOpts.length < 6 && <button type="button" className="text-btn" onClick={() => setPollOpts((list) => [...list, ''])}>Add option</button>}
                    <label><input type="checkbox" checked={pollMulti} onChange={(e) => setPollMulti(e.target.checked)} /> Allow multiple answers</label>
                  </>
                )}
                {sheet.what === 'contact' && (
                  <>
                    {(thread.memberIds || []).filter((id) => id !== state.userId).map((id) => (
                      <button type="button" key={id} className="ghost" onClick={() => { postMessage(thread.id, { contact: { userId: id, name: firstName(id) }, text: firstName(id) }); setSheet(null); }}>Share {firstName(id)}</button>
                    ))}
                    <label>Name<input value={contactName} onChange={(e) => setContactName(e.target.value)} /></label>
                    <label>Phone<input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></label>
                  </>
                )}
                {sheet.what === 'bill' && (
                  <label>Amount in ₹
                    <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" placeholder="0" />
                  </label>
                )}
                {!['checkin', 'daylog', 'drawing', 'location', 'poll', 'contact', 'document', 'audio'].includes(sheet.what) && (
                  <label>{sheet.what === 'photo' ? 'Add a note' : sheet.what === 'sample' ? 'What is this sample?' : sheet.what === 'delivery' ? 'What arrived?' : sheet.what === 'bill' ? 'What was it for?' : sheet.what === 'material' ? 'What do you need?' : sheet.what === 'file' ? 'Add a note' : 'Note'}
                    <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} aria-label={sheet.what === 'sample' ? 'What is this sample?' : sheet.what === 'delivery' ? 'What arrived?' : sheet.what === 'bill' ? 'What was it for?' : sheet.what === 'material' ? 'What do you need?' : 'Note'} placeholder={sheet.what === 'photo' || sheet.what === 'file' || sheet.what === 'attendance' ? 'Optional' : ''} />
                  </label>
                )}
                {sheet.what === 'location' && (
                  <label>Add a note
                    <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" placeholder="Optional" />
                  </label>
                )}
                {error ? <p className="warn-text">{error}</p> : null}
                {sheet.what === 'checkin' ? (
                  <button className="primary" type="button" onClick={doCheckin}>Check in</button>
                ) : sheet.what === 'daylog' ? (
                  <button className="primary" type="button" onClick={openDayLog}>Write today’s log</button>
                ) : (
                  <button className="primary" type="submit">Send</button>
                )}
                <button type="button" className="text-btn" onClick={() => setSheet(sheet.what && MORE.some((item) => item[0] === sheet.what) ? 'more' : 'plus')}>Back</button>
              </form>
            )}
          </div>
        </div>
      )}
      {menu && (
        <div className="sheet-back" onClick={() => setMenu(null)} role="presentation">
            <div className="sheet" role="dialog" aria-label="More options" onClick={(e) => e.stopPropagation()}>
            <p className="note">{preview(menu)}</p>
            <MessageActions thread={thread} message={menu} onReply={() => { setReplyTo(menu); setMenu(null); }} onDeleted={() => setMenu(null)} onForward={() => { setForwardMsg(menu); setMenu(null); }} />
            <button type="button" className="text-btn" onClick={() => setMenu(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
