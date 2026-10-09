import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Icon from '../ui/Icon';
import { Screen, TopBar, BackButton, backName } from '../ui/frame';
import { Avatar, ThreadAvatar } from '../ui/faces';
import { photoSource } from '../ui/Photo';
import { Link, useParams, useSearchParams } from '../platform/router';
import { useStyles } from '../platform/theme';
import { TODAY } from '../../../frontend/src/shared/data';
import {
  svc, projectOf, siteFor, openIssues, projectNeeds, nextDeadline, me, firstName, can, audience, state, onPhone,
  fmtD, phoneDrawings, useStore, t,
} from '../store';
import { WorkRow, finishTask } from './ProjectPages';
import { B, DayRow, Empty, H2, Hint, Row, RowSub, RowTitle, SectionHead, Small, StatusEm, Sub } from './projectKit';

// Shared scroll body: `.body.canvas.proj` (surface background, 18px gutters).
function ProjBody({ children }: { children: React.ReactNode }) {
  const s = useStyles((c) => ({ body: { flex: 1, backgroundColor: c.surface }, content: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 28 } }));
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
    search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, marginBottom: 6, paddingHorizontal: 2, minHeight: 42, borderBottomWidth: 1, borderBottomColor: c.line },
    input: { flex: 1, minWidth: 0, color: c.ink, fontSize: 16, paddingVertical: 8, outlineStyle: 'none' },
    project: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.line },
    pid: { width: 44, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: c.accentSoft },
    pimg: { width: '100%', height: '100%' },
    copy: { flex: 1, minWidth: 0 },
    name: { fontSize: 16, fontWeight: '600', color: c.ink },
    code: { fontSize: 14, color: c.ink2 },
    stage: { fontSize: 14, fontWeight: '600', color: c.ink },
    meta: { fontSize: 14, color: c.ink2 },
    avRow: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
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
      <ProjBody>
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
          const drawings = p.drawings || [];
          return (
            <Link key={p.id} to={`/mobile/projects/${p.id}`} style={s.project}>
              <View style={s.pid}><Image source={photoSource(p.hue, p.id)} style={s.pimg} resizeMode="cover" /></View>
              <View style={s.copy}>
                <Text style={s.name}>{p.name}</Text>
                <Text style={s.code}>{p.code}</Text>
                <Text style={s.stage}>{site ? site.stage : p.kind}</Text>
                <Text style={s.meta}>
                  {can('drawing', 'r') && drawings.length ? `${drawings.length === 1 ? '1 drawing' : `${drawings.length} drawings`} · ` : ''}
                  {can('issue', 'r') ? (issues.length ? `${issues.length} open` : 'No open issues') : 'Open resources'}
                </Text>
                {due ? <Text style={s.meta}>{due.title} · {due.date < TODAY ? 'overdue' : 'due'} {fmtD(due.date)}</Text> : null}
              </View>
              <Icon name="chev" />
            </Link>
          );
        })}
        {list.length > 0 && !shown.length && <Empty title="No project matches" />}
        {!list.length && <Empty title="No projects for this login" text="Your role only sees the work assigned to you." />}
        <Row to="/mobile/photos" left={<View style={s.avRow}><Icon name="photos" size={20} color="#fff" /></View>}>
          <RowTitle>All project photos</RowTitle><RowSub>Browse across your projects</RowSub>
        </Row>
        {state.role === 'client' && (
          <Row to="/mobile/portfolio" left={<View style={s.avRow}><Icon name="photos" size={20} color="#fff" /></View>}>
            <RowTitle>Studio portfolio</RowTitle><RowSub>Completed work</RowSub>
          </Row>
        )}
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
  const s = useStyles((c) => ({
    place: { marginTop: 10, fontSize: 15, fontWeight: '600', color: c.ink },
    chat: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
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
  const here = `/mobile/projects/${project.id}`;
  const chatTo = (id: string) => `/mobile/chats/${id}?from=${encodeURIComponent(here)}`;
  const groups: { title: string; items: any[] }[] = [
    {
      title: 'Work',
      items: [
        { to: `/mobile/photos?project=${project.id}`, title: 'Photos', meta: 'Filed site updates' },
        can('drawing', 'r') && { to: `${here}/drawings`, title: 'Drawings', meta: `${drawings.length} shared` },
        can('material', 'r') && { to: `${here}/materials`, title: 'Materials', meta: waitingMats ? `${materials.length} shared · ${waitingMats} waiting on the client` : `${materials.length} shared` },
        { to: `${here}/changes`, title: 'Changes', meta: changes.length ? `${changes.length} recorded` : 'Recorded' },
        { to: `${here}/attention`, title: 'Needs you', meta: work.length ? `${work.length} open` : 'Nothing waiting' },
        { to: `${here}/people`, title: 'People', meta: 'Contacts' },
      ].filter(Boolean),
    },
    {
      title: 'Records',
      items: [
        can('drawing', 'r') && { to: `${here}/index`, title: 'Drawing index', meta: `${indexCount} sheets` },
        can('ref', 'r') && { to: `${here}/refs`, title: 'References', meta: `${svc.clientRefs(project.id).length} saved` },
        can('intake', 'r') && { to: `${here}/intake`, title: 'Client data checklist', meta: `${svc.intake(project.id).length} items` },
        can('share', 'r') && { to: `${here}/share`, title: 'Share a link', meta: 'Expiring web link' },
      ].filter(Boolean),
    },
    {
      title: 'Studio',
      items: [
        studio && { to: chatTo(studio.id), title: 'Studio chat', meta: 'The client never sees it' },
        office && project.driveFolder && svc.connection('google') && { href: project.driveFolder, title: 'Drive archive', meta: 'Older folders' },
        office && project.canvaDeck && svc.connection('canva') && { href: project.canvaDeck, title: 'Concept deck', meta: 'Opens in Canva' },
        svc.assistKinds().includes('client') && threads.some((item: any) => item.kind === 'client') && { to: `${here}/assist?kind=client`, title: 'Client update', meta: 'From this chat' },
        svc.assistKinds().includes('concept') && { to: `${here}/assist?kind=concept`, title: 'Finish ideas', meta: 'From a photo' },
      ].filter(Boolean),
    },
  ].filter((group) => group.items.length);

  return (
    <Screen>
      <ProjTop back={backTo} backLabel={from ? backName(backTo) : 'projects'} title={project.name} sub={`${project.code} · ${project.city}`} />
      <ProjBody>
        <Text style={s.place}>{site ? site.stage : project.kind}</Text>
        {work.length > 0 && (
          <View>
            <SectionHead title="Needs you here" to={work.length > 3 ? `/mobile/projects/${project.id}/attention` : undefined} label={`View all ${work.length}`} />
            {work.slice(0, 3).map((item: any, i: number) => <WorkRow key={item.key} item={item} onDone={finishTask} first={i === 0} />)}
          </View>
        )}
        {postThread && can('thread', 'w') && (
          <DayRow to={`/mobile/camera?thread=${postThread.id}&from=${encodeURIComponent(`/mobile/projects/${project.id}`)}`}>
            <B>Post a site update</B>
            <Sub>Photo, voice, delivery or attendance</Sub>
          </DayRow>
        )}
        {groups.map((group) => (
          <View key={group.title}>
            <H2>{group.title}</H2>
            {group.items.map((item, i) => (
              <DayRow key={item.title} to={item.to} href={item.href} first={i === 0}>
                <B>{item.title}</B>
                <Sub>{item.meta}</Sub>
              </DayRow>
            ))}
          </View>
        ))}
        {changes.length > 0 && (
          <View>
            <SectionHead title="Recent changes" to={changes.length > 2 ? `/mobile/projects/${project.id}/changes` : undefined} label={`View all ${changes.length}`} />
            {changes.slice(0, 2).map((u: any, i: number) => (
              <DayRow key={u.id} to={u.source?.threadId ? chatTo(u.source.threadId) : undefined} first={i === 0}>
                <Small>{u.kind} · {fmtD(u.at)}</Small>
                <B>{u.title}</B>
                <Sub>{u.detail}</Sub>
              </DayRow>
            ))}
          </View>
        )}
        <View>
          <H2>Conversations</H2>
          {threads.map((thread: any, i: number) => (
            <DayRow key={thread.id} to={chatTo(thread.id)} first={i === 0}>
              <View style={s.chat}>
                <ThreadAvatar thread={thread} size="sm" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <B>{audience(thread)}</B>
                  <Sub>{thread.name}</Sub>
                </View>
              </View>
            </DayRow>
          ))}
          {!threads.length && <Hint>No conversations for you on this project.</Hint>}
        </View>
        {site && can('site', 'r') && (
          <View>
            <H2>Site</H2>
            <DayRow to={siteChat ? chatTo(siteChat.id) : undefined} first>
              <B>{site.name}</B>
              <Sub>{site.stage}{siteChat && (site.address || site.location) ? ` · ${site.address || site.location}` : ''}</Sub>
              {issueCount != null ? <Sub>{issueCount ? `${issueCount} open` : 'No open issues'}</Sub> : null}
              {lastFeed ? <Sub>Last update {fmtD(lastFeed.at)} · {firstName(lastFeed.by)}</Sub> : null}
              {siteChat && site.managerId ? <Sub>Site manager {firstName(site.managerId)}</Sub> : null}
            </DayRow>
          </View>
        )}
        {svc.assistKinds().includes('ask') && (
          <DayRow to={`/mobile/projects/${project.id}/assist?kind=ask`}>
            <B>Ask about this project</B>
            <Sub>Answers from shared records</Sub>
          </DayRow>
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
    d: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.line },
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
      <ProjBody>
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
