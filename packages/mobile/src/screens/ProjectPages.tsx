import React, { useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Icon from '../ui/Icon';
import { Page } from '../ui/frame';
import { backName } from '../ui/frame';
import { Avatar } from '../ui/faces';
import { Link, openExternal, useParams, useSearchParams } from '../platform/router';
import { useStyles } from '../platform/theme';
import { photoSource } from '../ui/Photo';
import {
  svc, can, projectOf, projectNeeds, fmtD, firstName, state, user, phoneOf, render, staff,
  phoneDrawings, rememberPhoneDrawing, useStore, core,
} from '../store';
import {
  ActBtn, ActRow, B, Chip, DayRow, Empty, Hint, LabeledInput, PrimaryRow, Row, RowSub, RowTitle, Sect, Small,
  StatusEm, Sub, SubmitBtn, ViewCard, WarnText,
} from './projectKit';

const errMsg = (e: any) => (e && e.message) || String(e);

export function WorkRow({ item, onDone, first }: { item: any; onDone: (id: string) => void; first?: boolean }) {
  const body = (
    <>
      <Small>{item.kind}</Small>
      <B>{item.title}</B>
      {item.meta ? <Sub>{item.meta}</Sub> : null}
    </>
  );
  if (item.to) return <DayRow to={item.to} first={first}>{body}</DayRow>;
  if (item.taskId) {
    return <DayRow first={first} right={<ActBtn label="Done" onPress={() => onDone(item.taskId)} />}>{body}</DayRow>;
  }
  return <DayRow first={first}>{body}</DayRow>;
}

export function finishTask(taskId: string) {
  const task = ((state.db as any).TASKS || []).find((row: any) => row.id === taskId);
  if (!task || task.owner !== state.userId) return;
  const previous = task.status;
  task.status = 'done';
  if (!core.persist()) task.status = previous;
  else render();
}

function Missing({ id }: { id?: string }) {
  return <Page sheet back={`/mobile/projects/${id || ''}`} title="Project"><Empty title="This project isn’t available" /></Page>;
}

function materialFace(status: string) {
  if (status === 'approved') return { label: 'Approved', tone: 'ok' as const };
  if (status === 'client_pending') return { label: 'Needs a decision', tone: 'open' as const };
  if (status === 'rejected') return { label: 'Not this one', tone: 'late' as const };
  if (status === 'internal_review') return { label: 'In review', tone: '' as const };
  return { label: (status || 'Status not recorded').replace(/_/g, ' '), tone: '' as const };
}

function materialsLead(rows: any[]) {
  const waiting = rows.filter((m) => m.status === 'client_pending').length;
  if (!waiting) return 'Every shared sample has a decision.';
  if (state.role === 'client') {
    return waiting === 1 ? '1 sample needs your decision.' : `${waiting} samples need your decision.`;
  }
  return waiting === 1 ? '1 sample waiting on the client.' : `${waiting} samples waiting on the client.`;
}

export function Materials() {
  useStore();
  const { projectId } = useParams();
  const project = projectOf(projectId);
  const rows = project ? svc.materials({ projectId }) : [];
  const s = useStyles((c) => ({
    lead: { marginTop: 2, marginBottom: 12, marginHorizontal: 2, color: c.ink2, fontSize: 14, fontWeight: '600' },
    card: { marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: c.line, borderRadius: 16, backgroundColor: c.surface },
    shot: { width: '100%', height: 148 },
    copy: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 4 },
    head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
    name: { flex: 1, fontSize: 16, fontWeight: '600', lineHeight: 21, color: c.ink },
    pill: { flexShrink: 0, marginTop: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: c.surface2 },
    pillT: { fontSize: 12, fontWeight: '600', color: c.ink2 },
    vendor: { color: c.ink2, fontSize: 14 },
    wait: { color: c.warn, fontSize: 13, fontWeight: '600' },
    acts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    approve: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    approveT: { color: c.accentInk, fontSize: 13, fontWeight: '700' },
    quiet: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' },
    quietT: { color: c.ink2, fontSize: 13, fontWeight: '650' },
    compare: { minHeight: 48, marginTop: 2, borderWidth: 1, borderColor: c.line, borderRadius: 14, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
    compareT: { color: c.accentText, fontWeight: '700', fontSize: 16 },
  }));
  const tones = useStyles((c) => ({
    okBg: { backgroundColor: c.okSoft },
    okFg: { color: c.ok },
    openBg: { backgroundColor: c.warnSoft },
    openFg: { color: c.warn },
    lateBg: { backgroundColor: c.critSoft },
    lateFg: { color: c.crit },
  }));
  if (!project) return <Missing id={projectId} />;
  if (!can('material', 'r')) {
    return <Page sheet back={`/mobile/projects/${projectId}`} backLabel="Project" title="Materials"><Empty title="Materials aren’t available for this login" /></Page>;
  }
  return (
    <Page sheet board back={`/mobile/projects/${projectId}`} backLabel="Project" title="Materials" sub={project.name}>
      {rows.length ? <Text style={s.lead}>{materialsLead(rows)}</Text> : <Hint>Samples and decisions shared with you.</Hint>}
      {rows.map((m: any) => {
        const face = materialFace(m.status);
        const tone = face.tone === 'ok' ? tones.okBg : face.tone === 'open' ? tones.openBg : face.tone === 'late' ? tones.lateBg : null;
        const toneT = face.tone === 'ok' ? tones.okFg : face.tone === 'open' ? tones.openFg : face.tone === 'late' ? tones.lateFg : null;
        return (
          <View key={m.id} style={s.card}>
            <Image source={photoSource(m.hue ?? 28, m.seed ?? m.id)} style={s.shot} resizeMode="cover" />
            <View style={s.copy}>
              <View style={s.head}>
                <Text style={s.name}>{m.name}</Text>
                <View style={[s.pill, tone]}><Text style={[s.pillT, toneT]}>{face.label}</Text></View>
              </View>
              <Text style={s.vendor}>{m.vendor || 'Supplier not recorded'}</Text>
              {m.status === 'client_pending' && staff() && project.clientId ? <Text style={s.wait}>Waiting on {firstName(project.clientId)}</Text> : null}
              {m.status === 'client_pending' && state.role === 'client' ? (
                <View style={s.acts}>
                  <Pressable style={s.approve} onPress={() => { svc.approveMaterial(m.id, true); render(); }} accessibilityRole="button"><Text style={s.approveT}>Approve</Text></Pressable>
                  <Pressable style={s.quiet} onPress={() => { svc.approveMaterial(m.id, false); render(); }} accessibilityRole="button"><Text style={s.quietT}>Not this one</Text></Pressable>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
      {svc.assistKinds().includes('compare') && rows.length >= 2 ? (
        <Link to={`/mobile/projects/${projectId}/assist?kind=compare`} style={s.compare}><Text style={s.compareT}>Compare materials</Text></Link>
      ) : null}
      {!rows.length && <Empty title="No materials shared yet" />}
    </Page>
  );
}

export function Contacts() {
  useStore();
  const { projectId } = useParams();
  const project = projectOf(projectId);
  const groups = project ? svc.peopleFolder(projectId) : [];
  const s = useStyles((c) => ({
    lead: { marginTop: 2, marginBottom: 12, marginHorizontal: 2, color: c.ink2, fontSize: 14, fontWeight: '600' },
    sect: { marginTop: 8, marginBottom: 8, marginHorizontal: 2, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: c.ink2 },
    card: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, borderWidth: 1, borderColor: c.line, borderRadius: 16, backgroundColor: c.surface },
    copy: { flex: 1, minWidth: 0 },
    name: { fontSize: 16, fontWeight: '600', lineHeight: 21, color: c.ink },
    title: { marginTop: 2, color: c.ink2, fontSize: 14, lineHeight: 19 },
    when: { marginTop: 2, color: c.ink3, fontSize: 13, fontWeight: '600' },
    acts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
    btn: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    btnT: { color: c.accentInk, fontSize: 13, fontWeight: '700' },
    quiet: { backgroundColor: c.surface2 },
    quietT: { color: c.ink },
    ini: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    iniT: { color: c.accentInk, fontWeight: '600', fontSize: 13 },
  }));
  if (!project) return <Missing id={projectId} />;
  return (
    <Page sheet board back={`/mobile/projects/${projectId}`} backLabel="Project" title="People" sub={project.name}>
      <Text style={s.lead}>People in this project.</Text>
      {groups.filter((g: any) => g.people.length).map((g: any, gi: number) => (
        <View key={g.name}>
          <Text style={[s.sect, gi > 0 ? { marginTop: 18 } : { marginTop: 0 }]}>{g.name}</Text>
          {g.people.map((u: any) => {
            const person = user(u.id);
            const known = (state.db as any).USERS.some((x: any) => x.id === u.id);
            const dm = known
              ? (state.db as any).THREADS.find((t: any) => t.kind === 'dm' && (t.memberIds || []).includes(u.id) && (t.memberIds || []).includes(state.userId))
              : null;
            return (
              <View key={u.id} style={s.card}>
                {person?.id ? <Avatar person={person} /> : <View style={s.ini}><Text style={s.iniT}>{(u.name || '?').slice(0, 2)}</Text></View>}
                <View style={s.copy}>
                  <Text style={s.name}>{u.name}</Text>
                  {u.title ? <Text style={s.title}>{u.title}</Text> : null}
                  {u.last ? <Text style={s.when}>Last active {fmtD(u.last)}</Text> : null}
                  {known ? (
                    <View style={s.acts}>
                      {dm ? (
                        <Link to={`/mobile/chats/${dm.id}?from=${encodeURIComponent(`/mobile/projects/${projectId}/people`)}`} style={s.btn} accessibilityLabel={`Message ${u.name}`}>
                          <Text style={s.btnT}>Message</Text>
                        </Link>
                      ) : null}
                      <Pressable style={[s.btn, s.quiet]} onPress={() => openExternal(`tel:${phoneOf(person).replace(/\s/g, '')}`)} accessibilityRole="button" accessibilityLabel={`Call ${u.name}`}>
                        <Text style={[s.btnT, s.quietT]}>Call</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ))}
      {!groups.some((g: any) => g.people.length) && <Empty title="No people recorded" />}
    </Page>
  );
}

export function Attention() {
  useStore();
  const { projectId } = useParams();
  const project = projectOf(projectId);
  const work = project ? projectNeeds(projectId) : [];
  if (!project) return <Missing id={projectId} />;
  return (
    <Page sheet back={`/mobile/projects/${projectId}`} backLabel="Project" title="Needs attention" sub={project.name}>
      <Hint>Your actions and waiting items for this project. Shared with Today.</Hint>
      {work.map((item: any, i: number) => <WorkRow key={item.key} item={item} onDone={finishTask} first={i === 0} />)}
      {!work.length && <Empty title="Nothing needs you here" />}
    </Page>
  );
}

export function Changes() {
  useStore();
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const from = params.get('from');
  const back = from && from.startsWith('/mobile/') ? from : `/mobile/projects/${projectId}`;
  const backLabel = from && from.startsWith('/mobile/') ? backName(from) : 'Project';
  const project = projectOf(projectId);
  const rows = project ? svc.projectUpdates({ projectId }) : [];
  const pending = project && state.role === 'client'
    ? ((state.db as any).CHANGES || []).filter((c: any) => c.projectId === projectId && c.status === 'awaiting_client')
    : [];
  const s = useStyles((c) => ({
    lead: { marginTop: 2, marginBottom: 12, marginHorizontal: 2, color: c.ink2, fontSize: 14, fontWeight: '600' },
    card: { alignItems: 'flex-start', gap: 4, marginBottom: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, borderWidth: 1, borderColor: c.line, borderRadius: 16, backgroundColor: c.surface },
    meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' },
    pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: c.surface2 },
    pillT: { fontSize: 12, fontWeight: '600', color: c.ink2 },
    date: { color: c.ink3, fontSize: 13, fontWeight: '600' },
    title: { fontSize: 16, fontWeight: '600', lineHeight: 21, color: c.ink },
    detail: { color: c.ink2, fontSize: 14, lineHeight: 19 },
    quiet: { color: c.ink3, fontSize: 13, fontWeight: '600' },
    acts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
    btn: { minHeight: 36, marginTop: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    btnT: { color: c.accentInk, fontSize: 13, fontWeight: '700' },
    quietBtn: { backgroundColor: c.surface2 },
    quietBtnT: { color: c.ink },
  }));
  const tones = useStyles((c) => ({
    ok: { backgroundColor: c.okSoft }, okT: { color: c.ok },
    open: { backgroundColor: c.warnSoft }, openT: { color: c.warn },
    late: { backgroundColor: c.critSoft }, lateT: { color: c.crit },
    kind: { backgroundColor: c.accentSoft }, kindT: { color: c.accentText },
  }));
  if (!project) return <Missing id={projectId} />;
  function decide(id: string, ok: boolean) {
    const change = ((state.db as any).CHANGES || []).find((c: any) => c.id === id);
    if (!change || state.role !== 'client') return;
    change.status = ok ? 'approved' : 'declined';
    change.signedAt = new Date().toISOString().slice(0, 16);
    svc.log(`Change ${change.status} · ${change.no}`, `Change ${change.id}`);
    if (ok) svc.recordApproval({ kind: 'change', projectId: change.projectId, value: change.no, instruction: change.title });
    core.persist();
    render();
  }
  const toneFor = (u: any) => (u.kind === 'drawing' ? 'kind' : /short/i.test(u.title) ? 'late' : u.kind === 'delivery' || u.kind === 'approval' ? 'ok' : '');
  const labelFor = (kind: string) => (kind === 'delivery' ? 'Delivery' : kind === 'drawing' ? 'Drawing' : kind === 'approval' ? 'Approval' : kind === 'answer' ? 'Answer' : kind);
  return (
    <Page sheet board back={back} backLabel={backLabel} title="Important changes" sub={project.name}>
      <Text style={s.lead}>Recorded changes with their original sources.</Text>
      {pending.map((c: any) => (
        <View key={c.id} style={s.card}>
          <View style={s.meta}><View style={[s.pill, tones.open]}><Text style={[s.pillT, tones.openT]}>Your approval</Text></View><Text style={s.date}>{c.no}</Text></View>
          <Text style={s.title}>{c.title}</Text>
          <Text style={s.detail}>{c.reason}</Text>
          <View style={s.acts}>
            <Pressable style={s.btn} onPress={() => decide(c.id, true)} accessibilityRole="button"><Text style={s.btnT}>Approve</Text></Pressable>
            <Pressable style={[s.btn, s.quietBtn]} onPress={() => decide(c.id, false)} accessibilityRole="button"><Text style={[s.btnT, s.quietBtnT]}>Decline</Text></Pressable>
          </View>
        </View>
      ))}
      {rows.map((u: any) => {
        const here = `/mobile/projects/${projectId}/changes${from ? `?from=${encodeURIComponent(from)}` : ''}`;
        const backQuery = `?from=${encodeURIComponent(here)}`;
        const siteChat = u.source?.type === 'delivery' && u.source.siteId
          ? svc.threads().find((t: any) => t.kind === 'site' && t.siteId === u.source.siteId)
          : null;
        const to = u.source?.threadId
          ? `/mobile/chats/${u.source.threadId}${backQuery}`
          : u.source?.type === 'drawing' && u.source.id
            ? `/mobile/projects/${projectId}/drawings/${encodeURIComponent(u.source.id)}${backQuery}`
            : siteChat
              ? `/mobile/chats/${siteChat.id}${backQuery}`
              : '';
        const tone = toneFor(u);
        const pill = tone === 'ok' ? tones.ok : tone === 'late' ? tones.late : tone === 'kind' ? tones.kind : null;
        const pillT = tone === 'ok' ? tones.okT : tone === 'late' ? tones.lateT : tone === 'kind' ? tones.kindT : null;
        return (
          <View key={u.id} style={s.card}>
            <View style={s.meta}>
              <View style={[s.pill, pill]}><Text style={[s.pillT, pillT]}>{labelFor(u.kind)}</Text></View>
              <Text style={s.date}>{fmtD(u.at)}</Text>
            </View>
            <Text style={s.title}>{u.title}</Text>
            <Text style={s.detail}>{u.detail}</Text>
            {to ? <Link to={to} style={s.btn}><Text style={s.btnT}>Open source</Text></Link> : <Text style={s.quiet}>No conversation recorded for this.</Text>}
          </View>
        );
      })}
      {!rows.length && !pending.length && <Empty title="No recorded changes" />}
    </Page>
  );
}

export function Refs() {
  useStore();
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const from = params.get('from');
  const back = from && from.startsWith('/mobile/') ? from : `/mobile/projects/${projectId}`;
  const backLabel = from && from.startsWith('/mobile/') ? backName(from) : 'Project';
  const project = projectOf(projectId);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const rows = project ? svc.clientRefs(projectId) : [];
  const s = useStyles((c) => ({
    lead: { marginTop: 2, marginBottom: 12, marginHorizontal: 2, color: c.ink2, fontSize: 14, fontWeight: '600' },
    card: { alignItems: 'flex-start', gap: 4, marginBottom: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, borderWidth: 1, borderColor: c.line, borderRadius: 16, backgroundColor: c.surface },
    title: { fontSize: 16, fontWeight: '600', lineHeight: 21, color: c.ink },
    detail: { color: c.ink2, fontSize: 14, lineHeight: 19 },
    acts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
    btn: { minHeight: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    btnT: { color: c.accentInk, fontSize: 13, fontWeight: '700' },
    quietBtn: { backgroundColor: c.surface2 },
    quietBtnT: { color: c.ink },
    pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: c.okSoft },
    pillT: { fontSize: 12, fontWeight: '600', color: c.ok },
    form: { marginTop: 4, padding: 14, gap: 10, borderWidth: 1, borderColor: c.line, borderRadius: 16, backgroundColor: c.surface },
  }));
  if (!project) return <Missing id={projectId} />;
  function add() {
    try {
      svc.addClientRef({ projectId, url, title });
      setUrl(''); setTitle(''); setError('');
      render();
    } catch (err) { setError(errMsg(err)); }
  }
  return (
    <Page sheet board back={back} backLabel={backLabel} title="References" sub={project.name}>
      <Text style={s.lead}>Client references and inspiration links.</Text>
      {rows.map((r: any) => (
        <View key={r.id} style={s.card}>
          <Text style={s.title}>{r.title || r.url}</Text>
          <Text style={s.detail}>{r.src}{r.room ? ` · ${r.room}` : ''}</Text>
          <View style={s.acts}>
            <Pressable style={s.btn} onPress={() => openExternal(r.url)} accessibilityRole="link" accessibilityLabel={`Open ${r.title || r.url}`}><Text style={s.btnT}>Open</Text></Pressable>
            {state.role !== 'client' && !r.promoted && can('moodboard', 'w') ? (
              <Pressable style={[s.btn, s.quietBtn]} onPress={() => { svc.promoteRef(r.id); render(); }} accessibilityRole="button"><Text style={[s.btnT, s.quietBtnT]}>Moodboard</Text></Pressable>
            ) : r.promoted ? <View style={s.pill}><Text style={s.pillT}>On moodboard</Text></View> : null}
          </View>
        </View>
      ))}
      {can('ref', 'w') && (
        <View style={s.form}>
          <LabeledInput label="Link" value={url} onChangeText={setUrl} placeholder="https://" />
          <LabeledInput label="Title" value={title} onChangeText={setTitle} />
          {error ? <WarnText>{error}</WarnText> : null}
          <SubmitBtn label="Add a link" onPress={add} />
        </View>
      )}
      {!rows.length && <Empty title="No references saved yet" />}
    </Page>
  );
}

export function Intake() {
  useStore();
  const { projectId } = useParams();
  const project = projectOf(projectId);
  const [item, setItem] = useState('');
  const [error, setError] = useState('');
  const rows = project ? svc.intake(projectId) : [];
  if (!project) return <Missing id={projectId} />;
  return (
    <Page sheet back={`/mobile/projects/${projectId}`} backLabel="Project" title="Client data checklist" sub={project.name}>
      {rows.map((i: any) => (
        <Row
          key={i.id}
          right={(
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Chip>{i.status}</Chip>
              {i.status === 'missing' && can('intake', 'w') ? (
                <ActBtn label="Ask client" quiet onPress={() => { try { svc.askIntake(i.id); render(); } catch (err) { setError(errMsg(err)); } }} />
              ) : null}
              {state.role === 'client' && i.status !== 'received' ? (
                <ActBtn label="Upload" quiet onPress={() => { svc.receiveIntake(i.id, 'Uploaded from phone'); render(); }} />
              ) : null}
            </View>
          )}
        >
          <RowTitle>{i.item}</RowTitle>
          {i.at ? <RowSub>{fmtD(i.at)}{i.file ? ` · ${i.file}` : ''}</RowSub> : null}
        </Row>
      ))}
      {error ? <WarnText>{error}</WarnText> : null}
      {can('intake', 'w') && (
        <View style={{ gap: 10, marginTop: 12 }}>
          <LabeledInput label="New item" value={item} onChangeText={setItem} a11y="Checklist item" />
          <SubmitBtn label="Add item" onPress={() => { try { svc.addIntake(projectId, item); setItem(''); render(); } catch (err) { setError(errMsg(err)); } }} />
        </View>
      )}
      {!rows.length && <Empty title="No checklist items yet" />}
    </Page>
  );
}

export function DrawingIndex() {
  useStore();
  const { projectId } = useParams();
  const project = projectOf(projectId);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const rows: any[] = project ? svc.drawingIndex(projectId) : [];
  const stages = [...new Set(rows.map((r) => r.stage))];
  const s = useStyles((c) => ({
    lead: { marginTop: 2, marginBottom: 12, marginHorizontal: 2, color: c.ink2, fontSize: 14, fontWeight: '600' },
    sect: { marginTop: 8, marginBottom: 8, marginHorizontal: 2, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: c.ink2 },
    card: { alignItems: 'flex-start', gap: 4, marginBottom: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, borderWidth: 1, borderColor: c.line, borderRadius: 16, backgroundColor: c.surface },
    no: { fontSize: 13, fontWeight: '700', color: c.ink2 },
    title: { fontSize: 16, fontWeight: '600', lineHeight: 21, color: c.ink },
    done: { color: c.ink3, textDecorationLine: 'line-through' },
    pill: { marginTop: 2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: c.okSoft },
    pillT: { fontSize: 12, fontWeight: '600', color: c.ok },
    btn: { minHeight: 36, marginTop: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    btnT: { color: c.accentInk, fontSize: 13, fontWeight: '700' },
    form: { marginTop: 4, padding: 14, borderWidth: 1, borderColor: c.line, borderRadius: 16, backgroundColor: c.surface },
  }));
  if (!project) return <Missing id={projectId} />;
  return (
    <Page sheet board back={`/mobile/projects/${projectId}`} backLabel="Project" title="Drawing index" sub={project.name}>
      <Text style={s.lead}>Planned sheets per stage. Struck through once finalised.</Text>
      {stages.map((stage, si) => (
        <View key={stage as string}>
          <Text style={[s.sect, si === 0 ? { marginTop: 0 } : { marginTop: 18 }]}>{stage as string}</Text>
          {rows.filter((r) => r.stage === stage).map((r) => (
            <View key={r.id} style={s.card}>
              <Text style={s.no}>{r.no}</Text>
              <Text style={[s.title, r.done ? s.done : null]}>{r.name}</Text>
              {r.done ? <View style={s.pill}><Text style={s.pillT}>{r.how}</Text></View> : null}
              {!r.done && can('drawing', 'w') ? (
                <Pressable style={s.btn} accessibilityRole="button" onPress={() => {
                  if (!reason.trim()) { setError('Say why this is finalised.'); return; }
                  try { svc.finaliseDrawing(r.id, reason.trim()); setError(''); render(); } catch (err) { setError(errMsg(err)); }
                }}><Text style={s.btnT}>Finalise</Text></Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ))}
      {can('drawing', 'w') && (
        <View style={s.form}>
          <LabeledInput label="Reason when you finalise" value={reason} onChangeText={setReason} a11y="Finalise reason" />
        </View>
      )}
      {error ? <WarnText>{error}</WarnText> : null}
      {!rows.length && <Empty title="No drawing index yet" />}
    </Page>
  );
}

export function Drawing() {
  useStore();
  const { projectId, drawingNo } = useParams();
  const [params] = useSearchParams();
  const from = params.get('from');
  const back = from && from.startsWith('/mobile/') ? from : `/mobile/projects/${projectId}/drawings`;
  const backLabel = from && from.startsWith('/mobile/') ? backName(from) : 'Drawings';
  const no = decodeURIComponent(drawingNo || '');
  const project = projectOf(projectId);
  const drawing = (project?.drawings || []).find((d: any) => d.no === no);
  const saved = phoneDrawings(projectId, 'saved').some((x: any) => x.no === no);
  const related = drawing && can('issue', 'r')
    ? svc.issues({ projectId }).filter((i: any) => i.status !== 'closed' && i.drawing === drawing.no)
    : [];
  const s = useStyles((c) => ({
    rev: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2, alignSelf: 'flex-start' },
    revT: { fontWeight: '700', color: c.ink, fontSize: 16 },
    p: { color: c.ink, fontSize: 15 },
  }));
  useEffect(() => {
    if (drawing) rememberPhoneDrawing(projectId, drawing.no, false);
  }, [projectId, no, drawing]);
  if (!project || !drawing) return <Missing id={projectId} />;
  const hereSelf = `/mobile/projects/${projectId}/drawings/${encodeURIComponent(drawing.no)}${from ? `?from=${encodeURIComponent(from)}` : ''}`;
  return (
    <Page sheet back={back} backLabel={backLabel} title={drawing.name} sub={project.name}>
      <Hint>Check the revision and purpose before anyone builds from it. This demo does not attach the original file.</Hint>
      <ViewCard>
        <View style={s.rev}><Text style={s.revT}>{drawing.rev}</Text></View>
        <B>{drawing.no}</B>
        <StatusEm ok={drawing.status === 'Issued for construction'}>{drawing.status || 'Purpose not recorded'}</StatusEm>
        <Text style={s.p}>{drawing.date ? `Dated ${fmtD(drawing.date)}` : 'Date not recorded'}{drawing.by ? ` · ${firstName(drawing.by)}` : ''}</Text>
        <ActBtn
          label={saved ? 'Saved on this phone' : 'Save on this phone'}
          quiet
          onPress={() => { rememberPhoneDrawing(projectId, drawing.no, true); render(); }}
        />
      </ViewCard>
      {related.length > 0 && (
        <View>
          <Sect>Open on this sheet</Sect>
          {related.map((issue: any) => (
            <Row key={issue.id} to={`/mobile/issues/${issue.id}?from=${encodeURIComponent(hereSelf)}`} right={<Icon name="chev" />}>
              <RowTitle>{issue.title}</RowTitle>
              <RowSub>{issue.status}</RowSub>
            </Row>
          ))}
        </View>
      )}
      {svc.assistKinds().includes('ask') && (
        <DayRow to={`/mobile/projects/${projectId}/assist?kind=ask&drawing=${encodeURIComponent(drawing.no)}&q=${encodeURIComponent(`What is open on drawing ${drawing.no}?`)}&from=${encodeURIComponent(hereSelf)}`}>
          <B>Ask about this sheet</B>
          <Sub>{drawing.no}</Sub>
        </DayRow>
      )}
    </Page>
  );
}

export function Share() {
  useStore();
  const { projectId } = useParams();
  const project = projectOf(projectId);
  const [label, setLabel] = useState('Issued drawings');
  const [made, setMade] = useState<any>(null);
  const [error, setError] = useState('');
  const links: any[] = project ? svc.shareLinks(projectId) : [];
  if (!project) return <Missing id={projectId} />;
  return (
    <Page sheet back={`/mobile/projects/${projectId}`} backLabel="Project" title="Share a link" sub={project.name}>
      <Hint>An expiring web link. Anyone with the link can view until it expires.</Hint>
      {can('share', 'w') && (
        <View style={{ gap: 10, marginTop: 12 }}>
          <LabeledInput label="What you are sharing" value={label} onChangeText={setLabel} a11y="Share label" />
          <SubmitBtn label="Create a 7-day link" onPress={() => {
            try { setMade(svc.createShare({ projectId, label, days: 7 })); setError(''); render(); } catch (err) { setError(errMsg(err)); }
          }} />
        </View>
      )}
      {error ? <WarnText>{error}</WarnText> : null}
      {made ? <Hint>Link ready until {fmtD(made.expires)} · {svc.shareUrl(made)}</Hint> : null}
      {links.map((l) => (
        <Row
          key={l.id}
          right={l.status === 'active' ? <ActBtn label="Revoke" quiet onPress={() => { try { svc.revokeShare(l.id); render(); } catch (err) { setError(errMsg(err)); } }} /> : null}
        >
          <RowTitle>{l.label}</RowTitle>
          <RowSub>{l.status} · until {fmtD(l.expires)} · {l.views} views</RowSub>
        </Row>
      ))}
    </Page>
  );
}
