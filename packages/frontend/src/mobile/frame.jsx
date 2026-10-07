import { Link } from 'react-router-dom';
import { photoUrl } from '../ui/Ph';
import Icon from './Icon';

export function Page({ back, backLabel = 'Back', title, sub, children, bare = false, sheet = false, footer = null }) {
  return (
    <div className="screen">
      <header className={`top thread-top${sheet ? ' proj-top' : ''}`}>
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
