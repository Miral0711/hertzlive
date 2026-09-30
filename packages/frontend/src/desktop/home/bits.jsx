import { useEffect, useRef } from 'react';
import { paintPh } from '../../shared/core.js';
import { Item, ItemBody, List, Card } from '../../ui/ui';
import { href } from '../nav';

// Small presentational helpers shared by the role homes.
export const Mono = ({ children }) => <span className="font-mono text-[13px]">{children}</span>;
export const Grow = ({ children }) => <span className="min-w-0 flex-1">{children}</span>;
export const Small = ({ children }) => <small className="text-ink-3">{children}</small>;
export const Dot = () => <span className="h-2 w-2 flex-none rounded-full bg-crit" />;

// Link row: hash route + label + trailing "Open".
export const LinkRow = ({ to, children, trail = 'Open' }) => (
  <Item to={href(to)}>
    <Grow>{children}</Grow>
    {trail && <Small>{trail}</Small>}
  </Item>
);

export const ListCard = ({ title, rows, empty, className = '' }) => (
  <Card title={title} className={className}>
    <List empty={empty}>{rows}</List>
  </Card>
);

export const Grid = ({ children, className = '' }) => (
  <div className={`mb-3.5 grid items-stretch gap-3.5 md:grid-cols-2 [&>*]:h-full [&>*]:min-w-0 ${className}`}>{children}</div>
);

// Deterministic placeholder photo (the prototype painted canvases after each render).
export function PhCanvas({ hue, seed, ar = 1.333 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) paintPh(ref.current);
  }, [hue, seed, ar]);
  return <canvas ref={ref} data-hue={hue} data-seed={seed} data-ar={ar} aria-hidden="true" className="block w-full rounded-r2" />;
}

const attentionAction = (h) =>
  h.includes('enquiries') ? 'Review enquiry'
    : h.includes('approvals') ? 'Review request'
      : h.includes('leaves') ? 'Review leave'
        : h.includes('issues') ? 'Resolve issue'
          : h.includes('materials') ? 'Review material'
            : h.includes('changes') ? 'Review change'
              : 'View task';

const NeedRow = ({ text, to }) => {
  const [title, ...context] = text.split(' · ');
  return (
    <Item to={href(to)}>
      <ItemBody title={title} sub={context.length ? context.join(' · ') : null} />
      <span className="flex-none text-[13px] font-semibold text-accent-text">{attentionAction(to)}</span>
    </Item>
  );
};

export function NeedList({ need }) {
  return (
    <section className="rounded-r3 border border-line bg-surface px-[18px] py-4">
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-lg font-semibold">Needs your attention</h2>
        <span className="text-[13px] text-ink-3">{need.length} item{need.length === 1 ? '' : 's'}</span>
      </div>
      <List empty="No items in your current attention queue.">
        {need.slice(0, 4).map(([t, h], i) => <NeedRow key={i} text={t} to={h || '#/dashboard'} />)}
      </List>
      {need.length > 4 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[13px] font-medium text-accent-text">Show {need.length - 4} more items</summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {need.slice(4).map(([t, h], i) => <NeedRow key={i} text={t} to={h || '#/dashboard'} />)}
          </div>
        </details>
      )}
    </section>
  );
}
