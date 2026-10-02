import { state, svc, can, fmtDT, go, parseRoute, render, toast } from '../../shared/core.js';
import { Avatar, Btn, Card, Field, Input, Item, ItemBody, List, PageHeader, Select, StatusPill, Tabs, Textarea } from '../../ui/ui';
import { first } from '../helpers';
import { href } from '../nav';
import { openDialog } from '../session';
import { Mono, SRC, SecHead, tabBase } from './common';

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
  const newCount = E.filter((e) => e.status === 'new').length;
  const header = (
    <PageHeader title="Enquiries" sub="New leads from every channel, ready to review, assign or decide.">
      {can('enquiry', 'w') && tab !== 'web' && (
        <Btn kind="primary" icon="plus" onClick={() => { state.desk.enqForm = !state.desk.enqForm; render(); }}>Add phone enquiry</Btn>
      )}
      <Btn to={href('#/settings?tab=services')}>Routing rules</Btn>
    </PageHeader>
  );
  // A quiet one-line summary, not four KPI cards - the enquiry queue below is the main content.
  const summary = (
    <Card className="mb-4 !py-2.5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px]">
        <span><b className={newCount ? 'text-warn' : 'text-accent-text'}>{newCount}</b> <span className="text-ink-3">awaiting review</span></span>
        <span className="text-line-2">·</span>
        <span><b className="text-accent-text">{E.filter((e) => e.status === 'accepted').length}</b> <span className="text-ink-3">accepted</span></span>
        <span className="text-line-2">·</span>
        <span className="text-ink-3">{E.filter((e) => ['rejected', 'not_eligible'].includes(e.status)).length} declined</span>
        <span className="text-line-2">·</span>
        <span className="text-ink-3">{E.length} total across {new Set(E.map((e) => e.source)).size} channels</span>
      </div>
    </Card>
  );

  if (tab === 'web') {
    return (
      <>
        {header}
        {summary}
        <Tabs base={tabBase('enquiries')} list={TABS} current={tab} />
        <WebPreview />
      </>
    );
  }

  const filterSrc = (k) => go(`#/enquiries?tab=${encodeURIComponent(parseRoute().q.tab || 'new')}&src=${encodeURIComponent(k)}`);
  const open = (id) => openDialog({ kind: 'enquiry', id });
  const count = (k) => byTab.filter((e) => e.source === k).length;
  return (
    <>
      {header}
      {summary}
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
      {/* One filtering hierarchy: Tabs above picks the queue (new/accepted/all), this single
          source dropdown narrows it further - not a second row of competing chip toggles. */}
      <SecHead title={`${TAB_LABEL[tab] || 'All'} enquiries`} sub={`${rows.length} record${rows.length === 1 ? '' : 's'}`}>
        <Select aria-label="Filter by source" value={src} onChange={(e) => filterSrc(e.target.value)} className="!min-h-9 !w-auto">
          <option value="all">All sources · {byTab.length}</option>
          {SOURCE_KEYS.map((k) => <option key={k} value={k}>{SRC[k]} · {count(k)}</option>)}
        </Select>
      </SecHead>
      {rows.length ? (
        <List>
          {rows.map((e) => (
            <Item key={e.id} onClick={() => open(e.id)} className="items-start">
              <Avatar>{(e.name || '?').slice(0, 1)}</Avatar>
              <ItemBody
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate">{e.name}</span>
                    {/* Skip the pill when it would just repeat the tab everyone's already looking at. */}
                    {e.status !== 'new' && <StatusPill status={e.status} />}
                  </span>
                }
                sub={
                  <>
                    <span className="block truncate text-[13px] text-ink-2">{svc.serviceType(e.typeId)} · {e.city || 'City not given'}</span>
                    {e.msg && <span className="block truncate text-[13px] text-ink-3">“{e.msg}”</span>}
                    <span className="mt-0.5 block truncate text-xs text-ink-3">{SRC[e.source] || e.source} · {e.assignee ? first(e.assignee) : 'Unassigned'} · {fmtDT(e.at)}</span>
                  </>
                }
              />
              {/* The whole row already opens the record (Item is a button), so this is a plain visual
                  cue rather than a second nested interactive element. */}
              <span className="flex-none self-center text-[13px] font-medium text-accent-text underline">Review</span>
            </Item>
          ))}
        </List>
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
