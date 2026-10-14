import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../shared/store';
import { Page, Swatch, Note, backName } from './frame';
import Icon from './Icon';
import PhotoEdit from './PhotoEdit';
import { ThreadAvatar } from './faces';
import {
  photoItems, projectName, fmtDT, user, myThreads, threadTitle, audience, postMessage, svc, can, render,
} from './model';
import { t } from '../shared/i18n';

function photoSearch(projectId, from) {
  const q = new URLSearchParams();
  if (projectId) q.set('project', projectId);
  if (from) q.set('from', from);
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function Photos() {
  useStore();
  const [params] = useSearchParams();
  const projectId = params.get('project') || '';
  const from = params.get('from');
  const back = from && from.startsWith('/mobile/') ? from : (projectId ? `/mobile/projects/${projectId}` : '/mobile/projects');
  const backLabel = from && from.startsWith('/mobile/') ? backName(from) : t('Back');
  const [filter, setFilter] = useState('all');
  const all = photoItems(projectId);
  const kinds = [...new Set(all.map((i) => i.kind))];
  const items = all.filter((i) => filter === 'all' || i.kind === filter);

  return (
    <Page back={back} backLabel={backLabel} title={t('Photos')} sub={t('{0} · {1} filed', projectId ? projectName(projectId) : t('All projects'), all.length)}>
      <div className="filters">
        <button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>{t('All')}</button>
        {kinds.map((k) => (
          <button type="button" key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{k}</button>
        ))}
      </div>
      {items.length ? (
        <div className="photo-grid">
          {items.map((i) => (
            <Link key={i.id} to={`/mobile/photos/${i.id}${photoSearch(projectId, from)}`} aria-label={i.title}>
              {i.dataUrl ? <img className="shot" src={i.dataUrl} alt="" /> : <Swatch hue={i.hue} seed={i.seed} />}
              <b>{i.markupOf ? t('Marked up') : i.kind}</b>
              <span>{[projectName(i.projectId).split(' ')[0], i.room].filter(Boolean).join(' · ') || i.src}</span>
            </Link>
          ))}
        </div>
      ) : <div className="empty"><h3>{t('Nothing here yet')}</h3><p>{t('Photos you send in chat land here, sorted by project and room.')}</p></div>}
    </Page>
  );
}

export function Photo() {
  useStore();
  const { photoId } = useParams();
  const [params] = useSearchParams();
  const projectId = params.get('project') || '';
  const from = params.get('from');
  const item = photoItems(projectId).find((x) => x.id === photoId);
  if (!item) {
    return <Page back="/mobile/photos" title={t('Photo')}><div className="empty"><h3>{t('This photo isn’t available')}</h3></div></Page>;
  }
  const back = `/mobile/photos${photoSearch(projectId, from)}`;
  return (
    <Page back={back} backLabel={t('Photos')} title={item.kind} sub={`${item.src} · ${fmtDT(item.at)}`}>
      <div className="view-card">
        {item.dataUrl ? <img className="shot" src={item.dataUrl} alt="" /> : <Swatch hue={item.hue} seed={item.seed} />}
        <p>{item.title}</p>
        <dl className="kv">
          <dt>{t('Project')}</dt><dd>{projectName(item.projectId) || t('Not set')}</dd>
          <dt>{t('Room')}</dt><dd>{item.room || t('Not set')}</dd>
          <dt>{t('Type')}</dt><dd>{item.kind}</dd>
          {item.by ? <><dt>{t('From')}</dt><dd>{user(item.by).name}</dd></> : null}
          {item.filing?.drawing ? <><dt>{t('Drawing')}</dt><dd>{item.filing.drawing}</dd></> : null}
          {item.decided ? <><dt>{t('Status')}</dt><dd>{t('Decided · on moodboard')}</dd></> : null}
        </dl>
        {item.msgId ? (
          <>
            <Link className="primary" to={`/mobile/chats/${item.threadId}/messages/${item.msgId}`}>{t('Change project or room')}</Link>
            <Link className="ghost" to={`/mobile/chats/${item.threadId}`}>{t('Open the chat')}</Link>
          </>
        ) : null}
        {!item.msgId && (item.kind === 'Photo' || item.kind === 'Video') && can('feed', 'w') ? (
          <Link className="primary" to={`/mobile/photos/${item.id}/markup${photoSearch(projectId, from)}`}>{t('Mark up')}</Link>
        ) : null}
        {item.markupOf ? <Link className="ghost" to={`/mobile/photos/${item.markupOf}`}>{t('View original')}</Link> : null}
      </div>
    </Page>
  );
}

export function Markup() {
  useStore();
  const { photoId } = useParams();
  const [params] = useSearchParams();
  const projectId = params.get('project') || '';
  const from = params.get('from');
  const navigate = useNavigate();
  const [note, setNote] = useState('Check this on site');
  const [error, setError] = useState('');
  const item = photoItems().find((x) => x.id === photoId);

  function save(e) {
    e.preventDefault();
    try {
      const rec = svc.markup(photoId, [{ type: 'note' }], note);
      render();
      navigate(`/mobile/photos/${rec.id}`);
    } catch (err) {
      setError(t(err.message) || t('Could not save the markup.'));
    }
  }

  return (
    <Page back={`/mobile/photos/${photoId}${photoSearch(projectId, from)}`} backLabel={t('Photo')} title={t('Mark up')} sub={item?.title}>
      <Note>{t('The original photo stays as it is. This saves a new marked copy.')}</Note>
      <form className="stack" onSubmit={save}>
        <label>{t('Note')}<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        {error ? <p className="warn-text">{error}</p> : null}
        <button className="primary" type="submit">{t('Save marked copy')}</button>
      </form>
    </Page>
  );
}

export function Camera() {
  useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preset = params.get('thread');
  const from = params.get('from');
  const backTo = from && from.startsWith('/mobile/') ? from : (preset ? `/mobile/chats/${preset}` : '/mobile/chats');
  const videoRef = useRef(null);
  const [q, setQ] = useState('');
  const [shot, setShot] = useState('');
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState('');
  const [dest, setDest] = useState(preset || '');
  const [live, setLive] = useState(false);
  const [camNote, setCamNote] = useState('');
  const all = myThreads();
  const threads = all.filter(({ t }) => `${threadTitle(t)} ${audience(t)} ${t.name}`.toLowerCase().includes(q.trim().toLowerCase()));

  useEffect(() => {
    let stream;
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia?.({ video: { facingMode: 'environment' }, audio: false })
      .then((next) => {
        if (cancelled) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = next;
        if (videoRef.current) videoRef.current.srcObject = next;
        setLive(true);
      })
      .catch(() => setCamNote(t('The camera did not open. Choose a photo from this device, or send the sample.')));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    setShot(canvas.toDataURL('image/jpeg', 0.72));
    setEditing(true);
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setShot(String(reader.result || ''));
      setEditing(true);
      if (!dest && preset) setDest(preset);
    };
    reader.readAsDataURL(file);
  }

  function who(thread) {
    if (thread.kind === 'group') return thread.name;
    return audience(thread);
  }

  function goesTo(thread) {
    const name = threadTitle(thread);
    if (thread.kind === 'client') return t('The client group for {0} will see this photo.', name);
    if (thread.kind === 'internal') return t('The office chat for {0} will see this. The client will not.', name);
    if (thread.kind === 'site') return t('The site team for {0} will see this photo.', name);
    if (thread.kind === 'group') return t('{0} will see this photo.', thread.name);
    return t('{0} will see this photo.', name);
  }

  function send() {
    if (!dest) return;
    const photo = shot.startsWith('data:') ? { dataUrl: shot, hue: 28, seed: 4 } : { hue: 28, seed: 4 };
    postMessage(dest, { text: caption.trim() || 'Photo from site', photo, kind: 'photo' });
    navigate(`/mobile/chats/${dest}`);
  }

  const chosen = all.find(({ t }) => t.id === dest)?.t;
  if (editing && shot) {
    return (
      <div className="screen">
        <PhotoEdit
          src={shot}
          onCancel={() => { setShot(''); setEditing(false); }}
          onSend={(dataUrl, words) => {
            if (preset) {
              postMessage(preset, { text: words.trim() || 'Photo from site', photo: { dataUrl, hue: 28, seed: 4 }, kind: 'photo' });
              navigate(`/mobile/chats/${preset}`);
              return;
            }
            setShot(dataUrl);
            setCaption(words);
            setEditing(false);
          }}
        />
      </div>
    );
  }
  return (
    <Page
      back={backTo}
      backLabel={from && from.startsWith('/mobile/') ? backName(from) : t('Chats')}
      title={shot ? t('Send this photo') : t('Camera')}
      bare
      footer={shot ? (
        <div className="cam-dock">
          <p>{chosen ? goesTo(chosen) : t('Tap a chat below, then send.')}</p>
          <button type="button" className="primary" disabled={!dest} onClick={send}>{t('Send')}</button>
        </div>
      ) : null}
    >
      {shot ? <img className="cam-preview" src={shot} alt={t('What you are about to send')} /> : (
        <video className="cam-view" ref={videoRef} autoPlay playsInline muted />
      )}
      {!shot && (
        <div className="stack cam-start">
          {live ? <button type="button" className="primary" onClick={capture}>{t('Take photo')}</button> : <p className="note">{camNote || t('The camera is opening.')}</p>}
          <label className="ghost file-pick">{t('Choose a photo')}<input type="file" accept="image/*" onChange={onFile} /></label>
          <button type="button" className="text-btn" onClick={() => { setShot('/images/p01.jpg'); setEditing(true); }}>{t('Use a sample photo')}</button>
          {live && camNote ? <p className="note">{camNote}</p> : null}
        </div>
      )}
      {shot && (
        <>
          <label className="cam-caption">
            {t('Add a note')}
            <input value={caption} placeholder={t('Optional')} aria-label={t('Note on the photo')} onChange={(e) => setCaption(e.target.value)} />
          </label>
          {preset && chosen ? null : (
            <>
              <p className="cam-ask">{t('Who should see this?')}</p>
              <label className="search">
                <input type="search" value={q} placeholder={t('Find a chat')} aria-label={t('Find a chat')} onChange={(e) => setQ(e.target.value)} />
              </label>
              {threads.map(({ t }) => (
                <button type="button" className={`row ${dest === t.id ? 'picked' : ''}`} key={t.id} onClick={() => setDest(t.id)}>
                  <ThreadAvatar thread={t} />
                  <span className="row-copy"><b>{threadTitle(t)}</b><span>{who(t)}</span></span>
                  <span className="pick" aria-hidden="true">{dest === t.id ? <Icon name="check" /> : null}</span>
                </button>
              ))}
              {!threads.length && <div className="empty"><h3>{t('No chat matches')}</h3></div>}
            </>
          )}
          <button type="button" className="text-btn cam-change" onClick={() => setEditing(true)}>{t('Edit photo')}</button>
          <button type="button" className="text-btn cam-change" onClick={() => setShot('')}>{t('Choose a different photo')}</button>
        </>
      )}
    </Page>
  );
}

export function Portfolio() {
  useStore();
  const list = svc.portfolio();
  return (
    <Page back="/mobile/projects" backLabel={t('Projects')} title={t('Studio portfolio')} sub={t('Completed work')}>
      {list.map((x) => (
        <article key={x.id} className="view-card">
          <Swatch hue={x.hue} seed={x.year} />
          <b>{x.name}</b>
          <span>{x.type} · {x.city} · {x.year}</span>
          <p>{x.blurb}</p>
        </article>
      ))}
      {!list.length && <div className="empty"><h3>{t('No portfolio projects published yet')}</h3></div>}
    </Page>
  );
}

