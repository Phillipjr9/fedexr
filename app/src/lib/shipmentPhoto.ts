const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 1280;
const MAX_DATA_URL_LENGTH = 390_000;

/**
 * Reads an admin-selected image and returns a compressed JPEG data URL that is
 * safe to store on a public shipment event. The photo is intentionally public
 * once saved, so it must never contain anything the administrator would not
 * show to anyone holding the tracking number.
 */
export async function fileToShipmentPhoto(file: File): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type))
    throw new Error('Choose a JPG, PNG, or WebP image.');
  if (file.size === 0) throw new Error('That image file is empty.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('Choose an image up to 8 MB.');

  const source = await loadImage(file);
  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(source.width, source.height),
  );
  let width = Math.max(1, Math.round(source.width * scale));
  let height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not prepare the image.');

  let quality = 0.82;
  let dataUrl = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    canvas.width = width;
    canvas.height = height;
    context.drawImage(source.image, 0, 0, width, height);
    dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_DATA_URL_LENGTH) return dataUrl;
    quality -= 0.12;
    if (quality < 0.45) {
      width = Math.max(1, Math.round(width * 0.75));
      height = Math.max(1, Math.round(height * 0.75));
      quality = 0.7;
    }
  }
  throw new Error('That image is too detailed to store. Try a smaller or simpler photo.');
}

async function loadImage(
  file: File,
): Promise<{ image: CanvasImageSource; width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { image: bitmap, width: bitmap.width, height: bitmap.height };
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('The selected image could not be read.'));
      element.src = url;
    });
    return { image, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}
