import { useEffect, useRef, useState } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import Icon from './Icon';
import { downscaleImage, loadImage } from '../desktop/chat/mediaUtils';

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#111827', '#ffffff'];
const SIZES = [4, 8, 16];
const LABELS = ['Crack', 'Electrical point', 'Plumbing', 'Dimension', 'Defect', 'Change required', 'Material', 'Site instruction'];
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

export default function PhotoEdit({ src, noteLabel = 'Add a note', noteRequired = false, onCancel, onSend }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const strokeRef = useRef(null);
  const cropImgRef = useRef(null);
  const [history, setHistory] = useState(null);
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [draft, setDraft] = useState(null);
  const [textInput, setTextInput] = useState(null);
  const [cropSrc, setCropSrc] = useState(null);
  const [cropSel, setCropSel] = useState();
  const [cropPixels, setCropPixels] = useState(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const cur = history ? history[index] : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = src.startsWith('data:') ? src : await new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          res(c.toDataURL('image/jpeg', 0.92));
        };
        img.onerror = () => rej(new Error('Could not load image'));
        img.src = src;
      });
      const { dataUrl } = await downscaleImage(raw, 1600, 0.9);
      if (cancelled) return;
      setHistory([{ base: dataUrl, ops: [] }]);
      setIndex(0);
    })();
    return () => { cancelled = true; };
  }, [src]);

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

  useEffect(() => {
    if (!cur) return undefined;
    let cancelled = false;
    loadImage(cur.base).then((img) => {
      if (cancelled) return;
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }
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

  const flatten = () => canvasRef.current.toDataURL('image/jpeg', 0.92);

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
    if (!img || !cropPixels?.width || !cropPixels?.height) { cancelCrop(); return; }
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    const sx = Math.max(0, cropPixels.x * scaleX);
    const sy = Math.max(0, cropPixels.y * scaleY);
    const sw = Math.min(img.naturalWidth - sx, cropPixels.width * scaleX);
    const sh = Math.min(img.naturalHeight - sy, cropPixels.height * scaleY);
    if (sw < 8 || sh < 8) { cancelCrop(); return; }
    const c2 = document.createElement('canvas');
    c2.width = sw;
    c2.height = sh;
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
    c2.width = canvas.height;
    c2.height = canvas.width;
    const ctx = c2.getContext('2d');
    ctx.translate(c2.width / 2, c2.height / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    pushHistory({ base: c2.toDataURL('image/jpeg', 0.92), ops: [] });
  };

  const chooseTool = (nextTool) => {
    commitPendingText();
    setDraft(null);
    if (nextTool === 'rotate') { rotate(); return; }
    const next = tool === nextTool ? null : nextTool;
    if (next === 'crop') {
      setCropSrc(flatten());
      setCropSel(undefined);
      setCropPixels(null);
    } else if (tool === 'crop') {
      setCropSrc(null);
      setCropSel(undefined);
      setCropPixels(null);
    }
    setTool(next);
  };

  const onDown = (e) => {
    if (!tool || tool === 'crop' || !cur) return;
    commitPendingText();
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
    const { x, y } = toNatural(canvasRef.current, e.clientX, e.clientY);
    if (draft.type === 'draw') {
      strokeRef.current.points.push([x, y]);
      setDraft({ ...strokeRef.current, points: strokeRef.current.points });
    } else setDraft((d) => ({ ...d, x2: x, y2: y }));
  };
  const onUp = () => {
    if (!draft) return;
    if (draft.type === 'draw') {
      if (draft.points.length > 1) commitOps([...(cur.ops || []), draft]);
    } else if (Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > 3) {
      commitOps([...(cur.ops || []), draft]);
    }
    setDraft(null);
    strokeRef.current = null;
  };

  const cropping = tool === 'crop';
  function send() {
    const words = note.trim();
    if (noteRequired && !words) { setNoteError('Write a note before sending.'); return; }
    commitPendingText();
    onSend(flatten(), words);
  }

  return (
    <div className="pedit">
      <header className="pedit-top">
        <button type="button" onClick={onCancel}>Cancel</button>
        <b>Edit photo</b>
        <span />
      </header>
      <div className="pedit-tools" role="toolbar" aria-label="Photo tools">
        {TOOLS.map(([key, label, icon]) => (
          <button key={key} type="button" aria-label={label} aria-pressed={tool === key} disabled={cropping && key !== 'crop'} className={tool === key ? 'on' : ''} onClick={() => chooseTool(key)}>
            <Icon name={icon} />
            <span>{label}</span>
          </button>
        ))}
        <button type="button" aria-label="Undo" onClick={() => index > 0 && setIndex(index - 1)} disabled={cropping || index === 0}><Icon name="undo" /><span>Undo</span></button>
        <button type="button" aria-label="Redo" onClick={() => history && index < history.length - 1 && setIndex(index + 1)} disabled={cropping || !history || index >= history.length - 1}><Icon name="redo" /><span>Redo</span></button>
      </div>
      {cropping && (
        <div className="pedit-crop">
          <button type="button" onClick={cancelCrop}>Cancel crop</button>
          <button type="button" className="on" onClick={applyCrop} disabled={!cropPixels?.width}>Apply crop</button>
        </div>
      )}
      {!cropping && ['draw', 'rect', 'circle', 'arrow', 'text'].includes(tool) && (
        <div className="pedit-ink">
          {COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c} className={color === c ? 'on' : ''} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
          {SIZES.map((s) => (
            <button key={s} type="button" className={`pedit-size ${size === s ? 'on' : ''}`} aria-label={`Size ${s}`} aria-pressed={size === s} onClick={() => setSize(s)}>
              <i style={{ width: s / 1.4, height: s / 1.4 }} />
            </button>
          ))}
        </div>
      )}
      {tool === 'text' && !cropping && (
        <div className="pedit-labels">
          {LABELS.map((label) => (
            <button key={label} type="button" onClick={() => setTextInput((current) => (current ? { ...current, value: label } : current))}>{label}</button>
          ))}
        </div>
      )}
      <div className="pedit-stage">
        {!cur ? <p>Loading photo…</p> : cropping && cropSrc ? (
          <ReactCrop
            crop={cropSel}
            onChange={(_pixel, percent) => setCropSel(percent)}
            onComplete={(pixel) => setCropPixels(pixel)}
            minWidth={20}
            minHeight={20}
            keepSelection
          >
            <img ref={cropImgRef} src={cropSrc} alt="" onLoad={(e) => {
              const img = e.currentTarget;
              const { naturalWidth: w, naturalHeight: h } = img;
              const sel = centerCrop(makeAspectCrop({ unit: '%', width: 80 }, w / h, w, h), w, h);
              setCropSel(sel);
              const box = () => {
                const el = cropImgRef.current;
                if (!el?.clientWidth) return;
                setCropPixels({
                  unit: 'px',
                  x: (sel.x / 100) * el.clientWidth,
                  y: (sel.y / 100) * el.clientHeight,
                  width: (sel.width / 100) * el.clientWidth,
                  height: (sel.height / 100) * el.clientHeight,
                });
              };
              box();
              requestAnimationFrame(box);
            }} />
          </ReactCrop>
        ) : (
          <div className="pedit-canvas">
            <canvas ref={canvasRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
            {textInput && (
              <input
                autoFocus
                value={textInput.value}
                placeholder="Add text"
                aria-label="Text on the photo"
                style={{ left: textInput.sx, top: textInput.sy, color }}
                onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitPendingText();
                  if (e.key === 'Escape') setTextInput(null);
                }}
              />
            )}
          </div>
        )}
      </div>
      {!cropping && (
        <form className="pedit-send" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input value={note} placeholder={noteRequired ? noteLabel : 'Add a note'} aria-label={noteLabel} onChange={(e) => { setNote(e.target.value); setNoteError(''); }} />
          <button type="submit" className="round send" aria-label="Send photo" disabled={!cur}><Icon name="send" /></button>
        </form>
      )}
      {noteError ? <p className="pedit-error">{noteError}</p> : null}
    </div>
  );
}
