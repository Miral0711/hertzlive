// Small quick-compose forms for the attachment kinds that don't need a file: Contact, Poll,
// Event. Each just builds the message field and hands it back to the composer to send.
import { useState } from 'react';
import { state, svc } from '../../shared/core.js';
import { Btn, Field, Input } from '../../ui/ui';
import Modal, { ModalActions } from '../Modal';
import { name } from '../helpers';

export function ContactPicker({ threadId, onCancel, onSend }) {
  const thread = svc.thread(threadId);
  const members = (thread?.memberIds || []).filter((id) => id !== state.userId);
  const [manual, setManual] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '' });
  return (
    <Modal title="Share a contact" onClose={onCancel}>
      {!manual && members.length > 0 && (
        <div className="mb-3 flex flex-col gap-1.5">
          {members.map((id) => (
            <button
              key={id} type="button"
              onClick={() => onSend({ userId: id, name: name(id) })}
              className="flex min-h-11 items-center rounded-r2 border border-line bg-surface px-3.5 text-left hover:bg-surface-3"
            >
              {name(id)}
            </button>
          ))}
          <Btn sm className="self-start" onClick={() => setManual(true)}>Enter a contact manually</Btn>
        </div>
      )}
      {(manual || !members.length) && (
        <>
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        </>
      )}
      <ModalActions>
        <Btn onClick={onCancel}>Cancel</Btn>
        {(manual || !members.length) && (
          <Btn kind="primary" disabled={!form.name.trim()} onClick={() => onSend({ name: form.name.trim(), phone: form.phone.trim() })}>Send</Btn>
        )}
      </ModalActions>
    </Modal>
  );
}

export function PollComposer({ onCancel, onSend }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multi, setMulti] = useState(false);
  const setOpt = (i, v) => setOptions((o) => o.map((x, j) => (j === i ? v : x)));
  const addOpt = () => options.length < 6 && setOptions((o) => [...o, '']);
  const removeOpt = (i) => options.length > 2 && setOptions((o) => o.filter((_, j) => j !== i));
  const valid = question.trim() && options.filter((o) => o.trim()).length >= 2;
  return (
    <Modal title="Create a poll" onClose={onCancel}>
      <Field label="Question"><Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What should we ask?" /></Field>
      {options.map((o, i) => (
        <Field key={i} label={`Option ${i + 1}`}>
          <div className="flex gap-2">
            <Input value={o} onChange={(e) => setOpt(i, e.target.value)} />
            {options.length > 2 && <Btn sm onClick={() => removeOpt(i)}>Remove</Btn>}
          </div>
        </Field>
      ))}
      {options.length < 6 && <Btn sm className="mb-2.5" onClick={addOpt}>Add option</Btn>}
      <label className="mb-2.5 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} /> Allow multiple answers
      </label>
      <ModalActions>
        <Btn onClick={onCancel}>Cancel</Btn>
        <Btn
          kind="primary" disabled={!valid}
          onClick={() => onSend({
            question: question.trim(),
            multi,
            options: options.filter((o) => o.trim()).map((text) => ({ text: text.trim(), votes: [] })),
          })}
        >
          Send
        </Btn>
      </ModalActions>
    </Modal>
  );
}

export function EventComposer({ onCancel, onSend }) {
  const [form, setForm] = useState({ title: '', date: '', time: '', location: '' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const valid = form.title.trim() && form.date;
  return (
    <Modal title="Create an event" onClose={onCancel}>
      <Field label="Title"><Input value={form.title} onChange={set('title')} placeholder="Site walkthrough" /></Field>
      <Field label="Date"><Input type="date" value={form.date} onChange={set('date')} /></Field>
      <Field label="Time"><Input type="time" value={form.time} onChange={set('time')} /></Field>
      <Field label="Location"><Input value={form.location} onChange={set('location')} /></Field>
      <ModalActions>
        <Btn onClick={onCancel}>Cancel</Btn>
        <Btn kind="primary" disabled={!valid} onClick={() => onSend({ ...form, title: form.title.trim() })}>Send</Btn>
      </ModalActions>
    </Modal>
  );
}
