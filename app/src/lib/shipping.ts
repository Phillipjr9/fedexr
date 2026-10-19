// Local prototype calculations only. These are not FedEx tariffs or quotes.
export const US_ZIP_PATTERN = /^\d{5}(?:-\d{4})?$/;
export const isUSZip = (value: string) => US_ZIP_PATTERN.test(value.trim());

export interface QuoteInput {
  from: string;
  to: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  shipDate: string;
}

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function quoteErrors(input: QuoteInput): Partial<Record<keyof QuoteInput, string>> {
  const errors: Partial<Record<keyof QuoteInput, string>> = {};
  if (!isUSZip(input.from)) errors.from = 'Enter a valid U.S. ZIP code (12345 or 12345-6789).';
  if (!isUSZip(input.to)) errors.to = 'Enter a valid U.S. ZIP code (12345 or 12345-6789).';
  const weight = Number(input.weight);
  if (!Number.isFinite(weight) || weight < 0.1 || weight > 150) {
    errors.weight = 'Enter a weight from 0.1 to 150 lb.';
  }
  const dimensions = ['length', 'width', 'height'] as const;
  if (dimensions.some((key) => input[key].trim() !== '')) {
    for (const key of dimensions) {
      const value = Number(input[key]);
      if (!Number.isFinite(value) || value < 0.1 || value > 108) {
        errors[key] = 'Enter all three dimensions, from 0.1 to 108 inches.';
      }
    }
  }
  const date = new Date(`${input.shipDate}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.shipDate) || !Number.isFinite(date.getTime()) || localDate(date) !== input.shipDate || input.shipDate < localDate()) {
    errors.shipDate = 'Choose today or a future date.';
  }
  return errors;
}

export const sampleServices = [
  { id: 'ground', name: 'FedEx Ground', description: 'A ground-shipping option for less time-sensitive packages.', base: 12.35, factor: 1 },
  { id: '2day', name: 'FedEx 2Day', description: 'Explore a two-business-day shipping service.', base: 28.5, factor: 1.5 },
  { id: 'standard', name: 'FedEx Standard Overnight', description: 'Explore an afternoon next-business-day service.', base: 52.75, factor: 2 },
  { id: 'priority', name: 'FedEx Priority Overnight', description: 'Explore an earlier next-business-day service.', base: 65.25, factor: 2.2 },
  { id: 'overnight', name: 'FedEx First Overnight', description: 'Explore an early-morning next-business-day service.', base: 95.5, factor: 2.5 },
  { id: 'sameday', name: 'FedEx SameDay', description: 'Explore a time-critical, same-day service.', base: 75, factor: 3 },
] as const;

export type SampleServiceId = typeof sampleServices[number]['id'];

export function isSampleService(value: string | null): value is SampleServiceId {
  return sampleServices.some((service) => service.id === value);
}

export function sampleBillableWeight(input: QuoteInput): number {
  const rawDimensional = Number(input.length) * Number(input.width) * Number(input.height) / 139;
  const dimensional = Number.isFinite(rawDimensional) ? rawDimensional : 0;
  const rawWeight = Number(input.weight);
  const weight = Number.isFinite(rawWeight) ? rawWeight : 1;
  return Math.ceil(Math.max(weight || 1, dimensional, 0.1) * 10) / 10;
}

export function estimateSampleRates(input: QuoteInput) {
  const billableWeight = sampleBillableWeight(input);
  // ZIP-prefix bands make the sample respond to input; they do not model real distance or zones.
  const rawBand = Math.abs(Number(input.from.slice(0, 2)) - Number(input.to.slice(0, 2))) / 10;
  const zipBand = Number.isFinite(rawBand) ? Math.min(6, rawBand) : 0;
  return sampleServices.map((service) => ({
    ...service,
    price: Math.round((service.base + Math.max(0, billableWeight - 1) * 0.85 * service.factor + zipBand * 2 * service.factor) * 100) / 100,
  }));
}

export const formatUSD = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

export function readQuoteParams(params: URLSearchParams): QuoteInput {
  return {
    from: (params.get('from') || '').slice(0, 10),
    to: (params.get('to') || '').slice(0, 10),
    weight: (params.get('weight') || '').slice(0, 12),
    length: (params.get('length') || '').slice(0, 12),
    width: (params.get('width') || '').slice(0, 12),
    height: (params.get('height') || '').slice(0, 12),
    shipDate: params.get('date') || localDate(),
  };
}

export function quoteParams(input: QuoteInput, service?: SampleServiceId): URLSearchParams {
  const params = new URLSearchParams({ from: input.from.trim(), to: input.to.trim(), weight: input.weight, date: input.shipDate });
  for (const key of ['length', 'width', 'height'] as const) {
    if (input[key]) params.set(key, input[key]);
  }
  if (service) params.set('service', service);
  return params;
}
