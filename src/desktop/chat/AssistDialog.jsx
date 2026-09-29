import { state, svc, toast, render, accessibleMessage, clone, fmtDT } from '../../shared/core.js';
import { Btn, DataTable, Field, Input, Select, Textarea } from '../../ui/ui';
import Modal, { ModalActions } from '../Modal';
import { name, role } from '../helpers';
import { closeDialog, openMsg } from '../session';
import { AttachmentPreview } from './media';
import {
  assistAllowed, assistTitles, saveDesktopAssist, forgetDesktopAssist,
} from './assistCore';

export const AiNote = ({ children }) => <p className="my-2 text-xs italic text-ink-3">{children}</p>;
const fieldset = 'my-4 max-h-[300px] overflow-auto rounded-r1 border border-line p-3';

function Unavailable({ title, children }) {
  return (
    <Modal title={title}>
      {children}
      <ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions>
    </Modal>
  );
}

function Sources({ result }) {
  return (result.sources || []).map((source, i) => {
    const safe = svc.assistSource(source);
    if (!safe) return <li key={i} className="my-3">Source no longer available. Generate a fresh draft.</li>;
    return (
      <li key={i} className="my-3 [overflow-wrap:anywhere]">
        <b>{safe.label || source.label}</b>{' '}
        {safe.type === 'message' ? (
          <Btn sm onClick={() => viewSource(safe.id)}>View source</Btn>
        ) : (
          <p className="whitespace-pre-wrap text-[13px]">{safe.text || 'Recorded source'}</p>
        )}
      </li>
    );
  });
}

// Issue briefs keep the dialog trail (assist -> source viewer -> back); others jump to the chat.
function viewSource(msgId) {
  const d = state.desk.dialog;
  if (d?.kind !== 'assist') return;
  saveDesktopAssist(d);
  if (d.options.issueId) {
    state.desk.dialog = { kind: 'assist-source', draft: d, msgId };
    render();
  } else {
    state.desk.dialog = null;
    openMsg(msgId);
  }
}

async function submit(e, d) {
  e.preventDefault();
  if (d?.kind !== 'assist' || d.busy || d.userId !== state.userId || d.role !== role()) return;
  const values = new FormData(e.currentTarget);
  for (const [key, value] of values.entries()) if (!['messageIds', 'materialIds'].includes(key)) d.fields[key] = value;
  for (const key of ['messageIds', 'materialIds']) if (!d.result) d.fields[key] = values.getAll(key);
  if (!d.result && d.assist === 'client' && !d.fields.threadId) {
    d.fields.threadId = svc.threads().find((t) => t.projectId === d.options.projectId && t.kind === 'client')?.id;
  }
  const requestId = (d.requestId = (d.requestId || 0) + 1);
  const inputSnapshot = JSON.stringify(d.fields);
  d.error = '';
  d.busy = true;
  saveDesktopAssist(d);
  render();
  try {
    if (!d.result || (d.assist === 'ask' && !d.options.issueId)) {
      const options = { ...d.options, ...clone(d.fields) };
      const result = await svc.aiAssist(d.assist, options);
      if (d.userId !== state.userId || d.role !== role() || state.desk.dialog !== d || d.requestId !== requestId) return;
      if (JSON.stringify(d.fields) !== inputSnapshot) {
        d.error = 'Your inputs changed while preparing the draft. Your latest choices are kept; generate again.';
        return;
      }
      d.options = options;
      d.result = result;
      if (['daily', 'client'].includes(d.assist) || d.options.issueId) d.fields.text = result.text;
      if (d.assist === 'followup') {
        Object.assign(d.fields, { title: result.proposal.title, owner: result.proposal.owner || '', due: result.proposal.due || '' });
      }
    } else {
      if (d.result.sources.some((source) => !svc.assistSource(source))) {
        throw Error('A source is no longer accessible. Change sources and generate a fresh draft.');
      }
      if (d.assist === 'followup') {
        svc.confirmFollowup({
          messageId: d.options.messageId, title: d.fields.title, owner: d.fields.owner, due: d.fields.due, reviewedSource: d.result.sources[0],
        });
      } else if (['daily', 'client'].includes(d.assist)) {
        await svc.sendAssist(d.assist, d.options, d.fields.text, d.result.sources);
      } else return;
      forgetDesktopAssist(d);
      if (state.desk.dialog === d) state.desk.dialog = null;
      toast(d.assist === 'followup' ? 'Follow-up confirmed. Source conversation stays linked.' : 'Reviewed draft sent to the named conversation.');
      return;
    }
  } catch (error) {
    if (d.requestId === requestId) d.error = error.message || 'Could not complete this step. Your draft is kept.';
  } finally {
    if (d.requestId === requestId) {
      d.busy = false;
      if (state.desk.dialog === d) { saveDesktopAssist(d); render(); }
    }
  }
}

function onFormInput(e, d) {
  const key = e.target.dataset?.assistField;
  const choice = e.target.dataset?.assistChoice;
  if (key) d.fields[key] = e.target.value;
  if (choice) {
    const picked = new Set(d.fields[choice] || []);
    if (e.target.checked) picked.add(e.target.value); else picked.delete(e.target.value);
    d.fields[choice] = [...picked];
  }
  if (key || choice) {
    const before = d.saveError;
    saveDesktopAssist(d);
    if (before !== d.saveError) render();
  }
}

function revise(d) {
  d.result = null;
  d.error = '';
  saveDesktopAssist(d);
  render();
}

function Palette({ c }) {
  return (
    <section>
      <h4 className="mb-1 font-semibold">{c.name}</h4>
      <div className="flex h-[58px] overflow-hidden rounded-r1 border border-line">
        {c.colors.filter((hex) => /^#[0-9a-f]{6}$/i.test(hex)).map((hex) => (
          <span key={hex} className="flex-1" style={{ background: hex }} title={hex} />
        ))}
      </div>
      <p>{c.note}</p>
    </section>
  );
}

const statusText = (s) => (s === 'client_pending' ? 'Awaiting client' : String(s || 'Not recorded').replaceAll('_', ' '));

export default function AssistDialog({ d }) {
  if (d.userId !== state.userId || d.role !== role() || !assistAllowed(d.assist)) {
    return <Unavailable title="Helper unavailable" />;
  }
  const o = d.options, f = d.fields, projectAsk = d.assist === 'ask' && !o.issueId;
  if (o.issueId && (!svc.project(o.projectId) || svc.siteIssueDetails(o.issueId)?.issue.projectId !== o.projectId)) {
    return <Unavailable title="Issue unavailable" />;
  }
  const title = o.issueId ? 'Review issue brief' : assistTitles[d.assist];
  const sourceLost = d.result?.sources?.some((source) => !svc.assistSource(source));
  const r = projectAsk && sourceLost ? null : d.result;
  if (sourceLost && !projectAsk) {
    return (
      <Modal title="Sources unavailable" wide label={title}>
        <p>Your draft is retained, but its contents cannot be displayed while a source is outside your access or removed. Choose available sources and generate a fresh draft.</p>
        <ModalActions>
          <Btn onClick={closeDialog}>Keep draft and close</Btn>
          <Btn onClick={() => revise(d)}>Change sources</Btn>
        </ModalActions>
      </Modal>
    );
  }

  const textField = (n, label, type = 'text', value = f[n] ?? o[n] ?? '') => (
    <Field label={label}><Input data-assist-field={n} name={n} type={type} defaultValue={value} /></Field>
  );

  let controls = null;
  if (!r) {
    if (d.assist === 'daily') controls = textField('date', 'Report date', 'date');
    if (d.assist === 'ask' && o.issueId) controls = <p>{svc.project(o.projectId)?.name} · selected issue only</p>;
    if (d.assist === 'client') {
      const ts = svc.threads().filter((t) => t.projectId === o.projectId && t.kind === 'client');
      const tid = f.threadId || ts[0]?.id;
      const msgs = (tid ? svc.messages(tid) : []).filter((m) => !m.deleted && !m.pending && !m.assistDraft && (m.text || m.transcript));
      controls = (
        <>
          <Field label="Recipient conversation">
            <Select
              data-assist-field="threadId"
              name="threadId"
              value={tid || ''}
              onChange={(e) => { d.fields.threadId = e.target.value; d.fields.messageIds = []; saveDesktopAssist(d); render(); }}
            >
              {ts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <p>Choose facts already shared in this client conversation. Private site and office messages are excluded.</p>
          <fieldset key={tid} className={fieldset}>
            <legend className="px-1">Include these source messages</legend>
            {msgs.map((m) => (
              <label key={m.id} className="flex items-start gap-2.5 py-2.5 leading-normal">
                <input
                  type="checkbox" name="messageIds" value={m.id} data-assist-choice="messageIds"
                  defaultChecked={(f.messageIds || []).includes(m.id)} className="mt-1 h-[18px] w-[18px] flex-none accent-[var(--accent)]"
                />
                <span>
                  {(m.text || m.transcript).slice(0, 220)}
                  <small className="block text-ink-3">{fmtDT(m.at)} · {name(m.by)}</small>
                </span>
              </label>
            ))}
            {!msgs.length && <p>No eligible client-visible facts available.</p>}
          </fieldset>
        </>
      );
    }
    if (d.assist === 'compare') {
      const mats = svc.materials({ projectId: o.projectId });
      controls = (
        <fieldset className={fieldset}>
          <legend className="px-1">Choose 2 or 3 materials from this project</legend>
          {mats.map((m) => (
            <label key={m.id} className="flex items-start gap-2.5 py-2.5 leading-normal">
              <input
                type="checkbox" name="materialIds" value={m.id} data-assist-choice="materialIds"
                defaultChecked={(f.materialIds || []).includes(m.id)} className="mt-1 h-[18px] w-[18px] flex-none accent-[var(--accent)]"
              />
              <span>{m.name} · {m.vendor || 'Vendor not recorded'}</span>
            </label>
          ))}
          {!mats.length && <p>No materials available for comparison.</p>}
        </fieldset>
      );
    }
    if (['followup', 'concept'].includes(d.assist)) {
      const m = accessibleMessage(o.messageId);
      controls = m ? (
        <>
          <blockquote className="my-2 border-l-[3px] border-accent bg-surface-2 px-3 py-2.5">{m.text || m.transcript || 'Photo update'}</blockquote>
          {d.assist === 'concept' && <AttachmentPreview m={m} />}
        </>
      ) : <p>Source unavailable.</p>;
    }
  } else {
    const srcMsg = d.assist === 'concept' ? accessibleMessage(o.messageId) : null;
    controls = (
      <>
        {r.comparisons && (
          <DataTable
            cols={['Material', 'Vendor', 'Status', 'Price', 'Lead time']}
            rows={r.comparisons.map((m) => [m.name, m.vendor, statusText(m.status), m.price, m.leadTime])}
          />
        )}
        {r.concepts && (
          <>
            <p>Original photo context retained in Sources below. These are example colour palettes, not generated room images or verified construction options.</p>
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
              {r.concepts.map((c, i) => <Palette key={i} c={c} />)}
            </div>
          </>
        )}
        {['daily', 'client'].includes(d.assist) && (
          <>
            <Field label="Review and edit before sending">
              <Textarea name="text" data-assist-field="text" rows={10} maxLength={12000} defaultValue={f.text ?? r.text} />
            </Field>
            <p><b>Recipient: {svc.thread(r.destinationThreadId)?.name || 'Unavailable'}</b></p>
          </>
        )}
        {d.assist === 'followup' && (
          <>
            {textField('title', 'Follow-up title', 'text', f.title ?? r.proposal.title)}
            <Field label="Responsible person">
              <Select name="owner" data-assist-field="owner" defaultValue={f.owner || ''}>
                <option value="">Choose a person</option>
                {r.proposal.owners.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </Field>
            {textField('due', 'Needed by', 'date')}
          </>
        )}
        {d.assist !== 'followup' && !['daily', 'client'].includes(d.assist) && o.issueId && (
          <>
            <Field label="Brief · edit before using">
              <Textarea name="text" data-assist-field="text" rows={8} defaultValue={f.text ?? r.text} />
            </Field>
            <p className="text-ink-3">Private draft on this browser. Nothing sent or approved.</p>
          </>
        )}
        {!['daily', 'client', 'followup', 'compare', 'concept'].includes(d.assist) && !o.issueId && (
          <>
            {projectAsk && <p className="text-ink-3">Answer to: {o.question}</p>}
            <p className="whitespace-pre-wrap leading-relaxed">{r.text}</p>
          </>
        )}
        <details className="mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer font-semibold">Sources · {r.sources.length}</summary>
          <ul className="list-none p-0"><Sources result={r} /></ul>
          {srcMsg && <AttachmentPreview m={srcMsg} />}
        </details>
        {r.missing.length > 0 && <p><b>Check before using:</b> {r.missing.join(' · ')}</p>}
        {r.conflicts.length > 0 && <p role="alert"><b>Check conflicting records:</b> {r.conflicts.join(' · ')}</p>}
      </>
    );
  }

  const primary = !r || projectAsk
    ? { label: d.busy ? 'Preparing…' : projectAsk ? 'Find answer' : o.issueId ? 'Prepare issue brief' : 'Generate draft', off: d.busy }
    : ['daily', 'client', 'followup'].includes(d.assist)
      ? { label: d.busy ? 'Saving…' : d.assist === 'followup' ? 'Confirm follow-up' : 'Send reviewed draft', off: d.busy || sourceLost }
      : null;
  const errorText = d.error || (sourceLost ? 'The previous answer is no longer available. Ask again using records you can access.' : '');

  return (
    <Modal title={title} wide label={title}>
      <form onSubmit={(e) => submit(e, d)} onInput={(e) => onFormInput(e, d)}>
        <AiNote>AI suggestion · demo. Uses recorded sources; nothing is sent or assigned automatically.</AiNote>
        {projectAsk && (
          <Field label="Your question">
            <Textarea name="question" data-assist-field="question" rows={2} maxLength={500} required defaultValue={f.question ?? o.question ?? ''} />
          </Field>
        )}
        <div key={r ? 'result' : 'form'}>{controls}</div>
        <p role="status" className="min-h-[1em] text-xs text-ink-3">{d.saveError || ''}</p>
        {errorText && <p role="alert" className="rounded-r1 bg-warn-soft px-3 py-2 font-medium text-warn">{errorText}</p>}
        <ModalActions>
          <Btn onClick={closeDialog}>{r ? 'Keep draft and close' : 'Close'}</Btn>
          {r && !projectAsk && (
            <>
              {d.assist === 'daily' && <Btn onClick={() => window.print()}>Print / save PDF</Btn>}
              <Btn onClick={() => revise(d)}>{o.issueId ? 'Prepare a new brief' : 'Change sources'}</Btn>
            </>
          )}
          {primary && <Btn kind="primary" type="submit" disabled={primary.off}>{primary.label}</Btn>}
        </ModalActions>
      </form>
    </Modal>
  );
}

export function AssistSourceDialog({ d }) {
  const m = svc.assistSource({ type: 'message', id: d.msgId });
  const allowed = d.draft.userId === state.userId && d.draft.role === role() && svc.siteIssueDetails(d.draft.options.issueId);
  const ok = allowed && m;
  return (
    <Modal title={ok ? m.label : 'Source unavailable'}>
      {ok && <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>}
      <ModalActions><Btn onClick={closeDialog}>Back to brief</Btn></ModalActions>
    </Modal>
  );
}
