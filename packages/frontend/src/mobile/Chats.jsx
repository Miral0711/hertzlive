import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../shared/store';
import Icon from './Icon';
import { backName } from './frame';
import { useField } from './FieldContext';
import {
  myThreads, threadTitle, audience, preview, unreadCount, firstName, fmtT, me, svc, user, phoneOf, state,
} from './model';
import { t } from './copy';
import { fmtD } from '../shared/core';
import { filingRules } from '../shared/filing';
import { ANNOUNCEMENTS } from '../desktop/data';
import { Avatar, ThreadAvatar } from './faces';

export default function Chats() {
  useStore();
  const { read, drafts } = useField();
  const [q, setQ] = useState('');
  const person = me();
  const rows = myThreads();
  const query = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (query.length < 1) return rows;
    return rows.filter(({ t, last }) => {
      const blob = `${threadTitle(t)} ${audience(t)} ${t.name} ${preview(last)}`.toLowerCase();
      return blob.includes(query);
    });
  }, [rows, query]);
  const hits = (query.length >= 2 ? svc.search(q) : []).filter((hit) => {
    if (hit.kind === 'project') return !svc.phoneHides(hit.id);
    if (!hit.threadId) return true;
    const thread = svc.thread(hit.threadId);
    return thread && !svc.phoneHides(thread.projectId);
  });
  const groups = [
    ['Projects', filtered.filter(({ t }) => t.kind !== 'dm')],
    ['People', filtered.filter(({ t }) => t.kind === 'dm')],
  ].filter(([, list]) => list.length);

  return (
    <div className="screen">
      <header className="top">
        <h1>{t('chats')}<span>Hertz · {person ? firstName(person.id) : ''}</span></h1>
        <Link className="icon-btn" to="/mobile/camera" aria-label="Send a photo">
          <Icon name="camera" />
        </Link>
        <Link className="icon-btn" to="/mobile/profile?from=%2Fmobile%2Fchats" aria-label="Profile">
          <Avatar person={person} size="sm" />
        </Link>
      </header>
      <div className="body">
        <label className="search">
          <Icon name="search" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search messages, photos, projects"
            aria-label="Search messages, photos, projects"
          />
        </label>
        {!state.online && <p className="banner">Your message will send when the network is back.</p>}
        {hits.length > 0 && (
          <section>
            <h2 className="sect">In messages</h2>
            {hits.map((hit) => (
              <Link
                className="row"
                key={`${hit.kind}:${hit.id}`}
                to={hit.kind === 'project' ? `/mobile/projects/${hit.id}` : hit.threadId ? `/mobile/chats/${hit.threadId}#${hit.msgId}` : '/mobile/people'}
              >
                <span className="row-copy">
                  <b>{hit.title}</b>
                  <span>{hit.sub}</span>
                </span>
              </Link>
            ))}
          </section>
        )}
        {groups.map(([name, list]) => (
          <section key={name}>
            <h2 className="sect">{name}</h2>
            {list.map(({ t, last }) => (
              <ChatRow key={t.id} thread={t} last={last} unread={unreadCount(t.id, read[t.id])} draft={drafts[t.id]} />
            ))}
          </section>
        ))}
        <details className="group">
          <summary className="row">Filing and announcements</summary>
          <FilingDesk />
        </details>
        {!filtered.length && !hits.length && (
          <div className="empty">
            <h3>{query ? 'No matches' : 'No chats yet'}</h3>
            <p>{query ? 'Try a word from a message, a project, or a person’s name.' : 'Conversations you belong to will show up here.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FilingDesk() {
  const rows = svc.threads().flatMap((th) => svc.messages(th.id)).map((m) => ({ m, f: state.filings[m.id] })).filter((x) => x.f);
  const check = rows.filter((x) => x.f.status !== 'filed');
  const rules = Object.entries(filingRules);
  const filed = rows.filter((x) => x.f.status === 'filed').slice(-5).reverse();
  return (
    <section>
      <p className="note">How the AI filed chat messages, and what still needs a person to check.</p>
      <p>{rows.length} looked at · {rows.filter((x) => x.f.by === 'ai' && x.f.status === 'filed').length} filed by AI · {check.length} need a check · {rows.filter((x) => x.f.by === 'user').length} corrected</p>
      {check.map((x) => (
        <Link key={x.m.id} className="day-row" to={`/mobile/chats/${x.m.threadId}/messages/${x.m.id}/filing`}>
          <span>{firstName(x.m.by)} · {(x.m.text || '').slice(0, 80)}</span>
        </Link>
      ))}
      <h2 className="sect">Rules the AI learned</h2>
      {rules.length ? rules.map(([k, p]) => <p key={k}>{firstName(k.split('|')[0])} files to {p}</p>) : <p className="note">Correct a filing and the AI remembers it for that sender and thread.</p>}
      <h2 className="sect">Announcements</h2>
      {ANNOUNCEMENTS.length ? ANNOUNCEMENTS.map((a, i) => <p key={i}>{a.text} · {firstName(a.by)} · {fmtD(a.at)}</p>) : <p className="note">No announcements.</p>}
      <h2 className="sect">Recently filed</h2>
      {filed.map((x) => <p key={x.m.id}>{(x.m.text || '').slice(0, 80)}</p>)}
    </section>
  );
}

function ChatRow({ thread, last, unread, draft }) {
  const title = threadTitle(thread);
  return (
    <Link className="row" to={`/mobile/chats/${thread.id}`}>
      <ThreadAvatar thread={thread} />
      <span className="row-copy">
        <b className={unread ? 'unread' : ''}>
          <span>{title}</span>
          {last && <small>{fmtT(last.at)}</small>}
        </b>
        {thread.kind !== 'dm' && <span className="audience">{audience(thread)}</span>}
        <span className={draft ? 'draft' : ''}>
          {draft ? `Draft: ${draft}` : (
            <>
              {last && last.by && thread.kind !== 'dm' ? `${firstName(last.by)}: ` : ''}
              {preview(last)}
            </>
          )}
        </span>
      </span>
      {unread > 0 && <span className="count">{unread}</span>}
    </Link>
  );
}

export function ThreadHeader({ thread, backTo = '/mobile/chats' }) {
  const navigate = useNavigate();
  const otherId = thread.kind === 'dm' ? thread.memberIds.find((id) => id !== state.userId) : null;
  const other = otherId ? user(otherId) : null;
  const query = backTo.startsWith('/mobile/') && backTo !== '/mobile/chats' ? `?from=${encodeURIComponent(backTo)}` : '';
  const infoTo = `/mobile/chats/${thread.id}/info${query}`;
  const voiceTo = `/mobile/chats/${thread.id}/call${query ? `${query}&voice=1` : '?voice=1'}`;
  return (
    <header className="top thread-top">
      <button type="button" className="icon-btn" onClick={() => navigate(backTo)} aria-label={`Back to ${backName(backTo)}`}>
        <Icon name="back" />
      </button>
      <Link className="thread-heading" to={infoTo}>
        <ThreadAvatar thread={thread} size="sm" />
        <span className="thread-name">
          <h1>{threadTitle(thread)}</h1>
          <span>{audience(thread)}{thread.kind === 'dm' ? '' : ` · ${thread.memberIds.length} ${t('people')}`}</span>
        </span>
      </Link>
      <Link className="icon-btn" to={`/mobile/chats/${thread.id}/call${query}`} aria-label="Video call">
        <Icon name="play" />
      </Link>
      {other ? (
        <a className="icon-btn" href={`tel:${phoneOf(other).replace(/\s/g, '')}`} aria-label={`Call ${other.name}`}>
          <Icon name="call" />
        </a>
      ) : (
        <Link className="icon-btn" to={voiceTo} aria-label="Voice call">
          <Icon name="call" />
        </Link>
      )}
    </header>
  );
}
