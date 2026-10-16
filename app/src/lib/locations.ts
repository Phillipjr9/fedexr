// Curated examples, not a live/complete/nearest-location feed.
// Addresses and phone numbers reviewed in the official directory on October 13, 2026.
export const officialLocationDirectory = 'https://local.fedex.com/en/search';

export type LocationType = 'office' | 'ship-center' | 'retail';
export const locationTypes: { id: LocationType; label: string }[] = [
  { id: 'office', label: 'FedEx Office' },
  { id: 'ship-center', label: 'FedEx Ship Center' },
  { id: 'retail', label: 'Retail partners' },
];

export interface VerifiedLocation {
  id: string;
  name: string;
  type: LocationType;
  address: string;
  zip: string;
  phone: string;
  phoneDisplay: string;
  aliases: string;
  url: string;
  directions?: string;
}

export const verifiedLocations: VerifiedLocation[] = [
  {
    id: 'office-4483', name: 'FedEx Office Print & Ship Center', type: 'office',
    address: '10 Union Sq E, Suite 108', zip: '10003', phone: '+12123533860', phoneDisplay: '(212) 353-3860', aliases: 'Union Square',
    url: 'https://local.fedex.com/en-us/ny/new-york/office-4483',
    directions: 'https://maps.google.com/maps?cid=9306430979333423787',
  },
  {
    id: 'office-0346', name: 'FedEx Office Print & Ship Center', type: 'office',
    address: '100 Wall St', zip: '10005', phone: '+12122690024', phoneDisplay: '(212) 269-0024', aliases: 'Wall Street Financial District',
    url: 'https://local.fedex.com/en-us/ny/new-york/office-0346',
    directions: 'https://maps.google.com/maps?cid=17232689107712941612',
  },
  {
    id: 'wtca', name: 'FedEx Ship Center', type: 'ship-center',
    address: '130 Leroy St', zip: '10014', phone: '+18004633339', phoneDisplay: '(800) 463-3339', aliases: 'Leroy Street',
    url: 'https://local.fedex.com/en-us/ny/new-york/wtca',
    directions: 'https://maps.google.com/maps?cid=7859963718619434434',
  },
  {
    id: 'tssac', name: 'FedEx at Walgreens', type: 'retail',
    address: '1 Penn Plaza', zip: '10119', phone: '+18004633339', phoneDisplay: '(800) 463-3339', aliases: 'Penn Station Pennsylvania Plaza',
    url: 'https://local.fedex.com/en-us/ny/new-york/tssac',
  },
  {
    id: 'office-2936', name: 'FedEx Office Print & Ship Center', type: 'office',
    address: '127 E 59th St', zip: '10022', phone: '+13322407008', phoneDisplay: '(332) 240-7008', aliases: 'East 59th Street',
    url: 'https://local.fedex.com/en-us/ny/new-york/office-2936',
  },
];

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function filterLocations(query: string, type: LocationType | 'all') {
  const tokens = normalized(query).split(' ').filter(Boolean);
  return verifiedLocations.filter((location) => {
    const searchable = normalized(`${location.name} ${location.address} ${location.zip} ${location.aliases} New York NY NYC Manhattan`);
    return (type === 'all' || location.type === type) && tokens.every((token) => searchable.includes(token));
  });
}
