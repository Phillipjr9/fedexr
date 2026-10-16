import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPin, Phone, Search } from 'lucide-react';
import { ServiceNotice, ExternalLink, ServiceHero } from '@/components/ServiceLayout';
import { siteImages } from '@/lib/siteAssets';
import { filterLocations, locationTypes, officialLocationDirectory, verifiedLocations, type LocationType } from '@/lib/locations';

export default function LocationsPage() {
  const [params] = useSearchParams();
  const [input, setInput] = useState((params.get('q') || '').slice(0, 100));
  const [query, setQuery] = useState(input);
  const [type, setType] = useState<LocationType | 'all'>(() => locationTypes.find((item) => item.id === params.get('type'))?.id || 'all');
  const locations = filterLocations(query, type);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(input.trim());
  }

  function reset() {
    setInput('');
    setQuery('');
    setType('all');
  }

  return (
    <div className="service-page">
      <ServiceHero eyebrow="Locations" title="Find a FedEx location" description="Find a place to ship, pack, or print. Browse verified New York location examples here, or use the official FedEx locator for live results in your area." image={siteImages.officeLocation}>
        <ExternalLink href={officialLocationDirectory} className="brand-button brand-button-orange">Open the official locator</ExternalLink>
      </ServiceHero>
      <div className="site-container">
        <section className="service-section service-panel" aria-labelledby="location-search-title">
          <h2 id="location-search-title">Explore New York locations</h2>
          <p className="service-panel-intro">Search this curated list by street, ZIP code, or location name. Try “Union Square,” “10014,” or “Walgreens.”</p>
          <form className="service-search" onSubmit={search} role="search" aria-label="Search saved locations">
            <label htmlFor="location-query"><span className="sr-only">City, street, or ZIP code</span><input id="location-query" type="search" value={input} onChange={(event) => setInput(event.target.value)} maxLength={100} placeholder="Enter a street, city, or ZIP code" autoComplete="off" /></label>
            <button type="submit" className="brand-button brand-button-outline"><Search size={18} aria-hidden="true" />Search locations</button>
          </form>
          <ServiceNotice title="Verified examples, not live nearby results">This page contains {verifiedLocations.length} saved New York listings reviewed on October 13, 2026. It is not a complete directory or a nearest-location service. Check official listings for current hours, pickup cutoffs, and available services.</ServiceNotice>
        </section>

        <section className="service-section" aria-labelledby="location-results-title">
          <div className="service-filters" role="group" aria-label="Filter location type">
            <button type="button" className="service-filter" aria-pressed={type === 'all'} onClick={() => setType('all')}>All types</button>
            {locationTypes.map((item) => <button type="button" className="service-filter" key={item.id} aria-pressed={type === item.id} onClick={() => setType(item.id)}>{item.label}</button>)}
          </div>
          <div className="service-results-heading">
            <h2 id="location-results-title"><span role="status">{locations.length} saved {locations.length === 1 ? 'location' : 'locations'}{query ? ` matching “${query}”` : ''}</span></h2>
            {(query || type !== 'all') && <button type="button" className="service-text-link" onClick={reset}>Clear filters</button>}
          </div>
          {locations.length === 0 ? (
            <div className="service-empty"><h3>No saved locations match this search</h3><p>This small example list only covers New York. It does not mean there are no FedEx locations in your area. Enter your area in the official directory for live results.</p><ExternalLink href={officialLocationDirectory} className="brand-button brand-button-outline">Search the official directory</ExternalLink></div>
          ) : (
            <div className="location-list">
              {locations.map((location) => {
                const map = location.directions || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.name}, ${location.address}, New York, NY ${location.zip}`)}`;
                return (
                  <article key={location.id} className="location-card">
                    <div className="location-pin"><MapPin size={25} strokeWidth={1.5} aria-hidden="true" /></div>
                    <div><h3>{location.name}</h3><address>{location.address}<br />New York, NY {location.zip}</address><a href={`tel:${location.phone}`} className="location-phone"><Phone size={14} aria-hidden="true" />{location.phoneDisplay}<span className="sr-only"> — {location.address}</span></a></div>
                    <div className="location-links"><ExternalLink href={location.url} className="brand-button brand-button-outline">Hours &amp; details<span className="sr-only"> — {location.address}</span></ExternalLink><ExternalLink href={map}>View on map<span className="sr-only"> — {location.address}</span></ExternalLink></div>
                  </article>
                );
              })}
            </div>
          )}
          <p className="location-source">Source: <ExternalLink href="https://local.fedex.com/en-us/ny/new-york">Official New York FedEx directory</ExternalLink>. No fictional addresses, phone numbers, opening statuses, or distances are shown.</p>
        </section>
        <section className="service-section service-panel" aria-labelledby="all-locations-title"><h2 id="all-locations-title">Looking somewhere else?</h2><p className="service-panel-intro">The official locator can help you find FedEx Office, FedEx Ship Centers, retail partners, and drop boxes outside this example list. You can enter your area or use its location tools there.</p><ExternalLink href={officialLocationDirectory} className="brand-button brand-button-outline">Find locations nationwide</ExternalLink></section>
      </div>
    </div>
  );
}
