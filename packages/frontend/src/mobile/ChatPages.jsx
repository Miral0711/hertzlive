import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../shared/store';
import { Page, Note, Swatch, backName } from './frame';
import { ThreadHeader } from './Chats';
import Icon from './Icon';
import {
  svc, state, user, firstName, fmtT, messagesOf, audience, siblings, threadTitle, postMessage, projectName, phoneOf, stamp, render,
  toggleReaction, deleteMessage, hideMessage, toggleDecision, editMessage, can, myThreads, preview, taskStageLabel,
} from './model';
import { FILE_KINDS, filingLabel } from '../shared/filing';
import { REACTIONS, siteHasSuggestion } from '../shared/chatExtras';
import { Avatar, GroupPhotoInput, ThreadAvatar } from './faces';
import { Select } from '../ui/ui';
import { t } from '../shared/i18n';

const SAMPLE_MEDIA = {
  site: [
    { title: 'Shuttering A to D', hue: 30, seed: 45 },
    { title: 'Rebar at C4', hue: 28, seed: 23 },
    { title: 'Slab 2 from grid A', hue: 30, seed: 46 },
    { title: 'Cement delivery', hue: 28, seed: 31 },
    { title: 'Workers on site', hue: 28, seed: 21 },
    { title: 'Kitchen north wall', hue: 28, seed: 43 },
  ],
  client: [
    { title: 'Kitchen island reference', hue: 20, seed: 8 },
    { title: 'Fluted oak pantry', hue: 32, seed: 12 },
    { title: 'Terrace sample', hue: 18, seed: 61 },
  ],
  internal: [
    { title: 'Window opening sketch', hue: 18, seed: 61 },
    { title: 'Kitchen north wall', hue: 28, seed: 41 },
    { title: 'Slab from grid A', hue: 30, seed: 44 },
    { title: 'Column C4', hue: 28, seed: 23 },
    { title: 'Pantry door sample', hue: 32, seed: 12 },
    { title: 'Terrace from the road', hue: 30, seed: 46 },
  ],
  dm: [
    { title: 'Site photo', hue: 28, seed: 21 },
    { title: 'Drawing markup', hue: 200, seed: 2 },
    { title: 'Sample on site', hue: 32, seed: 12 },
  ],
};

const SAMPLE_DOCS = {
  site: [
    { kind: 'File', title: 'HA-2401-S-301 R1.pdf' },
    { kind: 'Voice note', title: '0:19 · Column C4 rebar is ready for the check.' },
  ],
  client: [
    { kind: 'File', title: 'Pantry door sample.pdf' },
  ],
  internal: [
    { kind: 'File', title: 'HA-2401-A-101 R4.pdf' },
    { kind: 'Voice note', title: '0:15 · Confirm the window before the mason starts.' },
  ],
  dm: [
    { kind: 'File', title: 'Cab bill.pdf' },
  ],
};

export function GroupInfo() {
  useStore();
  const { threadId } = useParams();
  const [params] = useSearchParams();
  const from = params.get('from');
  const backTo = from && from.startsWith('/mobile/') ? from : '';
  const [sample, setSample] = useState(null);
  const [tab, setTab] = useState('Photos');
  const [photoError, setPhotoError] = useState('');
  const [adding, setAdding] = useState(false);
  const thread = svc.thread(threadId);
  if (!thread) return <Page back="/mobile/chats" title={t('Chat')}><div className="empty"><h3>{t('This chat isn’t available')}</h3></div></Page>;
  const members = thread.memberIds.map((id) => user(id)).filter((u) => u?.id);
  const other = thread.kind === 'dm' ? members.find((u) => u.id !== state.userId) : null;
  const muted = svc.chatMuted(threadId);
  const msgs = messagesOf(threadId).filter((m) => !m.deleted);
  const photos = msgs.filter((m) => m.photo || (m.media && m.media.kind !== 'video'));
  const files = msgs.filter((m) => m.file || m.kind === 'file');
  const links = msgs.filter((m) => m.link);
  const voice = msgs.filter((m) => m.voice || m.audio);
  const drawings = msgs.filter((m) => m.kind === 'drawing');
  const media = tab === 'Links' ? links : photos;
  const docs = tab === 'Voice' ? voice : tab === 'Drawings' ? drawings : tab === 'Files' ? files : msgs.filter((m) => !m.photo && !m.link && (m.voice || m.kind === 'file'));
  const samples = media.length ? [] : (SAMPLE_MEDIA[thread.kind] || SAMPLE_MEDIA.internal);
  const sampleDocs = docs.length ? [] : (SAMPLE_DOCS[thread.kind] || SAMPLE_DOCS.internal);
  const placeholders = sampleDocs.filter((item) => item.kind === { Files: 'File', Voice: 'Voice note', Drawings: 'Drawing' }[tab]);
  const pinned = msgs.filter((m) => m.decision);
  const chatTo = `/mobile/chats/${threadId}${backTo ? `?from=${encodeURIComponent(backTo)}` : ''}`;
  const about = {
    internal: 'Office only. The client never sees this.',
    client: t('The client is in this conversation.'),
    site: 'Notes and photos for the site team.',
    dm: other ? `${other.title || t('Direct message')} · ${phoneOf(other)}` : t('Direct message'),
  }[thread.kind] || audience(thread);
  return (
    <>
    <Page sheet stackTitle back={chatTo} backLabel={t('Chat')} title={threadTitle(thread)} sub={thread.kind === 'dm' ? t('Direct message') : t('{0} · {1} people', audience(thread), members.length)}>
      <div className="wa-id">
        <ThreadAvatar thread={thread} size="lg" />
        {thread.groupType === 'work' && svc.canManageWork(thread) && (
          <>
            <GroupPhotoInput className="primary" onPick={(dataUrl) => { try { svc.setWorkPhoto(thread.id, dataUrl); setPhotoError(''); } catch (err) { setPhotoError(t(err.message)); } }} onError={setPhotoError}>
              {thread.avatar ? t('Change photo') : t('Add photo')}
            </GroupPhotoInput>
            {thread.avatar && <button type="button" className="text-btn" onClick={() => { try { svc.setWorkPhoto(thread.id, ''); setPhotoError(''); } catch (err) { setPhotoError(t(err.message)); } }}>{t('Remove photo')}</button>}
            {photoError ? <p className="warn-text">{photoError}</p> : null}
          </>
        )}
        <b>{threadTitle(thread)}</b>
        <span>{about}</span>
      </div>
      <h2 className="sect">{t('Media, links and docs')}</h2>
      <div className="media-tabs">
        {['Photos', 'Files', 'Links', 'Voice', 'Drawings'].map((k) => (
          <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setSample(null); }}>{t(k)}</button>
        ))}
      </div>
      {sample ? (
        <button type="button" className="media-open" onClick={() => setSample(null)}>
          <Swatch hue={sample.hue} seed={sample.seed} />
          <span>{sample.title}</span>
        </button>
      ) : null}
      {(tab === 'Photos' || tab === 'Links') && media.length ? (
        <div className="media-strip">
          {media.map((m) => (
            <Link key={m.id} to={`${chatTo}#${m.id}`} aria-label={m.link?.title || m.text || t('Photo')}>
              {m.photo?.dataUrl ? <img src={m.photo.dataUrl} alt="" /> : <Swatch hue={m.photo?.hue ?? m.link?.hue} seed={m.photo?.seed ?? m.link?.seed} />}
            </Link>
          ))}
        </div>
      ) : (tab === 'Photos' || tab === 'Links') && (
        <div className="media-strip">
          {samples.map((item) => (
            <button type="button" key={item.title} onClick={() => setSample(item)} aria-label={item.title} aria-pressed={sample?.title === item.title}>
              <Swatch hue={item.hue} seed={item.seed} />
            </button>
          ))}
        </div>
      )}
      {tab !== 'Photos' && tab !== 'Links' && !docs.length && !placeholders.length && <p className="note">{t('Nothing here yet.')}</p>}
      {tab !== 'Photos' && tab !== 'Links' && !docs.length && placeholders.map((item) => (
        <div className="day-row" key={item.title}>
          <div>
            <b>{item.kind}</b>
            <span>{item.title}</span>
          </div>
        </div>
      ))}
      {tab !== 'Photos' && tab !== 'Links' && docs.map((m) => (
        <Link key={m.id} className="day-row" to={`${chatTo}#${m.id}`}>
          <div>
            <b>{m.voice ? t('Voice note') : t('File')}</b>
            <span>{m.text || (typeof m.voice === 'string' ? m.voice : m.voice?.dur) || t('Shared in this chat')}</span>
          </div>
        </Link>
      ))}
      {thread.projectId && thread.kind !== 'dm' && thread.groupType !== 'work' && (
        <>
          <h2 className="sect">{t('Work groups')}</h2>
          <p className="note">{t('Private chats. Only the people you add can see one. A work group is not a project task.')}</p>
          <Link className="primary" to={`/mobile/chats/${thread.id}/work`}>{t('Create work group')}</Link>
          {svc.threads().filter((item) => item.groupType === 'work' && item.projectId === thread.projectId).map((group) => {
            const task = svc.tasks({ projectId: thread.projectId, all: true }).find((item) => item.id === group.taskId);
            const same = task && task.title.trim().toLowerCase() === group.name.trim().toLowerCase();
            return (
              <Link className="row" key={group.id} to={`/mobile/chats/${group.id}`}>
                <span className="row-copy"><b>{group.name}</b><span>{same ? t('Private chat · {0}', taskStageLabel(task)) : task ? t('For the task “{0}”', task.title) : t('Private chat')}</span></span>
              </Link>
            );
          })}
          <h2 className="sect">{t('Tasks')}</h2>
          <p className="note">{t('Jobs already on this project. Start a work group only when that job needs its own chat.')}</p>
          {svc.tasks({ projectId: thread.projectId, all: true }).filter((task) => !svc.workGroupForTask(task.id)).map((task) => {
            const taken = Boolean(svc.workGroupRecord(task.id));
            const body = <span className="row-copy"><b>{task.title}</b><span>{t('Task ·')}{' '}{taskStageLabel(task)}{taken ? t(' · Already has a work group') : ''}</span></span>;
            return taken
              ? <div className="row" key={task.id}>{body}</div>
              : <Link className="row" key={task.id} to={`/mobile/chats/${thread.id}/work?task=${task.id}`}>{body}</Link>;
          })}
        </>
      )}
      <h2 className="sect">{t('Options')}</h2>
      <button type="button" className="day-row" onClick={() => {
        svc.setChatMuted(threadId, !muted);
      }}>
        <div>
          <b>{t('Mute notifications')}</b>
          <span>{t('Stops the unread mark on this phone')}</span>
        </div>
        <span className="day-acts">{muted ? t('On') : t('Off')}</span>
      </button>
      {pinned.map((m) => (
        <Link className="day-row" key={m.id} to={`${chatTo}#${m.id}`}>
          <div>
            <b>{t('Pinned decision')}</b>
            <span>{m.text || t('Decision')}</span>
          </div>
        </Link>
      ))}
      <h2 className="sect">{thread.kind === 'dm' ? t('Contact') : t('{0} people', members.length)}</h2>
      {svc.canInvite(thread) && (
        <button type="button" className="row add-people" onClick={() => setAdding(true)}>
          <span className="round" aria-hidden="true"><Icon name="plus" /></span>
          <span className="row-copy"><b>{t('Add people')}</b></span>
        </button>
      )}
      {members.map((u) => (
        <div className="day-row" key={u.id}>
          <div className="person-line">
            <Avatar person={u} />
            <span className="row-copy"><b>{u.name}</b><span>{u.title} · {phoneOf(u)}</span></span>
          </div>
          {u.id !== state.userId ? <a className="day-acts" href={`tel:${phoneOf(u).replace(/\s/g, '')}`}>{t('Call')}</a> : <span className="day-acts">{t('You')}</span>}
        </div>
      ))}
    </Page>
    {adding && <AddPeopleSheet thread={thread} onClose={() => setAdding(false)} />}
    </>
  );
}

// Add people to a group or project conversation. Each tap adds that person; the list keeps going until Done.
function AddPeopleSheet({ thread, onClose }) {
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const people = svc.invitablePeople(thread.id);
  const needle = q.trim().toLowerCase();
  const shown = people.filter((u) => !needle || `${u.name} ${u.title || ''}`.toLowerCase().includes(needle));
  function add(userId) {
    try {
      svc.inviteToGroup(thread.id, userId);
      setError('');
    } catch (e) {
      setError(t(e.message));
    }
  }
  return (
    <div className="sheet-back" onClick={onClose} role="presentation">
      <div className="sheet" role="dialog" aria-label={t('Add people')} onClick={(e) => e.stopPropagation()}>
        <h2>{t('Add people')}</h2>
        {error ? <p className="warn-text">{error}</p> : null}
        <p className="help">{svc.inviteHint(thread)}</p>
        <label className="search">
          <Icon name="search" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Name or role')} aria-label={t('Search people')} />
        </label>
        {shown.map((u) => (
          <button type="button" className="row" key={u.id} onClick={() => add(u.id)}>
            <Avatar person={u} />
            <span className="row-copy"><b>{u.name}</b><span>{u.title}</span></span>
          </button>
        ))}
        {!people.length && <p className="note">{t('Everyone available is already in this chat.')}</p>}
        {people.length > 0 && !shown.length && <p className="note">{t('No matches.')}</p>}
        <button type="button" className="primary" onClick={onClose}>{t('Done')}</button>
      </div>
    </div>
  );
}

export function WorkGroups() {
  const version = useStore();
  const { threadId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const parent = svc.thread(threadId);
  const tasks = useMemo(
    () => (parent && version != null ? svc.tasks({ projectId: parent.projectId, all: true }) : []),
    [parent, version],
  );
  const [taskId, setTaskId] = useState(params.get('task') || '');
  const [taskTitle, setTaskTitle] = useState('');
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState('');
  const [picked, setPicked] = useState([]);
  const [step, setStep] = useState(params.get('task') ? 'people' : 'list');
  const [error, setError] = useState('');
  const task = tasks.find((item) => item.id === taskId) || null;
  const people = parent ? svc.workMembers(parent.id).filter((u) => u.id !== state.userId) : [];
  const chosen = people.filter((u) => picked.includes(u.id));
  const existing = task ? svc.workGroupForTask(task.id) : null;
  const groups = parent ? svc.threads().filter((t) => t.groupType === 'work' && t.projectId === parent.projectId) : [];
  const openTasks = tasks.filter((item) => !svc.workGroupForTask(item.id));
  useEffect(() => {
    const preset = params.get('task');
    if (!preset) return;
    const open = svc.workGroupForTask(preset);
    if (open) navigate(`/mobile/chats/${open.id}`, { replace: true });
    else if (!name) {
      const presetTask = tasks.find((item) => item.id === preset);
      if (presetTask) setName(presetTask.title);
    }
  }, [params, navigate, tasks, name]);
  if (!parent || parent.kind === 'dm' || parent.groupType === 'work') {
    return <Page back="/mobile/chats" title={t('Work groups')}><div className="empty"><h3>{t('This group isn’t available')}</h3></div></Page>;
  }
  function chooseTask(id) {
    const next = tasks.find((item) => item.id === id);
    const open = svc.workGroupForTask(id);
    if (open) { navigate(`/mobile/chats/${open.id}`); return; }
    setTaskId(id);
    setName(next?.title || '');
    setPicked([]);
    setError('');
    setStep('people');
  }
  function create() {
    try {
      const thread = svc.createWorkGroup({ parentGroupId: parent.id, taskId, taskTitle, name, memberIds: picked, avatar: photo });
      navigate(`/mobile/chats/${thread.id}`);
    } catch (e) {
      setError(t(e.message));
    }
  }
  function continueNew(e) {
    e.preventDefault();
    if (!name.trim()) { setError(t('Give the work group a name.')); return; }
    const open = taskId && svc.workGroupForTask(taskId);
    if (open) { navigate(`/mobile/chats/${open.id}`); return; }
    if (taskId && svc.workGroupRecord(taskId)) { setError(t('This task already has a work group.')); return; }
    setError('');
    setStep('people');
  }
  const title = step === 'review' ? t('Review') : step === 'people' ? t('People') : t('New work group');
  const related = siblings(parent);
  if (step === 'list') {
    return (
      <div className="screen">
        <ThreadHeader thread={parent} />
        <div className="switcher" role="tablist" aria-label={t('Conversations in this project')}>
          {related.map((item) => (
            <Link key={item.id} role="tab" aria-selected={false} to={`/mobile/chats/${item.id}`}>{audience(item)}</Link>
          ))}
          <Link role="tab" aria-selected className="on" to={`/mobile/chats/${parent.id}/work`}>{t('Work groups')}</Link>
        </div>
        <div className="body canvas">
          {error ? <p className="warn-text">{error}</p> : null}
          <div className="work-board">
            {svc.canManageWork(parent) && <button type="button" className="primary" onClick={() => { setTaskId(''); setError(''); setStep('task'); }}>{t('New work group')}</button>}
            {groups.length > 0 && <p className="work-label">{t('Work groups')}</p>}
            {groups.map((group) => {
              const linked = tasks.find((item) => item.id === group.taskId);
              return (
                <button type="button" className="row" key={group.id} onClick={() => navigate(`/mobile/chats/${group.id}`)}>
                  <ThreadAvatar thread={group} />
                  <span className="row-copy"><b>{group.name}</b><span>{linked && linked.title.trim().toLowerCase() !== group.name.trim().toLowerCase() ? t('For the task “{0}”', linked.title) : t('Private chat{0}', linked ? ` · ${taskStageLabel(linked)}` : '')}</span></span>
                </button>
              );
            })}
            <p className="work-label">{t('Tasks')}</p>
            <p className="note">{t('Project jobs that do not have a private chat yet.')}</p>
            {openTasks.map((item) => {
              const taken = Boolean(svc.workGroupRecord(item.id));
              return (
                <button type="button" className="row" key={item.id} disabled={taken} onClick={() => !taken && chooseTask(item.id)}>
                  <span className="row-copy"><b>{item.title}</b><span>{taken ? t('Already has a work group') : taskStageLabel(item)}</span></span>
                </button>
              );
            })}
            {!openTasks.length && <p className="note">{t('Every task here already has a work group.')}</p>}
          </div>
        </div>
      </div>
    );
  }
  return (
    <Page className="work-flow" stackTitle back={`/mobile/chats/${parent.id}/work`} backLabel={t('Work groups')} title={title} sub={parent.name}>
      <button type="button" className="work-back" onClick={() => { setError(''); setStep(step === 'review' ? 'people' : 'list'); }}>{step === 'review' ? t('Edit people') : t('Back')}</button>
      {error ? <p className="warn-text">{error}</p> : null}
      {step === 'task' && (
        <form className="stack work-review" onSubmit={continueNew}>
          <p className="help">{t('New work group in {0}, inside {1}.', projectName(parent.projectId), parent.name)}</p>
          <div className="person-line">
            {photo ? <span className="av lg"><img src={photo} alt="" /></span> : <span className="av lg">{(name.trim() || 'W').slice(0, 1).toUpperCase()}</span>}
          </div>
          <GroupPhotoInput className="text-btn" onPick={(dataUrl) => { setPhoto(dataUrl); setError(''); }} onError={setError}>
            {photo ? t('Change photo') : t('Add photo')}
          </GroupPhotoInput>
          {photo ? <button type="button" className="text-btn" onClick={() => setPhoto('')}>{t('Remove photo')}</button> : null}
          <label>{t('Work group name')}<input aria-label={t('Work group name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Kitchen island installation')} /></label>
          <label>{t('Task')}
            <Select className="field-select" aria-label={t('Task')} value={taskId} onChange={(e) => { setTaskId(e.target.value); setError(''); }}>
              <option value="">{t('New task on this project')}</option>
              {tasks.map((item) => {
                const open = svc.workGroupForTask(item.id);
                return <option key={item.id} value={item.id}>{item.title}{open ? t(' · already has a work group') : ''}</option>;
              })}
            </Select>
          </label>
          {!taskId && <label>{t('Task name')}<input aria-label={t('Task name')} value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder={t('Leave blank to use the work group name')} /></label>}
          <button className="primary" type="submit">{t('Continue')}</button>
        </form>
      )}
      {step === 'people' && (
        <form className="stack work-review" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) { setError(t('Give the work group a name.')); return; } if (!picked.length) { setError(t('Add at least one person from this group.')); return; } setError(''); setStep('review'); }}>
          <label>{t('Work group name')}<input aria-label={t('Work group name')} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <p className="help">{task ? t('Linked to {0}', task.title) : t('New task: {0}', taskTitle.trim() || name)}{t('. Choose people from')}{' '}{parent.name}.</p>
          {people.map((u) => {
            const on = picked.includes(u.id);
            return (
              <button type="button" key={u.id} className={`row ${on ? 'picked' : ''}`} onClick={() => setPicked((ids) => on ? ids.filter((id) => id !== u.id) : [...ids, u.id])}>
                <Avatar person={u} />
                <span className="row-copy"><b>{u.name}</b><span>{u.title}</span></span>
                <span className="pick" aria-hidden="true">{on ? <Icon name="check" /> : null}</span>
              </button>
            );
          })}
          {!people.length && <p className="note">{t('No one else is in this group.')}</p>}
          <button className="primary" type="submit">{t('Review')}</button>
        </form>
      )}
      {step === 'review' && (
        <div className="work-review">
          <div className="work-id">
            {photo ? <span className="av"><img src={photo} alt="" /></span> : <span className="av">{(name.trim() || 'W').slice(0, 1).toUpperCase()}</span>}
            <h2>{name}</h2>
            <p>{task?.title || taskTitle.trim() || name}</p>
            <p className="work-where">{task ? taskStageLabel(task) : t('New task')} · {parent.name}</p>
          </div>
          <h3>{t('Who can see this')}</h3>
          {[{ ...user(state.userId), you: true }, ...chosen].map((u) => (
            <div className="work-person" key={u.id}>
              <Avatar person={u} />
              <span><b>{u.name}</b><span>{u.you ? t('You') : u.title}</span></span>
            </div>
          ))}
          <p className="work-private">{t('Only these people see the messages. The rest of {0} does not.', parent.name)}</p>
          {existing ? <button type="button" className="primary" onClick={() => navigate(`/mobile/chats/${existing.id}`)}>{t('Open work group')}</button> : <button type="button" className="primary" onClick={create}>{t('Create work group')}</button>}
        </div>
      )}
    </Page>
  );
}

let playingNote = null;

export function VoicePlay({ src, dur = '' }) {
  const id = useId();
  const audioRef = useRef(null);
  const [on, setOn] = useState(false);
  useEffect(() => () => {
    if (playingNote?.id === id) {
      playingNote.el.pause();
      playingNote = null;
    }
  }, [id]);
  function play(e) {
    e.preventDefault();
    e.stopPropagation();
    const el = audioRef.current;
    if (!el || !src) return;
    if (on) {
      el.pause();
      el.currentTime = 0;
      if (playingNote?.id === id) playingNote = null;
      setOn(false);
      return;
    }
    if (playingNote && playingNote.id !== id) {
      playingNote.el.pause();
      playingNote.el.currentTime = 0;
      playingNote.setOn(false);
    }
    el.play().then(() => {
      playingNote = { id, el, setOn };
      setOn(true);
    }).catch(() => setOn(false));
  }
  return (
    <button type="button" className={`voice-play ${on ? 'on' : ''}`} onPointerDown={(e) => e.stopPropagation()} onClick={play} aria-label={on ? t('Stop voice note') : t('Play voice note')}>
      <audio ref={audioRef} className="voice-audio" src={src || undefined} preload="none" onEnded={() => { if (playingNote?.id === id) playingNote = null; setOn(false); }} />
      <span className="voice-go" aria-hidden="true">{on ? <i className="pause" /> : <Icon name="play" />}</span>
      <span className="voice-track" />
      <span className="voice-dur">{dur}</span>
    </button>
  );
}

export function Voice() {
  useStore();
  const { threadId } = useParams();
  const navigate = useNavigate();
  const thread = svc.thread(threadId);
  const [phase, setPhase] = useState('idle');
  const [audio, setAudio] = useState('');
  const [dur, setDur] = useState('0:00');
  const [micNote, setMicNote] = useState('');
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const chunks = useRef([]);
  const timer = useRef(null);
  const started = useRef(0);
  useEffect(() => () => {
    clearInterval(timer.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);
  if (!thread) return <Page back="/mobile/chats" title={t('Voice')}><div className="empty"><h3>{t('This chat isn’t available')}</h3></div></Page>;

  const clock = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  async function start() {
    setMicNote('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = window.MediaRecorder?.isTypeSupported?.('audio/webm') ? 'audio/webm' : '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          setAudio(String(reader.result || ''));
          setPhase('ready');
        };
        reader.readAsDataURL(blob);
      };
      recRef.current = rec;
      started.current = Date.now();
      setDur('0:00');
      timer.current = setInterval(() => setDur(clock(Date.now() - started.current)), 200);
      rec.start();
      setPhase('recording');
    } catch {
      setMicNote(t('The microphone did not open. Allow the microphone, then try again.'));
    }
  }

  function stop() {
    clearInterval(timer.current);
    setDur(clock(Date.now() - started.current));
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
  }

  function again() {
    setAudio('');
    setDur('0:00');
    setPhase('idle');
  }

  return (
    <Page back={`/mobile/chats/${threadId}`} backLabel={t('Chat')} title={t('Voice note')} sub={threadTitle(thread)}>
      {phase === 'idle' && (
        <div className="stack">
          <Note>{t('Tap once to record. You can listen to it, then send it into this chat.')}</Note>
          <button type="button" className="primary" onClick={start}>{t('Tap to record')}</button>
          {micNote ? <p className="note">{micNote}</p> : null}
        </div>
      )}
      {phase === 'recording' && (
        <div className="stack">
          <p className="voice-line">{t('Recording · {0}', dur)}</p>
          <button type="button" className="primary" onClick={stop}>{t('Stop')}</button>
        </div>
      )}
      {phase === 'ready' && (
        <form className="stack" onSubmit={(e) => {
          e.preventDefault();
          if (!audio) return;
          postMessage(threadId, { voice: { dur, audio } });
          navigate(`/mobile/chats/${threadId}`);
        }}>
          <VoicePlay src={audio} dur={dur} />
          <Note>{t('Tap play to hear the recording, then send it.')}</Note>
          <button className="primary" type="submit">{t('Send to this chat')}</button>
          <button type="button" className="text-btn" onClick={again}>{t('Record again')}</button>
        </form>
      )}
    </Page>
  );
}

function reminderAt(which) {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  if (which === 'monday') {
    do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 1);
  } else {
    d.setDate(d.getDate() + 1);
  }
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T09:00`;
}

export function MessageActions({ thread, message, onReply, onDeleted, onForward }) {
  useStore();
  const filing = state.filings?.[message.id];
  const [edit, setEdit] = useState(message.text || '');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);
  const [reminded, setReminded] = useState('');
  const mine = message.by === state.userId;
  const canPin = !message.deleted && can('thread', 'w') && (state.role === 'partner' || state.role === 'site_manager');
  const others = (thread.memberIds || []).filter((id) => id !== message.by);
  if (confirmDelete) {
    return (
      <div className="msg-actions">
        <h2>{t('Delete this message?')}</h2>
        <button type="button" className="ghost warn-text" onClick={() => { hideMessage(message); onDeleted?.(); }}>{t('Delete for me')}</button>
        {mine && !message.deleted && (
          <button type="button" className="ghost warn-text" onClick={() => { deleteMessage(message); onDeleted?.(); }}>{t('Delete for everyone')}</button>
        )}
        <button type="button" className="ghost" onClick={() => setConfirmDelete(false)}>{t('Cancel')}</button>
      </div>
    );
  }
  return (
    <div className="msg-actions">
      {!message.deleted && (
        <div className="emoji-row" role="group" aria-label={t('Reactions')}>
          {REACTIONS.map(([emoji, label]) => (
            <button type="button" key={emoji} className={message.reactions?.[emoji]?.includes(state.userId) ? 'on' : ''} aria-label={label} onClick={() => toggleReaction(message, emoji)}><span aria-hidden="true">{emoji}</span>{label}</button>
          ))}
        </div>
      )}
      {filing && !message.deleted ? <p className="note">{t('Filed ·')}{' '}{filingLabel(filing) || t('this chat')}</p> : null}
      {!message.deleted && <button type="button" className="ghost" onClick={onReply}>{t('Reply')}</button>}
      {!message.deleted && <button type="button" className="ghost" onClick={onForward}>{t('Forward')}</button>}
      <button type="button" className="ghost warn-text" onClick={() => setConfirmDelete(true)}>{t('Delete')}</button>
      {!message.deleted && <Link className="ghost" to={`/mobile/chats/${thread.id}/messages/${message.id}/filing`}>{t('Change where this is filed')}</Link>}
      {message.issueId ? <Link className="ghost" to={`/mobile/issues/${message.issueId}`}>{t('Open linked issue')}</Link> : null}
      {!message.deleted && thread.projectId && svc.assistKinds().includes('followup') && (message.text || message.transcript) ? (
        <Link className="ghost" to={`/mobile/assist?kind=followup&message=${message.id}`}>{t('Suggest a follow-up')}</Link>
      ) : null}
      {!message.deleted && message.photo && svc.assistKinds().includes('concept') ? (
        <Link className="ghost" to={`/mobile/assist?kind=concept&message=${message.id}&project=${thread.projectId || ''}`}>{t('Finish palette from this photo')}</Link>
      ) : null}
      {canPin && (
        <button type="button" className="ghost" onClick={() => toggleDecision(message)}>{message.decision ? t('Unpin decision') : t('Pin as decision')}</button>
      )}
      <button type="button" className="ghost" onClick={() => setShowInfo((v) => !v)}>{t('Info · sent, delivered, read')}</button>
      {showInfo && (
        <article className="view-card">
          <p>{t('Sent · {0}', fmtT(message.at))}</p>
          <p>{t('Delivered · {0}', fmtT(message.at))}</p>
          {others.map((id) => {
            const person = user(id);
            const read = id.charCodeAt(0) % 3 !== 0;
            return <p key={id}>{person.name} · {read ? t('read {0}', fmtT(message.at)) : t('not yet read')}</p>;
          })}
        </article>
      )}
      {!message.deleted && !remindOpen && (
        <button type="button" className="ghost" onClick={() => setRemindOpen(true)}>{t('Remind me')}</button>
      )}
      {!message.deleted && remindOpen && (
        <>
          <button type="button" className="ghost" onClick={() => { svc.addFollowup(message.id, reminderAt('tomorrow')); setReminded(t('Reminder set for tomorrow at 9am.')); render(); }}>{t('Tomorrow 9am')}</button>
          <button type="button" className="ghost" onClick={() => { svc.addFollowup(message.id, reminderAt('monday')); setReminded(t('Reminder set for Monday at 9am.')); render(); }}>{t('Monday 9am')}</button>
        </>
      )}
      {reminded ? <p className="note">{reminded}</p> : null}
      {mine && !message.deleted && message.text && !message.voice && !editing && (
        <button type="button" className="ghost" onClick={() => setEditing(true)}>{t('Edit')}</button>
      )}
      {mine && !message.deleted && message.text && !message.voice && editing && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); editMessage(message, edit); setEditing(false); }}>
          <label>{t('Edit')}<textarea rows={3} value={edit} onChange={(e) => setEdit(e.target.value)} aria-label={t('Edit message')} /></label>
          <button className="primary" type="submit">{t('Save')}</button>
        </form>
      )}
    </div>
  );
}

export function ForwardPick({ message, onClose }) {
  const navigate = useNavigate();
  const [picked, setPicked] = useState([]);
  function send() {
    const fields = { text: message.text || preview(message), forwarded: true };
    if (message.photo) fields.photo = message.photo;
    if (message.voice) fields.voice = message.voice;
    if (message.kind && !message.photo) fields.kind = message.kind;
    const sent = picked.filter((id) => postMessage(id, fields));
    onClose();
    if (sent.length === 1) navigate(`/mobile/chats/${sent[0]}`);
  }
  return (
    <>
      <header className="top">
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t('Back to chat')}><Icon name="back" /></button>
        <h1>{t('Forward to')}</h1>
      </header>
      <div className="body">
        {myThreads().map(({ t: dest }) => {
          const on = picked.includes(dest.id);
          const title = threadTitle(dest);
          return (
            <button type="button" key={dest.id} className={`row ${on ? 'picked' : ''}`} onClick={() => setPicked((ids) => on ? ids.filter((id) => id !== dest.id) : [...ids, dest.id])}>
              <ThreadAvatar thread={dest} />
              <span className="row-copy">
                <b><span>{title}</span></b>
                <span>{audience(dest)}</span>
              </span>
              <span className="pick" aria-hidden="true">{on ? <Icon name="check" /> : null}</span>
            </button>
          );
        })}
      </div>
      {picked.length > 0 && (
        <div className="composer">
          <span className="row-copy"><b>{t('{0} selected', picked.length)}</b></span>
          <button type="button" className="round send" aria-label={t('Forward message')} onClick={send}><Icon name="send" /></button>
        </div>
      )}
    </>
  );
}

function SiteReviewBlock({ messageId }) {
  const r = svc.siteUpdateReview(messageId);
  const [error, setError] = useState('');
  if (!r) return null;
  if (r.applied || r.message?.siteAnswer) return <p className="note">{t('Confirmed records · included in daily log')}</p>;
  if (!siteHasSuggestion(r)) return null;
  const s = r.suggestion;
  return (
    <div className="stack">
      <p className="note">{t('AI suggestion · demo. Check against the source; only selected records will be saved.')}</p>
      <button type="button" className="primary" onClick={() => {
        try {
          svc.saveSiteUpdate(messageId, {
            attendance: !!(r.canAttendance && s.headcount),
            headcount: s.headcount,
            delivery: !!(r.canDelivery && s.delivery),
            item: s.delivery?.item || '',
            received: s.delivery?.received || '',
            ordered: s.delivery?.ordered || '',
            unit: s.delivery?.unit || '',
            issue: !!(r.canIssue && s.issueTitle),
            title: s.issueTitle || '',
            issueId: '',
          });
          setError('');
          render();
        } catch (err) { setError(t(err.message)); }
      }}>{t('Confirm selected records')}</button>
      {error ? <p className="warn-text">{error}</p> : null}
    </div>
  );
}

export function MessagePage() {
  useStore();
  const { threadId, messageId } = useParams();
  const navigate = useNavigate();
  const thread = svc.thread(threadId);
  const message = messagesOf(threadId).find((m) => m.id === messageId);
  const [reply, setReply] = useState('');
  if (!thread || !message) return <Page back={`/mobile/chats/${threadId || ''}`} title={t('Message')}><div className="empty"><h3>{t('This message isn’t available')}</h3></div></Page>;
  return (
    <Page back={`/mobile/chats/${threadId}`} backLabel={t('Chat')} title={t('Message')} sub={`${firstName(message.by)} · ${fmtT(message.at)}`}>
      <article className="view-card">
        {message.deleted ? <p className="gone">{t('This message was deleted')}</p> : <p>{message.text}</p>}
        {message.edited ? <span>{t('Edited')}</span> : null}
      </article>
      <SiteReviewBlock messageId={message.id} />
      <MessageActions thread={thread} message={message} onReply={() => document.querySelector('[aria-label="Reply"]')?.focus()} onDeleted={() => navigate(`/mobile/chats/${threadId}`)} onForward={() => navigate(`/mobile/chats/${threadId}`, { state: { forward: message.id } })} />
      {!message.deleted && (
        <form className="stack" onSubmit={(e) => {
          e.preventDefault();
          if (!reply.trim()) return;
          postMessage(threadId, { text: reply.trim(), replyTo: messageId });
          navigate(`/mobile/chats/${threadId}`);
        }}>
          <label>{t('Reply')}<textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} aria-label={t('Reply')} /></label>
          <button className="primary" type="submit">{t('Send reply')}</button>
        </form>
      )}
    </Page>
  );
}

export function Filing() {
  useStore();
  const { threadId, messageId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const projects = svc.projects();
  const rooms = ['Kitchen', 'Living', 'Bathroom', 'Structure', 'Facade', 'Not set'];
  const kinds = Object.entries(FILE_KINDS);
  const current = state.filings?.[messageId] || {};
  const [projectId, setProjectId] = useState(current.projectId || projects[0]?.id || '');
  const [room, setRoom] = useState(current.room || 'Not set');
  const [kind, setKind] = useState(current.kind || 'note');
  const [drawing, setDrawing] = useState(current.drawing || '');
  const [error, setError] = useState('');
  const backTo = params.get('from') === 'chat' ? `/mobile/chats/${threadId}` : `/mobile/chats/${threadId}/messages/${messageId}`;
  return (
    <Page back={backTo} backLabel={params.get('from') === 'chat' ? t('Chat') : t('Message')} title={t('Where should this go?')}>
      <form className="stack" onSubmit={(e) => {
        e.preventDefault();
        try {
          const saved = svc.fileMessage(messageId, { projectId, room: room === 'Not set' ? '' : room, kind, drawing: drawing.trim() || null });
          if (!saved) throw new Error('Filing could not be saved on this device.');
          navigate(backTo);
        } catch (err) { setError(t(err.message)); }
      }}>
        <label>{t('Project')}
          <Select className="field-select" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label={t('Project')}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </label>
        <label>{t('Room')}
          <Select className="field-select" value={room} onChange={(e) => setRoom(e.target.value)} aria-label={t('Room')}>
            {rooms.map((r) => <option key={r}>{r}</option>)}
          </Select>
        </label>
        <label>{t('What is it')}
          <Select className="field-select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t('What is it')}>
            {kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </label>
        <label>{t('Drawing number')}<input value={drawing} onChange={(e) => setDrawing(e.target.value)} placeholder="HA-2401-A-101" aria-label={t('Drawing number')} /></label>
        {error ? <p className="warn-text">{error}</p> : null}
        <button className="primary" type="submit">{t('Save filing')}</button>
      </form>
    </Page>
  );
}

export function Issue() {
  useStore();
  const { issueId } = useParams();
  const [params] = useSearchParams();
  const from = params.get('from');
  const back = from && from.startsWith('/mobile/') ? from : '/mobile/today';
  const backLabel = backName(back);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const detail = svc.siteIssueDetails(issueId);
  if (!detail) return <Page sheet back={back} backLabel={backLabel} title={t('Issue')}><div className="empty"><h3>{t('This issue isn’t available')}</h3></div></Page>;
  const { issue } = detail;
  const here = `/mobile/issues/${issueId}${from ? `?from=${encodeURIComponent(from)}` : ''}`;
  return (
    <Page sheet stackTitle back={back} backLabel={backLabel} title={issue.title} sub={`${issue.status}${issue.due ? ` · reply by ${fmtT(issue.due)}` : ''}`}>
      <p className="note">{t('{0}{1} · raised by {2}', issue.type, issue.drawing ? ` · ${issue.drawing}` : '', firstName(issue.raisedBy))}</p>
      <section>
        <h2>{t('Linked site updates')}</h2>
        {detail.sources.map((m) => (
          <Link key={m.id} className="day-row" to={`/mobile/chats/${m.threadId}?from=${encodeURIComponent(here)}#${m.id}`}>
            <div>
              <b>{firstName(m.by)}</b>
              <span>{m.text}</span>
            </div>
          </Link>
        ))}
        {!detail.sources.length && <p className="note">{t('No site update linked.')}</p>}
      </section>
      <section>
        <h2>{t('Office answers')}</h2>
        {detail.answers.length ? detail.answers.map((m) => (
          <div key={m.id} className="day-row"><div><b>{firstName(m.by)}</b><span>{m.text}</span></div></div>
        )) : <p className="note">{t('No answer yet.')}</p>}
      {detail.canAnswer && (
        <form className="stack" onSubmit={(e) => {
          e.preventDefault();
          try { svc.answerSiteIssue(issueId, answer); setAnswer(''); setError(''); render(); }
          catch (err) { setError(t(err.message)); }
        }}>
          <label>{t('Office answer')}<textarea rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} /></label>
          {error ? <p className="warn-text">{error}</p> : null}
          <button className="primary" type="submit">{t('Send answer')}</button>
        </form>
      )}
      {svc.assistKinds().includes('ask') ? (
        <Link className="day-row" to={`/mobile/projects/${issue.projectId}/assist?kind=ask&issue=${issueId}&from=${encodeURIComponent(here)}`}>
          <b>{t('Summarise this issue')}</b>
          <span>{t('From the recorded history')}</span>
        </Link>
      ) : null}
      </section>
    </Page>
  );
}

export function Assist() {
  useStore();
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const kind = params.get('kind') || 'ask';
  const fromPage = params.get('from');
  const issueId = params.get('issue') || '';
  const drawingNo = params.get('drawing') || '';
  const sheetDrawing = drawingNo ? (svc.project(projectId)?.drawings || []).find((d) => d.no === drawingNo) : null;
  const messageId = params.get('message') || '';
  const projects = svc.projects();
  const sites = svc.sites();
  const [pid, setPid] = useState(params.get('project') || projectId || projects[0]?.id || '');
  const [siteId, setSiteId] = useState(params.get('site') || sites[0]?.id || '');
  const brief = issueId ? svc.siteIssueDetails(issueId) : null;
  const [question, setQuestion] = useState(issueId ? 'Summarise the recorded history of this issue.' : (params.get('q') || 'What is still open?'));
  const [picked, setPicked] = useState({});
  const [result, setResult] = useState(null);
  const [options, setOptions] = useState(null);
  const [owner, setOwner] = useState('');
  const [due, setDue] = useState(stamp().slice(0, 10));
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [sendTo, setSendTo] = useState('');
  const allowed = svc.assistKinds().includes(kind);
  const materials = svc.materials({ projectId: pid });
  const clientThread = svc.threads().find((t) => t.projectId === pid && t.kind === 'client');
  const clientMessages = clientThread ? messagesOf(clientThread.id).filter((m) => !m.deleted && (m.text || m.transcript)).slice(-12) : [];
  const photos = svc.threads().filter((t) => !pid || t.projectId === pid).flatMap((t) => messagesOf(t.id).filter((m) => m.photo && !m.deleted).map((m) => ({ ...m, threadName: threadTitle(t) })));
  const title = issueId ? t('Summarise this issue') : drawingNo ? t('Ask about this sheet') : {
    ask: t('Ask about this project'), compare: t('Compare materials'), daily: t('Review day report'),
    client: t('Client update'), concept: t('Finish palette'), followup: t('Suggested follow-up'),
  }[kind] || t('Draft');

  const messageThreadId = messageId ? state.db.MESSAGES.find((m) => m.id === messageId)?.threadId : '';
  const backTo = fromPage && fromPage.startsWith('/mobile/')
    ? fromPage
    : messageThreadId
      ? `/mobile/chats/${messageThreadId}`
      : projectId
        ? `/mobile/projects/${projectId}`
        : '/mobile/today';
  const chats = svc.threads().filter((t) => t.projectId === pid && ['client', 'internal', 'site'].includes(t.kind) && can('thread', 'w'));
  const chosen = chats.some((t) => t.id === sendTo) ? sendTo : (chats.find((t) => t.kind === 'internal') || chats.find((t) => t.kind === 'site') || chats[0])?.id || '';

  function sendQuestion() {
    const thread = chats.find((t) => t.id === chosen);
    const text = question.trim();
    if (!thread || !text) {
      setError(t('Write the question and choose who receives it.'));
      return;
    }
    if (!postMessage(thread.id, { text })) {
      setError(t('This conversation is not available to send to.'));
      return;
    }
    const backTo = fromPage && fromPage.startsWith('/mobile/') ? fromPage : `/mobile/projects/${pid}`;
    navigate(`/mobile/chats/${thread.id}?from=${encodeURIComponent(backTo)}`);
  }

  function sendPrepared() {
    const thread = chats.find((t) => t.id === chosen);
    const text = (result?.text || '').trim();
    if (!thread || !text) {
      setError(t('Choose who receives this draft.'));
      return;
    }
    if (!postMessage(thread.id, { text })) {
      setError(t('This conversation is not available to send to.'));
      return;
    }
    const backTo = fromPage && fromPage.startsWith('/mobile/') ? fromPage : `/mobile/projects/${pid}`;
    navigate(`/mobile/chats/${thread.id}?from=${encodeURIComponent(backTo)}`);
  }

  async function run(e) {
    e.preventDefault();
    setError('');
    setSaved('');
    try {
      const next = kind === 'compare'
        ? { projectId: pid, materialIds: Object.keys(picked).filter((id) => picked[id]) }
        : kind === 'daily'
          ? { siteId, date: stamp().slice(0, 10) }
          : kind === 'client'
            ? { threadId: clientThread?.id, messageIds: Object.keys(picked).filter((id) => picked[id]) }
            : kind === 'concept'
              ? { messageId: Object.keys(picked).find((id) => picked[id]) || messageId }
              : kind === 'followup'
                ? { messageId }
                : { projectId: pid, question, ...(issueId ? { issueId } : {}) };
      const draft = await svc.aiAssist(kind, next);
      setOptions(next);
      setResult(draft);
      setOwner(draft.proposal?.owners?.[0]?.id || '');
    } catch (err) { setError(t(err.message)); }
  }

  async function sendDraft() {
    setError('');
    try {
      await svc.sendAssist(kind, options, result.text, result.sources);
      render();
      navigate(`/mobile/chats/${result.destinationThreadId}`);
    } catch (err) { setError(t(err.message)); }
  }

  function saveFollowup(e) {
    e.preventDefault();
    setError('');
    try {
      svc.confirmFollowup({
        messageId,
        title: (result.proposal?.title || result.text || '').slice(0, 200),
        owner,
        due,
        reviewedSource: result.sources[0],
      });
      render();
      setSaved(t('Follow-up saved. It shows in Today for the person you chose.'));
    } catch (err) { setError(t(err.message)); }
  }

  return (
    <Page className="ask-screen" sheet stackTitle back={backTo} backLabel={issueId ? t('Issue') : drawingNo ? t('Drawing') : messageThreadId ? t('Chat') : t('Back')} title={title} sub={issueId ? (brief?.issue?.title || projectName(pid)) : drawingNo ? (sheetDrawing?.name || drawingNo) : projectName(pid)}>
      {issueId && !brief && <div className="empty"><h3>{t('This issue isn’t available')}</h3></div>}
      {drawingNo && !sheetDrawing && <div className="empty"><h3>{t('This sheet isn’t available')}</h3></div>}
      {!allowed && <div className="empty"><h3>{t('This draft isn’t available for you')}</h3><p>{t('Switch person if you need this action.')}</p></div>}
      {allowed && (!issueId || brief) && (!drawingNo || sheetDrawing) && (
        <form className="stack" onSubmit={run}>
          {issueId && brief && <p className="note">{t('{0}. This uses the recorded history of this issue only.', projectName(brief.issue.projectId))}</p>}
          {drawingNo && sheetDrawing && <p className="note">{t('{0} · {1}. This question is about this sheet.', projectName(projectId), drawingNo)}</p>}
          {!['daily', 'followup', 'concept'].includes(kind) && !issueId && !drawingNo && (
            <label>{t('Project')}
              <Select className="field-select" value={pid} onChange={(e) => { setPid(e.target.value); setPicked({}); }} aria-label={t('Project')}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </label>
          )}
          {kind === 'daily' && (
            <label>{t('Site')}
              <Select className="field-select" value={siteId} onChange={(e) => setSiteId(e.target.value)} aria-label={t('Site')}>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </label>
          )}
          {kind === 'ask' && !issueId && (
            <label>{t('Your question')}<textarea rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} /></label>
          )}
          {kind === 'ask' && (
            <>
              <h2>{t('Who receives this')}</h2>
              {chats.map((c) => (
                <button key={c.id} type="button" className={`ask-dest${chosen === c.id ? ' on' : ''}`} aria-pressed={chosen === c.id} onClick={() => setSendTo(c.id)}>
                  <b>{audience(c)}</b>
                  <span>{c.name}</span>
                  {chosen === c.id ? <em>{t('Sending here')}</em> : null}
                </button>
              ))}
              {!chats.length && <p className="note">{t('No conversation you can send this to.')}</p>}
              {!issueId && chats.length > 0 && <button type="button" className="primary" onClick={sendQuestion}>{t('Send question')}</button>}
            </>
          )}
          {kind === 'compare' && materials.map((m) => (
            <label key={m.id} className="check"><input type="checkbox" checked={!!picked[m.id]} onChange={(e) => setPicked({ ...picked, [m.id]: e.target.checked })} /> {m.name}</label>
          ))}
          {kind === 'client' && (
            clientMessages.length ? (
              <div className="pick-list">
                <p className="pick-lead">{t('Choose messages already shared with this client.')}</p>
                {clientMessages.map((m) => (
                  <label key={m.id} className={`pick-row${picked[m.id] ? ' on' : ''}`}>
                    <input type="checkbox" checked={!!picked[m.id]} onChange={(e) => setPicked({ ...picked, [m.id]: e.target.checked })} />
                    <span className="pick-copy">
                      <b>{m.text || m.transcript}</b>
                      <small>{firstName(m.by)} · {fmtT(m.at)}</small>
                    </span>
                  </label>
                ))}
              </div>
            ) : <p className="note">{t('No client conversation to draft from.')}</p>
          )}
          {kind === 'concept' && !messageId && (
            photos.length ? photos.slice(0, 8).map((m) => (
              <label key={m.id} className="check"><input type="radio" name="concept" checked={!!picked[m.id]} onChange={() => setPicked({ [m.id]: true })} /> {m.threadName}: {(m.text || 'Photo').slice(0, 80)}</label>
            )) : <p className="note">{t('Send a photo in a project chat first.')}</p>
          )}
          {error ? <p className="warn-text">{error}</p> : null}
          <button className="primary ask-draft" type="submit">{issueId ? t('Prepare issue brief') : t('Prepare draft')}</button>
        </form>
      )}
      {result && (
        <article className="view-card">
          <b>{t('AI draft · demo')}</b>
          <p style={{ whiteSpace: 'pre-wrap' }}>{result.text}</p>
          {result.concepts?.map((c) => (
            <p key={c.name}><b>{c.name}</b> · {c.note}</p>
          ))}
          {result.missing?.length ? <p className="warn-text">{result.missing.join(' ')}</p> : null}
          {['daily', 'client'].includes(kind) && (
            <button type="button" className="primary" onClick={sendDraft}>{t('Send this draft')}</button>
          )}
          {kind === 'ask' && chats.length > 0 && (
            <button type="button" className="primary" onClick={sendPrepared}>{t('Send this draft to {0}', audience(chats.find((t) => t.id === chosen)))}</button>
          )}
        </article>
      )}
      {result && kind === 'followup' && (
        <form className="stack" onSubmit={saveFollowup}>
          <label>{t('Who')}
            <Select className="field-select" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label={t('Owner')}>
              {(result.proposal?.owners || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </label>
          <label>{t('Needed by')}<input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label={t('Needed by')} /></label>
          {saved ? <p className="note">{saved}</p> : <button className="primary" type="submit">{t('Save follow-up')}</button>}
        </form>
      )}
    </Page>
  );
}

export function Call() {
  useStore();
  const { threadId } = useParams();
  const [params] = useSearchParams();
  const from = params.get('from');
  const backTo = from && from.startsWith('/mobile/') ? from : '';
  const [made, setMade] = useState(null);
  const [error, setError] = useState('');
  const voice = params.get('voice') === '1';
  const thread = svc.thread(threadId);
  if (!thread) return <Page back="/mobile/chats" title={t('Call')}><div className="empty"><h3>{t('This chat isn’t available')}</h3></div></Page>;
  const chatTo = `/mobile/chats/${threadId}${backTo ? `?from=${encodeURIComponent(backTo)}` : ''}`;
  if (voice) {
    const members = thread.memberIds.map((id) => user(id)).filter((u) => u?.id && u.id !== state.userId);
    return (
      <Page sheet stackTitle back={chatTo} backLabel={t('Chat')} title={t('Call')} sub={threadTitle(thread)}>
        <p className="note">{t('Phone someone in this chat.')}</p>
        {members.map((u) => (
          <div className="day-row" key={u.id}>
            <div className="person-line">
              <Avatar person={u} />
              <span className="row-copy"><b>{u.name}</b><span>{u.title} · {phoneOf(u)}</span></span>
            </div>
            <a className="day-acts" href={`tel:${phoneOf(u).replace(/\s/g, '')}`}>{t('Call')}</a>
          </div>
        ))}
      </Page>
    );
  }
  return (
    <Page back={`/mobile/chats/${threadId}${backTo ? `?from=${encodeURIComponent(backTo)}` : ''}`} backLabel={t('Chat')} title={t('Start video call')} sub={threadTitle(thread)}>
      <Note>{t('Posts a call card into this chat. Meet for the studio.')}</Note>
      {error ? <p className="warn-text">{error}</p> : null}
      <button type="button" className="primary" onClick={() => {
        try { setMade(svc.startCall(threadId)); setError(''); render(); }
        catch (err) { setError(t(err.message)); }
      }}>{t('Start Google Meet')}</button>
      {made ? <p className="note"><a href={made.url} target="_blank" rel="noopener noreferrer">{made.url}</a></p> : null}
    </Page>
  );
}

