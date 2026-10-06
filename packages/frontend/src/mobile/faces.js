import { useStore } from '../shared/store';
import { photoUrl } from '../ui/Ph';
import { persist, projectOf, render, state, user } from './model';

const LOOKS = [
  { bg: '#d5e4ee', skin: '#f3c7a6', hair: '#2b2118', shirt: '#16587b', cut: 'short' },
  { bg: '#efe2d2', skin: '#e8b48a', hair: '#1a1a1a', shirt: '#8f6a24', cut: 'long' },
  { bg: '#e7efe4', skin: '#f6d3b4', hair: '#5a3820', shirt: '#46775f', cut: 'bun' },
  { bg: '#e4e8f2', skin: '#c6865a', hair: '#111111', shirt: '#21475a', cut: 'beard' },
  { bg: '#f3e6ea', skin: '#f0c8a0', hair: '#3d2314', shirt: '#a84f42', cut: 'bob' },
  { bg: '#e8eef3', skin: '#8d5524', hair: '#0e0e0e', shirt: '#16587b', cut: 'short' },
  { bg: '#f6efe4', skin: '#f7d7c4', hair: '#6b4423', shirt: '#5d7f96', cut: 'long' },
  { bg: '#e6eee8', skin: '#d9a066', hair: '#24180f', shirt: '#3d5a4c', cut: 'bald' },
  { bg: '#eee8f4', skin: '#f2cbb0', hair: '#4a2c2a', shirt: '#6d4c7d', cut: 'bob' },
  { bg: '#e8f0f4', skin: '#b97a56', hair: '#1c140e', shirt: '#2f5d73', cut: 'beard' },
  { bg: '#f4eee6', skin: '#efd0b4', hair: '#2a2a2a', shirt: '#8f6a24', cut: 'bun' },
  { bg: '#e9eef6', skin: '#c47a4a', hair: '#111111', shirt: '#16384d', cut: 'short' },
];

export const FACE_COUNT = LOOKS.length;

export function faceIndex(person) {
  if (!person) return 0;
  const chosen = state.portraits?.[person.id];
  if (Number.isInteger(chosen)) return chosen % FACE_COUNT;
  let h = 0;
  for (const ch of String(person.id)) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return h % FACE_COUNT;
}

export function choosePortrait(userId, n) {
  state.portraits = { ...(state.portraits || {}), [userId]: n };
  persist();
  render();
}

export function Face({ n = 0 }) {
  const look = LOOKS[n % FACE_COUNT];
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true">
      <rect width="80" height="80" fill={look.bg} />
      <ellipse cx="40" cy="86" rx="32" ry="22" fill={look.shirt} />
      <circle cx="40" cy="36" r="16" fill={look.skin} />
      {look.cut === 'long' && <path d="M24 34c0-16 8-24 16-24s16 8 16 24v22c-4 4-10 6-16 6s-12-2-16-6z" fill={look.hair} />}
      {look.cut === 'bob' && <path d="M23 36c1-16 8-24 17-24s16 8 17 24c0 10-2 16-6 18-2-8-6-12-11-12s-9 4-11 12c-4-2-6-8-6-18z" fill={look.hair} />}
      {look.cut === 'bun' && <circle cx="40" cy="12" r="7" fill={look.hair} />}
      {look.cut !== 'bald' && look.cut !== 'long' && <path d="M24 34c1-14 7-20 16-20s15 6 16 20c-4-8-10-12-16-12s-12 4-16 12z" fill={look.hair} />}
      {look.cut === 'beard' && <path d="M30 44c2 8 6 12 10 12s8-4 10-12c-3 3-6 4-10 4s-7-1-10-4z" fill={look.hair} />}
      <circle cx="34" cy="36" r="1.5" fill="#2a211c" />
      <circle cx="46" cy="36" r="1.5" fill="#2a211c" />
      <path d="M36 43c1.4 1.4 3 2 4 2s2.6-.6 4-2" fill="none" stroke="#a36b52" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function Avatar({ person, hue, seed, text = '', size = '' }) {
  useStore();
  const cls = `av ${size}`.trim();
  if (person?.id) {
    return <span className={cls}><Face n={faceIndex(person)} /></span>;
  }
  if (hue != null) {
    return <span className={cls}><img src={photoUrl(hue, seed || 1)} alt="" /></span>;
  }
  return <span className={cls}>{text}</span>;
}

export function ThreadAvatar({ thread, size = '' }) {
  if (thread?.kind === 'dm') {
    const id = (thread.memberIds || []).find((item) => item !== state.userId);
    return <Avatar person={user(id)} size={size} text="··" />;
  }
  const project = thread?.projectId ? projectOf(thread.projectId) : null;
  return <Avatar hue={project?.hue ?? 200} seed={project?.id || thread?.id} text={(thread?.name || 'C').slice(0, 1)} size={size} />;
}
