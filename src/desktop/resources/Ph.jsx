import { useEffect, useRef } from 'react';
import { paintPh } from '../../shared/core.js';

// Deterministic placeholder "photo" (the prototype's ph()).
export default function Ph({ hue, seed, ar = 1.333, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.dataset.hue = hue;
    c.dataset.seed = seed;
    c.dataset.ar = ar;
    paintPh(c);
  }, [hue, seed, ar]);
  return (
    <div className={`overflow-hidden rounded-r1 bg-surface-2 ${className}`} style={{ aspectRatio: '4 / 3' }}>
      <canvas ref={ref} className="block h-full w-full" aria-hidden="true" />
    </div>
  );
}
