import { state, svc } from '../shared/core.js';
import { filingLabel } from '../shared/filing.js';
import { Btn, Chip } from '../ui/ui';
import { DLink } from './nav';
import { navFor } from './helpers';
import { openDialog, openMsg } from './session';

// Link that jumps to the source message. The prototype relabels this "View bill" on expense rows.
export const FromChat = ({ msgId, children = 'From chat' }) => <Btn kind="link" onClick={() => openMsg(msgId)}>{children}</Btn>;

export const SiteLink = ({ id, children }) =>
  navFor().some(([k]) => k === 'sites') ? <DLink to={`#/sites/${id}`}>{children}</DLink> : <>{children}</>;

export const ChatLink = ({ thread, children }) =>
  thread ? <DLink to={`#/chats?thread=${thread.id}`}>{children}</DLink> : null;

// Filing chip shown under chat messages (AI filed / needs check / ask).
export function FilingChip({ m }) {
  if (m.deleted || m.notice) return null;
  const f = state.filings[m.id];
  const open = () => openDialog({ kind: 'file', msgId: m.id });
  if (!f) return <Chip onClick={open}>File message</Chip>;
  const label = f.status === 'ask' ? 'Which project?' : filingLabel(f) || 'Note';
  const who = f.by === 'user' ? 'Filed' : f.status === 'filed' ? 'AI filed' : f.status === 'check' ? 'AI check' : 'AI needs context';
  const title = `${f.status === 'filed' ? 'Filed' : f.status === 'check' ? 'Please check' : 'Needs a project'} · ${Math.round(f.conf * 100)}%`;
  return <Chip status={f.status} title={title} onClick={open}>{who} · {label}</Chip>;
}

// Rows of filed chat messages for a filter (used by several pages).
export const filedRows = (f) =>
  svc.filed(f).filter((x) => svc.thread(x.msg.threadId)).map((x) => ({ ...x, m: x.msg }));
