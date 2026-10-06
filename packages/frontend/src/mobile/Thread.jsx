import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../shared/store';
import Icon from './Icon';
import { useField } from './FieldContext';
import { ThreadHeader } from './Chats';
import {
  svc, siblings, messagesOf, audience, firstName, fmtT, fmtD, state,
  postMessage, toggleReaction,
} from './model';

const BASICS = [
  ['photo', 'Photo', 'camera', 'Photo from site'],
  ['voice', 'Voice note', 'mic', ''],
  ['drawing', 'Drawing', 'drawing', 'Drawing shared'],
  ['sample', 'Sample', 'sample', 'Sample photo'],
  ['delivery', 'Delivery', 'delivery', 'Delivery received'],
];
const MORE = [
  ['location', 'Location', 'location', 'Live location: Jagwani Residence site, Alkapuri'],
  ['bill', 'Bill / expense', 'bill', 'Paid cash on site'],
  ['material', 'Material request', 'delivery', 'Material needed on site', ['site_manager', 'contractor', 'partner', 'designer']],
  ['attendance', 'Attendance', 'people', 'Attendance recorded for today', ['site_manager', 'contractor']],
  ['file', 'File', 'file', 'File shared'],
  ['checkin', 'Check in', 'today', '', ['site_manager', 'contractor']],
  ['daylog', "Today's log", 'today', '', ['site_manager', 'partner', 'designer']],
];
const WITH_PHOTO = ['photo', 'drawing', 'sample', 'delivery'];

function allowed(roles) {
  return !roles || roles.includes(state.role);
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
  const [error, setError] = useState('');
  const [showPins, setShowPins] = useState(false);
  const scroller = useRef(null);
  const text = drafts[threadId] || '';

  const count = thread ? messagesOf(thread.id).length : 0;

  useEffect(() => {
    if (threadId) markRead(threadId);
  }, [threadId, markRead]);

  useEffect(() => {
    const el = scroller.current;
    const id = window.location.hash.slice(1);
    if (id && document.getElementById(id)) {
      document.getElementById(id).scrollIntoView({ block: 'center' });
      return;
    }
    if (el) el.scrollTop = el.scrollHeight;
  }, [threadId, count]);

  if (!thread) {
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

  function send(e) {
    e?.preventDefault();
    const value = text.trim();
    if (!value) return;
    postMessage(thread.id, { text: value });
    setDraft(thread.id, '');
    markRead(thread.id);
  }

  function openForm(item) {
    setError('');
    setNote(item[3] || '');
    setAmount('');
    setSheet({ what: item[0], label: item[1], text: item[3] || '' });
  }

  function pick(item) {
    const key = item[0];
    if (key === 'voice') {
      navigate(`/mobile/chats/${thread.id}/voice`);
      return;
    }
    if (key === 'checkin' || key === 'daylog') {
      const siteId = thread.siteId || svc.mySiteIds()[0];
      if (!siteId) {
        setError('No site to use here.');
        return;
      }
      if (key === 'checkin') {
        svc.siteCheckin(siteId);
        const siteThread = svc.threads().find((t) => t.kind === 'site' && t.siteId === siteId);
        const dest = siteThread?.id || thread.id;
        postMessage(dest, { text: 'Checked in at site', kind: 'checkin' });
        setSheet(null);
        markRead(dest);
        if (dest !== thread.id) navigate(`/mobile/chats/${dest}`);
        return;
      }
      navigate(`/mobile/projects/${svc.site(siteId)?.projectId || thread.projectId}/assist?kind=daily&site=${siteId}`);
      return;
    }
    openForm(item);
  }

  function sendAttach(e) {
    e.preventDefault();
    const base = note.trim() || sheet.text || sheet.label;
    const fields = { text: base, kind: sheet.what };
    if (WITH_PHOTO.includes(sheet.what)) fields.photo = { hue: 28, seed: 4 };
    if (sheet.what === 'drawing') fields.text = `${base} · A-101 R4`;
    if (sheet.what === 'bill') {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) {
        setError('Enter an amount greater than zero.');
        return;
      }
      fields.bill = { amount: value, status: 'asked', paidBy: 'cash', projectId: thread.projectId };
      fields.text = `${base} · ₹${value.toLocaleString('en-IN')}`;
    }
    postMessage(thread.id, fields);
    setSheet(null);
    markRead(thread.id);
  }

  const tiles = sheet === 'plus' ? BASICS : sheet === 'more' ? MORE.filter((item) => allowed(item[4])) : [];

  return (
    <div className="screen">
      <ThreadHeader thread={thread} />
      {related.length > 0 && (
        <div className="switcher" role="tablist" aria-label="Conversations in this project">
          {related.map((t) => (
            <Link key={t.id} role="tab" aria-selected={t.id === thread.id} className={t.id === thread.id ? 'on' : ''} to={`/mobile/chats/${t.id}`}>
              {audience(t)}
            </Link>
          ))}
        </div>
      )}
      {thread.kind === 'internal' && <p className="banner">Internal only. The client never sees this.</p>}
      {pinned.length > 0 && (
        <button type="button" className="pinbar" onClick={() => setShowPins((v) => !v)}>
          {pinned.length} decision{pinned.length === 1 ? '' : 's'} pinned
        </button>
      )}
      {showPins && (
        <div className="pinlist">
          {pinned.map((m) => (
            <button type="button" key={m.id} onClick={() => document.getElementById(m.id)?.scrollIntoView({ block: 'center' })}>
              <b>{(m.text || 'Decision').slice(0, 80)}</b>
              <span>{firstName(m.by)} · {fmtT(m.at)}</span>
            </button>
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
          return (
            <div key={m.id} id={m.id}>
              {showDay && <div className="day">{fmtD(m.at)}</div>}
              <article className={`bubble ${mine ? 'mine' : 'theirs'} ${same ? 'cont' : ''} ${m.decision ? 'pinned' : ''}`}>
                {!mine && !same && <span className="who">{firstName(m.by)}</span>}
                {m.decision && !m.deleted && <span className="tag">Decision</span>}
                {m.deleted ? <p className="gone">This message was deleted</p> : (
                  <>
                    {m.voice && <span className="voice"><Icon name="mic" /> {typeof m.voice === 'string' ? m.voice : m.voice.dur}</span>}
                    {m.photo?.dataUrl && <img className="shot" src={m.photo.dataUrl} alt="" />}
                    {(m.photo || m.kind) && !m.voice && !m.photo?.dataUrl && <span className="chip">{m.kind || 'Photo'}</span>}
                    <p>{m.text}</p>
                  </>
                )}
                <time>{m.edited ? 'Edited · ' : ''}{fmtT(m.at)}</time>
                {!m.deleted && <Link className="more" to={`/mobile/chats/${thread.id}/messages/${m.id}`}>More</Link>}
                {reacts.length > 0 && (
                  <div className="reacts">
                    {reacts.map(([emoji, ids]) => (
                      <button type="button" key={emoji} className={ids.includes(state.userId) ? 'on' : ''} onClick={() => toggleReaction(m, emoji)} aria-label={`React ${emoji}`}>
                        {emoji} {ids.length}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            </div>
          );
        })}
        {!msgs.length && <div className="empty"><h3>Say hello</h3><p>Photos and voice notes stay with this project.</p></div>}
      </div>
      <form className="composer" onSubmit={send}>
        <button type="button" className="round" aria-label="Add a photo, drawing or note" onClick={() => { setError(''); setSheet('plus'); }}>
          <Icon name="plus" />
        </button>
        <textarea
          rows={1}
          placeholder="Message"
          aria-label={`Message to ${audience(thread)}`}
          value={text}
          onChange={(e) => setDraft(thread.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
        />
        {text.trim() ? (
          <button type="submit" className="round send" aria-label="Send">
            <Icon name="send" />
          </button>
        ) : (
          <Link className="round" to={`/mobile/chats/${thread.id}/voice`} aria-label="Review a voice note">
            <Icon name="mic" />
          </Link>
        )}
      </form>
      {sheet && (
        <div className="sheet-back" onClick={() => setSheet(null)} role="presentation">
          <div className="sheet" role="dialog" aria-label="Add to chat" onClick={(e) => e.stopPropagation()}>
            {sheet === 'plus' || sheet === 'more' ? (
              <>
                <h2>{sheet === 'plus' ? 'Add to this chat' : 'More site updates'}</h2>
                {error ? <p className="warn-text">{error}</p> : null}
                <div className="tiles">
                  {tiles.map((item) => (
                    <button type="button" key={item[0]} onClick={() => pick(item)}>
                      <Icon name={item[2]} />
                      {item[1]}
                    </button>
                  ))}
                  {sheet === 'plus' && (
                    <button type="button" onClick={() => setSheet('more')}>
                      <Icon name="plus" />
                      More
                    </button>
                  )}
                </div>
                {sheet === 'more' && <button type="button" className="text-btn" onClick={() => setSheet('plus')}>Back to common updates</button>}
                <button type="button" className="text-btn" onClick={() => setSheet(null)}>Cancel</button>
              </>
            ) : (
              <form className="stack" onSubmit={sendAttach}>
                <h2>{sheet.label}</h2>
                <label>Note<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" /></label>
                {sheet.what === 'bill' && (
                  <label>Amount
                    <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" placeholder="0" />
                  </label>
                )}
                {error ? <p className="warn-text">{error}</p> : null}
                <button className="primary" type="submit">Send</button>
                <button type="button" className="text-btn" onClick={() => setSheet('plus')}>Back</button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
