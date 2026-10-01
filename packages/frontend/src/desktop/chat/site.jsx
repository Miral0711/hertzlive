// Site updates: review queue, project updates card, site-update review, issue reply workspace.
import { state, svc, toast, render, go, fmtD, fmtDT, accessibleMessage } from '../../shared/core.js';
import {
  Btn, Card, Field, Input, Select, StatusPill, Textarea,
} from '../../ui/ui';
import Icon from '../../ui/Icon';
import Modal, { ModalActions } from '../Modal';
import { DLink } from '../nav';
import { name, role } from '../helpers';
import { closeDialog, formData, openDialog, openMsg, resetHooks } from '../session';
import { AttachmentPreview } from './media';
import { assistAllowed, openDesktopAssist, saveDesktopAssist } from './assistCore';

const focusMain = (opts) => document.getElementById('workspace')?.focus(opts);
const later = (fn) => setTimeout(fn, 60);

const Row = ({ action, children }) => (
  <div className="flex min-h-11 items-center gap-4 rounded-r2 border border-line bg-surface px-3.5 py-2.5">
    <span className="min-w-0 flex-1 [&>small]:mt-1 [&>small]:block [&>span]:mt-1 [&>span]:block">{children}</span>
    {action}
  </div>
);
const Sub = ({ children }) => <small className="text-ink-3">{children}</small>;

// ---------- project updates ----------
export function projectUpdateOpen(id) {
  const u = svc.projectUpdates().find((x) => x.id === id);
  if (!u) return toast('That update is unavailable for your role.');
  if (u.source.type === 'message') return openMsg(u.source.id);
  return openDialog({ kind: 'project-update', id: u.id });
}

function UpdateRow({ u }) {
  return (
    <Row action={<Btn sm onClick={() => projectUpdateOpen(u.id)}>View source</Btn>}>
      <b className="block">{u.title}</b>
      <Sub>{svc.project(u.projectId)?.name || ''} · {fmtD(u.at)}</Sub>
      <span>{u.detail}</span>
    </Row>
  );
}

export function ProjectUpdates({ projectId }) {
  const updates = svc.projectUpdates({ projectId });
  const list = (rows) => <div className="flex flex-col gap-1.5">{rows.map((u) => <UpdateRow key={u.id} u={u} />)}</div>;
  if (projectId) {
    if (!updates.length) return null;
    return (
      <Card title="Recent important changes">
        {list(updates.slice(0, 2))}
        {updates.length > 2 && (
          <details className="mt-2">
            <summary className="cursor-pointer font-semibold">View all {updates.length} changes</summary>
            <div className="mt-2">{list(updates.slice(2))}</div>
          </details>
        )}
      </Card>
    );
  }
  return (
    <details className="rounded-r3 border border-line bg-surface p-card">
      <summary className="cursor-pointer font-semibold">Updates · {updates.length}</summary>
      <p className="my-2 text-ink-3">Recorded project changes. Routine messages stay in Chats; work needing action stays in Today.</p>
      {updates.length ? list(updates.slice(0, 5)) : <p className="text-ink-3">No recorded changes available to you.</p>}
      {updates.length > 5 && (
        <details className="mt-2">
          <summary className="cursor-pointer font-semibold">Show {updates.length - 5} earlier updates</summary>
          <div className="mt-2">{list(updates.slice(5))}</div>
        </details>
      )}
    </details>
  );
}

export function ProjectUpdateDialog({ d }) {
  const u = svc.projectUpdates().find((x) => x.id === d.id);
  if (!u) {
    return (
      <Modal title="Update unavailable">
        <p>Your access or the source record changed.</p>
        <ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions>
      </Modal>
    );
  }
  return (
    <Modal title={u.title}>
      <p className="text-ink-3">{svc.project(u.projectId)?.name || ''} · {fmtD(u.at)}</p>
      <p>{u.detail}</p>
      <p className="text-ink-3">
        {u.kind === 'drawing'
          ? 'Transmittal record. The original drawing file is not attached to this prototype.'
          : 'Recorded delivery. Quantities reflect the saved site record.'}
      </p>
      <ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions>
    </Modal>
  );
}

// ---------- site review queue ----------
const hasSuggestion = (r) => (r.canAttendance && r.suggestion.headcount) || (r.canDelivery && r.suggestion.delivery)
  || (r.canIssue && r.suggestion.issueTitle);

export function SiteReviewQueue() {
  if (!['partner', 'designer', 'site_manager'].includes(role())) return null;
  const reviews = svc.threads().flatMap((t) => svc.messages(t.id))
    .map((m) => svc.siteUpdateReview(m.id))
    .filter((r) => r && !r.applied && !r.message.issueId && hasSuggestion(r));
  const awaiting = svc.issues().map((i) => svc.siteIssueDetails(i.id)).filter((x) => x?.canAnswer && x.needsAnswer);
  const rows = awaiting.map((x) => (
    <Row key={'i' + x.issue.id} action={<Btn sm onClick={() => openIssueReview(x.issue.id)}>View update / reply</Btn>}>
      <b className="block">{x.issue.title}</b>
      <Sub>{x.answers.at(-1)?.siteAnswer.response === 'clarification' ? 'Site needs clarification' : 'Needs an answer'} · {x.thread.name}</Sub>
    </Row>
  )).concat(reviews.map((r) => (
    <Row key={'m' + r.message.id} action={<Btn sm onClick={() => openDialog({ kind: 'site-update', msgId: r.message.id })}>Review update</Btn>}>
      <b className="block">{r.site.name}</b>
      <Sub>{name(r.message.by)} · {fmtDT(r.message.at)}</Sub>
      <span>{(r.message.transcript || r.message.text || 'Site update').slice(0, 140)}</span>
    </Row>
  )));
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-lg font-semibold">From site</h2>
        <span className="text-ink-3">{rows.length} to review</span>
      </div>
      <p className="mb-2.5 mt-1 text-[13px] text-ink-3">Questions and suggested records · AI suggestions are simulated.</p>
      <div className="flex flex-col gap-1.5">
        {rows.length ? rows.slice(0, 2) : <p className="text-ink-3">No site updates need a record review or office answer.</p>}
      </div>
      {rows.length > 2 && (
        <details className="mt-2">
          <summary className="cursor-pointer font-semibold">Show {rows.length - 2} more site updates</summary>
          <div className="mt-2 flex flex-col gap-1.5">{rows.slice(2)}</div>
        </details>
      )}
    </Card>
  );
}

// Site-related actions under a chat message.
export function SiteMessageAction({ m }) {
  if (m.deleted || m.pending) return null;
  const wrap = 'mt-2 flex flex-wrap items-center gap-2';
  if (m.siteAnswer) {
    const s = m.siteAnswer;
    return (
      <div className={wrap}>
        <Sub>
          Office answer · {s.response === 'acknowledged' ? 'Acknowledged by ' + name(s.respondedBy)
            : s.response === 'clarification' ? 'Clarification requested' : 'Waiting for site acknowledgment'}
        </Sub>
        <Btn sm onClick={() => openDialog({ kind: 'site-issue', issueId: s.issueId })}>View source and answers</Btn>
      </div>
    );
  }
  const r = svc.siteUpdateReview(m.id);
  if (!r) return null;
  if (r.applied || m.issueId) {
    const id = r.applied?.issueId || m.issueId;
    return (
      <div className={wrap}>
        <Sub>{r.applied ? 'Confirmed records · included in daily log' : 'Linked to issue'}</Sub>
        {id && <Btn sm onClick={() => openDialog({ kind: 'site-issue', issueId: id })}>View update / reply</Btn>}
      </div>
    );
  }
  if (!hasSuggestion(r)) return null;
  return (
    <div className={wrap}>
      <Sub>AI suggestion · demo</Sub>
      <Btn sm onClick={() => openDialog({ kind: 'site-update', msgId: m.id })}>Review site update</Btn>
    </div>
  );
}

// ---------- site update review dialog ----------
export function SiteReviewDialog({ d }) {
  const r = svc.siteUpdateReview(d.msgId);
  if (!r) {
    return (
      <Modal title="Update unavailable">
        <p>This update is no longer available for your role.</p>
        <ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions>
      </Modal>
    );
  }
  if (r.applied) {
    return (
      <Modal title="Already confirmed">
        <p>The selected records are already saved. This update will not create duplicates.</p>
        <ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions>
      </Modal>
    );
  }
  const s = r.suggestion;
  const v = d.patch || {
    attendance: !!s.headcount, headcount: s.headcount, delivery: !!s.delivery, ...s.delivery, issue: !!s.issueTitle, title: s.issueTitle, issueId: '',
  };
  const save = (e) => {
    e.preventDefault();
    const p = formData(e.currentTarget);
    const patch = { ...p, attendance: !!p.attendance, delivery: !!p.delivery, issue: !!p.issue };
    state.desk.dialog = { kind: 'site-update', msgId: d.msgId, patch };
    try { svc.saveSiteUpdate(d.msgId, patch); } catch (error) {
      state.desk.dialog.error = error.message || 'Records were not saved. Your choices are kept.';
      render();
      return;
    }
    state.desk.dialog = null;
    render();
    toast('Selected records confirmed. Daily logs reuse this update.');
  };
  const legend = (n, checked, label) => (
    <legend className="px-1.5">
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" name={n} defaultChecked={checked} className="h-[18px] w-[18px] accent-[var(--accent)]" /> {label}
      </label>
    </legend>
  );
  const box = 'my-4 rounded-r2 border border-line p-3';
  return (
    <Modal title="Review site update" wide>
      <form onSubmit={save}>
        <p className="text-ink-3">AI suggestion · demo. Check against the source; only selected records will be saved.</p>
        <blockquote className="my-3 border-l-[3px] border-accent bg-surface-2 px-3 py-2.5">{r.message.transcript || r.message.text || 'Photo update'}</blockquote>
        <p>{r.site.name} · {name(r.message.by)}</p>
        {r.canAttendance && s.headcount && (
          <fieldset className={box}>
            {legend('attendance', v.attendance, 'Record attendance')}
            <Field label="Workers on site"><Input name="headcount" type="number" min="0" max="10000" step="1" defaultValue={v.headcount || ''} /></Field>
          </fieldset>
        )}
        {r.canDelivery && s.delivery && (
          <fieldset className={box}>
            {legend('delivery', v.delivery, 'Record delivery')}
            <p className="text-ink-3">Enter received and ordered quantities, or uncheck delivery to leave it unrecorded.</p>
            <Field label="Item"><Input name="item" defaultValue={v.item || ''} /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Received"><Input name="received" type="number" min="0" step="any" defaultValue={v.received ?? ''} /></Field>
              <Field label="Ordered"><Input name="ordered" type="number" min="0" step="any" defaultValue={v.ordered ?? ''} /></Field>
              <Field label="Unit"><Input name="unit" defaultValue={v.unit || ''} /></Field>
            </div>
          </fieldset>
        )}
        {r.canIssue && s.issueTitle && (
          <fieldset className={box}>
            {legend('issue', v.issue, 'Track this issue')}
            <Field label="Issue title"><Input name="title" defaultValue={v.title || ''} /></Field>
            <Field label="Keep related work together">
              <Select name="issueId" defaultValue={v.issueId || ''}>
                <option value="">Create a new issue</option>
                {r.relatedIssues.map((i) => <option key={i.id} value={i.id}>Link to: {i.title}</option>)}
              </Select>
            </Field>
            <p className="text-ink-3">Possible matches are suggestions. Linking keeps the original message and adds no duplicate issue.</p>
          </fieldset>
        )}
        {d.error && <p role="alert" className="rounded-r1 bg-warn-soft px-3 py-2 font-medium text-warn">{d.error}</p>}
        <ModalActions>
          <Btn onClick={closeDialog}>Cancel</Btn>
          <Btn kind="primary" type="submit">Confirm selected records</Btn>
        </ModalActions>
      </form>
    </Modal>
  );
}

// ---------- issue dialog (site-issue) ----------
const responseLabel = (x) => (x === 'acknowledged' ? 'Acknowledged' : x === 'clarification' ? 'Clarification requested' : 'Waiting for site acknowledgment');
const Quote = ({ children }) => <blockquote className="my-3 border-l-[3px] border-accent bg-surface-2 px-3 py-2.5">{children}</blockquote>;

export function openIssueBrief(id) {
  const detail = svc.siteIssueDetails(id);
  if (!detail) return;
  const previous = state.desk.dialog;
  const wasReview = state.route.replace(/^#\/?/, '').split(/[/?]/)[0] === 'review';
  openDesktopAssist('ask', {
    projectId: detail.issue.projectId, issueId: detail.issue.id, question: 'Summarise the recorded history of this issue.',
  });
  const cur = state.desk.dialog;
  if (cur?.kind === 'assist') {
    cur.returnReview = wasReview;
    cur.returnIssue = previous?.kind === 'site-issue' ? previous : { kind: 'site-issue', issueId: detail.issue.id };
    saveDesktopAssist(cur);
  }
}

export function openSourceMessage(msgId) {
  state.desk.dialog = null;
  openMsg(msgId);
}

export function SiteIssueDialog({ d }) {
  const detail = svc.siteIssueDetails(d.issueId);
  if (!detail || !detail.sources.length) {
    return (
      <Modal title="Update unavailable">
        <p>This update is no longer available for your role.</p>
        <ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions>
      </Modal>
    );
  }
  const send = (e) => {
    e.preventDefault();
    const text = formData(e.currentTarget).text || '';
    state.desk.dialog = { kind: 'site-issue', issueId: d.issueId, text };
    try { svc.answerSiteIssue(d.issueId, text); } catch (error) {
      state.desk.dialog.error = error.message || 'Answer was not sent. Your words are kept.';
      render();
      return;
    }
    state.desk.dialog = { kind: 'site-issue', issueId: d.issueId };
    render();
    toast('Answer sent to the source conversation. The issue remains open.');
  };
  return (
    <Modal title={detail.issue.title} wide>
      <p className="text-ink-3">
        Issue: <StatusPill status={String(detail.issue.status).replace(/^./, (c) => c.toUpperCase())} /> · Sending an answer does not close the issue.
      </p>
      {assistAllowed('ask') && <Btn sm onClick={() => openIssueBrief(d.issueId)}>Summarise this issue</Btn>}
      <h4 className="mb-1 mt-3 font-semibold">Source and linked updates</h4>
      {detail.sources.map((m) => (
        <Quote key={m.id}>
          {m.transcript || m.text || 'Photo update'}
          <small className="my-2 block text-ink-3">{name(m.by)} · {fmtDT(m.at)}</small>
          <Btn sm onClick={() => openSourceMessage(m.id)}>Open source message</Btn>
        </Quote>
      ))}
      {detail.answers.length > 0 && (
        <>
          <h4 className="mb-1 mt-3 font-semibold">Answers to site</h4>
          {detail.answers.map((m) => (
            <Quote key={m.id}>
              {m.text}
              <small className="my-2 block text-ink-3">{name(m.by)} · {responseLabel(m.siteAnswer.response)}</small>
            </Quote>
          ))}
        </>
      )}
      {detail.canAnswer && detail.thread && detail.issue.status !== 'closed' ? (
        <form onSubmit={send}>
          <Field label="Reply to site">
            <Textarea
              name="text" rows={3} required maxLength={4000} defaultValue={d.text || ''}
              placeholder="Write the confirmed instruction or ask for a specific detail."
              onInput={(e) => { d.text = e.target.value; }}
            />
          </Field>
          <p className="text-ink-3">This answer goes to {detail.thread.name} and remains linked to the original question.</p>
          {d.error && <p role="alert" className="rounded-r1 bg-warn-soft px-3 py-2 font-medium text-warn">{d.error}</p>}
          <ModalActions>
            <Btn onClick={closeDialog}>Close</Btn>
            <Btn kind="primary" type="submit">Send answer to {detail.thread.name}</Btn>
          </ModalActions>
        </form>
      ) : <ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions>}
    </Modal>
  );
}

// ---------- issue review workspace (page "review") ----------
// A reply stays private until its exact text and destination are reviewed.
const replyDrafts = new Map();
resetHooks.push(() => replyDrafts.clear());
const replyKey = (id) => `archos-office-reply:${state.userId}:${role()}:${id}`;
function issueReplyState(id) {
  const key = replyKey(id);
  if (!replyDrafts.has(key)) {
    let text = '', storageError = '';
    try { text = localStorage.getItem(key) || ''; } catch (_) { storageError = 'Draft storage is unavailable. Keep this window open.'; }
    replyDrafts.set(key, { id, key, text, step: 'write', storageError });
  }
  return replyDrafts.get(key);
}
function saveIssueReply(d, text) {
  d.text = text;
  try { localStorage.setItem(d.key, text); d.storageError = ''; } catch (_) {
    d.storageError = text ? 'Draft kept in this tab only. Keep it open until you send.' : 'Reply sent, but the old saved draft could not be cleared on this device.';
  }
}
const issueSnapshot = (x) => JSON.stringify([x.thread?.id, x.thread?.name, x.issue.status, x.sources, x.answers]);
function replyPhase(d, step) {
  d.step = step;
  render();
  setTimeout(() => (step === 'write' ? document.querySelector('#office-reply') : document.getElementById('reply-heading'))?.focus(), 0);
}

const curPage = () => state.route.replace(/^#\/?/, '').split('?')[0].split('/');

export function openIssueReview(id, next = false) {
  const detail = svc.siteIssueDetails(id);
  if (!detail) return;
  const d = issueReplyState(detail.issue.id);
  const current = curPage();
  if (current[0] !== 'review') {
    d.back = state.route;
    d.backTop = document.getElementById('workspace')?.scrollTop || 0;
    d.backLabel = current[0] === 'today' ? 'Back to Today' : current[0] === 'sites' ? 'Back to site' : 'Back to project';
  } else if (next) {
    const previous = issueReplyState(current[1]);
    d.back = previous.back; d.backTop = previous.backTop; d.backLabel = previous.backLabel;
  }
  d.step = 'write';
  d.error = '';
  state.desk.dialog = null;
  go(`#/review/${encodeURIComponent(detail.issue.id)}`);
  later(() => focusMain());
}

function reviewSourceOpen(id) {
  const m = accessibleMessage(id);
  if (!m) return;
  Object.assign(state.desk, { thread: m.threadId, chatList: false, hi: m.id, dialog: null });
  go('#/chats');
  later(() => focusMain());
}

function ReviewSource({ m }) {
  return (
    <article className="my-3 rounded-r2 border border-line bg-surface p-3.5">
      <p>{m.transcript || m.text || 'Photo update'}</p>
      <AttachmentPreview m={m} />
      <small className="mb-2 block text-ink-3">{name(m.by)} · {fmtDT(m.at)}</small>
      <Btn sm onClick={() => reviewSourceOpen(m.id)}>Open original conversation</Btn>
    </article>
  );
}

export function IssueReview({ id }) {
  const detail = svc.siteIssueDetails(id);
  if (!detail) {
    return (
      <>
        <h1 className="text-2xl font-semibold">Question unavailable</h1>
        <p>This record is no longer available for your role.</p>
        <DLink to="#/projects" className="text-accent-text underline">Back to projects</DLink>
      </>
    );
  }
  const d = issueReplyState(id);
  const { issue, sources, answers, thread } = detail;
  const project = svc.project(issue.projectId);
  const back = d.back || `#/projects/${encodeURIComponent(issue.projectId)}`;
  const latest = answers.at(-1);
  const next = svc.issues({ projectId: issue.projectId }).filter((i) => i.id !== id)
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
    .find((i) => { const x = svc.siteIssueDetails(i.id); return x?.canAnswer && x.needsAnswer; });
  const status = issue.status === 'closed' ? 'Closed' : detail.needsAnswer ? 'Awaiting office answer'
    : latest?.siteAnswer.response === 'acknowledged' ? 'Site acknowledged' : 'Awaiting site acknowledgement';
  const goBack = (e) => {
    e.preventDefault();
    go(back);
    later(() => {
      const main = document.getElementById('workspace');
      if (main) { main.scrollTop = d.backTop || 0; main.focus({ preventScroll: true }); }
    });
  };
  const review = (e) => {
    e.preventDefault();
    if (!detail.canAnswer) return;
    saveIssueReply(d, String(formData(e.currentTarget).text || ''));
    if (!d.text.trim() || d.text.length > 4000) { d.error = 'Enter an answer of up to 4,000 characters.'; replyPhase(d, 'write'); return; }
    d.error = '';
    d.snapshot = issueSnapshot(detail);
    replyPhase(d, 'review');
  };
  const sendReply = (e) => {
    e.preventDefault();
    if (d.step !== 'review') return;
    const fresh = svc.siteIssueDetails(d.id);
    if (!fresh?.canAnswer) { d.error = 'You can no longer answer this question.'; replyPhase(d, 'write'); return; }
    if (issueSnapshot(fresh) !== d.snapshot) {
      d.error = 'This question changed while you were writing. Read the updated evidence, then review your answer again.';
      replyPhase(d, 'write');
      return;
    }
    try { svc.answerSiteIssue(d.id, d.text); } catch (error) {
      d.error = error.message || 'Answer was not sent. Your draft is kept.';
      replyPhase(d, 'review');
      return;
    }
    d.error = '';
    saveIssueReply(d, '');
    replyPhase(d, 'sent');
  };
  const eyebrow = 'm-0 text-xs font-semibold uppercase tracking-wide text-ink-3';
  return (
    <div className="mx-auto max-w-[1100px] pb-10">
      <a
        href={back}
        onClick={goBack}
        className="inline-flex min-h-11 items-center gap-2 text-sm no-underline"
        style={{ color: 'var(--ink-2)' }}
      >
        <Icon name="back" small /> {d.backLabel || 'Back to project'}
      </a>
      <header className="mb-7 border-b border-line pb-7 pt-6">
        <p className={eyebrow}>{project?.name || 'Project'} / Site question</p>
        <h1 className="my-3 max-w-[28ch] text-[clamp(26px,3vw,36px)] font-semibold leading-tight tracking-tight">{issue.title}</h1>
        <p className="m-0">
          {status}{' '}
          <span className="text-ink-3">
            · {issue.assignee ? name(issue.assignee) : 'Owner not assigned'}{issue.due ? ' · Due ' + fmtD(issue.due) : ''}
          </span>
        </p>
      </header>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Question and evidence">
          <h2 className="mt-0 text-xl font-semibold">What the site needs</h2>
          <ReviewSource m={sources.at(-1)} />
          {sources.length > 1 && (
            <details className="my-2">
              <summary className="cursor-pointer font-semibold">Earlier updates · {sources.length - 1}</summary>
              {sources.slice(0, -1).map((m) => <ReviewSource key={m.id} m={m} />)}
            </details>
          )}
          {issue.drawing && (
            <p className="my-3 flex flex-wrap items-center gap-2">
              <Icon name="drawing" small /> {issue.drawing}
              <small className="w-full text-ink-3">Referenced drawing · verify revision before use</small>
            </p>
          )}
          {latest && (
            <section className="mt-4">
              <h3 className="mb-1 font-semibold">Latest office answer</h3>
              <ReviewSource m={latest} />
              <p className="text-ink-3">
                {latest.siteAnswer.response === 'clarification' ? 'Site requested clarification'
                  : latest.siteAnswer.response === 'acknowledged' ? 'Acknowledged on site' : 'Waiting for site acknowledgement'}
              </p>
            </section>
          )}
          {answers.length > 1 && (
            <details className="my-2">
              <summary className="cursor-pointer font-semibold">Earlier answers · {answers.length - 1}</summary>
              {answers.slice(0, -1).map((m) => <ReviewSource key={m.id} m={m} />)}
            </details>
          )}
          {assistAllowed('ask') && <Btn sm onClick={() => openIssueBrief(id)}>Summarise recorded history</Btn>}
        </section>
        <section aria-label="Office reply" className="self-start rounded-r3 border border-line bg-surface p-6">
          {d.step === 'sent' ? (
            <>
              <div role="status">
                <Icon name="check" />
                <h2 id="reply-heading" tabIndex={-1} className="mt-2 text-xl font-semibold">Answer sent</h2>
                <p>Sent to <strong>{thread?.name}</strong>. It stays linked to this question.</p>
                <p className="text-ink-3">The issue stays open. Site acknowledgement is still required.</p>
              </div>
              {next
                ? <Btn kind="primary" onClick={() => openIssueReview(next.id, true)}>Next question in this project</Btn>
                : <DLink to={back} className="text-accent-text underline">Back to project</DLink>}
            </>
          ) : detail.canAnswer ? (
            <form key={d.step} onSubmit={d.step === 'review' ? sendReply : review}>
              <p className={eyebrow}>{d.step === 'review' ? 'Check before sending' : 'Your next step'}</p>
              <h2 id="reply-heading" tabIndex={-1} className="my-2 text-xl font-semibold">{d.step === 'review' ? 'Review your answer' : 'Reply to the site'}</h2>
              <p className="my-2">To <strong>{thread.name}</strong><br /><small className="text-ink-3">Shared with the people in this conversation</small></p>
              {d.step === 'review' ? (
                <blockquote className="my-3 whitespace-pre-wrap border-l-[3px] border-accent bg-surface-2 px-3 py-2.5">{d.text}</blockquote>
              ) : (
                <>
                  <label htmlFor="office-reply" className="mb-1 block text-[13px] font-semibold text-ink-2">Your answer</label>
                  <Textarea
                    id="office-reply" name="text" rows={7} required maxLength={4000} defaultValue={d.text}
                    className="w-full"
                    placeholder="Give a confirmed instruction, or ask for the detail you need."
                    onInput={(e) => { const before = d.storageError; saveIssueReply(d, e.target.value); if (before !== d.storageError) render(); }}
                  />
                  <p className="text-ink-3">Your draft is private. Nothing sends until you review it.</p>
                </>
              )}
              <p role="alert" className="min-h-[1em] text-crit">{d.error || ''}</p>
              <div className="flex justify-end gap-2">
                {d.step === 'review' && <Btn onClick={() => { d.error = ''; replyPhase(d, 'write'); }}>Edit answer</Btn>}
                <Btn kind="primary" type="submit">{d.step === 'review' ? 'Send answer' : 'Review answer'}</Btn>
              </div>
            </form>
          ) : (
            <>
              <h2 id="reply-heading" tabIndex={-1} className="mt-0 text-xl font-semibold">{issue.status === 'closed' ? 'This issue is closed' : 'Office reply'}</h2>
              <p className="text-ink-3">
                {issue.status === 'closed' ? 'The recorded question and answers remain available here.' : 'The office team can answer this question. You can follow its updates here.'}
              </p>
            </>
          )}
          <p role="status" className="min-h-[1em] text-xs text-ink-3">{d.storageError || ''}</p>
        </section>
      </div>
    </div>
  );
}
