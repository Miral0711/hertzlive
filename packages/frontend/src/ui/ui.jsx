import { Children, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { TONE_FILL, TONE_SOFT } from './tones';

// ---------- Buttons ----------
const btnBase =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-r1 border font-semibold no-underline transition active:scale-[.98] disabled:opacity-50';
const btnKinds = {
  default: 'border-line-2 bg-surface text-accent-text hover:border-accent hover:bg-accent-soft',
  primary: 'border-accent bg-accent text-accent-ink hover:brightness-105',
  danger: 'border-crit bg-surface text-crit hover:bg-surface-2',
  link: 'min-h-0 border-0 bg-transparent p-0 font-medium text-accent-text underline',
};
export function Btn({ kind = 'default', sm = false, icon, className = '', children, to, ...rest }) {
  const size = kind === 'link' ? '' : sm ? 'min-h-8 px-2.5 text-[13px]' : 'min-h-9 px-3.5';
  const cls = `${btnBase} ${btnKinds[kind]} ${size} ${className}`;
  const content = (
    <>
      {icon && <Icon name={icon} small />}
      {children}
    </>
  );
  if (to) return <Link to={to} className={cls} {...rest}>{content}</Link>;
  return <button type="button" className={cls} {...rest}>{content}</button>;
}

// ---------- Status pill / chip ----------
// `ok` is the positive/settled state (paid, approved, done) — the olive system color, never the
// brand accent, which is reserved for primary actions and current-selection. Sourced from the
// shared tone map (src/ui/tones.js) rather than re-declared here.
const pillKinds = {
  '': TONE_SOFT[''],
  ok: TONE_SOFT.ok,
  soft: TONE_SOFT.accent,
  warn: TONE_SOFT.warn,
  crit: TONE_SOFT.crit,
};
export function Pill({ kind = '', children }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2 text-xs font-semibold leading-6 ${pillKinds[kind]}`}>
      {children}
    </span>
  );
}
// Infers the pill colour from the status wording, as the prototype did.
export function StatusPill({ status }) {
  const s = String(status);
  const kind = /paid|approved|done|received|answered|won|installed|closed|delivered|ok/i.test(s)
    ? 'ok'
    : /overdue|short|open|lost|blocked|crit/i.test(s)
      ? 'crit'
      : /pending|awaiting|sent|sample|check|draft|ordered/i.test(s)
        ? 'warn'
        : '';
  return <Pill kind={kind}>{s.replace(/_/g, ' ')}</Pill>;
}

const chipDot = { '': 'bg-accent', check: 'bg-warn', ask: 'bg-crit', filing: 'bg-line-2' };
const chipTone = {
  '': 'border-line bg-surface-2 text-ink-2',
  check: 'border-warn-soft bg-warn-soft text-warn',
  ask: 'border-crit-soft bg-crit-soft text-crit',
  filing: 'border-line bg-surface-2 text-ink-2',
};
export function Chip({ status = '', children, ...rest }) {
  return (
    <button
      type="button"
      className={`inline-flex min-w-0 max-w-[220px] items-center gap-1.5 rounded-full border px-2 text-xs font-medium leading-6 hover:brightness-95 ${chipTone[status] || chipTone['']}`}
      {...rest}
    >
      <span className={`h-1.5 w-1.5 flex-none rounded-full ${chipDot[status] || chipDot['']}`} />
      <span className="truncate">{children}</span>
    </button>
  );
}

// A single pressed/unpressed filter toggle, for small groups like "All / CAD / PDF / Photo" row
// filters (type, source, record-kind...). Pass `on`; the group itself stays the caller's state.
export function ToggleChip({ on, children, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={`inline-flex min-h-8 items-center gap-1 rounded-full border px-3 text-[13px] font-semibold transition ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line-2 bg-surface text-ink-2 hover:border-accent hover:text-accent-text'}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// A labelled on/off switch for personal settings/preferences (quiet mode, opt-outs...).
export function Switch({ on, onClick, label, sub }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} className="flex w-full items-center justify-between gap-4 rounded-r2 border border-line bg-surface px-4 py-3 text-left hover:border-accent">
      <span><b className="block">{label}</b>{sub && <small className="text-ink-3">{sub}</small>}</span>
      <i className={`relative h-6 w-11 flex-none rounded-full transition ${on ? 'bg-accent' : 'bg-surface-3'}`}><b className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-s1 transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} /></i>
    </button>
  );
}

// ---------- Layout blocks ----------
export function Card({ title, children, className = '', ...rest }) {
  return (
    <section className={`rounded-r3 border border-line bg-surface p-card ${className}`} {...rest}>
      {title && <h2 className="mb-2.5 mt-0 text-lg font-semibold leading-snug">{title}</h2>}
      {children}
    </section>
  );
}
export const Cards = ({ children, className = '' }) => (
  <div className={`grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))] ${className}`}>{children}</div>
);
export const Grid2 = ({ children, className = '' }) => (
  <div className={`grid items-start gap-gap md:grid-cols-2 [&>*]:min-w-0 ${className}`}>{children}</div>
);
export const Grid3 = ({ children, className = '' }) => (
  <div className={`grid items-start gap-gap md:grid-cols-3 [&>*]:min-w-0 ${className}`}>{children}</div>
);
export const Row = ({ children, className = '' }) => <div className={`flex items-center gap-2.5 ${className}`}>{children}</div>;
export const Kpis = ({ children }) => <div className="my-[18px] grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
export function Kpi({ label, value, crit = false }) {
  return (
    <div className="rounded-r3 border border-line bg-surface px-4 py-3">
      <div className="text-[13px] text-ink-2">{label}</div>
      <div className={`mt-1 text-2xl font-semibold leading-tight tracking-tight ${crit ? 'text-crit' : 'text-accent-text'}`}>{value}</div>
    </div>
  );
}
export function PageHeader({ title, sub, children }) {
  return (
    <div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="m-0 mb-1 text-title font-semibold leading-tight tracking-tight [text-wrap:balance]">{title}</h1>
        {sub && <div className="text-[13px] text-ink-3">{sub}</div>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
// `compact` is for a secondary slot (a card's own empty list) where the full-page p-7 block reads
// too heavy — same tokens, smaller padding and type.
export const Empty = ({ children = 'Nothing here yet.', compact = false }) => (
  <div className={`rounded-r2 bg-surface-2 text-center text-ink-3 ${compact ? 'px-4 py-3.5 text-[13px]' : 'p-7'}`}>{children}</div>
);
export const Banner = ({ internal = false, children, className = '', ...rest }) => (
  <div className={`mb-3.5 rounded-r1 px-3.5 py-2.5 font-medium ${internal ? 'bg-warn-soft text-warn' : 'bg-accent-soft text-accent-text'} ${className}`} {...rest}>
    {children}
  </div>
);
export const Avatar = ({ children, studio = false, accent = false, sm = false }) => (
  <span
    className={`inline-grid flex-none place-items-center rounded-full font-semibold ${sm ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-[13px]'} ${studio ? 'bg-accent text-accent-ink' : accent ? 'bg-accent-soft text-accent-text' : 'bg-surface-3 text-ink'}`}
  >
    {children}
  </span>
);
export function Bar({ value, tone = '' }) {
  const fill = TONE_FILL[tone];
  return (
    <div className="h-2 overflow-hidden rounded bg-surface-3">
      <i className={`block h-full ${fill}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

// ---------- List rows ----------
const itemCls = 'flex min-h-11 items-center gap-3 rounded-r2 border border-line bg-surface px-3.5 py-2.5 text-inherit no-underline';
export function Item({ to, onClick, children, className = '' }) {
  if (to) return <Link to={to} className={`${itemCls} hover:bg-surface-3 ${className}`} style={{ color: 'inherit' }}>{children}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={`${itemCls} w-full text-left hover:bg-surface-3 ${className}`}>{children}</button>;
  return <div className={`${itemCls} ${className}`}>{children}</div>;
}
export const ItemBody = ({ title, sub }) => (
  <span className="min-w-0 flex-1 text-left">
    <b className="block">{title}</b>
    {sub && <small className="text-ink-3">{sub}</small>}
  </span>
);
export const List = ({ children, empty = 'Nothing here yet.', compact = false }) => (
  <div className="flex flex-col gap-1.5">{Children.count(children) ? children : <Empty compact={compact}>{empty}</Empty>}</div>
);

// ---------- Breadcrumbs ----------
// Current-location trail (Projects / HA-2401 Jagwani Residence / Drawings). One shared style for
// every nested-navigation surface (project header, file browsers) instead of each re-typing the
// same "crumbs" markup. `linkAs` lets desktop pass its hash-route-aware DLink; defaults to the
// plain router Link for callers that already pass real paths.
export function Breadcrumbs({ items, linkAs: As = Link, className = '' }) {
  return (
    <nav aria-label="Breadcrumb" className={`flex flex-wrap items-center gap-1.5 text-[13px] text-ink-3 ${className}`}>
      {items.map((it, i) => (
        <span key={it.key ?? it.label} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true">/</span>}
          {it.to && i < items.length - 1
            ? <As to={it.to} className="text-accent-text no-underline hover:underline">{it.label}</As>
            : <b className="font-semibold text-ink">{it.label}</b>}
        </span>
      ))}
    </nav>
  );
}

// ---------- Tabs ----------
// Same underline tab bar everywhere a page switches between a few views. `base` + `current` for
// the usual URL-driven tabs (a `Link` per tab); pass `onSelect(key)` instead for a tab bar that
// drives local/step state rather than the route (e.g. a wizard) — same look, a `button` per tab.
export function Tabs({ base, list, current, onSelect }) {
  const cls = (k) => `-mb-px inline-flex min-h-[38px] items-center border-b-2 px-3 py-2 font-medium no-underline hover:text-ink aria-[current=page]:border-accent aria-[current=page]:font-semibold ${current === k ? 'border-accent text-accent-text' : 'border-transparent text-ink-2'}`;
  return (
    <div className="mb-4 flex flex-wrap gap-0.5 border-b border-line">
      {list.map(([k, l]) => (onSelect ? (
        <button key={k} type="button" aria-current={current === k ? 'page' : undefined} onClick={() => onSelect(k)} className={cls(k)} style={{ color: current === k ? 'var(--accent-text)' : undefined }}>
          {l}
        </button>
      ) : (
        <Link
          key={k}
          to={`${base}?tab=${k}`}
          aria-current={current === k ? 'page' : undefined}
          className={cls(k)}
          style={{ color: current === k ? 'var(--accent-text)' : undefined }}
        >
          {l}
        </Link>
      )))}
    </div>
  );
}

// ---------- Form fields ----------
const control = 'min-h-9 rounded-r1 border border-line-2 bg-surface px-2.5 py-1.5 text-ink focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-soft';
export function Field({ label, hint, error, children, className = '' }) {
  return (
    <div className={`mb-2.5 flex flex-col gap-1 ${className}`}>
      <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-2">
        {label}
        {hint && <small className="font-normal">{hint}</small>}
        {children}
      </label>
      {error && <span className="text-xs text-crit">{error}</span>}
    </div>
  );
}
export const Input = ({ className = '', ...p }) => <input className={`${control} ${className}`} {...p} />;
export const Select = ({ className = '', ...p }) => <select className={`${control} ${className}`} {...p} />;
export const Textarea = ({ className = '', ...p }) => <textarea className={`${control} min-h-[72px] resize-y ${className}`} {...p} />;

// ---------- Divider ----------
export const Divider = ({ className = '' }) => <hr className={`m-0 border-0 border-t border-line ${className}`} />;

// ---------- Tooltip (hover/focus label, CSS-only) ----------
export function Tooltip({ label, children }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute -top-1.5 left-1/2 z-30 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-r1 bg-ink px-2 py-1 text-xs font-medium text-surface opacity-0 shadow-s2 transition group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

// ---------- IconButton ----------
export function IconButton({ icon, label, sm = false, className = '', ...rest }) {
  const size = sm ? 'h-8 w-8' : 'h-9 w-9';
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-grid ${size} flex-none place-items-center rounded-r1 border border-line-2 bg-surface text-ink-2 transition hover:bg-surface-2 hover:text-ink disabled:opacity-50 ${className}`}
      {...rest}
    >
      <Icon name={icon} small={sm} />
    </button>
  );
}

// ---------- Dropdown (native <details>-backed menu — same pattern the app already used ad hoc
// in several places, centralised here: closes on outside click / Escape). ----------
export function Dropdown({ trigger, children, align = 'right', className = '', panelClassName = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) ref.current.open = false; };
    const onKey = (e) => { if (e.key === 'Escape' && ref.current) ref.current.open = false; };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onDocClick); document.removeEventListener('keydown', onKey); };
  }, []);
  return (
    <details ref={ref} className={`relative ${className}`}>
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-r1 border border-line-2 bg-surface px-3.5 font-medium text-ink-2 hover:bg-surface-2 hover:text-accent-text [&::-webkit-details-marker]:hidden">
        {trigger}
      </summary>
      <div className={`absolute top-full z-30 mt-1.5 min-w-[220px] rounded-r3 border border-line bg-surface p-2 shadow-s2 ${align === 'right' ? 'right-0' : 'left-0'} ${panelClassName}`}>
        {children}
      </div>
    </details>
  );
}
export const DropdownItem = ({ icon, children, className = '', ...rest }) => (
  <button
    type="button"
    className={`flex min-h-9 w-full items-center gap-2.5 rounded-r1 px-2.5 text-left font-medium text-ink hover:bg-surface-2 ${className}`}
    {...rest}
  >
    {icon && <Icon name={icon} small />}
    {children}
  </button>
);

// ---------- Data table (sortable, filterable) ----------
const textOf = (n) => {
  if (n == null || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(textOf).join('');
  if (isValidElement(n)) return textOf(n.props.children);
  return '';
};
// Displayed INR values use lakh/crore; compare their amounts, not the leading digits.
function numericValue(text) {
  const m = String(text).replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)\s*(Cr|L|K)?\b/i);
  return m ? Number(m[1]) * ({ cr: 1e7, l: 1e5, k: 1e3 }[m[2]?.toLowerCase()] || 1) : NaN;
}
// ---------- Table primitives: every table in the app is built from these, so alignment, spacing,
// header style, hover and borders are defined once (tokens: --table-pad-x, --table-row-h, --table-head-h). ----------
export const TH_CLS = 'h-head whitespace-nowrap border-b border-line bg-surface-2 px-tbl-x py-2 text-xs font-semibold uppercase tracking-[0.04em] text-ink-2';
export const TD_CLS = 'h-row border-b border-line px-tbl-x py-2 align-middle text-[14px] group-last:border-b-0 group-hover:bg-surface-2';
const alignCls = { left: 'text-left', right: 'text-right tabular-nums [&:not(:last-child)]:pr-10', center: 'text-center' };
export const Table = ({ children, className = '', minWidth, fixed = false, compact = false }) => (
  <div className={`overflow-x-auto rounded-r3 border border-line bg-surface ${className}`}>
    <table className={`w-full border-collapse text-ink ${fixed ? 'table-fixed' : ''} ${compact ? '[&_td]:!px-2 [&_th]:!px-2 [&_td]:!text-[13px]' : ''}`} style={minWidth ? { minWidth } : undefined}>{children}</table>
  </div>
);
export const Th = ({ align = 'left', className = '', children, ...rest }) => (
  <th scope="col" className={`${TH_CLS} ${alignCls[align]} ${className}`} {...rest}>{children}</th>
);
export const Td = ({ align = 'left', className = '', wrap = false, children, ...rest }) => (
  <td className={`${TD_CLS} ${alignCls[align]} ${wrap ? 'min-w-40 max-w-[340px] [overflow-wrap:anywhere]' : 'whitespace-nowrap'} ${className}`} {...rest}>{children}</td>
);
export const Tr = ({ className = '', children, ...rest }) => <tr className={`group ${className}`} {...rest}>{children}</tr>;

// A column is numeric if its header says so (₹/# prefix - currency/counts, kept for sort math)
// or every cell in it is plain digits/percent (hours, days, counts) - so numeric columns line up
// and right-align consistently across every table without each caller having to prefix headers.
const plainNumber = /^-?[\d,]+(\.\d+)?%?$/;
// cols: header strings ('' = actions column). A leading ₹ or # marks a numeric column (right aligned, sorted by value).
// Optional `align` array overrides per column: ['left', 'right', ...].
export function DataTable({ cols, rows, align }) {
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState(null);
  const isNum = (i) => {
    if (/^₹|^#/.test(cols[i] || '')) return true;
    const vals = rows.map((r) => textOf(r[i]).trim()).filter(Boolean);
    return vals.length > 0 && vals.every((v) => plainNumber.test(v));
  };
  // One rule everywhere: every column is left aligned with equal width; only the actions column sits at the right.
  const colAlign = (i) => align?.[i] || (!cols[i] ? 'right' : 'left');
  const shown = useMemo(() => {
    let out = rows.map((r, i) => ({ r, i }));
    if (filter.trim()) {
      const q = filter.trim().toLowerCase();
      out = out.filter(({ r }) => r.map(textOf).join(' ').toLowerCase().includes(q));
    }
    if (sort) {
      const dir = sort.asc ? 1 : -1;
      out = [...out].sort((a, b) => {
        const x = textOf(a.r[sort.col]), y = textOf(b.r[sort.col]);
        if (isNum(sort.col)) return (numericValue(x) - numericValue(y)) * dir || 0;
        return x.localeCompare(y, undefined, { numeric: true }) * dir;
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filter, sort]);
  if (!rows.length) return <Empty />;
  // Short-text tables get equal column widths so spacing is even; tables with action buttons or long text size to content.
  // Equal widths only when the table has no actions column and no long or control-heavy cells; those would be clipped, so they size to content.
  const fixed = cols.length <= 8 && !cols.includes('') && rows.every((r) => r.every((c) => textOf(c).length <= 48));
  return (
    <>
      {rows.length > 8 && (
        <input
          type="search"
          aria-label="Filter table"
          placeholder="Filter this table…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className={`${control} mb-2 block max-w-[280px]`}
        />
      )}
      <Table fixed={fixed} compact={cols.length >= 8} minWidth={fixed ? cols.length * 130 : undefined}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <Th
                key={i}
                align={colAlign(i)}
                aria-sort={sort?.col === i ? (sort.asc ? 'ascending' : 'descending') : undefined}
              >
                {c ? (
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1 border-0 bg-transparent p-0 font-semibold uppercase tracking-[0.04em]`}
                    onClick={() => setSort((s) => ({ col: i, asc: s?.col === i ? !s.asc : true }))}
                  >
                    {c.replace(/^[₹#]/, '')}
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 h-0 w-0 border-4 border-transparent ${sort?.col === i ? 'border-t-accent-text opacity-100' : 'border-t-ink-3 opacity-50'} ${sort?.col === i && sort.asc ? 'rotate-180' : ''}`}
                    />
                  </button>
                ) : (
                  <span className="sr-only">Actions</span>
                )}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map(({ r, i }) => (
            <Tr key={i}>
              {r.map((c, j) => (
                <Td key={j} align={colAlign(j)} wrap={textOf(c).length > 48} className={j === 0 && cols[0] ? 'font-medium' : ''}>
                  {c}
                </Td>
              ))}
            </Tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
