import Icon from '../ui/Icon';
import { DLink } from './nav';
import { NAV, navFor, role } from './helpers';
import { conversationThreads, unreadCount } from './chat/store';
import { TAB_BAR_H } from './phone';

// Primary destinations for a phone, in the same order WhatsApp puts its tabs:
// the daily work, the jobs, the conversations, then one more role-specific place.
// Everything else stays in the existing module menu, opened from More.
const PREFERRED = {
  client: ['today', 'projects', 'chats', 'money'],
  contractor: ['today', 'chats', 'sites'],
};
const DEFAULT_TABS = ['today', 'projects', 'chats', 'sites'];

const tabCls = (on) => `flex h-full flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold leading-none no-underline ${on ? 'text-accent-text' : 'text-ink-3'}`;

export default function MobileBar({ page, moreOpen, onMore }) {
  const allowed = navFor();
  const label = Object.fromEntries(NAV.map(([k, l]) => [k, l]));
  const icon = Object.fromEntries(NAV.map(([k, , i]) => [k, i]));
  const ids = (PREFERRED[role()] || DEFAULT_TABS).filter((k) => allowed.some(([id]) => id === k));
  const unread = ids.includes('chats')
    ? conversationThreads().reduce((n, t) => n + unreadCount(t.id), 0)
    : 0;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="grid" style={{ height: TAB_BAR_H, gridTemplateColumns: `repeat(${ids.length + 1}, minmax(0, 1fr))` }}>
        {ids.map((k) => (
          <DLink key={k} to={`#/${k}`} aria-current={page === k ? 'page' : undefined} className={tabCls(page === k)}>
            <span className="relative">
              <Icon name={icon[k]} />
              {k === 'chats' && unread > 0 && (
                <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-ink">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </span>
            <span className="max-w-full truncate">{label[k]}</span>
          </DLink>
        ))}
        <button type="button" aria-expanded={moreOpen} aria-controls="module-nav" onClick={onMore} className={`${tabCls(moreOpen)} border-0 bg-transparent`}>
          <Icon name="more" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
