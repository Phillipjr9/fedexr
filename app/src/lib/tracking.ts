export type AttachmentCategory = 'default' | 'in_transit' | 'delivered' | 'other';
export const attachmentCategory = (value: string | null): AttachmentCategory =>
  ['in_transit', 'delivered', 'other'].includes(value || '')
    ? (value as AttachmentCategory)
    : 'default';

export function officialTrackingURL(number: string) {
  return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(number.trim())}`;
}

/**
 * Where a delivery happened, as a map query.
 *
 * Public tracking exposes the destination city, region, and ZIP only, never a
 * street address, so this is a view of the delivery area rather than of a
 * doorstep. Deriving it from fields already published means no geocoder, no
 * coordinate table, and no request carrying a recipient's address.
 */
export function deliveryMapQuery(shipment: {
  destinationCity: string;
  destinationRegion: string;
  destinationPostalCode?: string | null;
}) {
  const city = (shipment.destinationCity || '').trim();
  const region = (shipment.destinationRegion || '').trim();
  const postal = (shipment.destinationPostalCode || '').trim();
  const place = [city, region].filter(Boolean).join(', ');
  return [place, postal].filter(Boolean).join(' ');
}

/**
 * A Google Map of that query, as an embeddable URL, pinned at the queried place.
 *
 * Two forms, because only one of them needs a key:
 *
 * - With VITE_GOOGLE_MAPS_API_KEY, the supported Maps Embed API. Use this in
 *   production: it is documented, its quotas are visible, and it will not
 *   change shape without notice. The key is a browser key, so restrict it to
 *   this origin in Google Cloud before shipping it.
 * - Without a key, Google's public embed endpoint, which has answered
 *   `output=embed` since 2014 and costs nothing. It is not a documented API, so
 *   it can render an error or a consent interstitial without warning — the
 *   "Open in Google Maps" link beside the map covers exactly that case.
 */
export function deliveryMapEmbed(query: string, apiKey?: string, zoom?: number) {
  const key = (apiKey || '').trim();
  // Street-level when the recorded place carries a ZIP, city-level when it does
  // not, so the pin reads as the place itself rather than a wide area.
  const level = zoom ?? (/\d{5}/.test(query) ? 15 : 12);
  return key
    ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}`
    : `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=${level}&output=embed`;
}

/** The documented "open in Maps" URL, for when the embed does not render. */
export function deliveryMapLink(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
