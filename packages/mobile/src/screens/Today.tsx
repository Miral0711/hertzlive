import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from '../ui/Icon';
import { Screen, TopBar } from '../ui/frame';
import { useField } from '../ui/FieldContext';
import { Avatar } from '../ui/faces';
import { ActBtn, Acts, DayRow, Fold, Small, Strong, Sub } from '../ui/DayRows';
import { Link, openExternal, useLocation, useNavigate } from '../platform/router';
import { useStyles } from '../platform/theme';
import {
  fmtD, fmtT, myThreads, me, firstName, projectName, onPhone, stamp, waitingItems,
  svc, state as rawState, can, user, render, TODAY, phoneOf, postMessage, threadTitle, useStore, t, core,
} from '../store';
import { ANNOUNCEMENTS } from '../../../frontend/src/desktop/data';

const { hh, inr, persist, AIProvider } = core as any;
const state: any = rawState;

const nowHours = () => {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
};

const placeOf = (b: any) => {
  const room = (state.db.ROOMS || []).find((r: any) => r.id === b.roomId)?.name;
  if (room) return room;
  if (b.kind === 'travel') return 'Out of the office';
  return ({ client: 'Client meeting', review: 'Studio review', focus: 'Focus time' } as any)[b.kind] || 'Studio';
};

function nextSentence(meetings: any[]) {
  const now = nowHours();
  const current = meetings.find((b) => now >= b.start && now < b.end);
  if (current) return `Now · ${current.title} · ${placeOf(current)}`;
  const upcoming = meetings.find((b) => b.start > now);
  if (!upcoming) return meetings.length ? 'Nothing else on your calendar today' : '';
  const mins = Math.max(1, Math.round((upcoming.start - now) * 60));
  const when = mins < 90 ? `in ${mins} min` : `at ${hh(upcoming.start)}`;
  return `Next · ${upcoming.title} ${when} · ${placeOf(upcoming)}`;
}

const involved = (b: any) => b.clientId === state.userId || (b.attendees || []).includes(state.userId) || b.by === state.userId;

function threadForIssue(issue: any) {
  return state.db.THREADS.find((th: any) => th.kind === 'site' && th.siteId === issue.siteId && (th.memberIds || []).includes(state.userId))
    || state.db.THREADS.find((th: any) => th.projectId === issue.projectId && th.kind === 'internal');
}

function liveSites(): any[] {
  return svc.sites().filter((site: any) => onPhone(site.projectId) && site.progress < 100);
}

function buildToday(day: string) {
  const role = state.role;
  const actions: any[] = [];
  const waiting: any[] = [];
  if (can('leave', 'a')) {
    svc.leaves({ status: 'pending' }).forEach((leave: any) => actions.push({ key: `leave-${leave.id}`, kind: 'leave', leave }));
  }
  if (role === 'client') {
    svc.materials().filter((m: any) => m.status === 'client_pending').forEach((material: any) => {
      actions.push({ key: `mat-${material.id}`, kind: 'material', material });
    });
    (state.db.CHANGES || []).filter((c: any) => c.status === 'awaiting_client' && onPhone(c.projectId)).forEach((change: any) => {
      actions.push({ key: `chg-${change.id}`, kind: 'change', change });
    });
  }
  (state.db.TASKS || []).filter((task: any) => task.status === 'open' && task.owner === state.userId && onPhone(task.projectId)).forEach((task: any) => {
    actions.push({ key: `task-${task.id}`, kind: 'task', task });
  });
  if (role === 'site_manager' && liveSites().length) actions.push({ key: 'sites', kind: 'sites' });
  if (role === 'site_manager' || role === 'contractor') {
    liveSites().forEach((site) => {
      svc.snags(site.id).filter((n: any) => n.status !== 'closed').slice(0, 1).forEach((snag: any) => {
        actions.push({ key: `snag-${snag.id}`, kind: 'snag', snag, site });
      });
    });
  }
  svc.myEnquiries().forEach((enquiry: any) => actions.push({ key: `enq-${enquiry.id}`, kind: 'enquiry', enquiry }));
  if (can('booking', 'a')) {
    svc.pendingBookings().forEach((booking: any) => actions.push({ key: `book-${booking.id}`, kind: 'booking', booking }));
  }
  const openIssues = svc.issues().filter((issue: any) => issue.status !== 'closed' && onPhone(issue.projectId));
  if (role === 'designer' || role === 'partner') {
    openIssues.filter((issue: any) => issue.assignee === state.userId).forEach((issue: any) => {
      const detail = svc.siteIssueDetails(issue.id);
      if (detail?.canAnswer && detail.needsAnswer) actions.push({ key: `work-${issue.id}`, kind: 'sitework', issue, label: 'Site needs an answer' });
      else actions.push({ key: `issue-${issue.id}`, kind: 'issue', issue });
    });
  }
  if (role === 'site_manager' || role === 'contractor') {
    openIssues.filter((issue: any) => issue.raisedBy === state.userId && svc.mySiteIds().includes(issue.siteId)).forEach((issue: any) => {
      const detail = svc.siteIssueDetails(issue.id);
      const who = detail?.sources.length
        ? (detail.needsAnswer ? 'Awaiting office response' : 'Awaiting resolution')
        : (issue.assignee ? `Waiting on ${firstName(issue.assignee)}` : 'Awaiting office response');
      waiting.push({ key: `wait-${issue.id}`, issue, who });
    });
  }
  svc.followups().filter((f: any) => (f.at || '') <= `${day}T23:59` && f.msg?.text).forEach((followup: any) => {
    actions.push({ key: `fu-${followup.id}`, kind: 'followup', followup });
  });
  if (role === 'partner') {
    svc.decisionsDue().filter((d: any) => d.late && onPhone(d.projectId)).forEach((decision: any) => {
      actions.push({ key: `dec-${decision.id}`, kind: 'decision', decision });
    });
    (state.db.INVOICES || []).filter((inv: any) => inv.status === 'overdue' && onPhone(inv.projectId)).forEach((invoice: any) => {
      actions.push({ key: `inv-${invoice.id}`, kind: 'invoice', invoice });
    });
    (state.db.HOLIDAYS || []).filter((h: any) => !h.pushed && h.date >= day && (new Date(h.date).getTime() - new Date(day).getTime()) / 864e5 <= 14).forEach((holiday: any) => {
      actions.push({ key: `hol-${holiday.date}`, kind: 'holiday', holiday });
    });
    const quiet = liveSites().map((site) => {
      const last = svc.feed(site.id).filter((f: any) => f.type === 'photo').map((f: any) => f.at).sort().pop();
      const age = last ? Math.round((new Date(`${day}T00:00`).getTime() - new Date(`${last.slice(0, 10)}T00:00`).getTime()) / 864e5) : 99;
      return { site, age };
    }).filter((row) => row.age >= 3).sort((a, b) => b.age - a.age)[0];
    if (quiet) actions.push({ key: `quiet-${quiet.site.id}`, kind: 'quiet', site: quiet.site, age: quiet.age });
  }
  if (role === 'designer') {
    const drawing = svc.projects().flatMap((p: any) => (p.drawings || [])
      .filter((d: any) => d.by === state.userId && d.status !== 'Issued for construction')
      .map((d: any) => ({ ...d, projectId: p.id, project: p.name })))[0];
    if (drawing) actions.push({ key: `drw-${drawing.no}`, kind: 'drawing', drawing });
  }
  if (role === 'client') {
    const project = svc.projects()[0];
    const next = project?.milestones?.find((m: any) => !m.done && m.clientVisible);
    if (next) actions.push({ key: `mile-${project.id}`, kind: 'milestone', project, next });
  }
  return { actions, waiting };
}

function DayCard({ item, act, first }: { item: any; act: (name: string, a?: any, b?: any) => void; first?: boolean }) {
  const s = useStyles((c) => ({
    li: { color: c.ink, fontSize: 13, lineHeight: 18, marginVertical: 2 },
  }));
  const D = (p: any) => <DayRow {...p} first={first} />;
  if (item.kind === 'leave') {
    const { leave } = item;
    return (
      <D
        left={<><Small>Leave request</Small><Strong>{user(leave.userId).name} · {leave.days} day{leave.days === 1 ? '' : 's'}</Strong>
          <Sub>{leave.type} · {fmtD(leave.from)} to {fmtD(leave.to)}{leave.reason ? ` · ${leave.reason}` : ''}</Sub></>}
        acts={<Acts>
          <ActBtn label="Approve" onPress={() => act('leave', leave.id, true)} />
          <ActBtn label="Decline" quiet onPress={() => act('leave', leave.id, false)} />
          <ActBtn label="Who covers?" quiet to={`/mobile/standin/${leave.userId}?leave=${leave.id}`} />
        </Acts>}
      />
    );
  }
  if (item.kind === 'material') {
    const { material } = item;
    return (
      <D
        left={<><Small>Your approval</Small><Strong>{material.name}</Strong>
          <Sub>{[material.vendor, projectName(material.projectId)].filter(Boolean).join(' · ')}</Sub></>}
        acts={<Acts>
          <ActBtn label="Approve" onPress={() => act('material', material.id, true)} />
          <ActBtn label="Not this one" quiet onPress={() => act('material', material.id, false)} />
          <ActBtn label="Ask" quiet to={`/mobile/assist?kind=ask&q=${encodeURIComponent(`Tell me more about the ${material.name}`)}`} />
        </Acts>}
      />
    );
  }
  if (item.kind === 'change') {
    const { change } = item;
    return (
      <D
        left={<><Small>Your approval · {change.no}</Small><Strong>{change.title}</Strong><Sub>{change.reason}</Sub>
          <Sub>{inr(change.cost)} extra · {change.days} day{change.days === 1 ? '' : 's'}</Sub></>}
        acts={<Acts>
          <ActBtn label="Approve" onPress={() => act('change', change.id, true)} />
          <ActBtn label="Decline" quiet onPress={() => act('change', change.id, false)} />
        </Acts>}
      />
    );
  }
  if (item.kind === 'task') {
    const { task } = item;
    return (
      <D
        left={<><Small>{task.from ? `Asked by ${firstName(task.from)}` : 'Assigned to you'}</Small><Strong>{task.title}</Strong>
          <Sub>{projectName(task.projectId)}{task.due ? ` · by ${fmtD(task.due)}` : ''}</Sub></>}
        acts={<Acts>
          <ActBtn label="Done" onPress={() => act('task', task.id)} />
          <ActBtn label="Open project" quiet to={`/mobile/projects/${task.projectId}`} />
        </Acts>}
      />
    );
  }
  if (item.kind === 'snag') {
    return (
      <D to={`/mobile/projects/${item.site.projectId}`}
        left={<><Small>{state.role === 'contractor' ? 'Your snag' : 'Open snag'}</Small><Strong>{item.snag.text}</Strong><Sub>{item.site.name}</Sub></>}
      />
    );
  }
  if (item.kind === 'sites') {
    return (
      <D
        left={<>
          <Small>Your sites today</Small>
          <View style={{ marginTop: 4, paddingLeft: 4 }}>
            {liveSites().map((site) => {
              const open = (state.db.ISSUES || []).filter((i: any) => i.siteId === site.id && i.status === 'open').length;
              const log = svc.feed(site.id).find((f: any) => /Daily log/.test(f.text || ''));
              const workers = log ? (log.text.match(/(\d+) workers/) || [])[1] : null;
              return (
                <Text key={site.id} style={s.li}>
                  {'•  '}<Text style={{ fontWeight: '600' }}>{projectName(site.projectId)}</Text>
                  {' · '}{open ? `${open} open` : 'no issues'}
                  {' · '}{workers ? `${workers} workers logged` : 'no log yet'}
                </Text>
              );
            })}
          </View>
          <Sub>Presence comes from your photos. Guard check is due at 18:00.</Sub>
          <View style={{ alignItems: 'flex-end' }}><ActBtn label="Guard check done" quiet onPress={() => act('guard')} /></View>
        </>}
      />
    );
  }
  if (item.kind === 'enquiry') {
    const { enquiry } = item;
    const phone = (enquiry.phone || '').replace(/\D/g, '');
    return (
      <D
        left={<><Small>New enquiry{enquiry.source ? ` · ${enquiry.source}` : ''}</Small>
          <Strong>{enquiry.name} · {svc.serviceType(enquiry.typeId)}</Strong>
          <Sub>{[enquiry.city, enquiry.msg].filter(Boolean).join(' · ')}</Sub></>}
        acts={<Acts>
          <ActBtn label="Accept" onPress={() => act('enquiry', enquiry.id, 'accepted')} />
          <ActBtn label="Not eligible" quiet onPress={() => act('enquiry', enquiry.id, 'not_eligible')} />
          {phone ? <ActBtn label="WhatsApp" quiet onPress={() => openExternal(`https://wa.me/${phone}`)} /> : null}
        </Acts>}
      />
    );
  }
  if (item.kind === 'booking') {
    const { booking } = item;
    const withWhom = (booking.attendees || []).filter((id: string) => id !== booking.clientId).map((id: string) => firstName(id)).join(', ');
    return (
      <D
        left={<><Small>Client wants to meet</Small>
          <Strong>{user(booking.clientId || booking.by).name} · {fmtD(booking.date)} {hh(booking.start)}</Strong>
          <Sub>{booking.title}{withWhom ? ` · with ${withWhom}` : ''}</Sub></>}
        acts={<Acts>
          <ActBtn label="Confirm" onPress={() => act('booking', booking.id, true)} />
          <ActBtn label="Decline" quiet onPress={() => act('booking', booking.id, false)} />
        </Acts>}
      />
    );
  }
  if (item.kind === 'issue' || item.kind === 'sitework') {
    const { issue } = item;
    const thread = threadForIssue(issue);
    return (
      <D
        left={<><Small>{item.label || `Site needs your answer${issue.due ? ` · reply by ${fmtD(issue.due)}` : ''}`}</Small>
          <Strong>{issue.title}</Strong>
          <Sub>{[issue.type, issue.drawing, issue.raisedBy ? `raised by ${firstName(issue.raisedBy)}` : ''].filter(Boolean).join(' · ')}</Sub></>}
        acts={<Acts>
          {thread ? <ActBtn label="Reply" to={`/mobile/chats/${thread.id}`} /> : <ActBtn label="Open" to={`/mobile/issues/${issue.id}`} />}
          {item.kind === 'issue' ? <ActBtn label="Mark answered" quiet onPress={() => act('close', issue.id)} /> : null}
        </Acts>}
      />
    );
  }
  if (item.kind === 'followup') {
    const message = item.followup.msg;
    return (
      <D
        left={<><Small>Reminder</Small><Strong>{message?.text || 'Message'}</Strong></>}
        acts={<Acts>
          {message ? <ActBtn label="Open" to={`/mobile/chats/${message.threadId}#${message.id}`} /> : null}
          <ActBtn label="Done" quiet onPress={() => act('followup', item.followup.id)} />
        </Acts>}
      />
    );
  }
  if (item.kind === 'decision') {
    const { decision } = item;
    return (
      <D
        left={<><Small>Client decision overdue</Small><Strong>{decision.title}</Strong><Sub>{projectName(decision.projectId)} · due {fmtD(decision.due)}</Sub></>}
        acts={<Acts><ActBtn label="Nudge client" onPress={() => act('nudge', decision)} /></Acts>}
      />
    );
  }
  if (item.kind === 'invoice') {
    const { invoice } = item;
    return (
      <D
        left={<><Small>Payment overdue</Small><Strong>Invoice {invoice.no} · {inr(invoice.amount)}</Strong><Sub>{projectName(invoice.projectId)}</Sub></>}
        acts={<Acts><ActBtn label="Draft reminder" onPress={() => act('invoice', invoice)} /></Acts>}
      />
    );
  }
  if (item.kind === 'holiday') {
    const { holiday } = item;
    return (
      <D
        left={<><Small>Holiday</Small><Strong>{holiday.name} · {fmtD(holiday.date)}</Strong><Sub>Tell every site so labour and deliveries are planned.</Sub></>}
        acts={<Acts><ActBtn label="Tell site groups" onPress={() => act('holiday', holiday.date)} /></Acts>}
      />
    );
  }
  if (item.kind === 'quiet') {
    return (
      <D to={`/mobile/projects/${item.site.projectId}`}
        left={<><Small>No recent photo</Small><Strong>{item.site.name}</Strong>
          <Sub>{item.age > 30 ? 'No site photo yet' : `Nothing from site for ${item.age} days`}</Sub></>}
      />
    );
  }
  if (item.kind === 'drawing') {
    const { drawing } = item;
    return (
      <D to={`/mobile/projects/${drawing.projectId}/drawings`}
        left={<><Small>{drawing.status}</Small><Strong>{drawing.name}</Strong><Sub>{drawing.project} · {drawing.no}</Sub></>}
      />
    );
  }
  if (item.kind === 'milestone') {
    return (
      <D to={`/mobile/projects/${item.project.id}`}
        left={<><Small>Next milestone</Small><Strong>{item.next.name}</Strong><Sub>{item.project.name} · {fmtD(item.next.date)}</Sub></>}
      />
    );
  }
  return null;
}

export default function Today() {
  useStore();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { read, setDraft } = useField();
  const [snagOpen, setSnagOpen] = useState(false);
  const [snag, setSnag] = useState('');
  const [ask, setAsk] = useState('');
  const [note, setNote] = useState('');
  const [shared, setShared] = useState<Record<string, boolean>>({});
  const person = me();
  const day = TODAY || stamp().slice(0, 10);
  const built = buildToday(day);
  const actions = built.actions.filter((item) => item.kind !== 'checkin');
  const laterKinds = new Set(state.role === 'hr' ? ['enquiry', 'holiday', 'followup'] : ['leave', 'enquiry', 'holiday', 'followup']);
  const rank: Record<string, number> = { task: 1, issue: 2, sitework: 2, drawing: 2, sites: 3, snag: 3, material: 4, change: 4, decision: 5, invoice: 6, booking: 7, milestone: 8, quiet: 9, leave: 1, enquiry: 2, holiday: 3, followup: 4 };
  const byRank = (a: any, b: any) => (rank[a.kind] || 9) - (rank[b.kind] || 9);
  const nowItems = actions.filter((item) => !laterKinds.has(item.kind)).sort(byRank);
  const laterItems = actions.filter((item) => laterKinds.has(item.kind)).sort(byRank);
  const leaves = laterItems.filter((item) => item.kind === 'leave');
  const enquiries = laterItems.filter((item) => item.kind === 'enquiry');
  const opened = (hash || '').slice(1);
  const holidays = laterItems.filter((item) => item.kind === 'holiday');
  const reminders = laterItems.filter((item) => item.kind === 'followup');
  const waiting = (['site_manager', 'contractor'].includes(state.role) || built.waiting.length)
    ? built.waiting
    : waitingItems().map((item: any) => ({ key: item.key, issue: { id: item.issueId, title: item.title }, who: item.meta }));
  const siteThreads = myThreads().filter(({ t: th }: any) => th.kind === 'site');
  const site: any = siteThreads[0];
  const canSnag = ['site_manager', 'contractor'].includes(state.role) && site;
  const onSite = ['partner', 'designer', 'site_manager', 'contractor'].includes(state.role);
  const meetings = (state.db.BOOKINGS || []).filter((b: any) => b.date >= day && b.status !== 'declined' && involved(b))
    .sort((a: any, b: any) => a.date.localeCompare(b.date) || a.start - b.start);
  const todayMeetings = meetings.filter((b: any) => b.date === day);
  const ahead = nextSentence(todayMeetings);
  const away = [...new Set(svc.projects().flatMap((p: any) => svc.away(day, p.id)).filter((a: any) => a.userId).map((a: any) => user(a.userId)?.name).filter(Boolean))] as string[];
  const live = liveSites()[0];
  const reportTo = live ? `/mobile/projects/${live.projectId}/assist?kind=daily&site=${live.id}` : '/mobile/assist?kind=daily';
  const postTo = siteThreads.length === 1 ? `/mobile/camera?thread=${site.t.id}` : '/mobile/camera';
  const lastId = Object.entries(read || {}).sort((a, b) => (b[1] as string).localeCompare(a[1] as string))[0]?.[0];
  const lastThread = lastId ? svc.thread(lastId) : null;
  const notice = (ANNOUNCEMENTS as any[]).find((a) => a.pinned) || (ANNOUNCEMENTS as any[])[0];
  const siteToday = onSite
    ? svc.sites().flatMap((st: any) => svc.feed(st.id).map((f: any) => ({ ...f, site: st })))
      .filter((f: any) => (f.at || '').startsWith(day))
      .sort((a: any, b: any) => b.at.localeCompare(a.at))
      .slice(0, 3)
    : [];
  const weekly = state.role === 'partner'
    ? svc.projects().filter((p: any) => p.status !== 'finished' && (state.db.SITES || []).some((st: any) => st.projectId === p.id && onPhone(p.id)))
    : [];
  const chain = state.role === 'site_manager' ? svc.materials().filter((m: any) => onPhone(m.projectId)).slice(0, 4) : [];
  const bookKind = state.role === 'client' ? 'meet' : 'room';
  const canBook = can('booking', 'w') && state.role !== 'contractor';
  const askChips = [
    "What's pending?",
    svc.projects()[0] ? `What's pending on ${svc.projects()[0].name}?` : '',
    'When is the next milestone?',
  ].filter(Boolean);
  const now = nowHours();
  const currentMeeting = todayMeetings.find((b: any) => now >= b.start && now < b.end);
  const focus = currentMeeting || todayMeetings.find((b: any) => b.start > now);

  const s = useStyles((c, th) => ({
    h1: { fontSize: 22, fontWeight: '600', color: c.ink, lineHeight: 24 },
    h1sub: { fontSize: 13, fontWeight: '500', color: c.ink3 },
    body: { flex: 1, backgroundColor: c.ground },
    content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 28 },
    now: { marginBottom: 10, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
    nowCard: { marginVertical: 8, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
    nowH: { fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }), fontSize: 26, fontWeight: '500', letterSpacing: -0.78, lineHeight: 30, color: c.ink },
    nowP: { marginTop: 6, color: c.ink2, fontSize: 14 },
    banner: { color: c.ink3, fontSize: 12, fontWeight: '500', textAlign: 'center', paddingTop: 4, paddingBottom: 8 },
    note: { color: c.ink2, fontSize: 14, fontWeight: '500', paddingVertical: 8 },
    toolNote: { color: c.ink2, fontSize: 13, fontWeight: '500', lineHeight: 18, paddingTop: 12, paddingBottom: 4 },
    clear: { marginVertical: 8, padding: 16, borderRadius: 16, backgroundColor: c.okSoft },
    clearH: { fontSize: 15, fontWeight: '600', color: c.ink, marginBottom: 4 },
    clearA: { color: c.accentText, fontSize: 13, fontWeight: '700' },
    menu: { marginTop: 4, gap: 0 },
    quietRow: { minHeight: 52, marginTop: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
    quietText: { color: c.ink, fontSize: 15, fontWeight: '600', flexShrink: 1 },
    wait: { paddingVertical: 10, paddingLeft: 12, gap: 2, alignItems: 'flex-start' },
    waitB: { color: c.ink, fontSize: 14, fontWeight: '600' },
    waitS: { color: c.ink2, fontSize: 13 },
    waitLink: { color: c.accentText, fontSize: 13, fontWeight: '700', paddingTop: 2 },
    indent: { paddingBottom: 8 },
    tools: { paddingTop: 2, paddingBottom: 8 },
    toolLabel: { marginTop: 4, paddingTop: 14, color: c.ink3, fontSize: 12, fontWeight: '600', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
    people: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 8, marginTop: 8 },
    person: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12 },
    personT: { color: c.ink, fontSize: 13 },
    chips: { alignItems: 'flex-start', gap: 2, paddingBottom: 8 },
    chip: { color: c.accentText, fontSize: 13, fontWeight: '600', paddingVertical: 4 },
    form: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
    input: { flex: 1, minWidth: 0, minHeight: 40, paddingHorizontal: 12, borderWidth: 1, borderColor: c.line, borderRadius: th.radius.r2, backgroundColor: c.surface, color: c.ink, fontSize: 14 },
    send: { minHeight: 40, paddingHorizontal: 12, borderRadius: th.radius.r2, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    sendT: { color: c.accentInk, fontSize: 13, fontWeight: '700' },
    snagForm: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  }));

  function act(name: string, a?: any, b?: any) {
    setNote('');
    if (name === 'leave') svc.decideLeave(a, b);
    else if (name === 'material') {
      try { svc.approveMaterial(a, b); } catch (err: any) { setNote(err.message === 'forbidden' ? 'You can’t decide this material.' : err.message); return; }
    } else if (name === 'change') {
      const change = (state.db.CHANGES || []).find((c: any) => c.id === a);
      if (!change) return;
      change.status = b ? 'approved' : 'declined';
      change.signedAt = new Date().toISOString().slice(0, 16);
      svc.log(`Change ${change.status} · ${change.no}`, `Change ${change.id}`);
      if (b) svc.recordApproval({ kind: 'change', projectId: change.projectId, value: change.no, instruction: change.title });
      persist();
    } else if (name === 'task') {
      const task = (state.db.TASKS || []).find((row: any) => row.id === a);
      if (!task || task.owner !== state.userId) return;
      const previous = task.status;
      task.status = 'done';
      if (!persist()) { task.status = previous; setNote('Could not save that. Try again.'); return; }
    } else if (name === 'enquiry') svc.decideEnquiry(a, b);
    else if (name === 'booking') svc.decideBooking(a, b);
    else if (name === 'close') svc.closeIssue(a);
    else if (name === 'followup') svc.doneFollowup(a);
    else if (name === 'holiday') {
      const count = svc.pushHoliday(a);
      setNote(count ? `Told ${count} site group${count === 1 ? '' : 's'}.` : 'No site group to tell.');
    } else if (name === 'guard') setNote('Guard check logged for today. Next reminder is tomorrow.');
    else if (name === 'nudge') {
      const thread = svc.threads().find((th: any) => th.kind === 'client' && th.projectId === a.projectId);
      if (!thread) { setNote('No client conversation for this decision.'); return; }
      setDraft(thread.id, `Hi, could you help decide "${a.title}" so we can keep the project on schedule? Thank you.`);
      navigate(`/mobile/chats/${thread.id}`);
      return;
    } else if (name === 'invoice') {
      const thread = svc.threads().find((th: any) => th.kind === 'client' && th.projectId === a.projectId);
      if (!thread) { setNote('No client conversation for this invoice.'); return; }
      AIProvider.draftNudge(a, 'English').then((text: string) => {
        setDraft(thread.id, text);
        navigate(`/mobile/chats/${thread.id}`);
      });
      return;
    }
    render();
  }

  async function shareWeekly(project: any, edit: boolean) {
    const card = await AIProvider.weeklyCard(project.id);
    const thread = svc.threads().find((th: any) => th.kind === 'client' && th.projectId === project.id);
    if (!thread) { setNote('No client conversation for this project.'); return; }
    const askLine = Array.isArray(card.askClient) ? card.askClient.filter(Boolean).join(', ') : (card.askClient || '');
    const text = `${card.title}\n${card.lines.join('\n')}${askLine ? `\n${askLine}` : ''}`;
    if (edit) {
      setDraft(thread.id, text);
      navigate(`/mobile/chats/${thread.id}`);
      return;
    }
    postMessage(thread.id, { text });
    setShared((prev) => ({ ...prev, [project.id]: true }));
    setNote('Shared with the client group.');
    render();
  }

  const submitSnag = () => {
    const text = snag.trim();
    if (!text) return;
    postMessage(site.t.id, { text: `Snag · ${text}` });
    setSnag('');
    setSnagOpen(false);
    render();
  };
  const submitAsk = () => {
    const q = ask.trim();
    if (!q) return;
    navigate(`/mobile/assist?kind=ask&q=${encodeURIComponent(q)}`);
  };
  const cards = (list: any[]) => <View style={s.indent}>{list.map((item, i) => <DayCard key={item.key} item={item} act={act} first={i === 0} />)}</View>;

  return (
    <Screen>
      <TopBar>
        <Text style={[s.h1, { flex: 1 }]} numberOfLines={2}>
          {t('today')}
          {'\n'}
          <Text style={s.h1sub}>{fmtD(day)}</Text>
        </Text>
        <Link to="/mobile/profile?from=%2Fmobile%2Ftoday" accessibilityLabel="Profile"><Avatar person={person} size="sm" /></Link>
      </TopBar>
      <ScrollView style={s.body} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.now}>
          <Text style={s.nowH}>{focus ? focus.title : (nowItems.length ? 'Your day is open' : 'You’re up to date')}</Text>
          <Text style={s.nowP}>{focus ? `${currentMeeting ? 'Now' : hh(focus.start)} · ${placeOf(focus)}` : (ahead || 'Nothing else on your calendar')}</Text>
        </View>
        {!state.online && <Text style={s.banner}>Your message will send when the network is back.</Text>}
        {siteThreads.length > 0 && can('thread', 'w') && (
          <DayRow
            left={<Link to={postTo} accessibilityLabel="Post a site update"><Strong>Post a site update</Strong><Sub>Photo, voice, delivery or attendance</Sub></Link>}
            acts={<Acts>
              {site && <ActBtn label="Voice" to={`/mobile/chats/${site.t.id}/voice`} />}
              {canSnag && <ActBtn label="Snag" quiet onPress={() => setSnagOpen((v) => !v)} />}
            </Acts>}
          />
        )}
        {snagOpen && site && (
          <View style={s.snagForm}>
            <TextInput style={s.input} value={snag} onChangeText={setSnag} placeholder="What’s wrong on site?" accessibilityLabel="Snag" onSubmitEditing={submitSnag} returnKeyType="send" />
            <Pressable style={s.send} onPress={submitSnag} accessibilityRole="button" accessibilityLabel="Send"><Text style={s.sendT}>Send</Text></Pressable>
          </View>
        )}
        {nowItems.length > 0 && <View style={s.nowCard}>{nowItems.map((item, i) => <DayCard key={item.key} item={item} act={act} first={i === 0} />)}</View>}
        {!nowItems.length && !laterItems.length && (
          <View style={s.clear}>
            <Text style={s.clearH}>Nothing waiting on you</Text>
            <Link to="/mobile/projects"><Text style={s.clearA}>Open projects</Text></Link>
          </View>
        )}
        {note ? <Text style={s.note}>{note}</Text> : null}
        <View style={s.menu}>
          {leaves.length > 0 && <Fold title="Leave requests" count={leaves.length}>{cards(leaves)}</Fold>}
          {enquiries.length > 0 && (
            <Fold title="New enquiries" count={enquiries.length} open={enquiries.some((item) => item.key === opened)}>{cards(enquiries)}</Fold>
          )}
          {holidays.length > 0 && (
            <Fold title={`${holidays[0].holiday.name} · ${fmtD(holidays[0].holiday.date)}`}>{cards(holidays)}</Fold>
          )}
          {reminders.length > 0 && <Fold title="Reminders" count={reminders.length}>{cards(reminders)}</Fold>}
          {waiting.length > 0 && (
            <Fold title="Waiting on others" count={waiting.length}>
              {waiting.map((item: any) => (
                <View style={s.wait} key={item.key}>
                  <Text style={s.waitB}>{item.issue.title}</Text>
                  <Text style={s.waitS}>{item.who}{item.issue.due ? ` · by ${fmtD(item.issue.due)}` : ''}</Text>
                  <Link to={`/mobile/issues/${item.issue.id}`}><Text style={s.waitLink}>Open linked issue</Text></Link>
                </View>
              ))}
            </Fold>
          )}
          {away.length > 0 && (
            <View style={s.quietRow}>
              <Icon name="cal" size={16} />
              <Text style={s.quietText}>Away today: {away.join(', ')}</Text>
            </View>
          )}
          {svc.assistKinds().includes('daily') && (
            <Link to={reportTo} style={s.quietRow}><Text style={s.quietText}>Review day report</Text></Link>
          )}
          <Fold title="Meetings and studio tools">
            <View style={s.tools}>
              {todayMeetings.length ? todayMeetings.map((b: any, i: number) => {
                const past = now >= b.end;
                const current = now >= b.start && now < b.end;
                const people = (b.attendees || []).filter((id: string) => id !== state.userId).slice(0, 3);
                return (
                  <DayRow
                    key={b.id} first={i === 0} past={past}
                    left={<>
                      <Strong past={past}>{current ? 'Now · ' : ''}{hh(b.start)}–{hh(b.end)} · {b.title}</Strong>
                      <Sub past={past}>{placeOf(b)}</Sub>
                      {people.length > 0 && (
                        <View style={s.people}>
                          {people.map((id: string) => (
                            <Pressable key={id} style={s.person} onPress={() => openExternal(`tel:${phoneOf(user(id)).replace(/\s/g, '')}`)} accessibilityLabel={`Call ${firstName(id)}`}>
                              <Avatar person={user(id)} size="sm" />
                              <Text style={s.personT}>{firstName(id)}</Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </>}
                  />
                );
              }) : <Text style={s.toolNote}>{state.role === 'client' ? 'No meeting booked. Pick a day and time, the studio confirms.' : 'Nothing booked for you today.'}</Text>}
              {meetings.filter((b: any) => b.date > day).slice(0, 3).map((b: any) => (
                <DayRow key={b.id} left={<><Strong>{fmtD(b.date)} · {hh(b.start)} · {b.title}</Strong><Sub>{b.status === 'pending' ? 'Waiting for the studio' : 'Confirmed'}</Sub></>} />
              ))}
              {canBook && (
                <DayRow to={`/mobile/book?kind=${bookKind}`}
                  left={<Strong accent>{state.role === 'client' ? 'Book a meeting' : `Book ${(state.db.ROOMS?.[0]?.name || 'a room').toLowerCase()}`}</Strong>} />
              )}
              {weekly.length > 0 && <Text style={s.toolLabel}>Weekly share cards</Text>}
              {weekly.map((project: any, i: number) => (
                <DayRow key={project.id} first={i === 0}
                  left={<><Strong>{project.name}</Strong><Sub>{shared[project.id] ? 'Shared with the client group.' : 'Drafted from this week’s site photos.'}</Sub></>}
                  acts={<Acts>
                    <ActBtn label="Share" onPress={() => shareWeekly(project, false)} />
                    <ActBtn label="Edit first" quiet onPress={() => shareWeekly(project, true)} />
                  </Acts>} />
              ))}
              {chain.length > 0 && <Text style={s.toolLabel}>Materials</Text>}
              {chain.map((m: any, i: number) => (
                <DayRow key={m.id} first={i === 0}
                  left={<Strong>{m.name}</Strong>}
                  acts={<Acts><Sub>{(m.status || 'open').replaceAll('_', ' ')}</Sub></Acts>} />
              ))}
              {siteToday.length > 0 && <Text style={s.toolLabel}>Site updates</Text>}
              {siteToday.map((f: any, i: number) => {
                const thread = svc.threads().find((th: any) => th.kind === 'site' && th.siteId === f.site.id);
                const text = (f.text || f.aiSummary || 'Update').trim();
                return (
                  <DayRow key={f.id} first={i === 0} to={thread ? `/mobile/chats/${thread.id}` : `/mobile/projects/${f.site.projectId}`}
                    left={<><Strong>{fmtT(f.at)} · {firstName(f.by)}</Strong><Sub>{text.slice(0, 90)}{text.length > 90 ? '…' : ''}</Sub></>} />
                );
              })}
              {lastThread && (
                <DayRow to={`/mobile/chats/${lastThread.id}`} left={<Strong accent>Continue {threadTitle(lastThread)}</Strong>} />
              )}
              {notice && <Text style={s.toolNote}>{notice.text}</Text>}
            </View>
          </Fold>
          {svc.assistKinds().includes('ask') && (
            <Fold title="Ask about your work">
              <View style={s.chips}>
                {askChips.map((q) => (
                  <Link key={q} to={`/mobile/assist?kind=ask&q=${encodeURIComponent(q)}`}><Text style={s.chip}>{q}</Text></Link>
                ))}
              </View>
              <View style={s.form}>
                <TextInput style={s.input} value={ask} onChangeText={setAsk} placeholder="Ask about a drawing, date or decision" accessibilityLabel="Ask about your work" onSubmitEditing={submitAsk} returnKeyType="send" />
                <Pressable style={s.send} onPress={submitAsk} accessibilityRole="button" accessibilityLabel="Ask"><Text style={s.sendT}>Ask</Text></Pressable>
              </View>
            </Fold>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
