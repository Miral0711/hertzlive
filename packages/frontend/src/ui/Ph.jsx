import { useEffect, useRef } from 'react';
import { paintPh } from '../shared/core.js';

// Deterministic placeholder "photo" (the prototype's ph() helper, as one shared component —
// previously duplicated separately under desktop/resources and desktop/sites). Used wherever
// a project/site/message has no real photo attached; a real image always wins when present
// (see ProjectCards / tenantProjectImage()). `data-hue`/`data-seed`/`data-ar` are read by
// paintPh() — a functional contract, not decorative, so keep them on the canvas as-is.
export default function Ph({ hue, seed, ar = 1.333, thumb = false, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.dataset.hue = hue;
    c.dataset.seed = seed;
    c.dataset.ar = ar;
    paintPh(c);
  }, [hue, seed, ar]);
  if (thumb) {
    return (
      <div className={`inline-block w-14 overflow-hidden rounded-r1 align-middle ${className}`}>
        <canvas ref={ref} data-hue={hue} data-seed={seed} data-ar={ar} aria-hidden="true" className="block h-auto w-full" />
      </div>
    );
  }
  return (
    <div className={`w-full overflow-hidden rounded-r2 bg-surface-2 ${className}`} style={{ aspectRatio: `${ar} / 1` }}>
      <canvas ref={ref} data-hue={hue} data-seed={seed} data-ar={ar} aria-hidden="true" className="block h-full w-full object-cover" />
    </div>
  );
}
