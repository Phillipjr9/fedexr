import { siteImages } from '@/lib/siteAssets';

export const officialSuppliesShop = 'https://www.office.fedex.com/default/shipping-packing-mailing-supplies';
export const officialExpressSupplies = 'https://www.fedex.com/secure-login/en-us/#/login-credentials?redirectUrl=https:%2F%2Fwww.fedex.com%2Fordersupplies%2Fwols.do%3Fmethod%3DinitOrderSupplies%26locale%3Den_US';
export const SUPPLY_LIST_KEY = 'fedexr:supply-list:v1';
export const MAX_SUPPLY_QUANTITY = 99;

export const supplyCategories = [
  { id: 'boxes', label: 'Boxes' },
  { id: 'mailers', label: 'Mailers & paks' },
  { id: 'packing', label: 'Packing supplies & help' },
] as const;
export type SupplyCategory = typeof supplyCategories[number]['id'];

// Verified product/category examples, not live inventory, prices, sizes, or order minimums.
export const supplyProducts = [
  {
    id: 'self-sealing-boxes', name: 'Custom self-sealing boxes', category: 'boxes',
    description: 'Explore Snap2Pack custom boxes with an adhesive strip and tear-away opening. These are not complimentary FedEx Express boxes.',
    image: siteImages.customSelfSealingBox, imageFit: 'contain', unit: 'boxes', note: 'Custom packaging · confirm pricing online',
    keywords: 'snap2pack returnable shipping carton branded custom box',
    url: 'https://www.office.fedex.com/default/custom-self-sealing-boxes.html',
  },
  {
    id: 'padded-pak', name: 'FedEx Reusable Padded Pak', category: 'mailers',
    description: 'Explore reusable FedEx packaging for qualifying services. Confirm eligibility and available options with your FedEx account.',
    image: siteImages.packaging, imageFit: 'contain', unit: 'paks', note: 'Qualifying services and account required',
    keywords: 'express envelope padded reusable pak packaging',
    url: 'https://www.fedex.com/en-us/shipping/packing/supplies/sustainable-packaging.html',
  },
  {
    id: 'padded-mailers', name: 'Custom recyclable padded mailers', category: 'mailers',
    description: 'Paper-based padded mailers for suitable non-breakable items. Review the actual sizes, artwork requirements, and quantities online.',
    image: siteImages.customPaddedMailers, imageFit: 'contain', unit: 'mailers', note: 'Custom packaging · confirm pricing online',
    keywords: 'kraft paper envelope padded recyclable custom mailer',
    url: 'https://www.office.fedex.com/default/custom-recyclable-padded-mailers.html',
  },
  {
    id: 'rigid-mailers', name: 'Custom rigid mailers', category: 'mailers',
    description: 'Explore bend-resistant kraft mailers for documents and flat products. Production options are confirmed by the supplier.',
    image: siteImages.customRigidMailers, imageFit: 'cover', unit: 'mailers', note: 'Custom packaging · confirm pricing online',
    keywords: 'flat document envelope paperboard rigid custom mailer',
    url: 'https://www.office.fedex.com/default/custom-rigid-mailers.html',
  },
  {
    id: 'packing-supplies', name: 'Tape & cushioning supplies', category: 'packing',
    description: 'Plan the tape, cushioning, and other materials your packages need. The photograph illustrates packing, not an exact retail kit.',
    image: siteImages.officePacking, imageFit: 'cover', unit: 'packing sets to review', note: 'Category example · select actual supplies online',
    keywords: 'tape bubble wrap cushioning packing peanuts labels supplies kit',
    url: officialSuppliesShop,
  },
  {
    id: 'specialty-packing', name: 'Specialty packing assistance', category: 'packing',
    description: 'Discuss fragile, valuable, or unusually shaped items with a packing specialist. Adding this to a list does not reserve a service.',
    image: siteImages.officeLocation, imageFit: 'cover', unit: 'items to discuss', note: 'Service planning · no appointment is reserved',
    keywords: 'art artwork fragile specialty packing professional help',
    url: 'https://local.fedex.com/en/packing-services',
  },
] as const;

export type SupplyId = typeof supplyProducts[number]['id'];
export interface SupplySelection { id: SupplyId; quantity: number }

export function validSupplyQuantity(value: string | number): boolean {
  const amount = Number(value);
  return Number.isInteger(amount) && amount >= 1 && amount <= MAX_SUPPLY_QUANTITY;
}

export function restoreSupplyList(): SupplySelection[] {
  try {
    const raw = window.localStorage.getItem(SUPPLY_LIST_KEY);
    if (!raw || raw.length > 20000) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    const record = parsed as Record<string, unknown>;
    if (record.version !== 1 || !Array.isArray(record.items)) return [];
    const restored = new Map<SupplyId, number>();
    for (const value of record.items) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const item = value as Record<string, unknown>;
      const product = supplyProducts.find((entry) => entry.id === item.id);
      if (!product || typeof item.quantity !== 'number' || !validSupplyQuantity(item.quantity)) continue;
      restored.set(product.id, Math.min(MAX_SUPPLY_QUANTITY, (restored.get(product.id) || 0) + item.quantity));
    }
    return [...restored].map(([id, quantity]) => ({ id, quantity }));
  } catch {
    return [];
  }
}

export function saveSupplyList(items: SupplySelection[]): boolean {
  try {
    if (items.length === 0) window.localStorage.removeItem(SUPPLY_LIST_KEY);
    else window.localStorage.setItem(SUPPLY_LIST_KEY, JSON.stringify({ version: 1, items }));
    return true;
  } catch {
    return false;
  }
}

export function filterSupplies(query: string, category: SupplyCategory | 'all') {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return supplyProducts.filter((product) => {
    const text = `${product.name} ${product.description} ${product.keywords}`.toLowerCase();
    return (category === 'all' || category === product.category) && words.every((word) => text.includes(word));
  });
}

export function supplyListText(items: SupplySelection[]): string {
  return [
    'SUPPLY PLANNING LIST',
    'This list is not an order, price quote, or inventory reservation.',
    'Quantities are planning preferences, not actual supplier minimums or available stock.',
    '',
    ...items.flatMap((item) => {
      const product = supplyProducts.find((entry) => entry.id === item.id);
      return product ? [`${product.name}: ${item.quantity} ${product.unit}`, `Options: ${product.url}`, ''] : [];
    }),
    'Check actual sizes, eligibility, order quantities, prices, and availability on the supplier websites.',
    'This list is not transferred automatically. No payment or order has been processed.',
  ].join('\n');
}
