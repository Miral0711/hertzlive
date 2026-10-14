import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../shared/store';
import { AIProvider, toast } from '../shared/core';
import { filingLabel } from '../shared/filing';
import { siteHasSuggestion } from '../shared/chatExtras';
import Icon from './Icon';
import { useField } from './FieldContext';
import { Swatch } from './frame';
import { Avatar } from './faces';
import { ThreadHeader } from './Chats';
import PhotoEdit from './PhotoEdit';
import { ForwardPick, MessageActions, VoicePlay } from './ChatPages';
import { t } from './copy';
import {
  svc, siblings, messagesOf, audience, firstName, fmtT, dayLabel, preview, state, can, onPhone,
  postMessage, toggleReaction, toggleDecision, projectOf, siteFor, staff, user, phoneOf,
} from './model';

const BASICS = () => ([
  ['photo', t('Photo'), 'photos'],
  ['camera', t('Camera'), 'camera'],
  ['voice', t('Voice note'), 'mic'],
  ['drawing', t('Drawing'), 'drawing'],
  ['delivery', t('Delivery'), 'delivery'],
  ['sample', t('Sample'), 'sample'],
]);
const MORE = () => ([
  ['location', t('Location'), 'location'],
  ['bill', t('Bill / expense'), 'bill'],
  ['material', t('Material request'), 'delivery', ['site_manager', 'contractor', 'partner', 'designer']],
  ['attendance', t('Attendance'), 'people', ['site_manager', 'contractor']],
  ['file', t('File'), 'file'],
  ['checkin', t('Check in'), 'today', ['site_manager', 'contractor']],
  ['daylog', t('Today\'s log'), 'today', ['site_manager', 'partner', 'designer']],
  ['poll', t('Poll'), 'checkcheck'],
  ['contact', t('Contact'), 'people'],
  ['document', t('Document'), 'file'],
  ['audio', t('Audio'), 'mic'],
]);
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
          aria-label={t('Message options')}
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
  const who = !f ? '' : f.by === 'user' ? t('Filed') : f.status === 'filed' ? t('AI filed') : f.status === 'check' ? t('AI check') : t('AI needs context');
  const label = !f ? t('File message') : `${who} · ${f.status === 'ask' ? t('Which project?') : (filingLabel(f) || t('Note'))}`;
  return <Link className={`file-chip ${status}`} to={`/mobile/chats/${threadId}/messages/${m.id}/filing?from=chat`}>{label}</Link>;
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
  const [error, setError] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [menu, setMenu] = useState(null);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [editor, setEditor] = useState(null);
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState(['', '']);
  const [pollMulti, setPollMulti] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [pickedId, setPickedId] = useState('');
  const [contactQuery, setContactQuery] = useState('');
  const [newContact, setNewContact] = useState(false);
  const [docUrl, setDocUrl] = useState('');
  const [voiceMode, setVoiceMode] = useState(null);
  const [voiceDur, setVoiceDur] = useState('0:00');
  const [voiceHint, setVoiceHint] = useState('');
  const [slideCancel, setSlideCancel] = useState(false);
  const location = useLocation();
  const [params] = useSearchParams();
  const from = params.get('from');
  const backTo = from && from.startsWith('/mobile/') ? from : '/mobile/chats';
  const scroller = useRef(null);
  const box = useRef(null);
  const photoInput = useRef(null);
  const fileInput = useRef(null);
  const pendingKind = useRef('');
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const voiceChunks = useRef([]);
  const voiceTimer = useRef(null);
  const voiceStarted = useRef(0);
  const voiceToken = useRef(0);
  const holdRef = useRef(null);
  const sendOnStop = useRef(false);
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
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, 120);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > 120 ? 'auto' : 'hidden';
  }, [text, threadId]);

  useEffect(() => {
    const el = scroller.current;
    const id = window.location.hash.slice(1);
    if (id && document.getElementById(id)) {
      document.getElementById(id).scrollIntoView({ block: 'center' });
      return;
    }
    if (el) el.scrollTop = el.scrollHeight;
  }, [threadId, count]);

  useEffect(() => () => {
    voiceToken.current += 1;
    sendOnStop.current = false;
    clearInterval(voiceTimer.current);
    const rec = recRef.current;
    recRef.current = null;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = () => streamRef.current?.getTracks().forEach((track) => track.stop());
      try { rec.stop(); } catch { /* already stopped */ }
    } else {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    }
  }, []);

  useEffect(() => {
    if (!voiceHint) return undefined;
    const id = window.setTimeout(() => setVoiceHint(''), 2500);
    return () => window.clearTimeout(id);
  }, [voiceHint]);

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
        <header className="top"><h1>{t('Chat')}</h1></header>
        <div className="empty"><h3>{t('This chat isn’t available')}</h3><Link to="/mobile/chats">{t('Back to chats')}</Link></div>
      </div>
    );
  }

  if (editor) {
    const ask = { sample: t('What is this sample?'), delivery: t('What arrived?') }[editor.what];
    return (
      <div className="screen">
        <PhotoEdit
          src={editor.src}
          noteLabel={ask || t('Add a caption')}
          noteRequired={Boolean(ask)}
          initialNote={editor.note || ''}
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
  const lastLive = [...msgs].reverse().find((m) => !m.deleted);
  const showSuggest = staff() && can('thread', 'w') && lastLive && lastLive.by !== state.userId;
  const showQuick = can('thread', 'w') && lastLive && lastLive.by !== state.userId && /\?/.test(lastLive.text || '');

  function showInChat(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.classList.add('flash');
    window.setTimeout(() => el.classList.remove('flash'), 1600);
  }

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
    setPollQ('');
    setPollOpts(['', '']);
    setPollMulti(false);
    setContactName('');
    setContactPhone('');
    setPickedId('');
    setContactQuery('');
    setNewContact(false);
    setDocUrl('');
    setSheet({ what: item[0], label: item[1] });
  }

  function readPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const what = e.target.dataset.kind || pendingKind.current || 'photo';
    pendingKind.current = '';
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || '');
      if (['photo', 'sample', 'delivery'].includes(what)) {
        setEditor({ what, src, note: what === 'delivery' ? note.trim() : '' });
        setSheet(null);
        return;
      }
      setShot(src);
    };
    reader.readAsDataURL(file);
  }

  function readFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const what = pendingKind.current || 'file';
    pendingKind.current = '';
    if (!file) return;
    setError('');
    setNote('');
    setFileName(file.name);
    setDocUrl('');
    if (what === 'document' || what === 'audio') {
      const reader = new FileReader();
      reader.onload = () => setDocUrl(String(reader.result || ''));
      reader.readAsDataURL(file);
    }
    setSheet({ what, label: t({ file: 'File', document: 'Document', audio: 'Audio' }[what] || 'File') });
  }

  function openPicker(kind) {
    pendingKind.current = kind;
    const input = kind === 'photo' || kind === 'sample' || kind === 'delivery' ? photoInput.current : fileInput.current;
    if (!input) return;
    input.accept = kind === 'audio' ? 'audio/*' : (kind === 'photo' || kind === 'sample' || kind === 'delivery' ? 'image/*' : '');
    input.value = '';
    input.click();
    setSheet(null);
  }

  function clock(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function discardVoice() {
    voiceToken.current += 1;
    sendOnStop.current = false;
    clearInterval(voiceTimer.current);
    const rec = recRef.current;
    recRef.current = null;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };
      try { rec.stop(); } catch { /* already stopped */ }
    } else {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setVoiceMode(null);
    setSlideCancel(false);
    setVoiceDur('0:00');
  }

  function finishVoice(shouldSend) {
    const rec = recRef.current;
    if (!shouldSend || !rec || rec.state !== 'recording') {
      discardVoice();
      if (shouldSend) setVoiceHint(t('Hold to record. Release to send.'));
      return;
    }
    sendOnStop.current = true;
    setVoiceMode(null);
    setSlideCancel(false);
    recRef.current = null;
    clearInterval(voiceTimer.current);
    rec.stop();
  }

  async function beginVoice(mode) {
    const token = ++voiceToken.current;
    setVoiceHint('');
    setSlideCancel(false);
    if (mode === 'locked') setSheet(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (token !== voiceToken.current || (mode === 'hold' && !holdRef.current)) {
        stream.getTracks().forEach((track) => track.stop());
        if (mode === 'hold' && !holdRef.current) setVoiceHint(t('Hold to record. Release to send.'));
        return;
      }
      streamRef.current = stream;
      const mime = window.MediaRecorder?.isTypeSupported?.('audio/webm') ? 'audio/webm' : '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      voiceChunks.current = [];
      rec.ondataavailable = (ev) => { if (ev.data.size) voiceChunks.current.push(ev.data); };
      rec.onstop = () => {
        const shouldSend = sendOnStop.current;
        const startedAt = voiceStarted.current;
        stream.getTracks().forEach((track) => track.stop());
        if (streamRef.current === stream) streamRef.current = null;
        if (!shouldSend) return;
        const dur = clock(Date.now() - startedAt);
        const blob = new Blob(voiceChunks.current, { type: rec.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const audio = String(reader.result || '');
          if (!audio) return;
          postMessage(thread.id, { voice: { dur, audio } });
          markRead(thread.id);
        };
        reader.readAsDataURL(blob);
      };
      recRef.current = rec;
      voiceStarted.current = Date.now();
      setVoiceDur('0:00');
      voiceTimer.current = setInterval(() => setVoiceDur(clock(Date.now() - voiceStarted.current)), 200);
      rec.start();
      setVoiceMode(mode);
    } catch {
      setVoiceMode(null);
      setVoiceHint(t('The microphone did not open. Allow the microphone, then try again.'));
    }
  }

  function micDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    holdRef.current = { id: e.pointerId, x: e.clientX, at: Date.now(), cancel: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    beginVoice('hold');
  }

  function micMove(e) {
    const hold = holdRef.current;
    if (!hold || e.pointerId !== hold.id) return;
    const cancel = e.clientX - hold.x < -64;
    if (cancel !== hold.cancel) {
      hold.cancel = cancel;
      setSlideCancel(cancel);
    }
  }

  function micUp(e) {
    const hold = holdRef.current;
    if (!hold || e.pointerId !== hold.id) return;
    const cancel = hold.cancel;
    const held = Date.now() - hold.at;
    holdRef.current = null;
    if (cancel) {
      discardVoice();
      return;
    }
    if (held < 700 || !recRef.current || recRef.current.state !== 'recording') {
      discardVoice();
      setVoiceHint(t('Hold to record. Release to send.'));
      return;
    }
    finishVoice(true);
  }

  function placeLine() {
    const project = thread.projectId ? projectOf(thread.projectId) : null;
    const site = thread.siteId ? svc.site(thread.siteId) : (thread.projectId ? siteFor(thread.projectId) : null);
    return [site?.name, project?.city].filter(Boolean).join(', ') || 'the studio';
  }

  function pick(item) {
    const key = item[0];
    if (key === 'voice') {
      beginVoice('locked');
      return;
    }
    if (key === 'camera') {
      setSheet(null);
      navigate(`/mobile/camera?thread=${thread.id}`);
      return;
    }
    if (key === 'photo') {
      openPicker('photo');
      return;
    }
    if (key === 'file' || key === 'document' || key === 'audio') {
      openPicker(key);
      return;
    }
    if (key === 'checkin') {
      doCheckin();
      return;
    }
    if (key === 'daylog') {
      openDayLog();
      return;
    }
    openForm(item);
  }

  function doCheckin() {
    const siteId = thread.siteId || svc.mySiteIds()[0];
    if (!siteId) {
      setError(t('No site to use here.'));
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
      setError(t('No site to use here.'));
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
      if (!shot) { setError(t('Choose a photo first.')); return; }
      fields.text = words || 'Photo';
      fields.photo = { dataUrl: shot, hue: 28, seed: 4 };
    } else if (what === 'sample') {
      if (!words) { setError(t('Say what this sample is.')); return; }
      fields.text = `Sample: ${words}`;
      if (shot) fields.photo = shot.startsWith('data:') ? { dataUrl: shot, hue: 28, seed: 4 } : { hue: 28, seed: 4 };
    } else if (what === 'delivery') {
      if (!words) { setError(t('Say what arrived.')); return; }
      fields.text = `Delivery: ${words}`;
      if (shot.startsWith('data:')) fields.photo = { dataUrl: shot, hue: 28, seed: 4 };
    } else if (what === 'location') {
      fields.text = words ? `Location: ${placeLine()}. ${words}` : `Location: ${placeLine()}`;
    } else if (what === 'bill') {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) { setError(t('Enter an amount greater than zero.')); return; }
      if (!words) { setError(t('Say what the money was for.')); return; }
      fields.bill = { amount: value, status: 'asked', paidBy: 'cash', projectId: thread.projectId };
      fields.text = `${words} · ₹${value.toLocaleString('en-IN')}`;
    } else if (what === 'material') {
      if (!words) { setError(t('Say what you need.')); return; }
      fields.text = `Material needed: ${words}`;
    } else if (what === 'file') {
      if (!fileName) { setError(t('Choose a file first.')); return; }
      fields.text = words ? `File: ${fileName}. ${words}` : `File: ${fileName}`;
    } else if (what === 'attendance') {
      fields.text = words ? `Attendance recorded for today. ${words}` : 'Attendance recorded for today';
    } else if (what === 'poll') {
      const options = pollOpts.map((o) => o.trim()).filter(Boolean);
      if (!pollQ.trim() || options.length < 2) { setError(t('Add a question and at least two options.')); return; }
      fields.poll = { question: pollQ.trim(), multi: pollMulti, options: options.map((text) => ({ text, votes: [] })) };
      fields.text = pollQ.trim();
    } else if (what === 'contact') {
      if (pickedId) {
        const person = user(pickedId);
        fields.contact = { userId: pickedId, name: person.name || firstName(pickedId), phone: phoneOf(person) };
        fields.text = fields.contact.name;
      } else if (contactName.trim()) {
        fields.contact = { name: contactName.trim(), phone: contactPhone.trim() };
        fields.text = contactName.trim();
      } else { setError(t('Choose a person.')); return; }
    } else if (what === 'document' || what === 'audio') {
      if (!fileName) { setError(what === 'audio' ? t('Choose an audio file.') : t('Choose a document.')); return; }
      if (what === 'audio') fields.audio = { dataUrl: docUrl, name: fileName };
      else fields.file = { name: fileName, dataUrl: docUrl };
      fields.text = words ? `${fileName}. ${words}` : fileName;
      delete fields.kind;
    } else {
      if (!words) { setError(t('Write a note first.')); return; }
    }
    postMessage(thread.id, fields);
    setSheet(null);
    markRead(thread.id);
  }

  const tiles = sheet === 'plus' ? BASICS() : sheet === 'more' ? MORE().filter((item) => allowed(item[3])) : [];
  const drawings = thread.projectId && can('drawing', 'r') ? (projectOf(thread.projectId)?.drawings || []) : [];

  return (
    <div className="screen">
      <ThreadHeader thread={thread} backTo={backTo} />
      {(related.length > 0 || (thread.projectId && thread.kind !== 'dm' && thread.groupType !== 'work')) && (
        <div className="switcher" role="tablist" aria-label={t('Conversations in this project')}>
          {related.map((t) => (
            <Link key={t.id} role="tab" aria-selected={t.id === thread.id} className={t.id === thread.id ? 'on' : ''} to={`/mobile/chats/${t.id}${from ? `?from=${encodeURIComponent(from)}` : ''}`}>
              {audience(t)}
            </Link>
          ))}
          {thread.projectId && thread.kind !== 'dm' && thread.groupType !== 'work' && (
            <Link role="tab" aria-selected={false} to={`/mobile/chats/${thread.id}/work`}>{t('Work groups')}</Link>
          )}
        </div>
      )}
      {thread.kind === 'internal' && <p className="office-note">{t('officeOnly')}</p>}
      {pinned.length > 0 && (
        <div className="chat-decisions">
          {pinned.map((m) => (
            <div className="chat-pin" key={m.id}>
              <button type="button" className="jump" onClick={() => showInChat(m.id)}>
                <em>{t('Pinned')}</em>
                <b>{m.text || t('Decision')}</b>
              </button>
              {canPin && <button type="button" className="unpin" onClick={() => toggleDecision(m)}>{t('Unpin')}</button>}
            </div>
          ))}
        </div>
      )}
      <div className="body chat chat-wallpaper" ref={scroller}>
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
                {m.decision && !m.deleted && <span className="tag">{t('Decision')}</span>}
                {m.deleted ? <p className="gone">{t('This message was deleted')}</p> : (
                  <>
                    {m.forwarded && <span className="fwd">{t('Forwarded')}</span>}
                    {m.replyTo && (() => {
                      const quoted = msgs.find((x) => x.id === m.replyTo);
                      return <span className="quote"><b>{quoted ? firstName(quoted.by) : ''}</b><span>{preview(quoted)}</span></span>;
                    })()}
                    {m.voice && <VoicePlay src={typeof m.voice === 'object' ? m.voice.audio : ''} dur={typeof m.voice === 'string' ? m.voice : (m.voice.dur || '')} />}
                    {m.photo?.dataUrl && <img className="shot" src={m.photo.dataUrl} alt="" />}
                    {m.photo && !m.photo.dataUrl && <Swatch hue={m.photo.hue} seed={m.photo.seed} />}
                    {(m.kind && !m.photo) && !m.voice && <span className="chip">{({ drawing: t('Drawing'), delivery: t('Delivery'), sample: t('Sample'), location: t('Location'), bill: t('Bill'), material: t('Material'), file: t('File'), attendance: t('Attendance'), checkin: t('Checked in') })[m.kind] || m.kind}</span>}
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
                    {m.call && <p><b>{t('Video call')}</b> · {m.call.provider}<br /><a href={m.call.url} target="_blank" rel="noopener noreferrer">{m.call.url}</a></p>}
                    {m.file?.dataUrl && <p><a href={m.file.dataUrl} download={m.file.name}>{t('Download {0}', m.file.name)}</a></p>}
                    {m.imported && <small>{t('imported from WhatsApp')}</small>}
                    {m.options?.length > 0 && m.options.map((o) => <button type="button" key={o} onClick={() => svc.recordChatDecision(m, o)}>{o}</button>)}
                    {m.approval && (m.approval.done ? <span className="chip">{t('approved')}</span> : state.role === 'client' ? <button type="button" onClick={() => svc.approveChatMessage(m)}>{m.approval.label}</button> : <span className="chip">{t('{0} · waiting', m.approval.label)}</span>)}
                    {m.bill && state.role === 'partner' && m.bill.status === 'asked' && m.by !== state.userId && (
                      <p>
                        <button type="button" onClick={() => svc.decideBill(m, true)}>{t('Approve')}</button>
                        <button type="button" onClick={() => svc.decideBill(m, false)}>{t('Ask for bill')}</button>
                      </p>
                    )}
                    {!m.deleted && m.issueId && <Link className="extra" to={`/mobile/issues/${m.issueId}`}>{t('Open linked issue')}</Link>}
                    {!m.deleted && siteHasSuggestion(svc.siteUpdateReview(m.id)) && <Link className="extra" to={`/mobile/chats/${thread.id}/messages/${m.id}`}>{t('Review site update')}</Link>}
                    {m.text && !m.voice ? <p><span className="say">{m.text}</span></p> : null}
                    {staff() && !m.deleted && (((m.text || m.transcript) && thread.projectId && svc.assistKinds().includes('followup')) || (m.photo && svc.assistKinds().includes('concept'))) && (
                      <details className="assist">
                        <summary>{t('Help with this update')}</summary>
                        {(m.text || m.transcript) && thread.projectId && svc.assistKinds().includes('followup') && (
                          <Link className="extra" to={`/mobile/assist?kind=followup&message=${m.id}`}>{t('Suggest follow-up')}</Link>
                        )}
                        {m.photo && svc.assistKinds().includes('concept') && (
                          <Link className="extra" to={`/mobile/assist?kind=concept&message=${m.id}&project=${thread.projectId || ''}`}>{t('Explore finishes')}</Link>
                        )}
                      </details>
                    )}
                    <div className="meta">
                      {staff() && <FileChip threadId={thread.id} m={m} />}
                      <time title={receipt === 'seen' ? t('Seen') : receipt === 'delivered' ? t('Delivered') : receipt === 'sent' ? t('Sent') : undefined}>
                        {m.edited ? t('Edited · ') : ''}{fmtT(m.at)}
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
                      <button type="button" key={emoji} className={ids.includes(state.userId) ? 'on' : ''} onClick={() => toggleReaction(m, emoji)} aria-label={t('React {0}', emoji)}>
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
        {!msgs.length && <div className="empty"><h3>{thread.groupType === 'work' ? t('No messages yet') : t('Say hello')}</h3>{thread.groupType !== 'work' && <p>{t('Photos and voice notes stay with this project.')}</p>}</div>}
      </div>
      {(showSuggest || showQuick) && (
        <div className="quick">
          {showQuick && [t('yes'), t('ok'), t('onMyWay')].map((label) => (
            <button type="button" key={label} onClick={() => { postMessage(thread.id, { text: label, replyTo: lastLive.id }); markRead(thread.id); }}>{label}</button>
          ))}
          {showSuggest && (
            <button type="button" className="suggest" onClick={async () => {
              if ((drafts[thread.id] || '').trim()) { toast(t('Your draft was kept. Clear it before requesting an AI suggestion.')); return; }
              try { setDraft(thread.id, await AIProvider.draftReply(thread, lastLive)); }
              catch (_) { toast(t('AI reply unavailable. Your conversation and draft are unchanged.')); }
            }}>{t('Suggest reply')}</button>
          )}
        </div>
      )}
      {replyTo && (
        <div className="replybar">
          <span><b>{firstName(replyTo.by)}</b>{preview(replyTo)}</span>
          <button type="button" aria-label={t('Cancel reply')} onClick={() => setReplyTo(null)}><Icon name="x" /></button>
        </div>
      )}
      {voiceHint ? <p className="voice-hint">{voiceHint}</p> : null}
      {can('thread', 'w') && <form className={`composer ${voiceMode === 'hold' ? 'holding' : ''}`} onSubmit={send}>
        {voiceMode === 'locked' ? (
          <div className="pill rec-hold">
            <button type="button" className="round" aria-label={t('Delete voice note')} onClick={discardVoice}>
              <Icon name="trash" />
            </button>
            <span className="rec-time"><i />{voiceDur}</span>
          </div>
        ) : voiceMode === 'hold' ? (
          <div className="pill rec-hold">
            <span className={slideCancel ? 'rec-cancel' : ''}>{slideCancel ? t('Release to cancel') : t('Slide to cancel')}</span>
            <span className="rec-time"><i />{voiceDur}</span>
          </div>
        ) : (
          <div className="pill">
            <button type="button" className="round" aria-label={t('Add to this chat')} onClick={() => { setError(''); setSheet('plus'); }}>
              <Icon name="plus" />
            </button>
            <textarea
              ref={box}
              rows={1}
              placeholder={t('message')}
              aria-label={t('Message to {0}', audience(thread))}
              value={text}
              onChange={(e) => setDraft(thread.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
              }}
            />
            {!text.trim() && (
              <button type="button" className="round cam" aria-label={t('Camera')} onClick={() => navigate(`/mobile/camera?thread=${thread.id}`)}>
                <Icon name="camera" />
              </button>
            )}
          </div>
        )}
        {voiceMode === 'locked' ? (
          <button type="button" className="round send" aria-label={t('Send voice note')} onClick={() => finishVoice(true)}>
            <Icon name="send" />
          </button>
        ) : text.trim() && !voiceMode ? (
          <button type="submit" className="round send" aria-label={t('send')}>
            <Icon name="send" />
          </button>
        ) : (
          <button
            type="button"
            className="round send mic"
            aria-label={t('Hold to record a voice note')}
            onPointerDown={micDown}
            onPointerMove={micMove}
            onPointerUp={micUp}
            onPointerCancel={micUp}
            onContextMenu={(e) => e.preventDefault()}
          >
            <Icon name="mic" />
          </button>
        )}
      </form>}
      {sheet && (
        <div className="sheet-back" onClick={() => setSheet(null)} role="presentation">
          <div className="sheet" role="dialog" aria-label={t('Add to chat')} onClick={(e) => e.stopPropagation()}>
            {sheet === 'plus' || sheet === 'more' ? (
              <>
                <div className="sheet-title">
                  {sheet === 'more' ? (
                    <button type="button" className="sheet-back-link" aria-label={t('Back')} onClick={() => setSheet('plus')}>
                      <Icon name="chev" />
                    </button>
                  ) : <span />}
                  <h2>{sheet === 'plus' ? t('Add to this chat') : t('More')}</h2>
                  <span />
                </div>
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
              </>
            ) : (
              <form className="stack" onSubmit={sendAttach}>
                {['location', 'poll', 'contact'].includes(sheet.what) ? (
                  <div className="wa-bar">
                    <button type="button" aria-label={t('Close')} onClick={() => setSheet(MORE().some((item) => item[0] === sheet.what) ? 'more' : 'plus')}>
                      <Icon name="x" />
                    </button>
                    <b>{sheet.what === 'contact' ? t('Send contact') : sheet.label}</b>
                    {sheet.what === 'location' ? <span /> : (
                      <button
                        type="submit"
                        className="round send"
                        aria-label={t('Send')}
                        disabled={sheet.what === 'poll'
                          ? (!pollQ.trim() || pollOpts.filter((o) => o.trim()).length < 2)
                          : (!pickedId && !contactName.trim())}
                      >
                        <Icon name="send" />
                      </button>
                    )}
                  </div>
                ) : <h2>{sheet.label}</h2>}
                {(sheet.what === 'sample' || sheet.what === 'delivery') && (
                  <>
                    {sheet.what === 'delivery' && (
                      <label>{t('What arrived?')}
                        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} aria-label={t('What arrived?')} />
                      </label>
                    )}
                    <label className={sheet.what === 'sample' ? 'primary file-pick' : 'ghost file-pick'}>
                      {sheet.what === 'delivery' ? t('Add a photo') : t('Choose a photo')}
                      <input type="file" accept="image/*" data-kind={sheet.what} onChange={readPhoto} />
                    </label>
                    {sheet.what === 'sample' && (
                      <button type="button" className="text-btn" onClick={() => { setEditor({ what: 'sample', src: '/images/p01.jpg' }); setSheet(null); }}>{t('Use a sample picture')}</button>
                    )}
                    {sheet.what === 'sample' && (
                      <label>{t('Or name it without a photo')}
                        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} aria-label={t('What is this sample?')} placeholder={t('What is this sample?')} />
                      </label>
                    )}
                  </>
                )}
                {sheet.what === 'drawing' && (
                  drawings.length ? drawings.map((d) => (
                    <button type="button" className="row" key={d.no} onClick={() => {
                      postMessage(thread.id, { kind: 'drawing', text: `${d.name} · ${d.no} ${d.rev}` });
                      setSheet(null);
                      markRead(thread.id);
                    }}>
                      <span className="row-copy"><b>{d.name}</b><span>{d.no} · {d.rev}</span></span>
                    </button>
                  )) : <p className="note">{can('drawing', 'r') ? t('No drawings on this project yet.') : t('Drawings aren’t available for this login.')}</p>
                )}
                {sheet.what === 'location' && (
                  <>
                    <button type="button" className="wa-loc" onClick={() => {
                      const words = note.trim();
                      postMessage(thread.id, { kind: 'location', text: words ? `Location: ${placeLine()}. ${words}` : `Location: ${placeLine()}` });
                      setSheet(null);
                      markRead(thread.id);
                    }}>
                      <span className="wa-pin"><Icon name="location" /></span>
                      <span className="row-copy"><b>{t('Send your current location')}</b><span>{placeLine()}</span></span>
                    </button>
                    <input className="wa-line" value={note} onChange={(e) => setNote(e.target.value)} aria-label={t('Add a message')} placeholder={t('Add a message')} />
                  </>
                )}
                {sheet.what === 'file' && (
                  <>
                    <label className="ghost file-pick">{fileName || t('Choose a file')}<input type="file" onChange={(e) => { setFileName(e.target.files?.[0]?.name || ''); e.target.value = ''; }} /></label>
                    {fileName ? <p className="note">{t('Only the name is sent. The file stays on this phone.')}</p> : null}
                  </>
                )}
                {(sheet.what === 'document' || sheet.what === 'audio') && (
                  <>
                    <p className="voice-line">{fileName}</p>
                    {sheet.what === 'audio' && docUrl ? <audio src={docUrl} controls /> : null}
                    <label className="ghost file-pick">{t('Choose a different file')}
                      <input type="file" accept={sheet.what === 'audio' ? 'audio/*' : undefined} onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        setFileName(file.name);
                        const reader = new FileReader();
                        reader.onload = () => setDocUrl(String(reader.result || ''));
                        reader.readAsDataURL(file);
                      }} />
                    </label>
                    <label>{t('Add a caption')}
                      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} aria-label={t('Add a caption')} placeholder={t('Add a caption')} />
                    </label>
                  </>
                )}
                {sheet.what === 'poll' && (
                  <>
                    <input className="wa-line" value={pollQ} onChange={(e) => setPollQ(e.target.value)} aria-label={t('Question')} placeholder={t('Ask a question')} />
                    {pollOpts.map((o, i) => (
                      <div className="wa-opt" key={i}>
                        <i aria-hidden="true" />
                        <input value={o} aria-label={t('Option {0}', i + 1)} placeholder={t('Add')} onChange={(e) => setPollOpts((list) => list.map((x, j) => (j === i ? e.target.value : x)))} />
                      </div>
                    ))}
                    {pollOpts.length < 6 && <button type="button" className="wa-add" onClick={() => setPollOpts((list) => [...list, ''])}>{t('Add option')}</button>}
                    <label className="wa-switch">
                      {t('Allow multiple answers')}
                      <input type="checkbox" role="switch" checked={pollMulti} onChange={(e) => setPollMulti(e.target.checked)} />
                    </label>
                  </>
                )}
                {sheet.what === 'contact' && (
                  <>
                    <input className="wa-line" value={contactQuery} onChange={(e) => setContactQuery(e.target.value)} aria-label={t('Search contacts')} placeholder={t('Search name or number')} />
                    {(thread.memberIds || []).filter((id) => id !== state.userId).filter((id) => {
                      const person = user(id);
                      const q = contactQuery.trim().toLowerCase();
                      return !q || `${person.name} ${phoneOf(person)}`.toLowerCase().includes(q);
                    }).map((id) => {
                      const person = user(id);
                      return (
                        <button type="button" key={id} className={`wa-person ${pickedId === id ? 'on' : ''}`} onClick={() => { setPickedId(id); setNewContact(false); setContactName(''); setContactPhone(''); }}>
                          <Avatar person={person} />
                          <span className="row-copy"><b>{person.name || firstName(id)}</b><span>{phoneOf(person)}</span></span>
                          <span className="wa-tick" aria-hidden="true">{pickedId === id ? <Icon name="check" /> : null}</span>
                        </button>
                      );
                    })}
                    <button type="button" className="wa-add" onClick={() => { setNewContact((v) => !v); setPickedId(''); }}>{newContact ? t('Choose someone in this chat') : t('New contact')}</button>
                    {newContact && (
                      <>
                        <input className="wa-line" value={contactName} onChange={(e) => { setContactName(e.target.value); setPickedId(''); }} aria-label={t('Name')} placeholder={t('Name')} />
                        <input className="wa-line" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} aria-label={t('Phone')} placeholder={t('Phone')} inputMode="tel" />
                      </>
                    )}
                  </>
                )}
                {sheet.what === 'bill' && (
                  <label>{t('Amount in ₹')}
                    <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={t('Amount')} placeholder="0" />
                  </label>
                )}
                {!['checkin', 'daylog', 'drawing', 'location', 'poll', 'contact', 'document', 'audio', 'sample', 'delivery', 'photo'].includes(sheet.what) && (
                  <label>{sheet.what === 'bill' ? t('What was it for?') : sheet.what === 'material' ? t('What do you need?') : sheet.what === 'file' ? t('Add a caption') : t('Note')}
                    <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} aria-label={sheet.what === 'bill' ? t('What was it for?') : sheet.what === 'material' ? t('What do you need?') : t('Add a caption')} placeholder={sheet.what === 'file' ? t('Add a caption') : t('Optional')} />
                  </label>
                )}
                {error ? <p className="warn-text">{error}</p> : null}
                {!['drawing', 'location', 'poll', 'contact'].includes(sheet.what) && (
                  <button
                    className="primary"
                    type="submit"
                    disabled={
                      ((sheet.what === 'delivery' || sheet.what === 'sample' || sheet.what === 'material') && !note.trim())
                      || (sheet.what === 'bill' && (!note.trim() || !(Number(amount) > 0)))
                    }
                  >{t('Send')}</button>
                )}
                {!['location', 'poll', 'contact'].includes(sheet.what) && (
                  <button type="button" className="text-btn" onClick={() => setSheet(sheet.what && MORE().some((item) => item[0] === sheet.what) ? 'more' : 'plus')}>{t('Back')}</button>
                )}
              </form>
            )}
          </div>
        </div>
      )}
      <input ref={photoInput} className="file-off" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" onChange={readPhoto} />
      <input ref={fileInput} className="file-off" type="file" tabIndex={-1} aria-hidden="true" onChange={readFile} />
      {menu && (
        <div className="sheet-back" onClick={() => setMenu(null)} role="presentation">
            <div className="sheet" role="dialog" aria-label={t('More options')} onClick={(e) => e.stopPropagation()}>
            <p className="note">{preview(menu)}</p>
            <MessageActions thread={thread} message={menu} onReply={() => { setReplyTo(menu); setMenu(null); }} onDeleted={() => setMenu(null)} onForward={() => { setForwardMsg(menu); setMenu(null); }} />
            <button type="button" className="text-btn" onClick={() => setMenu(null)}>{t('Close')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
