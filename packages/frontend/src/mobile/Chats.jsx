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
import { isProjectAudience, matchesChatFilter, recentChatRows } from '../shared/chatExtras';
import { Select } from '../ui/ui';

const CHAT_FILTERS = () => ([
  ['all', t('All')],
  ['unread', t('Unread')],
  ['projects', t('Projects')],
  ['people', t('People')],
  ['groups', t('Groups')],
]);

export default function Chats() {
  useStore();
  const { read, drafts } = useField();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
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
  const listed = recentChatRows(filtered, {
    threadOf: (row) => row.t,
    atOf: (row) => row.last?.at || row.t.lastMessageAt || row.t.createdAt || '',
  });
  const visible = listed.filter(({ t }) => {
    if (!matchesChatFilter(t, filter)) return false;
    if (filter === 'unread' && projectUnread(t, read, rows) < 1) return false;
    return true;
  });
  const canAdd = svc.chatCreatable();
  const emptyTitle = query ? t('No matches') : filter === 'unread' ? t('No unread chats') : filter === 'projects' ? t('No projects') : filter === 'people' ? t('No people') : filter === 'groups' ? t('No groups') : t('No chats yet');
  const emptyText = query
    ? t('Try a word from a message, a project, or a person’s name.')
    : t('Conversations you belong to will show up here.');

  return (
    <div className="screen">
      <header className={`top ${panel === 'menu' ? 'menu-open' : ''}`}>
        <h1>{t('chats')}<span>{t('Hertz · {0}', person ? firstName(person.id) : '')}</span></h1>
        {canAdd && (
          <span className="chat-add">
            <button type="button" className="icon-btn" aria-label={t('New chat')} aria-expanded={panel === 'menu'} onClick={() => setPanel(panel === 'menu' ? null : 'menu')}>
              <Icon name="plus" />
            </button>
            {panel === 'menu' && (
              <div className="chat-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => setPanel('dm')}>{t('New chat')}</button>
                <button type="button" role="menuitem" onClick={() => setPanel('group')}>{t('Create group')}</button>
                <button type="button" role="menuitem" onClick={() => setPanel('invite')}>{t('Invite a person')}</button>
              </div>
            )}
          </span>
        )}
        <Link className="icon-btn" to="/mobile/camera" aria-label={t('Send a photo')}>
          <Icon name="camera" />
        </Link>
        <Link className="icon-btn" to="/mobile/profile?from=%2Fmobile%2Fchats" aria-label={t('Profile')}>
          <Avatar person={person} size="sm" />
        </Link>
      </header>
      {panel === 'menu' && <button type="button" className="chat-menu-back" aria-label={t('Close')} onClick={() => setPanel(null)} />}
      {panel && panel !== 'menu' && <ChatAdd panel={panel} onClose={() => setPanel(null)} />}
      <div className="body">
        <label className="search">
          <Icon name="search" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('Search messages, photos, projects')}
            aria-label={t('Search messages, photos, projects')}
          />
        </label>
        <div className="chat-filters" role="group" aria-label={t('Filter chats')}>
          {CHAT_FILTERS().map(([key, label]) => (
            <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>
          ))}
        </div>
        {!state.online && <p className="banner">{t('Your message will send when the network is back.')}</p>}
        {hits.length > 0 && (
          <section>
            <h2 className="sect">{t('In messages')}</h2>
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
        {visible.map(({ t, last }) => (
          <ChatRow key={t.projectId && isProjectAudience(t) ? `project:${t.projectId}` : t.id} thread={t} last={last} unread={projectUnread(t, read, rows)} draft={drafts[t.id]} />
        ))}
        {!visible.length && !hits.length && (
          <div className="empty">
            <h3>{emptyTitle}</h3>
            <p>{emptyText}</p>
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
        <span className={draft ? 'draft' : ''}>
          {draft ? t('Draft: {0}', draft) : (
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

function projectUnread(thread, read, rows) {
  if (!isProjectAudience(thread)) return unreadCount(thread.id, read[thread.id]);
  return rows
    .filter(({ t }) => t.projectId === thread.projectId && isProjectAudience(t))
    .reduce((n, { t }) => n + unreadCount(t.id, read[t.id]), 0);
}

function PersonSearch({ value, onChange, label = t('Search people'), placeholder = t('Name or role') }) {
  return (
    <label className="search">
      <Icon name="search" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
        placeholder={placeholder}
        aria-label={label}
      />
    </label>
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
  const [q, setQ] = useState('');
  const projects = svc.projects().filter((p) => p && !svc.phoneHides(p.id));
  const mine = svc.myGroups();
  const group = mine.find((t) => t.id === groupId) || null;
  const people = panel === 'dm' ? svc.chatPeople()
    : panel === 'group' ? (groupType === 'project' ? svc.projectChatPeople(projectId) : svc.chatPeople())
      : group ? (group.groupType === 'project' || (!group.groupType && group.projectId) ? svc.projectChatPeople(group.projectId) : svc.chatPeople()).filter((u) => !(group.memberIds || []).includes(u.id))
        : [];
  const needle = q.trim().toLowerCase();
  const shownPeople = people.filter((u) => !needle || `${u.name} ${u.title || ''}`.toLowerCase().includes(needle));
  const shownGroups = mine.filter((t) => !needle || (t.name || '').toLowerCase().includes(needle));
  const title = panel === 'dm' ? t('New chat') : panel === 'group' ? t('Create group') : t('Invite a person');

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
      setError(t(e.message));
    }
  }
  function create(e) {
    e.preventDefault();
    try {
      open(svc.createGroup({ name, groupType, projectId, memberIds: picked }));
    } catch (err) {
      setError(t(err.message));
    }
  }
  function invite(userId) {
    try {
      open(svc.inviteToGroup(groupId, userId));
    } catch (e) {
      setError(t(e.message));
    }
  }

  return (
    <div className="sheet-back" onClick={onClose} role="presentation">
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {error ? <p className="warn-text">{error}</p> : null}
        {panel === 'dm' && (
          <>
            <PersonSearch value={q} onChange={setQ} />
            {shownPeople.map((u) => (
              <button type="button" className="row" key={u.id} onClick={() => start(u.id)}>
                <Avatar person={u} />
                <span className="row-copy"><b>{u.name}</b><span>{u.title}</span></span>
              </button>
            ))}
            {people.length > 0 && !shownPeople.length && <p className="note">{t('No matches.')}</p>}
          </>
        )}
        {panel === 'group' && (
          <form className="stack" onSubmit={create}>
            <label>{t('Group name')}<input value={name} onChange={(e) => setName(e.target.value)} aria-label={t('Group name')} /></label>
            <div className="type-row" role="group" aria-label={t('Group type')}>
              <button type="button" className={groupType === 'general' ? 'on' : ''} onClick={() => { setGroupType('general'); setProjectId(''); setPicked([]); }}>{t('General')}</button>
              <button type="button" className={groupType === 'project' ? 'on' : ''} onClick={() => { setGroupType('project'); setPicked([]); }}>{t('Project work')}</button>
            </div>
            {groupType === 'project' && (
              <label>{t('Project')}
                <Select className="field-select" value={projectId} aria-label={t('Project')} onChange={(e) => { setProjectId(e.target.value); setPicked([]); }}>
                  <option value="">{t('Choose a project')}</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </label>
            )}
            <p className="help">{groupType === 'project' ? t('People already on this project.') : t('People in the studio.')}</p>
            <PersonSearch value={q} onChange={setQ} />
            {shownPeople.map((u) => (
              <button type="button" key={u.id} className={`row ${picked.includes(u.id) ? 'picked' : ''}`} onClick={() => toggle(u.id)}>
                <Avatar person={u} />
                <span className="row-copy"><b>{u.name}</b><span>{u.title}</span></span>
                <span className="pick" aria-hidden="true">{picked.includes(u.id) ? <Icon name="check" /> : null}</span>
              </button>
            ))}
            {!people.length && <p className="note">{groupType === 'project' && !projectId ? t('Choose a project first.') : t('No one else is available.')}</p>}
            {people.length > 0 && !shownPeople.length && <p className="note">{t('No matches.')}</p>}
            <button className="primary" type="submit">{t('Create group')}</button>
          </form>
        )}
        {panel === 'invite' && !group && (
          mine.length ? (
            <>
              <PersonSearch value={q} onChange={setQ} label={t('Search groups')} placeholder={t('Group name')} />
              {shownGroups.map((g) => (
                <button type="button" className="row" key={g.id} onClick={() => { setGroupId(g.id); setQ(''); setError(''); }}>
                  <ThreadAvatar thread={g} />
                  <span className="row-copy"><b>{g.name}</b><span>{t('{0} · {1} people', g.groupType === 'project' || g.projectId ? t('Project work') : t('Group'), g.memberIds.length)}</span></span>
                </button>
              ))}
              {!shownGroups.length && <p className="note">{t('No matches.')}</p>}
            </>
          ) : <p className="note">{t('Create a group first.')}</p>
        )}
        {panel === 'invite' && group && (
          people.length ? (
            <>
              <PersonSearch value={q} onChange={setQ} />
              {shownPeople.map((u) => (
                <button type="button" className="row" key={u.id} onClick={() => invite(u.id)}>
                  <Avatar person={u} />
                  <span className="row-copy"><b>{u.name}</b><span>{u.title}</span></span>
                </button>
              ))}
              {!shownPeople.length && <p className="note">{t('No matches.')}</p>}
            </>
          ) : <p className="note">{t('Everyone available is already in this group.')}</p>
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
      <button type="button" className="icon-btn" onClick={() => navigate(backTo)} aria-label={t('Back to {0}', backName(backTo))}>
        <Icon name="back" />
      </button>
      <Link className="thread-heading" to={infoTo}>
        <ThreadAvatar thread={thread} size="sm" />
        <span className="thread-name">
          <h1>{threadTitle(thread)}</h1>
          <span>{audience(thread)}{thread.kind === 'dm' ? '' : ` · ${thread.memberIds.length} ${t('people')}`}</span>
        </span>
      </Link>
      <Link className="icon-btn" to={`/mobile/chats/${thread.id}/call${query}`} aria-label={t('Video call')}>
        <Icon name="video" />
      </Link>
      {other ? (
        <a className="icon-btn" href={`tel:${phoneOf(other).replace(/\s/g, '')}`} aria-label={t('Call {0}', other.name)}>
          <Icon name="call" />
        </a>
      ) : (
        <Link className="icon-btn" to={voiceTo} aria-label={t('Voice call')}>
          <Icon name="call" />
        </Link>
      )}
    </header>
  );
}
