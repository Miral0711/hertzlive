import { state, svc, can, fmtDT, go, parseRoute, render, toast } from '../../shared/core.js';
import { Avatar, Btn, Card, Field, Grid3, Input, PageHeader, Select, StatusPill, Tabs, Textarea } from '../../ui/ui';
import { first } from '../helpers';
import { DLink } from '../nav';
import { openDialog } from '../session';
import { Mono, SRC, SubText, tabBase } from './common';

const TABS = [['new', 'New'], ['accepted', 'Accepted'], ['all', 'All'], ['web', 'Web form preview']];

export function addEnquiry(e) {
  e.preventDefault();
  const p = Object.fromEntries(new FormData(e.currentTarget));
  const r = svc.addEnquiry(p);
  state.desk.enqForm = false;
  toast(r.status === 'new' ? `Saved. Goes to ${first(r.assignee)}.` : 'Saved as not eligible.');
  go('#/enquiries');
}

const ServiceOptions = () => state.db.SERVICE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>);

export default function Enquiries({ q }) {
  const tab = q.tab || 'new';
  const E = state.db.ENQUIRIES;
  let rows = { new: E.filter((e) => e.status === 'new'), accepted: E.filter((e) => e.status === 'accepted'), all: E }[tab] || E;
  const src = q.src || 'all';
  if (src !== 'all') rows = rows.filter((e) => e.source === src);

  if (tab === 'web') {
    return (
      <>
        <PageHeader title="Enquiries" />
        <Tabs base={tabBase('enquiries')} list={TABS} current={tab} />
        <Card title="What a prospect sees">
          <SubText>
            Public form at <Mono>{svc.cfg().short.toLowerCase()}.app/enquire</Mono> and the WhatsApp link <Mono>wa.me/{svc.cfg().wa.replace(/\D/g, '')}</Mono>. Same questions either way. Instagram DMs and AI phone answering feed the same list in production.
          </SubText>
          <form onSubmit={addEnquiry} className="max-w-[520px]">
            <input type="hidden" name="source" value="web" />
            <Field label="Your name"><Input name="name" required /></Field>
            <Field label="Phone"><Input name="phone" required placeholder="+91" /></Field>
            <Field label="What do you need"><Select name="typeId"><ServiceOptions /></Select></Field>
            <Field label="City"><Input name="city" /></Field>
            <Field label="Tell us a little"><Textarea name="msg" rows={3} /></Field>
            <Btn kind="primary" type="submit">Send enquiry</Btn>
          </form>
        </Card>
      </>
    );
  }

  const filterSrc = (k) => go(`#/enquiries?tab=${encodeURIComponent(parseRoute().q.tab || 'new')}&src=${encodeURIComponent(k)}`);
  const open = (id) => openDialog({ kind: 'enquiry', id });
  return (
    <>
      <PageHeader title="Enquiries" sub="New leads from every channel, ready to review, assign or decide.">
        {can('enquiry', 'w') && <Btn onClick={() => { state.desk.enqForm = !state.desk.enqForm; render(); }}>Add phone enquiry</Btn>}
        <DLink to="#/settings?tab=services" className="inline-flex min-h-9 items-center rounded-r1 border border-line-2 bg-surface px-3.5 font-semibold text-ink no-underline hover:bg-surface-2">Routing rules</DLink>
      </PageHeader>
      <Tabs base={tabBase('enquiries')} list={TABS} current={tab} />
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by source">
        <Btn sm aria-pressed={src === 'all'} className={src === 'all' ? '!border-accent !bg-accent-soft' : ''} onClick={() => filterSrc('all')}>All</Btn>
        {Object.entries(SRC).map(([k, l]) => (
          <Btn key={k} sm aria-pressed={src === k} className={src === k ? '!border-accent !bg-accent-soft' : ''} onClick={() => filterSrc(k)}>{l}</Btn>
        ))}
      </div>
      {state.desk.enqForm && (
        <Card title="Phone enquiry" className="mb-3.5">
          <form onSubmit={addEnquiry}>
            <input type="hidden" name="source" value="phone" />
            <Grid3>
              <Field label="Name"><Input name="name" required autoFocus /></Field>
              <Field label="Phone"><Input name="phone" required /></Field>
              <Field label="Service"><Select name="typeId"><ServiceOptions /></Select></Field>
              <Field label="City"><Input name="city" /></Field>
              <div className="md:col-span-2"><Field label="What they said"><Input name="msg" className="w-full" /></Field></div>
            </Grid3>
            <div className="flex gap-2">
              <Btn kind="primary" type="submit">Save</Btn>
              <Btn onClick={() => { state.desk.enqForm = false; render(); }}>Cancel</Btn>
            </div>
          </form>
        </Card>
      )}
      <section>
        <SubText>{rows.length} {tab === 'new' ? 'new ' : ''}enquir{rows.length === 1 ? 'y' : 'ies'} · Open a record to review, assign or decide.</SubText>
        {rows.length ? (
          <div className="flex flex-col gap-2">
            {rows.map((e) => (
              <div
                key={e.id}
                role="button"
                tabIndex={0}
                onClick={() => open(e.id)}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(e.id); } }}
                className="flex w-full cursor-pointer items-center gap-3.5 rounded-r2 border border-line bg-surface px-4 py-3 transition hover:bg-surface-2"
              >
                <Avatar>{(e.name || '?').slice(0, 1)}</Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{e.name}</b>
                    <StatusPill status={e.status === 'new' ? 'pending' : e.status} />
                  </div>
                  <small className="block truncate text-ink-3">
                    {svc.serviceType(e.typeId)} · {e.city || 'City not given'} · {SRC[e.source] || e.source}
                    {e.msg ? ` · ${e.msg}` : ''}
                  </small>
                </div>
                <div className="hidden flex-none text-right text-[13px] text-ink-3 sm:block">
                  <div>{e.assignee ? first(e.assignee) : 'Unassigned'}</div>
                  <div>{fmtDT(e.at)}</div>
                </div>
                <Btn sm onClick={(ev) => { ev.stopPropagation(); open(e.id); }}>Review</Btn>
              </div>
            ))}
          </div>
        ) : (
          <Card><p className="m-0 py-6 text-center text-ink-3">No enquiries in this view.</p></Card>
        )}
      </section>
    </>
  );
}

