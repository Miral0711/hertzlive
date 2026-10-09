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
import { Avatar, ThreadAvatar } from './faces';

export default function Chats() {
  useStore();
  const { read, drafts } = useField();
  const [q, setQ] = useState('');
  const [panel, setPanel] = useState(null);
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
    ['Projects', filtered.filter(({ t }) => !['dm', 'group'].includes(t.kind))],
    ['Groups', filtered.filter(({ t }) => t.kind === 'group')],
    ['People', filtered.filter(({ t }) => t.kind === 'dm')],
  ].filter(([, list]) => list.length);
  const canAdd = svc.chatCreatable();

  return (
    <div className="screen">
      <header className={`top ${panel === 'menu' ? 'menu-open' : ''}`}>
        <h1>{t('chats')}<span>Hertz · {person ? firstName(person.id) : ''}</span></h1>
        {canAdd && (
          <span className="chat-add">
            <button type="button" className="icon-btn" aria-label="New chat" aria-expanded={panel === 'menu'} onClick={() => setPanel(panel === 'menu' ? null : 'menu')}>
              <Icon name="plus" />
            </button>
            {panel === 'menu' && (
              <div className="chat-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => setPanel('dm')}>New chat</button>
                <button type="button" role="menuitem" onClick={() => setPanel('group')}>Create group</button>
                <button type="button" role="menuitem" onClick={() => setPanel('invite')}>Invite a person</button>
              </div>
            )}
          </span>
        )}
        <Link className="icon-btn" to="/mobile/camera" aria-label="Send a photo">
          <Icon name="camera" />
        </Link>
        <Link className="icon-btn" to="/mobile/profile?from=%2Fmobile%2Fchats" aria-label="Profile">
          <Avatar person={person} size="sm" />
        </Link>
      </header>
      {panel === 'menu' && <button type="button" className="chat-menu-back" aria-label="Close" onClick={() => setPanel(null)} />}
      {panel && panel !== 'menu' && <ChatAdd panel={panel} onClose={() => setPanel(null)} />}
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
  return (
    <Link className="row" to={`/mobile/chats/${thread.id}`}>
      <ThreadAvatar thread={thread} />
      <span className="row-copy">
        <b className={unread ? 'unread' : ''}>
          <span>{title}</span>
          {(last?.at || thread.lastMessageAt) && <small>{fmtT(last?.at || thread.lastMessageAt)}</small>}
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

function ChatAdd({ panel, onClose }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [groupType, setGroupType] = useState('general');
  const [projectId, setProjectId] = useState('');
  const [picked, setPicked] = useState([]);
  const [groupId, setGroupId] = useState('');
  const [error, setError] = useState('');
  const projects = svc.projects().filter((p) => p && !svc.phoneHides(p.id));
  const mine = svc.myGroups();
  const group = mine.find((t) => t.id === groupId) || null;
  const people = panel === 'dm' ? svc.chatPeople()
    : panel === 'group' ? (groupType === 'project' ? svc.projectChatPeople(projectId) : svc.chatPeople())
      : group ? (group.groupType === 'project' || (!group.groupType && group.projectId) ? svc.projectChatPeople(group.projectId) : svc.chatPeople()).filter((u) => !(group.memberIds || []).includes(u.id))
        : [];
  const title = panel === 'dm' ? 'New chat' : panel === 'group' ? 'Create group' : 'Invite a person';

  function toggle(id) {
    setPicked((ids) => ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  }
  function open(thread) {
    onClose();
    navigate(`/mobile/chats/${thread.id}`);
  }
  function start(userId) {
    try {
      open(svc.openDirectChat(userId));
    } catch (e) {
      setError(e.message);
    }
  }
  function create(e) {
    e.preventDefault();
    try {
      open(svc.createGroup({ name, groupType, projectId, memberIds: picked }));
    } catch (err) {
      setError(err.message);
    }
  }
  function invite(userId) {
    try {
      open(svc.inviteToGroup(groupId, userId));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="sheet-back" onClick={onClose} role="presentation">
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {error ? <p className="warn-text">{error}</p> : null}
        {panel === 'dm' && people.map((u) => (
          <button type="button" className="row" key={u.id} onClick={() => start(u.id)}>
            <Avatar person={u} />
            <span className="row-copy"><b>{u.name}</b><span>{u.title}</span></span>
          </button>
        ))}
        {panel === 'group' && (
          <form className="stack" onSubmit={create}>
            <label>Group name<input value={name} onChange={(e) => setName(e.target.value)} aria-label="Group name" /></label>
            <div className="type-row" role="group" aria-label="Group type">
              <button type="button" className={groupType === 'general' ? 'on' : ''} onClick={() => { setGroupType('general'); setProjectId(''); setPicked([]); }}>General</button>
              <button type="button" className={groupType === 'project' ? 'on' : ''} onClick={() => { setGroupType('project'); setPicked([]); }}>Project work</button>
            </div>
            {groupType === 'project' && (
              <label>Project
                <select value={projectId} aria-label="Project" onChange={(e) => { setProjectId(e.target.value); setPicked([]); }}>
                  <option value="">Choose a project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}
            <p className="help">{groupType === 'project' ? 'People already on this project.' : 'People in the studio.'}</p>
            {people.map((u) => (
              <button type="button" key={u.id} className={`row ${picked.includes(u.id) ? 'picked' : ''}`} onClick={() => toggle(u.id)}>
                <Avatar person={u} />
                <span className="row-copy"><b>{u.name}</b><span>{u.title}</span></span>
                <span className="pick" aria-hidden="true">{picked.includes(u.id) ? <Icon name="check" /> : null}</span>
              </button>
            ))}
            {!people.length && <p className="note">{groupType === 'project' && !projectId ? 'Choose a project first.' : 'No one else is available.'}</p>}
            <button className="primary" type="submit">Create group</button>
          </form>
        )}
        {panel === 'invite' && !group && (
          mine.length ? mine.map((t) => (
            <button type="button" className="row" key={t.id} onClick={() => { setGroupId(t.id); setError(''); }}>
              <ThreadAvatar thread={t} />
              <span className="row-copy"><b>{t.name}</b><span>{t.groupType === 'project' || t.projectId ? 'Project work' : 'Group'} · {t.memberIds.length} people</span></span>
            </button>
          )) : <p className="note">Create a group first.</p>
        )}
        {panel === 'invite' && group && (
          people.length ? people.map((u) => (
            <button type="button" className="row" key={u.id} onClick={() => invite(u.id)}>
              <Avatar person={u} />
              <span className="row-copy"><b>{u.name}</b><span>{u.title}</span></span>
            </button>
          )) : <p className="note">Everyone available is already in this group.</p>
        )}
      </div>
    </div>
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
        <Icon name="video" />
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
