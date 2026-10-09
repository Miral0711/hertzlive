// The composer's "+" attachment button (WhatsApp-style): opens a small menu of attachment
// kinds. File-backed kinds (Document / Photos & Videos / Audio) trigger a hidden
// <input type="file">; the rest (Camera / Contact / Poll) just tell the composer which
// quick form/capture UI to open. Nothing here uploads anywhere - it only hands a File/kind back
// up. Camera is handled as an action (not a file input): the `capture` attribute on a file
// input only opens a real camera on mobile browsers - on desktop it just falls back to a plain
// file picker, which isn't "Camera" - so desktop gets a real live-preview capture (see
// CameraCapture.jsx) instead.
import { useEffect, useRef, useState } from 'react';
import { state } from '../../shared/core.js';
import { Btn } from '../../ui/ui';
import Icon from '../../ui/Icon';

const FILE_ITEMS = [
  { kind: 'document', label: 'Document', icon: 'file', accept: '*/*' },
  { kind: 'media', label: 'Photos & Videos', icon: 'photos', accept: 'image/*,video/*' },
  { kind: 'audio', label: 'Audio', icon: 'mic', accept: 'audio/*' },
];
const ACTION_ITEMS = [
  { kind: 'camera', label: 'Camera', icon: 'camera' },
  { kind: 'voice', label: 'Voice note', icon: 'mic' },
  { kind: 'contact', label: 'Contact', icon: 'people' },
  { kind: 'poll', label: 'Poll', icon: 'checkcheck' },
];
const SITE_ITEMS = [
  { kind: 'site:photo', label: 'Photo', icon: 'photos' },
  { kind: 'site:drawing', label: 'Drawing', icon: 'drawing' },
  { kind: 'site:delivery', label: 'Delivery', icon: 'delivery' },
  { kind: 'site:sample', label: 'Sample', icon: 'sample' },
  { kind: 'site:location', label: 'Location', icon: 'location' },
  { kind: 'site:bill', label: 'Bill / expense', icon: 'bill' },
  { kind: 'site:material', label: 'Material request', icon: 'delivery', roles: ['site_manager', 'contractor', 'partner', 'designer'] },
  { kind: 'site:attendance', label: 'Attendance', icon: 'people', roles: ['site_manager', 'contractor'] },
  { kind: 'site:file', label: 'File', icon: 'file' },
  { kind: 'site:checkin', label: 'Check in', icon: 'today', roles: ['site_manager', 'contractor'] },
  { kind: 'site:daylog', label: "Today's log", icon: 'today', roles: ['site_manager', 'partner', 'designer'] },
];

export default function AttachMenu({ onPickFile, onPickAction, bare = false }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const inputRef = useRef(null);
  const pendingKind = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pickFile = (item) => {
    pendingKind.current = item.kind;
    const el = inputRef.current;
    el.accept = item.accept;
    el.value = '';
    el.click();
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      {bare ? (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Attach"
          className="inline-grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-ink-3 hover:text-ink"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="clip" />
        </button>
      ) : (
        <Btn
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Attach"
          className="!min-h-10 !px-2.5"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="clip" />
        </Btn>
      )}
      {open && (
        <div
          role="menu"
          aria-label="Attach"
          className="absolute bottom-full left-0 z-10 mb-2 max-h-96 w-72 overflow-auto rounded-r2 border border-line bg-surface p-3 shadow-s2"
        >
          <p className="mb-2 text-center text-sm font-semibold">Add to this chat</p>
          <div className="grid grid-cols-3 gap-2">
            {[...FILE_ITEMS, ...ACTION_ITEMS].map((item) => (
              <button
                key={item.kind}
                type="button"
                role="menuitem"
                onClick={() => (item.accept ? pickFile(item) : (onPickAction(item.kind), setOpen(false)))}
                className="flex flex-col items-center gap-1 rounded-r1 border-0 bg-transparent px-1 py-2 text-center text-[12px] font-semibold text-ink-2 hover:bg-surface-2"
              >
                <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent-text"><Icon name={item.icon} /></span>
                {item.label}
              </button>
            ))}
          </div>
          <p className="mb-2 mt-3 text-center text-sm font-semibold">More site updates</p>
          <div className="grid grid-cols-3 gap-2">
            {SITE_ITEMS.filter((item) => !item.roles || item.roles.includes(state.role)).map((item) => (
              <button
                key={item.kind}
                type="button"
                role="menuitem"
                onClick={() => { onPickAction(item.kind); setOpen(false); }}
                className="flex flex-col items-center gap-1 rounded-r1 border-0 bg-transparent px-1 py-2 text-center text-[12px] font-semibold text-ink-2 hover:bg-surface-2"
              >
                <span className="grid h-12 w-12 place-items-center rounded-full bg-accent-soft text-accent-text"><Icon name={item.icon} /></span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const kind = pendingKind.current;
          pendingKind.current = null;
          if (file && kind) onPickFile(kind, file);
        }}
      />
    </div>
  );
}
