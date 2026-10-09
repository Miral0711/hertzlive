// Right-hand conversation pane (drawer <dialog> on narrow screens) and the shared thread view.
import {
  Fragment, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore,
} from 'react';
import {
  state, svc, persist, toast, render, parseRoute, fmtT, fmtD, safeAssetUrl, AIProvider, messageAttachment, can, go, user, taskStageLabel,
} from '../../shared/core.js';
import '../../shared/filing.js';
import { QUICK_REPLIES, receiptFor, hiddenFrom } from '../../shared/chatExtras.js';
import { Btn, Pill, Dropdown, DropdownItem } from '../../ui/ui';
import Icon from '../../ui/Icon';
import { P, first, name, role, staff } from '../helpers';
import { FilingChip } from '../parts';
import { openDialog, openMsg, openThread, toggleChatPane } from '../session';
import { Ph } from './media';
import { MessageAssist, openDesktopAssist } from './assist';
import { SiteMessageAction } from './site';
import AttachMenu from './AttachMenu';
import CameraCapture from './CameraCapture';
import MediaEditor from './MediaEditor';
import { ContactPicker, PollComposer } from './composerAttachments';
import { SiteCompose, VoiceCapture, phoneOf } from './messenger';
import { fileToDataUrl, fmtBytes } from './mediaUtils';
import {
  chatDraft, conversationPreview, conversationThreads, draftRev, markChatRead, pendingFocus,
  setChatDraft, unreadCount, useDraftTick,
} from './store';
import { usePhone } from '../phone';
import { ThreadAvatar } from '../../mobile/faces';

// ---------- actions ----------
export function openThreadFocus(id) {
  pendingFocus.current = svc.thread(id) ? { title: true } : null;
  openThread(id);
}
function showList() {
  pendingFocus.current = { row: state.desk.thread };
  state.desk.chatList = true;
  state.desk.hi = null;
  render();
}
export function openAttachment(msgId) {
  const m = state.db.MESSAGES.find((x) => x.id === msgId && !x.deleted && svc.thread(x.threadId));
  if (!m || !messageAttachment(m)) return toast('That attachment is not available for your role.');
  return openDialog({ kind: 'message-attachment', msgId: m.id });
}
function pick(m, option) { svc.recordChatDecision(m, option); }
function billDecision(m, ok) { svc.decideBill(m, ok); }
function approveMsg(m) { svc.approveChatMessage(m); }
async function sendMessage(tid, raw, extra) {
  const text = raw.trim();
  if (!text && !extra) return toast('Type a message first.');
  const reply = state.desk.replyTo?.threadId === tid ? { replyTo: state.desk.replyTo.id } : {};
  let id;
  try { id = svc.addMessage(tid, { ...(text ? { text } : {}), ...reply, ...extra }); } catch (_) {
    return toast('Message was not sent. Your draft is kept; check access and try again.');
  }
  setChatDraft(tid, '');
  state.desk.replyTo = null;
  state.desk.hi = null;
  render();
  const filed = await svc.classifySent(id);
  if (!filed) toast('Message sent. AI filing is unavailable; you can file it manually.');
  return render();
}
async function suggestReply(tid) {
  toast('AI is drafting a reply. Edit it before you send.');
  const ms = svc.messages(tid);
  const sender = state.userId;
  let draft;
  try { draft = await AIProvider.draftReply(svc.thread(tid), ms[ms.length - 1]); } catch (_) {
    return toast('AI reply unavailable. Your conversation and draft are unchanged.');
  }
  if (chatDraft(tid)) return toast('Your draft was kept. Clear it before requesting an AI suggestion.');
  setChatDraft(tid, draft, sender);
  pendingFocus.current = { composer: true };
  return render();
}

// ---------- conversation list ----------
// Same stamps WhatsApp uses: a clock time for today, "Yesterday", the weekday, then a short date.
function chatStamp(iso, withTime) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T00:00` : iso);
  if (Number.isNaN(d.getTime())) return '';
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(d)) / 864e5);
  if (days <= 0) return withTime ? fmtT(iso) : 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-IN', { weekday: withTime ? 'short' : 'long' });
  return fmtD(iso);
}
function ChatPicture({ thread, className = 'h-12 w-12' }) {
  return (
    <span className={`inline-grid flex-none overflow-hidden rounded-full bg-surface-2 ${className} [&>.av]:h-full [&>.av]:w-full [&_svg]:h-full [&_svg]:w-full [&_img]:h-full [&_img]:w-full [&_img]:object-cover`}>
      <ThreadAvatar thread={thread} />
    </span>
  );
}
// Last-line preview: "You:" / sender name in a group, a tick when you sent the last line in a direct chat.
function listPreview(thread, last) {
  const draft = chatDraft(thread.id).trim();
  if (draft) return { kind: 'draft', text: draft };
  if (!last) return { kind: 'empty', text: 'No messages yet' };
  const body = conversationPreview(last);
  const group = thread.kind !== 'dm';
  if (last.deleted) return { kind: 'text', text: body };
  if (last.by === state.userId) return { kind: 'mine', text: group ? `You: ${body}` : body };
  if (group) return { kind: 'text', text: `${first(last.by)}: ${body}` };
  return { kind: 'text', text: body };
}

export function ConversationList({ threads, filterable = false, footer = null }) {
  useDraftTick();
  const [q, setQ] = useState('');
  const filter = filterable ? (state.desk.chatFilter || 'all') : 'all';
  const needle = q.trim().toLowerCase();
  const rows = threads
    .filter((t) => filter !== 'unread' || unreadCount(t.id))
    .filter((t) => filter !== 'groups' || t.kind !== 'dm')
    .filter((t) => !needle || t.name.toLowerCase().includes(needle) || svc.messages(t.id).some((m) => conversationPreview(m).toLowerCase().includes(needle)));
  const setFilter = (v) => { state.desk.chatFilter = v; render(); };
  const empty = needle ? 'No conversations match your search.'
    : filter === 'unread' ? 'No unread conversations.'
      : filter === 'groups' ? 'No group conversations.'
        : 'No conversations available for your role.';
  return (
    <>
      {filterable && (
        <div className="bg-surface px-3 pb-1 pt-2">
          <label className="relative block">
            <Icon name="search" small className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              aria-label="Search conversations"
              className="min-h-9 w-full rounded-full border-0 bg-surface-2 py-2 pl-9 pr-3 text-ink placeholder:text-ink-3 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent-soft"
            />
          </label>
          <div role="group" aria-label="Filter conversations" className="mt-2 flex gap-2">
            {[['all', 'All'], ['unread', 'Unread'], ['groups', 'Groups']].map(([k, l]) => (
              <button
                key={k}
                type="button"
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
                className={`rounded-full px-3 py-1 text-[13px] font-medium ${filter === k ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink-2'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto bg-surface">
        {footer}
        {filterable && needle.length >= 2 && svc.search(q).slice(0, 8).map((hit) => (
          <button
            key={`${hit.kind}:${hit.id}`}
            type="button"
            onClick={() => (hit.msgId ? openMsg(hit.msgId) : go(hit.ref || '#/people'))}
            className="flex w-full flex-col border-0 border-b border-line bg-transparent px-3 py-2 text-left hover:bg-surface-2"
          >
            <b className="truncate text-sm">{hit.title}</b>
            <small className="truncate text-ink-3">In messages · {hit.sub}</small>
          </button>
        ))}
        {rows.map((t) => {
          const last = [...svc.messages(t.id)].filter((m) => !hiddenFrom(m, state.userId)).at(-1);
          const unread = unreadCount(t.id);
          const preview = listPreview(t, last);
          const current = t.id === state.desk.thread && !state.desk.chatList;
          return (
            <button
              key={t.id}
              type="button"
              data-thread={t.id}
              aria-current={current ? 'true' : undefined}
              onClick={() => openThreadFocus(t.id)}
              className={`group flex w-full items-center gap-3 border-0 px-3 text-left text-inherit active:bg-surface-3 ${current ? 'bg-surface-2' : 'bg-transparent hover:bg-surface-2'}`}
            >
              <ChatPicture thread={t} />
              <span className="flex min-w-0 flex-1 items-center border-b border-line py-3 group-last:border-b-0">
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <b className={`min-w-0 flex-1 truncate text-[16px] leading-5 text-ink ${unread > 0 ? 'font-semibold' : 'font-medium'}`}>{t.name}</b>
                    <time className={`flex-none whitespace-nowrap text-[12px] ${unread > 0 ? 'font-medium text-accent-text' : 'text-ink-3'}`}>{chatStamp(last?.at || t.lastMessageAt, true)}</time>
                  </span>
                  {t.kind !== 'dm' && <span className="block truncate text-[12px] text-accent-text">{t.groupType === 'work' ? `${P(t.projectId)?.name || 'Project'} · Work group` : (KIND_LABEL[t.kind] || 'Group')}</span>}
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className={`flex min-w-0 flex-1 items-center gap-1 text-[14px] leading-5 ${unread > 0 ? 'text-ink-2' : 'text-ink-3'}`}>
                      {preview.kind === 'mine' && <Icon name="checkcheck" small className="text-ink-3" />}
                      <span className="truncate">
                        {preview.kind === 'draft' && <span className="font-medium text-accent-text">Draft: </span>}
                        {preview.text}
                      </span>
                    </span>
                    {unread > 0 && (
                      <span className="inline-grid h-5 min-w-5 flex-none place-items-center rounded-full bg-accent px-1 text-[11px] font-semibold text-accent-ink">{unread}</span>
                    )}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
        {!rows.length && <p className="m-4 rounded-r2 bg-surface-2 p-6 text-center text-ink-3">{empty}</p>}
      </div>
    </>
  );
}

// ---------- messages ----------
const Opts = ({ children }) => <div className="mt-1.5 flex flex-col items-start gap-1 [&_button]:text-left">{children}</div>;

function Attachment({ m }) {
  const a = messageAttachment(m);
  if (!a || m.deleted) return null;
  // Photos and albums show the picture right in the message; tapping it opens the larger view.
  const media = m.photo || m.album;
  if (media && !m.file) {
    const count = m.album ? Math.max(1, Math.min(Number(m.album.n) || 1, 4)) : 1;
    return (
      <button
        type="button"
        aria-label={`Open ${a.kind.toLowerCase()}`}
        onClick={() => openAttachment(m.id)}
        className={`my-2 grid w-full max-w-[340px] cursor-zoom-in gap-1.5 overflow-hidden rounded-r2 border-0 bg-transparent p-0 ${count > 1 ? 'grid-cols-2' : ''}`}
      >
        {Array.from({ length: count }, (_, i) => (
          <Ph key={i} hue={Number(media.hue) || 30} seed={(Number(media.seed) || 1) + i} />
        ))}
      </button>
    );
  }
  return (
    <div className="my-2 flex min-w-0 flex-col gap-2 rounded-r1 border border-line-2 p-3">
      <b>{a.title}</b>
      <small className="text-ink-2">{a.detail || ''}</small>
      <div className="flex flex-wrap gap-2">
        <Btn sm className="!whitespace-normal !text-left" onClick={() => openAttachment(m.id)}>Open {a.kind}</Btn>
        {a.newerId && <Btn sm className="!whitespace-normal !text-left" onClick={() => openAttachment(a.newerId)}>Open newer copy</Btn>}
      </div>
    </div>
  );
}

function Message({ m, showName, firstInRun, lastInRun, later = [], threadMessages = [] }) {
  const mine = m.by === state.userId;
  const live = !m.deleted;
  const receipt = receiptFor(m, later, state.userId);
  const quoted = m.replyTo ? threadMessages.find((x) => x.id === m.replyTo) : null;
  const reacts = Object.entries(m.reactions || {}).filter(([, ids]) => ids.length);
  const callUrl = live && m.call ? safeAssetUrl(m.call.url) : '';
  const tail = lastInRun ? (mine ? 'rounded-[12px] rounded-br-[4px]' : 'rounded-[12px] rounded-bl-[4px]') : 'rounded-[12px]';
  return (
    <div
      data-msgid={m.id}
      className={`max-w-[86%] min-w-[8.5rem] shrink-0 px-2.5 pb-1 pt-1.5 text-[15.5px] leading-snug shadow-s1 [overflow-wrap:anywhere] ${firstInRun ? 'mt-2' : 'mt-[3px]'} ${tail} ${mine ? 'min-w-[10.75rem] chat-out self-end' : 'self-start bg-surface'} ${state.desk.hi === m.id ? 'outline outline-2 outline-offset-1 outline-accent' : ''}`}
    >
      {showName && !mine && (
        <div className="mb-0.5 text-[13px] font-semibold text-accent-text">{name(m.by)}</div>
      )}
      {(m.pinned || m.notice) && live && (
        <div className="mb-0.5 text-[11px] font-medium text-ink-3">
          {m.pinned ? 'Pinned' : ''}{m.pinned && m.notice ? ' · ' : ''}{m.notice ? 'Notice to everyone' : ''}
        </div>
      )}
      {m.deleted && <div className="text-ink-3"><i>This message was deleted</i></div>}
      {m.decision && live && <div className="mb-0.5 text-[12px] font-semibold text-accent">Decision</div>}
      {m.forwarded && live && <div className="mb-0.5 text-[12px] italic text-ink-3">Forwarded</div>}
      {m.replyTo && live && (
        <div className="relative mb-1 overflow-hidden rounded-md border-l-[3px] border-accent-text bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] px-2 py-1 pl-2.5 text-[13px]">
          <b className="text-accent-text">{quoted ? name(quoted.by) : ''}</b>
          <div className="truncate text-ink-2">{conversationPreview(quoted)}</div>
        </div>
      )}
      {m.kind && live && !m.photo && !m.voice && (
        <div className="mb-0.5 text-[12px] font-semibold text-accent">{({ drawing: 'Drawing', delivery: 'Delivery', sample: 'Sample', location: 'Location', bill: 'Bill', material: 'Material', file: 'File', attendance: 'Attendance', checkin: 'Checked in' })[m.kind] || m.kind}</div>
      )}
      {m.bill && live && (
        <Opts>
          <span className="flex flex-wrap items-center gap-1.5">
            <b>₹{m.bill.amount.toLocaleString('en-IN')}</b>
            <Pill kind={m.bill.status === 'approved' ? '' : 'warn'}>
              {m.bill.status === 'approved' ? 'approved' : m.bill.status === 'query' ? 'bill asked' : 'reimbursement asked'}
            </Pill>
            {m.bill.status === 'asked' && m.by !== state.userId && role() === 'partner' && (
              <>
                <Btn sm kind="primary" onClick={() => billDecision(m, true)}>Approve</Btn>
                <Btn sm onClick={() => billDecision(m, false)}>Ask for bill</Btn>
              </>
            )}
          </span>
        </Opts>
      )}
      <Attachment m={m} />
      {m.media && live && (
        <div className="my-1.5">
          {m.media.kind === 'video'
            // bg-black is intentional — the letterbox behind a video element stays black in
            // both themes, same as any video player.
            ? <video src={m.media.url} controls className="max-h-72 w-full rounded-r1 bg-black" />
            : <img src={m.media.dataUrl} alt="" className="max-h-72 w-full rounded-r1 object-cover" />}
        </div>
      )}
      {m.audio && live && <audio src={m.audio.dataUrl} controls className="my-1.5 w-full" />}
      {m.contact && live && (
        <div className="my-1.5 rounded-r1 border border-line-2 p-2.5">
          <b>{m.contact.name}</b>
          {m.contact.phone && <><br /><small className="text-ink-3">{m.contact.phone}</small></>}
        </div>
      )}
      {m.poll && live && (
        <Opts>
          <b className="mb-1 block">{m.poll.question}</b>
          {m.poll.options.map((o, i) => {
            const voted = o.votes.includes(state.userId);
            return (
              <Btn
                key={i} sm className={voted ? '!border-accent !bg-accent-soft !text-accent-text' : ''}
                onClick={() => svc.votePoll(m.id, i)}
              >
                {o.text} · {o.votes.length}
              </Btn>
            );
          })}
        </Opts>
      )}
      {m.link && live && (
        <div className="my-1.5 rounded-r1 bg-surface-2 p-2 text-xs">
          <Ph hue={m.link.hue} seed={m.link.seed} ar={1.8} />
          <div className="mt-1.5"><b>{m.link.title}</b><br /><small className="text-ink-3">{m.link.src}</small></div>
        </div>
      )}
      {m.call && live && (
        <Opts>
          <span><b>Video call</b> · {m.call.provider || 'Google Meet'}<br />
            {callUrl ? <a href={callUrl} target="_blank" rel="noopener noreferrer" className="text-accent-text underline">{m.call.url}</a> : m.call.url}
          </span>
        </Opts>
      )}
      {m.assistDraft && live && <small className="block italic text-ink-3">Reviewed AI draft · demo</small>}
      {m.text && live && <div>{m.text}</div>}
      {m.voice && live && <div className="text-ink-3">Voice note · {String(m.voice.dur || '')}</div>}
      {m.transcript && live && <div className="text-ink-3">Voice: {m.transcript}</div>}
      {m.imported && <div className="text-ink-3"><small>imported from WhatsApp</small></div>}
      {live && m.options?.length > 0 && (
        <Opts>{m.options.map((o) => <Btn key={o} sm onClick={() => pick(m, o)}>{o}</Btn>)}</Opts>
      )}
      {m.approval && live && (
        <Opts>
          {m.approval.done ? <Pill kind="ok">approved</Pill>
            : role() === 'client' ? <Btn sm kind="primary" onClick={() => approveMsg(m)}>{m.approval.label}</Btn>
              : <Pill kind="warn">{m.approval.label} · waiting</Pill>}
        </Opts>
      )}
      <SiteMessageAction m={m} />
      <MessageAssist m={m} />
      {reacts.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {reacts.map(([emoji, ids]) => (
            <button key={emoji} type="button" className={`rounded-full border-0 px-2 py-0.5 text-sm ${ids.includes(state.userId) ? 'bg-accent-soft' : 'bg-surface-2'}`} onClick={() => svc.reactToMessage(m, emoji)} aria-label={`React ${emoji}`}>{emoji} {ids.length}</button>
          ))}
        </div>
      )}
      <div className="mt-0.5 flex flex-wrap items-center justify-end gap-1">
        {staff() && <span className="mr-auto max-w-[70%]"><FilingChip m={m} /></span>}
        <time className="text-[11px] leading-none text-ink-3">{m.edited ? 'Edited · ' : ''}{fmtT(m.at)}</time>
        {receipt && <Icon name={receipt === 'sent' ? 'check' : 'checkcheck'} small className={receipt === 'seen' ? 'text-accent-text' : 'text-ink-3'} />}
        <button type="button" aria-label="Message options" className="inline-grid h-5 w-5 place-items-center border-0 bg-transparent p-0 text-ink-3" onClick={() => openDialog({ kind: 'message-actions', msgId: m.id })}>
          <span className="inline-block rotate-90"><Icon name="chev" small /></span>
        </button>
      </div>
    </div>
  );
}

function Messages({ threadId, ms, grouped, notice }) {
  const ref = useRef(null);
  const seen = useRef({ thread: null, n: 0 });
  const { hi } = state.desk;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prev = seen.current;
    seen.current = { thread: threadId, n: ms.length };
    const target = hi ? [...el.querySelectorAll('[data-msgid]')].find((x) => x.dataset.msgid === hi) : null;
    if (target) target.scrollIntoView({ block: 'center' });
    else if (prev.thread !== threadId || ms.length > prev.n) el.scrollTop = el.scrollHeight;
  }, [threadId, ms.length, hi]);
  const dayOf = (m) => {
    const d = new Date(m.at);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  };
  const sameRun = (a, b) => a && b && a.by === b.by && dayOf(a) === dayOf(b);
  return (
    <div ref={ref} className="chat-wallpaper flex min-h-0 flex-1 flex-col overflow-auto px-2.5 py-2">
      {notice}
      {ms.map((m, i) => {
        const showDay = i === 0 || dayOf(m) !== dayOf(ms[i - 1]);
        const firstInRun = showDay || !sameRun(ms[i - 1], m);
        const lastInRun = i === ms.length - 1 || !sameRun(m, ms[i + 1]);
        return (
          <Fragment key={m.id}>
            {showDay && (
              <div className="sticky top-1 z-[1] my-2 self-center rounded-full bg-surface px-2.5 py-1 text-[12px] font-semibold text-ink-2 shadow-s1">
                {chatStamp(m.at, false)}
              </div>
            )}
            <Message m={m} showName={grouped && firstInRun} firstInRun={firstInRun} lastInRun={lastInRun} later={ms.slice(i + 1)} threadMessages={ms} />
          </Fragment>
        );
      })}
    </div>
  );
}

function PendingFileBar({ pending, onCancel, onSend }) {
  return (
    <div className="mb-2 flex items-center gap-2 rounded-r1 border border-line-2 bg-surface-2 px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm">
        {pending.file.name} <small className="text-ink-3">{fmtBytes(pending.file.size)}</small>
      </span>
      <Btn sm onClick={onCancel}>Cancel</Btn>
      <Btn sm kind="primary" onClick={onSend}>Send</Btn>
    </div>
  );
}

function Composer({ thread, last }) {
  const phone = usePhone();
  useDraftTick();
  const [text, setText] = useState(() => chatDraft(thread.id));
  const [pending, setPending] = useState(null);
  const rev = draftRev();
  useEffect(() => { setText(chatDraft(thread.id)); }, [thread.id, rev]);
  const status = state.desk.draftStorageError || state.storageError || '';

  const onPickFile = (kind, file) => {
    if (kind === 'document') return setPending({ type: 'document', file });
    if (kind === 'audio') return setPending({ type: 'audio', file });
    const isVideo = file.type.startsWith('video/');
    return setPending({ type: 'editor', file, kind: isVideo ? 'video' : 'image' });
  };
  const onPickAction = (kind) => {
    if (kind.startsWith('site:')) return setPending({ type: 'site', what: kind.slice(5), label: kind.slice(5) });
    return setPending({ type: kind });
  };

  const sendSimpleFile = async () => {
    const { type, file } = pending;
    try {
      const dataUrl = await fileToDataUrl(file);
      if (type === 'document') sendMessage(thread.id, '', { file: { name: file.name, dataUrl, mime: file.type, size: file.size } });
      else sendMessage(thread.id, '', { audio: { dataUrl, name: file.name } });
    } catch (_) { toast('Could not read that file. Please try again.'); }
    setPending(null);
  };

  return (
    <div className={`chat-wallpaper px-1.5 pt-1 ${phone ? 'pb-[max(0.4rem,env(safe-area-inset-bottom))]' : 'pb-2'}`}>
      <p role="status" className="m-0 min-h-0 px-2 text-xs text-crit empty:hidden">{status}</p>
      {staff() && last && last.by !== state.userId && (
        <Btn kind="link" sm className="mb-1 ml-3" onClick={() => suggestReply(thread.id)}>Suggest reply</Btn>
      )}
      {(pending?.type === 'document' || pending?.type === 'audio') && (
        <PendingFileBar pending={pending} onCancel={() => setPending(null)} onSend={sendSimpleFile} />
      )}
      {pending?.type === 'editor' && (
        <MediaEditor
          file={pending.file}
          kind={pending.kind}
          onCancel={() => setPending(null)}
          onSend={(media) => {
            const site = pending.siteWhat;
            const caption = (media.note || '').trim();
            const extra = site ? { kind: site, text: caption || (site === 'sample' ? 'Sample' : site === 'delivery' ? 'Delivery' : 'Photo'), photo: media.dataUrl ? { dataUrl: media.dataUrl, hue: 28, seed: 4 } : undefined, media } : { media };
            sendMessage(thread.id, site ? '' : caption, extra);
            setPending(null);
          }}
        />
      )}
      {pending?.type === 'camera' && (
        <CameraCapture
          onCancel={() => setPending(null)}
          onCapture={(file) => setPending({ type: 'editor', file, kind: 'image' })}
        />
      )}
      {pending?.type === 'contact' && (
        <ContactPicker
          threadId={thread.id}
          onCancel={() => setPending(null)}
          onSend={(contact) => { sendMessage(thread.id, '', { contact }); setPending(null); }}
        />
      )}
      {pending?.type === 'poll' && (
        <PollComposer
          onCancel={() => setPending(null)}
          onSend={(poll) => { sendMessage(thread.id, '', { poll }); setPending(null); }}
        />
      )}
      {pending?.type === 'voice' && (
        <VoiceCapture
          onCancel={() => setPending(null)}
          onSend={(voice) => { sendMessage(thread.id, '', { voice }); setPending(null); }}
        />
      )}
      {pending?.type === 'site' && (
        <SiteCompose
          thread={thread}
          what={pending.what}
          label={({ photo: 'Photo', drawing: 'Drawing', delivery: 'Delivery', sample: 'Sample', location: 'Location', bill: 'Bill / expense', material: 'Material request', attendance: 'Attendance', file: 'File', checkin: 'Check in', daylog: "Today's log" })[pending.what] || pending.what}
          onCancel={() => setPending(null)}
          onPhoto={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = () => {
              const file = input.files?.[0];
              if (file) setPending({ type: 'editor', file, kind: 'image', siteWhat: pending.what });
            };
            input.click();
          }}
          onSend={(fields) => { sendMessage(thread.id, '', fields); setPending(null); }}
          onCheckin={() => {
            const siteId = thread.siteId || svc.mySiteIds()[0];
            if (!siteId) return toast('No site to use here.');
            svc.siteCheckin(siteId);
            const siteThread = svc.threads().find((th) => th.kind === 'site' && th.siteId === siteId);
            const dest = siteThread?.id || thread.id;
            sendMessage(dest, '', { text: 'Checked in at site', kind: 'checkin' });
            setPending(null);
            if (dest !== thread.id) openThreadFocus(dest);
          }}
          onDayLog={() => {
            const siteId = thread.siteId || svc.mySiteIds()[0];
            if (!siteId) return toast('No site to use here.');
            setPending(null);
            openDesktopAssist('daily', { siteId });
          }}
        />
      )}
      {can('thread', 'w') && last && last.by !== state.userId && /\?/.test(last.text || '') && (
        <div className="mb-1 flex flex-wrap gap-2 px-2">
          {QUICK_REPLIES.map((label) => (
            <Btn key={label} sm onClick={() => sendMessage(thread.id, label, { replyTo: last.id })}>{label}</Btn>
          ))}
        </div>
      )}
      {state.desk.replyTo?.threadId === thread.id && (
        <div className="mb-1 flex items-center gap-2 px-2 text-sm">
          <span className="min-w-0 flex-1 truncate"><b className="text-accent-text">{name(state.db.MESSAGES.find((m) => m.id === state.desk.replyTo.id)?.by)}</b> {conversationPreview(state.db.MESSAGES.find((m) => m.id === state.desk.replyTo.id))}</span>
          <button type="button" aria-label="Cancel reply" className="border-0 bg-transparent text-ink-3" onClick={() => { state.desk.replyTo = null; render(); }}><Icon name="x" small /></button>
        </div>
      )}
      <form
        className="flex w-full items-end gap-1.5"
        onSubmit={(e) => { e.preventDefault(); sendMessage(thread.id, text); }}
      >
        <div className="flex min-h-11 min-w-0 flex-1 items-center rounded-full bg-surface pl-1 pr-3 shadow-s1">
          <AttachMenu bare onPickFile={onPickFile} onPickAction={onPickAction} />
          <input
            data-composer
            name="text"
            value={text}
            onChange={(e) => { setText(e.target.value); setChatDraft(thread.id, e.target.value, state.userId, true); }}
            placeholder="Message"
            aria-label="Message"
            autoComplete="off"
            className="min-h-10 w-full min-w-0 border-0 bg-transparent px-1 text-ink placeholder:text-ink-3 focus:outline-none"
          />
          {phone && (
            <button type="button" aria-label="Camera" onClick={() => onPickAction('camera')} className="inline-grid h-10 w-10 flex-none place-items-center rounded-full border-0 bg-transparent text-ink-3">
              <Icon name="camera" />
            </button>
          )}
        </div>
        <button type="submit" aria-label="Send" className="inline-grid h-11 w-11 flex-none place-items-center rounded-full border-0 bg-accent text-accent-ink">
          <Icon name="send" small />
        </button>
      </form>
    </div>
  );
}

// ---------- pane ----------
function contextProject() {
  const { parts } = parseRoute();
  if (parts[0] === 'projects' && parts[1]) return svc.project(parts[1]);
  if (parts[0] === 'sites' && parts[1]) return svc.project(svc.site(parts[1])?.projectId);
  return null;
}
// A short "who/what this is" line, not four separate tabs — project name folded in where a
// thread's own kind (client/site/internal) doesn't already say which project it's for.
const KIND_LABEL = { client: 'Client group', site: 'Site team', internal: 'Office', dm: 'Direct message', group: 'Group' };
const contextLine = (t) => {
  if (t.groupType === 'work') {
    const proj = t.projectId ? P(t.projectId)?.name : null;
    return proj ? `${proj} · Work group` : 'Work group';
  }
  const label = KIND_LABEL[t.kind] || 'Members of this conversation';
  const proj = t.projectId ? P(t.projectId)?.name : null;
  return proj ? `${label} · ${proj}` : label;
};
function BarButton({ label, icon, onClick, className = '' }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={`inline-grid h-10 w-10 flex-none place-items-center rounded-full border-0 bg-transparent text-inherit hover:bg-black/10 ${className}`}>
      <Icon name={icon} />
    </button>
  );
}

function WorkSection({ thread, messages, children }) {
  const [tab, setTab] = useState('chat');
  const [name, setName] = useState(thread.name);
  const [error, setError] = useState('');
  useEffect(() => { setTab('chat'); setName(thread.name); setError(''); }, [thread.id, thread.name]);
  const task = (state.db.TASKS || []).find((item) => item.id === thread.taskId);
  const parent = svc.thread(thread.parentGroupId);
  const members = (thread.memberIds || []).map((id) => user(id)).filter((u) => u?.id);
  const spare = svc.workMembers(thread.parentGroupId).filter((u) => !(thread.memberIds || []).includes(u.id));
  const manage = svc.canManageWork(thread);
  const files = messages.filter((m) => !m.deleted && (m.photo || m.file || m.kind === 'file'));
  function saveName() {
    try { svc.renameWorkGroup(thread.id, name); setError(''); } catch (e) { setError(e.message); }
  }
  function change(id, remove) {
    const ids = remove ? thread.memberIds.filter((x) => x !== id) : [...thread.memberIds, id];
    try { svc.setWorkMembers(thread.id, ids); setError(''); } catch (e) { setError(e.message); }
  }
  const tabs = [['chat', 'Chat'], ['task', 'Task'], ['files', 'Files'], ['members', 'Members']];
  return (
    <>
      <div className="flex gap-1 border-b border-line bg-surface px-2.5 py-1.5" role="tablist" aria-label="Work group">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-[30px] flex-1 rounded-full border-0 px-2 text-[13px] font-semibold ${tab === k ? 'bg-accent text-accent-ink' : 'bg-transparent text-ink-2'}`}>{label}</button>
        ))}
      </div>
      <p className="m-0 border-b border-line px-3 py-2 text-[13px] text-ink-2">
        <b className="text-ink">{task?.title || thread.name}</b>
        {task ? ` · ${taskStageLabel(task)}` : ''}
        {parent && <> · <button type="button" className="border-0 bg-transparent p-0 font-semibold text-accent-text" onClick={() => openThreadFocus(parent.id)}>{parent.name}</button></>}
        <span className="mt-0.5 block text-ink-3">Only the people in this work group can see these messages.</span>
      </p>
      {error && <p className="m-0 px-3 py-1 text-sm font-semibold text-crit" role="alert">{error}</p>}
      {tab === 'chat' && children}
      {tab === 'task' && (
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {task ? (
            <>
              <p className="m-0 font-semibold">{task.title}</p>
              <p className="my-1 text-sm text-ink-3">{taskStageLabel(task)}{task.due ? ` · due ${fmtD(task.due)}` : ''} · {user(task.owner).name}</p>
              {task.description && <p className="text-sm">{task.description}</p>}
              {(task.checklist || []).map((item) => <p key={item.id} className="m-0 text-sm text-ink-2">{item.done ? 'Done' : 'Open'} · {item.text}</p>)}
            </>
          ) : <p className="text-ink-3">This task isn’t available.</p>}
        </div>
      )}
      {tab === 'files' && (
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {files.length ? files.map((m) => (
            <button key={m.id} type="button" className="flex w-full min-h-11 border-0 border-b border-line bg-transparent py-2 text-left" onClick={() => { state.desk.hi = m.id; setTab('chat'); render(); }}>
              <span className="min-w-0"><b className="block truncate">{m.file?.name || m.text || 'Photo'}</b><small className="text-ink-3">{fmtT(m.at)}</small></span>
            </button>
          )) : <p className="m-0 text-ink-3">Nothing shared in this work group yet.</p>}
        </div>
      )}
      {tab === 'members' && (
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {manage && (
            <div className="mb-3 flex gap-2">
              <input aria-label="Work group name" value={name} onChange={(e) => setName(e.target.value)} className="min-h-9 min-w-0 flex-1 rounded-r1 border border-line bg-surface px-3 text-ink" />
              <Btn sm kind="primary" onClick={saveName}>Rename</Btn>
            </div>
          )}
          <div className="mb-3 flex flex-wrap gap-1">
            {members.map((u) => <span key={u.id} title={u.name} className="inline-grid h-8 w-8 place-items-center rounded-full bg-surface-3 text-xs font-semibold">{(u.ini || u.name || '?').slice(0, 2)}</span>)}
          </div>
          {members.map((u) => (
            <div key={u.id} className="flex min-h-11 items-center gap-2 border-b border-line">
              <span className="min-w-0 flex-1"><b className="block truncate">{u.name}</b><small className="text-ink-3">{u.title}</small></span>
              {manage && u.id !== state.userId && <Btn sm onClick={() => change(u.id, true)}>Remove</Btn>}
            </div>
          ))}
          {manage && spare.map((u) => (
            <div key={u.id} className="flex min-h-11 items-center gap-2 border-b border-line">
              <span className="min-w-0 flex-1">{u.name}<small className="block text-ink-3">{u.title}</small></span>
              <Btn sm onClick={() => change(u.id, false)}>Add</Btn>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function ChatView({ workspace = false }) {
  const phone = usePhone();
  const paneRef = useRef(null);
  const titleRef = useRef(null);
  useEffect(() => {
    const want = pendingFocus.current;
    if (!want) return;
    pendingFocus.current = null;
    if (want.title) titleRef.current?.focus();
    else if (want.composer) paneRef.current?.querySelector('[data-composer]')?.focus();
    else if (want.row) [...document.querySelectorAll('[data-thread]')].find((el) => el.dataset.thread === want.row)?.focus();
  });
  const desk = state.desk;
  const ts = conversationThreads();
  const project = contextProject();
  const scoped = project && !desk.allChats ? ts.filter((t) => t.projectId === project.id) : ts;
  if (workspace && (desk.chatList || !svc.thread(desk.thread))) {
    return (
      <aside id="conversation" ref={paneRef} className="grid h-full min-h-0 place-items-center border-l border-line bg-surface p-6 text-center max-[980px]:hidden">
        <div>
          <p className="m-0 text-lg font-semibold text-ink">Your conversations</p>
          <p className="m-0 mt-1.5 text-ink-3">Select a conversation to view messages, updates and replies.</p>
        </div>
      </aside>
    );
  }
  if (!ts.length) {
    return (
      <aside id="conversation" ref={paneRef} className="flex min-h-0 min-w-0 flex-col border-l border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line p-3.5">
          <b className="flex-1">Chat</b>
          <Btn sm onClick={toggleChatPane}>Hide chat</Btn>
        </div>
        <p className="m-4 rounded-r2 bg-surface-2 p-6 text-center text-ink-3">No chats for this role. HR uses direct messages on the phone app.</p>
      </aside>
    );
  }
  const cur = ts.find((t) => t.id === desk.thread) || ts[0];
  desk.thread = cur.id;
  if (!desk.chatList && (workspace || !desk.chatHidden)) markChatRead(cur.id);
  const ms = svc.messages(cur.id).filter((m) => !hiddenFrom(m, state.userId));
  const last = ms[ms.length - 1];
  const pinned = ms.filter((m) => m.decision && !m.deleted);
  const canPin = role() === 'partner' || role() === 'site_manager';
  const sib = !desk.chatList && cur.projectId && cur.kind !== 'dm'
    ? svc.threads().filter((x) => x.projectId === cur.projectId && x.kind !== 'dm' && x.groupType !== 'work') : [];
  const projectChats = ['client', 'internal', 'site'].includes(cur.kind)
    ? sib.filter((x) => ['client', 'internal', 'site'].includes(x.kind)) : [];
  return (
    <aside
      id="conversation"
      ref={paneRef}
      aria-label="Conversations"
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-line bg-surface ${workspace ? 'h-full max-[980px]:border-l-0' : ''} ${phone && workspace ? 'min-h-0 flex-1' : ''}`}
    >
      <div className={`flex items-center gap-0.5 px-1 py-1 ${phone ? 'bg-nav text-nav-ink pt-[max(0.25rem,env(safe-area-inset-top))]' : 'min-h-14 border-b border-line bg-surface px-2 text-ink'}`}>
        {!desk.chatList && (
          <BarButton
            label="Back to conversations"
            icon="back"
            onClick={showList}
            className={!phone && workspace ? 'hidden max-[980px]:inline-grid' : ''}
          />
        )}
        {desk.chatList ? (
          <div ref={titleRef} tabIndex={-1} className="min-w-0 flex-1 px-2 focus:outline-none">
            <b className="block truncate text-[16px] font-semibold leading-tight">{project && !desk.allChats ? project.name : 'Chats'}</b>
          </div>
        ) : (
          <button
            ref={titleRef}
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 border-0 bg-transparent px-1 text-left text-inherit focus:outline-none"
            onClick={() => openDialog({ kind: 'chat-info', threadId: cur.id })}
          >
            <ChatPicture thread={cur} className="h-10 w-10" />
            <span className="min-w-0">
              <b className="block truncate text-[16px] font-semibold leading-tight">{cur.name}</b>
              <small className={`block truncate text-xs ${phone ? 'opacity-80' : 'text-ink-3'}`}>{contextLine(cur)}</small>
            </span>
          </button>
        )}
        {!desk.chatList && (
          <>
            <BarButton label="Video call" icon="video" onClick={() => openDialog({ kind: 'video-call', threadId: cur.id })} />
            <BarButton label="Voice call" icon="call" onClick={() => {
              const otherId = cur.kind === 'dm' ? cur.memberIds.find((id) => id !== state.userId) : null;
              const other = otherId ? user(otherId) : null;
              if (other) { window.location.href = `tel:${phoneOf(other).replace(/\s/g, '')}`; return; }
              openDialog({ kind: 'voice-call', threadId: cur.id });
            }} />
            <Dropdown
              plain
              align="right"
              panelClassName="!w-56"
              trigger={<><Icon name="more" /><span className="sr-only">Conversation actions</span></>}
            >
              <DropdownItem icon="photos" onClick={() => openDialog({ kind: 'chat-info', threadId: cur.id })}>Media, links and docs</DropdownItem>
              {sib.map((x) => (
                <DropdownItem key={x.id} onClick={() => openThreadFocus(x.id)} className={x.id === cur.id ? '!bg-accent-soft !text-accent-text' : ''}>
                  {x.name}
                </DropdownItem>
              ))}
            </Dropdown>
          </>
        )}
        {!workspace && <BarButton label="Close chats" icon="x" onClick={toggleChatPane} />}
      </div>
      {!desk.chatList && projectChats.length > 1 && (
        <div className="flex gap-1 border-b border-line bg-surface px-2.5 py-1.5" role="tablist" aria-label="Conversations in this project">
          {projectChats.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={x.id === cur.id}
              onClick={() => openThreadFocus(x.id)}
              className={`min-h-[30px] flex-1 rounded-full border-0 px-2 text-[13px] font-semibold ${x.id === cur.id ? 'bg-accent text-accent-ink' : 'bg-transparent text-ink-2'}`}
            >
              {KIND_LABEL[x.kind] || 'Group'}
            </button>
          ))}
        </div>
      )}
      {desk.chatList && project && (
        <div className="flex gap-2 border-b border-line px-4 py-3">
          <Btn sm kind={!desk.allChats ? 'primary' : 'default'} onClick={() => { desk.allChats = false; render(); }}>This project</Btn>
          <Btn sm kind={desk.allChats ? 'primary' : 'default'} onClick={() => { desk.allChats = true; render(); }}>All chats</Btn>
        </div>
      )}
      {desk.chatList ? (
        <ConversationList threads={scoped} />
      ) : (
        <>
          {pinned.length > 0 && (
            <details className="border-b border-line bg-accent-soft px-3 py-2">
              <summary className="cursor-pointer font-semibold">{pinned.length} decision{pinned.length === 1 ? '' : 's'} pinned</summary>
              {pinned.map((m) => (
                <div key={m.id} className="mt-1 flex items-center gap-2">
                  <button type="button" className="min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left" onClick={() => { state.desk.hi = m.id; render(); }}>
                    <b>{(m.text || 'Decision').slice(0, 80)}</b>
                    <small className="block text-ink-3">{first(m.by)} · {fmtT(m.at)}</small>
                  </button>
                  {canPin && <Btn sm onClick={() => svc.toggleDecision(m)}>Unpin</Btn>}
                </div>
              ))}
            </details>
          )}
          {svc.decisionsDue({ threadId: cur.id }).map((d) => (
            <div key={d.id} className="mx-2 mt-2 rounded-r1 bg-surface px-3 py-2">
              <small className="font-semibold text-warn">Still open · due {fmtD(d.due)}</small>
              <div className="font-semibold">{d.title}</div>
            </div>
          ))}
          {cur.kind === 'internal' && (
            <p className="mx-auto mt-2 max-w-sm rounded-lg bg-warn-soft px-3 py-1.5 text-center text-xs font-medium text-warn">Office only. The client never sees this.</p>
          )}
          {cur.groupType === 'work' ? (
            <WorkSection thread={cur} messages={ms}>
              <Messages threadId={cur.id} ms={ms} grouped />
              <Composer key={cur.id + state.userId} thread={cur} last={last} />
            </WorkSection>
          ) : (
            <>
              <Messages threadId={cur.id} ms={ms} grouped={cur.kind !== 'dm'} />
              <Composer key={cur.id + state.userId} thread={cur} last={last} />
            </>
          )}
        </>
      )}
    </aside>
  );
}

const NARROW = '(max-width:1250px)';
const subscribeNarrow = (cb) => {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const useNarrow = () => useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches);

// Below 1250px the pane is a right-hand drawer (modal <dialog>): Escape / backdrop close it.
function Drawer({ children }) {
  const phone = usePhone();
  const ref = useRef(null);
  const unmounting = useRef(false);
  useEffect(() => {
    const el = ref.current;
    unmounting.current = false;
    if (el && !el.open) el.showModal();
    return () => { unmounting.current = true; if (el?.open) el.close(); };
  }, []);
  const hide = () => {
    if (unmounting.current || state.desk.chatHidden) return;
    state.desk.chatHidden = true;
    persist();
    render();
    document.querySelector('[aria-controls="conversation"]')?.focus();
  };
  return (
    <dialog
      ref={ref}
      aria-label="Conversations"
      onClose={hide}
      onClick={(e) => { if (e.target === ref.current) ref.current.close(); }}
      // backdrop:bg-black/30 is the same intentional dialog-scrim exception as Modal.jsx.
      className={phone
        ? 'fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-surface p-0 text-ink backdrop:bg-transparent'
        : 'fixed left-auto right-0 top-[60px] m-0 h-[calc(100dvh-60px)] max-h-none w-[min(420px,100vw)] max-w-[100vw] overflow-hidden border-0 border-l border-line bg-surface p-0 text-ink shadow-s2 backdrop:bg-black/30'}
    >
      <div className="h-full [&>aside]:h-full">{children}</div>
      {state.toast && (
        <div role="status" className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-r2 bg-ink px-4 py-2.5 font-medium text-surface shadow-s2">
          {state.toast}
        </div>
      )}
    </dialog>
  );
}

export default function ChatPane() {
  const narrow = useNarrow();
  if (state.desk.chatHidden) return null;
  return narrow ? <Drawer><ChatView /></Drawer> : <ChatView />;
}
