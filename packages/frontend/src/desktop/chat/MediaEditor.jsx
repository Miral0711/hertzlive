// Non-destructive image preview + annotation editor shown before an image/video is sent.
// Draw/Text/Shapes/Rotate stay a hand-rolled <canvas> (matching the raw-canvas approach already
// used by `Ph`/`paintPh` in media.jsx); Crop uses `react-image-crop` for a real draggable/
// resizable selection with corner + edge handles, rather than a hand-rolled marquee. The
// picked file's data URL is never mutated - all edits happen on a working copy (`base`);
// Cancel just closes without ever building/sending anything.
import { useEffect, useRef, useState } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import './MediaEditor.css';
import { Btn } from '../../ui/ui';
import Modal, { ModalActions } from '../Modal';
import { downscaleImage, loadImage } from './mediaUtils';

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#111827', '#ffffff'];
const SIZES = [4, 8, 16];
const QUICK_LABELS = [
  'Crack', 'Electrical point', 'Plumbing', 'Dimension', 'Defect', 'Change required', 'Material', 'Site instruction',
];
// [tool key, accessible label/tooltip, icon name]
const TOOLS = [
  ['crop', 'Crop', 'crop'],
  ['rotate', 'Rotate', 'rotate'],
  ['draw', 'Draw', 'edit'],
  ['text', 'Text', 'typeT'],
  ['rect', 'Rectangle', 'rectangle'],
  ['arrow', 'Arrow', 'arrowdiag'],
  ['circle', 'Circle', 'circleicon'],
];

function toNatural(canvas, clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((clientX - r.left) / r.width) * canvas.width,
    y: ((clientY - r.top) / r.height) * canvas.height,
  };
}

function drawArrowHead(ctx, x1, y1, x2, y2, size) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.max(10, size * 2.2);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - len * Math.cos(angle - Math.PI / 7), y2 - len * Math.sin(angle - Math.PI / 7));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - len * Math.cos(angle + Math.PI / 7), y2 - len * Math.sin(angle + Math.PI / 7));
  ctx.stroke();
}

function drawOp(ctx, op) {
  ctx.strokeStyle = op.color;
  ctx.fillStyle = op.color;
  ctx.lineWidth = op.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (op.type === 'draw') {
    if (op.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(op.points[0][0], op.points[0][1]);
    op.points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.stroke();
  } else if (op.type === 'rect') {
    ctx.strokeRect(Math.min(op.x1, op.x2), Math.min(op.y1, op.y2), Math.abs(op.x2 - op.x1), Math.abs(op.y2 - op.y1));
  } else if (op.type === 'circle') {
    const rx = Math.abs(op.x2 - op.x1) / 2;
    const ry = Math.abs(op.y2 - op.y1) / 2;
    ctx.beginPath();
    ctx.ellipse((op.x1 + op.x2) / 2, (op.y1 + op.y2) / 2, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (op.type === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(op.x1, op.y1);
    ctx.lineTo(op.x2, op.y2);
    ctx.stroke();
    drawArrowHead(ctx, op.x1, op.y1, op.x2, op.y2, op.size);
  } else if (op.type === 'text') {
    ctx.font = `${op.size * 2.2}px system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(op.text, op.x, op.y);
  }
}

export default function MediaEditor({ file, kind, onCancel, onSend }) {
  const isVideo = kind === 'video';
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const strokeRef = useRef(null);
  const cropImgRef = useRef(null);
  const [videoUrl] = useState(() => (isVideo ? URL.createObjectURL(file) : null));
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);

  const [history, setHistory] = useState(null); // [{base, ops}]
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [draft, setDraft] = useState(null); // in-progress shape/stroke
  const [textInput, setTextInput] = useState(null); // {x, y, sx, sy, value}
  const [busy, setBusy] = useState(!isVideo);

  // Crop mode: a snapshot of the current (flattened) image, plus react-image-crop's own
  // selection state. `cropPixels` is the selection in the *displayed* <img>'s pixels, from
  // onComplete - converted to source pixels in applyCrop().
  const [cropSrc, setCropSrc] = useState(null);
  const [cropSel, setCropSel] = useState();
  const [cropPixels, setCropPixels] = useState(null);

  const cur = history ? history[index] : null;

  // Load the source image once (downscaled so it stays reasonable in localStorage).
  useEffect(() => {
    if (isVideo) return;
    let cancelled = false;
    (async () => {
      const raw = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
      });
      const { dataUrl } = await downscaleImage(raw, 1600, 0.9);
      if (cancelled) return;
      setHistory([{ base: dataUrl, ops: [] }]);
      setIndex(0);
      setBusy(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const redraw = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    (cur?.ops || []).forEach((op) => drawOp(ctx, op));
    if (draft) drawOp(ctx, draft);
  };

  // (Re)load the working image whenever `cur.base` changes.
  useEffect(() => {
    if (!cur) return;
    let cancelled = false;
    loadImage(cur.base).then((img) => {
      if (cancelled) return;
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) { canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; }
      redraw();
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.base]);

  useEffect(redraw, [cur?.ops, draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const pushHistory = (next) => {
    const base = history.slice(0, index + 1);
    setHistory([...base, next]);
    setIndex(base.length);
  };
  const commitOps = (nextOps) => pushHistory({ base: cur.base, ops: nextOps });

  const flattenToDataUrl = () => {
    const canvas = canvasRef.current;
    return canvas.toDataURL('image/jpeg', 0.92);
  };

  // Commits whatever's in the floating text box into an op (skipped if left empty) - called
  // before anything that reads the canvas/ops so an in-progress label is never silently lost.
  // Draws immediately (not just via state) so a Rotate/Save/Send right after typing sees it
  // even before the next render's redraw effect has run.
  const commitPendingText = () => {
    if (textInput && textInput.value.trim()) {
      const op = { type: 'text', color, size, x: textInput.x, y: textInput.y, text: textInput.value.trim() };
      commitOps([...(cur.ops || []), op]);
      drawOp(canvasRef.current.getContext('2d'), op);
    }
    setTextInput(null);
  };

  const cancelCrop = () => {
    setCropSrc(null);
    setCropSel(undefined);
    setCropPixels(null);
    setTool(null);
  };

  const applyCrop = () => {
    const img = cropImgRef.current;
    if (!img || !cropPixels || !cropPixels.width || !cropPixels.height) { cancelCrop(); return; }
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    const sx = Math.max(0, cropPixels.x * scaleX);
    const sy = Math.max(0, cropPixels.y * scaleY);
    const sw = Math.min(img.naturalWidth - sx, cropPixels.width * scaleX);
    const sh = Math.min(img.naturalHeight - sy, cropPixels.height * scaleY);
    if (sw < 8 || sh < 8) { cancelCrop(); return; }
    const c2 = document.createElement('canvas');
    c2.width = sw; c2.height = sh;
    c2.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    pushHistory({ base: c2.toDataURL('image/jpeg', 0.92), ops: [] });
    setCropSrc(null);
    setCropSel(undefined);
    setCropPixels(null);
    setTool(null);
  };

  const rotate = () => {
    commitPendingText();
    const canvas = canvasRef.current;
    const c2 = document.createElement('canvas');
    c2.width = canvas.height; c2.height = canvas.width;
    const ctx = c2.getContext('2d');
    ctx.translate(c2.width / 2, c2.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    pushHistory({ base: c2.toDataURL('image/jpeg', 0.92), ops: [] });
  };

  const save = () => {
    commitPendingText();
    pushHistory({ base: flattenToDataUrl(), ops: [] });
  };

  const send = () => {
    commitPendingText();
    const dataUrl = flattenToDataUrl();
    onSend({ kind: 'image', dataUrl, originalDataUrl: history[0].base, name: file.name, w: canvasRef.current.width, h: canvasRef.current.height });
  };

  const sendVideo = () => {
    onSend({ kind: 'video', url: videoUrl, name: file.name });
  };

  // ---------- pointer handling (draw / shapes / text - crop is handled by ReactCrop) ----------
  const onDown = (e) => {
    if (!tool || tool === 'crop' || busy) return;
    commitPendingText(); // starting any new op commits an already-open text label first
    const canvas = canvasRef.current;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = toNatural(canvas, e.clientX, e.clientY);
    if (tool === 'draw') {
      strokeRef.current = { type: 'draw', color, size, points: [[x, y]] };
      setDraft(strokeRef.current);
    } else if (['rect', 'circle', 'arrow'].includes(tool)) {
      setDraft({ type: tool, color, size, x1: x, y1: y, x2: x, y2: y });
    } else if (tool === 'text') {
      const r = canvas.getBoundingClientRect();
      setTextInput({ x, y, sx: e.clientX - r.left, sy: e.clientY - r.top, value: '' });
    }
  };
  const onMove = (e) => {
    if (!draft) return;
    const canvas = canvasRef.current;
    const { x, y } = toNatural(canvas, e.clientX, e.clientY);
    if (draft.type === 'draw') {
      strokeRef.current.points.push([x, y]);
      setDraft({ ...strokeRef.current, points: strokeRef.current.points });
    } else {
      setDraft((d) => ({ ...d, x2: x, y2: y }));
    }
  };
  const onUp = () => {
    if (!draft) return;
    if (draft.type === 'draw') {
      if (draft.points.length > 1) commitOps([...(cur.ops || []), draft]);
    } else {
      const moved = Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > 3;
      if (moved) commitOps([...(cur.ops || []), draft]);
    }
    setDraft(null);
    strokeRef.current = null;
  };

  const undo = () => index > 0 && setIndex(index - 1);
  const redo = () => history && index < history.length - 1 && setIndex(index + 1);

  const chooseTool = (t) => {
    commitPendingText();
    setDraft(null);
    if (t === 'rotate') { rotate(); return; }
    const next = tool === t ? null : t;
    if (next === 'crop') {
      // Crop starts from what's currently on screen (base + any annotations already applied).
      setCropSrc(flattenToDataUrl());
      setCropSel(undefined);
      setCropPixels(null);
    } else if (tool === 'crop') {
      setCropSrc(null);
      setCropSel(undefined);
      setCropPixels(null);
    }
    setTool(next);
  };

  const onCropImageLoad = (e) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setCropSel(centerCrop(makeAspectCrop({ unit: '%', width: 80 }, w / h, w, h), w, h));
  };

  if (isVideo) {
    return (
      <Modal title="Send video" wide onClose={onCancel}>
        <video src={videoUrl} controls className="max-h-[60vh] w-full rounded-r1 bg-black" />
        <p className="mt-2 text-xs text-ink-3">Video editing isn't supported yet - you can preview and send it as-is.</p>
        <ModalActions>
          <Btn onClick={onCancel}>Cancel</Btn>
          <Btn kind="primary" onClick={sendVideo}>Send</Btn>
        </ModalActions>
      </Modal>
    );
  }

  const cropping = tool === 'crop';

  return (
    <Modal title="Edit photo" wide onClose={onCancel}>
      {busy || !cur ? (
        <p className="p-6 text-center text-ink-3">Loading photo…</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {TOOLS.map(([t, label, iconName]) => (
              <Btn
                key={t} sm icon={iconName}
                title={label}
                aria-label={label}
                aria-pressed={tool === t}
                disabled={cropping && t !== 'crop'}
                className={tool === t ? '!border-accent !bg-accent-soft !text-accent-text' : ''}
                onClick={() => chooseTool(t)}
              />
            ))}
            <Btn sm icon="undo" title="Undo" aria-label="Undo" onClick={undo} disabled={cropping || index === 0} />
            <Btn sm icon="redo" title="Redo" aria-label="Redo" onClick={redo} disabled={cropping || !history || index >= history.length - 1} />
          </div>

          {cropping && (
            // Reserved as soon as the Crop tool is picked (not once a drag starts) so nothing
            // shifts position out from under the cursor mid-drag.
            <div className="mb-2 flex min-h-9 items-center gap-2">
              <Btn sm onClick={cancelCrop}>Cancel crop</Btn>
              <Btn sm kind="primary" onClick={applyCrop} disabled={!cropPixels?.width}>Apply crop</Btn>
            </div>
          )}

          {!cropping && ['draw', 'rect', 'circle', 'arrow', 'text'].includes(tool) && (
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              <div className="flex gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setColor(c)}
                    className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-accent' : 'border-line-2'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="flex gap-1.5">
                {SIZES.map((s) => (
                  <button
                    key={s} type="button" aria-label={`Size ${s}`} aria-pressed={size === s}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setSize(s)}
                    className={`grid h-7 w-7 place-items-center rounded-r1 border ${size === s ? 'border-accent bg-accent-soft' : 'border-line-2'}`}
                  >
                    <span className="rounded-full bg-ink" style={{ width: s / 1.5, height: s / 1.5 }} />
                  </button>
                ))}
              </div>
              {tool === 'text' && (
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_LABELS.map((l) => (
                    <Btn
                      key={l} sm
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setTextInput((t) => (t ? { ...t, value: l } : t))}
                    >
                      {l}
                    </Btn>
                  ))}
                </div>
              )}
            </div>
          )}

          {cropping && cropSrc ? (
            <ReactCrop
              crop={cropSel}
              onChange={(_pixelCrop, percentCrop) => setCropSel(percentCrop)}
              onComplete={(pixelCrop) => setCropPixels(pixelCrop)}
              minWidth={20}
              minHeight={20}
              keepSelection
              className="max-h-[55vh] max-w-full"
            >
              <img ref={cropImgRef} src={cropSrc} alt="" onLoad={onCropImageLoad} className="block max-h-[55vh] max-w-full rounded-r1" />
            </ReactCrop>
          ) : (
            <div className="relative inline-block max-w-full">
              <canvas
                ref={canvasRef}
                className="block max-h-[55vh] max-w-full touch-none rounded-r1 bg-surface-2"
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
              />
              {textInput && (
                <input
                  autoFocus
                  value={textInput.value}
                  onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitPendingText();
                    if (e.key === 'Escape') setTextInput(null);
                  }}
                  placeholder="Add text…"
                  style={{ left: textInput.sx, top: textInput.sy, color }}
                  className="absolute min-w-[120px] rounded border border-line-2 bg-surface px-1.5 py-0.5 text-sm shadow-s2"
                />
              )}
            </div>
          )}
        </>
      )}
      <ModalActions>
        <Btn onClick={onCancel}>Cancel</Btn>
        <Btn onClick={save} disabled={busy || !cur || cropping}>Save</Btn>
        <Btn kind="primary" onClick={send} disabled={busy || !cur || cropping}>Send</Btn>
      </ModalActions>
    </Modal>
  );
}
