import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../shared/store';
import Icon from './Icon';
import { useField } from './FieldContext';
import {
  myThreads, threadTitle, audience, preview, unreadCount, firstName, fmtT, me, svc,
} from './model';

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
  const hits = query.length >= 2 ? svc.search(q) : [];
  const groups = [
    ['Projects', filtered.filter(({ t }) => t.kind !== 'dm')],
    ['People', filtered.filter(({ t }) => t.kind === 'dm')],
  ].filter(([, list]) => list.length);

  return (
    <div className="screen">
      <header className="top">
        <h1>Chats<span>Hertz · {person ? firstName(person.id) : ''}</span></h1>
        <Link className="icon-btn" to="/mobile/camera" aria-label="Send a photo">
          <Icon name="camera" />
        </Link>
        <Link className="icon-btn" to="/mobile/profile" aria-label="Profile">
          <span className="av sm">{person?.ini}</span>
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

function ChatRow({ thread, last, unread, draft }) {
  const title = threadTitle(thread);
  const ini = thread.kind === 'dm' ? '··' : title.slice(0, 2).toUpperCase();
  return (
    <Link className="row" to={`/mobile/chats/${thread.id}`}>
      <span className={`av ${thread.kind === 'client' ? 'client' : ''}`}>{ini}</span>
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

export function ThreadHeader({ thread }) {
  const navigate = useNavigate();
  return (
    <header className="top thread-top">
      <button type="button" className="icon-btn" onClick={() => navigate('/mobile/chats')} aria-label="Back to chats">
        <Icon name="back" />
        <span>Chats</span>
      </button>
      <div className="thread-heading">
        <h1>{threadTitle(thread)}</h1>
        <span>{audience(thread)} · {thread.memberIds.length} people</span>
      </div>
      <Link className="icon-btn" to={`/mobile/chats/${thread.id}/info`} aria-label="Group info">
        <Icon name="people" />
      </Link>
      <Link className="icon-btn" to={`/mobile/chats/${thread.id}/call`} aria-label="Start video call">
        <Icon name="call" />
      </Link>
    </header>
  );
}
