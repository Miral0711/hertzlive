import { Link } from 'react-router-dom';
import { photoUrl } from '../ui/Ph';
import Icon from './Icon';
import { t } from '../shared/i18n';

export function backName(url) {
  const path = (url || '').split('?')[0];
  if (path === '/mobile/updates') return t('Updates');
  if (path === '/mobile/today') return t('Today');
  if (path.startsWith('/mobile/issues/')) return t('Issue');
  if (path.includes('/changes')) return t('Changes');
  if (/\/drawings\/[^/]+/.test(path)) return t('Drawing');
  if (path.includes('/drawings')) return t('Drawings');
  if (path.includes('/people')) return t('People');
  if (path.includes('/refs')) return t('References');
  if (path.includes('/materials')) return t('Materials');
  if (path.startsWith('/mobile/photos')) return t('Photos');
  if (path.startsWith('/mobile/chats/')) return t('Chat');
  if (path.startsWith('/mobile/projects/')) return t('Project');
  if (path === '/mobile/profile') return t('Profile');
  if (path.startsWith('/mobile/chats')) return t('Chats');
  return 'Back';
}

export function Page({ back, backLabel = 'Back', title, sub, children, bare = false, sheet = false, stackTitle = false, footer = null, className = '', board = false }) {
  return (
    <div className={`screen${className ? ` ${className}` : ''}`}>
      <header className={`top thread-top${sheet ? ' proj-top' : ''}${stackTitle ? ' stack-top' : ''}`}>
        <Link className="icon-btn" to={back} aria-label={backLabel === 'Back' || backLabel === t('Back') ? t('Back') : t('Back to {0}', backLabel)}>
          <Icon name="back" />{sheet ? null : <span>{backLabel}</span>}
        </Link>
        <div className="thread-heading">
          <h1>{title}</h1>
          {sub ? <span>{sub}</span> : null}
        </div>
      </header>
      <div className={`${bare ? 'body' : 'body canvas'}${sheet ? ' proj' : ''}${board ? ' hub' : ''}`}>{children}</div>
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
