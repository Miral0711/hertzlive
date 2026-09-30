// Small client-side file/image helpers shared by the attachment menu and the image editor.
// No upload happens here - everything stays in the browser (data URLs / object URLs), the
// same "frontend-only prototype" trade-off the rest of the chat data model already makes.

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error('Could not read file'));
    r.readAsDataURL(file);
  });
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });
}

// Re-encodes an image data URL so it doesn't blow past localStorage quota: caps the long
// edge at maxDim and re-compresses as JPEG. Returns { dataUrl, w, h }.
export async function downscaleImage(dataUrl, maxDim = 1600, quality = 0.85) {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return { dataUrl: c.toDataURL('image/jpeg', quality), w, h };
}

export const fmtBytes = (n) => {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};
