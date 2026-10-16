import type { AddressInput } from './workspace';

/**
 * Free, fully local sample-address generation. No external API is called and
 * no real person's address is produced: streets are invented from common
 * street names and paired with real city/state/ZIP-prefix combinations so the
 * results look plausible for testing routes. Generated addresses are samples
 * for this workspace only — they are not verified or deliverable addresses.
 */
export const SAMPLE_ADDRESS_NOTICE =
  'Sample address generated locally in this workspace. It is not a verified or deliverable address — edit it before relying on it.';

interface SamplePlace {
  city: string;
  region: string;
  postalPrefix: string;
}

const places: SamplePlace[] = [
  { city: 'New York', region: 'NY', postalPrefix: '100' },
  { city: 'Los Angeles', region: 'CA', postalPrefix: '900' },
  { city: 'Chicago', region: 'IL', postalPrefix: '606' },
  { city: 'Houston', region: 'TX', postalPrefix: '770' },
  { city: 'Phoenix', region: 'AZ', postalPrefix: '850' },
  { city: 'Philadelphia', region: 'PA', postalPrefix: '191' },
  { city: 'San Antonio', region: 'TX', postalPrefix: '782' },
  { city: 'San Diego', region: 'CA', postalPrefix: '921' },
  { city: 'Dallas', region: 'TX', postalPrefix: '752' },
  { city: 'Austin', region: 'TX', postalPrefix: '733' },
  { city: 'Jacksonville', region: 'FL', postalPrefix: '322' },
  { city: 'Columbus', region: 'OH', postalPrefix: '432' },
  { city: 'Charlotte', region: 'NC', postalPrefix: '282' },
  { city: 'Indianapolis', region: 'IN', postalPrefix: '462' },
  { city: 'San Francisco', region: 'CA', postalPrefix: '941' },
  { city: 'Seattle', region: 'WA', postalPrefix: '981' },
  { city: 'Denver', region: 'CO', postalPrefix: '802' },
  { city: 'Nashville', region: 'TN', postalPrefix: '372' },
  { city: 'Boston', region: 'MA', postalPrefix: '021' },
  { city: 'Las Vegas', region: 'NV', postalPrefix: '891' },
  { city: 'Portland', region: 'OR', postalPrefix: '972' },
  { city: 'Memphis', region: 'TN', postalPrefix: '381' },
  { city: 'Louisville', region: 'KY', postalPrefix: '402' },
  { city: 'Atlanta', region: 'GA', postalPrefix: '303' },
  { city: 'Miami', region: 'FL', postalPrefix: '331' },
  { city: 'Minneapolis', region: 'MN', postalPrefix: '554' },
  { city: 'Cleveland', region: 'OH', postalPrefix: '441' },
  { city: 'Tampa', region: 'FL', postalPrefix: '336' },
  { city: 'Sacramento', region: 'CA', postalPrefix: '958' },
  { city: 'Kansas City', region: 'MO', postalPrefix: '641' },
];

const streetNames = [
  'Main', 'Oak', 'Maple', 'Cedar', 'Pine', 'Elm', 'Washington', 'Lincoln',
  'Park', 'Hill', 'River', 'Sunset', 'Highland', 'Willow', 'Birch', 'Walnut',
  'Chestnut', 'Franklin', 'Madison', 'Jefferson', 'Monroe', 'Adams', 'Liberty',
  'Garden', 'Meadow', 'Summit', 'Valley', 'Forest', 'Lake', 'Spring',
];
const streetSuffixes = ['St', 'Ave', 'Blvd', 'Dr', 'Ln', 'Rd', 'Way', 'Ct', 'Pl'];
const firstNames = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Robin',
  'Sam', 'Chris', 'Pat', 'Dana', 'Lee', 'Kim', 'Jo', 'Nico', 'Avery', 'Quinn',
];
const lastNames = [
  'Sample', 'Example', 'Tester', 'Demo', 'Rivera', 'Chen', 'Novak', 'Garcia',
  'Haddad', 'Osei', 'Murphy', 'Larsen', 'Petrov', 'Nguyen', 'Fischer', 'Ali',
];
const labelWords = ['Home', 'Office', 'Warehouse', 'Depot', 'Store', 'Studio', 'Lab', 'HQ'];

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}
function numberBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function samplePlace(): SamplePlace {
  return pick(places);
}

function postalCodeFor(place: SamplePlace) {
  return `${place.postalPrefix}${String(numberBetween(1, 98)).padStart(2, '0')}`;
}

function streetFor() {
  const base = `${numberBetween(12, 9899)} ${pick(streetNames)} ${pick(streetSuffixes)}`;
  return Math.random() < 0.3
    ? `${base}, ${pick(['Apt', 'Suite', 'Unit'])} ${numberBetween(2, 640)}`
    : base;
}

/** Generate one sample address in the workspace address-book format. */
export function generateSampleAddress(): AddressInput {
  const place = samplePlace();
  return {
    label: `${pick(labelWords)} — ${place.city}`,
    name: `${pick(firstNames)} ${pick(lastNames)}`,
    street: streetFor(),
    city: place.city,
    region: place.region,
    postalCode: postalCodeFor(place),
    country: 'United States',
    isDefault: false,
  };
}

export interface GeneratedRoute {
  recipientName: string;
  origin: { city: string; region: string; postalCode: string };
  destination: { city: string; region: string; postalCode: string };
  originStreet: string;
  destinationStreet: string;
}

/** Generate a sample origin → destination pair in two different cities. */
export function generateRouteAddresses(): GeneratedRoute {
  const originPlace = samplePlace();
  let destinationPlace = samplePlace();
  while (destinationPlace.city === originPlace.city) destinationPlace = samplePlace();
  return {
    recipientName: `${pick(firstNames)} ${pick(lastNames)}`,
    origin: {
      city: originPlace.city,
      region: originPlace.region,
      postalCode: postalCodeFor(originPlace),
    },
    destination: {
      city: destinationPlace.city,
      region: destinationPlace.region,
      postalCode: postalCodeFor(destinationPlace),
    },
    originStreet: streetFor(),
    destinationStreet: streetFor(),
  };
}
