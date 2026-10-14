import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../shared/store';
import Icon from './Icon';
import { updates, fmtD, me, projectName } from './model';
import { t } from './copy';
import { Avatar } from './faces';

const KIND = () => ({
  decision: t('Decision'),
  issue: t('Issue'),
  answer: t('Office answer'),
  approval: t('Approval'),
  drawing: t('Drawing'),
  delivery: t('Delivery'),
  site: t('Site'),
  client: t('Client'),
  enquiry: t('Enquiry'),
  people: t('People'),
});

export default function Updates() {
  useStore();
  const list = updates();
  const person = me();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const q = query.trim().toLowerCase();
  const kinds = ['delivery', 'drawing', 'approval', 'decision', 'issue', 'answer', 'site', 'client', 'enquiry', 'people'].filter((item) => list.some((row) => row.kind === item));
  const shown = list.filter((item) => {
    if (kind !== 'all' && item.kind !== kind) return false;
    if (!q) return true;
    return [item.title, item.detail, item.projectId ? projectName(item.projectId) : '', KIND()[item.kind] || item.kind]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });
  const groups = [];
  const seen = new Map();
  shown.forEach((item) => {
    const key = item.projectId || 'studio';
    if (!seen.has(key)) {
      seen.set(key, groups.length);
      groups.push({ key, title: item.projectId ? projectName(item.projectId) : t('Studio'), items: [] });
    }
    groups[seen.get(key)].items.push(item);
  });

  return (
    <div className="screen">
      <header className="top">
        <h1>{t('updates')}<span>{t('What changed in your projects')}</span></h1>
        <Link className="icon-btn" to="/mobile/profile?from=%2Fmobile%2Fupdates" aria-label={t('Profile')}>
          <Avatar person={person} size="sm" />
        </Link>
      </header>
      <div className="body canvas proj hub">
        <p className="note">{t('The record of what already changed. Work that needs you stays on Today.')}</p>
        {list.length > 6 && (
          <label className="search">
            <Icon name="search" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Search updates')} aria-label={t('Search updates')} />
          </label>
        )}
        {kinds.length > 1 && (
          <div className="upd-kinds" role="tablist" aria-label={t('Update type')}>
            <button type="button" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>{t('All')}</button>
            {kinds.map((item) => (
              <button key={item} type="button" aria-pressed={kind === item} onClick={() => setKind(item)}>{KIND()[item] || item}</button>
            ))}
          </div>
        )}
        {groups.map((group) => (
          <section key={group.key}>
            <h2>{group.title}</h2>
            {group.items.map((item) => {
              const inner = (
                <div>
                  <small>{KIND()[item.kind] || item.kind} · {fmtD(item.at)}</small>
                  <b>{item.title}</b>
                  {item.detail ? <span>{item.detail}</span> : null}
                </div>
              );
              return item.to ? (
                <Link key={item.id} className="day-row" to={item.to}>{inner}</Link>
              ) : (
                <div key={item.id} className="day-row">{inner}</div>
              );
            })}
          </section>
        ))}
        {list.length > 0 && !shown.length && <div className="empty"><h3>{t('No update matches')}</h3></div>}
        {!list.length && <div className="empty"><h3>{t('Nothing has changed yet')}</h3><p>{t('Office answers, drawing issues and decisions will land here.')}</p></div>}
      </div>
    </div>
  );
}
