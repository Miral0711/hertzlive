// Phone-parity pieces for the desktop chat: message actions, forward, chat info,
// voice note, and the site-update forms. Existing attach kinds stay in AttachMenu.
import { useEffect, useRef, useState } from 'react';
import { state, svc, toast, render, user } from '../../shared/core.js';
import { FILE_KINDS } from '../../shared/filing.js';
import { REACTIONS, reminderAt, forwardFields, SAMPLE_MEDIA, MEDIA_TABS } from '../../shared/chatExtras.js';
import { Btn, Field, Input, Empty } from '../../ui/ui';
import Icon from '../../ui/Icon';
import Modal, { ModalActions } from '../Modal';
import { closeDialog, openDialog } from '../session';
import { role } from '../helpers';
import { Ph } from './media';
import { Avatar as PersonAvatar, ThreadAvatar } from '../../mobile/faces';
import { openDesktopAssist } from './assist';
import { conversationThreads, pendingFocus } from './store';

export const phoneOf = (u) => {
  const vendor = (state.db.VENDORS || []).find((v) => v.userId === u.id);
  if (vendor?.phone) return vendor.phone;
  const n = String((u.id.charCodeAt(1) * 7919) % 100000000).padStart(8, '0');
  return `+91 98${n.slice(0, 3)} ${n.slice(3)}`;
};

const placeLine = (thread) => {
  const project = thread.projectId ? svc.project(thread.projectId) : null;
  const site = thread.siteId ? svc.site(thread.siteId) : svc.sites().find((s) => s.projectId === thread.projectId);
  return [site?.name, project?.city].filter(Boolean).join(', ') || 'the studio';
};

function MenuRow({ children, onClick, warn = false }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-11 w-full items-center border-0 border-b border-line bg-transparent px-0 text-left text-[15px] font-medium ${warn ? 'text-crit' : 'text-ink'}`}>
      {children}
    </button>
  );
}

function replyTo(message) {
  state.desk.replyTo = message ? { id: message.id, threadId: message.threadId } : null;
  pendingFocus.current = { composer: true };
  state.desk.dialog = null;
  render();
}

export function MessageActionsDialog({ d }) {
  const message = state.db.MESSAGES.find((m) => m.id === d.msgId);
  const thread = message && svc.thread(message.threadId);
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState(message?.text || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);
  const [reminded, setReminded] = useState('');
  if (!message || !thread) {
    return (
      <Modal title="Message">
        <p>This message is no longer available for your role.</p>
        <ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions>
      </Modal>
    );
  }
  const mine = message.by === state.userId;
  const canPin = !message.deleted && (role() === 'partner' || role() === 'site_manager');
  const filing = state.filings?.[message.id];
  const others = (thread.memberIds || []).filter((id) => id !== message.by);
  const remind = (which, label) => {
    svc.addFollowup(message.id, reminderAt(which));
    setReminded(label);
    render();
  };
  return (
    <Modal title="Message">
      <p className="text-ink-3">{message.deleted ? 'This message was deleted' : (message.text || message.link?.title || 'Message')}</p>
      {confirmDelete ? (
        <div className="mt-3 flex flex-col">
          <p className="font-semibold">Delete this message?</p>
          <Btn kind="link" onClick={() => { svc.hideMessage(message); closeDialog(); }}>Delete for me</Btn>
          {mine && !message.deleted && <Btn kind="link" onClick={() => { svc.deleteMessage(message); closeDialog(); }}>Delete for everyone</Btn>}
          <Btn kind="link" onClick={() => setConfirmDelete(false)}>Cancel</Btn>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-1">
          {!message.deleted && (
            <div role="toolbar" aria-label="Reactions" className="mb-3 grid grid-cols-5 gap-2">
              {REACTIONS.map(([emoji, label]) => {
                const on = message.reactions?.[emoji]?.includes(state.userId);
                return (
                  <button
                    key={emoji}
                    type="button"
                    aria-pressed={on}
                    aria-label={label}
                    className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-r2 border text-[12px] font-semibold ${on ? 'border-accent bg-accent-soft text-accent-text' : 'border-line bg-surface text-ink-2'}`}
                    onClick={() => svc.reactToMessage(message, emoji)}
                  >
                    <span className="text-base leading-none" aria-hidden="true">{emoji}</span>
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          {filing && !message.deleted && <p className="text-sm text-ink-3">Filed · {FILE_KINDS[filing.kind] || filing.kind || 'this chat'}</p>}
          {!message.deleted && <MenuRow onClick={() => replyTo(message)}>Reply</MenuRow>}
          {!message.deleted && <MenuRow onClick={() => openDialog({ kind: 'forward-message', msgId: message.id })}>Forward</MenuRow>}
          <MenuRow warn onClick={() => setConfirmDelete(true)}>Delete</MenuRow>
          {!message.deleted && <MenuRow onClick={() => openDialog({ kind: 'file', msgId: message.id })}>Change where this is filed</MenuRow>}
          {message.issueId && <MenuRow onClick={() => openDialog({ kind: 'site-issue', issueId: message.issueId })}>Open linked issue</MenuRow>}
          {!message.deleted && thread.projectId && svc.assistKinds().includes('followup') && (message.text || message.transcript) && (
            <MenuRow onClick={() => openDesktopAssist('followup', { messageId: message.id })}>Suggest a follow-up</MenuRow>
          )}
          {!message.deleted && message.photo && svc.assistKinds().includes('concept') && (
            <MenuRow onClick={() => openDesktopAssist('concept', { messageId: message.id, projectId: thread.projectId || '' })}>Finish palette from this photo</MenuRow>
          )}
          {canPin && (
            <MenuRow onClick={() => svc.toggleDecision(message)}>{message.decision ? 'Unpin decision' : 'Pin as decision'}</MenuRow>
          )}
          <MenuRow onClick={() => setShowInfo((v) => !v)}>Info · sent, delivered, read</MenuRow>
          {showInfo && (
            <div className="rounded-r2 bg-surface-2 p-3 text-sm">
              <div>Sent · {message.at}</div>
              <div>Delivered · {message.at}</div>
              {others.map((id) => {
                const person = user(id);
                const read = id.charCodeAt(0) % 3 !== 0;
                return <div key={id}>{person.name} · {read ? `read ${message.at}` : 'not yet read'}</div>;
              })}
            </div>
          )}
          {!message.deleted && !remindOpen && <MenuRow onClick={() => setRemindOpen(true)}>Remind me</MenuRow>}
          {!message.deleted && remindOpen && (
            <>
              <MenuRow onClick={() => remind('tomorrow', 'Reminder set for tomorrow at 9am.')}>Tomorrow 9am</MenuRow>
              <MenuRow onClick={() => remind('monday', 'Reminder set for Monday at 9am.')}>Monday 9am</MenuRow>
            </>
          )}
          {reminded && <p className="text-sm text-ink-3">{reminded}</p>}
          {mine && !message.deleted && !!message.text && !message.voice && !editing && (
            <MenuRow onClick={() => setEditing(true)}>Edit</MenuRow>
          )}
          {editing && (
            <form className="mt-2" onSubmit={(e) => { e.preventDefault(); svc.editMessage(message, edit); setEditing(false); }}>
              <Field label="Edit"><Input value={edit} onChange={(e) => setEdit(e.target.value)} /></Field>
              <Btn kind="primary" type="submit">Save</Btn>
            </form>
          )}
        </div>
      )}
      <ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions>
    </Modal>
  );
}

export function ForwardDialog({ d }) {
  const message = state.db.MESSAGES.find((m) => m.id === d.msgId);
  const [picked, setPicked] = useState([]);
  if (!message) {
    return <Modal title="Forward to"><p>This message is no longer available.</p><ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions></Modal>;
  }
  const threads = conversationThreads();
  const toggle = (id) => setPicked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const send = () => {
    const fields = forwardFields(message, message.text || message.link?.title || 'Message');
    const sent = [];
    picked.forEach((id) => {
      try { const mid = svc.addMessage(id, fields); svc.classifySent(mid); sent.push(id); } catch (_) { /* skip a thread this role cannot write */ }
    });
    state.desk.dialog = null;
    if (sent.length === 1) state.desk.thread = sent[0];
    render();
    toast(sent.length ? 'Forwarded.' : 'Nothing was forwarded.');
  };
  return (
    <Modal title="Forward to">
      <div className="flex max-h-80 flex-col gap-1 overflow-auto">
        {threads.map((t) => {
          const on = picked.includes(t.id);
          return (
            <button key={t.id} type="button" aria-pressed={on} onClick={() => toggle(t.id)} className={`flex min-h-11 items-center gap-2 rounded-r1 border-0 px-2 text-left ${on ? 'bg-accent-soft' : 'bg-transparent'}`}>
              <span className="min-w-0 flex-1 truncate">{t.name}</span>
              {on && <Icon name="check" small />}
            </button>
          );
        })}
      </div>
      <ModalActions>
        <Btn onClick={closeDialog}>Cancel</Btn>
        <Btn kind="primary" disabled={!picked.length} onClick={send}>Forward{picked.length ? ` · ${picked.length}` : ''}</Btn>
      </ModalActions>
    </Modal>
  );
}

export function ChatInfoDialog({ d }) {
  const thread = svc.thread(d.threadId);
  const [tab, setTab] = useState('Photos');
  const [sample, setSample] = useState(null);
  if (!thread) {
    return <Modal title="Chat"><p>This chat isn’t available.</p><ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions></Modal>;
  }
  const members = thread.memberIds.map((id) => user(id)).filter((u) => u?.id);
  const other = thread.kind === 'dm' ? members.find((u) => u.id !== state.userId) : null;
  const muted = svc.chatMuted(thread.id);
  const msgs = svc.messages(thread.id).filter((m) => !m.deleted && !(m.hiddenFor || []).includes(state.userId));
  const buckets = {
    Photos: msgs.filter((m) => m.photo || (m.media && m.media.kind !== 'video')),
    Files: msgs.filter((m) => m.file || m.kind === 'file'),
    Links: msgs.filter((m) => m.link),
    Voice: msgs.filter((m) => m.voice || m.audio),
    Drawings: msgs.filter((m) => m.kind === 'drawing'),
  };
  const list = buckets[tab] || [];
  const samples = SAMPLE_MEDIA[thread.kind] || SAMPLE_MEDIA.internal;
  const about = {
    internal: 'Office only. The client never sees this.',
    client: 'The client is in this conversation.',
    site: 'Notes and photos for the site team.',
    dm: other ? `${other.title || 'Direct message'} · ${phoneOf(other)}` : 'Direct message',
    group: 'Group',
  }[thread.kind] || 'Members of this conversation';
  const openMsg = (id) => { state.desk.hi = id; state.desk.dialog = null; render(); };
  const visual = tab === 'Photos' || tab === 'Links';
  return (
    <Modal title={thread.name} wide>
      <div className="mb-4 flex flex-col items-center text-center">
        <span className="mb-2 inline-grid h-20 w-20 overflow-hidden rounded-full bg-surface-2 [&>.av]:h-full [&>.av]:w-full [&_svg]:h-full [&_svg]:w-full [&_img]:h-full [&_img]:w-full [&_img]:object-cover"><ThreadAvatar thread={thread} /></span>
        <b className="text-xl">{thread.name}</b>
        <span className="text-sm text-ink-2">{about}</span>
      </div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Media, links and docs</h3>
      <div className="mb-3 flex flex-wrap gap-2">
        {MEDIA_TABS.map((k) => (
          <Btn key={k} sm kind={k === tab ? 'primary' : 'default'} onClick={() => { setTab(k); setSample(null); }}>{k}</Btn>
        ))}
      </div>
      {visual && (list.length ? (
        <div className="grid grid-cols-3 gap-1">
          {list.map((m) => (
            <button key={m.id} type="button" className="aspect-square overflow-hidden border-0 bg-ground p-0" onClick={() => openMsg(m.id)} aria-label={m.link?.title || m.text || 'Photo'}>
              {(m.photo?.dataUrl || m.media?.dataUrl) ? <img src={m.photo?.dataUrl || m.media.dataUrl} alt="" className="h-full w-full object-cover" /> : <Ph hue={m.photo?.hue ?? m.link?.hue} seed={m.photo?.seed ?? m.link?.seed} />}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {(sample ? [] : samples).map((item) => (
            <button key={item.title} type="button" className="aspect-square overflow-hidden border-0 bg-ground p-0" onClick={() => setSample(item)} aria-label={item.title}>
              <Ph hue={item.hue} seed={item.seed} />
            </button>
          ))}
          {sample && (
            <div className="col-span-3">
              <Ph hue={sample.hue} seed={sample.seed} />
              <p className="mt-1.5 text-sm text-ink-3">{sample.title}</p>
            </div>
          )}
        </div>
      ))}
      {!visual && !list.length && <Empty>Nothing here yet.</Empty>}
      {!visual && list.map((m) => (
        <button key={m.id} type="button" className="flex w-full min-h-11 items-center border-0 border-t border-line bg-transparent py-2 text-left" onClick={() => openMsg(m.id)}>
          <span className="min-w-0 flex-1">
            <b className="block truncate">{m.voice ? 'Voice note' : m.kind === 'drawing' ? 'Drawing' : 'File'}</b>
            <small className="text-ink-3">{m.text || m.file?.name || (typeof m.voice === 'string' ? m.voice : m.voice?.dur) || 'Shared in this chat'}</small>
          </span>
        </button>
      ))}
      <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-ink-3">Options</h3>
      <button type="button" className="flex w-full min-h-11 items-center justify-between border-0 border-t border-line bg-transparent py-2 text-left" onClick={() => svc.setChatMuted(thread.id, !muted)}>
        <span><b className="block">Mute notifications</b><small className="text-ink-3">Stops the unread mark on this phone</small></span>
        <span className="text-ink-2">{muted ? 'On' : 'Off'}</span>
      </button>
      <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-ink-3">{thread.kind === 'dm' ? 'Contact' : `${members.length} people`}</h3>
      {members.map((u) => (
        <div key={u.id} className="flex min-h-11 items-center gap-3 border-t border-line py-2">
          <span className="inline-grid h-10 w-10 flex-none overflow-hidden rounded-full bg-surface-2 [&>.av]:h-full [&>.av]:w-full [&_svg]:h-full [&_svg]:w-full"><PersonAvatar person={u} /></span>
          <span className="min-w-0 flex-1"><b className="block truncate">{u.name}</b><small className="text-ink-3">{u.title} · {phoneOf(u)}</small></span>
          {u.id !== state.userId ? <a className="font-semibold text-accent-text" href={`tel:${phoneOf(u).replace(/\s/g, '')}`}>Call</a> : <span className="text-ink-3">You</span>}
        </div>
      ))}
      <ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions>
    </Modal>
  );
}

export function VoiceCallDialog({ d }) {
  const thread = svc.thread(d.threadId);
  if (!thread) return <Modal title="Call"><p>This chat isn’t available.</p><ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions></Modal>;
  const members = thread.memberIds.map((id) => user(id)).filter((u) => u?.id && u.id !== state.userId);
  return (
    <Modal title="Call">
      <p className="text-ink-3">Phone someone in this chat.</p>
      {members.map((u) => (
        <div key={u.id} className="flex min-h-11 items-center gap-2 border-t border-line py-2">
          <span className="min-w-0 flex-1"><b>{u.name}</b><br /><small className="text-ink-3">{u.title} · {phoneOf(u)}</small></span>
          <a href={`tel:${phoneOf(u).replace(/\s/g, '')}`}>Call</a>
        </div>
      ))}
      <ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions>
    </Modal>
  );
}

export function VoiceCapture({ onCancel, onSend }) {
  const [phase, setPhase] = useState('idle');
  const [audio, setAudio] = useState('');
  const [dur, setDur] = useState('0:00');
  const [note, setNote] = useState('');
  const rec = useRef(null);
  const chunks = useRef([]);
  const started = useRef(0);
  const timer = useRef(null);
  useEffect(() => () => { clearInterval(timer.current); rec.current?.stream?.getTracks()?.forEach((t) => t.stop()); }, []);
  const clock = (ms) => {
    const sec = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  };
  const start = async () => {
    setNote('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const media = new MediaRecorder(stream);
      chunks.current = [];
      media.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      media.onstop = () => {
        const blob = new Blob(chunks.current, { type: media.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => { setAudio(String(reader.result || '')); setPhase('ready'); };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.current = media;
      media.start();
      started.current = Date.now();
      timer.current = setInterval(() => setDur(clock(Date.now() - started.current)), 200);
      setPhase('recording');
    } catch (_) {
      setNote('The microphone did not open. Allow the microphone, then try again.');
    }
  };
  const stop = () => {
    clearInterval(timer.current);
    setDur(clock(Date.now() - started.current));
    try { rec.current?.stop(); } catch (_) { setNote('The recording could not be saved. Try again.'); setPhase('idle'); }
  };
  return (
    <div className="mb-2 rounded-r2 border border-line bg-surface p-3">
      <b className="block">Voice note</b>
      {phase === 'idle' && (
        <>
          <p className="text-sm text-ink-3">Tap once to record. You can listen to it, then send it into this chat.</p>
          {note && <p className="text-sm text-crit">{note}</p>}
          <div className="mt-2 flex gap-2"><Btn onClick={onCancel}>Cancel</Btn><Btn kind="primary" onClick={start}>Tap to record</Btn></div>
        </>
      )}
      {phase === 'recording' && (
        <div className="mt-2 flex items-center gap-2">
          <span>Recording · {dur}</span>
          <Btn kind="primary" onClick={stop}>Stop</Btn>
        </div>
      )}
      {phase === 'ready' && (
        <div className="mt-2">
          <audio src={audio} controls className="w-full" />
          <p className="text-sm text-ink-3">Tap play to hear the recording, then send it.</p>
          <div className="mt-2 flex gap-2">
            <Btn onClick={() => { setAudio(''); setDur('0:00'); setPhase('idle'); }}>Record again</Btn>
            <Btn kind="primary" onClick={() => onSend({ dur, audio })}>Send to this chat</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

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
  checkin: 'This tells the site chat that you have arrived.',
  daylog: 'This writes what happened on site today. You can read it before anyone else sees it.',
};

export function SiteCompose({ thread, what, label, onCancel, onPhoto, onSend, onCheckin, onDayLog }) {
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [fileName, setFileName] = useState('');
  const [drawingNo, setDrawingNo] = useState('');
  const [error, setError] = useState('');
  const drawings = thread.projectId ? (svc.project(thread.projectId)?.drawings || []) : [];
  const send = () => {
    const words = note.trim();
    const fields = { kind: what, text: words };
    if (what === 'drawing') {
      const drawing = drawings.find((d) => d.no === drawingNo);
      if (!drawing) { setError('Pick a drawing.'); return; }
      fields.text = `${drawing.name} · ${drawing.no} ${drawing.rev}`;
    } else if (what === 'location') {
      fields.text = words ? `Location: ${placeLine(thread)}. ${words}` : `Location: ${placeLine(thread)}`;
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
    } else if (what === 'sample') {
      if (!words) { setError('Say what this sample is.'); return; }
      fields.text = `Sample: ${words}`;
    } else if (what === 'delivery') {
      if (!words) { setError('Say what arrived.'); return; }
      fields.text = `Delivery: ${words}`;
    } else if (!words) { setError('Write a note first.'); return; }
    onSend(fields);
  };
  return (
    <div className="mb-2 rounded-r2 border border-line bg-surface p-3">
      <b className="block text-center">{label}</b>
      <p className="text-center text-sm text-ink-3">{STEP[what]}</p>
      {what === 'photo' && <Btn sm onClick={onPhoto}>Choose a photo</Btn>}
      {what === 'drawing' && (drawings.length ? drawings.map((item) => (
        <button key={item.no} type="button" className={`flex w-full min-h-11 items-center border-0 border-t border-line bg-transparent text-left ${drawingNo === item.no ? 'bg-accent-soft' : ''}`} onClick={() => setDrawingNo(item.no)}>
          <span className="min-w-0 flex-1"><b>{item.name}</b><br /><small>{item.no} · {item.rev}</small></span>
          {drawingNo === item.no && <Icon name="check" small />}
        </button>
      )) : <p className="text-sm text-ink-3">No drawings on this project yet.</p>)}
      {what === 'location' && <p className="font-semibold">{placeLine(thread)}</p>}
      {what === 'file' && (
        <>
          <input aria-label="Choose a file" type="file" onChange={(e) => setFileName(e.target.files?.[0]?.name || '')} />
          {fileName && <p className="text-sm text-ink-3">Only the name is sent. The file stays on this computer.</p>}
        </>
      )}
      {what === 'bill' && <Field label="Amount in ₹"><Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field>}
      {!['checkin', 'daylog', 'drawing'].includes(what) && (
        <Field label={what === 'sample' ? 'What is this sample?' : what === 'delivery' ? 'What arrived?' : what === 'bill' ? 'What was it for?' : what === 'material' ? 'What do you need?' : 'Add a note'}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={['photo', 'file', 'attendance', 'location'].includes(what) ? 'Optional' : ''} />
        </Field>
      )}
      {error && <p className="text-sm font-semibold text-crit">{error}</p>}
      <div className="mt-2 flex gap-2">
        <Btn onClick={onCancel}>Back</Btn>
        {what === 'checkin' ? <Btn kind="primary" onClick={onCheckin}>Check in</Btn>
          : what === 'daylog' ? <Btn kind="primary" onClick={onDayLog}>Write today’s log</Btn>
            : <Btn kind="primary" onClick={send}>Send</Btn>}
      </div>
    </div>
  );
}
