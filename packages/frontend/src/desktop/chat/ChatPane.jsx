// Right-hand conversation pane (drawer <dialog> on narrow screens) and the shared thread view.
import {
  useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore,
} from 'react';
import {
  state, svc, can, persist, toast, render, parseRoute, fmtT, fmtD, safeAssetUrl, AIProvider, messageAttachment,
} from '../../shared/core.js';
import { seedFilings } from '../../shared/filing.js';
import { Btn, Pill, Dropdown, DropdownItem, IconButton } from '../../ui/ui';
import { P, name, role, staff } from '../helpers';
import { FilingChip } from '../parts';
import { openDialog, openThread, toggleChatPane } from '../session';
import { Ph } from './media';
import { MessageAssist } from './assist';
import { SiteMessageAction } from './site';
import AttachMenu from './AttachMenu';
import CameraCapture from './CameraCapture';
import MediaEditor from './MediaEditor';
import { ContactPicker, PollComposer } from './composerAttachments';
import { fileToDataUrl, fmtBytes } from './mediaUtils';
import {
  chatDraft, conversationPreview, conversationThreads, draftRev, markChatRead, pendingFocus,
  setChatDraft, unreadCount, useDraftTick,
} from './store';

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
function pick(m, option) {
  m.decision = option;
  m.options = [];
  svc.addMessage(m.threadId, { text: `Decision: ${option}`, decision: true });
  seedFilings();
  toast('Decision recorded.');
}
function billDecision(m, ok) {
  if (ok) {
    m.bill.status = 'approved';
    m.bill.decidedAt = new Date().toISOString();
    m.bill.by = state.userId;
    svc.log('Approved expense ₹' + m.bill.amount, 'Message ' + m.id);
    toast('Approved. Reimburse with salary.');
  } else {
    m.bill.status = 'query';
    svc.addMessage(m.threadId, { text: 'Send the bill photo please, then I approve.' });
    toast('Asked for the bill.');
  }
  persist();
  render();
}
function approveMsg(m) {
  m.approval.done = true;
  m.approval.doneAt = new Date().toISOString().slice(0, 16);
  svc.log('Approved in chat · ' + m.approval.label, 'Message ' + m.id);
  svc.addMessage(m.threadId, { text: `Approved: ${m.approval.label}` });
  seedFilings();
  toast('Approved. The studio has been told.');
}
async function sendMessage(tid, raw, extra) {
  const text = raw.trim();
  if (!text && !extra) return toast('Type a message first.');
  let id;
  try { id = svc.addMessage(tid, { ...(text ? { text } : {}), ...extra }); } catch (_) {
    return toast('Message was not sent. Your draft is kept; check access and try again.');
  }
  setChatDraft(tid, '');
  state.desk.hi = null;
  render();
  try {
    state.filings[id] = await AIProvider.classify(state.db.MESSAGES.find((m) => m.id === id), svc.thread(tid));
    persist();
  } catch (_) { toast('Message sent. AI filing is unavailable; you can file it manually.'); }
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
export function ConversationList({ threads, filterable = false }) {
  useDraftTick();
  const [q, setQ] = useState('');
  const unreadOnly = filterable && state.desk.chatFilter === 'unread';
  const needle = q.trim().toLowerCase();
  const rows = threads
    .filter((t) => !unreadOnly || unreadCount(t.id))
    .filter((t) => !needle || t.name.toLowerCase().includes(needle) || conversationPreview(svc.messages(t.id).at(-1)).toLowerCase().includes(needle));
  const setFilter = (v) => { state.desk.chatFilter = v; render(); };
  return (
    <>
      {filterable && (
        <div className="flex flex-col gap-2 border-b border-line px-4 py-3">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="min-h-9 rounded-r1 border border-line-2 bg-surface-2 px-3 text-ink placeholder:text-ink-3 focus:border-line-2 focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent-soft"
          />
          <div role="group" aria-label="Filter conversations" className="flex gap-2">
            {[['all', 'All', !unreadOnly], ['unread', 'Unread', unreadOnly]].map(([k, l, on]) => (
              <Btn
                key={k} sm aria-pressed={on} onClick={() => setFilter(k)}
                className={on ? '!border-accent !bg-accent-soft !text-accent-text' : ''}
              >
                {l}
              </Btn>
            ))}
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {rows.map((t) => {
          const last = svc.messages(t.id).at(-1);
          const unread = unreadCount(t.id);
          const draft = chatDraft(t.id).trim();
          const current = t.id === state.desk.thread && !state.desk.chatList;
          return (
            <button
              key={t.id}
              type="button"
              data-thread={t.id}
              aria-current={current ? 'true' : undefined}
              onClick={() => openThreadFocus(t.id)}
              className={`flex min-h-[84px] w-full items-center gap-3 border-0 border-b border-line px-4 py-3.5 text-left text-inherit hover:bg-surface-2 ${current ? 'bg-accent-soft' : 'bg-transparent'}`}
            >
              <span className="inline-grid h-10 w-10 flex-none place-items-center rounded-full bg-surface-3 text-[13px] font-semibold">{t.name.slice(0, 1)}</span>
              <span className="min-w-0 flex-1">
                <b className={`block leading-snug ${unread > 0 ? 'font-semibold text-ink' : 'font-medium text-ink-2'}`}>{t.name}</b>
                <small className={`mt-1 block truncate text-xs ${unread > 0 ? 'text-ink-2' : 'text-ink-3'}`}>{draft || conversationPreview(last)}</small>
              </span>
              <span className="flex flex-none flex-col items-end gap-1 text-[11px]">
                <small className="text-ink-3">{last ? fmtD(last.at) : ''}</small>
                {draft && <span className="font-semibold text-accent-text">Draft</span>}
                {unread > 0 && <span className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 font-semibold text-accent-ink">{unread}</span>}
              </span>
            </button>
          );
        })}
        {!rows.length && (
          <p className="m-4 rounded-r2 bg-surface-2 p-6 text-center text-ink-3">
            {needle ? 'No conversations match your search.' : unreadOnly ? 'No unread conversations.' : 'No conversations available for your role.'}
          </p>
        )}
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

function Message({ m }) {
  const mine = m.by === state.userId;
  const live = !m.deleted;
  const callUrl = live && m.call ? safeAssetUrl(m.call.url) : '';
  return (
    <div
      data-msgid={m.id}
      className={`max-w-[92%] shrink-0 overflow-hidden border px-3 py-2.5 text-sm [overflow-wrap:anywhere] rounded-r3 ${mine ? 'self-end border-transparent bg-mine' : 'self-start border-line bg-surface'} ${state.desk.hi === m.id ? 'outline outline-2 outline-offset-1 outline-accent' : ''}`}
    >
      <div className="mb-1.5 text-xs font-semibold text-accent-text">
        {name(m.by)}{m.pinned ? ' · pinned' : ''}{m.notice ? ' · notice to everyone' : ''}
      </div>
      {m.deleted && <div className="text-ink-3"><i>This message was deleted</i></div>}
      {m.bill && live && (
        <Opts>
          <span className="flex flex-wrap items-center gap-1.5">
            <b>₹{m.bill.amount.toLocaleString('en-IN')}</b>
            <Pill kind={m.bill.status === 'approved' ? '' : 'warn'}>
              {m.bill.status === 'approved' ? 'approved' : m.bill.status === 'query' ? 'bill asked' : 'reimbursement asked'}
            </Pill>
            {m.bill.status === 'asked' && m.by !== state.userId && (can('material', 'a') || role() === 'partner') && (
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
          <span><b>Video call</b> · {m.call.provider === 'jitsi' ? 'Jitsi' : 'Google Meet'}<br />
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
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {staff() && <FilingChip m={m} />}
        <time className="ml-auto text-[11px] text-ink-3">{m.edited ? 'edited · ' : ''}{fmtT(m.at)}</time>
      </div>
    </div>
  );
}

function Messages({ threadId, ms }) {
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
  return (
    <div ref={ref} className="flex min-h-0 flex-1 flex-col gap-gap overflow-auto bg-chat px-3.5 py-4">
      {ms.map((m) => <Message key={m.id} m={m} />)}
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
  const onPickAction = (kind) => setPending({ type: kind });

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
    <div className="border-t border-line p-3">
      <p role="status" className="m-0 min-h-0 text-xs text-crit empty:hidden">{status}</p>
      {staff() && last && last.by !== state.userId && (
        <Btn kind="link" sm className="mb-2" onClick={() => suggestReply(thread.id)}>✨ Suggest reply</Btn>
      )}
      {(pending?.type === 'document' || pending?.type === 'audio') && (
        <PendingFileBar pending={pending} onCancel={() => setPending(null)} onSend={sendSimpleFile} />
      )}
      {pending?.type === 'editor' && (
        <MediaEditor
          file={pending.file}
          kind={pending.kind}
          onCancel={() => setPending(null)}
          onSend={(media) => { sendMessage(thread.id, '', { media }); setPending(null); }}
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
      <form
        className="flex w-full gap-2"
        onSubmit={(e) => { e.preventDefault(); sendMessage(thread.id, text); }}
      >
        <AttachMenu onPickFile={onPickFile} onPickAction={onPickAction} />
        <input
          data-composer
          name="text"
          value={text}
          onChange={(e) => { setText(e.target.value); setChatDraft(thread.id, e.target.value, state.userId, true); }}
          placeholder={`Message ${thread.name}`}
          aria-label="Message"
          autoComplete="off"
          className="min-h-10 w-full min-w-0 rounded-r1 border border-line bg-surface-2 px-3 text-ink focus:border-line-2 focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent-soft"
        />
        <Btn kind="primary" type="submit" className="!min-h-10">Send</Btn>
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
const KIND_LABEL = { client: 'Shared with client', site: 'Site team', internal: 'Studio team only' };
const contextLine = (t) => {
  const label = KIND_LABEL[t.kind] || 'Members of this conversation';
  const proj = t.projectId ? P(t.projectId)?.name : null;
  return proj ? `${label} · ${proj}` : label;
};

export function ChatView({ workspace = false }) {
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
  const ms = svc.messages(cur.id);
  const last = ms[ms.length - 1];
  const sib = !desk.chatList && cur.projectId && cur.kind !== 'dm'
    ? svc.threads().filter((x) => x.projectId === cur.projectId && x.kind !== 'dm') : [];
  return (
    <aside
      id="conversation"
      ref={paneRef}
      aria-label="Conversations"
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-line bg-surface ${workspace ? 'h-full max-[980px]:border-l-0' : ''}`}
    >
      <div className="flex min-h-20 flex-wrap items-center gap-2 border-b border-line p-4">
        {/* "Back" only matters when the conversation list isn't already on screen — the narrow
            (<980px) single-column layout, or the drawer this pane becomes on small viewports. */}
        {(!desk.chatList || !workspace) && (
          <div className="flex basis-full items-center justify-between gap-2 empty:hidden">
            <span>{!desk.chatList ? <IconButton sm icon="back" label="Back to conversations" onClick={showList} className={workspace ? 'hidden max-[980px]:inline-grid' : ''} /> : null}</span>
            <span>{!workspace ? <IconButton sm icon="x" label="Close chats" onClick={toggleChatPane} /> : null}</span>
          </div>
        )}
        <div ref={titleRef} tabIndex={-1} className="min-w-0 basis-full focus:outline-none">
          <b className="block font-semibold leading-snug">
            {desk.chatList ? (project && !desk.allChats ? project.name : 'Conversations') : cur.name}
          </b>
          <small className="mt-1 block text-xs text-ink-3">{desk.chatList ? 'Choose a conversation' : contextLine(cur)}</small>
        </div>
        {!desk.chatList && (
          <div className="flex items-center gap-2">
            <Btn sm onClick={() => openDialog({ kind: 'media', threadId: cur.id, tab: 'Photos' })}>Media</Btn>
            {sib.length > 1 && (
              <Dropdown trigger="Context" align="left" panelClassName="!w-56">
                {sib.map((x) => (
                  <DropdownItem key={x.id} onClick={() => openThreadFocus(x.id)} className={x.id === cur.id ? '!bg-accent-soft !text-accent-text' : ''}>
                    {x.name}
                  </DropdownItem>
                ))}
              </Dropdown>
            )}
            {/* Video calling is a real but occasional workflow — one tap away, not a prominent
                header button next to Media. */}
            <Dropdown trigger="More" align="right" panelClassName="!w-48">
              <DropdownItem onClick={() => openDialog({ kind: 'video-call', threadId: cur.id })}>Start video call</DropdownItem>
            </Dropdown>
          </div>
        )}
      </div>
      {!desk.chatList && cur.kind === 'internal' && (
        <div className="bg-warn-soft px-3.5 py-2.5 font-medium text-warn">Internal only. Client never sees this thread.</div>
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
          <Messages threadId={cur.id} ms={ms} />
          <Composer key={cur.id + state.userId} thread={cur} last={last} />
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
      className="fixed left-auto right-0 top-[60px] m-0 h-[calc(100dvh-60px)] max-h-none w-[min(420px,100vw)] max-w-[100vw] overflow-hidden border-0 border-l border-line bg-surface p-0 text-ink shadow-s2 backdrop:bg-black/30 max-[600px]:top-[108px] max-[600px]:h-[calc(100dvh-108px)]"
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
