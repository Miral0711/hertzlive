/** @type {import('tailwindcss').Config} */
const v = (name) => `var(--${name})`;

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      spacing: {
        gap: v('gap'), 'gap-lg': v('gap-lg'), card: v('card-pad'), 'page-x': v('page-x'), 'page-y': v('page-y'),
        nav: v('nav-w'), 'tbl-x': v('table-pad-x'), 'row': v('table-row-h'), 'head': v('table-head-h'), header: v('header-h'), chat: v('chat-w'),
      },
      fontSize: { title: v('text-title'), stat: v('text-stat'), hero: v('text-hero') },
      gridTemplateColumns: { shell: 'var(--nav-w) minmax(0,1fr)', 'shell-chat': 'var(--nav-w) minmax(0,1fr) var(--chat-w)' },
      gridTemplateRows: { shell: 'var(--header-h) minmax(0,1fr)' },
      colors: {
        ground: v('ground'),
        surface: { DEFAULT: v('surface'), 2: v('surface-2'), 3: v('surface-3') },
        ink: { DEFAULT: v('ink'), 2: v('ink-2'), 3: v('ink-3') },
        line: { DEFAULT: v('line'), 2: v('line-2') },
        accent: {
          DEFAULT: v('accent'),
          ink: v('accent-ink'),
          soft: v('accent-soft'),
          text: v('accent-text'),
        },
        warn: { DEFAULT: v('warn'), soft: v('warn-soft') },
        crit: { DEFAULT: v('crit'), soft: v('crit-soft') },
        ok: { DEFAULT: v('ok'), soft: v('ok-soft') },
        secondary: { DEFAULT: v('secondary'), soft: v('secondary-soft') },
        nav: { DEFAULT: v('nav'), ink: v('nav-ink'), active: v('nav-active'), 'active-ink': v('nav-active-ink'), line: v('nav-line'), hover: v('nav-hover') },
        mine: v('mine'),
        chat: v('chat'),
      },
      borderRadius: { r1: v('r-1'), r2: v('r-2'), r3: v('r-3') },
      boxShadow: { s1: v('shadow-1'), s2: v('shadow-2') },
      fontFamily: {
        ui: ['Inter', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'Cambria', 'serif'],
        mono: ['ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
