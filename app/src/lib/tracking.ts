export type AttachmentCategory = 'default' | 'in_transit' | 'delivered' | 'other';
export const attachmentCategory = (value: string | null): AttachmentCategory =>
  ['in_transit', 'delivered', 'other'].includes(value || '')
    ? (value as AttachmentCategory)
    : 'default';

export function officialTrackingURL(number: string) {
  return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(number.trim())}`;
}
