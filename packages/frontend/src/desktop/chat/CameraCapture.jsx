// Live in-browser camera capture for the composer's "Camera" option. A plain
// <input type="file" capture> only opens a real camera on mobile browsers; on desktop it just
// falls back to a generic file picker, which isn't "Camera". This opens the device's camera via
// getUserMedia, shows a live preview, and snapshots a frame to a File on "Capture" - which then
// flows into the same MediaEditor used by Photos & Videos, so a captured site photo can be
// annotated before sending. Falls back to a plain photo picker if the camera can't be reached
// (denied permission, no camera, unsupported browser).
import { useEffect, useRef, useState } from 'react';
import { Btn } from '../../ui/ui';
import Modal, { ModalActions } from '../Modal';

export default function CameraCapture({ onCancel, onCapture }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't open the camera here. You can choose a photo instead.");
      return undefined;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setReady(true);
      })
      .catch(() => setError("Couldn't access the camera. You can choose a photo instead."));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.92);
  };

  return (
    <Modal title="Camera" onClose={onCancel}>
      {error ? (
        <div className="flex flex-col items-start gap-2.5">
          <p className="text-ink-2">{error}</p>
          <Btn onClick={() => fileInputRef.current?.click()}>Choose a photo instead</Btn>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onCapture(f); }}
          />
        </div>
      ) : (
        // bg-black is the same intentional video-letterbox exception as elsewhere in chat.
        <video ref={videoRef} autoPlay playsInline muted className="max-h-[55vh] w-full rounded-r1 bg-black" />
      )}
      <ModalActions>
        <Btn onClick={onCancel}>Cancel</Btn>
        {!error && <Btn kind="primary" onClick={capture} disabled={!ready}>Capture</Btn>}
      </ModalActions>
    </Modal>
  );
}
