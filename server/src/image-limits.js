/**
 * Image limits and route names, with no dependencies at all.
 *
 * These constants used to live in image-data.js next to the sharp import, and
 * image-data.js tuned sharp at module scope. Because http.js needs
 * MAX_IMAGE_JSON_BYTES for request body limits, and http.js backs every route,
 * that made the entire API depend on a native image binary loading during
 * function initialization — a single constant put sharp in the module graph of
 * routes that never touch an image.
 *
 * Keeping the values here means only the image routes import sharp.
 */

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_JSON_BYTES = 4 * Math.ceil(MAX_IMAGE_BYTES / 3) + 8192;
export const MAX_IMAGE_PIXELS = 16_000_000;
export const IMAGE_EVENTS = ['default', 'in_transit', 'delivered', 'other'];
export const imagePaths = new Set(['/api/upload-tracking-image', '/api/get-tracking-image']);
