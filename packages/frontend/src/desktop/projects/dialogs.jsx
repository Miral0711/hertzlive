import { state, svc, can, toast, render, fmtD } from '../../shared/core.js';
import { Btn, Field, Input, StatusPill, Textarea } from '../../ui/ui';
import Modal, { ModalActions } from '../Modal';
import { closeDialog, formData, openThread } from '../session';
import { role, name } from '../helpers';
import { drawingSave } from './Drawings';
import { desktopDrawingShortcuts } from './common';

const Alert = ({ children }) => (children ? <p role="alert" className="text-crit">{children}</p> : null);
const Close = ({ children = 'Close' }) => <Btn onClick={closeDialog}>{children}</Btn>;

export function ProjectDecisionDialog({ d }) {
  const record = svc.decisionsDue({ all: true }).find((x) => x.id === d.id && svc.thread(x.threadId));
  const p = record && svc.project(record.projectId);
  const openConversation = () => {
    state.desk.dialog = null;
    openThread(record.threadId);
  };
  const dismiss = () => {
    if (d.fromChat && record) svc.decideDecision(record.id);
    closeDialog();
  };
  return (
    <Modal title={record ? record.title : 'Decision unavailable'} onClose={dismiss}>
      {record && p && (
        <>
          <p>{p.name} · <StatusPill status={record.status} /></p>
          <p>
            Decision: {name(p.clientId)} · {record.due ? 'Due ' + fmtD(record.due) : 'Due date not set'}<br />
            Requested by {name(record.askedBy)}
          </p>
        </>
      )}
      <ModalActions>
        {record && p && <Btn onClick={openConversation}>Open client conversation</Btn>}
        <Btn onClick={dismiss}>Close</Btn>
      </ModalActions>
    </Modal>
  );
}

export function DrawingViewDialog({ d }) {
  const p = svc.project(d.projectId);
  const dr = can('drawing', 'r', role()) && p?.drawings.find((x) => x.no === d.no);
  if (!dr) {
    return (
      <Modal title="Drawing unavailable"><ModalActions><Close /></ModalActions></Modal>
    );
  }
  const saved = desktopDrawingShortcuts(p.id, 'saved').find((x) => x.no === dr.no);
  const facts = [['Drawing', dr.no], ['Revision', dr.rev], ['Purpose', dr.status], ['Record date', fmtD(dr.date)]];
  return (
    <Modal title={dr.name} label="Drawing record">
      <p>{p.name}</p>
      <dl className="my-5 grid grid-cols-2 gap-4 border-y border-line py-5">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[13px] text-ink-3">{k}</dt>
            <dd className="m-0 mt-1 font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p>The original drawing file is not attached to this prototype. This register record is not a file preview.</p>
      {saved && saved.rev !== dr.rev && (
        <p className="font-semibold text-accent-text">Register revision changed since you saved this shortcut. Review the purpose before use.</p>
      )}
      <Alert>{state.desk.drawingSaveError}</Alert>
      <p className="text-ink-3">Personal shortcut on this browser. No file is downloaded or approved.</p>
      <ModalActions>
        <Btn onClick={() => drawingSave(p.id, dr.no)}>{saved ? 'Remove saved shortcut' : 'Save drawing shortcut'}</Btn>
        <Close />
      </ModalActions>
    </Modal>
  );
}

export function FinaliseDrawingDialog({ d }) {
  const submit = (e) => {
    e.preventDefault();
    const p = formData(e.currentTarget);
    try {
      svc.finaliseDrawing(d.id, p.reason);
      state.desk.dialog = null;
      toast('Drawing finalised.');
    } catch (err) {
      d.error = err.message;
    }
    render();
  };
  return (
    <Modal title="Finalise drawing">
      <form onSubmit={submit}>
        <Field label="Reason"><Textarea name="reason" required /></Field>
        <Alert>{d.error}</Alert>
        <ModalActions><Close>Cancel</Close><Btn kind="primary" type="submit">Finalise</Btn></ModalActions>
      </form>
    </Modal>
  );
}

export function IntakeUploadDialog({ d }) {
  const submit = (e) => {
    e.preventDefault();
    try {
      svc.receiveIntake(d.id, formData(e.currentTarget).fileName);
      state.desk.dialog = null;
      toast('Received.');
    } catch (err) {
      d.error = err.message;
    }
    render();
  };
  return (
    <Modal title="Upload">
      <form onSubmit={submit}>
        <Field label="File name"><Input name="fileName" required placeholder="site-photos.zip" /></Field>
        <p className="text-ink-3">Prototype upload: type a file name to simulate the file.</p>
        <Alert>{d.error}</Alert>
        <ModalActions><Close>Cancel</Close><Btn kind="primary" type="submit">Upload</Btn></ModalActions>
      </form>
    </Modal>
  );
}

export function IntakeAddDialog({ d }) {
  const submit = (e) => {
    e.preventDefault();
    try {
      svc.addIntake(d.projectId, formData(e.currentTarget).item);
      state.desk.dialog = null;
      toast('Item added.');
    } catch (err) {
      d.error = err.message;
    }
    render();
  };
  return (
    <Modal title="Add intake item">
      <form onSubmit={submit}>
        <Field label="Item"><Input name="item" required /></Field>
        <Alert>{d.error}</Alert>
        <ModalActions><Close>Cancel</Close><Btn kind="primary" type="submit">Add</Btn></ModalActions>
      </form>
    </Modal>
  );
}

export function ClientRefAddDialog({ d }) {
  const submit = (e) => {
    e.preventDefault();
    const p = formData(e.currentTarget);
    try {
      svc.addClientRef({ projectId: d.projectId, url: p.url, title: p.title, room: p.room });
      state.desk.dialog = null;
      toast('Reference added.');
    } catch (err) {
      d.error = err.message;
    }
    render();
  };
  return (
    <Modal title="Add a reference">
      <form onSubmit={submit}>
        <Alert>{d.error}</Alert>
        <Field label="Link (Pinterest, Instagram or web)"><Input name="url" type="url" required placeholder="https://..." /></Field>
        <Field label="Title"><Input name="title" placeholder="What is it?" /></Field>
        <Field label="Room"><Input name="room" placeholder="e.g. Living room" /></Field>
        <ModalActions><Close>Cancel</Close><Btn kind="primary" type="submit">Add</Btn></ModalActions>
      </form>
    </Modal>
  );
}
