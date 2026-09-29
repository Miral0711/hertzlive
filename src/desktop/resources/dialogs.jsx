import { state, svc, can, toast, render } from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import { Btn, Field, Input, Select, Textarea } from '../../ui/ui';
import Icon from '../../ui/Icon';
import Modal, { ModalActions } from '../Modal';
import { closeDialog, formData } from '../session';
import { name } from '../helpers';
import Ph from './Ph';
import { fileKind, winPath } from './util';
import { fileCopy, shareCopy } from './files';

export function FilePreviewDialog({ d }) {
  const k = fileKind(d.path);
  return (
    <Modal wide label="File preview">
      <div className="mb-3 flex items-center justify-between gap-2.5">
        <h3 className="m-0 flex items-center gap-1.5 text-lg font-semibold"><Icon name="file" small /> <span className="font-mono text-[13px]">{d.path.split('/').pop()}</span></h3>
        <Btn sm onClick={() => fileCopy(d.path)}>Copy path</Btn>
      </div>
      <div className="mx-auto max-w-[640px]"><Ph hue={k === 'Photo' ? 28 : 200} seed={d.path.length % 17} ar={1.333} /></div>
      <p className="text-ink-3"><small>{winPath(d.path)} · preview only, file stays on the NAS</small></p>
      <ModalActions><Btn onClick={closeDialog}>Close</Btn></ModalActions>
    </Modal>
  );
}

export function CreateShareDialog({ d }) {
  if (d.result) {
    const wa = svc.whatsappUrl(d.result.url);
    return (
      <Modal title="Share link created">
        <p className="font-mono text-[13px] [overflow-wrap:anywhere]">{d.result.url}</p>
        <p className="text-ink-3">Viewing on the web. No app needed.</p>
        <div className="flex gap-2">
          <Btn onClick={() => shareCopy(d.result.url)}>Copy link</Btn>
          {wa && <a className="inline-flex min-h-9 items-center rounded-r1 border border-line-2 bg-surface px-3.5 font-semibold text-ink no-underline" href={wa} target="_blank" rel="noopener noreferrer">Send on WhatsApp</a>}
        </div>
        <ModalActions><Btn kind="primary" onClick={closeDialog}>Done</Btn></ModalActions>
      </Modal>
    );
  }
  const projects = svc.projects();
  const save = (e) => {
    e.preventDefault();
    const p = formData(e.currentTarget);
    try {
      const rec = svc.createShare({ projectId: p.projectId, path: p.path, label: p.label, days: +p.days || 7, pin: p.pin || undefined });
      d.result = { url: svc.shareUrl(rec) };
    } catch (err) { d.error = err.message; }
    render();
  };
  return (
    <Modal title="Create share link">
      <form onSubmit={save}>
        <Field label="Project">
          <Select name="projectId" defaultValue={d.projectId}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        </Field>
        <Field label="File or folder path"><Input name="path" defaultValue={d.path || ''} required /></Field>
        <Field label="Label"><Input name="label" required /></Field>
        <Field label="Expires in, days"><Input type="number" name="days" min="1" max="30" defaultValue="7" /></Field>
        <Field label="PIN, optional"><Input name="pin" placeholder="4 digits" /></Field>
        {d.error && <p role="alert" className="text-crit">{d.error}</p>}
        <ModalActions><Btn onClick={closeDialog}>Cancel</Btn><Btn kind="primary" type="submit">Create link</Btn></ModalActions>
      </form>
    </Modal>
  );
}

export function ReviewDialog({ d }) {
  const editable = can('review', 'a');
  const people = editable ? svc.people().filter((p) => p.id !== state.userId) : [];
  const save = (e) => {
    e.preventDefault();
    const p = formData(e.currentTarget);
    try {
      svc.saveReview({
        userId: p.userId || d.userId || state.userId, month: p.month, score: +p.score, strengths: [p.s1, p.s2, p.s3], growth: p.growth, reason: p.reason,
      });
      state.desk.dialog = null;
      toast('Review saved.');
    } catch (err) { d.error = err.message; }
    render();
  };
  return (
    <Modal title={d.userId ? 'Review · ' + name(d.userId) : 'New review'}>
      <form onSubmit={save}>
        {editable && !d.userId
          ? <Field label="Person"><Select name="userId">{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          : <input type="hidden" name="userId" value={d.userId || ''} />}
        <Field label="Month"><Input type="month" name="month" defaultValue={d.month || TODAY.slice(0, 7)} /></Field>
        <Field label="Score, 1 to 5"><Input type="number" name="score" min="1" max="5" required /></Field>
        <Field label="Strength 1"><Input name="s1" required /></Field>
        <Field label="Strength 2"><Input name="s2" required /></Field>
        <Field label="Strength 3"><Input name="s3" required /></Field>
        <Field label="One growth point"><Input name="growth" required /></Field>
        <Field label="Reason for the score"><Textarea name="reason" required /></Field>
        {d.error && <p role="alert" className="text-crit">{d.error}</p>}
        <ModalActions><Btn onClick={closeDialog}>Cancel</Btn><Btn kind="primary" type="submit">Save review</Btn></ModalActions>
      </form>
    </Modal>
  );
}

// Exported for the studio module's Reviews tab if it wants them (handlers "review-open" / "review-note").
export const reviewNote = (id, text) => {
  if (!text?.trim()) return;
  svc.reviewNote(id, text.trim());
  render();
};
