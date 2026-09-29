import {
  state, svc, can, persist, toast, render, hh, fmtD, uid, AIProvider,
} from '../../shared/core.js';
import { ROLES } from '../../shared/data.js';
import { DEFERRED } from '../data';
import {
  Btn, Card, Grid2, Grid3, Input, Select, Field, PageHeader, List, Item, DataTable, Empty,
} from '../../ui/ui';
import { DLink } from '../nav';
import { staff } from '../helpers';
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
export const quietToggle = () => { state.gamify.optOut = !state.gamify.optOut; persist(); render(); };
export const previewToggle = () => togglePreviewAsClient();

function agencySave(p) {
  Object.assign(state.db.AGENCY, {
    name: p.name, short: p.short, accent: p.accent, wa: p.wa, address: p.address, hours: { start: +p.hstart, end: +p.hend },
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
  return (
    <>
      <Card>
        <h2 className="mb-2.5 mt-0 text-lg font-semibold">Appearance</h2>
        <List>
          <Item><span className="flex-1">Theme</span><Btn sm onClick={themeToggle}>{state.theme}, click to change</Btn></Item>
          <Item><span className="flex-1">Reduce motion</span><Btn sm onClick={motionToggle}>{state.motion ? 'On' : 'Off'}</Btn></Item>
          <Item><span className="flex-1">Quiet mode (no points or badges)</span><Btn sm onClick={quietToggle}>{state.gamify.optOut ? 'On' : 'Off'}</Btn></Item>
          {staff() && <Item><span className="flex-1">Preview as client</span><Btn sm onClick={previewToggle}>{state.previewAsClient ? 'On' : 'Off'}</Btn></Item>}
        </List>
        <h2 className={h2}>AI</h2>
        <List>
          <Item><span className="flex-1">Provider</span><span className="font-mono text-[13px]">{AIProvider.name}</span></Item>
          <Item><span className="flex-1">Files chat messages automatically, drafts replies, summarises meetings. Swap provider later without changing screens.</span></Item>
        </List>
      </Card>
      <Card className="mt-3.5">
        <h2 className="mb-2.5 mt-0 text-lg font-semibold">Data</h2>
        <List>
          <Item><span className="flex-1">Everything here is sample data saved in this browser.</span><Btn sm kind="danger" onClick={resetSampleData}>Reset data</Btn></Item>
        </List>
        <h2 className={h2}>Deferred</h2>
        <Sub>Listed so nobody looks for them. Not built in this prototype.</Sub>
        <List>{DEFERRED.map((d) => <Item key={d}><span className="flex-1">{d}</span><small>later</small></Item>)}</List>
      </Card>
    </>
  );
}

function Agency({ A }) {
  const sel = (from, to) => hours(from, to).filter((h) => h % 1 === 0).map((h) => <option key={h} value={h}>{hh(h)}</option>);
  return (
    <Card className="max-w-[640px]">
      <h2 className="mb-2.5 mt-0 text-lg font-semibold">Agency</h2>
      <Sub>Your name and colour show on every screen, the web form and WhatsApp messages.</Sub>
      <form className="max-w-[520px]" onSubmit={submit(agencySave)}>
        <TF label="Agency name" name="name" value={A.name} />
        <TF label="Short name" name="short" value={A.short} />
        <Grid3>
          <TF label="Accent colour" name="accent" value={A.accent} type="color" />
          <Field label="Office opens"><Select name="hstart" defaultValue={A.hours.start}>{sel(6, 12)}</Select></Field>
          <Field label="Office closes"><Select name="hend" defaultValue={A.hours.end}>{sel(15, 22)}</Select></Field>
        </Grid3>
        <TF label="WhatsApp number" name="wa" value={A.wa} />
        <TF label="Address" name="address" value={A.address} />
        <Field label="Logo" hint="Upload comes with the real build."><Input type="file" disabled /></Field>
        <Btn kind="primary" type="submit">Save</Btn>
      </form>
    </Card>
  );
}

function People() {
  const roles = Object.entries(state.db.ROLES);
  return (
    <Grid2>
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
      <Card title="Roles">
        <Sub>Rename roles to match how your studio talks. Permissions per role are set up with you at onboarding.</Sub>
        <DataTable
          cols={['Role', 'Label', 'What they can do']}
          rows={roles.map(([k, r]) => [
            <span key={k} className="font-mono text-[13px]">{k}</span>,
            <form key={k + r.label} className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); roleLabel(k, formData(e.currentTarget)); }}>
              <Input name="label" defaultValue={r.label} aria-label="Label" />
              <Btn sm type="submit">Save</Btn>
            </form>,
            r.desc,
          ])}
        />
      </Card>
    </Grid2>
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
    <Card>
      <h2 className="mb-2.5 mt-0 text-lg font-semibold">Rooms and other bookable things</h2>
      <Sub>Rooms at launch. Vehicles, equipment and desks use the same table later. With no rooms, bookings check people only.</Sub>
      <DataTable
        cols={['Name', 'Type', 'Location', 'Seats', 'Exclusive', 'Who can book', '']}
        rows={state.db.ROOMS.map((r) => [
          r.name,
          r.type || 'room',
          r.location || '',
          r.cap,
          r.exclusive === false ? 'Shared' : 'One booking at a time',
          (r.bookableBy || []).map((k) => state.db.ROLES[k]?.label || k).join(', ') || 'Everyone',
          <Btn key={r.id} sm onClick={() => resDel(r.id)}>Remove</Btn>,
        ])}
      />
      <h2 className={h2}>Add</h2>
      <form onSubmit={submit(resAdd)}>
        <Grid3>
          <TF label="Name" name="name" value="" />
          <Field label="Type">
            <Select name="type"><option value="room">Room</option><option value="vehicle">Vehicle</option><option value="equipment">Equipment</option><option value="desk">Desk</option></Select>
          </Field>
          <TF label="Location" name="location" value={A.address.split(',')[0]} />
          <TF label="Seats" name="cap" value={4} type="number" />
          <Field label="Exclusive">
            <Select name="exclusive"><option value="1">One booking at a time</option><option value="0">Shared, warn on capacity</option></Select>
          </Field>
          <div className="flex items-center"><Btn kind="primary" type="submit">Add</Btn></div>
        </Grid3>
      </form>
    </Card>
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
    <Card className="max-w-[640px]">
      <h2 className="mb-2.5 mt-0 text-lg font-semibold">Booking rules</h2>
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
      <h2 className={h2}>Later</h2>
      <List>{later.map(([t, n]) => <Item key={t}><span className="flex-1">{t}</span><small>{n}</small></Item>)}</List>
    </Card>
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
      <Grid2>
        {state.db.STATUTORY_TEMPLATES.map((t) => (
          <div key={t.city}>
            <h2 className="mb-2.5 mt-0 text-lg font-semibold">{t.city === '*' ? 'Any city' : t.city}</h2>
            <List>
              {t.items.map((it, i) => <Item key={i}><span className="flex-1">{it}</span><Btn sm onClick={() => tplDel(t.city, i)}>Remove</Btn></Item>)}
            </List>
            <AddRow onSubmit={submit((p) => tplAdd(t.city, p))}><Input name="name" placeholder="Add approval" required /></AddRow>
          </div>
        ))}
      </Grid2>
      <AddRow onSubmit={submit(tplCityAdd)} btn="Add city" className="!mt-3"><Input name="city" placeholder="New city, e.g. Surat" required /></AddRow>
    </Card>
  );
}

function Connections() {
  return (
    <Card title="Connections">
      <Sub>Tools the studio already uses. Switching one on shows its actions where the work happens: Meet and Calendar on meetings, Drive and NAS on project Files, WhatsApp on share links and client updates, Canva on the project overview, AutoCAD Web on the drawing index.</Sub>
      <form onSubmit={connectionsSave}>
        <div className="flex flex-col gap-1.5">
          {svc.connections().map((c) => (
            <div key={c.key} className="flex flex-wrap items-center gap-2.5">
              <label className="flex items-center gap-1.5"><input type="checkbox" name={'on-' + c.key} defaultChecked={!!c.on} /> <b>{c.name}</b></label>
              <Input name={'url-' + c.key} placeholder="https://..." defaultValue={c.url || ''} />
              <span className="text-ink-3">{c.note}</span>
            </div>
          ))}
        </div>
        <Btn kind="primary" type="submit" className="mt-3">Save</Btn>
      </form>
    </Card>
  );
}

function Portfolio() {
  return (
    <Card title="Portfolio">
      <Sub>Completed projects shown in the client app&apos;s Studio portfolio.</Sub>
      <List empty="No portfolio projects yet.">
        {state.db.PORTFOLIO.map((p) => (
          <Item key={p.id}>
            <span className="min-w-0 flex-1"><b>{p.name}</b><br /><small className="text-ink-3">{p.type} · {p.year} · {p.city}</small></span>
            <Btn sm onClick={() => { svc.togglePortfolio(p.id); render(); }}>{p.public === false ? 'Show in client app' : 'Hide from client app'}</Btn>
          </Item>
        ))}
      </List>
    </Card>
  );
}

const SECTIONS = [
  ['agency', 'Agency'], ['people', 'People and roles'], ['services', 'Service types and routing'], ['resources', 'Rooms'],
  ['booking', 'Booking'], ['holidays', 'Holidays and trades'], ['gst', 'GST and invoices'], ['approvals', 'Approvals checklist'],
  ['connections', 'Connections'], ['portfolio', 'Portfolio'], ['prefs', 'Preferences'],
];

export function SettingsPage({ q }) {
  if (!can('agency', 'w')) {
    return (<><PageHeader title="Settings" /><Grid2><Prefs /></Grid2></>);
  }
  const tab = SECTIONS.some(([key]) => key === q.tab) ? q.tab : 'agency';
  const A = svc.cfg();
  const T = {
    agency: <Agency A={A} />,
    people: <People />,
    services: <Services />,
    resources: <Rooms A={A} />,
    booking: <Booking A={A} />,
    holidays: <Holidays />,
    gst: <Gst A={A} />,
    approvals: <Approvals />,
    connections: <Connections />,
    portfolio: <Portfolio />,
    prefs: <Grid2><Prefs /></Grid2>,
  };
  return (
    <>
      <PageHeader title="Settings" sub="Manage your studio and your preferences." />
      <div className="grid items-start gap-6 max-[620px]:grid-cols-1 min-[621px]:grid-cols-[minmax(150px,210px)_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="grid gap-1 max-[620px]:flex max-[620px]:overflow-x-auto min-[621px]:sticky min-[621px]:top-0">
          {SECTIONS.map(([key, label]) => (
            <DLink
              key={key}
              to={`#/settings?tab=${key}`}
              aria-current={key === tab ? 'page' : undefined}
              className={`min-h-10 rounded-md px-3 py-2.5 leading-snug no-underline hover:bg-surface-2 ${key === tab ? 'bg-accent-soft font-semibold text-accent-text' : 'text-ink-2'}`}
              style={key === tab ? { color: 'var(--accent-text)' } : undefined}
            >
              {label}
            </DLink>
          ))}
        </nav>
        <div className="min-w-0">
          {state.desk.setMsg && <div role="status" className="mb-3.5 whitespace-pre-wrap rounded-r2 bg-accent-soft px-3.5 py-3">{state.desk.setMsg}</div>}
          {T[tab] || <Empty />}
        </div>
      </div>
    </>
  );
}
