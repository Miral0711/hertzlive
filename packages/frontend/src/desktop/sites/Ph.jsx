import { useEffect, useRef } from 'react';
import { paintPh } from '../../shared/core.js';

// Deterministic placeholder photo (the prototype's ph() helper as a component).
export default function Ph({ hue, seed, ar = 1.333, thumb = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) paintPh(ref.current);
  }, [hue, seed, ar]);
  return (
    <div className={thumb ? 'inline-block w-14 align-middle' : 'w-full overflow-hidden rounded-r2'}>
      <canvas ref={ref} data-hue={hue} data-seed={seed} data-ar={ar} aria-hidden="true" className="block h-auto w-full" />
    </div>
  );
}
