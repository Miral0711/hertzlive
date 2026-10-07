import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../shared/store';
import { hh, inr, persist, AIProvider } from '../shared/core';
import { ANNOUNCEMENTS } from '../desktop/data';
import Icon from './Icon';
import { useField } from './FieldContext';
import {
  fmtD, fmtT, myThreads, me, firstName, projectName, onPhone, stamp, waitingItems,
  svc, state, can, user, render, TODAY, phoneOf, postMessage, threadTitle,
} from './model';
import { t } from './copy';
import { Avatar } from './faces';

const nowHours = () => {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
};

const placeOf = (b) => {
  const room = (state.db.ROOMS || []).find((r) => r.id === b.roomId)?.name;
  if (room) return room;
  if (b.kind === 'travel') return 'Out of the office';
  return { client: 'Client meeting', review: 'Studio review', focus: 'Focus time' }[b.kind] || 'Studio';
};

function nextSentence(meetings) {
  const now = nowHours();
  const current = meetings.find((b) => now >= b.start && now < b.end);
  if (current) return `Now · ${current.title} · ${placeOf(current)}`;
  const upcoming = meetings.find((b) => b.start > now);
  if (!upcoming) return meetings.length ? 'Nothing else on your calendar today' : '';
  const mins = Math.max(1, Math.round((upcoming.start - now) * 60));
  const when = mins < 90 ? `in ${mins} min` : `at ${hh(upcoming.start)}`;
  return `Next · ${upcoming.title} ${when} · ${placeOf(upcoming)}`;
}

const involved = (b) => b.clientId === state.userId || (b.attendees || []).includes(state.userId) || b.by === state.userId;

function threadForIssue(issue) {
  return state.db.THREADS.find((t) => t.kind === 'site' && t.siteId === issue.siteId && (t.memberIds || []).includes(state.userId))
    || state.db.THREADS.find((t) => t.projectId === issue.projectId && t.kind === 'internal');
}

function liveSites() {
  return svc.sites().filter((site) => onPhone(site.projectId) && site.progress < 100);
}

function buildToday(day) {
  const role = state.role;
  const actions = [];
  const waiting = [];
  if (can('leave', 'a')) {
    svc.leaves({ status: 'pending' }).forEach((leave) => actions.push({ key: `leave-${leave.id}`, kind: 'leave', leave }));
  }
  if (role === 'client') {
    svc.materials().filter((m) => m.status === 'client_pending').forEach((material) => {
      actions.push({ key: `mat-${material.id}`, kind: 'material', material });
    });
    (state.db.CHANGES || []).filter((c) => c.status === 'awaiting_client' && onPhone(c.projectId)).forEach((change) => {
      actions.push({ key: `chg-${change.id}`, kind: 'change', change });
    });
  }
  (state.db.TASKS || []).filter((task) => task.status === 'open' && task.owner === state.userId && onPhone(task.projectId)).forEach((task) => {
    actions.push({ key: `task-${task.id}`, kind: 'task', task });
  });
  if (role === 'site_manager' && liveSites().length) actions.push({ key: 'sites', kind: 'sites' });
  if (role === 'site_manager' || role === 'contractor') {
    liveSites().forEach((site) => {
      svc.snags(site.id).filter((n) => n.status !== 'closed').slice(0, 1).forEach((snag) => {
        actions.push({ key: `snag-${snag.id}`, kind: 'snag', snag, site });
      });
    });
  }
  svc.myEnquiries().forEach((enquiry) => actions.push({ key: `enq-${enquiry.id}`, kind: 'enquiry', enquiry }));
  if (can('booking', 'a')) {
    svc.pendingBookings().forEach((booking) => actions.push({ key: `book-${booking.id}`, kind: 'booking', booking }));
  }
  const openIssues = svc.issues().filter((issue) => issue.status !== 'closed' && onPhone(issue.projectId));
  if (role === 'designer' || role === 'partner') {
    openIssues.filter((issue) => issue.assignee === state.userId).forEach((issue) => {
      const detail = svc.siteIssueDetails(issue.id);
      if (detail?.canAnswer && detail.needsAnswer) actions.push({ key: `work-${issue.id}`, kind: 'sitework', issue, label: 'Site needs an answer' });
      else actions.push({ key: `issue-${issue.id}`, kind: 'issue', issue });
    });
  }
  if (role === 'site_manager' || role === 'contractor') {
    openIssues.filter((issue) => issue.raisedBy === state.userId && svc.mySiteIds().includes(issue.siteId)).forEach((issue) => {
      const detail = svc.siteIssueDetails(issue.id);
      const who = detail?.sources.length
        ? (detail.needsAnswer ? 'Awaiting office response' : 'Awaiting resolution')
        : (issue.assignee ? `Waiting on ${firstName(issue.assignee)}` : 'Awaiting office response');
      waiting.push({ key: `wait-${issue.id}`, issue, who });
    });
  }
  svc.followups().filter((f) => (f.at || '') <= `${day}T23:59` && f.msg?.text).forEach((followup) => {
    actions.push({ key: `fu-${followup.id}`, kind: 'followup', followup });
  });
  if (role === 'partner') {
    svc.decisionsDue().filter((d) => d.late && onPhone(d.projectId)).forEach((decision) => {
      actions.push({ key: `dec-${decision.id}`, kind: 'decision', decision });
    });
    (state.db.INVOICES || []).filter((inv) => inv.status === 'overdue' && onPhone(inv.projectId)).forEach((invoice) => {
      actions.push({ key: `inv-${invoice.id}`, kind: 'invoice', invoice });
    });
    (state.db.HOLIDAYS || []).filter((h) => !h.pushed && h.date >= day && (new Date(h.date) - new Date(day)) / 864e5 <= 14).forEach((holiday) => {
      actions.push({ key: `hol-${holiday.date}`, kind: 'holiday', holiday });
    });
    const quiet = liveSites().map((site) => {
      const last = svc.feed(site.id).filter((f) => f.type === 'photo').map((f) => f.at).sort().pop();
      const age = last ? Math.round((new Date(`${day}T00:00`) - new Date(`${last.slice(0, 10)}T00:00`)) / 864e5) : 99;
      return { site, age };
    }).filter((row) => row.age >= 3).sort((a, b) => b.age - a.age)[0];
    if (quiet) actions.push({ key: `quiet-${quiet.site.id}`, kind: 'quiet', site: quiet.site, age: quiet.age });
  }
  if (role === 'designer') {
    const drawing = svc.projects().flatMap((p) => (p.drawings || [])
      .filter((d) => d.by === state.userId && d.status !== 'Issued for construction')
      .map((d) => ({ ...d, projectId: p.id, project: p.name })))[0];
    if (drawing) actions.push({ key: `drw-${drawing.no}`, kind: 'drawing', drawing });
  }
  if (role === 'client') {
    const project = svc.projects()[0];
    const next = project?.milestones?.find((m) => !m.done && m.clientVisible);
    if (next) actions.push({ key: `mile-${project.id}`, kind: 'milestone', project, next });
  }
  return { actions, waiting };
}

function Acts({ children }) {
  return <div className="day-acts">{children}</div>;
}

function DayCard({ item, act }) {
  const row = 'day-row';
  if (item.kind === 'leave') {
    const { leave } = item;
    return (
      <article className={row}>
        <small>Leave request</small>
        <b>{user(leave.userId).name} · {leave.days} day{leave.days === 1 ? '' : 's'}</b>
        <span>{leave.type} · {fmtD(leave.from)} to {fmtD(leave.to)}{leave.reason ? ` · ${leave.reason}` : ''}</span>
        <Acts>
          <button type="button" onClick={() => act('leave', leave.id, true)}>Approve</button>
          <button type="button" className="quiet" onClick={() => act('leave', leave.id, false)}>Decline</button>
          <Link className="quiet" to={`/mobile/standin/${leave.userId}?leave=${leave.id}`}>Who covers?</Link>
        </Acts>
      </article>
    );
  }
  if (item.kind === 'material') {
    const { material } = item;
    return (
      <article className={row}>
        <small>Your approval</small>
        <b>{material.name}</b>
        <span>{[material.vendor, projectName(material.projectId)].filter(Boolean).join(' · ')}</span>
        <Acts>
          <button type="button" onClick={() => act('material', material.id, true)}>Approve</button>
          <button type="button" className="quiet" onClick={() => act('material', material.id, false)}>Not this one</button>
          <Link className="quiet" to={`/mobile/assist?kind=ask&q=${encodeURIComponent(`Tell me more about the ${material.name}`)}`}>Ask</Link>
        </Acts>
      </article>
    );
  }
  if (item.kind === 'change') {
    const { change } = item;
    return (
      <article className={row}>
        <small>Your approval · {change.no}</small>
        <b>{change.title}</b>
        <span>{change.reason}</span>
        <span>{inr(change.cost)} extra · {change.days} day{change.days === 1 ? '' : 's'}</span>
        <Acts>
          <button type="button" onClick={() => act('change', change.id, true)}>Approve</button>
          <button type="button" className="quiet" onClick={() => act('change', change.id, false)}>Decline</button>
        </Acts>
      </article>
    );
  }
  if (item.kind === 'task') {
    const { task } = item;
    return (
      <article className={row}>
        <small>{task.from ? `Asked by ${firstName(task.from)}` : 'Assigned to you'}</small>
        <b>{task.title}</b>
        <span>{projectName(task.projectId)}{task.due ? ` · by ${fmtD(task.due)}` : ''}</span>
        <Acts>
          <button type="button" onClick={() => act('task', task.id)}>Done</button>
          <Link className="quiet" to={`/mobile/projects/${task.projectId}`}>Open project</Link>
        </Acts>
      </article>
    );
  }
  if (item.kind === 'snag') {
    return (
      <Link className={row} to={`/mobile/projects/${item.site.projectId}`}>
        <small>{state.role === 'contractor' ? 'Your snag' : 'Open snag'}</small>
        <b>{item.snag.text}</b>
        <span>{item.site.name}</span>
      </Link>
    );
  }
  if (item.kind === 'sites') {
    return (
      <article className={row}>
        <small>Your sites today</small>
        <ul className="sites-mini">
          {liveSites().map((site) => {
            const open = (state.db.ISSUES || []).filter((i) => i.siteId === site.id && i.status === 'open').length;
            const log = svc.feed(site.id).find((f) => /Daily log/.test(f.text || ''));
            const workers = log ? (log.text.match(/(\d+) workers/) || [])[1] : null;
            return (
              <li key={site.id}>
                <b>{projectName(site.projectId)}</b>
                {' · '}{open ? `${open} open` : 'no issues'}
                {' · '}{workers ? `${workers} workers logged` : 'no log yet'}
              </li>
            );
          })}
        </ul>
        <span>Presence comes from your photos. Guard check is due at 18:00.</span>
        <Acts><button type="button" className="quiet" onClick={() => act('guard')}>Guard check done</button></Acts>
      </article>
    );
  }
  if (item.kind === 'enquiry') {
    const { enquiry } = item;
    const phone = (enquiry.phone || '').replace(/\D/g, '');
    return (
      <article className={row}>
        <small>New enquiry{enquiry.source ? ` · ${enquiry.source}` : ''}</small>
        <b>{enquiry.name} · {svc.serviceType(enquiry.typeId)}</b>
        <span>{[enquiry.city, enquiry.msg].filter(Boolean).join(' · ')}</span>
        <Acts>
          <button type="button" onClick={() => act('enquiry', enquiry.id, 'accepted')}>Accept</button>
          <button type="button" className="quiet" onClick={() => act('enquiry', enquiry.id, 'not_eligible')}>Not eligible</button>
          {phone ? <a className="quiet" href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer">WhatsApp</a> : null}
        </Acts>
      </article>
    );
  }
  if (item.kind === 'booking') {
    const { booking } = item;
    const withWhom = (booking.attendees || []).filter((id) => id !== booking.clientId).map((id) => firstName(id)).join(', ');
    return (
      <article className={row}>
        <small>Client wants to meet</small>
        <b>{user(booking.clientId || booking.by).name} · {fmtD(booking.date)} {hh(booking.start)}</b>
        <span>{booking.title}{withWhom ? ` · with ${withWhom}` : ''}</span>
        <Acts>
          <button type="button" onClick={() => act('booking', booking.id, true)}>Confirm</button>
          <button type="button" className="quiet" onClick={() => act('booking', booking.id, false)}>Decline</button>
        </Acts>
      </article>
    );
  }
  if (item.kind === 'issue' || item.kind === 'sitework') {
    const { issue } = item;
    const thread = threadForIssue(issue);
    return (
      <article className={row}>
        <small>{item.label || `Site needs your answer${issue.due ? ` · reply by ${fmtD(issue.due)}` : ''}`}</small>
        <b>{issue.title}</b>
        <span>{[issue.type, issue.drawing, issue.raisedBy ? `raised by ${firstName(issue.raisedBy)}` : ''].filter(Boolean).join(' · ')}</span>
        <Acts>
          {thread ? <Link to={`/mobile/chats/${thread.id}`}>Reply</Link> : <Link to={`/mobile/issues/${issue.id}`}>Open</Link>}
          {item.kind === 'issue' ? <button type="button" className="quiet" onClick={() => act('close', issue.id)}>Mark answered</button> : null}
        </Acts>
      </article>
    );
  }
  if (item.kind === 'followup') {
    const message = item.followup.msg;
    return (
      <article className={row}>
        <small>Reminder</small>
        <b>{message?.text || 'Message'}</b>
        <Acts>
          {message ? <Link to={`/mobile/chats/${message.threadId}#${message.id}`}>Open</Link> : null}
          <button type="button" className="quiet" onClick={() => act('followup', item.followup.id)}>Done</button>
        </Acts>
      </article>
    );
  }
  if (item.kind === 'decision') {
    const { decision } = item;
    return (
      <article className={row}>
        <small>Client decision overdue</small>
        <b>{decision.title}</b>
        <span>{projectName(decision.projectId)} · due {fmtD(decision.due)}</span>
        <Acts><button type="button" onClick={() => act('nudge', decision)}>Nudge client</button></Acts>
      </article>
    );
  }
  if (item.kind === 'invoice') {
    const { invoice } = item;
    return (
      <article className={row}>
        <small>Payment overdue</small>
        <b>Invoice {invoice.no} · {inr(invoice.amount)}</b>
        <span>{projectName(invoice.projectId)}</span>
        <Acts><button type="button" onClick={() => act('invoice', invoice)}>Draft reminder</button></Acts>
      </article>
    );
  }
  if (item.kind === 'holiday') {
    const { holiday } = item;
    return (
      <article className={row}>
        <small>Holiday</small>
        <b>{holiday.name} · {fmtD(holiday.date)}</b>
        <span>Tell every site so labour and deliveries are planned.</span>
        <Acts><button type="button" onClick={() => act('holiday', holiday.date)}>Tell site groups</button></Acts>
      </article>
    );
  }
  if (item.kind === 'quiet') {
    return (
      <Link className={row} to={`/mobile/projects/${item.site.projectId}`}>
        <small>No recent photo</small>
        <b>{item.site.name}</b>
        <span>{item.age > 30 ? 'No site photo yet' : `Nothing from site for ${item.age} days`}</span>
      </Link>
    );
  }
  if (item.kind === 'drawing') {
    const { drawing } = item;
    return (
      <Link className={row} to={`/mobile/projects/${drawing.projectId}/drawings`}>
        <small>{drawing.status}</small>
        <b>{drawing.name}</b>
        <span>{drawing.project} · {drawing.no}</span>
      </Link>
    );
  }
  if (item.kind === 'milestone') {
    return (
      <Link className={row} to={`/mobile/projects/${item.project.id}`}>
        <small>Next milestone</small>
        <b>{item.next.name}</b>
        <span>{item.project.name} · {fmtD(item.next.date)}</span>
      </Link>
    );
  }
  return null;
}

export default function Today() {
  useStore();
  const navigate = useNavigate();
  const { read, setDraft } = useField();
  const [snagOpen, setSnagOpen] = useState(false);
  const [snag, setSnag] = useState('');
  const [ask, setAsk] = useState('');
  const [note, setNote] = useState('');
  const [shared, setShared] = useState({});
  const person = me();
  const day = TODAY || stamp().slice(0, 10);
  const built = buildToday(day);
  const actions = built.actions.filter((item) => item.kind !== 'checkin');
  const laterKinds = new Set(state.role === 'hr' ? ['enquiry', 'holiday', 'followup'] : ['leave', 'enquiry', 'holiday', 'followup']);
  const rank = { task: 1, issue: 2, sitework: 2, drawing: 2, sites: 3, snag: 3, material: 4, change: 4, decision: 5, invoice: 6, booking: 7, milestone: 8, quiet: 9, leave: 1, enquiry: 2, holiday: 3, followup: 4 };
  const byRank = (a, b) => (rank[a.kind] || 9) - (rank[b.kind] || 9);
  const nowItems = actions.filter((item) => !laterKinds.has(item.kind)).sort(byRank);
  const laterItems = actions.filter((item) => laterKinds.has(item.kind)).sort(byRank);
  const leaves = laterItems.filter((item) => item.kind === 'leave');
  const enquiries = laterItems.filter((item) => item.kind === 'enquiry');
  const holidays = laterItems.filter((item) => item.kind === 'holiday');
  const reminders = laterItems.filter((item) => item.kind === 'followup');
  const waiting = (['site_manager', 'contractor'].includes(state.role) || built.waiting.length)
    ? built.waiting
    : waitingItems().map((item) => ({
      key: item.key,
      issue: { id: item.issueId, title: item.title },
      who: item.meta,
    }));
  const siteThreads = myThreads().filter(({ t }) => t.kind === 'site');
  const site = siteThreads[0];
  const canSnag = ['site_manager', 'contractor'].includes(state.role) && site;
  const onSite = ['partner', 'designer', 'site_manager', 'contractor'].includes(state.role);
  const meetings = (state.db.BOOKINGS || []).filter((b) => b.date >= day && b.status !== 'declined' && involved(b))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  const todayMeetings = meetings.filter((b) => b.date === day);
  const ahead = nextSentence(todayMeetings);
  const away = [...new Set(svc.projects().flatMap((p) => svc.away(day, p.id)).filter((a) => a.userId).map((a) => user(a.userId)?.name).filter(Boolean))];
  const live = liveSites()[0];
  const reportTo = live ? `/mobile/projects/${live.projectId}/assist?kind=daily&site=${live.id}` : '/mobile/assist?kind=daily';
  const postTo = siteThreads.length === 1 ? `/mobile/camera?thread=${site.t.id}` : '/mobile/camera';
  const lastId = Object.entries(read || {}).sort((a, b) => b[1].localeCompare(a[1]))[0]?.[0];
  const lastThread = lastId ? svc.thread(lastId) : null;
  const notice = ANNOUNCEMENTS.find((a) => a.pinned) || ANNOUNCEMENTS[0];
  const siteToday = onSite
    ? svc.sites().flatMap((s) => svc.feed(s.id).map((f) => ({ ...f, site: s })))
      .filter((f) => (f.at || '').startsWith(day))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 3)
    : [];
  const weekly = state.role === 'partner'
    ? svc.projects().filter((p) => p.status !== 'finished' && (state.db.SITES || []).some((s) => s.projectId === p.id && onPhone(p.id)))
    : [];
  const chain = state.role === 'site_manager'
    ? svc.materials().filter((m) => onPhone(m.projectId)).slice(0, 4)
    : [];
  const bookKind = state.role === 'client' ? 'meet' : 'room';
  const canBook = can('booking', 'w') && state.role !== 'contractor';
  const askChips = [
    "What's pending?",
    svc.projects()[0] ? `What's pending on ${svc.projects()[0].name}?` : '',
    'When is the next milestone?',
  ].filter(Boolean);
  const now = nowHours();
  const currentMeeting = todayMeetings.find((b) => now >= b.start && now < b.end);
  const focus = currentMeeting || todayMeetings.find((b) => b.start > now);

  function act(name, a, b) {
    setNote('');
    if (name === 'leave') svc.decideLeave(a, b);
    else if (name === 'material') {
      try { svc.approveMaterial(a, b); } catch (err) { setNote(err.message === 'forbidden' ? 'You can’t decide this material.' : err.message); return; }
    } else if (name === 'change') {
      const change = (state.db.CHANGES || []).find((c) => c.id === a);
      if (!change) return;
      change.status = b ? 'approved' : 'declined';
      change.signedAt = new Date().toISOString().slice(0, 16);
      svc.log(`Change ${change.status} · ${change.no}`, `Change ${change.id}`);
      if (b) svc.recordApproval({ kind: 'change', projectId: change.projectId, value: change.no, instruction: change.title });
      persist();
    } else if (name === 'task') {
      const task = (state.db.TASKS || []).find((row) => row.id === a);
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
    }     else if (name === 'guard') setNote('Guard check logged for today. Next reminder is tomorrow.');
    else if (name === 'nudge') {
      const thread = svc.threads().find((t) => t.kind === 'client' && t.projectId === a.projectId);
      if (!thread) { setNote('No client conversation for this decision.'); return; }
      setDraft(thread.id, `Hi, could you help decide "${a.title}" so we can keep the project on schedule? Thank you.`);
      navigate(`/mobile/chats/${thread.id}`);
      return;
    } else if (name === 'invoice') {
      const thread = svc.threads().find((t) => t.kind === 'client' && t.projectId === a.projectId);
      if (!thread) { setNote('No client conversation for this invoice.'); return; }
      AIProvider.draftNudge(a, 'English').then((text) => {
        setDraft(thread.id, text);
        navigate(`/mobile/chats/${thread.id}`);
      });
      return;
    }
    render();
  }

  async function shareWeekly(project, edit) {
    const card = await AIProvider.weeklyCard(project.id);
    const thread = svc.threads().find((t) => t.kind === 'client' && t.projectId === project.id);
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

  return (
    <div className="screen">
      <header className="top">
        <h1>{t('today')}<span>{fmtD(day)}</span></h1>
        <Link className="icon-btn" to="/mobile/profile" aria-label="Profile">
          <Avatar person={person} size="sm" />
        </Link>
      </header>
      <div className="body canvas day-body">
        <div className="day-sheet">
          <section className="day-now">
            <div>
              <h2>{focus ? focus.title : (nowItems.length ? 'Your day is open' : 'You’re up to date')}</h2>
              <p>{focus ? `${currentMeeting ? 'Now' : hh(focus.start)} · ${placeOf(focus)}` : (ahead || 'Nothing else on your calendar')}</p>
            </div>
          </section>
          {!state.online && <p className="banner">Your message will send when the network is back.</p>}
          {siteThreads.length > 0 && can('thread', 'w') && (
            <div className="day-row">
              <Link to={postTo}>
                <b>Post a site update</b>
                <span>Photo, voice, delivery or attendance</span>
              </Link>
              <div className="day-acts">
                {site && <Link to={`/mobile/chats/${site.t.id}/voice`}>Voice</Link>}
                {canSnag && <button type="button" className="quiet" onClick={() => setSnagOpen((v) => !v)}>Snag</button>}
              </div>
            </div>
          )}
          {snagOpen && site && (
            <form className="snag-line" onSubmit={(e) => {
              e.preventDefault();
              const text = snag.trim();
              if (!text) return;
              postMessage(site.t.id, { text: `Snag · ${text}` });
              setSnag('');
              setSnagOpen(false);
              render();
            }}>
              <input value={snag} onChange={(e) => setSnag(e.target.value)} placeholder="What’s wrong on site?" aria-label="Snag" />
              <button type="submit">Send</button>
            </form>
          )}
          {nowItems.length > 0 && (
            <section className="day-card">
              {nowItems.map((item) => <DayCard key={item.key} item={item} act={act} />)}
            </section>
          )}
          {!nowItems.length && !laterItems.length && (
            <div className="day-clear">
              <h3>Nothing waiting on you</h3>
              <Link to="/mobile/projects">Open projects</Link>
            </div>
          )}
          {note ? <p className="note">{note}</p> : null}
          <div className="day-menu">
          {leaves.length > 0 && (
            <details className="today-fold">
              <summary><span>Leave requests</span><b>{leaves.length}</b></summary>
              <div className="day-card">
                {leaves.map((item) => <DayCard key={item.key} item={item} act={act} />)}
              </div>
            </details>
          )}
          {enquiries.length > 0 && (
            <details className="today-fold">
              <summary><span>New enquiries</span><b>{enquiries.length}</b></summary>
              <div className="day-card">
                {enquiries.map((item) => <DayCard key={item.key} item={item} act={act} />)}
              </div>
            </details>
          )}
          {holidays.length > 0 && (
            <details className="today-fold">
              <summary><span>{holidays[0].holiday.name} · {fmtD(holidays[0].holiday.date)}</span></summary>
              <div className="day-card">
                {holidays.map((item) => <DayCard key={item.key} item={item} act={act} />)}
              </div>
            </details>
          )}
          {reminders.length > 0 && (
            <details className="today-fold">
              <summary><span>Reminders</span><b>{reminders.length}</b></summary>
              <div className="day-card">
                {reminders.map((item) => <DayCard key={item.key} item={item} act={act} />)}
              </div>
            </details>
          )}
          {waiting.length > 0 && (
            <details className="today-fold">
              <summary><span>Waiting on others</span><b>{waiting.length}</b></summary>
              {waiting.map((item) => (
                <div className="wait-row" key={item.key}>
                  <b>{item.issue.title}</b>
                  <span>{item.who}{item.issue.due ? ` · by ${fmtD(item.issue.due)}` : ''}</span>
                  <Link to={`/mobile/issues/${item.issue.id}`}>Open linked issue</Link>
                </div>
              ))}
            </details>
          )}
          {away.length > 0 && (
            <div className="day-quiet">
              <span><Icon name="cal" /> Away today: {away.join(', ')}</span>
            </div>
          )}
          {svc.assistKinds().includes('daily') && (
            <Link className="day-report" to={reportTo}>Review day report</Link>
          )}
          <details className="today-fold">
            <summary><span>Meetings and studio tools</span></summary>
            <div className="tool-list">
              {todayMeetings.length ? todayMeetings.map((b) => {
                const past = now >= b.end;
                const current = now >= b.start && now < b.end;
                const people = (b.attendees || []).filter((id) => id !== state.userId).slice(0, 3);
                return (
                  <div className={`day-row${past ? ' past' : ''}`} key={b.id}>
                    <div>
                      <b>{current ? 'Now · ' : ''}{hh(b.start)}–{hh(b.end)} · {b.title}</b>
                      <span>{placeOf(b)}</span>
                      {people.length > 0 && (
                        <div className="meet-people">
                          {people.map((id) => (
                            <a key={id} href={`tel:${phoneOf(user(id)).replace(/\s/g, '')}`}>
                              <Avatar person={user(id)} size="sm" />
                              {firstName(id)}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }) : <p className="note">{state.role === 'client' ? 'No meeting booked. Pick a day and time, the studio confirms.' : 'Nothing booked for you today.'}</p>}
              {meetings.filter((b) => b.date > day).slice(0, 3).map((b) => (
                <div className="day-row" key={b.id}>
                  <div>
                    <b>{fmtD(b.date)} · {hh(b.start)} · {b.title}</b>
                    <span>{b.status === 'pending' ? 'Waiting for the studio' : 'Confirmed'}</span>
                  </div>
                </div>
              ))}
              {canBook && (
                <Link className="day-row tool-link" to={`/mobile/book?kind=${bookKind}`}>
                  <b>{state.role === 'client' ? 'Book a meeting' : `Book ${(state.db.ROOMS?.[0]?.name || 'a room').toLowerCase()}`}</b>
                </Link>
              )}
              {weekly.length > 0 && <p className="tool-label">Weekly share cards</p>}
              {weekly.map((project) => (
                <article className="day-row" key={project.id}>
                  <div>
                    <b>{project.name}</b>
                    <span>{shared[project.id] ? 'Shared with the client group.' : 'Drafted from this week’s site photos.'}</span>
                  </div>
                  <Acts>
                    <button type="button" onClick={() => shareWeekly(project, false)}>Share</button>
                    <button type="button" className="quiet" onClick={() => shareWeekly(project, true)}>Edit first</button>
                  </Acts>
                </article>
              ))}
              {chain.length > 0 && <p className="tool-label">Materials</p>}
              {chain.map((m) => (
                <div className="day-row" key={m.id}>
                  <b>{m.name}</b>
                  <div className="day-acts"><span>{(m.status || 'open').replaceAll('_', ' ')}</span></div>
                </div>
              ))}
              {siteToday.length > 0 && <p className="tool-label">Site updates</p>}
              {siteToday.map((f) => {
                const thread = svc.threads().find((th) => th.kind === 'site' && th.siteId === f.site.id);
                const text = (f.text || f.aiSummary || 'Update').trim();
                return (
                  <Link key={f.id} className="day-row" to={thread ? `/mobile/chats/${thread.id}` : `/mobile/projects/${f.site.projectId}`}>
                    <b>{fmtT(f.at)} · {firstName(f.by)}</b>
                    <span>{text.slice(0, 90)}{text.length > 90 ? '…' : ''}</span>
                  </Link>
                );
              })}
              {lastThread && (
                <Link className="day-row tool-link" to={`/mobile/chats/${lastThread.id}`}>
                  <b>Continue {threadTitle(lastThread)}</b>
                </Link>
              )}
              {notice && <p className="note">{notice.text}</p>}
            </div>
          </details>
          {svc.assistKinds().includes('ask') && (
            <details className="today-fold">
              <summary><span>Ask about your work</span></summary>
              <div className="ask-chips">
                {askChips.map((q) => <Link key={q} to={`/mobile/assist?kind=ask&q=${encodeURIComponent(q)}`}>{q}</Link>)}
              </div>
              <form className="ask-row" onSubmit={(e) => {
                e.preventDefault();
                const q = ask.trim();
                if (!q) return;
                navigate(`/mobile/assist?kind=ask&q=${encodeURIComponent(q)}`);
              }}>
                <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ask about a drawing, date or decision" aria-label="Ask about your work" />
                <button type="submit">Ask</button>
              </form>
            </details>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
