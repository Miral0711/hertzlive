import { useEffect, useRef } from 'react';
import { state, paintPh, messageAttachment } from '../../shared/core.js';

// Deterministic placeholder "photo" (the prototype's ph() + paintPh()).
export function Ph({ hue, seed, ar = 1.333, className = '' }) {
  const ref = useRef(null);
  const theme = state.theme;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.dataset.hue = hue;
    c.dataset.seed = seed;
    c.dataset.ar = ar;
    paintPh(c);
  }, [hue, seed, ar, theme]);
  return (
    <div className={`aspect-[4/3] overflow-hidden rounded-r1 bg-surface-2 ${className}`} style={ar !== 1.333 ? { aspectRatio: String(ar) } : undefined}>
      <canvas ref={ref} aria-hidden="true" className="block h-full w-full" />
    </div>
  );
}

// messageAttachmentPreview() as JSX.
export function AttachmentPreview({ m }) {
  const a = messageAttachment(m);
  if (!a) return null;
  if (m.file) {
    return <p className="my-2 rounded-r1 bg-surface-2 p-3 text-ink-2">File preview unavailable in this prototype. The original file is not attached.</p>;
  }
  const media = m.photo || m.album;
  const count = m.album ? Math.max(1, Math.min(Number(m.album.n) || 1, 4)) : 1;
  return (
    <>
      <div className="my-2 grid grid-cols-2 gap-2">
        {Array.from({ length: count }, (_, i) => (
          <Ph key={i} hue={Number(media.hue) || 30} seed={(Number(media.seed) || 1) + i} />
        ))}
      </div>
      <p className="text-ink-3">
        Demo image{m.album ? 's' : ''}{m.album && m.album.n > 4 ? ' · first 4 shown' : ''}; original media is not attached.
      </p>
    </>
  );
}
