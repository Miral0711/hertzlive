import { accessibleMessage, messageAttachment, toast, fmtDT } from '../../shared/core.js';
import { Btn } from '../../ui/ui';
import { FromChat } from '../parts';
import { name } from '../helpers';
import { openDialog } from '../session';

export const Details = ({ summary, children, open }) => (
  <details open={open} className="mb-3.5 rounded-r3 border border-line bg-surface px-4 py-2.5">
    <summary className="cursor-pointer font-semibold">{summary}</summary>
    <div className="mt-2.5">{children}</div>
  </details>
);

export const Progress = ({ label, value }) => (
  <label className="flex flex-col gap-1 text-[13px] text-ink-2">
    {label}
    <progress max="100" value={value} className="h-2 w-full">{value}%</progress>
  </label>
);

export function openAttachment(msgId) {
  const m = accessibleMessage(msgId);
  if (!m || !messageAttachment(m)) return toast('That attachment is not available for your role.');
  openDialog({ kind: 'message-attachment', msgId: m.id });
}

export const SourceExcerpt = ({ m }) => (
  <blockquote className="m-0 mb-2 rounded-r2 border-l-4 border-accent bg-surface-2 px-3 py-2">
    <p className="m-0">{m.transcript || m.text || 'Attachment update'}</p>
    <small className="text-ink-3">{name(m.by)} · {fmtDT(m.at)}</small>{' '}
    <FromChat msgId={m.id} />{' '}
    {(m.photo || m.file || m.album) && <Btn sm onClick={() => openAttachment(m.id)}>Open attachment</Btn>}
  </blockquote>
);
