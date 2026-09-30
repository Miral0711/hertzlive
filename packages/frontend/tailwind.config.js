/** @type {import('tailwindcss').Config} */
const v = (name) => `var(--${name})`;

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
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
