import { state, svc, can, fmtDT, go, parseRoute, render, toast } from '../../shared/core.js';
import { Avatar, Btn, Card, Field, Input, PageHeader, Select, StatusPill, Tabs, Textarea } from '../../ui/ui';
import { first } from '../helpers';
import { DLink } from '../nav';
import { openDialog } from '../session';
import { Mono, SRC, SecHead, Stat, tabBase } from './common';

const TABS = [['new', 'New'], ['accepted', 'Accepted'], ['all', 'All'], ['web', 'Web form preview']];
const TAB_LABEL = { new: 'New', accepted: 'Accepted', all: 'All' };

export function addEnquiry(e) {
  e.preventDefault();
  const p = Object.fromEntries(new FormData(e.currentTarget));
  const r = svc.addEnquiry(p);
  state.desk.enqForm = false;
  toast(r.status === 'new' ? `Saved. Goes to ${first(r.assignee)}.` : 'Saved as not eligible.');
  go('#/enquiries');
}

const ServiceOptions = () => state.db.SERVICE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>);
const SOURCE_KEYS = ['web', 'whatsapp', 'phone', 'instagram', 'facebook'];

function WebPreview() {
  const cfg = svc.cfg();
  const channels = [
    ['Web form', `${cfg.short.toLowerCase()}.app/enquire`, 'Public form on your website'],
    ['WhatsApp', `wa.me/${cfg.wa.replace(/\D/g, '')}`, 'Click-to-chat link for ads and cards'],
    ['Instagram', 'Direct messages', 'Land in the same list in production'],
    ['Facebook', 'Page messages', 'Land in the same list in production'],
    ['Phone', 'AI call answering', 'Calls are logged here, or add them by hand'],
  ];
  return (
    <>
      <SecHead title="Web form preview" sub="What a prospect sees, and every channel that feeds this list." />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <Card title="Enquire with us">
          <p className="mb-3 mt-0 text-[13px] text-ink-3">The same questions are asked on the public form and the WhatsApp link.</p>
          <form onSubmit={addEnquiry}>
            <input type="hidden" name="source" value="web" />
            <div className="grid gap-x-3 sm:grid-cols-2">
              <Field label="Your name"><Input name="name" required /></Field>
              <Field label="Phone"><Input name="phone" required placeholder="+91" /></Field>
              <Field label="What do you need"><Select name="typeId"><ServiceOptions /></Select></Field>
              <Field label="City"><Input name="city" /></Field>
            </div>
            <Field label="Tell us a little"><Textarea name="msg" rows={3} /></Field>
            <Btn kind="primary" type="submit">Send enquiry</Btn>
          </form>
        </Card>
        <Card title="How prospects reach you">
          {channels.map(([k, v, sub]) => (
            <div key={k} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text">{k.slice(0, 2)}</span>
              <span className="min-w-0 flex-1"><b className="block">{k}</b><small className="text-ink-3">{sub}</small></span>
              <Mono>{v}</Mono>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}

export default function Enquiries({ q }) {
  const tab = q.tab || 'new';
  const E = state.db.ENQUIRIES;
  const byTab = { new: E.filter((e) => e.status === 'new'), accepted: E.filter((e) => e.status === 'accepted'), all: E }[tab] || E;
  const src = q.src || 'all';
  const rows = src === 'all' ? byTab : byTab.filter((e) => e.source === src);
  const header = (
    <PageHeader title="Enquiries" sub="New leads from every channel, ready to review, assign or decide.">
      {can('enquiry', 'w') && tab !== 'web' && (
        <Btn kind="primary" icon="plus" className="!min-h-11 !px-5" onClick={() => { state.desk.enqForm = !state.desk.enqForm; render(); }}>Add phone enquiry</Btn>
      )}
      <DLink to="#/settings?tab=services" className="inline-flex min-h-11 items-center rounded-r1 border border-line-2 bg-surface px-4 font-semibold text-accent-text no-underline hover:border-accent hover:bg-accent-soft">Routing rules</DLink>
    </PageHeader>
  );
  const stats = (
    <div className="mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      <Stat label="Awaiting review" value={E.filter((e) => e.status === 'new').length} sub="new enquiries" tone={E.some((e) => e.status === 'new') ? 'text-warn' : 'text-ok'} />
      <Stat label="Accepted" value={E.filter((e) => e.status === 'accepted').length} sub="can book a meeting" tone="text-ok" />
      <Stat label="Declined" value={E.filter((e) => ['rejected', 'not_eligible'].includes(e.status)).length} sub="rejected or not eligible" />
      <Stat label="All enquiries" value={E.length} sub={`${new Set(E.map((e) => e.source)).size} channels`} />
    </div>
  );

  if (tab === 'web') {
    return (
      <>
        {header}
        {stats}
        <Tabs base={tabBase('enquiries')} list={TABS} current={tab} />
        <WebPreview />
      </>
    );
  }

  const filterSrc = (k) => go(`#/enquiries?tab=${encodeURIComponent(parseRoute().q.tab || 'new')}&src=${encodeURIComponent(k)}`);
  const open = (id) => openDialog({ kind: 'enquiry', id });
  const chip = (on) => `inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line-2 bg-surface text-ink-2 hover:border-accent hover:text-accent-text'}`;
  const count = (k) => byTab.filter((e) => e.source === k).length;
  return (
    <>
      {header}
      {stats}
      <Tabs base={tabBase('enquiries')} list={TABS} current={tab} />
      {state.desk.enqForm && (
        <Card title="Log a phone enquiry" className="mb-4">
          <form onSubmit={addEnquiry}>
            <input type="hidden" name="source" value="phone" />
            <div className="grid gap-x-3 md:grid-cols-4">
              <Field label="Name"><Input name="name" required autoFocus /></Field>
              <Field label="Phone"><Input name="phone" required placeholder="+91" /></Field>
              <Field label="Service"><Select name="typeId"><ServiceOptions /></Select></Field>
              <Field label="City"><Input name="city" /></Field>
              <Field label="What they said" className="md:col-span-4"><Input name="msg" className="w-full" placeholder="Short note from the call" /></Field>
            </div>
            <div className="flex gap-2">
              <Btn kind="primary" type="submit">Save enquiry</Btn>
              <Btn onClick={() => { state.desk.enqForm = false; render(); }}>Cancel</Btn>
            </div>
          </form>
        </Card>
      )}
      <SecHead title={`${TAB_LABEL[tab] || 'All'} enquiries`} sub={`${rows.length} record${rows.length === 1 ? '' : 's'} · one Review action per record to assign, accept or decline.`}>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by source">
          <button type="button" aria-pressed={src === 'all'} className={chip(src === 'all')} onClick={() => filterSrc('all')}>All <span className="opacity-70">{byTab.length}</span></button>
          {SOURCE_KEYS.map((k) => (
            <button key={k} type="button" aria-pressed={src === k} className={chip(src === k)} onClick={() => filterSrc(k)}>{SRC[k]} <span className="opacity-70">{count(k)}</span></button>
          ))}
        </div>
      </SecHead>
      {rows.length ? (
        <div className="overflow-hidden rounded-r3 border border-line bg-surface">
          <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_110px_110px_130px_88px] gap-3 border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-semibold text-ink-2 lg:grid">
            <span>Prospect</span><span>Wants</span><span>Source</span><span>Owner</span><span>Received</span><span />
          </div>
          {rows.map((e) => (
            <div
              key={e.id}
              role="button"
              tabIndex={0}
              onClick={() => open(e.id)}
              onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(e.id); } }}
              className="grid cursor-pointer items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 transition last:border-b-0 hover:bg-surface-2 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_110px_110px_130px_88px]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar>{(e.name || '?').slice(0, 1)}</Avatar>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><b>{e.name}</b><StatusPill status={e.status === 'new' ? 'pending' : e.status} /></div>
                  <small className="block truncate text-ink-3">{e.msg || 'No message left.'}</small>
                </div>
              </div>
              <div className="min-w-0 text-[13px]"><span className="block truncate font-medium">{svc.serviceType(e.typeId)}</span><span className="text-ink-3">{e.city || 'City not given'}</span></div>
              <div><span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-ink-2">{SRC[e.source] || e.source}</span></div>
              <div className="text-[13px] text-ink-2">{e.assignee ? first(e.assignee) : 'Unassigned'}</div>
              <div className="text-[13px] text-ink-3">{fmtDT(e.at)}</div>
              <div className="lg:text-right"><Btn sm onClick={(ev) => { ev.stopPropagation(); open(e.id); }}>Review</Btn></div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <div className="rounded-r2 bg-surface-2 px-4 py-9 text-center">
            <b className="block">No enquiries in this view</b>
            <span className="text-[13px] text-ink-3">Try another source or tab, or add a phone enquiry.</span>
          </div>
        </Card>
      )}
    </>
  );
}
