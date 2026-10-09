import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import Icon from '../ui/Icon';
import { Page, Note, backName } from '../ui/frame';
import { Avatar } from '../ui/faces';
import {
  CanvasH2, DayBlock, Empty, Field, Filters, IconBtn, Lab, LinkText, NoteText, Primary, Row, RowCopy, SearchBox, Select, Sect, ViewCard, CardText, WarnText,
} from '../ui/libraryKit';
import { useNavigate, useParams, useSearchParams, openExternal } from '../platform/router';
import { useStyles } from '../platform/theme';
import {
  state, svc, user, me, staff, PEOPLE, viewAs, phoneOf, firstName, fmtD, TODAY, persist, render, myThreads, postMessage, can, useStore, core,
} from '../store';

const { hh } = core as any;
const db = (): any => state.db;

const ORDER = ['partner', 'site_manager', 'designer', 'hr', 'contractor', 'client'];
const LABEL: Record<string, string> = {
  partner: 'Partners', site_manager: 'Site managers', designer: 'Design team',
  hr: 'Office', contractor: 'Contractors and vendors', client: 'Clients',
};

const ChipStatus = ({ children }: { children: React.ReactNode }) => {
  const s = useStyles((c) => ({ t: { color: c.ink2, fontSize: 13, fontWeight: '700' } }));
  return <Text style={s.t}>{children}</Text>;
};

export function Who() {
  useStore();
  const navigate = useNavigate();
  return (
    <Page board back="/mobile/profile" backLabel="Profile" title="Switch person" sub="Try the field app as someone else">
      <Note>This changes whose records you see. It does not change the desktop login.</Note>
      {PEOPLE.map(({ id, hint }: any) => {
        const u = user(id);
        return (
          <Row key={id} label={u.name} onPress={() => { viewAs(id); navigate('/mobile/chats'); }}>
            <Avatar person={u} />
            <RowCopy title={u.name} sub={`${u.title} · ${hint}`} />
            {state.userId === id ? <ChipStatus>You</ChipStatus> : null}
          </Row>
        );
      })}
    </Page>
  );
}

export function People() {
  useStore();
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const employee = staff();
  const list = db().USERS.filter((u: any) => {
    if (u.id === state.userId) return false;
    if (!(`${u.name} ${u.title}`).toLowerCase().includes(query)) return false;
    if (employee) return true;
    return ['partner', 'site_manager'].includes(u.role) || svc.projects().some((p: any) => (p.teamIds || []).includes(u.id));
  });
  const groups = ORDER.map((role) => [LABEL[role], list.filter((u: any) => u.role === role)] as [string, any[]]).filter(([, us]) => us.length);
  return (
    <Page board back="/mobile/profile" backLabel="Profile" title="People" sub="Tap the phone to call" bare>
      <SearchBox value={q} onChangeText={setQ} placeholder="Search people" />
      {groups.map(([name, us]) => (
        <View key={name}>
          <Sect>{name}</Sect>
          {us.map((u: any) => {
            const vendor = db().VENDORS.find((v: any) => v.userId === u.id);
            const dm = db().THREADS.find((t: any) => t.kind === 'dm' && t.memberIds.includes(u.id) && t.memberIds.includes(state.userId));
            const phone = phoneOf(u);
            return (
              <Row key={u.id}>
                <Avatar person={u} />
                <RowCopy title={u.name} sub={`${vendor ? vendor.trade || vendor.name : u.title} · ${phone}`} />
                {dm ? <IconBtn name="chat" to={`/mobile/chats/${dm.id}`} label={`Chat with ${firstName(u.id)}`} /> : null}
                <IconBtn name="call" onPress={() => openExternal(`tel:${phone.replace(/\s/g, '')}`)} label={`Call ${firstName(u.id)}`} />
              </Row>
            );
          })}
        </View>
      ))}
      {!groups.length && <Empty title="No one matches" />}
    </Page>
  );
}

function DayRow({ date, title, detail, extra }: { date: string; title: string; detail: string; extra?: React.ReactNode }) {
  const d = new Date(`${date}T00:00:00`);
  const s = useStyles((c) => ({
    dcell: { width: 48, alignItems: 'center' },
    day: { fontSize: 18, fontWeight: '600', color: c.ink },
    mon: { color: c.ink2, fontSize: 13, fontWeight: '700' },
  }));
  return (
    <Row>
      <View style={s.dcell}><Text style={s.day}>{d.getDate()}</Text><Text style={s.mon}>{d.toLocaleDateString('en-IN', { month: 'short' })}</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <RowCopy title={title} sub={detail} />
      </View>
      {extra}
    </Row>
  );
}

export function Holidays() {
  useStore();
  const hol = (db().HOLIDAYS || []).filter((h: any) => h.date >= TODAY);
  const mine = staff() ? (db().LEAVES || []).filter((l: any) => l.userId === state.userId && l.to >= TODAY) : [];
  const pending = can('leave', 'a') ? (db().LEAVES || []).filter((l: any) => l.status === 'pending') : [];
  const team = staff() ? (db().LEAVES || []).filter((l: any) => l.userId !== state.userId && l.status === 'approved' && l.to >= TODAY).slice(0, 5) : [];
  const s = useStyles(() => ({ acts: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center' }, end: { alignItems: 'flex-end', gap: 4 } }));
  return (
    <Page board back="/mobile/profile" backLabel="Profile" title={staff() ? 'Holidays and leave' : 'Holidays'} sub="Office calendar" bare>
      {pending.length > 0 && (
        <View>
          <Sect>Leave requests</Sect>
          {pending.map((l: any) => (
            <View key={l.id} style={{ paddingHorizontal: 14 }}>
              <DayBlock
                title={`${user(l.userId).name} · ${l.days} day${l.days > 1 ? 's' : ''}`}
                lines={[`${l.type} · ${fmtD(l.from)} to ${fmtD(l.to)} · ${l.reason}`]}
              >
                <View style={s.acts}>
                  <LinkText onPress={() => { svc.decideLeave(l.id, true); render(); }}>Approve</LinkText>
                  <LinkText onPress={() => { svc.decideLeave(l.id, false); render(); }}>Decline</LinkText>
                  <LinkText to={`/mobile/standin/${l.userId}?leave=${l.id}`}>Who covers?</LinkText>
                </View>
              </DayBlock>
            </View>
          ))}
        </View>
      )}
      {staff() && (
        <View>
          <Sect>My leave</Sect>
          {mine.length ? mine.map((l: any) => (
            <DayRow
              key={l.id} date={l.from} title={`${l.type} · ${l.days} day${l.days > 1 ? 's' : ''}`}
              detail={l.from === l.to ? fmtD(l.from) : `${fmtD(l.from)} to ${fmtD(l.to)} · ${l.reason}`}
              extra={<View style={s.end}><ChipStatus>{l.status}</ChipStatus><LinkText to={`/mobile/standin/${l.userId}?leave=${l.id}`}>Who covers?</LinkText></View>}
            />
          )) : <Empty title="Nothing planned">Ask for leave in the studio chat.</Empty>}
        </View>
      )}
      <Sect>Holidays</Sect>
      {hol.map((h: any) => (
        <DayRow
          key={h.date + h.name} date={h.date} title={h.name}
          detail={`${new Date(`${h.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long' })} · ${h.site ? 'site closed, no labour' : 'office only, site works'}`}
        />
      ))}
      {team.length > 0 && (
        <View>
          <Sect>Who is away</Sect>
          {team.map((l: any) => (
            <DayRow key={l.id} date={l.from} title={firstName(l.userId)} detail={`${l.from === l.to ? fmtD(l.from) : `${fmtD(l.from)} to ${fmtD(l.to)}`} · ${l.type}`} />
          ))}
        </View>
      )}
    </Page>
  );
}

export function Punches() {
  useStore();
  const month = svc.punches();
  return (
    <Page board back="/mobile/profile" backLabel="Profile" title="Punch history" sub={`${month.days} day${month.days === 1 ? '' : 's'} · ${month.late} late · ${month.hours}h`}>
      {month.rows.map((r: any) => (
        <Row key={r.date + r.in}>
          <RowCopy title={`${fmtD(r.date)}${r.late ? ' · late' : ''}`} sub={`${r.in}–${r.out || '—'} · ${r.site}`} />
        </Row>
      ))}
      {!month.rows.length && <Empty title="No punches this month" />}
    </Page>
  );
}

export function Reviews() {
  useStore();
  const rows = svc.reviews(state.userId);
  return (
    <Page board back="/mobile/profile" backLabel="Profile" title="My reviews" sub="Monthly score, strengths and growth">
      {rows.map((r: any) => (
        <DayBlock
          key={r.id} small={`${r.month} · ${r.score}/5 · ${user(r.by).name}`} title={r.reason}
          lines={[`Strengths: ${r.strengths.join(', ')}`, `Grow: ${r.growth}`]}
        />
      ))}
      {!rows.length && <Empty title="No review for you yet" />}
    </Page>
  );
}

export function Notice() {
  useStore();
  const navigate = useNavigate();
  const ideas = ['Office closed tomorrow', 'Site visit Saturday, all hands', 'Salary credited today'];
  const [text, setText] = useState('');
  const threads = myThreads().filter(({ t }: any) => t.kind !== 'dm');
  if (state.role !== 'partner') {
    return <Page board back="/mobile/profile" backLabel="Profile" title="Notice"><Empty title="Only a partner can send a notice" /></Page>;
  }
  function send() {
    const value = text.trim();
    if (!value) return;
    threads.forEach(({ t }: any) => postMessage(t.id, { text: value, notice: true }));
    navigate('/mobile/chats');
  }
  return (
    <Page board back="/mobile/profile" backLabel="Profile" title="Notice to everyone" sub={`${threads.length} project chats`}>
      <Note>Goes to every project chat you are in, marked as a notice.</Note>
      <Filters options={ideas.map((i): [string, string] => [i, i])} value={text} onChange={setText} />
      <View style={{ gap: 10, marginTop: 12 }}>
        <Field label="Message" value={text} onChangeText={setText} multiline />
        <Primary onPress={send}>{`Send to ${threads.length} chats`}</Primary>
      </View>
    </Page>
  );
}

function ChoiceRow({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return <DayBlock title={label} lines={on ? ['Using this'] : []} onPress={onPress} pressed={on} label={label} />;
}

export function Appearance() {
  useStore();
  const options = [['system', 'Phone'], ['light', 'Light'], ['dark', 'Dark']];
  return (
    <Page board back="/mobile/profile" backLabel="Profile" title="Appearance">
      {options.map(([id, label]) => (
        <ChoiceRow key={id} label={label} on={state.theme === id} onPress={() => { state.theme = id; persist(); render(); }} />
      ))}
    </Page>
  );
}

export function Language() {
  useStore();
  const current = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('field-lang')) || 'English';
  const langs = ['English', 'हिन्दी', 'ગુજરાતી'];
  const [, setTick] = useState(current);
  return (
    <Page board back="/mobile/profile" backLabel="Profile" title="Language">
      <Note>Menus and tabs only. Write or talk in any language.</Note>
      {langs.map((lang) => (
        <ChoiceRow key={lang} label={lang} on={current === lang} onPress={() => { sessionStorage.setItem('field-lang', lang); setTick(lang); render(); }} />
      ))}
    </Page>
  );
}

function upcomingDays() {
  const days: string[] = [];
  const start = new Date(`${TODAY}T00:00:00`);
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d.getDay() === 0) continue;
    const p = (n: number) => String(n).padStart(2, '0');
    days.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
  }
  return days;
}

export function Book() {
  useStore();
  const [params] = useSearchParams();
  const from = params.get('from');
  const meet = params.get('kind') === 'meet' || state.role === 'client';
  const hours = svc.cfg().hours || { start: 9, end: 18 };
  const days = upcomingDays();
  const times: number[] = [];
  for (let h = hours.start; h < hours.end; h += 1) times.push(h);
  const people = meet
    ? db().USERS.filter((u: any) => u.role === 'partner')
    : svc.people().filter((u: any) => u.id !== state.userId);
  const sites = svc.projects();
  const [date, setDate] = useState(days[1] || days[0]);
  const [hour, setHour] = useState(11);
  const [half, setHalf] = useState(0);
  const [len, setLen] = useState(1);
  const [purpose, setPurpose] = useState('office');
  const [who, setWho] = useState(people[0]?.id || '');
  const [projectId, setProjectId] = useState(sites[0]?.id || '');
  const [title, setTitle] = useState(meet ? `${sites[0]?.name || 'Project'} · client meeting` : '');
  const [clash, setClash] = useState<any>(null);
  const [slots, setSlots] = useState<any[]>([]);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const room = db().ROOMS?.[0]?.name || 'room';

  function save() {
    setError('');
    setDone('');
    const start = hour + half;
    const row = {
      title: title.trim() || (meet ? 'Client meeting' : 'Room booking'),
      purpose,
      date,
      start,
      end: start + Number(len),
      attendees: [state.userId, who].filter(Boolean),
      clientId: meet ? state.userId : undefined,
      projectId: purpose === 'site' ? projectId : undefined,
    };
    try {
      const result = svc.book(row);
      if (result.conflict) {
        setClash(result.conflict);
        setSlots(svc.freeSlots(svc.prepBooking(row)));
        return;
      }
      setClash(null);
      setSlots([]);
      render();
      setDone(result.pending
        ? `Asked for ${fmtD(date)} ${hh(start)}. The studio will confirm.`
        : `Booked ${fmtD(date)} ${hh(start)}.`);
    } catch (err: any) {
      setError(err.message === 'forbidden' ? 'You cannot book from this login.' : err.message);
    }
  }

  if (!can('booking', 'w')) {
    return <Page board back="/mobile/today" backLabel="Today" title="Booking"><Empty title="Booking isn’t available for this login" /></Page>;
  }

  return (
    <Page
      back={from && from.startsWith('/mobile/') ? from : '/mobile/today'}
      backLabel={from && from.startsWith('/mobile/') ? backName(from) : 'Today'}
      title={meet ? 'Book a meeting' : `Book the ${room.toLowerCase()}`}
    >
      {meet && <Note>The studio confirms. You get a WhatsApp the day before and one hour before.</Note>}
      <View style={{ gap: 10, marginTop: 12 }}>
        <Lab>Day</Lab>
        <Filters options={days.map((d): [string, string] => [d, d === TODAY ? 'Today' : fmtD(d)])} value={date} onChange={setDate} />
        <Lab>Time</Lab>
        <Filters options={times.map((h): [string, string] => [String(h), hh(h)])} value={String(hour)} onChange={(v) => setHour(Number(v))} />
        <Filters options={[['0', 'On the hour'], ['0.5', 'Half past']]} value={String(half)} onChange={(v) => setHalf(Number(v))} />
        <Lab>How long</Lab>
        <Filters options={[['0.5', '30 min'], ['1', '1 hour'], ['2', '2 hours']]} value={String(Number(len))} onChange={(v) => setLen(Number(v))} />
        <Lab>{meet ? 'What kind' : 'Purpose'}</Lab>
        <Filters options={[['office', meet ? 'Come to the office' : 'Office meeting'], ['video', 'Video call'], ['site', 'Site visit']]} value={purpose} onChange={setPurpose} />
        {purpose === 'site' && sites.length > 1 && (
          <Select label="Which site" value={projectId} options={sites.map((p: any): [string, string] => [p.id, p.name])} onChange={setProjectId} />
        )}
        <Select label="With" value={who} options={people.map((u: any): [string, string] => [u.id, firstName(u.id)])} onChange={setWho} />
        {!meet && <Field label="What for" value={title} onChangeText={setTitle} placeholder="Jagwani kitchen review" />}
        {clash && (
          <ViewCard>
            <CardText strong>Not free</CardText>
            <CardText>{clash.msg}</CardText>
            {slots.length ? (
              <Filters
                options={slots.slice(0, 6).map((slot: any): [string, string] => [`${slot.date}-${slot.start}`, `${fmtD(slot.date)} ${hh(slot.start)}`])}
                value=""
                onChange={(id) => {
                  const slot = slots.slice(0, 6).find((x: any) => `${x.date}-${x.start}` === id);
                  if (!slot) return;
                  setDate(slot.date); setHour(Math.floor(slot.start)); setHalf(slot.start % 1); setLen(slot.end - slot.start); setClash(null);
                }}
              />
            ) : <CardText>Nothing free in two weeks. Message the studio.</CardText>}
          </ViewCard>
        )}
        {error ? <WarnText>{error}</WarnText> : null}
        {done ? <NoteText>{done}</NoteText> : <Primary onPress={save}>{meet ? 'Ask for this time' : 'Book'}</Primary>}
      </View>
    </Page>
  );
}

export function StandIn() {
  useStore();
  const { userId } = useParams();
  const [params] = useSearchParams();
  const leaveId = params.get('leave') || '';
  let list: any[] = [];
  try { list = svc.standIns(userId); } catch { list = []; }
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  return (
    <Page board back="/mobile/holidays" backLabel="Holidays" title={`Who can cover ${firstName(userId)}?`} sub="Present today, shares a skill, lightest load first">
      {list.length ? list.map((row) => (
        <ViewCard key={row.u.id}>
          <CardText strong>{row.u.name}</CardText>
          <CardText dim>{`${row.u.title} · ${row.load} open task${row.load === 1 ? '' : 's'} · ${row.overlap.join(', ')}`}</CardText>
          {leaveId && can('leave', 'a') && (
            <Primary onPress={() => {
              try {
                svc.reassignForLeave(leaveId, row.u.id, '');
                render();
                setNote(`Tasks reassigned to ${firstName(row.u.id)}.`);
                setError('');
              } catch (err: any) { setError(err.message === 'forbidden' ? 'You cannot reassign this leave.' : err.message); }
            }}>{`Reassign to ${firstName(row.u.id)}`}</Primary>
          )}
        </ViewCard>
      )) : <Empty title="No one qualified is in today" />}
      {note ? <NoteText>{note}</NoteText> : null}
      {error ? <WarnText>{error}</WarnText> : null}
      {!can('leave', 'a') && <Note>A partner or HR names the cover and moves the open tasks.</Note>}
    </Page>
  );
}

export { me };
