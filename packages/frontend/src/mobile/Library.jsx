import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../shared/store';
import { Page, Swatch, Note } from './frame';
import Icon from './Icon';
import { ThreadAvatar } from './faces';
import {
  photoItems, projectName, fmtDT, user, myThreads, threadTitle, audience, postMessage, svc, can, render,
} from './model';

export function Photos() {
  useStore();
  const [params] = useSearchParams();
  const projectId = params.get('project') || '';
  const [filter, setFilter] = useState('all');
  const all = photoItems(projectId);
  const kinds = [...new Set(all.map((i) => i.kind))];
  const items = all.filter((i) => filter === 'all' || i.kind === filter);

  return (
    <Page back={projectId ? `/mobile/projects/${projectId}` : '/mobile/projects'} backLabel="Back" title="Photos" sub={`${projectId ? projectName(projectId) : 'All projects'} · ${all.length} filed`}>
      <div className="filters">
        <button type="button" className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
        {kinds.map((k) => (
          <button type="button" key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{k}</button>
        ))}
      </div>
      {items.length ? (
        <div className="photo-grid">
          {items.map((i) => (
            <Link key={i.id} to={`/mobile/photos/${i.id}${projectId ? `?project=${projectId}` : ''}`} aria-label={i.title}>
              {i.dataUrl ? <img className="shot" src={i.dataUrl} alt="" /> : <Swatch hue={i.hue} seed={i.seed} />}
              <b>{i.markupOf ? 'Marked up' : i.kind}</b>
              <span>{[projectName(i.projectId).split(' ')[0], i.room].filter(Boolean).join(' · ') || i.src}</span>
            </Link>
          ))}
        </div>
      ) : <div className="empty"><h3>Nothing here yet</h3><p>Photos you send in chat land here, sorted by project and room.</p></div>}
    </Page>
  );
}

export function Photo() {
  useStore();
  const { photoId } = useParams();
  const [params] = useSearchParams();
  const projectId = params.get('project') || '';
  const item = photoItems(projectId).find((x) => x.id === photoId);
  if (!item) {
    return <Page back="/mobile/photos" title="Photo"><div className="empty"><h3>This photo isn’t available</h3></div></Page>;
  }
  const back = `/mobile/photos${projectId ? `?project=${projectId}` : ''}`;
  return (
    <Page back={back} backLabel="Photos" title={item.kind} sub={`${item.src} · ${fmtDT(item.at)}`}>
      <div className="view-card">
        {item.dataUrl ? <img className="shot" src={item.dataUrl} alt="" /> : <Swatch hue={item.hue} seed={item.seed} />}
        <p>{item.title}</p>
        <dl className="kv">
          <dt>Project</dt><dd>{projectName(item.projectId) || 'Not set'}</dd>
          <dt>Room</dt><dd>{item.room || 'Not set'}</dd>
          <dt>Type</dt><dd>{item.kind}</dd>
          {item.by ? <><dt>From</dt><dd>{user(item.by).name}</dd></> : null}
          {item.filing?.drawing ? <><dt>Drawing</dt><dd>{item.filing.drawing}</dd></> : null}
          {item.decided ? <><dt>Status</dt><dd>Decided · on moodboard</dd></> : null}
        </dl>
        {item.msgId ? (
          <>
            <Link className="primary" to={`/mobile/chats/${item.threadId}/messages/${item.msgId}`}>Change project or room</Link>
            <Link className="ghost" to={`/mobile/chats/${item.threadId}`}>Open the chat</Link>
          </>
        ) : null}
        {!item.msgId && (item.kind === 'Photo' || item.kind === 'Video') && can('feed', 'w') ? (
          <Link className="primary" to={`/mobile/photos/${item.id}/markup${projectId ? `?project=${projectId}` : ''}`}>Mark up</Link>
        ) : null}
        {item.markupOf ? <Link className="ghost" to={`/mobile/photos/${item.markupOf}`}>View original</Link> : null}
      </div>
    </Page>
  );
}

export function Markup() {
  useStore();
  const { photoId } = useParams();
  const [params] = useSearchParams();
  const projectId = params.get('project') || '';
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
      setError(err.message || 'Could not save the markup.');
    }
  }

  return (
    <Page back={`/mobile/photos/${photoId}${projectId ? `?project=${projectId}` : ''}`} backLabel="Photo" title="Mark up" sub={item?.title}>
      <Note>The original photo stays as it is. This saves a new marked copy.</Note>
      <form className="stack" onSubmit={save}>
        <label>Note<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        {error ? <p className="warn-text">{error}</p> : null}
        <button className="primary" type="submit">Save marked copy</button>
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
      .catch(() => setCamNote('The camera did not open. Choose a photo from this device, or send the sample.'));
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
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setShot(String(reader.result || ''));
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
    if (thread.kind === 'client') return `The client group for ${name} will see this photo.`;
    if (thread.kind === 'internal') return `The office chat for ${name} will see this. The client will not.`;
    if (thread.kind === 'site') return `The site team for ${name} will see this photo.`;
    if (thread.kind === 'group') return `${thread.name} will see this photo.`;
    return `${name} will see this photo.`;
  }

  function send() {
    if (!dest) return;
    const photo = shot.startsWith('data:') ? { dataUrl: shot, hue: 28, seed: 4 } : { hue: 28, seed: 4 };
    postMessage(dest, { text: caption.trim() || 'Photo from site', photo, kind: 'photo' });
    navigate(`/mobile/chats/${dest}`);
  }

  const chosen = all.find(({ t }) => t.id === dest)?.t;
  return (
    <Page
      back={backTo}
      backLabel={from && from.startsWith('/mobile/projects') ? 'Project' : 'Chats'}
      title={shot ? 'Send this photo' : 'Camera'}
      bare
      footer={shot ? (
        <div className="cam-dock">
          <p>{chosen ? goesTo(chosen) : 'Tap a chat below, then send.'}</p>
          <button type="button" className="primary" disabled={!dest} onClick={send}>Send</button>
        </div>
      ) : null}
    >
      {shot ? <img className="cam-preview" src={shot} alt="What you are about to send" /> : (
        <video className="cam-view" ref={videoRef} autoPlay playsInline muted />
      )}
      {!shot && (
        <div className="stack cam-start">
          <p className="note">{preset ? 'This photo goes into the chat you opened. Take it or choose one, then press Send.' : 'After the photo, you choose the chat and press Send.'}</p>
          {live && <button type="button" className="primary" onClick={capture}>Take photo</button>}
          <label className="ghost file-pick">Choose a photo<input type="file" accept="image/*" onChange={onFile} /></label>
          <button type="button" className="text-btn" onClick={() => setShot('/images/p01.jpg')}>Use a sample photo</button>
          {camNote ? <p className="note">{camNote}</p> : null}
        </div>
      )}
      {shot && (
        <>
          <label className="cam-caption">
            Add a note
            <input value={caption} placeholder="Optional" aria-label="Note on the photo" onChange={(e) => setCaption(e.target.value)} />
          </label>
          {preset && chosen ? null : (
            <>
              <p className="cam-ask">Who should see this?</p>
              <label className="search">
                <input type="search" value={q} placeholder="Find a chat" aria-label="Find a chat" onChange={(e) => setQ(e.target.value)} />
              </label>
              {threads.map(({ t }) => (
                <button type="button" className={`row ${dest === t.id ? 'picked' : ''}`} key={t.id} onClick={() => setDest(t.id)}>
                  <ThreadAvatar thread={t} />
                  <span className="row-copy"><b>{threadTitle(t)}</b><span>{who(t)}</span></span>
                  <span className="pick" aria-hidden="true">{dest === t.id ? <Icon name="check" /> : null}</span>
                </button>
              ))}
              {!threads.length && <div className="empty"><h3>No chat matches</h3></div>}
            </>
          )}
          <button type="button" className="text-btn cam-change" onClick={() => setShot('')}>Choose a different photo</button>
        </>
      )}
    </Page>
  );
}

export function Portfolio() {
  useStore();
  const list = svc.portfolio();
  return (
    <Page back="/mobile/projects" backLabel="Projects" title="Studio portfolio" sub="Completed work">
      {list.map((x) => (
        <article key={x.id} className="view-card">
          <Swatch hue={x.hue} seed={x.year} />
          <b>{x.name}</b>
          <span>{x.type} · {x.city} · {x.year}</span>
          <p>{x.blurb}</p>
        </article>
      ))}
      {!list.length && <div className="empty"><h3>No portfolio projects published yet</h3></div>}
    </Page>
  );
}

