import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, Image, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Icon from '../ui/Icon';
import { Avatar } from '../ui/faces';
import Photo, { photoSource } from '../ui/Photo';
import { Screen, TopBar } from '../ui/frame';
import { useField } from '../ui/FieldContext';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from '../platform/router';
import { useStyles, useTheme } from '../platform/theme';
import {
  svc, siblings, messagesOf, audience, firstName, fmtT, dayLabel, preview, state, can, onPhone,
  postMessage, toggleReaction, toggleDecision, projectOf, siteFor, useStore, t, staff, user, phoneOf, render,
} from '../store';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { AIProvider, toast } from '../../../frontend/src/shared/core';
import { filingLabel } from '../../../frontend/src/shared/filing';
import { siteHasSuggestion } from '../../../frontend/src/shared/chatExtras';
import { ThreadHeader } from './Chats';
import * as ChatPagesNs from './ChatPages';
import { VoiceFallback, ActionsFallback, ForwardFallback } from './ThreadParts';
import PhotoEdit from './PhotoEdit';

// Use the real ChatPages pieces once they are ported; fall back to local equivalents until then.
const CP: any = ChatPagesNs;
const VoicePlay: any = CP.VoicePlay || VoiceFallback;
const MessageActions: any = CP.MessageActions || ActionsFallback;
const ForwardPick: any = CP.ForwardPick || ForwardFallback;

const BASICS = (): any[] => ([
  ['photo', t('Photo'), 'photos'],
  ['camera', t('Camera'), 'camera'],
  ['voice', t('Voice note'), 'mic'],
  ['drawing', t('Drawing'), 'drawing'],
  ['delivery', t('Delivery'), 'delivery'],
  ['sample', t('Sample'), 'sample'],
]);
const MORE = (): any[] => ([
  ['location', t('Location'), 'location'],
  ['bill', t('Bill / expense'), 'bill'],
  ['material', t('Material request'), 'delivery', ['site_manager', 'contractor', 'partner', 'designer']],
  ['attendance', t('Attendance'), 'people', ['site_manager', 'contractor']],
  ['file', t('File'), 'file'],
  ['checkin', t('Check in'), 'today', ['site_manager', 'contractor']],
  ['daylog', t('Today\'s log'), 'today', ['site_manager', 'partner', 'designer']],
  ['poll', t('Poll'), 'checkcheck'],
  ['contact', t('Contact'), 'people'],
  ['document', t('Document'), 'file'],
  ['audio', t('Audio'), 'mic'],
]);
const clock = (ms: number) => {
  const sec = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};
async function toDataUrl(uri: string) {
  if (Platform.OS !== 'web' || !uri) return uri;
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
// Recording timer with the pulsing red dot (prototype .rec-time).
function RecTime({ dur }: { dur: string }) {
  const { c } = useTheme();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.35, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto', marginRight: 8 }}>
      <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#e11d48', opacity: pulse }} />
      <Text style={{ fontWeight: '700', color: c.ink, fontVariant: ['tabular-nums'] }}>{dur}</Text>
    </View>
  );
}
function chipOf(m: any) {
  const f = state.filings?.[m.id];
  if (!f) return { status: '', label: t('File message') };
  const who = f.by === 'user' ? t('Filed') : f.status === 'filed' ? t('AI filed') : f.status === 'check' ? t('AI check') : t('AI needs context');
  return { status: f.status === 'check' ? 'check' : f.status === 'ask' ? 'ask' : '', label: `${who} · ${f.status === 'ask' ? t('Which project?') : (filingLabel(f) || t('Note'))}` };
}

const KIND_LABEL = (): Record<string, string> => ({
  drawing: t('Drawing'), delivery: t('Delivery'), sample: t('Sample'), location: t('Location'), bill: t('Bill'),
  material: t('Material'), file: t('File'), attendance: t('Attendance'), checkin: t('Checked in'),
});
const allowed = (roles?: string[]) => !roles || roles.includes(state.role);
const label = (what: string) => (({ photo: 'Add a caption', sample: 'What is this sample?', delivery: 'What arrived?', bill: 'What was it for?', material: 'What do you need?', file: 'Add a caption' } as any)[what] || t('Note'));

function ChatBubble({ mine, same, pinned, deleted, onOpen, onReply, children }: any) {
  const shift = useRef(new Animated.Value(0)).current;
  const cb = useRef({ onReply, deleted });
  cb.current = { onReply, deleted };
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dx > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => {
      const dx = g.dx;
      shift.setValue(dx <= 0 ? 0 : dx < 72 ? dx : 72 + (dx - 72) * 0.12);
    },
    onPanResponderRelease: (_, g) => {
      const reply = g.dx > 56 && !cb.current.deleted;
      Animated.timing(shift, { toValue: 0, duration: 180, useNativeDriver: false }).start();
      if (reply) cb.current.onReply();
    },
    onPanResponderTerminate: () => { Animated.timing(shift, { toValue: 0, duration: 180, useNativeDriver: false }).start(); },
  }), [shift]);
  const shown = shift.interpolate({ inputRange: [0, 64], outputRange: [0, 1], extrapolate: 'clamp' });
  const s = useStyles((c, th) => ({
    row: { maxWidth: '86%', position: 'relative' },
    icon: { position: 'absolute', left: 4, top: '50%', marginTop: -14, width: 28, height: 28, borderRadius: 14, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', shadowColor: th.dark ? '#000' : c.ink, shadowOpacity: th.dark ? 0.4 : 0.08, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1 },
    bubble: {
      paddingTop: 6, paddingBottom: 4, paddingLeft: 10, paddingRight: 8, borderRadius: 12, minWidth: 136,
      backgroundColor: c.surface,
      shadowColor: th.dark ? '#000' : c.ink, shadowOpacity: th.dark ? 0.4 : 0.08, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1,
    },
    mine: { minWidth: 172, backgroundColor: c.accent, borderTopRightRadius: 4 },
    theirs: { borderTopLeftRadius: 4 },
    cont: { borderTopLeftRadius: 12, borderTopRightRadius: 12 },
    more: { position: 'absolute', right: 1, bottom: 2, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  }));
  return (
    <View style={s.row}>
      <Animated.View style={[s.icon, { opacity: shown, transform: [{ scale: shown.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }] }]} pointerEvents="none">
        <Icon name="undo" size={16} color={undefined} />
      </Animated.View>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: shift }] }}>
        <Pressable
          onLongPress={onOpen}
          delayLongPress={350}
          style={[s.bubble, mine ? s.mine : s.theirs, same && s.cont, pinned && { elevation: 1 }]}
        >
          {children}
          <Pressable style={s.more} onPress={onOpen} accessibilityRole="button" accessibilityLabel={t('Message options')} hitSlop={8}>
            <View style={{ transform: [{ rotate: '90deg' }] }}><Icon name="chev" size={14} color={undefined} /></View>
          </Pressable>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function Thread() {
  useStore();
  const { c } = useTheme();
  const { threadId } = useParams() as { threadId: string };
  const navigate = useNavigate();
  const thread = svc.thread(threadId);
  const { markRead, drafts, setDraft } = useField();
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<any>(null);
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [shot, setShot] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [voiceMode, setVoiceMode] = useState<null | 'hold' | 'locked'>(null);
  const [voiceDur, setVoiceDur] = useState('0:00');
  const [voiceHint, setVoiceHint] = useState('');
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const voiceTimer = useRef<any>(null);
  const voiceStarted = useRef(0);
  const holding = useRef(false);
  const cancelHold = useRef(false);
  const voiceModeRef = useRef<null | 'hold' | 'locked'>(null);
  const voiceToken = useRef(0);
  const [slideCancel, setSlideCancel] = useState(false);
  // The mic is a PanResponder (not a Pressable) so the touch stays ours when the finger slides off the
  // button: that is what makes "slide to cancel" work. Handlers are read from a ref so they are never stale.
  const micApi = useRef<any>({});
  const micPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => micApi.current.down(),
    onPanResponderMove: (_e, g) => micApi.current.move(g.dx),
    onPanResponderRelease: () => micApi.current.up(),
    onPanResponderTerminate: () => micApi.current.up(),
  })).current;
  useEffect(() => {
    if (!voiceHint) return undefined;
    const id = setTimeout(() => setVoiceHint(''), 2500);
    return () => clearTimeout(id);
  }, [voiceHint]);
  useEffect(() => () => {
    voiceToken.current += 1;
    holding.current = false;
    clearInterval(voiceTimer.current);
    if (voiceModeRef.current) {
      try { recorder.stop().catch(() => {}); } catch { /* recorder already released */ }
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [showWork, setShowWork] = useState(false);
  useEffect(() => { setShowWork(false); }, [threadId]);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [menu, setMenu] = useState<any>(null);
  const [forwardMsg, setForwardMsg] = useState<any>(null);
  const [editor, setEditor] = useState<any>(null);
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState(['', '']);
  const [pollMulti, setPollMulti] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [pickedId, setPickedId] = useState('');
  const [contactQuery, setContactQuery] = useState('');
  const [newContact, setNewContact] = useState(false);
  const [docUrl, setDocUrl] = useState('');
  const location = useLocation();
  const [params] = useSearchParams();
  const from = params.get('from');
  const backTo = from && from.startsWith('/mobile/') ? from : '/mobile/chats';
  const scroller = useRef<ScrollView>(null);
  const ys = useRef<Record<string, number>>({});
  const viewH = useRef(0);
  const text = drafts[threadId] || '';
  const count = thread ? messagesOf(thread.id).length : 0;

  const s = useStyles((c, th) => ({
    switcher: { flexDirection: 'row', gap: 4, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: c.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
    sw: { flex: 1, minHeight: 30, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    swOn: { backgroundColor: c.accent },
    swText: { fontSize: 13, fontWeight: '600', color: c.ink2, textAlign: 'center' },
    swTextOn: { color: c.accentInk },
    banner: { color: c.ink3, fontSize: 12, fontWeight: '500', textAlign: 'center', paddingTop: 4, paddingBottom: 8, paddingHorizontal: 16 },
    office: { alignSelf: 'center', marginTop: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: c.warnSoft, color: c.warn, fontSize: 12, fontWeight: '500', textAlign: 'center', overflow: 'hidden' },
    decisions: { backgroundColor: c.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
    pin: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34, paddingVertical: 4, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line },
    pinFirst: { borderTopWidth: 0 },
    jump: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
    kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', color: c.accentText },
    kickerOpen: { color: c.warn },
    jumpB: { fontWeight: '700', color: c.ink },
    pinTitle: { flex: 1, fontWeight: '650', color: c.ink, fontSize: 14 },
    dueMeta: { color: c.ink3, fontSize: 12 },
    unpin: { paddingVertical: 4, paddingHorizontal: 2 },
    unpinText: { color: c.accentText, fontWeight: '650', fontSize: 13 },
    body: { flex: 1, backgroundColor: c.chat },
    bodyIn: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 12 },
    day: { alignSelf: 'center', marginTop: 12, marginBottom: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: c.surface, shadowColor: th.dark ? '#000' : c.ink, shadowOpacity: th.dark ? 0.4 : 0.08, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1 },
    dayText: { fontSize: 12, fontWeight: '600', color: c.ink2 },
    cluster: { width: '100%', marginTop: 8, alignItems: 'flex-start' },
    clusterMine: { alignItems: 'flex-end' },
    clusterCont: { marginTop: 3 },
    who: { marginBottom: 2, fontSize: 13, fontWeight: '600', color: c.accentText },
    tag: { marginBottom: 4, fontSize: 12, fontWeight: '700', color: c.accent },
    fwd: { marginBottom: 2, fontSize: 12, fontStyle: 'italic', color: c.ink3 },
    quote: { marginBottom: 4, paddingVertical: 4, paddingLeft: 10, paddingRight: 8, borderRadius: 6, backgroundColor: th.dark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.7)', overflow: 'hidden' },
    quoteBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: c.accentText },
    quoteB: { color: c.accentText, fontSize: 12, fontWeight: '700' },
    quoteT: { color: c.ink2, fontSize: 13, lineHeight: 17.5 },
    shot: { width: 240, aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: c.surface3, marginBottom: 4 },
    swatch: { width: 240, height: 140, borderRadius: 8, overflow: 'hidden', marginBottom: 4 },
    line: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    chip: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0, maxWidth: '100%', borderWidth: 1, borderColor: c.line, borderRadius: 999, backgroundColor: c.surface2, paddingHorizontal: 10, paddingVertical: 2 },
    chipCheck: { borderColor: c.warnSoft, backgroundColor: c.warnSoft },
    chipAsk: { borderColor: c.critSoft, backgroundColor: c.critSoft },
    chipText: { fontSize: 12, color: c.ink2, flexShrink: 1 },
    suggest: { color: c.accentText, fontSize: 13, fontWeight: '650' },
    say: { flexShrink: 1, fontSize: 15.5, lineHeight: 21, color: c.ink },
    onAccent: { color: c.accentInk },
    onAccentMute: { color: c.accentInk, opacity: 0.78 },
    chipOn: { borderColor: 'transparent', backgroundColor: 'rgba(255,255,255,0.18)' },
    quoteMine: { backgroundColor: 'rgba(255,255,255,0.14)' },
    timeRow: { flexDirection: 'row', alignItems: 'center', marginRight: 14, marginLeft: 'auto' },
    time: { fontSize: 11, lineHeight: 14, color: c.ink3 },
    gone: { color: c.ink3, fontSize: 13, fontStyle: 'italic' },
    reacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
    react: { borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8, backgroundColor: c.ground },
    reactOn: { backgroundColor: c.accentSoft },
    reactText: { color: c.ink, fontSize: 15 },
    empty: { paddingVertical: 32, paddingHorizontal: 20, alignItems: 'center' },
    emptyH: { fontSize: 17, fontWeight: '600', color: c.ink, marginTop: 8, marginBottom: 4 },
    emptyP: { color: c.ink2, textAlign: 'center' },
    emptyLink: { color: c.accent, fontWeight: '700', marginTop: 8 },
    quick: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6, paddingHorizontal: 10, paddingBottom: 2 },
    quickBtn: { borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
    quickText: { color: c.accentText, fontWeight: '600' },
    replybar: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingTop: 8, paddingHorizontal: 12, backgroundColor: c.surface },
    replyText: { flex: 1, minWidth: 0, fontSize: 13, color: c.ink },
    replyB: { color: c.accentText, fontWeight: '700' },
    composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingTop: 6, paddingHorizontal: 8, backgroundColor: c.chat },
    pill: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', minHeight: 44, borderRadius: 22, backgroundColor: c.surface, paddingRight: 4, shadowColor: th.dark ? '#000' : c.ink, shadowOpacity: th.dark ? 0.4 : 0.08, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1 },
    input: { flex: 1, minHeight: 42, maxHeight: 120, paddingVertical: 10, paddingHorizontal: 4, color: c.ink, fontSize: 16 },
    round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    roundAccent: { backgroundColor: c.accent },
    back: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(12,30,41,0.4)', justifyContent: 'flex-end', zIndex: 5 },
    sheet: { maxHeight: '78%', paddingTop: 8, paddingHorizontal: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, backgroundColor: c.surface },
    grab: { width: 36, height: 4, marginTop: 4, marginBottom: 12, borderRadius: 999, backgroundColor: c.line, alignSelf: 'center' },
    h2: { fontSize: 16, fontWeight: '600', color: c.ink, textAlign: 'center', marginBottom: 14 },
    help: { marginTop: -6, marginHorizontal: 8, marginBottom: 12, textAlign: 'center', color: c.ink2, fontSize: 14, lineHeight: 19 },
    warnText: { color: c.crit, fontWeight: '600' },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
    tile: { width: '33.333%', alignItems: 'center', gap: 6 },
    tileIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
    tileText: { fontSize: 12, fontWeight: '600', color: c.ink2, textAlign: 'center' },
    textBtn: { minHeight: 44, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
    textBtnText: { fontWeight: '600', color: c.ink2, fontSize: 16 },
    stack: { gap: 10, marginTop: 12 },
    lbl: { gap: 4 },
    lblText: { fontWeight: '600', color: c.ink, fontSize: 16 },
    field: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: c.line, borderRadius: th.radius.r2, backgroundColor: c.surface, color: c.ink, fontSize: 16 },
    preview: { width: '100%', height: 140, borderRadius: 12, backgroundColor: c.surface3 },
    ghost: { minHeight: 48, marginVertical: 8, borderRadius: th.radius.r2, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' },
    ghostText: { fontWeight: '700', color: c.ink, fontSize: 16 },
    primary: { minHeight: 52, marginVertical: 8, borderRadius: th.radius.r2, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    primaryText: { fontWeight: '700', color: c.accentInk, fontSize: 16 },
    drow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
    drowOn: { backgroundColor: c.accentSoft },
    dcopy: { flex: 1, minWidth: 0 },
    dB: { fontWeight: '600', color: c.ink, fontSize: 16 },
    dS: { color: c.ink2, fontSize: 14 },
    pick: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.line2, alignItems: 'center', justifyContent: 'center' },
    pickOn: { backgroundColor: c.accent, borderColor: c.accent },
    note: { color: c.ink2, fontWeight: '500', fontSize: 14, paddingVertical: 8, paddingHorizontal: 2 },
    voiceLine: { fontWeight: '700', color: c.ink, fontSize: 16 },
    waBar: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
    waTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: c.ink },
    locRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 8 },
    locPin: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
    plain: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line, color: c.ink, fontSize: 16 },
    optRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: c.ink3 },
    add: { minHeight: 44, justifyContent: 'center' },
    addText: { color: c.accentText, fontSize: 16, fontWeight: '600' },
    switchRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    switchText: { fontSize: 16, fontWeight: '600', color: c.ink },
    track: { width: 46, height: 28, borderRadius: 14, backgroundColor: c.line2, justifyContent: 'center', paddingHorizontal: 3 },
    trackOn: { backgroundColor: c.accent },
    knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
    person: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 6 },
    tick: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: c.line2, alignItems: 'center', justifyContent: 'center' },
    tickOn: { backgroundColor: c.accent, borderColor: c.accent },
  }));

  useEffect(() => { if (threadId) markRead(threadId); }, [threadId, markRead]);

  useEffect(() => {
    const id = (location.state as any)?.forward;
    if (!id) return;
    const message = messagesOf(threadId).find((m: any) => m.id === id);
    if (message) setForwardMsg(message);
    navigate(`/mobile/chats/${threadId}`, { replace: true, state: null });
  }, [location.state, threadId, navigate]);

  const jumpTo = (id: string, animated = false) => {
    const y = ys.current[id];
    if (y == null) return false;
    scroller.current?.scrollTo({ y: Math.max(0, y - viewH.current / 2 + 30), animated });
    return true;
  };
  useEffect(() => {
    const id = (location.hash || '').replace(/^#/, '');
    const tm = setTimeout(() => {
      if (id && jumpTo(id)) return;
      scroller.current?.scrollToEnd({ animated: false });
    }, 60);
    return () => clearTimeout(tm);
  }, [threadId, count, location.hash]);

  if (forwardMsg) {
    return (
      <Screen>
        <ForwardPick message={forwardMsg} onClose={() => setForwardMsg(null)} onOpen={(id: string) => navigate(`/mobile/chats/${id}`)} />
      </Screen>
    );
  }

  if (!thread || !onPhone(thread.projectId)) {
    return (
      <Screen>
        <TopBar><Text style={{ fontSize: 22, fontWeight: '600', color: 'inherit' as any }}>{t('Chat')}</Text></TopBar>
        <View style={s.empty}>
          <Text style={s.emptyH}>{t('This chat isn’t available')}</Text>
          <Link to="/mobile/chats"><Text style={s.emptyLink}>{t('Back to chats')}</Text></Link>
        </View>
      </Screen>
    );
  }

  if (editor) {
    const ask = ({ sample: 'What is this sample?', delivery: 'What arrived?' } as any)[editor.what];
    return (
      <Screen>
        <PhotoEdit
          src={editor.src}
          noteLabel={ask || t('Add a caption')}
          noteRequired={Boolean(ask)}
          initialNote={editor.note || ''}
          onCancel={() => setEditor(null)}
          onSend={sendEdited}
        />
      </Screen>
    );
  }

  const msgs: any[] = messagesOf(thread.id);
  const related: any[] = siblings(thread);
  const inProject = Boolean(thread.projectId && thread.kind !== 'dm' && thread.groupType !== 'work');
  const workGroups = inProject ? svc.threads().filter((t: any) => t.groupType === 'work' && t.projectId === thread.projectId) : [];
  const pinned = msgs.filter((m) => m.decision && !m.deleted);
  const canPin = can('thread', 'w') && (state.role === 'partner' || state.role === 'site_manager');

  function send() {
    const value = text.trim();
    if (!value) return;
    postMessage(thread.id, { text: value, ...(replyTo ? { replyTo: replyTo.id } : {}) });
    setDraft(thread.id, '');
    setReplyTo(null);
    markRead(thread.id);
  }

  function openForm(item: any[]) {
    setError(''); setNote(''); setAmount(''); setShot(''); setFileName('');
    setPollQ(''); setPollOpts(['', '']); setPollMulti(false); setContactName(''); setContactPhone('');
    setPickedId(''); setContactQuery(''); setNewContact(false); setDocUrl('');
    setSheet({ what: item[0], label: item[1] });
  }

  async function pickPhoto(kind = 'photo') {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      const asset = res.canceled ? null : res.assets?.[0];
      if (!asset) return;
      if (kind === 'photo' || kind === 'sample' || kind === 'delivery') {
        setEditor({ what: kind, src: asset.uri, note: kind === 'delivery' ? note.trim() : '' });
        setSheet(null);
        return;
      }
      setShot(asset.uri);
    } catch {
      setError(t('Could not open your photos.'));
    }
  }

  async function pickDoc(kind: string) {
    setSheet(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: kind === 'audio' ? 'audio/*' : '*/*', copyToCacheDirectory: true });
      const asset = res.canceled ? null : res.assets?.[0];
      if (!asset) return;
      setError('');
      setNote('');
      setFileName(asset.name || '');
      setDocUrl(asset.uri || '');
      setSheet({ what: kind, label: kind === 'audio' ? t('Audio') : kind === 'document' ? t('Document') : t('File') });
    } catch {
      setError(t('Could not open files.'));
      setSheet(kind === 'file' ? 'more' : 'more');
    }
  }

  function setMode(mode: null | 'hold' | 'locked') {
    voiceModeRef.current = mode;
    setVoiceMode(mode);
  }

  async function beginVoice(mode: 'hold' | 'locked') {
    // Each start gets a token; a release or a newer press makes an older, still-pending start stale.
    const token = ++voiceToken.current;
    const stale = () => token !== voiceToken.current || (mode === 'hold' && !holding.current);
    const HOLD_HINT = t('Hold to record. Release to send.');
    setVoiceHint('');
    setSlideCancel(false);
    if (mode === 'locked') setSheet(null);
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) throw new Error('denied');
      if (stale()) {
        if (mode === 'hold' && token === voiceToken.current) setVoiceHint(HOLD_HINT);
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (stale()) {
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
        if (mode === 'hold' && token === voiceToken.current) setVoiceHint(HOLD_HINT);
        return;
      }
      recorder.record();
      voiceStarted.current = Date.now();
      setVoiceDur('0:00');
      clearInterval(voiceTimer.current);
      voiceTimer.current = setInterval(() => setVoiceDur(clock(Date.now() - voiceStarted.current)), 200);
      setMode(mode);
      setSheet(null);
    } catch {
      if (token !== voiceToken.current) return;
      setMode(null);
      setVoiceHint(t('The microphone did not open. Allow the microphone, then try again.'));
    }
  }

  async function finishVoice(shouldSend: boolean) {
    const mode = voiceModeRef.current;
    if (!mode) return;
    clearInterval(voiceTimer.current);
    const elapsed = Date.now() - voiceStarted.current;
    setMode(null);
    setSlideCancel(false);
    setVoiceDur('0:00');
    try { await recorder.stop(); } catch { /* not recording */ }
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    if (!shouldSend || !recorder.uri || (mode === 'hold' && elapsed < 700)) {
      if (shouldSend) setVoiceHint(t('Hold to record. Release to send.'));
      return;
    }
    const audio = await toDataUrl(recorder.uri);
    if (!audio) return;
    postMessage(thread.id, { voice: { dur: clock(elapsed), audio } });
    markRead(thread.id);
  }

  // Mic button gestures (same behaviour as the prototype): press and hold records, release sends,
  // slide left past 64px and release cancels, a tap shorter than 0.7s only shows the hint.
  micApi.current = {
    down() {
      holding.current = true;
      cancelHold.current = false;
      beginVoice('hold');
    },
    move(dx: number) {
      if (!holding.current) return;
      const cancel = dx < -64;
      if (cancel !== cancelHold.current) {
        cancelHold.current = cancel;
        setSlideCancel(cancel);
      }
    },
    up() {
      if (!holding.current) return;
      const cancel = cancelHold.current;
      holding.current = false;
      cancelHold.current = false;
      if (voiceModeRef.current === 'hold') finishVoice(!cancel);
    },
  };

  async function pickFile() {
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false });
      setFileName(res.canceled ? '' : res.assets?.[0]?.name || '');
    } catch {
      setError(t('Could not open files.'));
    }
  }

  function placeLine() {
    const project = thread.projectId ? projectOf(thread.projectId) : null;
    const site = thread.siteId ? svc.site(thread.siteId) : (thread.projectId ? siteFor(thread.projectId) : null);
    return [site?.name, project?.city].filter(Boolean).join(', ') || 'the studio';
  }

  function pick(item: any[]) {
    const key = item[0];
    if (key === 'voice') { beginVoice('locked'); return; }
    if (key === 'camera') { setSheet(null); navigate(`/mobile/camera?thread=${thread.id}`); return; }
    if (key === 'photo') { setSheet(null); pickPhoto('photo'); return; }
    if (key === 'file' || key === 'document' || key === 'audio') { pickDoc(key); return; }
    if (key === 'checkin') { doCheckin(); return; }
    if (key === 'daylog') { openDayLog(); return; }
    openForm(item);
  }

  function doCheckin() {
    const siteId = thread.siteId || svc.mySiteIds()[0];
    if (!siteId) { setError(t('No site to use here.')); return; }
    svc.siteCheckin(siteId);
    const siteThread = svc.threads().find((th: any) => th.kind === 'site' && th.siteId === siteId);
    const dest = siteThread?.id || thread.id;
    postMessage(dest, { text: 'Checked in at site', kind: 'checkin' });
    setSheet(null);
    markRead(dest);
    if (dest !== thread.id) navigate(`/mobile/chats/${dest}`);
  }

  function openDayLog() {
    const siteId = thread.siteId || svc.mySiteIds()[0];
    if (!siteId) { setError(t('No site to use here.')); return; }
    navigate(`/mobile/projects/${svc.site(siteId)?.projectId || thread.projectId}/assist?kind=daily&site=${siteId}`);
  }

  function sendEdited(dataUrl: string, words: string) {
    const what = editor.what;
    const fields: any = { kind: what, photo: { dataUrl, hue: 28, seed: 4 } };
    if (what === 'sample') fields.text = `Sample: ${words}`;
    else if (what === 'delivery') fields.text = `Delivery: ${words}`;
    else fields.text = words || 'Photo';
    postMessage(thread.id, fields);
    setEditor(null);
    markRead(thread.id);
  }

  function sendAttach() {
    const what = sheet.what;
    const words = note.trim();
    const fields: any = { kind: what, text: words };
    if (what === 'photo') {
      if (!shot) { setError(t('Choose a photo first.')); return; }
      fields.text = words || 'Photo';
      fields.photo = { dataUrl: shot, hue: 28, seed: 4 };
    } else if (what === 'sample') {
      if (!words) { setError(t('Say what this sample is.')); return; }
      fields.text = `Sample: ${words}`;
      fields.photo = shot ? { dataUrl: shot, hue: 28, seed: 4 } : { hue: 28, seed: 4 };
    } else if (what === 'delivery') {
      if (!words) { setError(t('Say what arrived.')); return; }
      fields.text = `Delivery: ${words}`;
      if (shot) fields.photo = { dataUrl: shot, hue: 28, seed: 4 };
    } else if (what === 'location') {
      fields.text = words ? `Location: ${placeLine()}. ${words}` : `Location: ${placeLine()}`;
    } else if (what === 'bill') {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) { setError(t('Enter an amount greater than zero.')); return; }
      if (!words) { setError(t('Say what the money was for.')); return; }
      fields.bill = { amount: value, status: 'asked', paidBy: 'cash', projectId: thread.projectId };
      fields.text = `${words} · ₹${value.toLocaleString('en-IN')}`;
    } else if (what === 'material') {
      if (!words) { setError(t('Say what you need.')); return; }
      fields.text = `Material needed: ${words}`;
    } else if (what === 'file') {
      if (!fileName) { setError(t('Choose a file first.')); return; }
      fields.text = words ? `File: ${fileName}. ${words}` : `File: ${fileName}`;
    } else if (what === 'attendance') {
      fields.text = words ? `Attendance recorded for today. ${words}` : 'Attendance recorded for today';
    } else if (what === 'poll') {
      const options = pollOpts.map((o) => o.trim()).filter(Boolean);
      if (!pollQ.trim() || options.length < 2) { setError(t('Add a question and at least two options.')); return; }
      fields.poll = { question: pollQ.trim(), multi: pollMulti, options: options.map((text) => ({ text, votes: [] })) };
      fields.text = pollQ.trim();
    } else if (what === 'contact') {
      if (pickedId) {
        const person = user(pickedId);
        fields.contact = { userId: pickedId, name: person.name || firstName(pickedId), phone: phoneOf(person) };
        fields.text = fields.contact.name;
      } else if (contactName.trim()) {
        fields.contact = { name: contactName.trim(), phone: contactPhone.trim() };
        fields.text = contactName.trim();
      } else { setError(t('Choose a person.')); return; }
    } else if (what === 'document' || what === 'audio') {
      if (!fileName) { setError(what === 'audio' ? t('Choose an audio file.') : t('Choose a document.')); return; }
      if (what === 'audio') fields.audio = { dataUrl: docUrl, name: fileName };
      else fields.file = { name: fileName, dataUrl: docUrl };
      fields.text = words ? `${fileName}. ${words}` : fileName;
      delete fields.kind;
    } else if (!words) { setError(t('Write a note first.')); return; }
    postMessage(thread.id, fields);
    setSheet(null);
    markRead(thread.id);
  }

  const tiles = sheet === 'plus' ? BASICS() : sheet === 'more' ? MORE().filter((item) => allowed(item[3])) : [];
  const drawings: any[] = thread.projectId && can('drawing', 'r') ? (projectOf(thread.projectId)?.drawings || []) : [];
  const last = [...msgs].reverse().find((m) => !m.deleted);
  const showQuick = can('thread', 'w') && last && last.by !== state.userId && /\?/.test(last.text || '');

  const Btn = ({ style, textStyle, onPress, children, ...rest }: any) => (
    <Pressable style={style} onPress={onPress} accessibilityRole="button" {...rest}><Text style={textStyle}>{children}</Text></Pressable>
  );
  const Field = ({ lbl, ...rest }: any) => (
    <View style={s.lbl}><Text style={s.lblText}>{lbl}</Text><TextInput style={s.field} placeholderTextColor={c.ink3} {...rest} /></View>
  );

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ThreadHeader thread={thread} backTo={backTo} />
        {(related.length > 0 || inProject) && (
          <View style={s.switcher} accessibilityRole="tablist" accessibilityLabel={t('Conversations in this project')}>
            {related.map((th) => (
              th.id === thread.id ? (
                <Pressable key={th.id} accessibilityRole="tab" accessibilityState={{ selected: !showWork }} onPress={() => setShowWork(false)} style={[s.sw, !showWork && s.swOn]}>
                  <Text style={[s.swText, !showWork && s.swTextOn]}>{audience(th)}</Text>
                </Pressable>
              ) : (
                <Link key={th.id} to={`/mobile/chats/${th.id}${from ? `?from=${encodeURIComponent(from)}` : ''}`} style={s.sw} accessibilityLabel={audience(th)}>
                  <Text style={s.swText}>{audience(th)}</Text>
                </Link>
              )
            ))}
            {inProject && (
              <Pressable accessibilityRole="tab" accessibilityState={{ selected: showWork }} onPress={() => setShowWork(true)} style={[s.sw, showWork && s.swOn]}>
                <Text style={[s.swText, showWork && s.swTextOn]}>{t('Work groups')}</Text>
              </Pressable>
            )}
          </View>
        )}
        {showWork ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
            {workGroups.map((group: any) => (
              <Link key={group.id} to={`/mobile/chats/${group.id}`} style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }}>
                <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{group.name}</Text>
                <Text style={{ color: c.ink3, fontSize: 13 }}>{t('Work group')}</Text>
              </Link>
            ))}
            {!workGroups.length && (
              <View style={s.empty}>
                <Text style={s.emptyH}>{t('No work groups yet')}</Text>
                <Text style={s.emptyP}>{t('Work groups for this project open from here.')}</Text>
              </View>
            )}
          </ScrollView>
        ) : (
        <>
        {thread.kind === 'internal' && <Text style={s.office}>{t('officeOnly')}</Text>}
        {pinned.length > 0 && (
          <View style={s.decisions}>
            {pinned.map((m, i) => (
              <View style={[s.pin, i === 0 && s.pinFirst]} key={m.id}>
                <Pressable style={s.jump} onPress={() => jumpTo(m.id, true)}>
                  <Text style={s.kicker}>{t('Pinned')}</Text>
                  <Text style={s.pinTitle} numberOfLines={1}>{m.text || t('Decision')}</Text>
                </Pressable>
                {canPin && <Pressable style={s.unpin} onPress={() => toggleDecision(m)}><Text style={s.unpinText}>{t('Unpin')}</Text></Pressable>}
              </View>
            ))}
          </View>
        )}
        <ScrollView
          ref={scroller} style={s.body} contentContainerStyle={s.bodyIn} keyboardShouldPersistTaps="handled"
          onLayout={(e) => { viewH.current = e.nativeEvent.layout.height; }}
        >
          {msgs.map((m, i) => {
            const prev = msgs[i - 1];
            const day = m.at.slice(0, 10);
            const showDay = !prev || prev.at.slice(0, 10) !== day;
            const mine = m.by === state.userId;
            const same = prev && prev.by === m.by && prev.at.slice(0, 10) === day;
            const reacts = Object.entries(m.reactions || {}).filter(([, ids]: any) => ids.length) as [string, string[]][];
            const later = msgs.slice(i + 1).filter((x) => !x.deleted);
            const seen = mine && later.some((x) => x.by !== m.by);
            const delivered = mine && !seen && later.some((x) => x.by === m.by);
            const receipt = !mine || m.deleted ? null : seen ? 'seen' : delivered ? 'delivered' : 'sent';
            const quoted = m.replyTo ? msgs.find((x) => x.id === m.replyTo) : null;
            return (
              <React.Fragment key={m.id}>
                {showDay && <View style={s.day}><Text style={s.dayText}>{dayLabel(m.at)}</Text></View>}
                <View
                  style={[s.cluster, mine && s.clusterMine, same && s.clusterCont]}
                  onLayout={(e) => { ys.current[m.id] = e.nativeEvent.layout.y; }}
                >
                  <ChatBubble mine={mine} same={same} pinned={m.decision} deleted={m.deleted} onOpen={() => setMenu(m)} onReply={() => setReplyTo(m)}>
                    {!mine && !same && <Text style={s.who}>{user(m.by).name || firstName(m.by)}</Text>}
                    {m.decision && !m.deleted && <Text style={[s.tag, mine && s.onAccent]}>{t('Decision')}</Text>}
                    {m.deleted ? <Text style={[s.gone, mine && s.onAccentMute]}>{t('This message was deleted')}</Text> : (
                      <>
                        {m.forwarded && <Text style={[s.fwd, mine && s.onAccentMute]}>{t('Forwarded')}</Text>}
                        {m.replyTo && (
                          <View style={[s.quote, mine && s.quoteMine]}>
                            <View style={[s.quoteBar, mine && { backgroundColor: c.accentInk }]} />
                            <Text style={[s.quoteB, mine && s.onAccent]}>{quoted ? firstName(quoted.by) : ''}</Text>
                            <Text style={[s.quoteT, mine && s.onAccentMute]} numberOfLines={2}>{preview(quoted)}</Text>
                          </View>
                        )}
                        {m.voice && <VoicePlay src={typeof m.voice === 'object' ? m.voice.audio : ''} dur={typeof m.voice === 'string' ? m.voice : (m.voice.dur || '')} />}
                        {m.photo?.dataUrl && <Image style={s.shot} source={{ uri: m.photo.dataUrl }} resizeMode="cover" accessibilityLabel={t('Photo')} />}
                        {m.photo && !m.photo.dataUrl && <View style={s.swatch}><Photo hue={m.photo.hue} seed={m.photo.seed} ar={240 / 140} /></View>}
                        {(m.kind && !m.photo) && !m.voice && <Text style={s.tag}>{KIND_LABEL()[m.kind] || m.kind}</Text>}
                        {m.contact && <Text style={s.say}>{m.contact.name}{m.contact.phone ? `\n${m.contact.phone}` : ''}</Text>}
                        {m.poll && (
                          <View>
                            <Text style={s.jumpB}>{m.poll.question}</Text>
                            {m.poll.options.map((o: any, i: number) => (
                              <Pressable key={i} onPress={() => svc.votePoll(m.id, i)}><Text style={s.quickText}>{o.text} · {o.votes.length}</Text></Pressable>
                            ))}
                          </View>
                        )}
                        {m.link && <Text style={s.say}>{m.link.title}{'\n'}{m.link.src}</Text>}
                        {m.call && <Text style={s.say}>{t('Video call · {0}{1}{2}', m.call.provider, '\n', m.call.url)}</Text>}
                        {m.imported && <Text style={s.fwd}>{t('imported from WhatsApp')}</Text>}
                        {m.options?.length > 0 && m.options.map((o: string) => (
                          <Pressable key={o} onPress={() => svc.recordChatDecision(m, o)}><Text style={s.quickText}>{o}</Text></Pressable>
                        ))}
                        {m.approval && (m.approval.done ? <Text style={s.tag}>{t('approved')}</Text> : state.role === 'client' ? (
                          <Pressable onPress={() => svc.approveChatMessage(m)}><Text style={s.quickText}>{m.approval.label}</Text></Pressable>
                        ) : <Text style={s.tag}>{t('{0} · waiting', m.approval.label)}</Text>)}
                        {m.bill && state.role === 'partner' && m.bill.status === 'asked' && m.by !== state.userId && (
                          <View style={s.quick}>
                            <Pressable onPress={() => svc.decideBill(m, true)}><Text style={s.quickText}>{t('Approve')}</Text></Pressable>
                            <Pressable onPress={() => svc.decideBill(m, false)}><Text style={s.quickText}>{t('Ask for bill')}</Text></Pressable>
                          </View>
                        )}
                        {!m.deleted && m.issueId && <Link to={`/mobile/issues/${m.issueId}`}><Text style={s.unpinText}>{t('Open linked issue')}</Text></Link>}
                        {!m.deleted && siteHasSuggestion(svc.siteUpdateReview(m.id)) && (
                          <Link to={`/mobile/chats/${thread.id}/messages/${m.id}`}><Text style={s.unpinText}>{t('Review site update')}</Text></Link>
                        )}
                        {m.text && !m.voice ? <Text style={[s.say, mine && s.onAccent]}>{m.text}</Text> : null}
                        {staff() && !m.deleted && (m.text || m.transcript) && thread.projectId && svc.assistKinds().includes('followup') && (
                          <Link to={`/mobile/assist?kind=followup&message=${m.id}`}><Text style={[s.chipText, mine && s.onAccent]}>{t('Suggest follow-up')}</Text></Link>
                        )}
                        {staff() && !m.deleted && m.photo && svc.assistKinds().includes('concept') && (
                          <Link to={`/mobile/assist?kind=concept&message=${m.id}&project=${thread.projectId || ''}`}><Text style={[s.chipText, mine && s.onAccent]}>{t('Explore finishes')}</Text></Link>
                        )}
                        <View style={s.meta}>
                          {staff() && !m.deleted && (() => {
                            const chip = chipOf(m);
                            return (
                              <Link to={`/mobile/chats/${thread.id}/messages/${m.id}/filing?from=chat`} style={[s.chip, chip.status === 'check' && s.chipCheck, chip.status === 'ask' && s.chipAsk, mine && !chip.status && s.chipOn]}>
                                <Text style={[s.chipText, mine && !chip.status && s.onAccent, chip.status === 'check' && { color: c.warn }, chip.status === 'ask' && { color: c.crit }]} numberOfLines={1}>{chip.label}</Text>
                              </Link>
                            );
                          })()}
                          <View style={s.timeRow} accessibilityLabel={receipt === 'seen' ? t('Seen') : receipt === 'delivered' ? t('Delivered') : receipt === 'sent' ? t('Sent') : undefined}>
                            <Text style={[s.time, mine && s.onAccentMute]}>{m.edited ? t('Edited · ') : ''}{fmtT(m.at)}</Text>
                            {receipt && (
                              <View style={{ marginLeft: 2 }}>
                                <Icon name={receipt === 'sent' ? 'check' : 'checkcheck'} size={16} color={mine ? c.accentInk : (receipt === 'seen' ? c.accentText : c.ink3)} />
                              </View>
                            )}
                          </View>
                        </View>
                      </>
                    )}
                    {m.deleted && <Text style={s.time}>{fmtT(m.at)}</Text>}
                    {reacts.length > 0 && (
                      <View style={s.reacts}>
                        {reacts.map(([emoji, ids]) => (
                          <Pressable key={emoji} style={[s.react, ids.includes(state.userId) && s.reactOn]} onPress={() => toggleReaction(m, emoji)} accessibilityRole="button" accessibilityLabel={t('React {0}', emoji)}>
                            <Text style={s.reactText}>{emoji} {ids.length}</Text>
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </ChatBubble>
                </View>
              </React.Fragment>
            );
          })}
          {!msgs.length && (
            <View style={s.empty}>
              <Text style={s.emptyH}>{t('Say hello')}</Text>
              <Text style={s.emptyP}>{t('Photos and voice notes stay with this project.')}</Text>
            </View>
          )}
        </ScrollView>
        {(showQuick || (staff() && can('thread', 'w') && last && last.by !== state.userId)) && (
          <View style={s.quick}>
            {showQuick && [t('yes'), t('ok'), t('onMyWay')].map((l: string) => (
              <Btn key={l} style={s.quickBtn} textStyle={s.quickText} onPress={() => { postMessage(thread.id, { text: l, replyTo: last.id }); markRead(thread.id); }}>{l}</Btn>
            ))}
            {staff() && can('thread', 'w') && last && last.by !== state.userId && (
              <Pressable style={{ marginLeft: showQuick ? 'auto' : 0 }} onPress={async () => {
                if ((drafts[thread.id] || '').trim()) { toast(t('Your draft was kept. Clear it before requesting an AI suggestion.')); return; }
                try { setDraft(thread.id, await AIProvider.draftReply(thread, last)); }
                catch { toast(t('AI reply unavailable. Your conversation and draft are unchanged.')); }
              }}><Text style={s.suggest}>{t('Suggest reply')}</Text></Pressable>
            )}
          </View>
        )}
        {replyTo && (
          <View style={s.replybar}>
            <Text style={s.replyText} numberOfLines={2}><Text style={s.replyB}>{firstName(replyTo.by)}{'\n'}</Text>{preview(replyTo)}</Text>
            <Pressable accessibilityLabel={t('Cancel reply')} accessibilityRole="button" onPress={() => setReplyTo(null)}><Icon name="x" size={20} /></Pressable>
          </View>
        )}
        {voiceHint ? <Text style={{ textAlign: 'center', color: c.ink2, fontSize: 13, fontWeight: '600', paddingTop: 6, paddingHorizontal: 16 }}>{voiceHint}</Text> : null}
        {can('thread', 'w') && (
          <View style={[s.composer, { paddingBottom: 8 + insets.bottom }]}>
            {voiceMode === 'locked' ? (
              <View style={[s.pill, { alignItems: 'center', paddingLeft: 4 }]}>
                <Pressable style={s.round} accessibilityRole="button" accessibilityLabel={t('Delete voice note')} onPress={() => finishVoice(false)}>
                  <Icon name="trash" color={c.ink2} />
                </Pressable>
                <RecTime dur={voiceDur} />
              </View>
            ) : voiceMode === 'hold' ? (
              <View style={[s.pill, { alignItems: 'center', paddingHorizontal: 14 }]}>
                <Text style={{ color: slideCancel ? c.crit : c.ink2, fontWeight: '600' }}>{slideCancel ? t('Release to cancel') : t('Slide to cancel')}</Text>
                <RecTime dur={voiceDur} />
              </View>
            ) : (
              <View style={s.pill}>
                <Pressable style={s.round} accessibilityRole="button" accessibilityLabel={t('Add to this chat')} onPress={() => { setError(''); setSheet('plus'); }}>
                  <Icon name="plus" color={c.ink2} />
                </Pressable>
                <TextInput
                  style={s.input} multiline placeholder={t('message')} placeholderTextColor={c.ink3}
                  accessibilityLabel={t('Message to {0}', audience(thread))}
                  value={text} onChangeText={(v) => setDraft(thread.id, v)}
                  onKeyPress={(e: any) => {
                    if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) { e.preventDefault?.(); send(); }
                  }}
                />
                {!text.trim() && (
                  <Pressable style={s.round} accessibilityRole="button" accessibilityLabel={t('Camera')} onPress={() => navigate(`/mobile/camera?thread=${thread.id}`)}>
                    <Icon name="camera" color={c.ink2} />
                  </Pressable>
                )}
              </View>
            )}
            {voiceMode === 'locked' ? (
              <Pressable style={[s.round, s.roundAccent]} accessibilityRole="button" accessibilityLabel={t('Send voice note')} onPress={() => finishVoice(true)}>
                <Icon name="send" color={c.accentInk} />
              </Pressable>
            ) : text.trim() && !voiceMode ? (
              <Pressable style={[s.round, s.roundAccent]} accessibilityRole="button" accessibilityLabel={t('send')} onPress={send}>
                <Icon name="send" color={c.accentInk} />
              </Pressable>
            ) : (
              <View
                {...micPan.panHandlers}
                style={[s.round, s.roundAccent, Platform.OS === 'web' ? ({ userSelect: 'none', touchAction: 'none', cursor: 'pointer' } as any) : null]}
                accessible
                focusable={false}
                accessibilityRole="button"
                accessibilityLabel={t('Hold to record a voice note')}
              >
                <Icon name="mic" color={c.accentInk} />
              </View>
            )}
          </View>
        )}
        </>
        )}
        {sheet && (
          <Pressable style={s.back} onPress={() => setSheet(null)} accessibilityRole="none">
            <Pressable style={[s.sheet, { paddingBottom: 12 + insets.bottom }]} onPress={() => {}} accessibilityLabel={t('Add to chat')}>
              <View style={s.grab} />
              <ScrollView keyboardShouldPersistTaps="handled">
                {sheet === 'plus' || sheet === 'more' ? (
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {sheet === 'more' ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={t('Back')} onPress={() => setSheet('plus')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                          <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="chev" /></View>
                        </Pressable>
                      ) : <View style={{ width: 44 }} />}
                      <Text style={[s.h2, { flex: 1, marginBottom: 0 }]}>{sheet === 'plus' ? t('Add to this chat') : t('More')}</Text>
                      <View style={{ width: 44 }} />
                    </View>
                    {error ? <Text style={s.warnText}>{error}</Text> : null}
                    <View style={s.tiles}>
                      {tiles.map((item: any[]) => (
                        <Pressable key={item[0]} style={s.tile} onPress={() => pick(item)} accessibilityRole="button" accessibilityLabel={t(item[0]) === item[0] ? item[1] : t(item[0])}>
                          <View style={s.tileIcon}><Icon name={item[2]} size={24} color={undefined} /></View>
                          <Text style={s.tileText}>{t(item[0]) === item[0] ? item[1] : t(item[0])}</Text>
                        </Pressable>
                      ))}
                      {sheet === 'plus' && (
                        <Pressable style={s.tile} onPress={() => setSheet('more')} accessibilityRole="button" accessibilityLabel={t('more')}>
                          <View style={s.tileIcon}><Icon name="plus" size={24} /></View>
                          <Text style={s.tileText}>{t('more')}</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={s.stack}>
                    {['location', 'poll', 'contact'].includes(sheet.what) ? (
                      <View style={s.waBar}>
                        <Pressable accessibilityLabel={t('Close')} style={s.round} onPress={() => setSheet(MORE().some((item) => item[0] === sheet.what) ? 'more' : 'plus')}>
                          <Icon name="x" />
                        </Pressable>
                        <Text style={s.waTitle}>{sheet.what === 'contact' ? t('Send contact') : sheet.label}</Text>
                        {sheet.what === 'location' ? <View style={s.round} /> : (
                          <Pressable
                            accessibilityLabel={t('Send')}
                            disabled={sheet.what === 'poll'
                              ? (!pollQ.trim() || pollOpts.filter((o: string) => o.trim()).length < 2)
                              : (!pickedId && !contactName.trim())}
                            onPress={sendAttach}
                            style={[s.round, s.roundAccent, (
                              sheet.what === 'poll'
                                ? (!pollQ.trim() || pollOpts.filter((o: string) => o.trim()).length < 2)
                                : (!pickedId && !contactName.trim())
                            ) && { opacity: 0.35 }]}
                          >
                            <Icon name="send" color={c.accentInk} />
                          </Pressable>
                        )}
                      </View>
                    ) : <Text style={s.h2}>{sheet.label}</Text>}
                    {(sheet.what === 'sample' || sheet.what === 'delivery') && (
                      <>
                        {sheet.what === 'delivery' && <Field lbl={t('What arrived?')} multiline numberOfLines={2} style={[s.field, { minHeight: 64, textAlignVertical: 'top' }]} value={note} onChangeText={setNote} accessibilityLabel={t('What arrived?')} />}
                        <Btn style={sheet.what === 'sample' ? s.primary : s.ghost} textStyle={sheet.what === 'sample' ? s.primaryText : s.ghostText} onPress={() => pickPhoto(sheet.what)}>{sheet.what === 'delivery' ? t('Add a photo') : t('Choose a photo')}</Btn>
                        {sheet.what === 'sample' && (
                          <Btn style={s.textBtn} textStyle={s.textBtnText} onPress={() => { setEditor({ what: 'sample', src: (Image as any).resolveAssetSource(photoSource(28, 1)).uri }); setSheet(null); }}>{t('Use a sample picture')}</Btn>
                        )}
                        {sheet.what === 'sample' && <Field lbl={t('Or name it without a photo')} multiline numberOfLines={2} style={[s.field, { minHeight: 64, textAlignVertical: 'top' }]} value={note} onChangeText={setNote} accessibilityLabel={t('What is this sample?')} placeholder={t('What is this sample?')} />}
                      </>
                    )}
                    {sheet.what === 'drawing' && (
                      drawings.length ? drawings.map((d) => (
                        <Pressable key={d.no} style={s.drow} onPress={() => { postMessage(thread.id, { kind: 'drawing', text: `${d.name} · ${d.no} ${d.rev}` }); setSheet(null); markRead(thread.id); }} accessibilityRole="button">
                          <View style={s.dcopy}><Text style={s.dB}>{d.name}</Text><Text style={s.dS}>{d.no} · {d.rev}</Text></View>
                        </Pressable>
                      )) : <Text style={s.note}>{can('drawing', 'r') ? t('No drawings on this project yet.') : t('Drawings aren’t available for this login.')}</Text>
                    )}
                    {sheet.what === 'location' && (
                      <>
                        <Pressable style={s.locRow} accessibilityRole="button" onPress={() => {
                          const words = note.trim();
                          postMessage(thread.id, { kind: 'location', text: words ? `Location: ${placeLine()}. ${words}` : `Location: ${placeLine()}` });
                          setSheet(null);
                          markRead(thread.id);
                        }}>
                          <View style={s.locPin}><Icon name="location" /></View>
                          <View style={s.dcopy}>
                            <Text style={s.dB}>{t('Send your current location')}</Text>
                            <Text style={s.dS}>{placeLine()}</Text>
                          </View>
                        </Pressable>
                        <TextInput
                          style={s.plain}
                          value={note}
                          onChangeText={setNote}
                          accessibilityLabel={t('Add a message')}
                          placeholder={t('Add a message')}
                          placeholderTextColor={c.ink3}
                        />
                      </>
                    )}
                    {sheet.what === 'file' && (
                      <>
                        <Btn style={s.ghost} textStyle={s.ghostText} onPress={pickFile}>{fileName || t('Choose a file')}</Btn>
                        {fileName ? <Text style={s.note}>{t('Only the name is sent. The file stays on this phone.')}</Text> : null}
                      </>
                    )}
                    {(sheet.what === 'document' || sheet.what === 'audio') && (
                      <>
                        <Text style={s.voiceLine}>{fileName}</Text>
                        <Btn style={s.ghost} textStyle={s.ghostText} onPress={() => pickDoc(sheet.what)}>{t('Choose a different file')}</Btn>
                        <Field lbl={t('Add a caption')} multiline value={note} onChangeText={setNote} accessibilityLabel={t('Add a caption')} placeholder={t('Add a caption')} />
                      </>
                    )}
                    {sheet.what === 'poll' && (
                      <>
                        <TextInput style={s.plain} value={pollQ} onChangeText={setPollQ} accessibilityLabel={t('Question')} placeholder={t('Ask a question')} placeholderTextColor={c.ink3} />
                        {pollOpts.map((o, i) => (
                          <View key={i} style={s.optRow}>
                            <View style={s.radio} />
                            <TextInput
                              style={[s.plain, { flex: 1 }]}
                              value={o}
                              onChangeText={(v: string) => setPollOpts((list) => list.map((x, j) => (j === i ? v : x)))}
                              accessibilityLabel={t('Option {0}', i + 1)}
                              placeholder={t('Add')}
                              placeholderTextColor={c.ink3}
                            />
                          </View>
                        ))}
                        {pollOpts.length < 6 && (
                          <Pressable style={s.add} onPress={() => setPollOpts((list) => [...list, ''])}>
                            <Text style={s.addText}>{t('Add option')}</Text>
                          </Pressable>
                        )}
                        <Pressable style={s.switchRow} accessibilityRole="switch" accessibilityState={{ checked: pollMulti }} onPress={() => setPollMulti((v) => !v)}>
                          <Text style={s.switchText}>{t('Allow multiple answers')}</Text>
                          <View style={[s.track, pollMulti && s.trackOn, { alignItems: pollMulti ? 'flex-end' : 'flex-start' }]}>
                            <View style={s.knob} />
                          </View>
                        </Pressable>
                      </>
                    )}
                    {sheet.what === 'contact' && (
                      <>
                        <TextInput style={s.plain} value={contactQuery} onChangeText={setContactQuery} accessibilityLabel={t('Search contacts')} placeholder={t('Search name or number')} placeholderTextColor={c.ink3} />
                        {(thread.memberIds || []).filter((id: string) => id !== state.userId).filter((id: string) => {
                          const person = user(id);
                          const q = contactQuery.trim().toLowerCase();
                          return !q || `${person.name} ${phoneOf(person)}`.toLowerCase().includes(q);
                        }).map((id: string) => {
                          const person = user(id);
                          const on = pickedId === id;
                          return (
                            <Pressable key={id} style={s.person} accessibilityRole="button" onPress={() => { setPickedId(id); setNewContact(false); setContactName(''); setContactPhone(''); }}>
                              <Avatar person={person} />
                              <View style={s.dcopy}>
                                <Text style={s.dB}>{person.name || firstName(id)}</Text>
                                <Text style={s.dS}>{phoneOf(person)}</Text>
                              </View>
                              <View style={[s.tick, on && s.tickOn]}>{on ? <Icon name="check" color={c.accentInk} size={14} /> : null}</View>
                            </Pressable>
                          );
                        })}
                        <Pressable style={s.add} onPress={() => { setNewContact((v) => !v); setPickedId(''); }}>
                          <Text style={s.addText}>{newContact ? t('Choose someone in this chat') : t('New contact')}</Text>
                        </Pressable>
                        {newContact && (
                          <>
                            <TextInput style={s.plain} value={contactName} onChangeText={(v) => { setContactName(v); setPickedId(''); }} accessibilityLabel={t('Name')} placeholder={t('Name')} placeholderTextColor={c.ink3} />
                            <TextInput style={s.plain} value={contactPhone} onChangeText={setContactPhone} accessibilityLabel={t('Phone')} placeholder={t('Phone')} keyboardType="phone-pad" placeholderTextColor={c.ink3} />
                          </>
                        )}
                      </>
                    )}
                    {sheet.what === 'bill' && <Field lbl={t('Amount in ₹')} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} accessibilityLabel={t('Amount')} placeholder="0" />}
                    {!['checkin', 'daylog', 'drawing', 'location', 'poll', 'contact', 'document', 'audio', 'sample', 'delivery', 'photo'].includes(sheet.what) && (
                      <Field
                        lbl={label(sheet.what)} multiline numberOfLines={2} style={[s.field, { minHeight: 64, textAlignVertical: 'top' }]}
                        value={note} onChangeText={setNote} accessibilityLabel={label(sheet.what)}
                        placeholder={['photo', 'file', 'attendance'].includes(sheet.what) ? t('Optional') : ''}
                      />
                    )}
                    {error ? <Text style={s.warnText}>{error}</Text> : null}
                    {!['drawing', 'location', 'poll', 'contact'].includes(sheet.what) && (
                      <Btn
                        style={[s.primary, (
                          ((sheet.what === 'delivery' || sheet.what === 'sample' || sheet.what === 'material') && !note.trim())
                          || (sheet.what === 'bill' && (!note.trim() || !(Number(amount) > 0)))
                        ) && { opacity: 0.45 }]}
                        textStyle={s.primaryText}
                        disabled={
                          ((sheet.what === 'delivery' || sheet.what === 'sample' || sheet.what === 'material') && !note.trim())
                          || (sheet.what === 'bill' && (!note.trim() || !(Number(amount) > 0)))
                        }
                        onPress={sendAttach}
                      >{t('Send')}</Btn>
                    )}
                    {!['location', 'poll', 'contact'].includes(sheet.what) && (
                      <Btn style={s.textBtn} textStyle={s.textBtnText} onPress={() => setSheet(sheet.what && MORE().some((item) => item[0] === sheet.what) ? 'more' : 'plus')}>{t('Back')}</Btn>
                    )}
                  </View>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        )}
        {menu && (
          <Pressable style={s.back} onPress={() => setMenu(null)} accessibilityRole="none">
            <Pressable style={[s.sheet, { paddingBottom: 12 + insets.bottom }]} onPress={() => {}} accessibilityLabel={t('More options')}>
              <View style={s.grab} />
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={s.note}>{preview(menu)}</Text>
                <MessageActions
                  thread={thread} message={menu}
                  onReply={() => { setReplyTo(menu); setMenu(null); }}
                  onDeleted={() => setMenu(null)}
                  onForward={() => { setForwardMsg(menu); setMenu(null); }}
                />
                <Btn style={s.textBtn} textStyle={s.textBtnText} onPress={() => setMenu(null)}>{t('Close')}</Btn>
              </ScrollView>
            </Pressable>
          </Pressable>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
