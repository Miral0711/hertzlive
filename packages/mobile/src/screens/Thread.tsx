import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, Image, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Icon from '../ui/Icon';
import Photo, { photoSource } from '../ui/Photo';
import { Screen, TopBar } from '../ui/frame';
import { useField } from '../ui/FieldContext';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from '../platform/router';
import { useStyles } from '../platform/theme';
import {
  svc, siblings, messagesOf, audience, firstName, fmtT, fmtD, dayLabel, preview, state, can, onPhone,
  postMessage, toggleReaction, toggleDecision, projectOf, siteFor, useStore, t,
} from '../store';
import { ThreadHeader } from './Chats';
import * as ChatPagesNs from './ChatPages';
import { VoiceFallback, ActionsFallback, ForwardFallback } from './ThreadParts';
import PhotoEdit from './PhotoEdit';

// Use the real ChatPages pieces once they are ported; fall back to local equivalents until then.
const CP: any = ChatPagesNs;
const VoicePlay: any = CP.VoicePlay || VoiceFallback;
const MessageActions: any = CP.MessageActions || ActionsFallback;
const ForwardPick: any = CP.ForwardPick || ForwardFallback;

const BASICS: any[] = [
  ['photo', 'Photo', 'photos'],
  ['camera', 'Camera', 'camera'],
  ['voice', 'Voice note', 'mic'],
  ['drawing', 'Drawing', 'drawing'],
  ['delivery', 'Delivery', 'delivery'],
  ['sample', 'Sample', 'sample'],
];
const MORE: any[] = [
  ['location', 'Location', 'location'],
  ['bill', 'Bill / expense', 'bill'],
  ['material', 'Material request', 'delivery', ['site_manager', 'contractor', 'partner', 'designer']],
  ['attendance', 'Attendance', 'people', ['site_manager', 'contractor']],
  ['file', 'File', 'file'],
  ['checkin', 'Check in', 'today', ['site_manager', 'contractor']],
  ['daylog', "Today's log", 'today', ['site_manager', 'partner', 'designer']],
];
const STEP: Record<string, string> = {
  photo: 'Choose a photo. You can crop it, draw on it, and add a note before it is sent.',
  drawing: 'Pick a drawing. This chat gets its name and revision.',
  delivery: 'Say what arrived. This chat gets that line.',
  sample: 'Add a picture of a finish or material, and say what it is.',
  location: 'This sends the place below into the chat.',
  bill: 'Write the amount you paid. A partner can approve it later.',
  material: 'Say what the site needs. It is posted in this chat.',
  attendance: 'This posts today’s attendance into this chat.',
  file: 'Choose a file. This chat shows the file name.',
  checkin: 'This tells the site chat that you have arrived.',
  daylog: 'This writes what happened on site today. You can read it before anyone else sees it.',
};
const KIND_LABEL: Record<string, string> = {
  drawing: 'Drawing', delivery: 'Delivery', sample: 'Sample', location: 'Location', bill: 'Bill',
  material: 'Material', file: 'File', attendance: 'Attendance', checkin: 'Checked in',
};
const TICK = '#8696a0';
const TICK_SEEN = '#53bdeb';

const allowed = (roles?: string[]) => !roles || roles.includes(state.role);
const label = (what: string) => (({ photo: 'Add a note', sample: 'What is this sample?', delivery: 'What arrived?', bill: 'What was it for?', material: 'What do you need?', file: 'Add a note' } as any)[what] || 'Note');

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
    icon: { position: 'absolute', left: 4, top: '50%', marginTop: -14, width: 28, height: 28, borderRadius: 14, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#0b141a', shadowOpacity: 0.13, shadowOffset: { width: 0, height: 1 }, shadowRadius: 0.5, elevation: 1 },
    bubble: {
      paddingTop: 6, paddingBottom: 4, paddingLeft: 10, paddingRight: 8, borderRadius: 12, minWidth: 136,
      backgroundColor: th.dark ? c.surface2 : '#fff',
      shadowColor: '#0b141a', shadowOpacity: 0.13, shadowOffset: { width: 0, height: 1 }, shadowRadius: 0.5, elevation: 1,
    },
    mine: { minWidth: 172, backgroundColor: th.dark ? c.mine : '#e7f4fb', borderTopRightRadius: 4 },
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
          <Pressable style={s.more} onPress={onOpen} accessibilityRole="button" accessibilityLabel="Message options" hitSlop={8}>
            <View style={{ transform: [{ rotate: '90deg' }] }}><Icon name="chev" size={14} color={undefined} /></View>
          </Pressable>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function Thread() {
  useStore();
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
  const [drawingNo, setDrawingNo] = useState('');
  const [error, setError] = useState('');
  const [showPins, setShowPins] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [menu, setMenu] = useState<any>(null);
  const [forwardMsg, setForwardMsg] = useState<any>(null);
  const [editor, setEditor] = useState<any>(null);
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
    pinbar: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: c.accentSoft },
    pinbarText: { fontWeight: '700', color: c.ink, fontSize: 16 },
    pinrow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.accentSoft, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
    jump: { flex: 1, minWidth: 0, gap: 2, paddingVertical: 10, paddingHorizontal: 16 },
    jumpB: { fontWeight: '700', color: c.ink },
    jumpS: { color: c.ink3, fontSize: 13 },
    unpin: { paddingVertical: 10, paddingHorizontal: 14 },
    unpinText: { color: c.accentText, fontWeight: '700' },
    body: { flex: 1, backgroundColor: c.chat },
    bodyIn: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 12 },
    day: { alignSelf: 'center', marginTop: 12, marginBottom: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: c.surface, shadowColor: '#0b141a', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 1 }, shadowRadius: 0.5, elevation: 1 },
    dayText: { fontSize: 12, fontWeight: '600', color: c.ink2 },
    dueRow: { paddingVertical: 8, paddingHorizontal: 12, marginTop: 8, borderRadius: 8, backgroundColor: c.surface },
    dueSmall: { fontSize: 12, color: c.warn, fontWeight: '700' },
    dueB: { fontSize: 15, fontWeight: '600', color: c.ink },
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
    say: { flexShrink: 1, fontSize: 15.5, lineHeight: 21, color: c.ink },
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
    quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', paddingTop: 8, paddingHorizontal: 12, backgroundColor: c.surface },
    quickBtn: { borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
    quickText: { color: c.accentText, fontWeight: '600' },
    replybar: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingTop: 8, paddingHorizontal: 12, backgroundColor: c.surface },
    replyText: { flex: 1, minWidth: 0, fontSize: 13, color: c.ink },
    replyB: { color: c.accentText, fontWeight: '700' },
    composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingTop: 6, paddingHorizontal: 8, backgroundColor: c.chat },
    input: { flex: 1, minHeight: 42, maxHeight: 120, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 22, backgroundColor: c.surface, color: c.ink, fontSize: 16, shadowColor: '#0b141a', shadowOpacity: 0.13, shadowOffset: { width: 0, height: 1 }, shadowRadius: 0.5, elevation: 1 },
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
        <TopBar><Text style={{ fontSize: 22, fontWeight: '600', color: 'inherit' as any }}>Chat</Text></TopBar>
        <View style={s.empty}>
          <Text style={s.emptyH}>This chat isn’t available</Text>
          <Link to="/mobile/chats"><Text style={s.emptyLink}>Back to chats</Text></Link>
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
          noteLabel={ask || 'Add a note'}
          noteRequired={Boolean(ask)}
          onCancel={() => setEditor(null)}
          onSend={sendEdited}
        />
      </Screen>
    );
  }

  const msgs: any[] = messagesOf(thread.id);
  const related: any[] = siblings(thread);
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
    setError(''); setNote(''); setAmount(''); setShot(''); setFileName(''); setDrawingNo('');
    setSheet({ what: item[0], label: item[1] });
  }

  async function pickPhoto() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      const asset = res.canceled ? null : res.assets?.[0];
      if (!asset) return;
      if (sheet && ['photo', 'sample', 'delivery'].includes(sheet.what)) {
        setEditor({ what: sheet.what, src: asset.uri });
        setSheet(null);
        return;
      }
      setShot(asset.uri);
    } catch {
      setError('Could not open your photos.');
    }
  }

  async function pickFile() {
    try {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false });
      setFileName(res.canceled ? '' : res.assets?.[0]?.name || '');
    } catch {
      setError('Could not open files.');
    }
  }

  function placeLine() {
    const project = thread.projectId ? projectOf(thread.projectId) : null;
    const site = thread.siteId ? svc.site(thread.siteId) : (thread.projectId ? siteFor(thread.projectId) : null);
    return [site?.name, project?.city].filter(Boolean).join(', ') || 'the studio';
  }

  function pick(item: any[]) {
    const key = item[0];
    if (key === 'voice') { navigate(`/mobile/chats/${thread.id}/voice`); return; }
    if (key === 'camera') { navigate(`/mobile/camera?thread=${thread.id}`); return; }
    openForm(item);
  }

  function doCheckin() {
    const siteId = thread.siteId || svc.mySiteIds()[0];
    if (!siteId) { setError('No site to use here.'); return; }
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
    if (!siteId) { setError('No site to use here.'); return; }
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
      if (!shot) { setError('Choose a photo first.'); return; }
      fields.text = words || 'Photo';
      fields.photo = { dataUrl: shot, hue: 28, seed: 4 };
    } else if (what === 'sample') {
      if (!words) { setError('Say what this sample is.'); return; }
      fields.text = `Sample: ${words}`;
      fields.photo = shot ? { dataUrl: shot, hue: 28, seed: 4 } : { hue: 28, seed: 4 };
    } else if (what === 'delivery') {
      if (!words) { setError('Say what arrived.'); return; }
      fields.text = `Delivery: ${words}`;
      if (shot) fields.photo = { dataUrl: shot, hue: 28, seed: 4 };
    } else if (what === 'drawing') {
      const drawing = (projectOf(thread.projectId)?.drawings || []).find((d: any) => d.no === drawingNo);
      if (!drawing) { setError('Pick a drawing.'); return; }
      fields.text = `${drawing.name} · ${drawing.no} ${drawing.rev}`;
    } else if (what === 'location') {
      fields.text = words ? `Location: ${placeLine()}. ${words}` : `Location: ${placeLine()}`;
    } else if (what === 'bill') {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) { setError('Enter an amount greater than zero.'); return; }
      if (!words) { setError('Say what the money was for.'); return; }
      fields.bill = { amount: value, status: 'asked', paidBy: 'cash', projectId: thread.projectId };
      fields.text = `${words} · ₹${value.toLocaleString('en-IN')}`;
    } else if (what === 'material') {
      if (!words) { setError('Say what you need.'); return; }
      fields.text = `Material needed: ${words}`;
    } else if (what === 'file') {
      if (!fileName) { setError('Choose a file first.'); return; }
      fields.text = words ? `File: ${fileName}. ${words}` : `File: ${fileName}`;
    } else if (what === 'attendance') {
      fields.text = words ? `Attendance recorded for today. ${words}` : 'Attendance recorded for today';
    } else if (!words) { setError('Write a note first.'); return; }
    postMessage(thread.id, fields);
    setSheet(null);
    markRead(thread.id);
  }

  const tiles = sheet === 'plus' ? BASICS : sheet === 'more' ? MORE.filter((item) => allowed(item[3])) : [];
  const drawings: any[] = thread.projectId && can('drawing', 'r') ? (projectOf(thread.projectId)?.drawings || []) : [];
  const last = [...msgs].reverse().find((m) => !m.deleted);
  const showQuick = can('thread', 'w') && last && last.by !== state.userId && /\?/.test(last.text || '');
  const isMedia = sheet && typeof sheet === 'object' && ['photo', 'sample', 'delivery'].includes(sheet.what);

  const Btn = ({ style, textStyle, onPress, children, ...rest }: any) => (
    <Pressable style={style} onPress={onPress} accessibilityRole="button" {...rest}><Text style={textStyle}>{children}</Text></Pressable>
  );
  const Field = ({ lbl, ...rest }: any) => (
    <View style={s.lbl}><Text style={s.lblText}>{lbl}</Text><TextInput style={s.field} placeholderTextColor="#8a9aa5" {...rest} /></View>
  );

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ThreadHeader thread={thread} backTo={backTo} />
        {related.length > 0 && (
          <View style={s.switcher} accessibilityRole="tablist" accessibilityLabel="Conversations in this project">
            {related.map((th) => (
              <Link key={th.id} to={`/mobile/chats/${th.id}${from ? `?from=${encodeURIComponent(from)}` : ''}`} style={[s.sw, th.id === thread.id && s.swOn]} accessibilityLabel={audience(th)}>
                <Text style={[s.swText, th.id === thread.id && s.swTextOn]}>{audience(th)}</Text>
              </Link>
            ))}
          </View>
        )}
        {thread.kind === 'internal' && <Text style={s.banner}>{t('officeOnly')}</Text>}
        {pinned.length > 0 && (
          <Pressable style={s.pinbar} onPress={() => setShowPins((v) => !v)} accessibilityRole="button">
            <Text style={s.pinbarText}>{pinned.length} decision{pinned.length === 1 ? '' : 's'} pinned</Text>
          </Pressable>
        )}
        {showPins && pinned.map((m) => (
          <View style={s.pinrow} key={m.id}>
            <Pressable style={s.jump} onPress={() => jumpTo(m.id, true)}>
              <Text style={s.jumpB}>{(m.text || 'Decision').slice(0, 80)}</Text>
              <Text style={s.jumpS}>{firstName(m.by)} · {fmtT(m.at)}</Text>
            </Pressable>
            {canPin && <Pressable style={s.unpin} onPress={() => toggleDecision(m)}><Text style={s.unpinText}>Unpin</Text></Pressable>}
          </View>
        ))}
        <ScrollView
          ref={scroller} style={s.body} contentContainerStyle={s.bodyIn} keyboardShouldPersistTaps="handled"
          onLayout={(e) => { viewH.current = e.nativeEvent.layout.height; }}
        >
          {svc.decisionsDue({ threadId: thread.id }).map((d: any) => (
            <View style={s.dueRow} key={d.id}>
              <Text style={s.dueSmall}>Still open · due {fmtD(d.due)}</Text>
              <Text style={s.dueB}>{d.title}</Text>
            </View>
          ))}
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
                    {!mine && !same && <Text style={s.who}>{firstName(m.by)}</Text>}
                    {m.decision && !m.deleted && <Text style={s.tag}>Decision</Text>}
                    {m.deleted ? <Text style={s.gone}>This message was deleted</Text> : (
                      <>
                        {m.forwarded && <Text style={s.fwd}>Forwarded</Text>}
                        {m.replyTo && (
                          <View style={s.quote}>
                            <View style={s.quoteBar} />
                            <Text style={s.quoteB}>{quoted ? firstName(quoted.by) : ''}</Text>
                            <Text style={s.quoteT} numberOfLines={2}>{preview(quoted)}</Text>
                          </View>
                        )}
                        {m.voice && <VoicePlay src={typeof m.voice === 'object' ? m.voice.audio : ''} dur={typeof m.voice === 'string' ? m.voice : (m.voice.dur || '')} />}
                        {m.photo?.dataUrl && <Image style={s.shot} source={{ uri: m.photo.dataUrl }} resizeMode="cover" accessibilityLabel="Photo" />}
                        {m.photo && !m.photo.dataUrl && <View style={s.swatch}><Photo hue={m.photo.hue} seed={m.photo.seed} ar={240 / 140} /></View>}
                        {(m.kind && !m.photo) && !m.voice && <Text style={s.tag}>{KIND_LABEL[m.kind] || m.kind}</Text>}
                        <View style={s.line}>
                          {m.text && !m.voice ? <Text style={s.say}>{m.text}</Text> : null}
                          <View style={s.timeRow} accessibilityLabel={receipt === 'seen' ? 'Seen' : receipt === 'delivered' ? 'Delivered' : receipt === 'sent' ? 'Sent' : undefined}>
                            <Text style={s.time}>{m.edited ? 'Edited · ' : ''}{fmtT(m.at)}</Text>
                            {receipt && (
                              <View style={{ marginLeft: 2 }}>
                                <Icon name={receipt === 'sent' ? 'check' : 'checkcheck'} size={16} color={receipt === 'seen' ? TICK_SEEN : TICK} />
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
                          <Pressable key={emoji} style={[s.react, ids.includes(state.userId) && s.reactOn]} onPress={() => toggleReaction(m, emoji)} accessibilityRole="button" accessibilityLabel={`React ${emoji}`}>
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
              <Text style={s.emptyH}>Say hello</Text>
              <Text style={s.emptyP}>Photos and voice notes stay with this project.</Text>
            </View>
          )}
        </ScrollView>
        {showQuick && (
          <View style={s.quick}>
            {[t('yes'), t('ok'), t('onMyWay')].map((l: string) => (
              <Btn key={l} style={s.quickBtn} textStyle={s.quickText} onPress={() => { postMessage(thread.id, { text: l, replyTo: last.id }); markRead(thread.id); }}>{l}</Btn>
            ))}
          </View>
        )}
        {replyTo && (
          <View style={s.replybar}>
            <Text style={s.replyText} numberOfLines={2}><Text style={s.replyB}>{firstName(replyTo.by)}{'\n'}</Text>{preview(replyTo)}</Text>
            <Pressable accessibilityLabel="Cancel reply" accessibilityRole="button" onPress={() => setReplyTo(null)}><Icon name="x" size={20} /></Pressable>
          </View>
        )}
        {can('thread', 'w') && (
          <View style={[s.composer, { paddingBottom: 8 + insets.bottom }]}>
            <Pressable style={s.round} accessibilityRole="button" accessibilityLabel="Add a photo, drawing or note" onPress={() => { setError(''); setSheet('plus'); }}>
              <Icon name="plus" />
            </Pressable>
            <TextInput
              style={s.input} multiline placeholder={t('message')} placeholderTextColor="#8a9aa5"
              accessibilityLabel={`Message to ${audience(thread)}`}
              value={text} onChangeText={(v) => setDraft(thread.id, v)}
              onKeyPress={(e: any) => {
                if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) { e.preventDefault?.(); send(); }
              }}
            />
            {text.trim() ? (
              <Pressable style={[s.round, s.roundAccent]} accessibilityRole="button" accessibilityLabel={t('send')} onPress={send}>
                <Icon name="send" color="#fff" />
              </Pressable>
            ) : (
              <Link to={`/mobile/chats/${thread.id}/voice`} style={[s.round, s.roundAccent]} accessibilityLabel="Record a voice note">
                <Icon name="mic" color="#fff" />
              </Link>
            )}
          </View>
        )}
        {sheet && (
          <Pressable style={s.back} onPress={() => setSheet(null)} accessibilityRole="none">
            <Pressable style={[s.sheet, { paddingBottom: 12 + insets.bottom }]} onPress={() => {}} accessibilityLabel="Add to chat">
              <View style={s.grab} />
              <ScrollView keyboardShouldPersistTaps="handled">
                {sheet === 'plus' || sheet === 'more' ? (
                  <View>
                    <Text style={s.h2}>{sheet === 'plus' ? 'Add to this chat' : 'More site updates'}</Text>
                    <Text style={s.help}>Tap one. The next step tells you what gets sent.</Text>
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
                    {sheet === 'more' && <Btn style={s.textBtn} textStyle={s.textBtnText} onPress={() => setSheet('plus')}>Back to common updates</Btn>}
                    <Btn style={s.textBtn} textStyle={s.textBtnText} onPress={() => setSheet(null)}>Cancel</Btn>
                  </View>
                ) : (
                  <View style={s.stack}>
                    <Text style={s.h2}>{sheet.label}</Text>
                    <Text style={s.help}>{STEP[sheet.what]}</Text>
                    {isMedia && (
                      <>
                        {shot ? <Image style={s.preview} source={{ uri: shot }} resizeMode="cover" /> : null}
                        <Btn style={s.ghost} textStyle={s.ghostText} onPress={pickPhoto}>{shot ? 'Choose a different photo' : (sheet.what === 'delivery' ? 'Add a photo' : 'Choose a photo')}</Btn>
                        {sheet.what === 'sample' && !shot && (
                          <Btn style={s.textBtn} textStyle={s.textBtnText} onPress={() => { setEditor({ what: 'sample', src: (Image as any).resolveAssetSource(photoSource(28, 1)).uri }); setSheet(null); }}>Use a sample picture</Btn>
                        )}
                      </>
                    )}
                    {sheet.what === 'drawing' && (
                      drawings.length ? drawings.map((d) => (
                        <Pressable key={d.no} style={[s.drow, drawingNo === d.no && s.drowOn]} onPress={() => setDrawingNo(d.no)} accessibilityRole="button">
                          <View style={s.dcopy}><Text style={s.dB}>{d.name}</Text><Text style={s.dS}>{d.no} · {d.rev}</Text></View>
                          <View style={[s.pick, drawingNo === d.no && s.pickOn]}>{drawingNo === d.no ? <Icon name="check" size={14} color="#fff" /> : null}</View>
                        </Pressable>
                      )) : <Text style={s.note}>{can('drawing', 'r') ? 'No drawings on this project yet.' : 'Drawings aren’t available for this login.'}</Text>
                    )}
                    {sheet.what === 'location' && <Text style={s.voiceLine}>{placeLine()}</Text>}
                    {sheet.what === 'file' && (
                      <>
                        <Btn style={s.ghost} textStyle={s.ghostText} onPress={pickFile}>{fileName || 'Choose a file'}</Btn>
                        {fileName ? <Text style={s.note}>Only the name is sent. The file stays on this phone.</Text> : null}
                      </>
                    )}
                    {sheet.what === 'bill' && <Field lbl="Amount in ₹" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} accessibilityLabel="Amount" placeholder="0" />}
                    {!['checkin', 'daylog', 'drawing', 'location'].includes(sheet.what) && (
                      <Field
                        lbl={label(sheet.what)} multiline numberOfLines={2} style={[s.field, { minHeight: 64, textAlignVertical: 'top' }]}
                        value={note} onChangeText={setNote} accessibilityLabel={label(sheet.what)}
                        placeholder={['photo', 'file', 'attendance'].includes(sheet.what) ? 'Optional' : ''}
                      />
                    )}
                    {sheet.what === 'location' && <Field lbl="Add a note" multiline value={note} onChangeText={setNote} accessibilityLabel="Note" placeholder="Optional" />}
                    {error ? <Text style={s.warnText}>{error}</Text> : null}
                    {sheet.what === 'checkin' ? (
                      <Btn style={s.primary} textStyle={s.primaryText} onPress={doCheckin}>Check in</Btn>
                    ) : sheet.what === 'daylog' ? (
                      <Btn style={s.primary} textStyle={s.primaryText} onPress={openDayLog}>Write today’s log</Btn>
                    ) : (
                      <Btn style={s.primary} textStyle={s.primaryText} onPress={sendAttach}>Send</Btn>
                    )}
                    <Btn style={s.textBtn} textStyle={s.textBtnText} onPress={() => setSheet(sheet.what && MORE.some((item) => item[0] === sheet.what) ? 'more' : 'plus')}>Back</Btn>
                  </View>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        )}
        {menu && (
          <Pressable style={s.back} onPress={() => setMenu(null)} accessibilityRole="none">
            <Pressable style={[s.sheet, { paddingBottom: 12 + insets.bottom }]} onPress={() => {}} accessibilityLabel="More options">
              <View style={s.grab} />
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={s.note}>{preview(menu)}</Text>
                <MessageActions
                  thread={thread} message={menu}
                  onReply={() => { setReplyTo(menu); setMenu(null); }}
                  onDeleted={() => setMenu(null)}
                  onForward={() => { setForwardMsg(menu); setMenu(null); }}
                />
                <Btn style={s.textBtn} textStyle={s.textBtnText} onPress={() => setMenu(null)}>Close</Btn>
              </ScrollView>
            </Pressable>
          </Pressable>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
