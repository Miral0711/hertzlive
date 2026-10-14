import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../ui/Icon';
import { Screen, TopBar, BackButton, backName } from '../ui/frame';
import { useField } from '../ui/FieldContext';
import { Avatar, ThreadAvatar } from '../ui/faces';
import { Empty, Field, IconBtn, Primary, Row, RowCopy, SearchBox, Sect, Select, WarnText } from '../ui/libraryKit';
import { Link, useNavigate } from '../platform/router';
import { useStyles, useTheme } from '../platform/theme';
import {
  myThreads, threadTitle, audience, preview, unreadCount, firstName, fmtT, me, svc, user, phoneOf, state, useStore, t,
} from '../store';
import { openExternal } from '../platform/router';
import { isProjectAudience, matchesChatFilter, recentChatRows } from '../../../frontend/src/shared/chatExtras';

const CHAT_FILTERS = () => ([
  ['all', t('All')],
  ['unread', t('Unread')],
  ['projects', t('Projects')],
  ['people', t('People')],
  ['groups', t('Groups')],
]);

export default function Chats() {
  useStore();
  const { read, drafts } = useField();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [panel, setPanel] = useState<string | null>(null);
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
  const listed = recentChatRows(filtered, {
    threadOf: (row: any) => row.t,
    atOf: (row: any) => row.last?.at || row.t.lastMessageAt || row.t.createdAt || '',
  });
  const visible = listed.filter(({ t: th }: any) => {
    if (!matchesChatFilter(th, filter)) return false;
    if (filter === 'unread' && projectUnread(th, read, rows) < 1) return false;
    return true;
  });
  const emptyTitle = query ? t('No matches') : filter === 'unread' ? t('No unread chats') : filter === 'projects' ? t('No projects') : filter === 'people' ? t('No people') : filter === 'groups' ? t('No groups') : t('No chats yet');

  const s = useStyles((c) => ({
    h1: { fontSize: 22, lineHeight: 24, fontWeight: '600', color: c.ink },
    h1sub: { fontSize: 13, fontWeight: '500', color: c.ink3 },
    banner: { paddingTop: 4, paddingHorizontal: 16, paddingBottom: 8, color: c.ink3, fontSize: 12, fontWeight: '500', textAlign: 'center' },
    filters: { gap: 8, paddingTop: 2, paddingHorizontal: 14, paddingBottom: 8 },
    chip: { minHeight: 32, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, backgroundColor: c.surface2, justifyContent: 'center' },
    chipOn: { backgroundColor: c.accent },
    chipText: { fontSize: 13, fontWeight: '600', color: c.ink2 },
    chipTextOn: { color: c.accentInk },
  }));

  return (
    <Screen>
      <TopBar>
        <Text style={[s.h1, { flex: 1 }]} numberOfLines={2}>
          {t('chats')}
          {'\n'}
          <Text style={s.h1sub}>{t('Hertz · {0}', person ? firstName(person.id) : '')}</Text>
        </Text>
        {svc.chatCreatable() && (
          <IconBtn name="plus" label={t('New chat')} onPress={() => setPanel(panel === 'menu' ? null : 'menu')} />
        )}
        <IconBtn name="camera" to="/mobile/camera" label={t('Send a photo')} />
        <Link to="/mobile/profile?from=%2Fmobile%2Fchats" accessibilityLabel={t('Profile')}><Avatar person={person} size="sm" /></Link>
      </TopBar>
      <ScrollView keyboardShouldPersistTaps="handled">
        <SearchBox value={q} onChangeText={setQ} placeholder={t('Search messages, photos, projects')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters} keyboardShouldPersistTaps="handled">
          {CHAT_FILTERS().map(([key, label]) => (
            <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: filter === key }} onPress={() => setFilter(key)} style={[s.chip, filter === key && s.chipOn]}>
              <Text style={filter === key ? s.chipTextOn : s.chipText}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {!state.online && <Text style={s.banner}>{t('Your message will send when the network is back.')}</Text>}
        {hits.length > 0 && (
          <View>
            <Sect>{t('In messages')}</Sect>
            {hits.map((hit: any) => (
              <Row
                key={`${hit.kind}:${hit.id}`}
                to={hit.kind === 'project' ? `/mobile/projects/${hit.id}` : hit.threadId ? `/mobile/chats/${hit.threadId}#${hit.msgId}` : '/mobile/people'}
              >
                <RowCopy title={hit.title} sub={hit.sub} />
              </Row>
            ))}
          </View>
        )}
        {visible.map(({ t: th, last }: any) => (
          <ChatRow key={th.projectId && isProjectAudience(th) ? `project:${th.projectId}` : th.id} thread={th} last={last} unread={projectUnread(th, read, rows)} draft={drafts[th.id]} />
        ))}
        {!visible.length && !hits.length && (
          <Empty title={emptyTitle}>{query ? t('Try a word from a message, a project, or a person’s name.') : t('Conversations you belong to will show up here.')}</Empty>
        )}
      </ScrollView>
      {panel === 'menu' && <ChatMenu onPick={setPanel} onClose={() => setPanel(null)} />}
      {panel && panel !== 'menu' && <ChatAdd panel={panel} onClose={() => setPanel(null)} />}
    </Screen>
  );
}

// The "+" dropdown: a small menu under the header button, like the prototype's .chat-menu.
function ChatMenu({ onPick, onClose }: { onPick: (panel: string) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { c, headerH } = useTheme();
  const s = useStyles((c) => ({
    menu: { position: 'absolute', right: 8, minWidth: 196, padding: 6, borderWidth: 1, borderColor: c.line, borderRadius: 12, backgroundColor: c.surface, elevation: 8, shadowColor: '#0c1e29', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    item: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8 },
    text: { color: c.ink, fontWeight: '600', fontSize: 16 },
  }));
  const items: [string, string][] = [['dm', t('New chat')], ['group', t('Create group')], ['invite', t('Invite a person')]];
  return (
    <Modal transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('Close')} />
      <View style={[s.menu, { top: insets.top + headerH - 4 }]} accessibilityRole="menu">
        {items.map(([key, label]) => (
          <Pressable key={key} accessibilityRole="menuitem" style={({ pressed }) => [s.item, pressed && { backgroundColor: c.surface2 }]} onPress={() => onPick(key)}>
            <Text style={s.text}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

function PersonRow({ u, onPress, picked, selectable }: { u: any; onPress: () => void; picked?: boolean; selectable?: boolean }) {
  const { c } = useTheme();
  const s = useStyles((c) => ({
    pick: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.line2, alignItems: 'center', justifyContent: 'center' },
    pickOn: { backgroundColor: c.accent, borderColor: c.accent },
  }));
  return (
    <Row onPress={onPress} picked={picked}>
      <Avatar person={u} />
      <RowCopy title={u.name} sub={u.title} />
      {selectable && <View style={[s.pick, picked && s.pickOn]}>{picked ? <Icon name="check" size={14} color={c.accentInk} /> : null}</View>}
    </Row>
  );
}

function ChatAdd({ panel, onClose }: { panel: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [groupType, setGroupType] = useState('general');
  const [projectId, setProjectId] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [groupId, setGroupId] = useState('');
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const projects = svc.projects().filter((p: any) => p && !svc.phoneHides(p.id));
  const mine = svc.myGroups();
  const group = mine.find((t: any) => t.id === groupId) || null;
  const people = panel === 'dm' ? svc.chatPeople()
    : panel === 'group' ? (groupType === 'project' ? svc.projectChatPeople(projectId) : svc.chatPeople())
      : group ? (group.groupType === 'project' || (!group.groupType && group.projectId) ? svc.projectChatPeople(group.projectId) : svc.chatPeople()).filter((u: any) => !(group.memberIds || []).includes(u.id))
        : [];
  const needle = q.trim().toLowerCase();
  const shownPeople = people.filter((u: any) => !needle || `${u.name} ${u.title || ''}`.toLowerCase().includes(needle));
  const shownGroups = mine.filter((t: any) => !needle || (t.name || '').toLowerCase().includes(needle));
  const title = panel === 'dm' ? t('New chat') : panel === 'group' ? t('Create group') : t('Invite a person');
  const s = useStyles((c) => ({
    stack: { gap: 10 },
    types: { flexDirection: 'row', gap: 8 },
    type: { flex: 1, minHeight: 40, borderRadius: 999, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2 },
    typeOn: { backgroundColor: c.accent, borderColor: c.accent },
    typeText: { fontWeight: '600', color: c.ink2 },
    typeTextOn: { color: c.accentInk },
    help: { textAlign: 'center', color: c.ink2, fontSize: 14, lineHeight: 19, marginHorizontal: 8 },
    note: { color: c.ink2, fontSize: 14, fontWeight: '500', paddingVertical: 8, paddingHorizontal: 14 },
  }));
  const flush = { marginHorizontal: 0, marginTop: 0, marginBottom: 8 };
  function open(thread: any) {
    onClose();
    navigate(`/mobile/chats/${thread.id}`);
  }
  const search = (label: string, placeholder: string) => <SearchBox style={flush} value={q} onChangeText={setQ} placeholder={placeholder} label={label} />;
  return (
    <Sheet title={title} onClose={onClose}>
      {!!error && <WarnText>{error}</WarnText>}
      <ScrollView keyboardShouldPersistTaps="handled">
      {panel === 'dm' && (
        <>
          {search(t('Search people'), t('Name or role'))}
          {shownPeople.map((u: any) => (
            <PersonRow key={u.id} u={u} onPress={() => { try { open(svc.openDirectChat(u.id)); } catch (e: any) { setError(t(e.message)); } }} />
          ))}
          {people.length > 0 && !shownPeople.length && <Text style={s.note}>{t('No matches.')}</Text>}
        </>
      )}
      {panel === 'group' && (
        <View style={s.stack}>
          <Field label={t('Group name')} value={name} onChangeText={setName} />
          <View style={s.types}>
            <Pressable accessibilityRole="button" style={[s.type, groupType === 'general' && s.typeOn]} onPress={() => { setGroupType('general'); setProjectId(''); setPicked([]); }}><Text style={groupType === 'general' ? s.typeTextOn : s.typeText}>{t('General')}</Text></Pressable>
            <Pressable accessibilityRole="button" style={[s.type, groupType === 'project' && s.typeOn]} onPress={() => { setGroupType('project'); setPicked([]); }}><Text style={groupType === 'project' ? s.typeTextOn : s.typeText}>{t('Project work')}</Text></Pressable>
          </View>
          {groupType === 'project' && (
            <Select
              label={t('Project')} value={projectId}
              options={[['', 'Choose a project'], ...projects.map((p: any): [string, string] => [p.id, p.name])]}
              onChange={(v) => { setProjectId(v); setPicked([]); }}
            />
          )}
          <Text style={s.help}>{groupType === 'project' ? t('People already on this project.') : t('People in the studio.')}</Text>
          <View>
            {search(t('Search people'), t('Name or role'))}
            {shownPeople.map((u: any) => {
              const on = picked.includes(u.id);
              return <PersonRow key={u.id} u={u} selectable picked={on} onPress={() => setPicked((ids) => on ? ids.filter((id) => id !== u.id) : [...ids, u.id])} />;
            })}
            {!people.length && <Text style={s.note}>{groupType === 'project' && !projectId ? t('Choose a project first.') : t('No one else is available.')}</Text>}
            {people.length > 0 && !shownPeople.length && <Text style={s.note}>{t('No matches.')}</Text>}
          </View>
          <Primary onPress={() => { try { open(svc.createGroup({ name, groupType, projectId, memberIds: picked })); } catch (e: any) { setError(t(e.message)); } }}>{t('Create group')}</Primary>
        </View>
      )}
      {panel === 'invite' && !group && (mine.length ? (
        <>
          {search(t('Search groups'), t('Group name'))}
          {shownGroups.map((g: any) => (
            <Row key={g.id} onPress={() => { setGroupId(g.id); setQ(''); setError(''); }}>
              <ThreadAvatar thread={g} />
              <RowCopy title={g.name} sub={t('{0} · {1} people', g.groupType === 'project' || g.projectId ? t('Project work') : t('Group'), g.memberIds.length)} />
            </Row>
          ))}
          {!shownGroups.length && <Text style={s.note}>{t('No matches.')}</Text>}
        </>
      ) : <Text style={s.note}>{t('Create a group first.')}</Text>)}
      {panel === 'invite' && group && (people.length ? (
        <>
          {search(t('Search people'), t('Name or role'))}
          {shownPeople.map((u: any) => (
            <PersonRow key={u.id} u={u} onPress={() => { try { open(svc.inviteToGroup(groupId, u.id)); } catch (e: any) { setError(t(e.message)); } }} />
          ))}
          {!shownPeople.length && <Text style={s.note}>{t('No matches.')}</Text>}
        </>
      ) : <Text style={s.note}>{t('Everyone available is already in this group.')}</Text>)}
      </ScrollView>
    </Sheet>
  );
}

// Add people to a group or project conversation from its info screen. Each tap adds that person; the
// list keeps going until Done.
export function AddPeopleSheet({ thread, onClose }: { thread: any; onClose: () => void }) {
  useStore();
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const people = svc.invitablePeople(thread.id);
  const needle = q.trim().toLowerCase();
  const shown = people.filter((u: any) => !needle || `${u.name} ${u.title || ''}`.toLowerCase().includes(needle));
  const s = useStyles((c) => ({
    help: { textAlign: 'center', color: c.ink2, fontSize: 14, lineHeight: 19, marginHorizontal: 8, marginBottom: 8 },
    note: { color: c.ink2, fontSize: 14, fontWeight: '500', paddingVertical: 8, paddingHorizontal: 14 },
  }));
  return (
    <Sheet title={t('Add people')} onClose={onClose}>
      {!!error && <WarnText>{error}</WarnText>}
      <Text style={s.help}>{svc.inviteHint(thread)}</Text>
      <SearchBox style={{ marginHorizontal: 0, marginTop: 0, marginBottom: 8 }} value={q} onChangeText={setQ} placeholder={t('Name or role')} label={t('Search people')} />
      <ScrollView keyboardShouldPersistTaps="handled">
        {shown.map((u: any) => (
          <PersonRow key={u.id} u={u} onPress={() => { try { svc.inviteToGroup(thread.id, u.id); setError(''); } catch (e: any) { setError(t(e.message)); } }} />
        ))}
        {!people.length && <Text style={s.note}>{t('Everyone available is already in this chat.')}</Text>}
        {people.length > 0 && !shown.length && <Text style={s.note}>{t('No matches.')}</Text>}
      </ScrollView>
      <Primary onPress={onClose}>{t('Done')}</Primary>
    </Sheet>
  );
}

// Shared bottom-sheet shell (overlay, grab handle, title) for the chat sheets.
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const s = useStyles((c) => ({
    sheet: { maxHeight: '78%', backgroundColor: c.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 8, paddingHorizontal: 16 },
    handle: { width: 36, height: 4, borderRadius: 999, backgroundColor: c.line, alignSelf: 'center', marginTop: 4, marginBottom: 12 },
    h: { textAlign: 'center', fontWeight: '600', fontSize: 16, color: c.ink, marginBottom: 14 },
  }));
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12,30,41,0.4)' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('Close')} />
        <View style={[s.sheet, { paddingBottom: 12 + insets.bottom }]} accessibilityViewIsModal>
          <View style={s.handle} />
          <Text style={s.h}>{title}</Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function projectUnread(thread: any, read: Record<string, string>, rows: any[]) {
  if (!isProjectAudience(thread)) return unreadCount(thread.id, read[thread.id]);
  return rows
    .filter(({ t }) => t.projectId === thread.projectId && isProjectAudience(t))
    .reduce((n, { t }) => n + unreadCount(t.id, read[t.id]), 0);
}

function ChatRow({ thread, last, unread, draft }: { thread: any; last: any; unread: number; draft?: string }) {
  const title = threadTitle(thread);
  const at = last?.at || thread.lastMessageAt;
  const s = useStyles((c) => ({
    copy: { flex: 1, minWidth: 0 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
    title: { color: c.ink, fontSize: 16, fontWeight: unread ? '700' : '600', flexShrink: 1 },
    time: { color: c.ink2, fontSize: 14, fontWeight: '500' },
    prev: { color: c.ink2, fontSize: 14, fontWeight: '500' },
    draft: { color: c.accent },
    count: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    countText: { color: c.accentInk, fontSize: 12, fontWeight: '700' },
  }));
  return (
    <Row to={`/mobile/chats/${thread.id}`}>
      <ThreadAvatar thread={thread} />
      <View style={s.copy}>
        <View style={s.head}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {!!at && <Text style={s.time}>{fmtT(at)}</Text>}
        </View>
        <Text style={[s.prev, draft ? s.draft : null]} numberOfLines={1}>
          {draft ? t('Draft: {0}', draft) : `${last && last.by && thread.kind !== 'dm' ? `${firstName(last.by)}: ` : ''}${preview(last)}`}
        </Text>
      </View>
      {unread > 0 && <View style={s.count}><Text style={s.countText}>{unread}</Text></View>}
    </Row>
  );
}

export function ThreadHeader({ thread, backTo = '/mobile/chats' }: { thread: any; backTo?: string }) {
  const navigate = useNavigate();
  const { c } = useTheme();
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
      <BackButton to={backTo} label={backName(backTo)} showLabel={false} color={c.ink2} />
      <Link to={infoTo} style={s.heading}>
        <ThreadAvatar thread={thread} size="sm" />
        <View style={s.name}>
          <Text style={s.h1} numberOfLines={1}>{threadTitle(thread)}</Text>
          <Text style={s.sub} numberOfLines={1}>{audience(thread)}{thread.kind === 'dm' ? '' : ` · ${thread.memberIds.length} ${t('people')}`}</Text>
        </View>
      </Link>
      <Link to={`/mobile/chats/${thread.id}/call${query}`} accessibilityLabel={t('Video call')}><Icon name="video" color={c.ink2} /></Link>
      {other ? (
        <Pressable onPress={() => openExternal(`tel:${phoneOf(other).replace(/\s/g, '')}`)} accessibilityLabel={t('Call {0}', other.name)}>
          <Icon name="call" color={c.ink2} />
        </Pressable>
      ) : (
        <Link to={voiceTo} accessibilityLabel={t('Voice call')}><Icon name="call" color={c.ink2} /></Link>
      )}
    </TopBar>
  );
}
