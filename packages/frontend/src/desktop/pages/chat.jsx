// Feature module: chat. Exports page components and dialog components (see registry.js).
import { useEffect } from 'react';
import { state, svc, toast, render, accessibleMessage, messageAttachment, fmtT, fmtD } from '../../shared/core.js';
import { filingRules, FILE_KINDS, ROOM_WORDS } from '../../shared/filing.js';
import {
  Btn, Card, DataTable, Empty, Field, Grid2, Input, Kpi, Kpis, PageHeader, Select,
} from '../../ui/ui';
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
import { conversationThreads, markChatRead } from '../chat/store';

const Unavailable = ({ title, children }) => (
  <Modal title={title}>
    {children}
    <ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions>
  </Modal>
);

// ---------- Chats workspace ----------
function filedTable(rows) {
  return (
    <DataTable
      cols={['When', 'Who', 'Message', 'Filed as', '']}
      rows={rows.map((x) => [
        fmtT(x.m.at),
        first(x.m.by),
        (x.m.text || x.m.transcript || x.m.link?.title || '').slice(0, 90),
        <FilingChip key="c" m={x.m} />,
        <FromChat key="f" msgId={x.m.id} />,
      ])}
    />
  );
}

function ChatsPage({ parts, q }) {
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
      <details className="mt-7">
        <summary className="cursor-pointer border-t border-line py-4 text-[17px] font-semibold">AI filing review · {check.length} to check</summary>
        <Kpis>
          <Kpi label="Messages" value={rows.length} />
          <Kpi label="Filed by AI" value={rows.filter((x) => x.f.by === 'ai' && x.f.status === 'filed').length} />
          <Kpi label="Need a check" value={check.length} crit={check.length > 0} />
          <Kpi label="Corrected by people" value={rows.filter((x) => x.f.by === 'user').length} />
        </Kpis>
        <Card title="Please check these">
          <p className="mb-3 text-[13px] text-ink-3">The AI was not sure. Click the chip to file it in the right place.</p>
          {filedTable(check.map((x) => ({ m: x.m })))}
        </Card>
        <div className="mt-3.5" />
        <Grid2>
          <Card title="Direct messages and groups">
            <div className="flex flex-col gap-1.5">
              {dms.length ? dms.map((t) => (
                <button
                  key={t.id} type="button" onClick={() => openThreadFromList(t.id)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-r2 border border-line bg-surface px-3.5 py-2.5 text-left hover:bg-surface-3"
                >
                  <span className="min-w-0 flex-1"><b>{t.name}</b><br /><small className="text-ink-3">{t.memberIds.map(first).join(', ')}</small></span>
                  <small className="text-ink-3">{t.kind}</small>
                </button>
              )) : <Empty>No direct messages for this role.</Empty>}
            </div>
            <h2 className="mb-2 mt-4 text-lg font-semibold">Announcements</h2>
            <div className="flex flex-col gap-1.5">
              {ANNOUNCEMENTS.map((a, i) => (
                <div key={i} className="flex min-h-11 items-center gap-3 rounded-r2 border border-line bg-surface px-3.5 py-2.5">
                  <span className="min-w-0 flex-1">{a.text}</span>
                  <small className="text-ink-3">{first(a.by)} · {fmtD(a.at)}</small>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Rules the AI learned">
            {rules.length ? (
              <DataTable
                cols={['Sender in thread', 'Files to']}
                rows={rules.map(([k, p]) => [
                  first(k.split('|')[0]) + ' in ' + (state.db.THREADS.find((t) => t.id === k.split('|')[1])?.name || k),
                  P(p)?.name || p,
                ])}
              />
            ) : <Empty>Correct a filing and the AI remembers it for that sender and thread.</Empty>}
            <h2 className="mb-2 mt-4 text-lg font-semibold">Recently filed</h2>
            {filedTable(rows.filter((x) => x.f.status === 'filed').slice(-8).reverse().map((x) => ({ m: x.m })))}
          </Card>
        </Grid2>
      </details>
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
          <Btn
            key={k} sm aria-pressed={k === tab}
            className={k === tab ? '!border-accent !bg-accent-soft !text-accent-text' : ''}
            onClick={() => { if (state.desk.dialog?.kind === 'media') { state.desk.dialog.tab = k; render(); } }}
          >
            {k}
          </Btn>
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
