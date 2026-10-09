import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Icon from '../ui/Icon';
import { Page } from '../ui/frame';
import { backName } from '../ui/frame';
import { Avatar } from '../ui/faces';
import { Link, openExternal, useParams, useSearchParams } from '../platform/router';
import { useStyles } from '../platform/theme';
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

export function Materials() {
  useStore();
  const { projectId } = useParams();
  const project = projectOf(projectId);
  const rows = project ? svc.materials({ projectId }) : [];
  if (!project) return <Missing id={projectId} />;
  if (!can('material', 'r')) {
    return <Page sheet back={`/mobile/projects/${projectId}`} backLabel="Project" title="Materials"><Empty title="Materials aren’t available for this login" /></Page>;
  }
  return (
    <Page sheet back={`/mobile/projects/${projectId}`} backLabel="Project" title="Materials" sub={project.name}>
      <Hint>Samples and decisions shared with you.</Hint>
      {rows.map((m: any) => (
        <ViewCard key={m.id}>
          <B>{m.name}</B>
          <Sub>{m.vendor || 'Supplier not recorded'}</Sub>
          <StatusEm ok={m.status === 'approved'}>{(m.status || 'Status not recorded').replace(/_/g, ' ')}</StatusEm>
          {m.status === 'client_pending' && state.role === 'client' ? (
            <ActRow>
              <ActBtn label="Approve" onPress={() => { svc.approveMaterial(m.id, true); render(); }} />
              <ActBtn label="Not this one" quiet onPress={() => { svc.approveMaterial(m.id, false); render(); }} />
            </ActRow>
          ) : null}
          {m.status === 'client_pending' && staff() && project.clientId ? <Sub>Waiting on {firstName(project.clientId)}</Sub> : null}
        </ViewCard>
      ))}
      {svc.assistKinds().includes('compare') && rows.length >= 2 ? (
        <PrimaryRow to={`/mobile/projects/${projectId}/assist?kind=compare`}>Compare materials</PrimaryRow>
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
    ini: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    iniT: { color: c.accentInk, fontWeight: '600', fontSize: 13 },
    wrap: { paddingHorizontal: 0 },
  }));
  if (!project) return <Missing id={projectId} />;
  return (
    <Page sheet back={`/mobile/projects/${projectId}`} backLabel="Project" title="People" sub={project.name} bare>
      <Hint>People in this project.</Hint>
      {groups.filter((g: any) => g.people.length).map((g: any) => (
        <View key={g.name}>
          <Sect>{g.name}</Sect>
          {g.people.map((u: any) => {
            const person = user(u.id);
            const known = (state.db as any).USERS.some((x: any) => x.id === u.id);
            const dm = known
              ? (state.db as any).THREADS.find((t: any) => t.kind === 'dm' && (t.memberIds || []).includes(u.id) && (t.memberIds || []).includes(state.userId))
              : null;
            return (
              <Row
                key={u.id}
                left={person?.id ? <Avatar person={person} /> : <View style={s.ini}><Text style={s.iniT}>{(u.name || '?').slice(0, 2)}</Text></View>}
                right={known ? (
                  <ActRow>
                    {dm ? (
                      <Link to={`/mobile/chats/${dm.id}?from=${encodeURIComponent(`/mobile/projects/${projectId}/people`)}`} accessibilityLabel={`Message ${u.name}`}>
                        <ActLabel>Message</ActLabel>
                      </Link>
                    ) : null}
                    <ActBtn label="Call" accessibilityLabel={`Call ${u.name}`} onPress={() => openExternal(`tel:${phoneOf(person).replace(/\s/g, '')}`)} />
                  </ActRow>
                ) : null}
              >
                <RowTitle>{u.name}</RowTitle>
                <RowSub>{u.title}{u.last ? ` · last active ${fmtD(u.last)}` : ''}</RowSub>
              </Row>
            );
          })}
        </View>
      ))}
      {!groups.some((g: any) => g.people.length) && <Empty title="No people recorded" />}
    </Page>
  );
}

function ActLabel({ children }: { children: React.ReactNode }) {
  const s = useStyles((c) => ({ t: { fontSize: 13, fontWeight: '700', color: c.accentText } }));
  return <Text style={s.t}>{children}</Text>;
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
  return (
    <Page sheet back={back} backLabel={backLabel} title="Important changes" sub={project.name} bare>
      <Hint>Recorded changes with their original sources.</Hint>
      {pending.map((c: any) => (
        <ViewCard key={c.id}>
          <Small>Your approval · {c.no}</Small>
          <B>{c.title}</B>
          <Sub>{c.reason}</Sub>
          <ActRow>
            <ActBtn label="Approve" onPress={() => decide(c.id, true)} />
            <ActBtn label="Decline" quiet onPress={() => decide(c.id, false)} />
          </ActRow>
        </ViewCard>
      ))}
      {rows.map((u: any, i: number) => {
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
        return (
          <DayRow key={u.id} to={to || undefined} first={i === 0 && !pending.length}>
            <Small>{u.kind} · {fmtD(u.at)}</Small>
            <B>{u.title}</B>
            <Sub>{u.detail}</Sub>
            {!to ? <Sub>No conversation recorded for this.</Sub> : null}
          </DayRow>
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
  if (!project) return <Missing id={projectId} />;
  function add() {
    try {
      svc.addClientRef({ projectId, url, title });
      setUrl(''); setTitle(''); setError('');
      render();
    } catch (err) { setError(errMsg(err)); }
  }
  return (
    <Page sheet back={back} backLabel={backLabel} title="References" sub={project.name}>
      <Hint>Client references and inspiration links.</Hint>
      {rows.map((r: any) => (
        <Row
          key={r.id}
          right={(
            <ActRow>
              <ActBtn label="Open" accessibilityLabel={`Open ${r.title || r.url}`} onPress={() => openExternal(r.url)} />
              {state.role !== 'client' && !r.promoted && can('moodboard', 'w') ? (
                <ActBtn label="Moodboard" quiet onPress={() => { svc.promoteRef(r.id); render(); }} />
              ) : r.promoted ? <Chip>On moodboard</Chip> : null}
            </ActRow>
          )}
        >
          <RowTitle>{r.title || r.url}</RowTitle>
          <RowSub>{r.src}{r.room ? ` · ${r.room}` : ''}</RowSub>
        </Row>
      ))}
      {can('ref', 'w') && (
        <View style={{ gap: 10, marginTop: 12 }}>
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
  if (!project) return <Missing id={projectId} />;
  return (
    <Page sheet back={`/mobile/projects/${projectId}`} backLabel="Project" title="Drawing index" sub={project.name} bare>
      <Hint>Planned sheets per stage. Struck through once finalised.</Hint>
      {stages.map((stage) => (
        <View key={stage as string}>
          <Sect>{stage as string}</Sect>
          {rows.filter((r) => r.stage === stage).map((r) => (
            <Row
              key={r.id}
              right={!r.done && can('drawing', 'w') ? (
                <ActBtn label="Finalise" quiet onPress={() => {
                  if (!reason.trim()) { setError('Say why this is finalised.'); return; }
                  try { svc.finaliseDrawing(r.id, reason.trim()); setError(''); render(); } catch (err) { setError(errMsg(err)); }
                }} />
              ) : null}
            >
              <RowTitle done={r.done}>{r.no} {r.name}</RowTitle>
              {r.done ? <RowSub>{r.how}</RowSub> : null}
            </Row>
          ))}
        </View>
      ))}
      {can('drawing', 'w') && (
        <View style={{ marginTop: 12 }}>
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
