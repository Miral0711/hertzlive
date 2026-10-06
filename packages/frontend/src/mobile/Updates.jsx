import { Link } from 'react-router-dom';
import { useStore } from '../shared/store';
import Icon from './Icon';
import { updates, fmtD, me } from './model';

const ICONS = { decision: 'check', issue: 'warn', site: 'sites', client: 'chat', approval: 'check', enquiry: 'enquiries', people: 'people' };

export default function Updates() {
  useStore();
  const list = updates();
  const person = me();

  return (
    <div className="screen">
      <header className="top">
        <h1>Updates<span>What changed in your projects</span></h1>
        <Link className="icon-btn" to="/mobile/profile" aria-label="Profile">
          <span className="av sm">{person?.ini}</span>
        </Link>
      </header>
      <div className="body">
        <p className="note pad">Work that needs you stays on Today. This is the record of what already changed.</p>
        {list.map((u) => {
          const inner = (
            <>
              <span className="symbol"><Icon name={ICONS[u.kind] || 'bell'} /></span>
              <span className="row-copy">
                <small>{u.kind} · {fmtD(u.at)}</small>
                <b>{u.title}</b>
                <span>{u.detail}</span>
              </span>
            </>
          );
          return u.threadId ? (
            <Link key={u.id} className="row update" to={`/mobile/chats/${u.threadId}`}>{inner}</Link>
          ) : (
            <div key={u.id} className="row update">{inner}</div>
          );
        })}
        {!list.length && <div className="empty"><h3>No changes yet</h3><p>Office answers, drawing issues and decisions will land here.</p></div>}
      </div>
    </div>
  );
}
