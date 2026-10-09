import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Icon from '../ui/Icon';
import { Screen, TopBar, BackButton, backName } from '../ui/frame';
import { useField } from '../ui/FieldContext';
import { Avatar, ThreadAvatar } from '../ui/faces';
import { Link, useNavigate } from '../platform/router';
import { useStyles } from '../platform/theme';
import {
  myThreads, threadTitle, audience, preview, unreadCount, firstName, fmtT, me, svc, user, phoneOf, state, useStore, t,
} from '../store';
import { fmtD } from '../../../frontend/src/shared/core';
import { filingRules } from '../../../frontend/src/shared/filing';
import { ANNOUNCEMENTS } from '../../../frontend/src/desktop/data';
import { openExternal } from '../platform/router';

export default function Chats() {
  useStore();
  const { read, drafts } = useField();
  const [q, setQ] = useState('');
  const person = me();
  const rows = myThreads();
  const query = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (query.length < 1) return rows;
    return rows.filter(({ t: th, last }: any) => {
      const blob = `${threadTitle(th)} ${audience(th)} ${th.name} ${preview(last)}`.toLowerCase();
      return blob.includes(query);
    });
  }, [rows, query]);
  const hits = (query.length >= 2 ? svc.search(q) : []).filter((hit: any) => {
    if (hit.kind === 'project') return !svc.phoneHides(hit.id);
    if (!hit.threadId) return true;
    const thread = svc.thread(hit.threadId);
    return thread && !svc.phoneHides(thread.projectId);
  });
  const groups = ([
    ['Projects', filtered.filter(({ t: th }: any) => th.kind !== 'dm')],
    ['People', filtered.filter(({ t: th }: any) => th.kind === 'dm')],
  ] as [string, any[]][]).filter(([, list]) => list.length);

  const s = useStyles((c, th) => ({
    h1: { fontSize: 22, fontWeight: '600', color: c.ink },
    h1sub: { fontSize: 13, fontWeight: '500', color: c.ink3 },
    search: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 14, marginBottom: 6, paddingHorizontal: 12, minHeight: 42, borderRadius: th.radius.r2, backgroundColor: c.surface2 },
    input: { flex: 1, color: c.ink, fontSize: 16, paddingVertical: 8 },
    banner: { marginHorizontal: 14, marginVertical: 6, padding: 10, borderRadius: th.radius.r1, backgroundColor: c.warnSoft, color: c.warn },
    sect: { fontSize: 13, fontWeight: '600', color: c.ink3, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
    empty: { padding: 32, alignItems: 'center' },
    emptyH: { fontSize: 17, fontWeight: '600', color: c.ink, marginBottom: 6 },
    emptyP: { color: c.ink3, textAlign: 'center' },
  }));

  return (
    <Screen>
      <TopBar>
        <Text style={[s.h1, { flex: 1 }]} numberOfLines={1}>
          {t('chats')}
          {'\n'}
          <Text style={s.h1sub}>Hertz · {person ? firstName(person.id) : ''}</Text>
        </Text>
        <Link to="/mobile/camera" accessibilityLabel="Send a photo"><Icon name="camera" /></Link>
        <Link to="/mobile/profile?from=%2Fmobile%2Fchats" accessibilityLabel="Profile"><Avatar person={person} size="sm" /></Link>
      </TopBar>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={s.search}>
          <Icon name="search" size={18} />
          <TextInput
            style={s.input} value={q} onChangeText={setQ} autoCapitalize="none"
            placeholder="Search messages, photos, projects" accessibilityLabel="Search messages, photos, projects"
          />
        </View>
        {!state.online && <Text style={s.banner}>Your message will send when the network is back.</Text>}
        {hits.length > 0 && (
          <View>
            <Text style={s.sect}>In messages</Text>
            {hits.map((hit: any) => (
              <Row
                key={`${hit.kind}:${hit.id}`}
                to={hit.kind === 'project' ? `/mobile/projects/${hit.id}` : hit.threadId ? `/mobile/chats/${hit.threadId}#${hit.msgId}` : '/mobile/people'}
                title={hit.title} sub={hit.sub}
              />
            ))}
          </View>
        )}
        {groups.map(([name, list]) => (
          <View key={name}>
            <Text style={s.sect}>{name}</Text>
            {list.map(({ t: th, last }: any) => (
              <ChatRow key={th.id} thread={th} last={last} unread={unreadCount(th.id, read[th.id])} draft={drafts[th.id]} />
            ))}
          </View>
        ))}
        <FilingDesk />
        {!filtered.length && !hits.length && (
          <View style={s.empty}>
            <Text style={s.emptyH}>{query ? 'No matches' : 'No chats yet'}</Text>
            <Text style={s.emptyP}>{query ? 'Try a word from a message, a project, or a person’s name.' : 'Conversations you belong to will show up here.'}</Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function FilingDesk() {
  const rows = svc.threads().flatMap((th: any) => svc.messages(th.id)).map((m: any) => ({ m, f: state.filings[m.id] })).filter((x: any) => x.f);
  const check = rows.filter((x: any) => x.f.status !== 'filed');
  const rules = Object.entries(filingRules);
  const filed = rows.filter((x: any) => x.f.status === 'filed').slice(-5).reverse();
  const s = useStyles((c) => ({
    wrap: { margin: 14, padding: 12, borderRadius: 12, backgroundColor: c.surface2 },
    h: { fontWeight: '700', color: c.ink, marginTop: 8 },
    p: { color: c.ink2, fontSize: 13 },
  }));
  return (
    <View style={s.wrap}>
      <Text style={s.h}>Filing and announcements</Text>
      <Text style={s.p}>How the AI filed chat messages, and what still needs a person to check.</Text>
      <Text style={s.p}>{rows.length} looked at · {rows.filter((x: any) => x.f.by === 'ai' && x.f.status === 'filed').length} filed by AI · {check.length} need a check · {rows.filter((x: any) => x.f.by === 'user').length} corrected</Text>
      {check.map((x: any) => (
        <Link key={x.m.id} to={`/mobile/chats/${x.m.threadId}/messages/${x.m.id}/filing`}><Text style={s.p}>{firstName(x.m.by)} · {(x.m.text || '').slice(0, 80)}</Text></Link>
      ))}
      <Text style={s.h}>Rules the AI learned</Text>
      {rules.length ? rules.map(([k, p]) => <Text key={k} style={s.p}>{firstName(String(k).split('|')[0])} files to {String(p)}</Text>) : <Text style={s.p}>Correct a filing and the AI remembers it for that sender and thread.</Text>}
      <Text style={s.h}>Announcements</Text>
      {ANNOUNCEMENTS.length ? ANNOUNCEMENTS.map((a, i) => <Text key={i} style={s.p}>{a.text} · {firstName(a.by)} · {fmtD(a.at)}</Text>) : <Text style={s.p}>No announcements.</Text>}
      <Text style={s.h}>Recently filed</Text>
      {filed.map((x: any) => <Text key={x.m.id} style={s.p}>{(x.m.text || '').slice(0, 80)}</Text>)}
    </View>
  );
}

function Row({ to, title, sub }: { to: string; title: string; sub?: string }) {
  const s = useStyles((c) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
    b: { color: c.ink, fontWeight: '600' }, sub: { color: c.ink3, fontSize: 13 },
  }));
  return (
    <Link to={to} style={s.row}>
      <View style={{ flex: 1 }}><Text style={s.b}>{title}</Text><Text style={s.sub}>{sub}</Text></View>
    </Link>
  );
}

function ChatRow({ thread, last, unread, draft }: { thread: any; last: any; unread: number; draft?: string }) {
  const title = threadTitle(thread);
  const s = useStyles((c) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
    copy: { flex: 1, minWidth: 0 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
    title: { color: c.ink, fontSize: 16, fontWeight: unread ? '700' : '600', flexShrink: 1 },
    time: { color: c.ink3, fontSize: 12 },
    aud: { color: c.accentText, fontSize: 12 },
    prev: { color: c.ink2, fontSize: 14 },
    draft: { color: c.crit },
    count: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    countText: { color: c.accentInk, fontSize: 12, fontWeight: '700' },
  }));
  return (
    <Link to={`/mobile/chats/${thread.id}`} style={s.row}>
      <ThreadAvatar thread={thread} />
      <View style={s.copy}>
        <View style={s.head}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {last && <Text style={s.time}>{fmtT(last.at)}</Text>}
        </View>
        {thread.kind !== 'dm' && <Text style={s.aud}>{audience(thread)}</Text>}
        <Text style={[s.prev, draft ? s.draft : null]} numberOfLines={1}>
          {draft ? `Draft: ${draft}` : `${last && last.by && thread.kind !== 'dm' ? `${firstName(last.by)}: ` : ''}${preview(last)}`}
        </Text>
      </View>
      {unread > 0 && <View style={s.count}><Text style={s.countText}>{unread}</Text></View>}
    </Link>
  );
}

export function ThreadHeader({ thread, backTo = '/mobile/chats' }: { thread: any; backTo?: string }) {
  const navigate = useNavigate();
  const otherId = thread.kind === 'dm' ? thread.memberIds.find((id: string) => id !== state.userId) : null;
  const other = otherId ? user(otherId) : null;
  const query = backTo.startsWith('/mobile/') && backTo !== '/mobile/chats' ? `?from=${encodeURIComponent(backTo)}` : '';
  const infoTo = `/mobile/chats/${thread.id}/info${query}`;
  const voiceTo = `/mobile/chats/${thread.id}/call${query ? `${query}&voice=1` : '?voice=1'}`;
  const s = useStyles((c) => ({
    heading: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { flex: 1, minWidth: 0 },
    h1: { fontSize: 16, fontWeight: '600', color: c.ink },
    sub: { fontSize: 13, color: c.ink3 },
  }));
  return (
    <TopBar style={{ gap: 4, paddingRight: 6 }}>
      <BackButton to={backTo} label={backName(backTo)} showLabel={false} />
      <Link to={infoTo} style={s.heading}>
        <ThreadAvatar thread={thread} size="sm" />
        <View style={s.name}>
          <Text style={s.h1} numberOfLines={1}>{threadTitle(thread)}</Text>
          <Text style={s.sub} numberOfLines={1}>{audience(thread)}{thread.kind === 'dm' ? '' : ` · ${thread.memberIds.length} ${t('people')}`}</Text>
        </View>
      </Link>
      <Link to={`/mobile/chats/${thread.id}/call${query}`} accessibilityLabel="Video call"><Icon name="play" /></Link>
      {other ? (
        <Pressable onPress={() => openExternal(`tel:${phoneOf(other).replace(/\s/g, '')}`)} accessibilityLabel={`Call ${other.name}`}>
          <Icon name="call" />
        </Pressable>
      ) : (
        <Link to={voiceTo} accessibilityLabel="Voice call"><Icon name="call" /></Link>
      )}
    </TopBar>
  );
}
