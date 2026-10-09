// Feature module: chat. Exports page components and dialog components (see registry.js).
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { state, svc, toast, render, accessibleMessage, messageAttachment, fmtT, fmtD } from '../../shared/core.js';
import { filingRules, FILE_KINDS, ROOM_WORDS } from '../../shared/filing.js';
import {
  Btn, Card, Empty, Field, Input, Item, List, PageHeader, Select, ToggleChip,
} from '../../ui/ui';
import Icon from '../../ui/Icon';
import Modal, { ModalActions } from '../Modal';
import { FilingChip, FromChat } from '../parts';
import { ANNOUNCEMENTS } from '../data';
import { first, P } from '../helpers';
import { closeDialog, formData } from '../session';
import { ChatView, ConversationList, openAttachment } from '../chat/ChatPane';
import AssistDialog, { AssistSourceDialog } from '../chat/AssistDialog';
import { AttachmentPreview } from '../chat/media';
import {
  IssueReview, ProjectUpdateDialog, SiteIssueDialog, SiteReviewDialog,
} from '../chat/site';
import { conversationThreads, markChatRead, pendingFocus } from '../chat/store';
import { usePhone } from '../phone';
import { Stat } from '../studio/common';

const Unavailable = ({ title, children }) => (
  <Modal title={title}>
    {children}
    <ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions>
  </Modal>
);

// ---------- Chats workspace ----------
// Compact single-line row used by the supporting sections below the chat panel
// (not a DataTable - this area is secondary to the conversation and should read
// like a short activity list, not a report).
function FiledRow({ m, compact = false }) {
  const text = m.text || m.transcript || m.link?.title || '';
  if (compact) {
    return (
      <div className="border-t border-line py-2.5 first:border-t-0">
        <div className="flex items-baseline gap-2 text-[13px]">
          <small className="w-14 flex-none text-ink-3">{fmtT(m.at)}</small>
          <b className="flex-none font-medium">{first(m.by)}</b>
          <span className="min-w-0 flex-1 truncate text-ink-2" title={text}>{text}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3 pl-16">
          <FilingChip m={m} /><FromChat msgId={m.id} />
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[3.5rem_5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-line py-2.5 first:border-t-0 max-[1100px]:grid-cols-[3.5rem_minmax(0,1fr)_auto]">
      <small className="text-ink-3">{fmtT(m.at)}</small>
      <span className="truncate text-[13px] font-medium max-[1100px]:hidden">{first(m.by)}</span>
      <span className="min-w-0 truncate text-[13px] text-ink-2" title={text}>
        <b className="font-medium text-ink min-[1101px]:hidden">{first(m.by)}: </b>{text}
      </span>
      <span className="flex items-center gap-3 max-[1100px]:col-span-full max-[1100px]:col-start-2"><FilingChip m={m} /><FromChat msgId={m.id} /></span>
    </div>
  );
}

function ChatDesk({ rows, check, rules, dms, tucked = false }) {
  return (
    <>
      {/* Supporting workspace information, not a second dashboard - a normal, always-visible
          section with a plain heading, kept visually secondary to the chat panel above. */}
      <section className={tucked ? '' : 'mt-gap-lg border-t border-line pt-gap'}>
        <h2 className="m-0 text-[15px] font-semibold text-ink-2">AI filing review</h2>
        <p className="mb-gap mt-1 text-[13px] text-ink-3">How the AI filed chat messages, and what still needs a person to check.</p>
        <div className="mb-gap grid grid-cols-2 gap-gap lg:grid-cols-4">
          <Stat label="Messages" value={rows.length} sub="looked at" />
          <Stat label="Filed by AI" value={rows.filter((x) => x.f.by === 'ai' && x.f.status === 'filed').length} sub="no action needed" tone="text-ok" />
          <Stat label="Need a check" value={check.length} sub={check.length ? 'review below' : 'all clear'} tone={check.length ? 'text-warn' : 'text-ok'} />
          <Stat label="Corrected" value={rows.filter((x) => x.f.by === 'user').length} sub="by people" />
        </div>
        {check.length > 0 && (
          <Card title={`Please check these · ${check.length}`}>
            <p className="mb-2 mt-0 text-[13px] text-ink-3">The AI was not sure. Click the chip to file it in the right place.</p>
            <div className="flex flex-col">{check.map((x) => <FiledRow key={x.m.id} m={x.m} />)}</div>
          </Card>
        )}
      </section>

      <div className="mt-gap grid items-start gap-gap xl:grid-cols-2 [&>*]:min-w-0">
        <div className="flex flex-col gap-gap">
        <Card title="Direct messages and groups">
          <List empty="No direct messages for this role.">
            {dms.map((t) => (
              <Item key={t.id} onClick={() => openThreadFromList(t.id)}>
                <span className="min-w-0 flex-1 truncate text-[13px]"><b>{t.name}</b> <small className="text-ink-3">{t.memberIds.map(first).join(', ')}</small></span>
                <small className="flex-none text-ink-3">{t.kind}</small>
              </Item>
            ))}
          </List>
        </Card>
        <Card title="Rules the AI learned">
          {rules.length ? (
            <div className="flex flex-col">
              {rules.map(([k, p]) => (
                <div key={k} className="flex min-h-9 items-center gap-3 border-t border-line py-2 first:border-t-0 text-[13px]">
                  <span className="min-w-0 flex-1 truncate">{first(k.split('|')[0])} in {state.db.THREADS.find((t) => t.id === k.split('|')[1])?.name || k}</span>
                  <small className="flex-none text-ink-3">files to {P(p)?.name || p}</small>
                </div>
              ))}
            </div>
          ) : <Empty>Correct a filing and the AI remembers it for that sender and thread.</Empty>}
        </Card>
        </div>
        <div className="flex flex-col gap-gap">
        <Card title="Announcements">
          <div className="flex flex-col">
            {ANNOUNCEMENTS.length ? ANNOUNCEMENTS.map((a, i) => (
              <div key={i} className="flex min-h-9 items-center gap-3 border-t border-line py-2 first:border-t-0">
                <span className="min-w-0 flex-1 truncate text-[13px]">{a.text}</span>
                <small className="flex-none text-ink-3">{first(a.by)} · {fmtD(a.at)}</small>
              </div>
            )) : <Empty>No announcements.</Empty>}
          </div>
        </Card>
        <Card title="Recently filed">
          <div className="flex flex-col">
            {rows.filter((x) => x.f.status === 'filed').slice(-5).reverse().map((x) => <FiledRow key={x.m.id} m={x.m} compact />)}
          </div>
        </Card>
        </div>
      </div>
    </>
  );
}

function ChatsPage({ parts, q }) {
  const phone = usePhone();
  // "#/chats?thread=id" and "#/chats/id" open that conversation.
  const wanted = q.thread || parts[0] || '';
  useEffect(() => {
    if (!wanted) return;
    if (!svc.thread(wanted)) { toast('That conversation is not available for your role.'); return; }
    Object.assign(state.desk, { thread: wanted, chatList: false, chatHidden: false, hi: null });
    render();
  }, [wanted]);

  const desk = state.desk;
  const hasConversation = !desk.chatList && Boolean(svc.thread(desk.thread));
  if (hasConversation) markChatRead(desk.thread);
  const rows = svc.threads().flatMap((t) => svc.messages(t.id))
    .map((m) => ({ m, f: state.filings[m.id] })).filter((x) => x.f);
  const check = rows.filter((x) => x.f.status !== 'filed');
  const rules = Object.entries(filingRules);
  const dms = svc.threads().filter((t) => ['dm', 'group'].includes(t.kind));
  const deskInfo = <ChatDesk rows={rows} check={check} rules={rules} dms={dms} tucked={phone} />;

  // The list replaces the thread (and the thread replaces the list). Focus the row we came back to.
  useEffect(() => {
    if (!phone || hasConversation) return;
    const row = pendingFocus.current?.row;
    if (!row) return;
    pendingFocus.current = null;
    document.querySelector(`[data-thread="${CSS.escape(row)}"]`)?.focus();
  });

  if (phone && hasConversation) {
    return createPortal(
      <div className="fixed inset-0 z-40 flex min-h-0 flex-col bg-surface">
        <ChatView workspace />
      </div>,
      document.body,
    );
  }
  if (phone) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-surface">
        {desk.readStorageError && <p role="status" className="m-3 rounded-r1 bg-warn-soft px-3.5 py-2.5 font-medium text-warn">{desk.readStorageError}</p>}
        <ConversationList
          threads={conversationThreads()}
          filterable
          footer={(
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 border-b border-line px-3 py-3 [&::-webkit-details-marker]:hidden">
                <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-surface-2 text-ink-2">
                  <Icon name="folder" />
                </span>
                <span className="min-w-0 flex-1 text-[16px] font-medium">Filing and announcements</span>
                <Icon name="chev" small className="text-ink-3 transition group-open:rotate-90" />
              </summary>
              <div className="border-t border-line px-4 pb-4">{deskInfo}</div>
            </details>
          )}
        />
      </div>
    );
  }
  return (
    <>
      <PageHeader title="Chats" sub="Unread status is private to you in this browser." />
      {desk.readStorageError && <p role="status" className="mb-3 rounded-r1 bg-warn-soft px-3.5 py-2.5 font-medium text-warn">{desk.readStorageError}</p>}
      <div className="grid h-[clamp(420px,calc(100dvh-230px),850px)] grid-cols-[minmax(260px,34%)_minmax(0,1fr)] overflow-hidden rounded-r2 border border-line bg-surface max-[980px]:grid-cols-1">
        <section aria-label="Conversation list" className={`flex min-h-0 min-w-0 flex-col ${hasConversation ? 'max-[980px]:hidden' : ''}`}>
          <ConversationList threads={conversationThreads()} filterable />
        </section>
        <ChatView workspace />
      </div>
      {deskInfo}
    </>
  );
}
function openThreadFromList(id) {
  if (!svc.thread(id)) { toast('That conversation is not available for your role.'); return; }
  Object.assign(state.desk, { thread: id, chatList: false, chatHidden: false, hi: null });
  render();
}

// ---------- dialogs ----------
function AttachmentDialog({ d }) {
  const m = accessibleMessage(d.msgId);
  const a = m && messageAttachment(m);
  if (!a) return <Unavailable title="Attachment unavailable"><p>This attachment is no longer available for your role.</p></Unavailable>;
  return (
    <Modal title={a.title} wide>
      <p>{a.detail || ''}</p>
      <AttachmentPreview m={m} />
      {a.newerId && <Btn onClick={() => openAttachment(a.newerId)}>Open newer copy</Btn>}
      <ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions>
    </Modal>
  );
}

function FileDialog({ d }) {
  const m = state.db.MESSAGES.find((x) => x.id === d.msgId);
  const f = { ...(state.filings[d.msgId] || {}), ...(d.patch || {}) };
  const save = (e) => {
    e.preventDefault();
    const p = formData(e.currentTarget);
    const saved = svc.fileMessage(d.msgId, {
      projectId: p.projectId, room: p.room || null, kind: p.kind, drawing: p.drawing || null,
    });
    if (!saved) {
      state.desk.dialog.patch = p;
      render();
      toast(state.storageError || 'Filing was not saved. Your choices are kept; try again.');
      return;
    }
    state.desk.dialog = null;
    render();
    toast('Filing saved. You can change it again from the message.');
  };
  return (
    <Modal title="Where should this go?">
      <form onSubmit={save}>
        <p className="mb-3 text-ink-3">{(m?.text || m?.link?.title || '').slice(0, 120)}</p>
        <Field label="Project">
          <Select name="projectId" defaultValue={f.projectId}>
            {state.db.PROJECTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Room or area">
          <Select name="room" defaultValue={f.room || ''}>
            <option value="">Not room specific</option>
            {ROOM_WORDS.map(([, r]) => <option key={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="What is it">
          <Select name="kind" defaultValue={f.kind}>
            {Object.entries(FILE_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        <Field label="Drawing number"><Input name="drawing" defaultValue={f.drawing || ''} placeholder="HA-2401-A-101" /></Field>
        <ModalActions>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn kind="primary" type="submit">Save</Btn>
        </ModalActions>
      </form>
    </Modal>
  );
}

function VideoCallDialog({ d }) {
  const start = (e) => {
    e.preventDefault();
    svc.startCall(d.threadId, formData(e.currentTarget).provider);
    state.desk.dialog = null;
    toast('Call started.');
    render();
  };
  return (
    <Modal title="Start video call">
      <form onSubmit={start}>
        <label className="mb-2.5 flex items-center gap-2"><input type="radio" name="provider" value="meet" defaultChecked /> Google Meet</label>
        <label className="mb-2.5 flex items-center gap-2"><input type="radio" name="provider" value="jitsi" /> Jitsi, no account needed, best for clients and contractors</label>
        <ModalActions>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn kind="primary" type="submit">Start call</Btn>
        </ModalActions>
      </form>
    </Modal>
  );
}

const MEDIA_KINDS = ['Photos', 'Files', 'Links', 'Voice', 'Drawings'];
function MediaDialog({ d }) {
  const tab = MEDIA_KINDS.includes(d.tab) ? d.tab : 'Photos';
  const data = svc.media(d.threadId)[tab] || {};
  const entries = Object.entries(data);
  return (
    <Modal title="Media" wide>
      <div className="mb-3 flex flex-wrap gap-2">
        {MEDIA_KINDS.map((k) => (
          <ToggleChip
            key={k} on={k === tab}
            onClick={() => { if (state.desk.dialog?.kind === 'media') { state.desk.dialog.tab = k; render(); } }}
          >
            {k}
          </ToggleChip>
        ))}
      </div>
      {entries.length ? entries.map(([month, msgs]) => (
        <div key={month}>
          <h4 className="mb-1 mt-3 font-semibold">{month}</h4>
          <div className="flex flex-col gap-1.5">
            {msgs.map((m) => (
              <div key={m.id} className="min-h-11 rounded-r2 border border-line bg-surface px-3.5 py-2.5">
                {m.text || m.file?.name || m.link?.title || (m.voice ? 'Voice note' : '')}
              </div>
            ))}
          </div>
        </div>
      )) : <Empty>Nothing here yet.</Empty>}
      <ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions>
    </Modal>
  );
}

export const pages = {
  chats: ChatsPage,
  review: ({ parts }) => {
    let id = parts[0];
    try { id = decodeURIComponent(id); } catch (_) { /* keep raw */ }
    return <IssueReview id={id} />;
  },
};

export const dialogs = {
  assist: AssistDialog,
  'assist-source': AssistSourceDialog,
  'site-update': SiteReviewDialog,
  'site-issue': SiteIssueDialog,
  'message-attachment': AttachmentDialog,
  file: FileDialog,
  media: MediaDialog,
  'video-call': VideoCallDialog,
  'project-update': ProjectUpdateDialog,
};
