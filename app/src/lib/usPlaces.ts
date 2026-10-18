/**
 * Free, bundled US city / state / ZIP dataset.
 *
 * Everything here ships inside the app bundle, so address autocomplete and
 * route generation cost nothing to run: no geocoding API, no API key, no
 * network request, and no per-lookup billing. It also keeps working offline.
 *
 * Cities, states and ZIP prefixes are real; the ZIP shown is a representative
 * downtown ZIP for that city. Street-level addresses are never invented here —
 * callers collect the street from the user.
 */
export interface UsPlace {
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export const US_PLACES: UsPlace[] = [
  { city: 'Abilene', region: 'TX', postalCode: '79601', country: 'United States' },
  { city: 'Akron', region: 'OH', postalCode: '44301', country: 'United States' },
  { city: 'Albany', region: 'NY', postalCode: '12201', country: 'United States' },
  { city: 'Albuquerque', region: 'NM', postalCode: '87101', country: 'United States' },
  { city: 'Alexandria', region: 'VA', postalCode: '22301', country: 'United States' },
  { city: 'Allentown', region: 'PA', postalCode: '18101', country: 'United States' },
  { city: 'Amarillo', region: 'TX', postalCode: '79101', country: 'United States' },
  { city: 'Anaheim', region: 'CA', postalCode: '92801', country: 'United States' },
  { city: 'Anchorage', region: 'AK', postalCode: '99501', country: 'United States' },
  { city: 'Ann Arbor', region: 'MI', postalCode: '48103', country: 'United States' },
  { city: 'Arlington', region: 'TX', postalCode: '76010', country: 'United States' },
  { city: 'Atlanta', region: 'GA', postalCode: '30301', country: 'United States' },
  { city: 'Augusta', region: 'GA', postalCode: '30901', country: 'United States' },
  { city: 'Aurora', region: 'CO', postalCode: '80010', country: 'United States' },
  { city: 'Austin', region: 'TX', postalCode: '73301', country: 'United States' },
  { city: 'Bakersfield', region: 'CA', postalCode: '93301', country: 'United States' },
  { city: 'Baltimore', region: 'MD', postalCode: '21201', country: 'United States' },
  { city: 'Baton Rouge', region: 'LA', postalCode: '70801', country: 'United States' },
  { city: 'Beaumont', region: 'TX', postalCode: '77701', country: 'United States' },
  { city: 'Birmingham', region: 'AL', postalCode: '35201', country: 'United States' },
  { city: 'Boise', region: 'ID', postalCode: '83701', country: 'United States' },
  { city: 'Boston', region: 'MA', postalCode: '02101', country: 'United States' },
  { city: 'Bridgeport', region: 'CT', postalCode: '06601', country: 'United States' },
  { city: 'Brownsville', region: 'TX', postalCode: '78520', country: 'United States' },
  { city: 'Buffalo', region: 'NY', postalCode: '14201', country: 'United States' },
  { city: 'Burbank', region: 'CA', postalCode: '91501', country: 'United States' },
  { city: 'Cambridge', region: 'MA', postalCode: '02138', country: 'United States' },
  { city: 'Cape Coral', region: 'FL', postalCode: '33901', country: 'United States' },
  { city: 'Carlsbad', region: 'CA', postalCode: '92008', country: 'United States' },
  { city: 'Cedar Rapids', region: 'IA', postalCode: '52401', country: 'United States' },
  { city: 'Chandler', region: 'AZ', postalCode: '85224', country: 'United States' },
  { city: 'Charleston', region: 'SC', postalCode: '29401', country: 'United States' },
  { city: 'Charlotte', region: 'NC', postalCode: '28201', country: 'United States' },
  { city: 'Chattanooga', region: 'TN', postalCode: '37401', country: 'United States' },
  { city: 'Chicago', region: 'IL', postalCode: '60601', country: 'United States' },
  { city: 'Cincinnati', region: 'OH', postalCode: '45201', country: 'United States' },
  { city: 'Clarksville', region: 'TN', postalCode: '37040', country: 'United States' },
  { city: 'Cleveland', region: 'OH', postalCode: '44101', country: 'United States' },
  { city: 'Colorado Springs', region: 'CO', postalCode: '80901', country: 'United States' },
  { city: 'Columbia', region: 'SC', postalCode: '29201', country: 'United States' },
  { city: 'Columbus', region: 'OH', postalCode: '43201', country: 'United States' },
  { city: 'Corpus Christi', region: 'TX', postalCode: '78401', country: 'United States' },
  { city: 'Dallas', region: 'TX', postalCode: '75201', country: 'United States' },
  { city: 'Dayton', region: 'OH', postalCode: '45401', country: 'United States' },
  { city: 'Denver', region: 'CO', postalCode: '80201', country: 'United States' },
  { city: 'Des Moines', region: 'IA', postalCode: '50301', country: 'United States' },
  { city: 'Detroit', region: 'MI', postalCode: '48201', country: 'United States' },
  { city: 'Durham', region: 'NC', postalCode: '27701', country: 'United States' },
  { city: 'El Paso', region: 'TX', postalCode: '79901', country: 'United States' },
  { city: 'Eugene', region: 'OR', postalCode: '97401', country: 'United States' },
  { city: 'Evansville', region: 'IN', postalCode: '47701', country: 'United States' },
  { city: 'Fargo', region: 'ND', postalCode: '58102', country: 'United States' },
  { city: 'Fayetteville', region: 'NC', postalCode: '28301', country: 'United States' },
  { city: 'Fort Lauderdale', region: 'FL', postalCode: '33301', country: 'United States' },
  { city: 'Fort Wayne', region: 'IN', postalCode: '46801', country: 'United States' },
  { city: 'Fort Worth', region: 'TX', postalCode: '76101', country: 'United States' },
  { city: 'Fresno', region: 'CA', postalCode: '93701', country: 'United States' },
  { city: 'Garland', region: 'TX', postalCode: '75040', country: 'United States' },
  { city: 'Gilbert', region: 'AZ', postalCode: '85233', country: 'United States' },
  { city: 'Glendale', region: 'AZ', postalCode: '85301', country: 'United States' },
  { city: 'Grand Rapids', region: 'MI', postalCode: '49501', country: 'United States' },
  { city: 'Green Bay', region: 'WI', postalCode: '54301', country: 'United States' },
  { city: 'Greensboro', region: 'NC', postalCode: '27401', country: 'United States' },
  { city: 'Hartford', region: 'CT', postalCode: '06101', country: 'United States' },
  { city: 'Henderson', region: 'NV', postalCode: '89002', country: 'United States' },
  { city: 'Hialeah', region: 'FL', postalCode: '33010', country: 'United States' },
  { city: 'Honolulu', region: 'HI', postalCode: '96801', country: 'United States' },
  { city: 'Houston', region: 'TX', postalCode: '77001', country: 'United States' },
  { city: 'Huntsville', region: 'AL', postalCode: '35801', country: 'United States' },
  { city: 'Indianapolis', region: 'IN', postalCode: '46201', country: 'United States' },
  { city: 'Irvine', region: 'CA', postalCode: '92602', country: 'United States' },
  { city: 'Irving', region: 'TX', postalCode: '75039', country: 'United States' },
  { city: 'Jackson', region: 'MS', postalCode: '39201', country: 'United States' },
  { city: 'Jacksonville', region: 'FL', postalCode: '32201', country: 'United States' },
  { city: 'Jersey City', region: 'NJ', postalCode: '07302', country: 'United States' },
  { city: 'Joliet', region: 'IL', postalCode: '60431', country: 'United States' },
  { city: 'Kansas City', region: 'KS', postalCode: '66101', country: 'United States' },
  { city: 'Kansas City', region: 'MO', postalCode: '64101', country: 'United States' },
  { city: 'Knoxville', region: 'TN', postalCode: '37901', country: 'United States' },
  { city: 'Lafayette', region: 'LA', postalCode: '70501', country: 'United States' },
  { city: 'Lakeland', region: 'FL', postalCode: '33801', country: 'United States' },
  { city: 'Lancaster', region: 'CA', postalCode: '93534', country: 'United States' },
  { city: 'Lansing', region: 'MI', postalCode: '48901', country: 'United States' },
  { city: 'Laredo', region: 'TX', postalCode: '78040', country: 'United States' },
  { city: 'Las Vegas', region: 'NV', postalCode: '89101', country: 'United States' },
  { city: 'Lexington', region: 'KY', postalCode: '40501', country: 'United States' },
  { city: 'Lincoln', region: 'NE', postalCode: '68501', country: 'United States' },
  { city: 'Little Rock', region: 'AR', postalCode: '72201', country: 'United States' },
  { city: 'Long Beach', region: 'CA', postalCode: '90801', country: 'United States' },
  { city: 'Los Angeles', region: 'CA', postalCode: '90001', country: 'United States' },
  { city: 'Louisville', region: 'KY', postalCode: '40201', country: 'United States' },
  { city: 'Lubbock', region: 'TX', postalCode: '79401', country: 'United States' },
  { city: 'Macon', region: 'GA', postalCode: '31201', country: 'United States' },
  { city: 'Madison', region: 'WI', postalCode: '53701', country: 'United States' },
  { city: 'Manchester', region: 'NH', postalCode: '03101', country: 'United States' },
  { city: 'McAllen', region: 'TX', postalCode: '78501', country: 'United States' },
  { city: 'Memphis', region: 'TN', postalCode: '38101', country: 'United States' },
  { city: 'Mesa', region: 'AZ', postalCode: '85201', country: 'United States' },
  { city: 'Miami', region: 'FL', postalCode: '33101', country: 'United States' },
  { city: 'Midland', region: 'TX', postalCode: '79701', country: 'United States' },
  { city: 'Milwaukee', region: 'WI', postalCode: '53201', country: 'United States' },
  { city: 'Minneapolis', region: 'MN', postalCode: '55401', country: 'United States' },
  { city: 'Mobile', region: 'AL', postalCode: '36601', country: 'United States' },
  { city: 'Modesto', region: 'CA', postalCode: '95350', country: 'United States' },
  { city: 'Montgomery', region: 'AL', postalCode: '36101', country: 'United States' },
  { city: 'Moreno Valley', region: 'CA', postalCode: '92551', country: 'United States' },
  { city: 'Murfreesboro', region: 'TN', postalCode: '37130', country: 'United States' },
  { city: 'Nashville', region: 'TN', postalCode: '37201', country: 'United States' },
  { city: 'Naperville', region: 'IL', postalCode: '60540', country: 'United States' },
  { city: 'New Haven', region: 'CT', postalCode: '06501', country: 'United States' },
  { city: 'New Orleans', region: 'LA', postalCode: '70112', country: 'United States' },
  { city: 'New York', region: 'NY', postalCode: '10001', country: 'United States' },
  { city: 'Newark', region: 'NJ', postalCode: '07101', country: 'United States' },
  { city: 'Norfolk', region: 'VA', postalCode: '23501', country: 'United States' },
  { city: 'North Las Vegas', region: 'NV', postalCode: '89030', country: 'United States' },
  { city: 'Oakland', region: 'CA', postalCode: '94601', country: 'United States' },
  { city: 'Ocala', region: 'FL', postalCode: '34470', country: 'United States' },
  { city: 'Odessa', region: 'TX', postalCode: '79760', country: 'United States' },
  { city: 'Oklahoma City', region: 'OK', postalCode: '73101', country: 'United States' },
  { city: 'Omaha', region: 'NE', postalCode: '68101', country: 'United States' },
  { city: 'Ontario', region: 'CA', postalCode: '91761', country: 'United States' },
  { city: 'Orange', region: 'CA', postalCode: '92866', country: 'United States' },
  { city: 'Orlando', region: 'FL', postalCode: '32801', country: 'United States' },
  { city: 'Overland Park', region: 'KS', postalCode: '66204', country: 'United States' },
  { city: 'Oxnard', region: 'CA', postalCode: '93030', country: 'United States' },
  { city: 'Palm Bay', region: 'FL', postalCode: '32905', country: 'United States' },
  { city: 'Pasadena', region: 'CA', postalCode: '91101', country: 'United States' },
  { city: 'Paterson', region: 'NJ', postalCode: '07501', country: 'United States' },
  { city: 'Peoria', region: 'AZ', postalCode: '85345', country: 'United States' },
  { city: 'Philadelphia', region: 'PA', postalCode: '19101', country: 'United States' },
  { city: 'Phoenix', region: 'AZ', postalCode: '85001', country: 'United States' },
  { city: 'Pittsburgh', region: 'PA', postalCode: '15201', country: 'United States' },
  { city: 'Plano', region: 'TX', postalCode: '75023', country: 'United States' },
  { city: 'Pomona', region: 'CA', postalCode: '91766', country: 'United States' },
  { city: 'Portland', region: 'ME', postalCode: '04101', country: 'United States' },
  { city: 'Portland', region: 'OR', postalCode: '97201', country: 'United States' },
  { city: 'Providence', region: 'RI', postalCode: '02901', country: 'United States' },
  { city: 'Raleigh', region: 'NC', postalCode: '27601', country: 'United States' },
  { city: 'Reno', region: 'NV', postalCode: '89501', country: 'United States' },
  { city: 'Richmond', region: 'CA', postalCode: '94801', country: 'United States' },
  { city: 'Richmond', region: 'VA', postalCode: '23218', country: 'United States' },
  { city: 'Riverside', region: 'CA', postalCode: '92501', country: 'United States' },
  { city: 'Rochester', region: 'NY', postalCode: '14601', country: 'United States' },
  { city: 'Rockford', region: 'IL', postalCode: '61101', country: 'United States' },
  { city: 'Sacramento', region: 'CA', postalCode: '95814', country: 'United States' },
  { city: 'Saint Paul', region: 'MN', postalCode: '55101', country: 'United States' },
  { city: 'Salem', region: 'OR', postalCode: '97301', country: 'United States' },
  { city: 'Salinas', region: 'CA', postalCode: '93901', country: 'United States' },
  { city: 'Salt Lake City', region: 'UT', postalCode: '84101', country: 'United States' },
  { city: 'San Antonio', region: 'TX', postalCode: '78201', country: 'United States' },
  { city: 'San Bernardino', region: 'CA', postalCode: '92401', country: 'United States' },
  { city: 'San Diego', region: 'CA', postalCode: '92101', country: 'United States' },
  { city: 'San Francisco', region: 'CA', postalCode: '94101', country: 'United States' },
  { city: 'San Jose', region: 'CA', postalCode: '95101', country: 'United States' },
  { city: 'Santa Ana', region: 'CA', postalCode: '92701', country: 'United States' },
  { city: 'Santa Clarita', region: 'CA', postalCode: '91321', country: 'United States' },
  { city: 'Santa Fe', region: 'NM', postalCode: '87500', country: 'United States' },
  { city: 'Santa Rosa', region: 'CA', postalCode: '95401', country: 'United States' },
  { city: 'Savannah', region: 'GA', postalCode: '31401', country: 'United States' },
  { city: 'Scottsdale', region: 'AZ', postalCode: '85250', country: 'United States' },
  { city: 'Scranton', region: 'PA', postalCode: '18503', country: 'United States' },
  { city: 'Seattle', region: 'WA', postalCode: '98101', country: 'United States' },
  { city: 'Shreveport', region: 'LA', postalCode: '71101', country: 'United States' },
  { city: 'Sioux Falls', region: 'SD', postalCode: '57101', country: 'United States' },
  { city: 'South Bend', region: 'IN', postalCode: '46601', country: 'United States' },
  { city: 'Spokane', region: 'WA', postalCode: '99201', country: 'United States' },
  { city: 'Springfield', region: 'IL', postalCode: '62701', country: 'United States' },
  { city: 'Springfield', region: 'MA', postalCode: '01101', country: 'United States' },
  { city: 'Springfield', region: 'MO', postalCode: '65801', country: 'United States' },
  { city: 'St. Louis', region: 'MO', postalCode: '63101', country: 'United States' },
  { city: 'St. Petersburg', region: 'FL', postalCode: '33701', country: 'United States' },
  { city: 'Stockton', region: 'CA', postalCode: '95201', country: 'United States' },
  { city: 'Syracuse', region: 'NY', postalCode: '13201', country: 'United States' },
  { city: 'Tacoma', region: 'WA', postalCode: '98401', country: 'United States' },
  { city: 'Tallahassee', region: 'FL', postalCode: '32301', country: 'United States' },
  { city: 'Tampa', region: 'FL', postalCode: '33601', country: 'United States' },
  { city: 'Tempe', region: 'AZ', postalCode: '85281', country: 'United States' },
  { city: 'Toledo', region: 'OH', postalCode: '43601', country: 'United States' },
  { city: 'Topeka', region: 'KS', postalCode: '66601', country: 'United States' },
  { city: 'Torrance', region: 'CA', postalCode: '90501', country: 'United States' },
  { city: 'Tucson', region: 'AZ', postalCode: '85701', country: 'United States' },
  { city: 'Tulsa', region: 'OK', postalCode: '74101', country: 'United States' },
  { city: 'Tyler', region: 'TX', postalCode: '75701', country: 'United States' },
  { city: 'Virginia Beach', region: 'VA', postalCode: '23450', country: 'United States' },
  { city: 'Waco', region: 'TX', postalCode: '76701', country: 'United States' },
  { city: 'Washington', region: 'DC', postalCode: '20001', country: 'United States' },
  { city: 'Waterbury', region: 'CT', postalCode: '06701', country: 'United States' },
  { city: 'Wichita', region: 'KS', postalCode: '67201', country: 'United States' },
  { city: 'Wilmington', region: 'NC', postalCode: '28401', country: 'United States' },
  { city: 'Winston-Salem', region: 'NC', postalCode: '27101', country: 'United States' },
  { city: 'Worcester', region: 'MA', postalCode: '01601', country: 'United States' },
  { city: 'Yonkers', region: 'NY', postalCode: '10701', country: 'United States' },
];

/** Maximum number of autocomplete suggestions shown at once. */
export const ADDRESS_MATCH_LIMIT = 8;

/**
 * Filter the bundled dataset by city name, "city, ST", or ZIP prefix.
 * Returns at most `limit` matches, best (prefix) matches first.
 */
export function findPlaces(query: string, limit = ADDRESS_MATCH_LIMIT): UsPlace[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) return [];
  const zipOnly = /^\d+$/.test(trimmed);
  const scored = US_PLACES.map((place) => {
    const city = place.city.toLowerCase();
    const combo = `${city}, ${place.region.toLowerCase()}`;
    let score = -1;
    if (zipOnly) {
      if (place.postalCode.startsWith(trimmed)) score = 0;
    } else if (city === trimmed) {
      score = 0;
    } else if (city.startsWith(trimmed) || combo.startsWith(trimmed)) {
      score = 1;
    } else if (city.includes(trimmed) || combo.includes(trimmed) || place.region.toLowerCase() === trimmed) {
      score = 2;
    }
    return { place, score };
  }).filter((entry) => entry.score >= 0);
  scored.sort((a, b) => a.score - b.score || a.place.city.localeCompare(b.place.city));
  return scored.slice(0, limit).map((entry) => entry.place);
}
