import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { assert, HttpError } from './validation.js';
import {
  IMAGE_EVENTS,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_JSON_BYTES,
  MAX_IMAGE_PIXELS,
  imagePaths,
} from './image-limits.js';

// Re-exported so existing importers keep working from one place.
export { IMAGE_EVENTS, MAX_IMAGE_BYTES, MAX_IMAGE_JSON_BYTES, MAX_IMAGE_PIXELS, imagePaths };

// Tuning is applied on first use rather than at module scope, so that merely
// importing this file does not execute native code.
let sharpTuned = false;
function tuneSharp() {
  if (sharpTuned) return;
  sharpTuned = true;
  sharp.cache({ memory: 16, files: 0, items: 16 });
  sharp.concurrency(1);
}
export const checksum = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function trackingReference(value) {
  assert(typeof value === 'string' && value.length <= 80, 'Enter a tracking reference.');
  const number = value.trim();
  assert(
    /^[a-zA-Z0-9 -]{4,40}$/.test(number) && /[a-zA-Z0-9]/.test(number),
    'Use a 4–40 character tracking reference with letters, numbers, spaces, or hyphens.',
  );
  return number;
}
export function imageEvent(value = 'default') {
  assert(IMAGE_EVENTS.includes(value), 'Choose a supported attachment category.');
  return value;
}
export function imageQuery(url) {
  assert(
    url.searchParams.getAll('number').length === 1 && url.searchParams.getAll('event').length <= 1,
    'Supply one reference and at most one category.',
  );
  return {
    number: trackingReference(url.searchParams.get('number')),
    event: imageEvent(url.searchParams.get('event') ?? undefined),
  };
}
export function decodeDataUrl(value) {
  assert(typeof value === 'string', 'Supply a JPG or PNG data URL.');
  assert(value.length <= MAX_IMAGE_JSON_BYTES, 'Choose an image up to 2 MB.', 413);
  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  assert(match, 'Only base64-encoded JPG and PNG images are supported.', 415);
  const encoded = match[2];
  assert(encoded.length > 0 && encoded.length % 4 === 0, 'The image contains invalid base64 data.');
  assert(encoded.length <= 4 * Math.ceil(MAX_IMAGE_BYTES / 3), 'Choose an image up to 2 MB.', 413);
  const bytes = Buffer.from(encoded, 'base64');
  assert(bytes.toString('base64') === encoded, 'The image contains invalid base64 data.');
  assert(
    bytes.length > 0 && bytes.length <= MAX_IMAGE_BYTES,
    'Choose a non-empty image up to 2 MB.',
    413,
  );
  return { bytes, mime: match[1] };
}
function signature(bytes, mime) {
  if (mime === 'image/png')
    return (
      bytes.length >= 24 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    );
  if (mime === 'image/jpeg')
    return bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return false;
}
function animatedPNG(bytes) {
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    if (length > bytes.length - offset - 12) return false; // Decoder rejects damaged chunks.
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'acTL') return true;
    if (type === 'IEND') return false;
    offset += length + 12;
  }
  return false;
}
const decoderOptions = {
  limitInputPixels: MAX_IMAGE_PIXELS,
  failOn: 'warning',
  sequentialRead: true,
};
async function inspect(bytes, mime) {
  assert(
    Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= MAX_IMAGE_BYTES,
    'The image exceeds the storage limits.',
    413,
  );
  assert(signature(bytes, mime), 'The image content does not match its JPG/PNG type.', 415);
  assert(
    mime !== 'image/png' || !animatedPNG(bytes),
    'Use a single-frame JPG or PNG, not an animation.',
    422,
  );
  tuneSharp();
  const metadata = await sharp(bytes, decoderOptions).metadata();
  assert(
    metadata.format === (mime === 'image/png' ? 'png' : 'jpeg'),
    'The image content does not match its declared type.',
    415,
  );
  assert(
    metadata.width > 0 &&
      metadata.height > 0 &&
      metadata.width <= 8192 &&
      metadata.height <= 8192 &&
      metadata.width * metadata.height <= MAX_IMAGE_PIXELS &&
      (metadata.pages || 1) === 1,
    'Resize the image to at most 16 megapixels and 8192 pixels per edge.',
    422,
  );
  return metadata;
}
export async function normalizeImage(input, mime) {
  const bytes = Buffer.from(input);
  try {
    await inspect(bytes, mime);
    tuneSharp();
    let pipeline = sharp(bytes, decoderOptions).rotate();
    pipeline =
      mime === 'image/png'
        ? pipeline.png({ compressionLevel: 9 })
        : pipeline.jpeg({ quality: 90, chromaSubsampling: '4:4:4' });
    // Re-encoding performs a full decode and strips EXIF/GPS, comments, profiles, and trailing data.
    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
    assert(
      data.length <= MAX_IMAGE_BYTES,
      'The processed image exceeds 2 MB. Resize it and try again.',
      413,
    );
    return { bytes: data, mime, width: info.width, height: info.height, sha256: checksum(data) };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      422,
      'The file could not be decoded safely. Use a complete JPG or PNG up to 16 megapixels.',
    );
  }
}
export async function storedImage(row) {
  const bytes = Buffer.from(row.image);
  assert(
    checksum(bytes) === row.sha256,
    'This attachment failed its integrity check. An administrator must replace it.',
    422,
  );
  try {
    await inspect(bytes, row.mime);
  } catch {
    throw new HttpError(
      422,
      'The stored attachment cannot be displayed safely. An administrator must replace it.',
    );
  }
  return bytes;
}
