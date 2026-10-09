import React, { useEffect, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, openExternal, useNavigate, useParams, useSearchParams } from '../platform/router';
import { useStyles, useTheme } from '../platform/theme';
import Icon from '../ui/Icon';
import Photo from '../ui/Photo';
import { Avatar, ThreadAvatar } from '../ui/faces';
import { Note, Page, Screen, TopBar, BackButton, backName } from '../ui/frame';
import {
  svc, state, user, firstName, fmtT, messagesOf, audience, threadTitle, postMessage, projectName, phoneOf, stamp, render,
  toggleReaction, deleteMessage, hideMessage, toggleDecision, editMessage, can, myThreads, preview, useStore, core,
} from '../store';
import { FILE_KINDS, filingLabel } from '../../../frontend/src/shared/filing';
import { siteHasSuggestion } from '../../../frontend/src/shared/chatExtras';
import { AudioModule, RecordingPresets, createAudioPlayer, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';

const SAMPLE_MEDIA: Record<string, { title: string; hue: number; seed: number }[]> = {
  site: [
    { title: 'Shuttering A to D', hue: 30, seed: 45 },
    { title: 'Rebar at C4', hue: 28, seed: 23 },
    { title: 'Slab 2 from grid A', hue: 30, seed: 46 },
    { title: 'Cement delivery', hue: 28, seed: 31 },
    { title: 'Workers on site', hue: 28, seed: 21 },
    { title: 'Kitchen north wall', hue: 28, seed: 43 },
  ],
  client: [
    { title: 'Kitchen island reference', hue: 20, seed: 8 },
    { title: 'Fluted oak pantry', hue: 32, seed: 12 },
    { title: 'Terrace sample', hue: 18, seed: 61 },
  ],
  internal: [
    { title: 'Window opening sketch', hue: 18, seed: 61 },
    { title: 'Kitchen north wall', hue: 28, seed: 41 },
    { title: 'Slab from grid A', hue: 30, seed: 44 },
    { title: 'Column C4', hue: 28, seed: 23 },
    { title: 'Pantry door sample', hue: 32, seed: 12 },
    { title: 'Terrace from the road', hue: 30, seed: 46 },
  ],
  dm: [
    { title: 'Site photo', hue: 28, seed: 21 },
    { title: 'Drawing markup', hue: 200, seed: 2 },
    { title: 'Sample on site', hue: 32, seed: 12 },
  ],
};

const SAMPLE_DOCS: Record<string, { kind: string; title: string }[]> = {
  site: [
    { kind: 'File', title: 'HA-2401-S-301 R1.pdf' },
    { kind: 'Voice note', title: '0:19 · Column C4 rebar is ready for the check.' },
  ],
  client: [{ kind: 'File', title: 'Pantry door sample.pdf' }],
  internal: [
    { kind: 'File', title: 'HA-2401-A-101 R4.pdf' },
    { kind: 'Voice note', title: '0:15 · Confirm the window before the mason starts.' },
  ],
  dm: [{ kind: 'File', title: 'Cab bill.pdf' }],
};

// ---------- small shared building blocks (CSS: .sect .day-row .primary .ghost .stack .view-card .note) ----------

function useKit() {
  return useStyles((c, th) => ({
    sect: { marginTop: 6, marginHorizontal: 2, marginBottom: 4, paddingTop: 10, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: c.ink3 },
    dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
    dayB: { fontSize: 15, fontWeight: '600', lineHeight: 20, color: c.ink },
    dayS: { marginTop: 1, fontSize: 13, lineHeight: 18, color: c.ink2 },
    acts: { fontSize: 14, fontWeight: '600', color: c.ink3 },
    primary: { minHeight: 52, marginVertical: 8, borderRadius: th.radius.r2, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
    primaryT: { color: c.accentInk, fontWeight: '700', fontSize: 16 },
    ghost: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
    ghostT: { fontWeight: '500', fontSize: 16, color: c.ink },
    textBtn: { minHeight: 44, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
    textBtnT: { fontWeight: '600', color: c.ink2, fontSize: 16 },
    note: { color: c.ink2, fontSize: 13, marginTop: 8 },
    warn: { color: c.crit, fontWeight: '600', fontSize: 15 },
    card: { gap: 4, marginBottom: 10, padding: 14, borderRadius: th.radius.r2, backgroundColor: c.surface },
    cardT: { color: c.ink, fontSize: 16 },
    stack: { gap: 10, marginTop: 12 },
    label: { fontWeight: '600', color: c.ink, fontSize: 15 },
    input: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: c.line, borderRadius: th.radius.r2, backgroundColor: c.surface, color: c.ink, fontSize: 16 },
    empty: { paddingVertical: 32, paddingHorizontal: 20, alignItems: 'center' },
    emptyH: { fontSize: 17, fontWeight: '600', color: c.ink, marginVertical: 4 },
    emptyP: { color: c.ink2, textAlign: 'center' },
    h2: { fontSize: 17, fontWeight: '600', color: c.ink, marginTop: 12, marginBottom: 4 },
    selBox: { minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderColor: c.line, borderRadius: th.radius.r2, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    selOpt: { minHeight: 42, paddingHorizontal: 12, justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
    box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: c.ink3, alignItems: 'center', justifyContent: 'center' },
    boxOn: { backgroundColor: c.accent, borderColor: c.accent },
  }));
}

function Empty({ title, text, back = '/mobile/chats', pageTitle = 'Chat' }: { title: string; text?: string; back?: string; pageTitle?: string }) {
  const k = useKit();
  return (
    <Page back={back} title={pageTitle}>
      <View style={k.empty}><Text style={k.emptyH}>{title}</Text>{text ? <Text style={k.emptyP}>{text}</Text> : null}</View>
    </Page>
  );
}

function Primary({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const k = useKit();
  return (
    <Pressable style={[k.primary, disabled && { opacity: 0.45 }]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={k.primaryT}>{label}</Text>
    </Pressable>
  );
}

function Ghost({ label, onPress, to, warn }: { label: string; onPress?: () => void; to?: string; warn?: boolean }) {
  const k = useKit();
  const { c } = useTheme();
  const inner = <Text style={[k.ghostT, warn && { color: c.crit }]}>{label}</Text>;
  return to
    ? <Link to={to} style={k.ghost} accessibilityLabel={label}>{inner}</Link>
    : <Pressable style={k.ghost} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>{inner}</Pressable>;
}

function Sect({ children }: { children: React.ReactNode }) {
  const k = useKit();
  return <Text style={k.sect}>{children}</Text>;
}

function DayRow({ to, onPress, acts, actsTo, children, pressed }: {
  to?: string; onPress?: () => void; acts?: React.ReactNode; actsTo?: string; children: React.ReactNode; pressed?: boolean;
}) {
  const k = useKit();
  const navigate = useNavigate();
  const body = <View style={{ flex: 1, minWidth: 0 }}>{children}</View>;
  const tail = acts != null ? <Text style={k.acts}>{acts}</Text> : null;
  void actsTo;
  if (to || onPress) {
    return (
      <Pressable style={k.dayRow} onPress={() => (onPress ? onPress() : navigate(to as string))} accessibilityRole={to ? 'link' : 'button'} accessibilityState={pressed != null ? { selected: pressed } : undefined}>
        {body}{tail}
      </Pressable>
    );
  }
  return <View style={k.dayRow}>{body}{tail}</View>;
}

const RowB = ({ children }: { children: React.ReactNode }) => { const k = useKit(); return <Text style={k.dayB}>{children}</Text>; };
const RowS = ({ children }: { children: React.ReactNode }) => { const k = useKit(); return <Text style={k.dayS}>{children}</Text>; };

function Field({ label, value, onChangeText, multiline, placeholder, autoFocus }: {
  label: string; value: string; onChangeText: (v: string) => void; multiline?: boolean; placeholder?: string; autoFocus?: boolean;
}) {
  const k = useKit();
  const { c } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={k.label}>{label}</Text>
      <TextInput
        style={[k.input, multiline && { minHeight: 90, textAlignVertical: 'top' }]} value={value} onChangeText={onChangeText}
        multiline={multiline} numberOfLines={multiline ? 3 : 1} placeholder={placeholder} placeholderTextColor={c.ink3}
        accessibilityLabel={label} autoFocus={autoFocus}
      />
    </View>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const k = useKit();
  const [open, setOpen] = useState(false);
  const cur = options.find((o) => o.value === value);
  return (
    <View style={{ gap: 4 }}>
      <Text style={k.label}>{label}</Text>
      <View>
        <Pressable style={k.selBox} onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityLabel={label}>
          <Text style={{ color: k.cardT.color, fontSize: 16 }}>{cur?.label ?? ''}</Text>
          <Text style={{ color: k.acts.color }}>{open ? '▴' : '▾'}</Text>
        </Pressable>
        {open ? (
          <View style={[k.selBox, { flexDirection: 'column', alignItems: 'stretch', paddingHorizontal: 0, marginTop: 4 }]}>
            {options.map((o, i) => (
              <Pressable key={o.value} style={[k.selOpt, i === 0 && { borderTopWidth: 0 }]} onPress={() => { onChange(o.value); setOpen(false); }} accessibilityLabel={o.label}>
                <Text style={{ color: k.cardT.color, fontSize: 16, fontWeight: o.value === value ? '700' : '400' }}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Check({ label, on, onPress, radio }: { label: string; on: boolean; onPress: () => void; radio?: boolean }) {
  const k = useKit();
  return (
    <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 }} onPress={onPress} accessibilityRole={radio ? 'radio' : 'checkbox'} accessibilityState={{ checked: on }} accessibilityLabel={label}>
      <View style={[k.box, radio && { borderRadius: 11 }, on && k.boxOn]}>{on ? <Icon name="check" size={14} color="#fff" /> : null}</View>
      <Text style={[k.label, { flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const k = useKit();
  return <View style={k.card}>{children}</View>;
}
const CardP = ({ children, style }: { children: React.ReactNode; style?: any }) => { const k = useKit(); return <Text style={[k.cardT, style]}>{children}</Text>; };
const Warn = ({ children }: { children: React.ReactNode }) => { const k = useKit(); return <Text style={k.warn}>{children}</Text>; };
const Soft = ({ children }: { children: React.ReactNode }) => { const k = useKit(); return <Text style={k.note}>{children}</Text>; };

const tel = (u: any) => `tel:${phoneOf(u).replace(/\s/g, '')}`;
const fromOf = (v: string | null) => (v && v.startsWith('/mobile/') ? v : '');

// ---------- Group info ----------

export function GroupInfo() {
  useStore();
  const k = useKit();
  const { c } = useTheme();
  const { threadId } = useParams();
  const [params] = useSearchParams();
  const backTo = fromOf(params.get('from'));
  const [sample, setSample] = useState<any>(null);
  const [tab, setTab] = useState('Photos');
  const thread = svc.thread(threadId);
  const s = useStyles((cc, th) => ({
    id: { alignItems: 'center', gap: 4, paddingTop: 10, paddingBottom: 6 },
    idB: { fontSize: 20, fontWeight: '600', lineHeight: 25, color: cc.ink, textAlign: 'center' },
    idS: { fontSize: 14, lineHeight: 19, color: cc.ink2, textAlign: 'center' },
    strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
    cell: { width: '32.6%', aspectRatio: 1, overflow: 'hidden', backgroundColor: cc.ground },
    open: { marginBottom: 8 },
    openT: { marginTop: 6, color: cc.ink2, fontSize: 14 },
  }));
  if (!thread) return <Empty title="This chat isn’t available" />;
  const members = thread.memberIds.map((id: string) => user(id)).filter((u: any) => u?.id);
  const other = thread.kind === 'dm' ? members.find((u: any) => u.id !== state.userId) : null;
  const muted = svc.chatMuted(threadId);
  const msgs = messagesOf(threadId).filter((m: any) => !m.deleted);
  const photos = msgs.filter((m: any) => m.photo || (m.media && m.media.kind !== 'video'));
  const files = msgs.filter((m: any) => m.file || m.kind === 'file');
  const links = msgs.filter((m: any) => m.link);
  const voiceNotes = msgs.filter((m: any) => m.voice || m.audio);
  const drawings = msgs.filter((m: any) => m.kind === 'drawing');
  const media = tab === 'Links' ? links : photos;
  const docs = tab === 'Voice' ? voiceNotes : tab === 'Drawings' ? drawings : tab === 'Files' ? files : [];
  const samples = photos.length ? [] : (SAMPLE_MEDIA[thread.kind] || SAMPLE_MEDIA.internal);
  const sampleDocs = docs.length ? [] : (SAMPLE_DOCS[thread.kind] || SAMPLE_DOCS.internal);
  const placeholders = sampleDocs.filter((item) => item.kind === ({ Files: 'File', Voice: 'Voice note', Drawings: 'Drawing' } as Record<string, string>)[tab]);
  const pinned = msgs.filter((m: any) => m.decision);
  const chatTo = `/mobile/chats/${threadId}${backTo ? `?from=${encodeURIComponent(backTo)}` : ''}`;
  const about = ({
    internal: 'Office only. The client never sees this.',
    client: 'The client is in this conversation.',
    site: 'Notes and photos for the site team.',
    dm: other ? `${other.title || 'Direct message'} · ${phoneOf(other)}` : 'Direct message',
  } as Record<string, string>)[thread.kind] || audience(thread);
  return (
    <Page sheet stackTitle back={chatTo} backLabel="Chat" title={threadTitle(thread)} sub={thread.kind === 'dm' ? 'Direct message' : `${audience(thread)} · ${members.length} people`}>
      <View style={s.id}>
        <ThreadAvatar thread={thread} size="lg" />
        <Text style={s.idB}>{threadTitle(thread)}</Text>
        <Text style={s.idS}>{about}</Text>
      </View>
      <Sect>Media, links and docs</Sect>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {['Photos', 'Files', 'Links', 'Voice', 'Drawings'].map((k) => (
          <Pressable key={k} onPress={() => { setTab(k); setSample(null); }} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: tab === k ? c.accent : c.surface2 }}>
            <Text style={{ color: tab === k ? c.accentInk : c.ink2, fontWeight: '600' }}>{k}</Text>
          </Pressable>
        ))}
      </View>
      {sample ? (
        <Pressable style={s.open} onPress={() => setSample(null)} accessibilityLabel={sample.title}>
          <Photo hue={sample.hue} seed={sample.seed} ar={4 / 3} />
          <Text style={s.openT}>{sample.title}</Text>
        </Pressable>
      ) : null}
      {(tab === 'Photos' || tab === 'Links') && media.length ? (
        <View style={s.strip}>
          {media.map((m: any) => (
            <Link key={m.id} to={`${chatTo}#${m.id}`} accessibilityLabel={m.link?.title || m.text || 'Photo'} style={s.cell}>
              {m.photo?.dataUrl
                ? <Image source={{ uri: m.photo.dataUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                : <Photo hue={m.photo?.hue ?? m.link?.hue} seed={m.photo?.seed ?? m.link?.seed} ar={1} />}
            </Link>
          ))}
        </View>
      ) : (tab === 'Photos') && (
        <View style={s.strip}>
          {samples.map((item) => (
            <Pressable key={item.title} style={s.cell} onPress={() => setSample(item)} accessibilityLabel={item.title} accessibilityState={{ selected: sample?.title === item.title }}>
              <Photo hue={item.hue} seed={item.seed} ar={1} />
            </Pressable>
          ))}
        </View>
      )}
      {tab !== 'Photos' && tab !== 'Links' && !docs.length && !placeholders.length ? <Text style={k.note}>Nothing here yet.</Text> : null}
      {tab !== 'Photos' && tab !== 'Links' && !docs.length && placeholders.map((item) => (
        <DayRow key={item.title}><RowB>{item.kind}</RowB><RowS>{item.title}</RowS></DayRow>
      ))}
      {tab !== 'Photos' && tab !== 'Links' && docs.map((m: any) => (
        <DayRow key={m.id} to={`${chatTo}#${m.id}`}>
          <RowB>{m.voice ? 'Voice note' : 'File'}</RowB>
          <RowS>{m.text || (typeof m.voice === 'string' ? m.voice : m.voice?.dur) || 'Shared in this chat'}</RowS>
        </DayRow>
      ))}
      <Sect>Options</Sect>
      <DayRow
        onPress={() => {
          svc.setChatMuted(threadId, !muted);
        }}
        acts={muted ? 'On' : 'Off'}
      >
        <RowB>Mute notifications</RowB><RowS>Stops the unread mark on this phone</RowS>
      </DayRow>
      {pinned.map((m: any) => (
        <DayRow key={m.id} to={`${chatTo}#${m.id}`}><RowB>Pinned decision</RowB><RowS>{m.text || 'Decision'}</RowS></DayRow>
      ))}
      <Sect>{thread.kind === 'dm' ? 'Contact' : `${members.length} people`}</Sect>
      {members.map((u: any) => (
        <View key={u.id} style={k.dayRow}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <Avatar person={u} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={k.dayB} numberOfLines={1}>{u.name}</Text>
              <Text style={k.dayS} numberOfLines={1}>{u.title} · {phoneOf(u)}</Text>
            </View>
          </View>
          {u.id !== state.userId
            ? <Pressable onPress={() => openExternal(tel(u))} accessibilityLabel={`Call ${u.name}`} hitSlop={8}><Text style={k.acts}>Call</Text></Pressable>
            : <Text style={k.acts}>You</Text>}
        </View>
      ))}
    </Page>
  );
}

// ---------- Voice note player ----------

let playingNote: { id: number; player: any; setOn: (v: boolean) => void } | null = null;
let noteSeq = 1;

export function VoicePlay({ src, dur = '' }: { src?: string; dur?: string }) {
  const [id] = useState(() => noteSeq++);
  const [on, setOn] = useState(false);
  const { c } = useTheme();
  const playerRef = useRef<any>(null);
  const sub = useRef<any>(null);
  const kill = () => {
    try { sub.current?.remove?.(); playerRef.current?.remove?.(); } catch { /* player already gone */ }
    playerRef.current = null; sub.current = null;
    if (playingNote?.id === id) playingNote = null;
  };
  useEffect(() => () => kill(), []); // eslint-disable-line react-hooks/exhaustive-deps
  function toggle() {
    if (!src) return;
    if (on) { kill(); setOn(false); return; }
    if (playingNote && playingNote.id !== id) {
      try { playingNote.player.remove(); } catch { /* ignore */ }
      playingNote.setOn(false);
      playingNote = null;
    }
    try {
      const player = createAudioPlayer({ uri: src });
      playerRef.current = player;
      sub.current = player.addListener('playbackStatusUpdate', (st: any) => {
        if (st?.didJustFinish) { kill(); setOn(false); }
      });
      player.play();
      playingNote = { id, player, setOn };
      setOn(true);
    } catch { setOn(false); }
  }
  return (
    <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36, marginBottom: 4 }} onPress={toggle} accessibilityRole="button" accessibilityLabel={on ? 'Stop voice note' : 'Play voice note'}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
        {on
          ? <View style={{ width: 10, height: 12, borderLeftWidth: 3, borderRightWidth: 3, borderColor: c.accentInk }} />
          : <View style={{ marginLeft: 2 }}><Icon name="play" size={14} color={c.accentInk} /></View>}
      </View>
      <View style={{ flex: 1, height: 3, borderRadius: 99, backgroundColor: c.accentSoft, overflow: 'hidden' }}>
        {on ? <View style={{ width: '35%', height: 3, backgroundColor: c.accent }} /> : null}
      </View>
      <Text style={{ fontSize: 12, color: c.ink2 }}>{dur}</Text>
    </Pressable>
  );
}

// ---------- Voice note recorder ----------

const clock = (ms: number) => {
  const sec = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

async function toDataUrl(uri: string) {
  if (Platform.OS !== 'web') return uri;
  try {
    const blob = await (await fetch(uri)).blob();
    return await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result || ''));
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  } catch { return uri; }
}

export function Voice() {
  useStore();
  const k = useKit();
  const { c } = useTheme();
  const { threadId } = useParams();
  const navigate = useNavigate();
  const thread = svc.thread(threadId);
  const [phase, setPhase] = useState<'idle' | 'recording' | 'ready'>('idle');
  const [audio, setAudio] = useState('');
  const [dur, setDur] = useState('0:00');
  const [micNote, setMicNote] = useState('');
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const timer = useRef<any>(null);
  const started = useRef(0);
  useEffect(() => () => clearInterval(timer.current), []);
  if (!thread) return <Empty title="This chat isn’t available" pageTitle="Voice" />;

  async function start() {
    setMicNote('');
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) throw new Error('denied');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      started.current = Date.now();
      setDur('0:00');
      timer.current = setInterval(() => setDur(clock(Date.now() - started.current)), 200);
      setPhase('recording');
    } catch {
      setMicNote('The microphone did not open. Allow the microphone, then try again.');
    }
  }
  async function stop() {
    clearInterval(timer.current);
    setDur(clock(Date.now() - started.current));
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      const uri = recorder.uri || '';
      setAudio(await toDataUrl(uri));
      setPhase('ready');
    } catch {
      setMicNote('The recording could not be saved. Try again.');
      setPhase('idle');
    }
  }
  function again() { setAudio(''); setDur('0:00'); setPhase('idle'); }
  void AudioModule; void c;

  return (
    <Page back={`/mobile/chats/${threadId}`} backLabel="Chat" title="Voice note" sub={threadTitle(thread)}>
      {phase === 'idle' && (
        <View style={k.stack}>
          <Note>Tap once to record. You can listen to it, then send it into this chat.</Note>
          <Primary label="Tap to record" onPress={start} />
          {micNote ? <Soft>{micNote}</Soft> : null}
        </View>
      )}
      {phase === 'recording' && (
        <View style={k.stack}>
          <Text style={{ fontWeight: '700', color: c.ink, fontSize: 16 }}>Recording · {dur}</Text>
          <Primary label="Stop" onPress={stop} />
        </View>
      )}
      {phase === 'ready' && (
        <View style={k.stack}>
          <VoicePlay src={audio} dur={dur} />
          <Note>Tap play to hear the recording, then send it.</Note>
          <Primary label="Send to this chat" onPress={() => {
            if (!audio) return;
            postMessage(threadId, { voice: { dur, audio } });
            navigate(`/mobile/chats/${threadId}`);
          }} />
          <Pressable style={k.textBtn} onPress={again} accessibilityRole="button" accessibilityLabel="Record again"><Text style={k.textBtnT}>Record again</Text></Pressable>
        </View>
      )}
    </Page>
  );
}

// ---------- Message actions ----------

const EMOJI: [string, string][] = [['✅', 'Done'], ['👀', 'Review'], ['📝', 'Noted'], ['⭐', 'Mark'], ['⚠️', 'Flag']];

function reminderAt(which: string) {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  if (which === 'monday') {
    do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 1);
  } else {
    d.setDate(d.getDate() + 1);
  }
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T09:00`;
}

export function MessageActions({ thread, message, onReply, onDeleted, onForward }: {
  thread: any; message: any; onReply?: () => void; onDeleted?: () => void; onForward?: () => void;
}) {
  useStore();
  const k = useKit();
  const { c } = useTheme();
  const filing = state.filings?.[message.id];
  const [edit, setEdit] = useState(message.text || '');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [remindOpen, setRemindOpen] = useState(false);
  const [reminded, setReminded] = useState('');
  const mine = message.by === state.userId;
  const canPin = !message.deleted && can('thread', 'w') && (state.role === 'partner' || state.role === 'site_manager');
  const others = (thread.memberIds || []).filter((id: string) => id !== message.by);
  if (confirmDelete) {
    return (
      <View>
        <Text style={k.h2}>Delete this message?</Text>
        <Ghost warn label="Delete for me" onPress={() => { hideMessage(message); onDeleted?.(); }} />
        {mine && !message.deleted && <Ghost warn label="Delete for everyone" onPress={() => { deleteMessage(message); onDeleted?.(); }} />}
        <Ghost label="Cancel" onPress={() => setConfirmDelete(false)} />
      </View>
    );
  }
  return (
    <View>
      {!message.deleted && (
        <View accessibilityRole="toolbar" accessibilityLabel="Reactions" style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
          {EMOJI.map(([emoji, label]) => {
            const on = message.reactions?.[emoji]?.includes(state.userId);
            return (
              <Pressable key={emoji} onPress={() => toggleReaction(message, emoji)} accessibilityLabel={label}
                style={[{ flex: 1, minHeight: 52, borderRadius: 10, borderWidth: 1, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : c.surface, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 16 }}>{emoji}</Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: on ? c.accentText : c.ink2 }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {filing && !message.deleted ? <Text style={[k.note, { paddingVertical: 8, paddingHorizontal: 2, marginTop: 0 }]}>Filed · {filingLabel(filing) || 'this chat'}</Text> : null}
      {!message.deleted && <Ghost label="Reply" onPress={() => onReply?.()} />}
      {!message.deleted && <Ghost label="Forward" onPress={() => onForward?.()} />}
      <Ghost warn label="Delete" onPress={() => setConfirmDelete(true)} />
      {!message.deleted && <Ghost label="Change where this is filed" to={`/mobile/chats/${thread.id}/messages/${message.id}/filing`} />}
      {message.issueId ? <Ghost label="Open linked issue" to={`/mobile/issues/${message.issueId}`} /> : null}
      {!message.deleted && thread.projectId && svc.assistKinds().includes('followup') && (message.text || message.transcript) ? (
        <Ghost label="Suggest a follow-up" to={`/mobile/assist?kind=followup&message=${message.id}`} />
      ) : null}
      {!message.deleted && message.photo && svc.assistKinds().includes('concept') ? (
        <Ghost label="Finish palette from this photo" to={`/mobile/assist?kind=concept&message=${message.id}&project=${thread.projectId || ''}`} />
      ) : null}
      {canPin && <Ghost label={message.decision ? 'Unpin decision' : 'Pin as decision'} onPress={() => toggleDecision(message)} />}
      <Ghost label="Info · sent, delivered, read" onPress={() => setShowInfo((v) => !v)} />
      {showInfo && (
        <View style={[k.card, { marginTop: 8 }]}>
          <CardP>Sent · {fmtT(message.at)}</CardP>
          <CardP>Delivered · {fmtT(message.at)}</CardP>
          {others.map((id: string) => {
            const person = user(id);
            const read = id.charCodeAt(0) % 3 !== 0;
            return <CardP key={id}>{person.name} · {read ? `read ${fmtT(message.at)}` : 'not yet read'}</CardP>;
          })}
        </View>
      )}
      {!message.deleted && !remindOpen && <Ghost label="Remind me" onPress={() => setRemindOpen(true)} />}
      {!message.deleted && remindOpen && (
        <>
          <Ghost label="Tomorrow 9am" onPress={() => { svc.addFollowup(message.id, reminderAt('tomorrow')); setReminded('Reminder set for tomorrow at 9am.'); render(); }} />
          <Ghost label="Monday 9am" onPress={() => { svc.addFollowup(message.id, reminderAt('monday')); setReminded('Reminder set for Monday at 9am.'); render(); }} />
        </>
      )}
      {reminded ? <Text style={[k.note, { paddingVertical: 8, paddingHorizontal: 2, marginTop: 0 }]}>{reminded}</Text> : null}
      {mine && !message.deleted && !!message.text && !message.voice && !editing && <Ghost label="Edit" onPress={() => setEditing(true)} />}
      {mine && !message.deleted && !!message.text && !message.voice && editing && (
        <View style={[k.stack, { marginVertical: 8 }]}>
          <Field label="Edit" value={edit} onChangeText={setEdit} multiline />
          <Primary label="Save" onPress={() => { editMessage(message, edit); setEditing(false); }} />
        </View>
      )}
    </View>
  );
}

// ---------- Forward picker ----------

export function ForwardPick({ message, onClose }: { message: any; onClose: () => void }) {
  const navigate = useNavigate();
  const k = useKit();
  const { c } = useTheme();
  const [picked, setPicked] = useState<string[]>([]);
  function send() {
    const fields: any = { text: message.text || preview(message), forwarded: true };
    if (message.photo) fields.photo = message.photo;
    if (message.voice) fields.voice = message.voice;
    if (message.kind && !message.photo) fields.kind = message.kind;
    const sent = picked.filter((id) => postMessage(id, fields));
    onClose();
    if (sent.length === 1) navigate(`/mobile/chats/${sent[0]}`);
  }
  return (
    <Screen>
      <TopBar>
        <Pressable onPress={onClose} accessibilityLabel="Back to chat" style={{ minHeight: 44, justifyContent: 'center' }}><Icon name="back" /></Pressable>
        <Text style={{ fontSize: 16, fontWeight: '600', color: c.ink, flex: 1 }}>Forward to</Text>
      </TopBar>
      <ScrollView style={{ flex: 1, backgroundColor: c.surface }}>
        {myThreads().map(({ t: dest }: any) => {
          const on = picked.includes(dest.id);
          return (
            <Pressable key={dest.id} onPress={() => setPicked((ids) => (on ? ids.filter((id) => id !== dest.id) : [...ids, dest.id]))}
              accessibilityState={{ selected: on }} accessibilityLabel={threadTitle(dest)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: on ? c.accentSoft : 'transparent' }}>
              <ThreadAvatar thread={dest} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{threadTitle(dest)}</Text>
                <Text style={{ color: c.ink2, fontSize: 14 }} numberOfLines={1}>{audience(dest)}</Text>
              </View>
              <View style={[k.box, { borderRadius: 11 }, on && k.boxOn]}>{on ? <Icon name="check" size={14} color="#fff" /> : null}</View>
            </Pressable>
          );
        })}
      </ScrollView>
      {picked.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, backgroundColor: c.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }}>
          <Text style={{ flex: 1, color: c.ink, fontWeight: '600', fontSize: 16 }}>{picked.length} selected</Text>
          <Pressable onPress={send} accessibilityLabel="Forward message" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="send" color={c.accentInk} />
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

// ---------- Message page ----------

function SiteReviewBlock({ messageId }: { messageId: string }) {
  const k = useKit();
  const r = svc.siteUpdateReview(messageId);
  const [error, setError] = useState('');
  if (!r) return null;
  if (r.applied || r.message?.siteAnswer) return <Soft>Confirmed records · included in daily log</Soft>;
  if (!siteHasSuggestion(r)) return null;
  const s = r.suggestion;
  return (
    <View style={k.stack}>
      <Soft>AI suggestion · demo. Check against the source; only selected records will be saved.</Soft>
      <Primary label="Confirm selected records" onPress={() => {
        try {
          svc.saveSiteUpdate(messageId, {
            attendance: !!(r.canAttendance && s.headcount),
            headcount: s.headcount,
            delivery: !!(r.canDelivery && s.delivery),
            item: s.delivery?.item || '',
            received: s.delivery?.received || '',
            ordered: s.delivery?.ordered || '',
            unit: s.delivery?.unit || '',
            issue: !!(r.canIssue && s.issueTitle),
            title: s.issueTitle || '',
            issueId: '',
          });
          setError('');
          render();
        } catch (err: any) { setError(err.message); }
      }} />
      {error ? <Warn>{error}</Warn> : null}
    </View>
  );
}

export function MessagePage() {
  useStore();
  const k = useKit();
  const { c } = useTheme();
  const { threadId, messageId } = useParams();
  const navigate = useNavigate();
  const thread = svc.thread(threadId);
  const message = messagesOf(threadId).find((m: any) => m.id === messageId);
  const [reply, setReply] = useState('');
  const replyRef = useRef<TextInput>(null);
  if (!thread || !message) return <Empty title="This message isn’t available" back={`/mobile/chats/${threadId || ''}`} pageTitle="Message" />;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Page back={`/mobile/chats/${threadId}`} backLabel="Chat" title="Message" sub={`${firstName(message.by)} · ${fmtT(message.at)}`}>
        <Card>
          {message.deleted ? <CardP style={{ color: c.ink3, fontStyle: 'italic' }}>This message was deleted</CardP> : <CardP>{message.text}</CardP>}
          {message.edited ? <Text style={{ color: c.ink3, fontSize: 12 }}>Edited</Text> : null}
        </Card>
        <SiteReviewBlock messageId={message.id} />
        <MessageActions thread={thread} message={message}
          onReply={() => replyRef.current?.focus()}
          onDeleted={() => navigate(`/mobile/chats/${threadId}`)}
          onForward={() => navigate(`/mobile/chats/${threadId}`, { state: { forward: message.id } })} />
        {!message.deleted && (
          <View style={k.stack}>
            <View style={{ gap: 4 }}>
              <Text style={k.label}>Reply</Text>
              <TextInput ref={replyRef} style={[k.input, { minHeight: 90, textAlignVertical: 'top' }]} multiline numberOfLines={3} value={reply} onChangeText={setReply} accessibilityLabel="Reply" />
            </View>
            <Primary label="Send reply" onPress={() => {
              if (!reply.trim()) return;
              postMessage(threadId, { text: reply.trim(), replyTo: messageId });
              navigate(`/mobile/chats/${threadId}`);
            }} />
          </View>
        )}
      </Page>
    </KeyboardAvoidingView>
  );
}

// ---------- Filing ----------

export function Filing() {
  useStore();
  const k = useKit();
  const { threadId, messageId } = useParams();
  const navigate = useNavigate();
  const projects = svc.projects();
  const rooms = ['Kitchen', 'Living', 'Bathroom', 'Structure', 'Facade', 'Not set'];
  const kinds = Object.entries(FILE_KINDS);
  const current = state.filings?.[messageId] || {};
  const [projectId, setProjectId] = useState(current.projectId || projects[0]?.id || '');
  const [room, setRoom] = useState(current.room || 'Not set');
  const [kind, setKind] = useState(current.kind || 'note');
  const [drawing, setDrawing] = useState(current.drawing || '');
  const [error, setError] = useState('');
  return (
    <Page back={`/mobile/chats/${threadId}/messages/${messageId}`} backLabel="Message" title="Where should this go?">
      <View style={k.stack}>
        <Select label="Project" value={projectId} onChange={setProjectId} options={projects.map((p: any) => ({ value: p.id, label: p.name }))} />
        <Select label="Room" value={room} onChange={setRoom} options={rooms.map((r) => ({ value: r, label: r }))} />
        <Select label="What is it" value={kind} onChange={setKind} options={kinds.map(([k, l]) => ({ value: k, label: l }))} />
        <Field label="Drawing number" value={drawing} onChangeText={setDrawing} placeholder="HA-2401-A-101" />
        {error ? <Warn>{error}</Warn> : null}
        <Primary label="Save filing" onPress={() => {
          try {
            const saved = svc.fileMessage(messageId, { projectId, room: room === 'Not set' ? '' : room, kind, drawing: drawing.trim() || null });
            if (!saved) throw new Error('Filing could not be saved on this device.');
            navigate(`/mobile/chats/${threadId}/messages/${messageId}`);
          } catch (err: any) { setError(err.message); }
        }} />
      </View>
    </Page>
  );
}

// ---------- Issue ----------

export function Issue() {
  useStore();
  const k = useKit();
  const { c } = useTheme();
  const { issueId } = useParams();
  const [params] = useSearchParams();
  const from = params.get('from');
  const back = fromOf(from) || '/mobile/today';
  const backLabel = backName(back);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const detail = svc.siteIssueDetails(issueId);
  if (!detail) return <Empty title="This issue isn’t available" back={back} pageTitle="Issue" />;
  const { issue } = detail;
  const here = `/mobile/issues/${issueId}${from ? `?from=${encodeURIComponent(from)}` : ''}`;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Page sheet stackTitle back={back} backLabel={backLabel} title={issue.title} sub={`${issue.status}${issue.due ? ` · reply by ${fmtT(issue.due)}` : ''}`}>
        <Text style={[k.note, { marginTop: 0, marginBottom: 6 }]}>{issue.type}{issue.drawing ? ` · ${issue.drawing}` : ''} · raised by {firstName(issue.raisedBy)}</Text>
        <Text style={k.h2}>Linked site updates</Text>
        {detail.sources.map((m: any) => (
          <DayRow key={m.id} to={`/mobile/chats/${m.threadId}?from=${encodeURIComponent(here)}#${m.id}`}>
            <RowB>{firstName(m.by)}</RowB><RowS>{m.text}</RowS>
          </DayRow>
        ))}
        {!detail.sources.length && <Soft>No site update linked.</Soft>}
        <Text style={k.h2}>Office answers</Text>
        {detail.answers.length ? detail.answers.map((m: any) => (
          <DayRow key={m.id}><RowB>{firstName(m.by)}</RowB><RowS>{m.text}</RowS></DayRow>
        )) : <Soft>No answer yet.</Soft>}
        {detail.canAnswer && (
          <View style={k.stack}>
            <Field label="Office answer" value={answer} onChangeText={setAnswer} multiline />
            {error ? <Warn>{error}</Warn> : null}
            <Primary label="Send answer" onPress={() => {
              try { svc.answerSiteIssue(issueId, answer); setAnswer(''); setError(''); render(); }
              catch (err: any) { setError(err.message); }
            }} />
          </View>
        )}
        {svc.assistKinds().includes('ask') ? (
          <DayRow to={`/mobile/projects/${issue.projectId}/assist?kind=ask&issue=${issueId}&from=${encodeURIComponent(here)}`}>
            <RowB>Summarise this issue</RowB><RowS>From the recorded history</RowS>
          </DayRow>
        ) : null}
        <View style={{ height: 1, backgroundColor: c.ground }} />
      </Page>
    </KeyboardAvoidingView>
  );
}

// ---------- AI assist ----------

export function Assist() {
  useStore();
  const k = useKit();
  const { c } = useTheme();
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const kind = params.get('kind') || 'ask';
  const fromPage = params.get('from');
  const issueId = params.get('issue') || '';
  const drawingNo = params.get('drawing') || '';
  const sheetDrawing = drawingNo ? (svc.project(projectId)?.drawings || []).find((d: any) => d.no === drawingNo) : null;
  const messageId = params.get('message') || '';
  const projects = svc.projects();
  const sites = svc.sites();
  const [pid, setPid] = useState(params.get('project') || projectId || projects[0]?.id || '');
  const [siteId, setSiteId] = useState(params.get('site') || sites[0]?.id || '');
  const brief = issueId ? svc.siteIssueDetails(issueId) : null;
  const [question, setQuestion] = useState(issueId ? 'Summarise the recorded history of this issue.' : (params.get('q') || 'What is still open?'));
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<any>(null);
  const [options, setOptions] = useState<any>(null);
  const [owner, setOwner] = useState('');
  const [due, setDue] = useState(stamp().slice(0, 10));
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [sendTo, setSendTo] = useState('');
  const allowed = svc.assistKinds().includes(kind);
  const materials = svc.materials({ projectId: pid });
  const clientThread = svc.threads().find((t: any) => t.projectId === pid && t.kind === 'client');
  const clientMessages = clientThread ? messagesOf(clientThread.id).filter((m: any) => !m.deleted && (m.text || m.transcript)).slice(-12) : [];
  const photos = svc.threads().filter((t: any) => !pid || t.projectId === pid).flatMap((t: any) => messagesOf(t.id).filter((m: any) => m.photo && !m.deleted).map((m: any) => ({ ...m, threadName: threadTitle(t) })));
  const title = issueId ? 'Summarise this issue' : drawingNo ? 'Ask about this sheet' : ({
    ask: 'Ask about this project', compare: 'Compare materials', daily: 'Review day report',
    client: 'Client update', concept: 'Finish palette', followup: 'Suggested follow-up',
  } as Record<string, string>)[kind] || 'Draft';

  const chats = svc.threads().filter((t: any) => t.projectId === pid && ['client', 'internal', 'site'].includes(t.kind) && can('thread', 'w'));
  const chosen = chats.some((t: any) => t.id === sendTo) ? sendTo : (chats.find((t: any) => t.kind === 'internal') || chats.find((t: any) => t.kind === 'site') || chats[0])?.id || '';
  const afterSend = (threadId: string) => {
    const backTo = fromOf(fromPage) || `/mobile/projects/${pid}`;
    navigate(`/mobile/chats/${threadId}?from=${encodeURIComponent(backTo)}`);
  };

  function sendQuestion() {
    const thread = chats.find((t: any) => t.id === chosen);
    const text = question.trim();
    if (!thread || !text) { setError('Write the question and choose who receives it.'); return; }
    if (!postMessage(thread.id, { text })) { setError('This conversation is not available to send to.'); return; }
    afterSend(thread.id);
  }
  function sendPrepared() {
    const thread = chats.find((t: any) => t.id === chosen);
    const text = (result?.text || '').trim();
    if (!thread || !text) { setError('Choose who receives this draft.'); return; }
    if (!postMessage(thread.id, { text })) { setError('This conversation is not available to send to.'); return; }
    afterSend(thread.id);
  }
  const pickedIds = () => Object.keys(picked).filter((id) => picked[id]);
  async function run() {
    setError('');
    setSaved('');
    try {
      const next = kind === 'compare'
        ? { projectId: pid, materialIds: pickedIds() }
        : kind === 'daily'
          ? { siteId, date: stamp().slice(0, 10) }
          : kind === 'client'
            ? { threadId: clientThread?.id, messageIds: pickedIds() }
            : kind === 'concept'
              ? { messageId: pickedIds()[0] || messageId }
              : kind === 'followup'
                ? { messageId }
                : { projectId: pid, question, ...(issueId ? { issueId } : {}) };
      const draft = await svc.aiAssist(kind, next);
      setOptions(next);
      setResult(draft);
      setOwner(draft.proposal?.owners?.[0]?.id || '');
    } catch (err: any) { setError(err.message); }
  }
  async function sendDraft() {
    setError('');
    try {
      await svc.sendAssist(kind, options, result.text, result.sources);
      render();
      navigate(`/mobile/chats/${result.destinationThreadId}`);
    } catch (err: any) { setError(err.message); }
  }
  function saveFollowup() {
    setError('');
    try {
      svc.confirmFollowup({
        messageId,
        title: (result.proposal?.title || result.text || '').slice(0, 200),
        owner, due, reviewedSource: result.sources[0],
      });
      render();
      setSaved('Follow-up saved. It shows in Today for the person you chose.');
    } catch (err: any) { setError(err.message); }
  }

  const backPath = fromOf(fromPage) || (messageId ? `/mobile/chats/${(state as any).db?.MESSAGES.find((m: any) => m.id === messageId)?.threadId || ''}/messages/${messageId}` : projectId ? `/mobile/projects/${projectId}` : '/mobile/today');
  const EmptyBox = ({ h, p }: { h: string; p?: string }) => (
    <View style={k.empty}><Text style={k.emptyH}>{h}</Text>{p ? <Text style={k.emptyP}>{p}</Text> : null}</View>
  );
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Page sheet={!!(issueId || drawingNo)} stackTitle={!!(issueId || drawingNo)} back={backPath} backLabel={issueId ? 'Issue' : drawingNo ? 'Drawing' : 'Back'} title={title}
        sub={issueId ? (brief?.issue?.title || projectName(pid)) : drawingNo ? (sheetDrawing?.name || drawingNo) : projectName(pid)}>
        {!!issueId && !brief && <EmptyBox h="This issue isn’t available" />}
        {!!drawingNo && !sheetDrawing && <EmptyBox h="This sheet isn’t available" />}
        {!allowed && <EmptyBox h="This draft isn’t available for you" p="Switch person if you need this action." />}
        {allowed && (!issueId || brief) && (!drawingNo || sheetDrawing) && (
          <View style={k.stack}>
            {!!issueId && !!brief && <Soft>{projectName(brief.issue.projectId)}. This uses the recorded history of this issue only.</Soft>}
            {!!drawingNo && !!sheetDrawing && <Soft>{projectName(projectId)} · {drawingNo}. This question is about this sheet.</Soft>}
            {!['daily', 'followup', 'concept'].includes(kind) && !issueId && !drawingNo && (
              <Select label="Project" value={pid} onChange={(v) => { setPid(v); setPicked({}); }} options={projects.map((p: any) => ({ value: p.id, label: p.name }))} />
            )}
            {kind === 'daily' && <Select label="Site" value={siteId} onChange={setSiteId} options={sites.map((s: any) => ({ value: s.id, label: s.name }))} />}
            {kind === 'ask' && !issueId && <Field label="Your question" value={question} onChangeText={setQuestion} multiline />}
            {kind === 'ask' && (
              <>
                <Text style={k.h2}>Who receives this</Text>
                {chats.map((t: any) => (
                  <DayRow key={t.id} onPress={() => setSendTo(t.id)} pressed={chosen === t.id}>
                    <RowB>{audience(t)}</RowB><RowS>{t.name}{chosen === t.id ? ' · sending here' : ''}</RowS>
                  </DayRow>
                ))}
                {!chats.length && <Soft>No conversation you can send this to.</Soft>}
                {!issueId && chats.length > 0 && <Primary label="Send question" onPress={sendQuestion} />}
              </>
            )}
            {kind === 'compare' && materials.map((m: any) => (
              <Check key={m.id} label={m.name} on={!!picked[m.id]} onPress={() => setPicked({ ...picked, [m.id]: !picked[m.id] })} />
            ))}
            {kind === 'client' && (clientMessages.length ? clientMessages.map((m: any) => (
              <Check key={m.id} label={(m.text || m.transcript).slice(0, 120)} on={!!picked[m.id]} onPress={() => setPicked({ ...picked, [m.id]: !picked[m.id] })} />
            )) : <Soft>No client conversation to draft from.</Soft>)}
            {kind === 'concept' && !messageId && (photos.length ? photos.slice(0, 8).map((m: any) => (
              <Check radio key={m.id} label={`${m.threadName}: ${(m.text || 'Photo').slice(0, 80)}`} on={!!picked[m.id]} onPress={() => setPicked({ [m.id]: true })} />
            )) : <Soft>Send a photo in a project chat first.</Soft>)}
            {error ? <Warn>{error}</Warn> : null}
            <Primary label={issueId ? 'Prepare issue brief' : 'Prepare draft'} onPress={run} />
          </View>
        )}
        {result && (
          <View style={[k.card, { marginTop: 12 }]}>
            <Text style={{ fontWeight: '600', color: c.ink, fontSize: 16 }}>AI draft · demo</Text>
            <CardP>{result.text}</CardP>
            {result.concepts?.map((cn: any) => (
              <CardP key={cn.name}><Text style={{ fontWeight: '600' }}>{cn.name}</Text> · {cn.note}</CardP>
            ))}
            {result.missing?.length ? <Warn>{result.missing.join(' ')}</Warn> : null}
            {['daily', 'client'].includes(kind) && <Primary label="Send this draft" onPress={sendDraft} />}
            {kind === 'ask' && chats.length > 0 && <Primary label={`Send this draft to ${audience(chats.find((t: any) => t.id === chosen))}`} onPress={sendPrepared} />}
          </View>
        )}
        {result && kind === 'followup' && (
          <View style={k.stack}>
            <Select label="Who" value={owner} onChange={setOwner} options={(result.proposal?.owners || []).map((u: any) => ({ value: u.id, label: u.name }))} />
            <Field label="Needed by" value={due} onChangeText={setDue} placeholder="YYYY-MM-DD" />
            {saved ? <Soft>{saved}</Soft> : <Primary label="Save follow-up" onPress={saveFollowup} />}
          </View>
        )}
      </Page>
    </KeyboardAvoidingView>
  );
}

// ---------- Call ----------

export function Call() {
  useStore();
  const k = useKit();
  const { threadId } = useParams();
  const [params] = useSearchParams();
  const backTo = fromOf(params.get('from'));
  const [made, setMade] = useState<any>(null);
  const [error, setError] = useState('');
  const voice = params.get('voice') === '1';
  const thread = svc.thread(threadId);
  if (!thread) return <Empty title="This chat isn’t available" pageTitle="Call" />;
  const chatTo = `/mobile/chats/${threadId}${backTo ? `?from=${encodeURIComponent(backTo)}` : ''}`;
  if (voice) {
    const members = thread.memberIds.map((id: string) => user(id)).filter((u: any) => u?.id && u.id !== state.userId);
    return (
      <Page sheet stackTitle back={chatTo} backLabel="Chat" title="Call" sub={threadTitle(thread)}>
        <Text style={[k.note, { marginTop: 0, marginBottom: 6 }]}>Phone someone in this chat.</Text>
        {members.map((u: any) => (
          <View key={u.id} style={k.dayRow}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <Avatar person={u} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={k.dayB} numberOfLines={1}>{u.name}</Text>
                <Text style={k.dayS} numberOfLines={1}>{u.title} · {phoneOf(u)}</Text>
              </View>
            </View>
            <Pressable onPress={() => openExternal(tel(u))} accessibilityLabel={`Call ${u.name}`} hitSlop={8}><Text style={k.acts}>Call</Text></Pressable>
          </View>
        ))}
      </Page>
    );
  }
  return (
    <Page back={chatTo} backLabel="Chat" title="Start video call" sub={threadTitle(thread)}>
      <Note>Posts a call card into this chat. Meet for the studio.</Note>
      {error ? <Warn>{error}</Warn> : null}
      <Primary label="Start Google Meet" onPress={() => {
        try { setMade(svc.startCall(threadId)); setError(''); render(); }
        catch (err: any) { setError(err.message); }
      }} />
      {made ? (
        <Pressable onPress={() => openExternal(made.url)} accessibilityRole="link" accessibilityLabel={made.url}>
          <Text style={[k.note, { textDecorationLine: 'underline' }]}>{made.url}</Text>
        </Pressable>
      ) : null}
    </Page>
  );
}

void core;
