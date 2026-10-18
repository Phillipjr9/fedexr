import type { AddressInput } from './workspace';
import { US_PLACES, type UsPlace } from './usPlaces';

/**
 * Free, fully local address filling.
 *
 * No geocoding provider, no API key, and no network request — the city / state /
 * ZIP data is bundled in `@/lib/usPlaces`, so both the one-click route and the
 * address autocomplete cost nothing to run.
 *
 * Cities, states and ZIPs come from the bundled real dataset. Street lines are
 * invented locally (no real resident's address is ever reproduced), so any
 * generated street is a placeholder to edit before it is used.
 */
export const SAMPLE_ADDRESS_NOTICE =
  'Filled in locally for free from the bundled city list. The city, state and ZIP are real; the street line is a placeholder — replace it with the actual street address.';

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
  'Sample', 'Example', 'Tester', 'Rivera', 'Chen', 'Novak', 'Garcia',
  'Haddad', 'Osei', 'Murphy', 'Larsen', 'Petrov', 'Nguyen', 'Fischer', 'Ali',
];
const labelWords = ['Home', 'Office', 'Warehouse', 'Depot', 'Store', 'Studio', 'Lab', 'HQ'];

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function numberBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPlace(): UsPlace {
  return pick(US_PLACES);
}

function streetFor() {
  const base = `${numberBetween(12, 9899)} ${pick(streetNames)} ${pick(streetSuffixes)}`;
  return Math.random() < 0.3
    ? `${base}, ${pick(['Apt', 'Suite', 'Unit'])} ${numberBetween(2, 640)}`
    : base;
}

/** Generate one address-book entry: real city / state / ZIP, placeholder street. */
export function generateSampleAddress(): AddressInput {
  const place = randomPlace();
  return {
    label: `${pick(labelWords)} — ${place.city}`,
    name: `${pick(firstNames)} ${pick(lastNames)}`,
    street: streetFor(),
    city: place.city,
    region: place.region,
    postalCode: place.postalCode,
    country: place.country,
    isDefault: false,
  };
}

export interface GeneratedRoute {
  recipientName: string;
  origin: { city: string; region: string; postalCode: string; country: string };
  destination: { city: string; region: string; postalCode: string; country: string };
  originStreet: string;
  destinationStreet: string;
  /** Approximate road miles between the two ZIP areas, for a distance readout. */
  distanceMiles: number;
}

/**
 * Auto-fill a shipping route: two different real places from the bundled list,
 * plus placeholder street lines. Runs entirely in the browser — free.
 */
export function generateRouteAddresses(): GeneratedRoute {
  const origin = randomPlace();
  let destination = randomPlace();
  // Avoid a same-city route, and give the pair a little separation so the
  // route reads like a real shipment rather than a local drop.
  let attempts = 0;
  while (
    attempts < 24 &&
    (destination.postalCode === origin.postalCode ||
      destination.region === origin.region ||
      !statesFarEnough(origin.region, destination.region))
  ) {
    destination = randomPlace();
    attempts += 1;
  }
  return {
    recipientName: `${pick(firstNames)} ${pick(lastNames)}`,
    origin: {
      city: origin.city,
      region: origin.region,
      postalCode: origin.postalCode,
      country: origin.country,
    },
    destination: {
      city: destination.city,
      region: destination.region,
      postalCode: destination.postalCode,
      country: destination.country,
    },
    originStreet: streetFor(),
    destinationStreet: streetFor(),
    distanceMiles: estimateDistanceMiles(origin, destination),
  };
}

/** Coarse region groupings used only to keep auto routes cross-country. */
const REGION_GROUPS: Record<string, string> = {
  CT: 'northeast', ME: 'northeast', MA: 'northeast', NH: 'northeast', RI: 'northeast', VT: 'northeast',
  NJ: 'northeast', NY: 'northeast', PA: 'northeast',
  DE: 'mid-atlantic', MD: 'mid-atlantic', DC: 'mid-atlantic', VA: 'mid-atlantic', WV: 'mid-atlantic',
  NC: 'southeast', SC: 'southeast', GA: 'southeast', FL: 'southeast', AL: 'southeast',
  MS: 'southeast', TN: 'southeast', KY: 'southeast', LA: 'southeast', AR: 'southeast',
  IL: 'midwest', IN: 'midwest', MI: 'midwest', OH: 'midwest', WI: 'midwest',
  IA: 'midwest', KS: 'midwest', MN: 'midwest', MO: 'midwest', NE: 'midwest', ND: 'midwest', SD: 'midwest',
  AZ: 'southwest', NM: 'southwest', OK: 'southwest', TX: 'southwest',
  CO: 'mountain', ID: 'mountain', MT: 'mountain', UT: 'mountain', WY: 'mountain', NV: 'mountain',
  AK: 'west', CA: 'west', HI: 'west', OR: 'west', WA: 'west',
};

function statesFarEnough(a: string, b: string) {
  const groupA = REGION_GROUPS[a] ?? a;
  const groupB = REGION_GROUPS[b] ?? b;
  return groupA !== groupB;
}

/**
 * Very rough mileage from the two ZIPs' numeric prefixes. This is a planning
 * figure for the route card only — it is not a carrier quote or a real
 * road distance, and it is never shown as a price.
 */
function estimateDistanceMiles(origin: UsPlace, destination: UsPlace) {
  const zipA = Number(origin.postalCode.slice(0, 3));
  const zipB = Number(destination.postalCode.slice(0, 3));
  if (Number.isNaN(zipA) || Number.isNaN(zipB)) return 0;
  const spread = Math.abs(zipA - zipB);
  return Math.min(3200, Math.round(spread * 3.4 + 180));
}
