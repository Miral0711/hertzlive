// Centralized semantic status/tone -> design-token Tailwind class mappings.
//
// This is NOT a second color system: every string below resolves to a class already backed by a
// CSS custom property in src/index.css (via tailwind.config.js). It exists only so "what color
// means what" is declared once instead of being re-typed as inline ternaries/objects in every
// component that needs it — that duplication (not a duplicated color VALUE) was the actual audit
// finding. Add a case here rather than declaring a new tone->class object elsewhere.
//
// Tenant/agency accent behavior is unaffected: this file never touches --accent and friends,
// those stay owned by shared/core.js's agencyTheme()/applyAgencyTheme().

// Solid-fill tone (progress bars, status dots). '' is the default/positive brand accent.
export const TONE_FILL = {
  '': 'bg-accent',
  ok: 'bg-ok',
  warn: 'bg-warn',
  crit: 'bg-crit',
  secondary: 'bg-secondary',
};

// Soft background + border + matching text tone (pills, banners, filter chips).
export const TONE_SOFT = {
  '': 'border-line-2 text-ink-2',
  accent: 'border-accent-soft bg-accent-soft text-accent-text',
  ok: 'border-ok-soft bg-ok-soft text-ok',
  warn: 'border-warn-soft bg-warn-soft text-warn',
  crit: 'border-crit-soft bg-crit-soft text-crit',
};

// A site/project against its own recorded plan: accent fill when on track, warn fill when
// behind. The schedule math (sitePlan/siteOnTrack) stays local to each file that already has the
// real dates to compute it from — this only centralizes the resulting color choice, which is what
// was actually duplicated (identically) in home/homes.jsx and sites/SiteBoard.jsx.
export const trackFill = (onTrack) => (onTrack ? TONE_FILL[''] : TONE_FILL.warn);
