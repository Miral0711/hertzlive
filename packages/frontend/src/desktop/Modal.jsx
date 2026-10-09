import { useEffect, useRef } from 'react';
import { state } from '../shared/core.js';
import Icon from '../ui/Icon';
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
      <div className="mb-3 flex items-start justify-between gap-3">
        {title ? <h3 className="m-0 min-w-0 flex-1 text-lg font-semibold">{title}</h3> : <span className="flex-1" />}
        <button type="button" aria-label="Close" onClick={onClose} className="-mr-1 -mt-1 inline-grid h-8 w-8 flex-none place-items-center rounded-full border-0 bg-transparent text-ink-2 hover:bg-surface-2">
          <Icon name="x" />
        </button>
      </div>
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
