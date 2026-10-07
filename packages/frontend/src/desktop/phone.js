import { useSyncExternalStore } from 'react';

// Phones use the WhatsApp-style shell: bottom tabs, and one screen at a time.
// Tablets keep the sidebar drawer. This matches Tailwind's `md` breakpoint.
export const PHONE_QUERY = '(max-width: 767px)';
// Height of the tab row itself. The home-indicator inset is added on top of this.
export const TAB_BAR_H = '3.25rem';

const subscribe = (cb) => {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

export const usePhone = () => useSyncExternalStore(
  subscribe,
  () => window.matchMedia(PHONE_QUERY).matches,
  () => false,
);
