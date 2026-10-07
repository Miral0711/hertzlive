import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../shared/store';
import Icon from './Icon';
import { useField } from './FieldContext';
import { Swatch } from './frame';
import { ThreadHeader } from './Chats';
import { ForwardPick, MessageActions, VoicePlay } from './ChatPages';
import { t } from './copy';
import {
  svc, siblings, messagesOf, audience, firstName, fmtT, dayLabel, preview, state, can, onPhone,
  postMessage, toggleReaction, toggleDecision, projectOf, siteFor,
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
];
const STEP = {
  photo: 'Choose a photo from this phone. It goes into this chat when you press Send.',
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
    setSheet({ what: item[0], label: item[1] });
  }

  function readPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setShot(String(reader.result || ''));
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
      {related.length > 0 && (
        <div className="switcher" role="tablist" aria-label="Conversations in this project">
          {related.map((t) => (
            <Link key={t.id} role="tab" aria-selected={t.id === thread.id} className={t.id === thread.id ? 'on' : ''} to={`/mobile/chats/${t.id}`}>
              {audience(t)}
            </Link>
          ))}
        </div>
      )}
      {thread.kind === 'internal' && <p className="banner">{t('officeOnly')}</p>}
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
                {!mine && !same && <span className="who">{firstName(m.by)}</span>}
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
                    <p>
                      {m.text && !m.voice ? <span className="say">{m.text}</span> : null}
                      <time title={receipt === 'seen' ? 'Seen' : receipt === 'delivered' ? 'Delivered' : receipt === 'sent' ? 'Sent' : undefined}>
                        {m.edited ? 'Edited · ' : ''}{fmtT(m.at)}
                        {receipt && (
                          <Icon
                            name={receipt === 'sent' ? 'check' : 'checkcheck'}
                            className={receipt === 'seen' ? 'tick seen' : 'tick'}
                          />
                        )}
                      </time>
                    </p>
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
        {!msgs.length && <div className="empty"><h3>Say hello</h3><p>Photos and voice notes stay with this project.</p></div>}
      </div>
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
        {text.trim() ? (
          <button type="submit" className="round send" aria-label={t('send')}>
            <Icon name="send" />
          </button>
        ) : (
          <Link className="round" to={`/mobile/chats/${thread.id}/voice`} aria-label="Record a voice note">
            <Icon name="mic" />
          </Link>
        )}
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
                      <button type="button" className="text-btn" onClick={() => setShot('/images/p01.jpg')}>Use a sample picture</button>
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
                {sheet.what === 'bill' && (
                  <label>Amount in ₹
                    <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" placeholder="0" />
                  </label>
                )}
                {!['checkin', 'daylog', 'drawing', 'location'].includes(sheet.what) && (
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
