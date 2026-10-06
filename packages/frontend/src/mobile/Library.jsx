import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../shared/store';
import { Page, Swatch, Note } from './frame';
import {
  photoItems, projectName, fmtDT, user, myThreads, threadTitle, postMessage, svc, can, render,
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
          <Link className="primary" to={`/mobile/photos/${item.id}/markup`}>Mark up</Link>
        ) : null}
        {item.markupOf ? <Link className="ghost" to={`/mobile/photos/${item.markupOf}`}>View original</Link> : null}
      </div>
    </Page>
  );
}

export function Markup() {
  useStore();
  const { photoId } = useParams();
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
    <Page back={`/mobile/photos/${photoId}`} backLabel="Photo" title="Mark up" sub={item?.title}>
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
  const videoRef = useRef(null);
  const [q, setQ] = useState('');
  const [shot, setShot] = useState('');
  const [live, setLive] = useState(false);
  const [camNote, setCamNote] = useState('');
  const threads = myThreads().filter(({ t }) => t.kind !== 'dm' && threadTitle(t).toLowerCase().includes(q.trim().toLowerCase()));

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
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setShot(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  function send(threadId) {
    postMessage(threadId, {
      text: 'Photo from site',
      photo: shot ? { dataUrl: shot, hue: 28, seed: 4 } : { hue: 28, seed: 4 },
      kind: 'photo',
    });
    navigate(`/mobile/chats/${threadId}`);
  }

  return (
    <Page back="/mobile/chats" backLabel="Chats" title="Send photo to" bare>
      {shot ? <img className="cam-view" src={shot} alt="Photo to send" /> : (
        <video className="cam-view" ref={videoRef} autoPlay playsInline muted />
      )}
      <div className="stack">
        {live && !shot && <button type="button" className="primary" onClick={capture}>Take photo</button>}
        {shot && <button type="button" className="ghost" onClick={() => setShot('')}>Retake</button>}
        <label className="ghost file-pick">Choose a photo<input type="file" accept="image/*" capture="environment" onChange={onFile} /></label>
        {camNote ? <p className="note">{camNote}</p> : null}
      </div>
      <label className="search">
        <input type="search" value={q} placeholder="Search chats" aria-label="Search chats" onChange={(e) => setQ(e.target.value)} />
      </label>
      <p className="note">{shot ? 'Send this photo to a chat.' : 'Or send the sample photo to a chat.'}</p>
      {threads.map(({ t }) => (
        <button type="button" className="row" key={t.id} onClick={() => send(t.id)}>
          <span className="av">{threadTitle(t).slice(0, 2).toUpperCase()}</span>
          <span className="row-copy"><b>{threadTitle(t)}</b><span>{t.name}</span></span>
        </button>
      ))}
      {!threads.length && <div className="empty"><h3>No chat matches</h3></div>}
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

