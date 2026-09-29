// Cross-feature chat/AI-assist API. Other features import ONLY from this file.
import { accessibleMessage } from '../../shared/core.js';
import { Btn } from '../../ui/ui';
import {
  assistAllowed, assistTitles, openDesktopAssist as open,
} from './assistCore';
import { ProjectUpdates, SiteReviewQueue } from './site';

export { ProjectUpdates, SiteReviewQueue };
export {
  chatDraft, setChatDraft, markChatRead, unreadCount,
} from './store';
export { openIssueReview, openIssueBrief, projectUpdateOpen } from './site';
export { fileToMoodboard } from './assistCore';

// Opens the AI helper dialog. kind: "daily" | "client" | "followup" | "compare" | ...
export function openDesktopAssist(kind, options = {}) {
  return open(kind, options);
}

// <button> that opens the helper for `kind`; renders nothing when the role may not use it.
// Extra props become options (e.g. projectId, siteId).
export function AssistButton({ kind, sm = true, children, ...options }) {
  if (!assistAllowed(kind)) return null;
  return <Btn sm={sm} onClick={() => open(kind, options)}>{children || assistTitles[kind]}</Btn>;
}
// Helper toolbar on a project's overview tab.
export function AssistTools({ projectId }) {
  if (!assistAllowed('ask') && !assistAllowed('client')) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <AssistButton kind="ask" projectId={projectId} />
      <AssistButton kind="client" projectId={projectId} />
    </div>
  );
}
export function AssistCompareButton({ projectId }) {
  return <AssistButton kind="compare" projectId={projectId} />;
}

// "Help with this update" disclosure under a chat message.
export function MessageAssist({ m }) {
  if (m.deleted || m.pending || !accessibleMessage(m.id)) return null;
  const follow = (m.text || m.transcript) && assistAllowed('followup');
  const concept = (m.photo || m.album) && assistAllowed('concept');
  if (!follow && !concept) return null;
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer py-1.5 text-ink-2">Help with this update</summary>
      <div className="flex flex-wrap gap-1.5">
        {follow && <AssistButton kind="followup" messageId={m.id} />}
        {concept && <AssistButton kind="concept" messageId={m.id} />}
      </div>
    </details>
  );
}
