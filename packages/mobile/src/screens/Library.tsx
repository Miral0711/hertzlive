import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Asset } from 'expo-asset';
import * as ImagePicker from 'expo-image-picker';
import Icon from '../ui/Icon';
import { Screen, Page, Note, backName } from '../ui/frame';
import { ThreadAvatar } from '../ui/faces';
import { POOL } from '../ui/photoPool';
import PhotoEdit from './PhotoEdit';
import {
  Empty, Filters, Ghost, Kv, Primary, RowCopy, Row, Swatch, TextBtn, ViewCard, CardText, WarnText, NoteText, Field,
} from '../ui/libraryKit';
import { Link, useNavigate, useParams, useSearchParams } from '../platform/router';
import { useStyles, useTheme } from '../platform/theme';
import {
  photoItems, projectName, fmtDT, user, myThreads, threadTitle, audience, postMessage, svc, can, render, useStore,
} from '../store';
import { t } from '../../../frontend/src/shared/i18n';

function photoSearch(projectId?: string, from?: string | null) {
  const q: string[] = [];
  if (projectId) q.push(`project=${encodeURIComponent(projectId)}`);
  if (from) q.push(`from=${encodeURIComponent(from)}`);
  return q.length ? `?${q.join('&')}` : '';
}

export function Photos() {
  useStore();
  const [params] = useSearchParams();
  const projectId = params.get('project') || '';
  const from = params.get('from');
  const back = from && from.startsWith('/mobile/') ? from : (projectId ? `/mobile/projects/${projectId}` : '/mobile/projects');
  const backLabel = from && from.startsWith('/mobile/') ? backName(from) : t('Back');
  const [filter, setFilter] = useState('all');
  const all = photoItems(projectId);
  const kinds = [...new Set(all.map((i: any) => i.kind))] as string[];
  const items = all.filter((i: any) => filter === 'all' || i.kind === filter);
  const s = useStyles((c, t) => ({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    card: { width: '48.6%', gap: 4, padding: 8, borderRadius: t.radius.r2, backgroundColor: c.surface },
    shot: { width: '100%', height: 120, borderRadius: 12, backgroundColor: c.surface3 },
    b: { fontSize: 13, fontWeight: '600', color: c.ink },
    span: { fontSize: 13, color: c.ink2 },
  }));

  return (
    <Page back={back} backLabel={backLabel} title={t('Photos')} sub={t('{0} · {1} filed', projectId ? projectName(projectId) : t('All projects'), all.length)}>
      <Filters options={[['all', 'All'], ...kinds.map((k): [string, string] => [k, k])]} value={filter} onChange={setFilter} />
      {items.length ? (
        <View style={s.grid}>
          {items.map((i: any) => (
            <Link key={i.id} to={`/mobile/photos/${i.id}${photoSearch(projectId, from)}`} accessibilityLabel={i.title} style={s.card}>
              {i.dataUrl ? <Image source={{ uri: i.dataUrl }} style={s.shot} resizeMode="cover" /> : <Swatch hue={i.hue} seed={i.seed} />}
              <Text style={s.b}>{i.markupOf ? t('Marked up') : i.kind}</Text>
              <Text style={s.span} numberOfLines={2}>{[projectName(i.projectId).split(' ')[0], i.room].filter(Boolean).join(' · ') || i.src}</Text>
            </Link>
          ))}
        </View>
      ) : <Empty title={t('Nothing here yet')}>{t('Photos you send in chat land here, sorted by project and room.')}</Empty>}
    </Page>
  );
}

export function Photo() {
  useStore();
  const { photoId } = useParams();
  const [params] = useSearchParams();
  const projectId = params.get('project') || '';
  const from = params.get('from');
  const item = photoItems(projectId).find((x: any) => x.id === photoId);
  const s = useStyles((c, t) => ({ shot: { width: '100%', height: 180, marginBottom: 10, borderRadius: 12, backgroundColor: c.surface3 } }));
  if (!item) {
    return <Page back="/mobile/photos" title={t('Photo')}><Empty title={t('This photo isn’t available')} /></Page>;
  }
  const back = `/mobile/photos${photoSearch(projectId, from)}`;
  const rows: [string, string][] = [
    [t('Project'), projectName(item.projectId) || t('Not set')],
    [t('Room'), item.room || t('Not set')],
    [t('Type'), item.kind],
  ];
  if (item.by) rows.push(['From', user(item.by).name]);
  if (item.filing?.drawing) rows.push(['Drawing', item.filing.drawing]);
  if (item.decided) rows.push(['Status', 'Decided · on moodboard']);
  return (
    <Page back={back} backLabel={t('Photos')} title={item.kind} sub={`${item.src} · ${fmtDT(item.at)}`}>
      <ViewCard>
        {item.dataUrl ? <Image source={{ uri: item.dataUrl }} style={s.shot} resizeMode="cover" /> : <Swatch hue={item.hue} seed={item.seed} height={180} />}
        <View style={{ height: 10 }} />
        <CardText>{item.title}</CardText>
        <Kv rows={rows} />
        {item.msgId ? (
          <>
            <Primary to={`/mobile/chats/${item.threadId}/messages/${item.msgId}`}>{t('Change project or room')}</Primary>
            <Ghost to={`/mobile/chats/${item.threadId}`}>{t('Open the chat')}</Ghost>
          </>
        ) : null}
        {!item.msgId && (item.kind === 'Photo' || item.kind === 'Video') && can('feed', 'w') ? (
          <Primary to={`/mobile/photos/${item.id}/markup${photoSearch(projectId, from)}`}>{t('Mark up')}</Primary>
        ) : null}
        {item.markupOf ? <Ghost to={`/mobile/photos/${item.markupOf}`}>{t('View original')}</Ghost> : null}
      </ViewCard>
    </Page>
  );
}

export function Markup() {
  useStore();
  const { photoId } = useParams();
  const [params] = useSearchParams();
  const projectId = params.get('project') || '';
  const from = params.get('from');
  const navigate = useNavigate();
  const [note, setNote] = useState('Check this on site');
  const [error, setError] = useState('');
  const item = photoItems().find((x: any) => x.id === photoId);

  function save() {
    try {
      const rec = svc.markup(photoId, [{ type: 'note' }], note);
      render();
      navigate(`/mobile/photos/${rec.id}`);
    } catch (err: any) {
      setError(t(err.message) || t('Could not save the markup.'));
    }
  }

  return (
    <Page back={`/mobile/photos/${photoId}${photoSearch(projectId, from)}`} backLabel={t('Photo')} title={t('Mark up')} sub={item?.title}>
      <Note>{t('The original photo stays as it is. This saves a new marked copy.')}</Note>
      <View style={{ gap: 10, marginTop: 12 }}>
        <Field label={t('Note')} value={note} onChangeText={setNote} multiline />
        {error ? <WarnText>{error}</WarnText> : null}
        <Primary onPress={save}>{t('Save marked copy')}</Primary>
      </View>
    </Page>
  );
}

// resolve a bundled sample photo to a URI the editor can load
const sampleUri = () => {
  return Asset.fromModule(POOL[0]).uri;
};

export function Camera() {
  useStore();
  const navigate = useNavigate();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [params] = useSearchParams();
  const preset = params.get('thread');
  const from = params.get('from');
  const backTo = from && from.startsWith('/mobile/') ? from : (preset ? `/mobile/chats/${preset}` : '/mobile/chats');
  const camRef = useRef<any>(null);
  const [perm, askPerm] = useCameraPermissions();
  const [q, setQ] = useState('');
  const [shot, setShot] = useState('');
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState('');
  const [dest, setDest] = useState(preset || '');
  const [live, setLive] = useState(false);
  const [camNote, setCamNote] = useState('');
  const all = myThreads();
  const threads = all.filter(({ t }: any) => `${threadTitle(t)} ${audience(t)} ${t.name}`.toLowerCase().includes(q.trim().toLowerCase()));

  useEffect(() => { if (perm && !perm.granted && perm.canAskAgain) askPerm().catch(() => {}); }, [perm?.granted]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (perm && !perm.granted && !perm.canAskAgain) setCamNote(t('The camera did not open. Choose a photo from this device, or send the sample.'));
  }, [perm]);

  async function capture() {
    try {
      const pic = await camRef.current?.takePictureAsync({ quality: 0.72 });
      if (pic?.uri) { setShot(pic.uri); setEditing(true); }
    } catch {
      setCamNote(t('The camera did not open. Choose a photo from this device, or send the sample.'));
    }
  }

  async function pickFile() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      const uri = res.assets?.[0]?.uri;
      if (res.canceled || !uri) return;
      setShot(uri);
      setEditing(true);
      if (!dest && preset) setDest(preset);
    } catch {
      setCamNote(t('Could not open your photos.'));
    }
  }

  function who(thread: any) {
    if (thread.kind === 'group') return thread.name;
    return audience(thread);
  }

  function goesTo(thread: any) {
    const name = threadTitle(thread);
    if (thread.kind === 'client') return t('The client group for {0} will see this photo.', name);
    if (thread.kind === 'internal') return t('The office chat for {0} will see this. The client will not.', name);
    if (thread.kind === 'site') return t('The site team for {0} will see this photo.', name);
    if (thread.kind === 'group') return t('{0} will see this photo.', thread.name);
    return t('{0} will see this photo.', name);
  }

  function send() {
    if (!dest) return;
    const photo = shot.startsWith('data:') ? { dataUrl: shot, hue: 28, seed: 4 } : { hue: 28, seed: 4 };
    postMessage(dest, { text: caption.trim() || 'Photo from site', photo, kind: 'photo' });
    navigate(`/mobile/chats/${dest}`);
  }

  const s = useStyles((cc, th) => ({
    cam: { width: '100%', aspectRatio: 3 / 4, maxHeight: 280, backgroundColor: cc.surface3, overflow: 'hidden' },
    start: { paddingHorizontal: 14, paddingBottom: 16, gap: 10 },
    preview: { width: '100%', height: 168, borderRadius: 12, backgroundColor: cc.surface3 },
    previewWrap: { marginHorizontal: 14, marginTop: 12 },
    capLab: { marginHorizontal: 14, marginTop: 12, fontSize: 13, fontWeight: '600', color: cc.ink2 },
    capInput: { marginHorizontal: 14, marginTop: 6, minHeight: 44, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: cc.surface2, color: cc.ink, fontSize: 16 },
    ask: { marginHorizontal: 14, marginTop: 16, marginBottom: 4, fontWeight: '700', fontSize: 16, color: cc.ink },
    search: { marginVertical: 12, marginHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingHorizontal: 12, borderRadius: th.radius.r2, backgroundColor: cc.surface2 },
    searchInput: { flex: 1, minWidth: 0, color: cc.ink, fontSize: 16, paddingVertical: 8 },
    pick: { width: 22, height: 22, borderWidth: 2, borderColor: cc.line2, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    pickOn: { backgroundColor: cc.accent, borderColor: cc.accent },
    dock: { paddingTop: 8, paddingHorizontal: 14, paddingBottom: 8 + insets.bottom, backgroundColor: cc.surface, borderTopWidth: 1, borderTopColor: cc.line },
    dockP: { fontSize: 14, lineHeight: 19, color: cc.ink2 },
    note: { color: cc.ink2, fontWeight: '500', fontSize: 16 },
    filePick: { minHeight: 48, borderRadius: th.radius.r2, backgroundColor: cc.surface2, alignItems: 'center', justifyContent: 'center' },
    filePickT: { color: cc.ink, fontWeight: '700', fontSize: 16 },
  }));

  const chosen = all.find(({ t }: any) => t.id === dest)?.t;
  if (editing && shot) {
    return (
      <Screen>
        <PhotoEdit
          src={shot}
          onCancel={() => { setShot(''); setEditing(false); }}
          onSend={(dataUrl: string, words: string) => {
            if (preset) {
              postMessage(preset, { text: words.trim() || 'Photo from site', photo: { dataUrl, hue: 28, seed: 4 }, kind: 'photo' });
              navigate(`/mobile/chats/${preset}`);
              return;
            }
            setShot(dataUrl);
            setCaption(words);
            setEditing(false);
          }}
        />
      </Screen>
    );
  }
  return (
    <Page
      back={backTo}
      backLabel={from && from.startsWith('/mobile/') ? backName(from) : t('Chats')}
      title={shot ? t('Send this photo') : t('Camera')}
      bare
      footer={shot ? (
        <View style={s.dock}>
          <Text style={s.dockP}>{chosen ? goesTo(chosen) : t('Tap a chat below, then send.')}</Text>
          <View style={{ marginTop: 0 }}><Primary disabled={!dest} onPress={send}>{t('Send')}</Primary></View>
        </View>
      ) : null}
    >
      {shot ? (
        <View style={s.previewWrap}>
          <Image source={{ uri: shot }} style={s.preview} resizeMode="cover" accessibilityLabel={t('What you are about to send')} />
        </View>
      ) : (
        <View style={s.cam}>
          {perm?.granted ? (
            <CameraView
              ref={camRef} style={{ flex: 1 }} facing="back"
              onCameraReady={() => setLive(true)}
              onMountError={() => setCamNote(t('The camera did not open. Choose a photo from this device, or send the sample.'))}
            />
          ) : null}
        </View>
      )}
      {!shot && (
        <View style={s.start}>
          {live ? <Primary onPress={capture}>{t('Take photo')}</Primary> : <Text style={[s.note, { marginTop: 10 }]}>{camNote || t('The camera is opening.')}</Text>}
          <Pressable style={s.filePick} onPress={pickFile} accessibilityRole="button"><Text style={s.filePickT}>{t('Choose a photo')}</Text></Pressable>
          <TextBtn onPress={() => { setShot(sampleUri()); setEditing(true); }}>{t('Use a sample photo')}</TextBtn>
          {camNote ? <Text style={s.note}>{camNote}</Text> : null}
        </View>
      )}
      {!!shot && (
        <>
          <Text style={s.capLab}>{t('Add a note')}</Text>
          <TextInput style={s.capInput} value={caption} onChangeText={setCaption} placeholder={t('Optional')} placeholderTextColor={c.ink3} accessibilityLabel={t('Note on the photo')} />
          {preset && chosen ? null : (
            <>
              <Text style={s.ask}>{t('Who should see this?')}</Text>
              <View style={s.search}>
                <Icon name="search" color={c.ink3} />
                <TextInput style={s.searchInput} value={q} onChangeText={setQ} placeholder={t('Find a chat')} placeholderTextColor={c.ink3} accessibilityLabel={t('Find a chat')} autoCapitalize="none" />
              </View>
              {threads.map(({ t }: any) => (
                <Row key={t.id} picked={dest === t.id} onPress={() => setDest(t.id)}>
                  <ThreadAvatar thread={t} />
                  <RowCopy title={threadTitle(t)} sub={who(t)} />
                  <View style={[s.pick, dest === t.id && s.pickOn]}>{dest === t.id ? <Icon name="check" size={14} color={c.accentInk} /> : null}</View>
                </Row>
              ))}
              {!threads.length && <Empty title={t('No chat matches')} />}
            </>
          )}
          <TextBtn accent onPress={() => setEditing(true)}>{t('Edit photo')}</TextBtn>
          <TextBtn accent onPress={() => setShot('')}>{t('Choose a different photo')}</TextBtn>
        </>
      )}
    </Page>
  );
}

export function Portfolio() {
  useStore();
  const list = svc.portfolio();
  const s = useStyles((c) => ({ sub: { color: c.ink2, fontSize: 16 } }));
  return (
    <Page back="/mobile/projects" backLabel={t('Projects')} title={t('Studio portfolio')} sub={t('Completed work')}>
      {list.map((x: any) => (
        <ViewCard key={x.id}>
          <Swatch hue={x.hue} seed={x.year} height={180} />
          <View style={{ height: 10 }} />
          <CardText strong>{x.name}</CardText>
          <Text style={s.sub}>{x.type} · {x.city} · {x.year}</Text>
          <CardText>{x.blurb}</CardText>
        </ViewCard>
      ))}
      {!list.length && <Empty title={t('No portfolio projects published yet')} />}
    </Page>
  );
}
