// The composer's "+" attachment button (WhatsApp-style): opens a small menu of attachment
// kinds. File-backed kinds (Document / Photos & Videos / Audio) trigger a hidden
// <input type="file">; the rest (Camera / Contact / Poll) just tell the composer which
// quick form/capture UI to open. Nothing here uploads anywhere - it only hands a File/kind back
// up. Camera is handled as an action (not a file input): the `capture` attribute on a file
// input only opens a real camera on mobile browsers - on desktop it just falls back to a plain
// file picker, which isn't "Camera" - so desktop gets a real live-preview capture (see
// CameraCapture.jsx) instead.
import { useEffect, useRef, useState } from 'react';
import { Btn } from '../../ui/ui';
import Icon from '../../ui/Icon';

const FILE_ITEMS = [
  { kind: 'document', label: 'Document', icon: 'file', accept: '*/*' },
  { kind: 'media', label: 'Photos & Videos', icon: 'photos', accept: 'image/*,video/*' },
  { kind: 'audio', label: 'Audio', icon: 'mic', accept: 'audio/*' },
];
const ACTION_ITEMS = [
  { kind: 'camera', label: 'Camera', icon: 'camera' },
  { kind: 'contact', label: 'Contact', icon: 'people' },
  { kind: 'poll', label: 'Poll', icon: 'checkcheck' },
];

export default function AttachMenu({ onPickFile, onPickAction }) {
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
      {open && (
        <div
          role="menu"
          aria-label="Attach"
          className="absolute bottom-full left-0 z-10 mb-2 w-56 rounded-r2 border border-line bg-surface p-1 shadow-s2"
        >
          {FILE_ITEMS.map((item) => (
            <button
              key={item.kind}
              type="button"
              role="menuitem"
              onClick={() => pickFile(item)}
              className="flex min-h-10 w-full items-center gap-2.5 rounded-r1 border-0 bg-transparent px-2.5 text-left text-ink hover:bg-surface-2"
            >
              <Icon name={item.icon} small /> {item.label}
            </button>
          ))}
          {ACTION_ITEMS.map((item) => (
            <button
              key={item.kind}
              type="button"
              role="menuitem"
              onClick={() => { onPickAction(item.kind); setOpen(false); }}
              className="flex min-h-10 w-full items-center gap-2.5 rounded-r1 border-0 bg-transparent px-2.5 text-left text-ink hover:bg-surface-2"
            >
              <Icon name={item.icon} small /> {item.label}
            </button>
          ))}
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
