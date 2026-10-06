import { Link } from 'react-router-dom';
import Icon from './Icon';

export function Page({ back, backLabel = 'Back', title, sub, children, bare = false }) {
  return (
    <div className="screen">
      <header className="top thread-top">
        <Link className="icon-btn" to={back} aria-label={backLabel === 'Back' ? 'Back' : `Back to ${backLabel}`}>
          <Icon name="back" /><span>{backLabel}</span>
        </Link>
        <div className="thread-heading">
          <h1>{title}</h1>
          {sub ? <span>{sub}</span> : null}
        </div>
      </header>
      <div className={bare ? 'body' : 'body canvas'}>{children}</div>
    </div>
  );
}

export function Swatch({ hue = 28, seed = 1 }) {
  const light = 42 + ((seed || 1) % 5) * 6;
  return <span className="swatch" style={{ background: `hsl(${hue || 28} 38% ${light}%)` }} aria-hidden="true" />;
}

export function Note({ children }) {
  return <p className="note">{children}</p>;
}
