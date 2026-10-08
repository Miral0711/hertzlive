import { useState } from 'react';
import Ph from '../../ui/Ph';
import {
  state, svc, can, persist, toast, render, hh, fmtD, uid, AIProvider, me,
} from '../../shared/core.js';
import { ROLES } from '../../shared/data.js';
import { DEFERRED } from '../data';
import {
  Banner, Btn, Card, Grid2, Tabs, Input, Select, Field, PageHeader, List, Item, DataTable, Empty,
  Switch, ToggleChip, Pill,
} from '../../ui/ui';
import { DLink, href } from '../nav';
import { staff } from '../helpers';
import Icon from '../../ui/Icon';
import { SecHead, Stat } from '../studio/common';
import { cycleTheme, togglePreviewAsClient, resetSampleData, formData } from '../session';

const hours = (from, to) => {
  const a = [];
  for (let h = from; h < to; h += 0.5) a.push(h);
  return a;
};
const sub = 'mb-2.5 mt-0 text-[13px] text-ink-3';
const h2 = 'mb-2.5 mt-4 text-lg font-semibold';
const inline = 'mt-2.5 flex flex-wrap items-center gap-2';

// Submit helper: prevent default, read FormData, run, then clear the form (the prototype re-rendered).
const submit = (fn) => (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  fn(formData(form), form);
  form.reset?.();
};

// ---------- ACT handlers used by settings ----------
export const themeToggle = () => cycleTheme();
export const motionToggle = () => { state.motion = !state.motion; persist(); render(); };
export const quietToggle = () => {
  const person = me();
  if (!person) return;
  svc.setOptOut(!person.ptsOptOut);
  render();
};
export const previewToggle = () => togglePreviewAsClient();

const DEFAULT_BG = '#f2f3f5';
function agencySave(p) {
  Object.assign(state.db.AGENCY, {
    name: p.name, short: p.short, accent: p.accent, background: p.background && p.background.toLowerCase() !== DEFAULT_BG ? p.background : '', wa: p.wa, address: p.address, hours: { start: +p.hstart, end: +p.hend },
  });
  if (persist()) toast('Agency settings saved.');
  else state.toast = '';
  render();
}
function gstSave(p) {
  Object.assign(state.db.AGENCY, { gstin: p.gstin.trim(), state: p.state.trim(), sac: p.sac.trim(), series: p.series });
  persist();
  toast('Saved.');
  render();
}
function holAdd(p) {
  state.db.HOLIDAYS.push({ date: p.date, name: p.name.trim(), site: !!p.site });
  state.db.HOLIDAYS.sort((a, b) => a.date.localeCompare(b.date));
  persist();
  toast('Holiday added.');
  render();
}
function holDel(date) {
  state.db.HOLIDAYS = state.db.HOLIDAYS.filter((h) => h.date !== date);
  persist();
  toast('Holiday removed.');
  render();
}
function holSite(date, checked) {
  const h = state.db.HOLIDAYS.find((x) => x.date === date);
  h.site = checked;
  persist();
  toast(h.site ? 'Site closed that day, plan skips it.' : 'Office only, site works.');
}
function tradeAdd(p) {
  const n = p.name.trim();
  if (n && !state.db.TRADES.includes(n)) state.db.TRADES.push(n);
  persist();
  render();
}
function tradeDel(n) {
  state.db.TRADES = state.db.TRADES.filter((t) => t !== n);
  persist();
  render();
}
function tplAdd(city, p) {
  state.db.STATUTORY_TEMPLATES.find((x) => x.city === city).items.push(p.name.trim());
  persist();
  render();
}
function tplDel(city, i) {
  state.db.STATUTORY_TEMPLATES.find((x) => x.city === city).items.splice(i, 1);
  persist();
  render();
}
function tplCityAdd(p) {
  const city = p.city.trim();
  if (city && !state.db.STATUTORY_TEMPLATES.some((x) => x.city === city)) {
    state.db.STATUTORY_TEMPLATES.push({ city, items: [...state.db.STATUTORY_TEMPLATES.find((x) => x.city === '*').items] });
  }
  persist();
  toast(`${city} starts with the any-city list.`);
  render();
}
function roleSet(id, value) {
  const u = state.db.USERS.find((x) => x.id === id);
  u.role = value;
  if (u.id === state.userId) state.role = u.role;
  persist();
  toast('Role changed.');
  render();
}
function roleLabel(id, p) {
  const l = p.label.trim();
  if (!l) return;
  state.db.ROLES[id].label = l;
  ROLES[id].label = l;
  persist();
  toast('Saved.');
  render();
}
function personAdd(p) {
  state.db.USERS.push({
    id: uid(),
    name: p.name,
    role: p.role,
    title: state.db.ROLES[p.role].label,
    ini: p.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
    skills: [],
    pts: 0,
    streak: 0,
  });
  persist();
  toast('Added. Invite sent on WhatsApp.');
  render();
}
function stAdd(p) {
  const n = p.name.trim();
  state.db.SERVICE_TYPES.push({ id: n.toLowerCase().replace(/\W+/g, '_'), name: n });
  persist();
  render();
}
function stDel(id) {
  state.db.SERVICE_TYPES = state.db.SERVICE_TYPES.filter((t) => t.id !== id);
  state.db.ROUTING_RULES = state.db.ROUTING_RULES.filter((r) => r.typeId !== id);
  persist();
  render();
}
function rrSet(t, v) {
  state.db.ROUTING_RULES = state.db.ROUTING_RULES.filter((r) => r.typeId !== t);
  if (v) {
    const [mode, to] = v.split(':');
    state.db.ROUTING_RULES.push({ id: uid(), typeId: t, mode, to });
  }
  persist();
  toast('Routing saved.');
  render();
}
function resAdd(p) {
  if (!p.name.trim()) return;
  state.db.ROOMS.push({
    id: uid(), name: p.name, type: p.type, location: p.location, cap: +p.cap || 1, exclusive: p.exclusive === '1', bookableBy: [],
  });
  persist();
  toast('Added.');
  render();
}
function resDel(id) {
  // eslint-disable-next-line no-alert
  if (!window.confirm('Remove this room? Existing bookings keep their record.')) return;
  state.db.ROOMS = state.db.ROOMS.filter((r) => r.id !== id);
  persist();
  render();
}
function bookCfg(p) {
  Object.assign(state.db.AGENCY.booking, { buffer: +p.buffer, approve: p.approve === '1', days: +p.days });
  persist();
  toast('Saved.');
  render();
}
function connectionsSave(e) {
  e.preventDefault();
  const f = new FormData(e.currentTarget);
  const list = svc.connections().map((c) => ({ key: c.key, on: f.get('on-' + c.key) === 'on', url: f.get('url-' + c.key) }));
  try {
    svc.saveConnections(list);
    toast('Connections saved.');
  } catch (err) { toast(err.message); }
  render();
}

// Also used by the project page's Approvals tab and Vastu card (kept here so this module is self-contained).
export function saField(id, k, value) {
  const a = state.db.STATUTORY.find((x) => x.id === id);
  a[k] = value || null;
  delete a.fromTemplate;
  persist();
  toast('Saved.');
  if (k === 'status' || k === 'followUp') render();
}
export function saAdd(projectId, p) {
  state.db.STATUTORY.push({
    id: 'sa' + Date.now(), projectId, name: p.name.trim(), authority: p.authority.trim(), ownerId: null, submitted: null, due: null, followUp: null, status: 'todo',
  });
  persist();
  render();
}
export function saDel(id) {
  state.db.STATUTORY = state.db.STATUTORY.filter((x) => x.id !== id);
  persist();
  toast('Removed.');
  render();
}
export function vastuAdd(projectId, p) {
  const pr = state.db.PROJECTS.find((x) => x.id === projectId);
  (pr.vastu = pr.vastu || []).push({ room: p.room.trim(), note: p.note.trim() });
  persist();
  toast('Note added. Client can read it on the project page.');
  render();
}
export function vastuDel(projectId, i) {
  state.db.PROJECTS.find((x) => x.id === projectId).vastu.splice(i, 1);
  persist();
  render();
}

// ---------- small building blocks ----------
const TF = ({ label, name, value, type = 'text' }) => (
  <Field label={label}><Input name={name} type={type} defaultValue={String(value ?? '')} /></Field>
);
const AddRow = ({ onSubmit, children, btn = 'Add', className = '' }) => (
  <form className={`${inline} ${className}`} onSubmit={onSubmit}>{children}<Btn type="submit">{btn}</Btn></form>
);
const Sub = ({ children }) => <p className={sub}>{children}</p>;

// ---------- sections ----------
function Prefs() {
  const themes = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];
  const setTheme = (t) => { for (let i = 0; i < 3 && state.theme !== t; i += 1) themeToggle(); };
  return (
    <>
      <SecHead title="Preferences" sub="How the app looks and behaves for you. These are saved in this browser." />
      <div className="grid items-stretch gap-gap xl:grid-cols-2 [&>*]:min-w-0">
        <Card title="Appearance">
          <p className="mb-1.5 mt-0 text-[13px] font-semibold text-ink-2">Theme</p>
          <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Theme">
            {themes.map(([k, l]) => (
              <ToggleChip key={k} on={state.theme === k} onClick={() => setTheme(k)}>{l}</ToggleChip>
            ))}
          </div>
          <div className="flex flex-col gap-2.5">
            <Switch label="Reduce motion" sub="Fewer animations and transitions." on={!!state.motion} onClick={motionToggle} />
            <Switch label="Hide me from the optional points list" sub="Your work is still recorded. This does not change your performance score." on={!!me()?.ptsOptOut} onClick={quietToggle} />
            {staff() && <Switch label="Preview as client" sub="See the app the way a client sees it." on={!!state.previewAsClient} onClick={previewToggle} />}
          </div>
        </Card>
        <div className="flex flex-col gap-gap">
          <Card title="AI" className="flex-1">
            <div className="flex items-center justify-between gap-3 rounded-r2 bg-surface-2 px-3.5 py-2.5"><span className="text-ink-2">Provider</span><span className="font-mono text-[13px]">{AIProvider.name}</span></div>
            <p className="mb-0 mt-2.5 text-[13px] text-ink-3">Files chat messages automatically, drafts replies and summarises meetings. Swap the provider later without changing screens.</p>
          </Card>
          <Card title="Data" className="flex-1">
            <p className="mt-0 text-[13px] text-ink-3">Everything here is sample data saved in this browser. Resetting brings back the original sample records.</p>
            <Btn kind="danger" className="mt-3" onClick={resetSampleData}>Reset sample data</Btn>
          </Card>
        </div>
        <Card title="Not built yet" className="xl:col-span-2">
          <p className="mb-2.5 mt-0 text-[13px] text-ink-3">Listed so nobody looks for them.</p>
          <div className="flex flex-wrap gap-1.5">{DEFERRED.map((d) => <span key={d} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-ink-2">{d}</span>)}</div>
        </Card>
      </div>
    </>
  );
}

// Reads the chosen image, scales it down (so it fits in browser storage) and keeps it as the studio logo.
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
function logoPick(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (!LOGO_TYPES.includes(file.type)) { toast('Choose a PNG, JPG, WebP or SVG image.'); return; }
  if (file.size > 3 * 1024 * 1024) { toast('That image is over 3 MB. Choose a smaller one.'); return; }
  const reader = new FileReader();
  reader.onerror = () => toast('Could not read that file.');
  reader.onload = () => {
    const img = new Image();
    img.onerror = () => toast('That file is not a readable image.');
    img.onload = () => {
      const max = 360;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      state.db.AGENCY.logo = c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9);
      if (persist()) toast('Logo updated.'); else toast('Logo shown, but it is too large to save in this browser.');
      render();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}
function logoRemove() {
  delete state.db.AGENCY.logo;
  persist();
  toast('Logo removed.');
  render();
}

function Agency({ A }) {
  const sel = (from, to) => hours(from, to).filter((h) => h % 1 === 0).map((h) => <option key={h} value={h}>{hh(h)}</option>);
  return (
    <>
      <SecHead title="Agency" sub="Your name and colour show on every screen, the web form and WhatsApp messages." />
      <div className="grid items-start gap-gap xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <Card title="Studio details">
          <form onSubmit={submit(agencySave)}>
            <div className="grid gap-x-3 sm:grid-cols-2">
              <TF label="Agency name" name="name" value={A.name} />
              <TF label="Short name" name="short" value={A.short} />
              <TF label="WhatsApp number" name="wa" value={A.wa} />
              <TF label="Address" name="address" value={A.address} />
              <TF label="Accent colour" name="accent" value={A.accent} type="color" />
              <Field label="Background colour" hint="Adjusts itself in the dark theme. Pick the default grey to reset.">
                <Input name="background" type="color" defaultValue={A.background || DEFAULT_BG} />
              </Field>
              <div className="grid grid-cols-2 gap-x-3">
                <Field label="Office opens"><Select name="hstart" defaultValue={A.hours.start}>{sel(6, 12)}</Select></Field>
                <Field label="Office closes"><Select name="hend" defaultValue={A.hours.end}>{sel(15, 22)}</Select></Field>
              </div>
            </div>
            <Field label="Logo" hint="PNG, JPG, WebP or SVG. Shown in the top bar and the preview.">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid h-14 w-28 flex-none place-items-center overflow-hidden rounded-r2 border border-line bg-surface-2">
                  {A.logo ? <img src={A.logo} alt={`${A.short} logo`} className="max-h-12 max-w-[96px] object-contain" /> : <small className="text-ink-3">No logo</small>}
                </span>
                <label className="inline-flex min-h-9 cursor-pointer items-center rounded-r1 border border-line-2 bg-surface px-3.5 font-semibold text-accent-text hover:border-accent hover:bg-accent-soft focus-within:ring-[3px] focus-within:ring-accent-soft">
                  {A.logo ? 'Replace logo' : 'Choose file'}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={logoPick} className="sr-only" />
                </label>
                {A.logo && <Btn sm onClick={logoRemove}>Remove</Btn>}
              </div>
            </Field>
            <Btn kind="primary" type="submit">Save changes</Btn>
          </form>
        </Card>
        <Card title="How it looks">
          <div className="overflow-hidden rounded-r3 border border-line" style={{ background: 'var(--ground)' }}>
            <div className="flex items-center gap-3 bg-accent px-4 py-3 text-accent-ink">
              {A.logo ? <img src={A.logo} alt="" className="max-h-8 max-w-[140px] rounded-sm bg-white/95 p-1 object-contain" /> : <b className="font-serif text-lg uppercase tracking-[0.14em]">{A.short}</b>}
              <span className="text-xs uppercase tracking-[0.1em] opacity-70">Studio</span>
            </div>
            <div className="p-4">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.1em] text-accent-text">{A.name}</p>
              <p className="mb-3 mt-1 text-[13px] text-ink-3">{A.address}</p>
              <span className="inline-flex min-h-9 items-center rounded-r1 bg-accent px-3.5 font-semibold text-accent-ink">Primary button</span>
            </div>
          </div>
          <dl className="mb-0 mt-3 grid grid-cols-2 gap-3 text-[13px]">
            <div><dt className="text-xs text-ink-3">Office hours</dt><dd className="m-0 font-medium">{hh(A.hours.start)}–{hh(A.hours.end)}</dd></div>
            <div><dt className="text-xs text-ink-3">WhatsApp</dt><dd className="m-0 font-medium">{A.wa}</dd></div>
          </dl>
        </Card>
      </div>
    </>
  );
}

function People() {
  const roles = Object.entries(state.db.ROLES);
  const [tab, setTab] = useState('people');
  return (
    <>
      <Tabs list={[['people', 'People'], ['roles', 'Roles']]} current={tab} onSelect={setTab} />
      {tab === 'people' ? (
      <Card title="People">
        <DataTable
          cols={['Person', 'Role', 'Title']}
          rows={state.db.USERS.filter((u) => u.role !== 'contractor').map((u) => [
            u.name,
            <Select key={u.id} aria-label="Role" value={u.role} onChange={(e) => roleSet(u.id, e.target.value)}>
              {roles.map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
            </Select>,
            u.title || '',
          ])}
        />
        <h2 className={h2}>Add a person</h2>
        <form className={inline} onSubmit={submit(personAdd)}>
          <Input name="name" placeholder="Full name" required />
          <Select name="role" aria-label="Role">
            {roles.filter(([k]) => !['client', 'contractor'].includes(k)).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
          </Select>
          <Btn type="submit">Add</Btn>
        </form>
        <Sub>They get a WhatsApp invite with a login link.</Sub>
      </Card>
      ) : (
      <Card title="Roles">
        <Sub>Rename roles to match how your studio talks. Permissions per role are set up with you at onboarding.</Sub>
        <DataTable
          cols={['Role', 'Label', 'What they can do']}
          rows={roles.map(([k, r]) => [
            <span key={k} className="font-mono text-[13px]">{k}</span>,
            <form key={k + r.label} className="flex min-w-[15rem] items-center gap-2" onSubmit={(e) => { e.preventDefault(); roleLabel(k, formData(e.currentTarget)); }}>
              <Input name="label" defaultValue={r.label} aria-label="Label" className="min-w-0 flex-1" />
              <Btn sm type="submit" className="shrink-0">Save</Btn>
            </form>,
            r.desc,
          ])}
        />
      </Card>
      )}
    </>
  );
}

function Services() {
  const owners = svc.people();
  const routeVal = (r) => (r ? (r.mode === 'reject' ? 'reject' : r.mode + ':' + r.to) : '');
  const RouteSelect = ({ type, rule, label, isDefault }) => (
    <Select aria-label={label} defaultValue={routeVal(rule)} key={type + routeVal(rule)} onChange={(e) => rrSet(type, e.target.value)}>
      {!isDefault && <option value="">Use default</option>}
      <option value="pool:partner">Round robin · {state.db.ROLES.partner.label}s</option>
      <option value="pool:designer">Round robin · {state.db.ROLES.designer.label}s</option>
      {owners.map((u) => <option key={u.id} value={'person:' + u.id}>{u.name}</option>)}
      <option value="reject">Not eligible (auto-decline)</option>
    </Select>
  );
  const def = state.db.ROUTING_RULES.find((r) => r.typeId === '*');
  return (
    <Grid2>
      <Card title="Service types">
        <Sub>What a prospect picks on the enquiry form.</Sub>
        <DataTable
          cols={['Type', '']}
          rows={state.db.SERVICE_TYPES.map((t) => [t.name, <Btn key={t.id} sm onClick={() => stDel(t.id)}>Remove</Btn>])}
        />
        <AddRow onSubmit={submit(stAdd)}><Input name="name" placeholder="New type, e.g. Retail" required /></AddRow>
      </Card>
      <Card title="Who gets which enquiry">
        <Sub>Default rule applies when a type has no rule of its own.</Sub>
        <DataTable
          cols={['Type', 'Goes to']}
          rows={[
            [<b key="d">Default</b>, <RouteSelect key="ds" type="*" rule={def} label="Default routing" isDefault />],
            ...state.db.SERVICE_TYPES.map((t) => [t.name, <RouteSelect key={t.id} type={t.id} rule={state.db.ROUTING_RULES.find((r) => r.typeId === t.id)} label={`Routing for ${t.name}`} />]),
          ]}
        />
      </Card>
    </Grid2>
  );
}

function Rooms({ A }) {
  return (
    <div className="flex flex-col gap-gap">
      <Card title="Rooms and other bookable things">
        <Sub>Rooms at launch. Vehicles, equipment and desks use the same table later. With no rooms, bookings check people only.</Sub>
        <DataTable
          cols={['Name', 'Type', 'Location', 'Seats', 'Exclusive', 'Who can book', '']}
          rows={state.db.ROOMS.map((r) => [
            r.name,
            r.type || 'room',
            r.location || '',
            r.cap,
            r.exclusive === false ? 'Shared' : 'One booking at a time',
            <span key={r.id + 'w'} className="block min-w-[10rem] whitespace-normal">{(r.bookableBy || []).map((k) => state.db.ROLES[k]?.label || k).join(', ') || 'Everyone'}</span>,
            <Btn key={r.id} sm onClick={() => resDel(r.id)}>Remove</Btn>,
          ])}
        />
      </Card>
      <Card title="Add a room or resource">
        <form onSubmit={submit(resAdd)} className="grid items-end gap-x-gap gap-y-1 sm:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1.1fr_0.6fr_1.8fr_auto] [&>*]:min-w-0">
          <TF label="Name" name="name" value="" />
          <Field label="Type">
            <Select name="type"><option value="room">Room</option><option value="vehicle">Vehicle</option><option value="equipment">Equipment</option><option value="desk">Desk</option></Select>
          </Field>
          <TF label="Location" name="location" value={A.address.split(',')[0]} />
          <TF label="Seats" name="cap" value={4} type="number" />
          <Field label="Exclusive">
            <Select name="exclusive"><option value="1">One booking at a time</option><option value="0">Shared, warn on capacity</option></Select>
          </Field>
          <div className="mb-2.5"><Btn kind="primary" type="submit">Add</Btn></div>
        </form>
      </Card>
    </div>
  );
}

function Booking({ A }) {
  const later = [
    ['Google Calendar two-way sync', 'production'],
    ['Instagram DM enquiries', 'production'],
    ['AI phone answering (Vapi) enquiries', 'production'],
    ['Client self-reschedule', 'not planned, they message the studio'],
  ];
  return (
    <Grid2>
    <Card title="Booking rules">
      <form className="max-w-[520px]" onSubmit={(e) => { e.preventDefault(); bookCfg(formData(e.currentTarget)); }}>
        <Field label="Gap between client meetings">
          <Select name="buffer" defaultValue={A.booking.buffer}>{[0, 0.25, 0.5].map((v) => <option key={v} value={v}>{v ? v * 60 + ' min' : 'None'}</option>)}</Select>
        </Field>
        <Field label="Client bookings">
          <Select name="approve" defaultValue={A.booking.approve ? '1' : '0'}><option value="1">Owner confirms first</option><option value="0">Confirmed instantly</option></Select>
        </Field>
        <Field label="Clients can book up to">
          <Select name="days" defaultValue={A.booking.days}>{[7, 14, 30].map((v) => <option key={v} value={v}>{v} days ahead</option>)}</Select>
        </Field>
        <div className="mb-2.5 flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-ink-2">WhatsApp reminders</span>
          <List>{A.booking.remind.map((r) => <Item key={r}><span className="flex-1">{r}</span><small>on</small></Item>)}</List>
        </div>
        <Btn kind="primary" type="submit">Save</Btn>
      </form>
    </Card>
    <Card title="Later">
      <List>{later.map(([t, n]) => <Item key={t}><span className="flex-1">{t}</span><small>{n}</small></Item>)}</List>
    </Card>
    </Grid2>
  );
}

function Holidays() {
  return (
    <Grid2>
      <Card title="Holidays">
        <Sub>Site closed means labour does not come and the site plan skips the day. Office only means the studio is shut but the site works.</Sub>
        <DataTable
          cols={['Date', 'Holiday', 'Site closed', '']}
          rows={state.db.HOLIDAYS.map((h) => [
            fmtD(h.date),
            h.name,
            <input key={h.date} type="checkbox" defaultChecked={!!h.site} onChange={(e) => holSite(h.date, e.target.checked)} aria-label={`Site closed on ${h.name}`} />,
            <Btn key={h.date + 'd'} sm onClick={() => holDel(h.date)}>Remove</Btn>,
          ])}
        />
        <form className={inline} onSubmit={submit(holAdd)}>
          <Input name="date" type="date" required />
          <Input name="name" placeholder="Holiday name" required />
          <label className="flex items-center gap-1.5"><input name="site" type="checkbox" defaultChecked /> Site closed</label>
          <Btn type="submit">Add</Btn>
        </form>
      </Card>
      <Card title="Labour trades">
        <Sub>The hajri (attendance) sheet on the phone shows one count box per trade.</Sub>
        <List>
          {state.db.TRADES.map((t) => <Item key={t}><span className="flex-1">{t}</span><Btn sm onClick={() => tradeDel(t)}>Remove</Btn></Item>)}
        </List>
        <AddRow onSubmit={submit(tradeAdd)}><Input name="name" placeholder="New trade, e.g. Welder" required /></AddRow>
      </Card>
    </Grid2>
  );
}

function Gst({ A }) {
  const n = state.db.INVOICES.length + 1;
  return (
    <Card className="max-w-[640px]">
      <h2 className="mb-2.5 mt-0 text-lg font-semibold">GST and invoices</h2>
      <Sub>Shown on every fee invoice and in the Tally export. Same state as the client bills CGST + SGST, another state bills IGST.</Sub>
      <form className="max-w-[520px]" onSubmit={(e) => { e.preventDefault(); gstSave(formData(e.currentTarget)); }}>
        <TF label="GSTIN" name="gstin" value={A.gstin} />
        <TF label="Registered state" name="state" value={A.state} />
        <TF label="SAC code (architectural services)" name="sac" value={A.sac || '9983'} />
        <TF label="Invoice series" name="series" value={A.series} />
        <p className="text-ink-3">Next invoice number: {(A.series || '') + String(n).padStart(3, '0')}</p>
        <Btn kind="primary" type="submit">Save</Btn>
      </form>
    </Card>
  );
}

function Approvals() {
  return (
    <Card title="Approvals checklist by city">
      <Sub>{'New projects get the list for their city. "Any city" is the fallback. Edit per project on the project\'s Approvals tab.'}</Sub>
      <div className="grid gap-gap md:grid-cols-2 xl:grid-cols-3">
        {state.db.STATUTORY_TEMPLATES.map((t) => (
          <section key={t.city} className="flex min-w-0 flex-col rounded-r3 border border-line bg-surface-2 p-3.5">
            <header className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="m-0 text-base font-semibold">{t.city === '*' ? 'Any city' : t.city}</h2>
              <span className="text-xs text-ink-3">{t.items.length} {t.items.length === 1 ? 'approval' : 'approvals'}{t.city === '*' ? ' · fallback' : ''}</span>
            </header>
            <List>
              {t.items.map((it, i) => <Item key={i}><span className="flex-1">{it}</span><Btn sm onClick={() => tplDel(t.city, i)}>Remove</Btn></Item>)}
            </List>
            <div className="mt-auto pt-3">
              <AddRow onSubmit={submit((p) => tplAdd(t.city, p))}><Input name="name" placeholder="Add approval" required className="min-w-0 flex-1" /></AddRow>
            </div>
          </section>
        ))}
      </div>
      <AddRow onSubmit={submit(tplCityAdd)} btn="Add city" className="!mt-3"><Input name="city" placeholder="New city, e.g. Surat" required /></AddRow>
    </Card>
  );
}

const CONN_ICON = { google: 'caleandar', nas: 'folder', whatsapp: 'chat', canva: 'drawing', autocad: 'drawing' };
function Connections() {
  const list = svc.connections();
  return (
    <>
      <SecHead title="Connections" sub="Tools the studio already uses. Switch one on and its actions show up where the work happens." />
      <div className="mb-3.5 grid grid-cols-2 gap-gap lg:grid-cols-4">
        <Stat label="Connected" value={list.filter((c) => c.on).length} sub={`of ${list.length} tools`} tone="text-ok" />
        <Stat label="Off" value={list.filter((c) => !c.on).length} sub="not shown in the app" />
      </div>
      <form onSubmit={connectionsSave}>
        <div className="flex flex-col gap-3">
          {list.map((c) => (
            <div key={c.key} className="grid items-center gap-x-4 gap-y-2 rounded-r3 border border-line bg-surface px-4 py-3.5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_auto]">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-r2 bg-accent-soft text-accent-text"><Icon name={CONN_ICON[c.key] === 'caleandar' ? 'schedule' : CONN_ICON[c.key] || 'folder'} small /></span>
                <span className="min-w-0"><b className="block">{c.name}</b><small className="text-ink-3">{c.note}</small></span>
              </div>
              <Input name={'url-' + c.key} placeholder="https://..." defaultValue={c.url || ''} aria-label={`${c.name} address`} />
              <label className="flex items-center gap-2.5 text-[13px] font-semibold">
                <span className="relative inline-flex">
                  <input type="checkbox" name={'on-' + c.key} defaultChecked={!!c.on} className="peer sr-only" />
                  <span className="h-6 w-11 rounded-full bg-surface-3 transition peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-surface after:shadow-s1 after:transition peer-checked:after:translate-x-5" />
                </span>
                {c.on ? 'On' : 'Off'}
              </label>
            </div>
          ))}
        </div>
        <Btn kind="primary" type="submit" className="mt-3.5">Save connections</Btn>
      </form>
    </>
  );
}

function Portfolio() {
  const list = state.db.PORTFOLIO;
  const pub = list.filter((p) => p.public !== false).length;
  return (
    <>
      <SecHead title="Portfolio" sub="Choose which completed projects clients see in the Studio portfolio.">
        <Btn to={href('#/portfolio')}>View client page</Btn>
      </SecHead>
      <div className="mb-3.5 grid grid-cols-1 gap-gap sm:grid-cols-3">
        <Stat label="Projects" value={list.length} sub="in the portfolio" />
        <Stat label="Public" value={pub} sub="visible to clients" tone="text-ok" />
        <Stat label="Hidden" value={list.length - pub} sub="internal only" />
      </div>
      {list.length === 0 ? <Empty>No portfolio projects yet.</Empty> : (
        <div className="grid gap-gap sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const on = p.public !== false;
            return (
              <article key={p.id} className="flex flex-col overflow-hidden rounded-r3 border border-line bg-surface">
                <div className={on ? '' : 'opacity-60 grayscale'}><Ph hue={p.hue ?? 200} seed={p.id} ar={1.9} className="!rounded-none" /></div>
                <div className="flex flex-1 flex-col p-card">
                  <div className="flex items-start justify-between gap-2">
                    <b className="text-base">{p.name}</b>
                    <Pill kind={on ? 'ok' : ''}>{on ? 'Public' : 'Hidden'}</Pill>
                  </div>
                  <small className="mt-1 text-ink-3">{p.type} · {p.year} · {p.city}</small>
                  {p.blurb && <p className="mb-0 mt-2 text-[13px] text-ink-2">{p.blurb}</p>}
                  <div className="mt-auto pt-4"><div className="border-t border-line pt-3">
                    <Btn sm onClick={() => { svc.togglePortfolio(p.id); render(); }}>{on ? 'Hide from client app' : 'Show in client app'}</Btn>
                  </div></div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

const GROUPS = [
  ['Studio', [['agency', 'Agency'], ['people', 'People and roles'], ['services', 'Service types and routing'], ['resources', 'Rooms'], ['booking', 'Booking'], ['holidays', 'Holidays and trades']]],
  ['Money and approvals', [['gst', 'GST and invoices'], ['approvals', 'Approvals checklist']]],
  ['Integrations', [['connections', 'Connections'], ['portfolio', 'Portfolio']]],
  ['You', [['prefs', 'Preferences']]],
];
const SECTIONS = GROUPS.flatMap(([, list]) => list);
const INTRO = {
  people: 'Who is on the team and what each role is called.',
  services: 'What the studio sells and who receives each kind of enquiry.',
  resources: 'Meeting rooms and the people or equipment you can book.',
  booking: 'Meeting lengths, buffers and whether clients need approval.',
  holidays: 'Studio holidays, site shutdowns and trade names used on sites.',
  gst: 'Tax details printed on every invoice.',
  approvals: 'What must be checked before each approval is recorded.',
};

export function SettingsPage({ q }) {
  if (!can('agency', 'w')) {
    return (<><PageHeader title="Settings" sub="Your preferences." /><Prefs /></>);
  }
  const tab = SECTIONS.some(([key]) => key === q.tab) ? q.tab : 'agency';
  const A = svc.cfg();
  const wrap = (node) => (INTRO[tab] ? <><SecHead title={SECTIONS.find(([k]) => k === tab)[1]} sub={INTRO[tab]} />{node}</> : node);
  const T = {
    agency: <Agency A={A} />,
    people: wrap(<People />),
    services: wrap(<Services />),
    resources: wrap(<Rooms A={A} />),
    booking: wrap(<Booking A={A} />),
    holidays: wrap(<Holidays />),
    gst: wrap(<Gst A={A} />),
    approvals: wrap(<Approvals />),
    connections: <Connections />,
    portfolio: <Portfolio />,
    prefs: <Prefs />,
  };
  return (
    <>
      <PageHeader title="Settings" sub="Manage your studio, your tools and your preferences." />
      <div className="grid items-start gap-6 max-[820px]:grid-cols-1 min-[821px]:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="rounded-r3 border border-line bg-surface p-2.5 min-[821px]:sticky min-[821px]:top-0">
          {GROUPS.map(([group, items]) => (
            <div key={group} className="mb-2 last:mb-0">
              <p className="m-0 px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-text">{group}</p>
              {items.map(([key, label]) => (
                <DLink
                  key={key}
                  to={`#/settings?tab=${key}`}
                  aria-current={key === tab ? 'page' : undefined}
                  className={`block min-h-9 rounded-r1 px-2.5 py-2 text-[13.5px] leading-snug no-underline ${key === tab ? 'bg-accent font-semibold' : 'text-ink-2 hover:bg-surface-2'}`}
                  style={key === tab ? { color: 'var(--accent-ink)' } : undefined}
                >
                  {label}
                </DLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="min-w-0">
          {state.desk.setMsg && <Banner role="status" className="whitespace-pre-wrap">{state.desk.setMsg}</Banner>}
          {T[tab] || <Empty />}
        </div>
      </div>
    </>
  );
}
