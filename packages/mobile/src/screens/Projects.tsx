import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Icon from '../ui/Icon';
import { Screen, TopBar, BackButton, backName } from '../ui/frame';
import { Avatar, ThreadAvatar } from '../ui/faces';
import { photoSource } from '../ui/Photo';
import { Link, openExternal, useParams, useSearchParams } from '../platform/router';
import { useStyles, useTheme } from '../platform/theme';
import { TODAY } from '../../../frontend/src/shared/data';
import {
  svc, projectOf, siteFor, openIssues, projectNeeds, nextDeadline, me, firstName, can, audience, state, onPhone,
  fmtD, phoneDrawings, useStore, t,
} from '../store';
import { WorkRow, finishTask } from './ProjectPages';
import { B, DayRow, Empty, H2, Hint, SectionHead, Small, StatusEm, Sub } from './projectKit';

// Shared scroll body: `.body.canvas.proj` (surface background, 18px gutters).
function ProjBody({ children, board }: { children: React.ReactNode; board?: boolean }) {
  const s = useStyles((c) => ({
    body: { flex: 1, backgroundColor: board ? c.ground : c.surface },
    content: { paddingHorizontal: board ? 14 : 18, paddingTop: board ? 12 : 6, paddingBottom: 28 },
  }));
  return <ScrollView style={s.body} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>;
}

// Header with back icon and a two-line heading (`.top.thread-top.proj-top`).
function ProjTop({ back, backLabel, title, sub }: { back: string; backLabel: string; title: string; sub?: string }) {
  const s = useStyles((c) => ({
    heading: { flex: 1, minWidth: 0 },
    h1: { fontSize: 17, fontWeight: '600', color: c.ink },
    sub: { fontSize: 13, color: c.ink3, marginTop: 2 },
  }));
  return (
    <TopBar>
      <BackButton to={back} label={backLabel} showLabel={false} />
      <View style={s.heading}>
        <Text style={s.h1}>{title}</Text>
        {sub ? <Text style={s.sub}>{sub}</Text> : null}
      </View>
    </TopBar>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: 'kind' | 'open' | 'ok' }) {
  const s = useStyles((c) => ({
    pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: c.surface2 },
    t: { fontSize: 12, fontWeight: '600', color: c.ink2 },
    kind: { backgroundColor: c.accentSoft },
    kindT: { color: c.accentText },
    open: { backgroundColor: c.warnSoft },
    openT: { color: c.warn },
    ok: { backgroundColor: c.okSoft },
    okT: { color: c.ok },
  }));
  return (
    <View style={[s.pill, tone ? s[tone] : null]}>
      <Text style={[s.t, tone ? s[`${tone}T`] : null]}>{children}</Text>
    </View>
  );
}

function Tile({ to, href, icon, title, meta, tone }: { to?: string; href?: string; icon: string; title: string; meta: string; tone?: '' | 'hot' | 'wait' }) {
  const { c } = useTheme();
  const s = useStyles((c, th) => ({
    tile: { width: '100%', minHeight: 108, gap: 6, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, shadowColor: th.dark ? '#000' : c.ink, shadowOpacity: th.dark ? 0.35 : 0.06, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1 },
    hot: { backgroundColor: c.critSoft, borderColor: 'transparent' },
    wait: { backgroundColor: c.warnSoft, borderColor: 'transparent' },
    well: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft },
    lift: { backgroundColor: c.surface },
    title: { fontSize: 15, fontWeight: '600', color: c.ink },
    meta: { fontSize: 12, lineHeight: 16, color: c.ink2 },
    hotMeta: { color: c.crit },
    waitMeta: { color: c.warn },
  }));
  const ink = tone === 'hot' ? c.crit : tone === 'wait' ? c.warn : c.accentText;
  const inner = (
    <>
      <View style={[s.well, tone ? s.lift : null]}><Icon name={icon} size={18} color={ink} /></View>
      <Text style={s.title}>{title}</Text>
      <Text style={[s.meta, tone === 'hot' && s.hotMeta, tone === 'wait' && s.waitMeta]}>{meta}</Text>
    </>
  );
  const style = [s.tile, tone === 'hot' && s.hot, tone === 'wait' && s.wait];
  if (href) return <Pressable style={style} accessibilityRole="link" onPress={() => openExternal(href)}>{inner}</Pressable>;
  return <Link to={to || ''} style={style}>{inner}</Link>;
}

function MenuLink({ to, href, icon, title, meta, first }: { to?: string; href?: string; icon: string; title: string; meta: string; first?: boolean }) {
  const { c } = useTheme();
  const s = useStyles((c) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.line },
    first: { borderTopWidth: 0 },
    well: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft },
    copy: { flex: 1, minWidth: 0 },
    title: { fontSize: 15, fontWeight: '600', color: c.ink },
    meta: { marginTop: 1, fontSize: 13, lineHeight: 18, color: c.ink2 },
  }));
  const inner = (
    <>
      <View style={s.well}><Icon name={icon} size={18} color={c.accentText} /></View>
      <View style={s.copy}><Text style={s.title}>{title}</Text><Text style={s.meta}>{meta}</Text></View>
      <Icon name="chev" size={18} />
    </>
  );
  const style = [s.row, first && s.first];
  if (href) return <Pressable style={style} accessibilityRole="link" onPress={() => openExternal(href)}>{inner}</Pressable>;
  if (to) return <Link to={to} style={style}>{inner}</Link>;
  return <View style={style}>{inner}</View>;
}

export default function Projects() {
  useStore();
  const [query, setQuery] = useState('');
  const list = svc.projects().filter((p: any) => onPhone(p.id));
  const person = me();
  const q = query.trim().toLowerCase();
  const shown = q
    ? list.filter((p: any) => {
      const site = siteFor(p.id);
      return [p.name, p.code, p.city, site?.stage, p.kind].filter(Boolean).join(' ').toLowerCase().includes(q);
    })
    : list;
  const s = useStyles((c, th) => ({
    h1: { fontSize: 22, fontWeight: '600', color: c.ink },
    h1sub: { fontSize: 13, fontWeight: '500', color: c.ink3 },
    search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, paddingHorizontal: 12, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
    input: { flex: 1, minWidth: 0, color: c.ink, fontSize: 16, paddingVertical: 8, outlineStyle: 'none' },
    project: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, shadowColor: th.dark ? '#000' : c.ink, shadowOpacity: th.dark ? 0.35 : 0.06, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1 },
    late: { borderLeftWidth: 3, borderLeftColor: c.crit },
    pid: { width: 68, height: 68, borderRadius: 12, overflow: 'hidden', backgroundColor: c.accentSoft },
    pimg: { width: '100%', height: '100%' },
    copy: { flex: 1, minWidth: 0 },
    name: { fontSize: 16, fontWeight: '600', color: c.ink },
    code: { marginTop: 2, fontSize: 13, color: c.ink2 },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    due: { marginTop: 8, fontSize: 13, fontWeight: '600', color: c.ink2 },
    dueLate: { color: c.crit },
    card: { marginTop: 4, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
  }));

  return (
    <Screen>
      <TopBar>
        <Text style={[s.h1, { flex: 1 }]} numberOfLines={2}>
          {t('projects')}
          {'\n'}
          <Text style={s.h1sub}>Drawings, people and site work</Text>
        </Text>
        <Link to="/mobile/profile?from=%2Fmobile%2Fprojects" accessibilityLabel="Profile"><Avatar person={person} size="sm" /></Link>
      </TopBar>
      <ProjBody board>
        {list.length > 1 && (
          <View style={s.search}>
            <Icon name="search" size={20} />
            <TextInput style={s.input} value={query} onChangeText={setQuery} placeholder="Search projects" accessibilityLabel="Search projects" autoCapitalize="none" />
          </View>
        )}
        {shown.map((p: any) => {
          const site = siteFor(p.id);
          const issues = openIssues(p.id);
          const due = nextDeadline(p);
          const late = due && due.date < TODAY;
          const drawings = p.drawings || [];
          return (
            <Link key={p.id} to={`/mobile/projects/${p.id}`} style={[s.project, late && s.late]}>
              <View style={s.pid}><Image source={photoSource(p.hue, p.id)} style={s.pimg} resizeMode="cover" /></View>
              <View style={s.copy}>
                <Text style={s.name}>{p.name}</Text>
                <Text style={s.code}>{p.code}{p.city ? ` · ${p.city}` : ''}</Text>
                <View style={s.pills}>
                  <Pill tone="kind">{site ? site.stage : p.kind}</Pill>
                  {can('drawing', 'r') && drawings.length ? <Pill>{drawings.length === 1 ? '1 drawing' : `${drawings.length} drawings`}</Pill> : null}
                  {can('issue', 'r') ? <Pill tone={issues.length ? 'open' : 'ok'}>{issues.length ? `${issues.length} open` : 'Clear'}</Pill> : null}
                </View>
                {due ? <Text style={[s.due, late && s.dueLate]}>{due.title} · {late ? 'overdue' : 'due'} {fmtD(due.date)}</Text> : null}
              </View>
              <Icon name="chev" />
            </Link>
          );
        })}
        {list.length > 0 && !shown.length && <Empty title="No project matches" />}
        {!list.length && <Empty title="No projects for this login" text="Your role only sees the work assigned to you." />}
        <View style={s.card}>
          <MenuLink to="/mobile/photos" icon="photos" title="All project photos" meta="Browse across your projects" first />
          {state.role === 'client' ? <MenuLink to="/mobile/portfolio" icon="photos" title="Studio portfolio" meta="Completed work" /> : null}
        </View>
      </ProjBody>
    </Screen>
  );
}

export function Project() {
  useStore();
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const from = params.get('from');
  const backTo = from && from.startsWith('/mobile/') ? from : '/mobile/projects';
  const project = projectOf(projectId);
  const s = useStyles((c, th) => ({
    cover: { height: 156, borderRadius: 16, overflow: 'hidden', marginBottom: 10 },
    coverImg: { width: '100%', height: '100%' },
    coverBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 28, paddingBottom: 12, backgroundColor: 'rgba(12,30,41,0.62)' },
    coverT: { color: '#fff', fontSize: 15, fontWeight: '600' },
    stats: { flexDirection: 'row', gap: 8 },
    stat: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
    statLate: { backgroundColor: c.critSoft, borderColor: 'transparent' },
    statN: { fontSize: 16, fontWeight: '700', color: c.ink },
    statOpenN: { color: c.warn },
    statOkN: { color: c.ok },
    statLateN: { color: c.crit },
    statL: { marginTop: 2, fontSize: 11, fontWeight: '600', color: c.ink3 },
    statLateL: { color: c.crit },
    next: { marginTop: 8, marginHorizontal: 2, fontSize: 13, fontWeight: '600', color: c.ink2 },
    nextLate: { color: c.crit },
    label: { marginTop: 16, marginBottom: 8, marginHorizontal: 2, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: c.ink2 },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
    tileSlot: { width: '48.5%' },
    card: { paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, shadowColor: th.dark ? '#000' : c.ink, shadowOpacity: th.dark ? 0.35 : 0.06, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1 },
    warm: { backgroundColor: c.warnSoft, borderColor: 'transparent' },
    post: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: c.accent },
    well: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
    postT: { fontSize: 15, fontWeight: '600', color: c.accentInk },
    postS: { marginTop: 1, fontSize: 13, color: c.accentInk, opacity: 0.88 },
    ask: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
    askWell: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accentSoft },
    chat: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.line },
  }));
  if (!project || !onPhone(project.id)) {
    return (
      <Screen>
        <ProjTop back="/mobile/projects" backLabel="Projects" title="Project" />
        <ProjBody><Empty title="This project isn’t available" /></ProjBody>
      </Screen>
    );
  }
  const site = siteFor(project.id);
  const work = projectNeeds(project.id);
  const threads = svc.threads().filter((th: any) => th.projectId === project.id);
  const materials = svc.materials({ projectId: project.id });
  const drawings = can('drawing', 'r') ? (project.drawings || []) : [];
  const siteChat = svc.threads().find((item: any) => item.kind === 'site' && item.projectId === project.id);
  const postThread = svc.threads().find((item: any) => item.kind === 'site' && item.projectId === project.id && (item.memberIds || []).includes(state.userId));
  const changes = svc.projectUpdates({ projectId: project.id });
  const studio = state.role !== 'client' ? svc.brainstorm(project.id) : null;
  const office = !['client', 'contractor'].includes(state.role);
  const lastFeed = site && can('feed', 'r') ? svc.feed(site.id)[0] : null;
  const issueCount = can('issue', 'r') ? openIssues(project.id).length : null;
  const waitingMats = materials.filter((m: any) => m.status === 'client_pending').length;
  const indexCount = can('drawing', 'r') ? svc.drawingIndex(project.id).length : 0;
  const due = nextDeadline(project);
  const late = due && due.date < TODAY;
  const here = `/mobile/projects/${project.id}`;
  const chatTo = (id: string) => `/mobile/chats/${id}?from=${encodeURIComponent(here)}`;
  const groups: { title: string; items: any[] }[] = [
    {
      title: 'Work',
      items: [
        { to: `/mobile/photos?project=${project.id}`, icon: 'photos', title: 'Photos', meta: 'Filed site updates' },
        can('drawing', 'r') && { to: `${here}/drawings`, icon: 'drawing', title: 'Drawings', meta: `${drawings.length} shared` },
        can('material', 'r') && { to: `${here}/materials`, icon: 'sample', title: 'Materials', meta: waitingMats ? `${waitingMats} waiting on the client` : `${materials.length} shared`, tone: waitingMats ? 'wait' : '' },
        { to: `${here}/changes`, icon: 'change', title: 'Changes', meta: changes.length ? `${changes.length} recorded` : 'Recorded' },
        { to: `${here}/attention`, icon: 'warn', title: 'Needs you', meta: work.length ? `${work.length} open` : 'Nothing waiting', tone: work.length ? 'hot' : '' },
        { to: `${here}/people`, icon: 'people', title: 'People', meta: 'Contacts' },
      ].filter(Boolean),
    },
    {
      title: 'Records',
      items: [
        can('drawing', 'r') && { to: `${here}/index`, icon: 'drawing', title: 'Drawing index', meta: `${indexCount} sheets` },
        can('ref', 'r') && { to: `${here}/refs`, icon: 'star', title: 'References', meta: `${svc.clientRefs(project.id).length} saved` },
        can('intake', 'r') && { to: `${here}/intake`, icon: 'check', title: 'Client data checklist', meta: `${svc.intake(project.id).length} items` },
        can('share', 'r') && { to: `${here}/share`, icon: 'clip', title: 'Share a link', meta: 'Expiring web link' },
      ].filter(Boolean),
    },
    {
      title: 'Studio',
      items: [
        studio && { to: chatTo(studio.id), icon: 'chat', title: 'Studio chat', meta: 'The client never sees it' },
        office && project.driveFolder && svc.connection('google') && { href: project.driveFolder, icon: 'folder', title: 'Drive archive', meta: 'Older folders' },
        office && project.canvaDeck && svc.connection('canva') && { href: project.canvaDeck, icon: 'samples', title: 'Concept deck', meta: 'Opens in Canva' },
        svc.assistKinds().includes('client') && threads.some((item: any) => item.kind === 'client') && { to: `${here}/assist?kind=client`, icon: 'send', title: 'Client update', meta: 'From this chat' },
        svc.assistKinds().includes('concept') && { to: `${here}/assist?kind=concept`, icon: 'ai', title: 'Finish ideas', meta: 'From a photo' },
      ].filter(Boolean),
    },
  ].filter((group) => group.items.length);

  return (
    <Screen>
      <ProjTop back={backTo} backLabel={from ? backName(backTo) : 'projects'} title={project.name} sub={`${project.code} · ${project.city}`} />
      <ProjBody board>
        <View style={s.cover}>
          <Image source={photoSource(project.hue, project.id)} style={s.coverImg} resizeMode="cover" />
          <View style={s.coverBar}><Text style={s.coverT}>{site ? site.stage : project.kind}</Text></View>
        </View>
        <View style={s.stats}>
          {can('drawing', 'r') && (
            <View style={s.stat}><Text style={s.statN}>{drawings.length}</Text><Text style={s.statL}>{drawings.length === 1 ? 'Drawing' : 'Drawings'}</Text></View>
          )}
          {issueCount != null && (
            <View style={s.stat}>
              <Text style={[s.statN, issueCount ? s.statOpenN : s.statOkN]}>{issueCount || 'None'}</Text>
              <Text style={s.statL}>{issueCount ? 'Open issues' : 'Issues clear'}</Text>
            </View>
          )}
          {due && (
            <View style={[s.stat, late && s.statLate]}>
              <Text style={[s.statN, late && s.statLateN]}>{fmtD(due.date)}</Text>
              <Text style={[s.statL, late && s.statLateL]}>{late ? 'Overdue' : 'Next due'}</Text>
            </View>
          )}
        </View>
        {due ? <Text style={[s.next, late && s.nextLate]}>{due.title}</Text> : null}
        {work.length > 0 && (
          <View>
            <SectionHead title="Needs you here" to={work.length > 3 ? `/mobile/projects/${project.id}/attention` : undefined} label={`View all ${work.length}`} />
            <View style={[s.card, s.warm]}>
              {work.slice(0, 3).map((item: any, i: number) => <WorkRow key={item.key} item={item} onDone={finishTask} first={i === 0} />)}
            </View>
          </View>
        )}
        {postThread && can('thread', 'w') && (
          <Link to={`/mobile/camera?thread=${postThread.id}&from=${encodeURIComponent(`/mobile/projects/${project.id}`)}`} style={s.post}>
            <View style={s.well}><Icon name="camera" size={18} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.postT}>Post a site update</Text>
              <Text style={s.postS}>Photo, voice, delivery or attendance</Text>
            </View>
          </Link>
        )}
        {groups.map((group) => (
          <View key={group.title}>
            <Text style={s.label}>{group.title}</Text>
            {group.title === 'Work' ? (
              <View style={s.tiles}>
                {group.items.map((item) => <View key={item.title} style={s.tileSlot}><Tile {...item} /></View>)}
              </View>
            ) : (
              <View style={s.card}>
                {group.items.map((item, i) => <MenuLink key={item.title} {...item} first={i === 0} />)}
              </View>
            )}
          </View>
        ))}
        {changes.length > 0 && (
          <View>
            <SectionHead title="Recent changes" to={changes.length > 2 ? `/mobile/projects/${project.id}/changes` : undefined} label={`View all ${changes.length}`} />
            <View style={s.card}>
              {changes.slice(0, 2).map((u: any, i: number) => (
                <DayRow key={u.id} to={u.source?.threadId ? chatTo(u.source.threadId) : undefined} first={i === 0}>
                  <Small>{u.kind} · {fmtD(u.at)}</Small>
                  <B>{u.title}</B>
                  <Sub>{u.detail}</Sub>
                </DayRow>
              ))}
            </View>
          </View>
        )}
        <View>
          <Text style={s.label}>Conversations</Text>
          {threads.length ? (
            <View style={s.card}>
              {threads.map((thread: any, i: number) => (
                <Link key={thread.id} to={chatTo(thread.id)} style={[s.chat, i === 0 && { borderTopWidth: 0 }]}>
                  <ThreadAvatar thread={thread} size="sm" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <B>{audience(thread)}</B>
                    <Sub>{thread.name}</Sub>
                  </View>
                  <Icon name="chev" size={18} />
                </Link>
              ))}
            </View>
          ) : <Hint>No conversations for you on this project.</Hint>}
        </View>
        {site && can('site', 'r') && (
          <View>
            <Text style={s.label}>Site</Text>
            <View style={s.card}>
              <DayRow to={siteChat ? chatTo(siteChat.id) : undefined} first>
                <B>{site.name}</B>
                <Sub>{site.stage}{siteChat && (site.address || site.location) ? ` · ${site.address || site.location}` : ''}</Sub>
                {issueCount != null ? <Sub>{issueCount ? `${issueCount} open` : 'No open issues'}</Sub> : null}
                {lastFeed ? <Sub>Last update {fmtD(lastFeed.at)} · {firstName(lastFeed.by)}</Sub> : null}
                {siteChat && site.managerId ? <Sub>Site manager {firstName(site.managerId)}</Sub> : null}
              </DayRow>
            </View>
          </View>
        )}
        {svc.assistKinds().includes('ask') && (
          <Link to={`/mobile/projects/${project.id}/assist?kind=ask`} style={s.ask}>
            <View style={s.askWell}><Icon name="ai" size={18} /></View>
            <View style={{ flex: 1 }}>
              <B>Ask about this project</B>
              <Sub>Answers from shared records</Sub>
            </View>
          </Link>
        )}
      </ProjBody>
    </Screen>
  );
}

export function Drawings() {
  useStore();
  const { projectId } = useParams();
  const project = projectOf(projectId);
  const allowed = project && onPhone(project.id) && can('drawing', 'r');
  const drawings = allowed ? (project.drawings || []) : [];
  const s = useStyles((c) => ({
    d: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
    rev: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2 },
    revT: { fontWeight: '700', color: c.ink, fontSize: 16 },
    copy: { flex: 1, minWidth: 0 },
    warn: { marginTop: 4, color: c.warn, fontSize: 12 },
  }));
  const Item = ({ d, to, children }: { d: any; to: string; children: React.ReactNode }) => (
    <Link to={to} style={s.d}>
      <View style={s.rev}><Text style={s.revT}>{d.rev}</Text></View>
      <View style={s.copy}>{children}</View>
    </Link>
  );
  return (
    <Screen>
      <ProjTop back={`/mobile/projects/${projectId}`} backLabel="project" title="Drawings" sub={project?.name} />
      <ProjBody board>
        {!allowed && <Empty title="Drawings aren’t available for this login" />}
        {allowed && <Hint>Check the revision and purpose before anyone builds from it.</Hint>}
        {allowed && ['saved', 'recent'].map((kind) => {
          const quick = phoneDrawings(projectId, kind).slice(0, kind === 'saved' ? 100 : 3);
          if (!quick.length) return null;
          return (
            <View key={kind}>
              <H2>{kind === 'saved' ? 'Saved by you' : 'Recently opened'}</H2>
              {quick.map((x: any) => (
                <Item key={x.no} d={x.d} to={`/mobile/projects/${projectId}/drawings/${encodeURIComponent(x.no)}`}>
                  <B>{x.d.name}</B>
                  <Sub>{x.d.rev} · {x.d.status}</Sub>
                  {x.rev !== x.d.rev ? <Text style={s.warn}>Register changed since {x.rev}. Review before use.</Text> : null}
                </Item>
              ))}
            </View>
          );
        })}
        {allowed && drawings.length > 0 && <H2>All drawings</H2>}
        {drawings.map((d: any) => (
          <Item key={d.no} d={d} to={`/mobile/projects/${projectId}/drawings/${encodeURIComponent(d.no)}`}>
            <B>{d.name}</B>
            <Sub>{d.no}</Sub>
            <StatusEm ok={d.status === 'Issued for construction'}>{d.status || 'Purpose not recorded'}</StatusEm>
          </Item>
        ))}
        {allowed && !drawings.length && <Empty title="No drawings shared" />}
      </ProjBody>
    </Screen>
  );
}
