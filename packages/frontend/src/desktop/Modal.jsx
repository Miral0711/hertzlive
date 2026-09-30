import { useEffect, useRef } from 'react';
import { state } from '../shared/core.js';
import { closeDialog } from './session';

// Native <dialog> shown modally (focus trap + Escape for free), styled with Tailwind.
export default function Modal({ title, wide = false, label, onClose = closeDialog, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
    return () => el?.open && el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      // backdrop:bg-black/40 is an intentional exception — a modal scrim stays black at a fixed
      // opacity in both themes, the same way a browser's own <dialog> backdrop would.
      className={`m-auto max-h-[90vh] w-[min(560px,calc(100vw-32px))] overflow-auto rounded-r3 border border-line bg-surface p-5 text-ink shadow-s2 backdrop:bg-black/40 ${wide ? '!w-[min(900px,calc(100vw-32px))]' : ''}`}
    >
      {title && <h3 className="mb-3 mt-0 text-lg font-semibold">{title}</h3>}
      {children}
      {state.toast && (
        <div role="status" className="sticky bottom-0 mt-3 rounded-r2 bg-ink px-4 py-2.5 font-medium text-surface">
          {state.toast}
        </div>
      )}
    </dialog>
  );
}

export const ModalActions = ({ children }) => <div className="mt-3.5 flex justify-end gap-2">{children}</div>;
