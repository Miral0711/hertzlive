import { useEffect, useRef, useState } from 'react';
import { paintPh } from '../shared/core.js';

// Bundled photo pool (public/images/p01..pNN.jpg). A placeholder slot picks one deterministically
// from its data-seed/hue, so the same project/site/item always shows the same photo.
const POOL = 18;
const hash = (s) => {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};
export const photoUrl = (hue, seed) => {
  const n = (hash(`${hue}:${seed}`) % POOL) + 1;
  return `${process.env.PUBLIC_URL || ''}/images/p${String(n).padStart(2, '0')}.jpg`;
};

// Photo slot used everywhere a project/site/message has no uploaded image. Shows a real photo;
// falls back to the painted canvas (paintPh reads data-hue/seed/ar) if the file fails to load.
export function Photo({ hue, seed, ar = 1.333, className = '', alt = '' }) {
  const ref = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const c = ref.current;
    if (!failed || !c) return;
    c.dataset.hue = hue;
    c.dataset.seed = seed;
    c.dataset.ar = ar;
    paintPh(c);
  }, [failed, hue, seed, ar]);
  return failed ? (
    <canvas ref={ref} data-hue={hue} data-seed={seed} data-ar={ar} aria-hidden="true" className={`block h-full w-full ${className}`} />
  ) : (
    <img src={photoUrl(hue, seed)} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`block h-full w-full object-cover ${className}`} />
  );
}

export default function Ph({ hue, seed, ar = 1.333, thumb = false, className = '' }) {
  if (thumb) {
    return (
      <div className={`inline-block w-14 overflow-hidden rounded-r1 align-middle ${className}`} style={{ aspectRatio: `${ar} / 1` }}>
        <Photo hue={hue} seed={seed} ar={ar} />
      </div>
    );
  }
  return (
    <div className={`w-full overflow-hidden rounded-r2 bg-surface-2 ${className}`} style={{ aspectRatio: `${ar} / 1` }}>
      <Photo hue={hue} seed={seed} ar={ar} />
    </div>
  );
}
