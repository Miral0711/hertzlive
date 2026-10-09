// Fallback building blocks for Thread: used when ChatPages / PhotoEdit have not provided the real ones yet.
import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Icon from '../ui/Icon';
import { ThreadAvatar } from '../ui/faces';
import { useStyles } from '../platform/theme';
import {
  state, can, svc, toggleReaction, toggleDecision, deleteMessage, hideMessage, editMessage, myThreads, threadTitle,
  audience, postMessage, preview, useStore,
} from '../store';

const EMOJI: [string, string][] = [['✅', 'Done'], ['👀', 'Review'], ['📝', 'Noted'], ['⭐', 'Mark'], ['⚠️', 'Flag']];

export function VoiceFallback({ dur = '' }: { src?: string; dur?: string }) {
  const s = useStyles((c) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36, marginBottom: 4 },
    go: { width: 32, height: 32, borderRadius: 16, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    track: { flex: 1, height: 3, borderRadius: 99, backgroundColor: c.accentSoft },
    dur: { fontSize: 12, color: c.ink2 },
  }));
  return (
    <View style={s.row} accessibilityRole="button" accessibilityLabel="Play voice note">
      <View style={s.go}><Icon name="play" size={14} color={undefined} /></View>
      <View style={s.track} />
      <Text style={s.dur}>{dur}</Text>
    </View>
  );
}

export function ActionsFallback({ thread, message, onReply, onDeleted, onForward }: any) {
  useStore();
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState(message.text || '');
  const mine = message.by === state.userId;
  const canPin = !message.deleted && can('thread', 'w') && (state.role === 'partner' || state.role === 'site_manager');
  const s = useStyles((c) => ({
    emoji: { flexDirection: 'row', gap: 6, marginBottom: 10 },
    emojiBtn: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
    emojiOn: { borderColor: c.accent, backgroundColor: c.accentSoft },
    ghost: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: c.line },
    ghostText: { fontSize: 16, fontWeight: '500', color: c.ink },
    warn: { color: c.crit },
    input: { minHeight: 44, borderWidth: 1, borderColor: c.line, borderRadius: 8, padding: 10, color: c.ink, backgroundColor: c.surface, marginTop: 8 },
    primary: { minHeight: 52, borderRadius: 8, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
    primaryText: { color: c.accentInk, fontWeight: '700', fontSize: 16 },
  }));
  const Item = ({ label, onPress, warn }: any) => (
    <Pressable style={s.ghost} onPress={onPress} accessibilityRole="button"><Text style={[s.ghostText, warn && s.warn]}>{label}</Text></Pressable>
  );
  const askDelete = () => {
    const buttons: any[] = [{ text: 'Delete for me', style: 'destructive', onPress: () => { hideMessage(message); onDeleted?.(); } }];
    if (mine && !message.deleted) buttons.push({ text: 'Delete for everyone', style: 'destructive', onPress: () => { deleteMessage(message); onDeleted?.(); } });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Delete this message?', undefined, buttons);
  };
  return (
    <View>
      {!message.deleted && (
        <View style={s.emoji} accessibilityRole="toolbar" accessibilityLabel="Reactions">
          {EMOJI.map(([e, label]) => (
            <Pressable key={e} style={[s.emojiBtn, message.reactions?.[e]?.includes(state.userId) && s.emojiOn]} accessibilityLabel={label} onPress={() => toggleReaction(message, e)}>
              <Text style={{ fontSize: 16 }}>{e}</Text>
              <Text style={{ fontSize: 11, fontWeight: '600' }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {!message.deleted && <Item label="Reply" onPress={onReply} />}
      {!message.deleted && <Item label="Forward" onPress={onForward} />}
      <Item label="Delete" warn onPress={askDelete} />
      {canPin && <Item label={message.decision ? 'Unpin decision' : 'Pin as decision'} onPress={() => toggleDecision(message)} />}
      {mine && !message.deleted && message.text && !message.voice && !editing && <Item label="Edit" onPress={() => setEditing(true)} />}
      {editing && (
        <View>
          <TextInput style={s.input} multiline value={edit} onChangeText={setEdit} accessibilityLabel="Edit message" />
          <Pressable style={s.primary} onPress={() => { editMessage(message, edit); setEditing(false); }}><Text style={s.primaryText}>Save</Text></Pressable>
        </View>
      )}
    </View>
  );
}

export function ForwardFallback({ message, onClose, onOpen }: any) {
  const [picked, setPicked] = useState<string[]>([]);
  const s = useStyles((c) => ({
    top: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: c.line },
    h1: { fontSize: 16, fontWeight: '600', color: c.ink },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line },
    on: { backgroundColor: c.accentSoft },
    b: { fontWeight: '600', color: c.ink }, sub: { fontSize: 14, color: c.ink2 },
    pick: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.line2, alignItems: 'center', justifyContent: 'center' },
    pickOn: { backgroundColor: c.accent, borderColor: c.accent },
    bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 8, backgroundColor: c.chat },
    send: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  }));
  const send = () => {
    const fields: any = { text: message.text || preview(message), forwarded: true };
    if (message.photo) fields.photo = message.photo;
    if (message.voice) fields.voice = message.voice;
    if (message.kind && !message.photo) fields.kind = message.kind;
    const sent = picked.filter((id) => postMessage(id, fields));
    onClose();
    if (sent.length === 1) onOpen(sent[0]);
  };
  return (
    <View style={{ flex: 1 }}>
      <View style={s.top}>
        <Pressable onPress={onClose} accessibilityLabel="Back to chat" style={{ minHeight: 44, justifyContent: 'center' }}><Icon name="back" /></Pressable>
        <Text style={s.h1}>Forward to</Text>
      </View>
      <ScrollView style={{ flex: 1 }}>
        {myThreads().map(({ t: dest }: any) => {
          const on = picked.includes(dest.id);
          return (
            <Pressable key={dest.id} style={[s.row, on && s.on]} onPress={() => setPicked((ids) => (on ? ids.filter((i) => i !== dest.id) : [...ids, dest.id]))}>
              <ThreadAvatar thread={dest} />
              <View style={{ flex: 1 }}><Text style={s.b}>{threadTitle(dest)}</Text><Text style={s.sub}>{audience(dest)}</Text></View>
              <View style={[s.pick, on && s.pickOn]}>{on ? <Icon name="check" size={14} color="#fff" /> : null}</View>
            </Pressable>
          );
        })}
      </ScrollView>
      {picked.length > 0 && (
        <View style={s.bar}>
          <Text style={s.b}>{picked.length} selected</Text>
          <Pressable style={s.send} accessibilityLabel="Forward message" onPress={send}><Icon name="send" color="#fff" /></Pressable>
        </View>
      )}
    </View>
  );
}

// Minimal photo step: preview + note + send. (The full crop/draw editor lives in PhotoEdit.)
export function PhotoEditLite({ src, noteLabel, noteRequired, onCancel, onSend }: any) {
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const s = useStyles((c) => ({
    wrap: { flex: 1, backgroundColor: c.surface },
    top: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: c.line },
    img: { flex: 1, margin: 14, borderRadius: 12, backgroundColor: c.surface3 },
    foot: { padding: 14, gap: 8 },
    lbl: { fontWeight: '600', color: c.ink },
    input: { minHeight: 44, borderWidth: 1, borderColor: c.line, borderRadius: 8, padding: 10, color: c.ink, backgroundColor: c.surface },
    primary: { minHeight: 52, borderRadius: 8, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    primaryText: { color: c.accentInk, fontWeight: '700', fontSize: 16 },
    warn: { color: c.crit, fontWeight: '600' },
  }));
  return (
    <View style={s.wrap}>
      <View style={s.top}>
        <Pressable onPress={onCancel} accessibilityLabel="Cancel" style={{ minHeight: 44, justifyContent: 'center' }}><Icon name="x" /></Pressable>
      </View>
      <Image source={{ uri: src }} style={s.img} resizeMode="contain" />
      <View style={s.foot}>
        <Text style={s.lbl}>{noteLabel}</Text>
        <TextInput style={s.input} value={note} onChangeText={setNote} accessibilityLabel={noteLabel} placeholder={noteRequired ? '' : 'Optional'} />
        {err ? <Text style={s.warn}>{err}</Text> : null}
        <Pressable style={s.primary} accessibilityRole="button" onPress={() => {
          if (noteRequired && !note.trim()) { setErr('Add a note first.'); return; }
          onSend(src, note.trim());
        }}><Text style={s.primaryText}>Send</Text></Pressable>
      </View>
    </View>
  );
}
