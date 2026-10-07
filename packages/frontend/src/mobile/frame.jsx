import { Link } from 'react-router-dom';
import { photoUrl } from '../ui/Ph';
import Icon from './Icon';

export function backName(url) {
  const path = (url || '').split('?')[0];
  if (path === '/mobile/updates') return 'Updates';
  if (path === '/mobile/today') return 'Today';
  if (path.startsWith('/mobile/issues/')) return 'Issue';
  if (path.includes('/changes')) return 'Changes';
  if (/\/drawings\/[^/]+/.test(path)) return 'Drawing';
  if (path.includes('/drawings')) return 'Drawings';
  if (path.includes('/people')) return 'People';
  if (path.includes('/refs')) return 'References';
  if (path.includes('/materials')) return 'Materials';
  if (path.startsWith('/mobile/photos')) return 'Photos';
  if (path.startsWith('/mobile/chats/')) return 'Chat';
  if (path.startsWith('/mobile/projects/')) return 'Project';
  if (path.startsWith('/mobile/chats')) return 'Chats';
  return 'Back';
}

export function Page({ back, backLabel = 'Back', title, sub, children, bare = false, sheet = false, stackTitle = false, footer = null }) {
  return (
    <div className="screen">
      <header className={`top thread-top${sheet ? ' proj-top' : ''}${stackTitle ? ' stack-top' : ''}`}>
        <Link className="icon-btn" to={back} aria-label={backLabel === 'Back' ? 'Back' : `Back to ${backLabel}`}>
          <Icon name="back" />{sheet ? null : <span>{backLabel}</span>}
        </Link>
        <div className="thread-heading">
          <h1>{title}</h1>
          {sub ? <span>{sub}</span> : null}
        </div>
      </header>
      <div className={`${bare ? 'body' : 'body canvas'}${sheet ? ' proj' : ''}`}>{children}</div>
      {footer}
    </div>
  );
}

export function Swatch({ hue = 28, seed = 1 }) {
  return <img className="shot" src={photoUrl(hue, seed)} alt="" />;
}

export function Note({ children }) {
  return <p className="note">{children}</p>;
}
