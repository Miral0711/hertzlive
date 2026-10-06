import { Link } from 'react-router-dom';
import { useStore } from '../shared/store';
import Icon from './Icon';
import { updates, fmtD, me } from './model';
import { t } from './copy';
import { Avatar } from './faces';

const ICONS = { decision: 'check', issue: 'warn', site: 'sites', client: 'chat', approval: 'check', enquiry: 'enquiries', people: 'people' };

export default function Updates() {
  useStore();
  const list = updates();
  const person = me();

  return (
    <div className="screen">
      <header className="top">
        <h1>{t('updates')}<span>What changed in your projects</span></h1>
        <Link className="icon-btn" to="/mobile/profile" aria-label="Profile">
          <Avatar person={person} size="sm" />
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
          const to = u.issueId
            ? `/mobile/issues/${u.issueId}`
            : u.messageId
              ? `/mobile/chats/${u.threadId}#${u.messageId}`
              : u.threadId
                ? `/mobile/chats/${u.threadId}`
                : '';
          return to ? (
            <Link key={u.id} className="row update" to={to}>{inner}</Link>
          ) : (
            <div key={u.id} className="row update">{inner}</div>
          );
        })}
        {!list.length && <div className="empty"><h3>Nothing has changed yet</h3><p>Office answers, drawing issues and decisions will land here.</p></div>}
      </div>
    </div>
  );
}
