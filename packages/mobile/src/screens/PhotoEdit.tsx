import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Ellipse, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { captureRef } from 'react-native-view-shot';
import Icon from '../ui/Icon';
import { useTheme } from '../platform/theme';

// Photo editor (crop, rotate, draw, text, shapes, undo/redo). Port of the web PhotoEdit.jsx:
// markup is kept as vector ops in the photo's natural pixel space and drawn with react-native-svg;
// crop/rotate re-encode the image with expo-image-manipulator; "flatten" bakes ops into a JPEG
// (canvas on web, react-native-view-shot on device).

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#111827', '#ffffff'];
const SIZES = [4, 8, 16];
const LABELS = ['Crack', 'Electrical point', 'Plumbing', 'Dimension', 'Defect', 'Change required', 'Material', 'Site instruction'];
const TOOLS: [string, string, string][] = [
  ['crop', 'Crop', 'crop'],
  ['rotate', 'Rotate', 'rotate'],
  ['draw', 'Draw', 'edit'],
  ['text', 'Text', 'typeT'],
  ['rect', 'Rectangle', 'rectangle'],
  ['arrow', 'Arrow', 'arrowdiag'],
  ['circle', 'Circle', 'circleicon'],
];
const MAX_DIM = 1600;
const BG = '#0b141a';
const PANEL = '#1f2c34';

type Op = any;
type Base = { uri: string; w: number; h: number };
type Entry = { base: Base; ops: Op[] };

function arrowHead(op: Op) {
  const { x1, y1, x2, y2, size } = op;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.max(10, size * 2.2);
  return [Math.PI / 7, -Math.PI / 7].map((d) => [x2, y2, x2 - len * Math.cos(angle - d), y2 - len * Math.sin(angle - d)]);
}

function renderOp(op: Op, key: string | number) {
  const common = { stroke: op.color, strokeWidth: op.size, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  if (op.type === 'draw') {
    if (op.points.length < 2) return null;
    const d = op.points.map(([x, y]: number[], i: number) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    return <Path key={key} d={d} {...common} />;
  }
  if (op.type === 'rect') {
    return <Rect key={key} x={Math.min(op.x1, op.x2)} y={Math.min(op.y1, op.y2)} width={Math.abs(op.x2 - op.x1)} height={Math.abs(op.y2 - op.y1)} {...common} />;
  }
  if (op.type === 'circle') {
    return <Ellipse key={key} cx={(op.x1 + op.x2) / 2} cy={(op.y1 + op.y2) / 2} rx={Math.abs(op.x2 - op.x1) / 2} ry={Math.abs(op.y2 - op.y1) / 2} {...common} />;
  }
  if (op.type === 'arrow') {
    return (
      <React.Fragment key={key}>
        <Line x1={op.x1} y1={op.y1} x2={op.x2} y2={op.y2} {...common} />
        {arrowHead(op).map(([ax, ay, bx, by], i) => <Line key={i} x1={ax} y1={ay} x2={bx} y2={by} {...common} />)}
      </React.Fragment>
    );
  }
  if (op.type === 'text') {
    const fs = op.size * 2.2;
    return <SvgText key={key} x={op.x} y={op.y + fs * 0.85} fontSize={fs} fill={op.color}>{op.text}</SvgText>;
  }
  return null;
}

// ---- web canvas flatten (same drawing code as the prototype)
function drawOpCanvas(ctx: any, op: Op) {
  ctx.strokeStyle = op.color; ctx.fillStyle = op.color; ctx.lineWidth = op.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (op.type === 'draw') {
    if (op.points.length < 2) return;
    ctx.beginPath(); ctx.moveTo(op.points[0][0], op.points[0][1]);
    op.points.slice(1).forEach(([x, y]: number[]) => ctx.lineTo(x, y));
    ctx.stroke();
  } else if (op.type === 'rect') {
    ctx.strokeRect(Math.min(op.x1, op.x2), Math.min(op.y1, op.y2), Math.abs(op.x2 - op.x1), Math.abs(op.y2 - op.y1));
  } else if (op.type === 'circle') {
    ctx.beginPath(); ctx.ellipse((op.x1 + op.x2) / 2, (op.y1 + op.y2) / 2, Math.abs(op.x2 - op.x1) / 2, Math.abs(op.y2 - op.y1) / 2, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (op.type === 'arrow') {
    ctx.beginPath(); ctx.moveTo(op.x1, op.y1); ctx.lineTo(op.x2, op.y2); ctx.stroke();
    ctx.beginPath();
    arrowHead(op).forEach(([ax, ay, bx, by]) => { ctx.moveTo(ax, ay); ctx.lineTo(bx, by); });
    ctx.stroke();
  } else if (op.type === 'text') {
    ctx.font = `${op.size * 2.2}px system-ui, sans-serif`; ctx.textBaseline = 'top'; ctx.fillText(op.text, op.x, op.y);
  }
}

function loadWebImage(uri: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const img = new (window as any).Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = uri;
  });
}

async function webFlatten(base: Base, ops: Op[]) {
  const img = await loadWebImage(base.uri);
  const canvas = (document as any).createElement('canvas');
  canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  ops.forEach((op) => drawOpCanvas(ctx, op));
  return canvas.toDataURL('image/jpeg', 0.92);
}

const toJpeg = async (uri: string, actions: any[] = [], base64 = false) => {
  const r = await manipulateAsync(uri, actions, { format: SaveFormat.JPEG, compress: 0.92, base64 });
  return r;
};

export default function PhotoEdit({ src, noteLabel = 'Add a note', noteRequired = false, onCancel, onSend }: {
  src: string; noteLabel?: string; noteRequired?: boolean; onCancel: () => void; onSend: (dataUrl: string, words: string) => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const stageRef = useRef<any>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [history, setHistory] = useState<Entry[] | null>(null);
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<string | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [draft, setDraft] = useState<Op | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number; sx: number; sy: number; value: string } | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [busy, setBusy] = useState(false);
  const cur = history ? history[index] : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let r = await toJpeg(src);
        const m = Math.max(r.width, r.height);
        if (m > MAX_DIM) r = await toJpeg(src, [{ resize: r.width >= r.height ? { width: MAX_DIM } : { height: MAX_DIM } }]);
        if (cancelled) return;
        setHistory([{ base: { uri: r.uri, w: r.width, h: r.height }, ops: [] }]);
        setIndex(0);
      } catch {
        if (!cancelled) onCancel();
      }
    })();
    return () => { cancelled = true; };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  // fit the photo inside the stage
  const disp = useMemo(() => {
    if (!cur || !stage.w || !stage.h) return { w: 0, h: 0, k: 1 };
    const k = Math.min((stage.w - 16) / cur.base.w, (stage.h - 12) / cur.base.h);
    return { w: cur.base.w * k, h: cur.base.h * k, k };
  }, [cur?.base, stage.w, stage.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const pushHistory = (next: Entry) => {
    const base = (history as Entry[]).slice(0, index + 1);
    setHistory([...base, next]);
    setIndex(base.length);
  };
  const commitOps = (ops: Op[]) => pushHistory({ base: (cur as Entry).base, ops });

  // Bake the markup into a JPEG. 'data' for sending, 'file' for crop/rotate input on device.
  const flatten = async (kind: 'data' | 'file' = 'data'): Promise<string> => {
    const e = cur as Entry;
    if (Platform.OS === 'web') return webFlatten(e.base, e.ops);
    if (!e.ops.length) {
      if (kind === 'file') return e.base.uri;
      const r = await toJpeg(e.base.uri, [], true);
      return `data:image/jpeg;base64,${r.base64}`;
    }
    return captureRef(stageRef, { format: 'jpg', quality: 0.92, result: kind === 'file' ? 'tmpfile' : 'data-uri', width: e.base.w, height: e.base.h });
  };

  const pendingTextOps = (): Op[] | null => {
    if (textInput && textInput.value.trim() && cur) {
      return [...cur.ops, { type: 'text', color, size, x: textInput.x, y: textInput.y, text: textInput.value.trim() }];
    }
    return null;
  };
  const commitPendingText = () => {
    const next = pendingTextOps();
    if (next) commitOps(next);
    setTextInput(null);
  };

  const cancelCrop = () => { setCropSrc(null); setCrop(null); setTool(null); };

  const applyCrop = async () => {
    if (!cropSrc || !crop || !cur || busy) { cancelCrop(); return; }
    const sx = Math.max(0, Math.round(crop.x / disp.k));
    const sy = Math.max(0, Math.round(crop.y / disp.k));
    const sw = Math.min(cur.base.w - sx, Math.round(crop.w / disp.k));
    const sh = Math.min(cur.base.h - sy, Math.round(crop.h / disp.k));
    if (sw < 8 || sh < 8) { cancelCrop(); return; }
    setBusy(true);
    try {
      const r = await toJpeg(cropSrc, [{ crop: { originX: sx, originY: sy, width: sw, height: sh } }]);
      pushHistory({ base: { uri: r.uri, w: r.width, h: r.height }, ops: [] });
    } finally { setBusy(false); }
    cancelCrop();
  };

  const rotate = async () => {
    if (busy || !cur) return;
    setBusy(true);
    try {
      const pending = pendingTextOps();
      const flat = pending ? await (async () => { const old = cur; const tmp = { ...old, ops: pending }; return Platform.OS === 'web' ? webFlatten(tmp.base, tmp.ops) : flatten('file'); })() : await flatten('file');
      setTextInput(null);
      const r = await toJpeg(flat, [{ rotate: 90 }]);
      pushHistory({ base: { uri: r.uri, w: r.width, h: r.height }, ops: [] });
    } finally { setBusy(false); }
  };

  const chooseTool = async (next: string) => {
    commitPendingText();
    setDraft(null);
    if (next === 'rotate') { rotate(); return; }
    const t = tool === next ? null : next;
    if (t === 'crop') {
      setBusy(true);
      try { setCropSrc(await flatten('file')); } finally { setBusy(false); }
      setCrop(null);
    } else if (tool === 'crop') { setCropSrc(null); setCrop(null); }
    setTool(t);
  };

  // default crop box (80% of the photo, centered) once the crop image and display size are known
  useEffect(() => {
    if (tool === 'crop' && cropSrc && disp.w && !crop) {
      setCrop({ x: disp.w * 0.1, y: disp.h * 0.1, w: disp.w * 0.8, h: disp.h * 0.8 });
    }
  }, [tool, cropSrc, disp.w, disp.h, crop]);

  // ---- gestures. Handlers read the latest state through a ref (PanResponder is created once).
  const H = useRef<any>({});
  const start = useRef({ x: 0, y: 0 });
  const cropStart = useRef<any>(null);
  const toNat = (x: number, y: number) => ({ x: Math.max(0, Math.min(cur?.base.w || 0, x / disp.k)), y: Math.max(0, Math.min(cur?.base.h || 0, y / disp.k)) });

  H.current.grant = (e: any) => {
    const lx = e.nativeEvent.locationX; const ly = e.nativeEvent.locationY;
    start.current = { x: lx, y: ly };
    if (tool === 'crop') {
      if (!crop) return;
      const corners: [string, number, number][] = [['nw', crop.x, crop.y], ['ne', crop.x + crop.w, crop.y], ['sw', crop.x, crop.y + crop.h], ['se', crop.x + crop.w, crop.y + crop.h]];
      let hit = corners.find(([, cx, cy]) => Math.hypot(cx - lx, cy - ly) < 32)?.[0];
      if (!hit && lx > crop.x && lx < crop.x + crop.w && ly > crop.y && ly < crop.y + crop.h) hit = 'move';
      cropStart.current = hit ? { mode: hit, rect: { ...crop } } : null;
      return;
    }
    if (!tool || !cur) return;
    commitPendingText();
    const { x, y } = toNat(lx, ly);
    if (tool === 'draw') setDraft({ type: 'draw', color, size, points: [[x, y]] });
    else if (['rect', 'circle', 'arrow'].includes(tool)) setDraft({ type: tool, color, size, x1: x, y1: y, x2: x, y2: y });
    else if (tool === 'text') setTextInput({ x, y, sx: lx, sy: ly, value: '' });
  };
  H.current.move = (_e: any, g: any) => {
    const lx = start.current.x + g.dx; const ly = start.current.y + g.dy;
    if (tool === 'crop') {
      const cs = cropStart.current;
      if (!cs) return;
      const r = cs.rect; const min = 24;
      let { x, y, w, h } = r;
      if (cs.mode === 'move') {
        x = Math.max(0, Math.min(disp.w - r.w, r.x + g.dx));
        y = Math.max(0, Math.min(disp.h - r.h, r.y + g.dy));
      } else {
        const px = Math.max(0, Math.min(disp.w, cs.mode.includes('w') ? r.x + g.dx : r.x + r.w + g.dx));
        const py = Math.max(0, Math.min(disp.h, cs.mode.includes('n') ? r.y + g.dy : r.y + r.h + g.dy));
        if (cs.mode.includes('w')) { x = Math.min(px, r.x + r.w - min); w = r.x + r.w - x; } else w = Math.max(min, px - r.x);
        if (cs.mode.includes('n')) { y = Math.min(py, r.y + r.h - min); h = r.y + r.h - y; } else h = Math.max(min, py - r.y);
      }
      setCrop({ x, y, w, h });
      return;
    }
    setDraft((d: Op | null) => {
      if (!d) return d;
      const { x, y } = toNat(lx, ly);
      if (d.type === 'draw') return { ...d, points: [...d.points, [x, y]] };
      return { ...d, x2: x, y2: y };
    });
  };
  H.current.release = () => {
    cropStart.current = null;
    if (!draft || !cur) return;
    if (draft.type === 'draw') {
      if (draft.points.length > 1) commitOps([...cur.ops, draft]);
    } else if (Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > 3) commitOps([...cur.ops, draft]);
    setDraft(null);
  };
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => H.current.grant(e),
    onPanResponderMove: (e, g) => H.current.move(e, g),
    onPanResponderRelease: () => H.current.release(),
    onPanResponderTerminate: () => H.current.release(),
  }), []);

  const cropping = tool === 'crop';
  async function send() {
    const words = note.trim();
    if (noteRequired && !words) { setNoteError('Write a note before sending.'); return; }
    if (!cur || busy) return;
    setBusy(true);
    try {
      const pending = pendingTextOps();
      let data: string;
      if (pending && Platform.OS === 'web') data = await webFlatten(cur.base, pending);
      else { commitPendingText(); data = await flatten('data'); }
      setTextInput(null);
      onSend(data, words);
    } finally { setBusy(false); }
  }

  const ops = cur?.ops || [];
  const showInk = !cropping && !!tool && ['draw', 'rect', 'circle', 'arrow', 'text'].includes(tool);

  const topBtn = { color: '#fff', fontSize: 15 };
  const bar = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, paddingVertical: 8, paddingHorizontal: 10 };
  const strip = { gap: 6, paddingHorizontal: 8, paddingBottom: 8, alignItems: 'center' as const };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={bar}>
        <Pressable onPress={onCancel} accessibilityRole="button" style={{ minWidth: 60 }}><Text style={topBtn}>Cancel</Text></Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#fff' }}>Edit photo</Text>
        <View style={{ minWidth: 60 }} />
      </View>
      <View accessibilityRole="toolbar" accessibilityLabel="Photo tools">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={strip} style={{ flexGrow: 0 }}>
          {TOOLS.map(([key, label, icon]) => {
            const disabled = cropping && key !== 'crop';
            const on = tool === key;
            return (
              <Pressable
                key={key} accessibilityLabel={label} accessibilityState={{ selected: on, disabled }} disabled={disabled || busy}
                onPress={() => chooseTool(key)}
                style={{ width: 44, paddingVertical: 4, borderRadius: 10, alignItems: 'center', backgroundColor: on ? c.accent : 'transparent', opacity: disabled ? 0.35 : 1 }}
              >
                <Icon name={icon} size={20} color={on ? '#fff' : '#d1d7db'} />
                <Text style={{ fontSize: 10, color: on ? '#fff' : '#d1d7db' }}>{label}</Text>
              </Pressable>
            );
          })}
          {[['undo', 'Undo', cropping || index === 0, () => index > 0 && setIndex(index - 1)] as const,
            ['redo', 'Redo', cropping || !history || index >= history.length - 1, () => history && index < history.length - 1 && setIndex(index + 1)] as const].map(([icon, label, disabled, fn]) => (
            <Pressable key={label} accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={fn}
              style={{ width: 44, paddingVertical: 4, borderRadius: 10, alignItems: 'center', opacity: disabled ? 0.35 : 1 }}>
              <Icon name={icon} size={20} color="#d1d7db" />
              <Text style={{ fontSize: 10, color: '#d1d7db' }}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      {cropping && (
        <View style={bar}>
          <Pressable onPress={cancelCrop} accessibilityRole="button"><Text style={topBtn}>Cancel crop</Text></Pressable>
          <Pressable onPress={applyCrop} disabled={!crop || busy} accessibilityRole="button" style={{ backgroundColor: c.accent, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, opacity: crop ? 1 : 0.35 }}>
            <Text style={topBtn}>Apply crop</Text>
          </Pressable>
        </View>
      )}
      {showInk && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={strip} style={{ flexGrow: 0 }}>
          {COLORS.map((col) => (
            <Pressable key={col} accessibilityLabel={`Color ${col}`} accessibilityState={{ selected: color === col }} onPress={() => setColor(col)}
              style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: col, borderWidth: 2, borderColor: color === col ? '#fff' : 'transparent' }} />
          ))}
          {SIZES.map((sz) => (
            <Pressable key={sz} accessibilityLabel={`Size ${sz}`} accessibilityState={{ selected: size === sz }} onPress={() => setSize(sz)}
              style={{ width: 26, height: 26, borderRadius: 8, borderWidth: 1, borderColor: size === sz ? '#fff' : '#3b4a54', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: sz / 1.4, height: sz / 1.4, borderRadius: sz / 2.8, backgroundColor: '#fff' }} />
            </Pressable>
          ))}
        </ScrollView>
      )}
      {tool === 'text' && !cropping && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={strip} style={{ flexGrow: 0 }}>
          {LABELS.map((label) => (
            <Pressable key={label} onPress={() => setTextInput((cur2) => (cur2 ? { ...cur2, value: label } : cur2))}
              style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: PANEL }}>
              <Text style={{ color: '#fff', fontSize: 13 }}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <View style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingTop: 4, paddingBottom: 8 }}
        onLayout={(e) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {!cur || !disp.w ? <Text style={{ color: '#8696a0' }}>Loading photo…</Text> : (
          <View style={{ width: disp.w, height: disp.h }}>
            {/* captured by view-shot / mirrors the canvas: base image + vector markup */}
            <View ref={stageRef} collapsable={false} style={{ width: disp.w, height: disp.h }}>
              <Image source={{ uri: cropping && cropSrc ? cropSrc : cur.base.uri }} style={{ width: disp.w, height: disp.h }} resizeMode="stretch" />
              {!cropping && (
                <Svg width={disp.w} height={disp.h} viewBox={`0 0 ${cur.base.w} ${cur.base.h}`} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
                  {ops.map((op, i) => renderOp(op, i))}
                  {draft ? renderOp(draft, 'draft') : null}
                </Svg>
              )}
            </View>
            {cropping && crop && (
              <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: disp.w, height: disp.h }}>
                <View style={{ position: 'absolute', left: 0, top: 0, width: disp.w, height: crop.y, backgroundColor: 'rgba(0,0,0,0.55)' }} />
                <View style={{ position: 'absolute', left: 0, top: crop.y + crop.h, width: disp.w, height: disp.h - crop.y - crop.h, backgroundColor: 'rgba(0,0,0,0.55)' }} />
                <View style={{ position: 'absolute', left: 0, top: crop.y, width: crop.x, height: crop.h, backgroundColor: 'rgba(0,0,0,0.55)' }} />
                <View style={{ position: 'absolute', left: crop.x + crop.w, top: crop.y, width: disp.w - crop.x - crop.w, height: crop.h, backgroundColor: 'rgba(0,0,0,0.55)' }} />
                <View style={{ position: 'absolute', left: crop.x, top: crop.y, width: crop.w, height: crop.h, borderWidth: 1, borderColor: '#fff' }} />
                {[[crop.x, crop.y], [crop.x + crop.w, crop.y], [crop.x, crop.y + crop.h], [crop.x + crop.w, crop.y + crop.h]].map(([hx, hy], i) => (
                  <View key={i} style={{ position: 'absolute', left: hx - 9, top: hy - 9, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', borderWidth: 2, borderColor: c.accent }} />
                ))}
              </View>
            )}
            {tool ? <View {...pan.panHandlers} style={{ position: 'absolute', left: 0, top: 0, width: disp.w, height: disp.h }} accessibilityLabel="Photo canvas" /> : null}
            {textInput && !cropping && (
              <TextInput
                autoFocus value={textInput.value} placeholder="Add text" accessibilityLabel="Text on the photo"
                onChangeText={(v) => setTextInput({ ...textInput, value: v })}
                onSubmitEditing={commitPendingText}
                style={{ position: 'absolute', left: Math.min(textInput.sx, Math.max(0, disp.w - 120)), top: textInput.sy, minWidth: 120, borderRadius: 6, backgroundColor: '#fff', color, fontSize: 14, paddingVertical: 4, paddingHorizontal: 6 }}
              />
            )}
          </View>
        )}
      </View>
      {!cropping && (
        <View style={[bar, { paddingBottom: 8 + insets.bottom }]}>
          <TextInput
            value={note} placeholder={noteRequired ? noteLabel : 'Add a note'} placeholderTextColor="#8696a0" accessibilityLabel={noteLabel}
            onChangeText={(v) => { setNote(v); setNoteError(''); }} onSubmitEditing={send}
            style={{ flex: 1, minWidth: 0, borderRadius: 22, backgroundColor: PANEL, color: '#fff', fontSize: 15, paddingVertical: 10, paddingHorizontal: 14 }}
          />
          <Pressable onPress={send} disabled={!cur || busy} accessibilityLabel="Send photo" accessibilityRole="button"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', opacity: !cur || busy ? 0.45 : 1 }}>
            <Icon name="send" color="#fff" />
          </Pressable>
        </View>
      )}
      {noteError ? <Text style={{ paddingHorizontal: 12, paddingBottom: 8, color: '#f87171', fontSize: 13 }}>{noteError}</Text> : null}
    </View>
  );
}
