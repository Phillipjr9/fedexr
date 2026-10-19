import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, MapPin, Package, Truck, RotateCcw, ArrowRight } from 'lucide-react';
import BrandImage from '@/components/BrandImage';
import { ExternalLink, ServiceHero } from '@/components/ServiceLayout';
import { siteImages } from '@/lib/siteAssets';
import { isUSZip, localDate, quoteParams } from '@/lib/shipping';

export default function ShippingPage() {
  const navigate = useNavigate();
  const [fromZip, setFromZip] = useState('');
  const [toZip, setToZip] = useState('');
  const [weight, setWeight] = useState('1');
  const [error, setError] = useState('');
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);

  function handleQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isUSZip(fromZip)) {
      setError('Enter a valid From ZIP code (12345 or 12345-6789).');
      fromRef.current?.focus();
      return;
    }
    if (!isUSZip(toZip)) {
      setError('Enter a valid To ZIP code (12345 or 12345-6789).');
      toRef.current?.focus();
      return;
    }
    if (!Number.isFinite(Number(weight)) || Number(weight) < 0.1 || Number(weight) > 150) {
      setError('Enter a package weight from 0.1 to 150 lb.');
      weightRef.current?.focus();
      return;
    }
    const params = quoteParams({ from: fromZip, to: toZip, weight, length: '', width: '', height: '', shipDate: localDate() });
    navigate(`/rate-calculator?${params}`);
  }

  return (
    <div className="service-page">
      <ServiceHero
        eyebrow="Shipping"
        title="Shipping services"
        description="From everyday packages to your next big opportunity, find a shipping option that fits. Prepare a shipment, compare options, and keep things moving."
        image={siteImages.officePacking}
      >
        <Link to="/shipping/create" className="brand-button brand-button-orange">Create a shipment</Link>
        <Link to="/rate-calculator" className="service-text-link">Compare shipping options <ArrowRight size={16} aria-hidden="true" /></Link>
      </ServiceHero>

      <div className="site-container">
        <nav className="service-quick-links" aria-label="Shipping tools">
          <Link to="/rate-calculator"><Package size={29} strokeWidth={1.5} aria-hidden="true" />Rates &amp; delivery times</Link>
          <Link to="/shipping/pickup"><CalendarDays size={29} strokeWidth={1.5} aria-hidden="true" />Schedule a pickup</Link>
          <Link to="/locations"><MapPin size={29} strokeWidth={1.5} aria-hidden="true" />Find a drop-off location</Link>
          <Link to="/returns"><RotateCcw size={29} strokeWidth={1.5} aria-hidden="true" />Return a package</Link>
        </nav>

        <section className="service-section service-panel" aria-labelledby="quick-quote-title">
          <h2 id="quick-quote-title">Where is your package going?</h2>
          <p className="service-panel-intro">Start with your U.S. ZIP codes and package weight to compare shipping estimates.</p>
          <form onSubmit={handleQuote} noValidate>
            <div className="service-form-grid">
              <div className="service-field">
                <label htmlFor="shipping-from">From ZIP code</label>
                <input id="shipping-from" ref={fromRef} value={fromZip} onChange={(event) => setFromZip(event.target.value)} placeholder="e.g., 10003" inputMode="numeric" autoComplete="off" maxLength={10} required aria-invalid={Boolean(error) && !isUSZip(fromZip)} aria-describedby={error ? 'shipping-quote-error' : undefined} />
              </div>
              <div className="service-field">
                <label htmlFor="shipping-to">To ZIP code</label>
                <input id="shipping-to" ref={toRef} value={toZip} onChange={(event) => setToZip(event.target.value)} placeholder="e.g., 90001" inputMode="numeric" autoComplete="off" maxLength={10} required aria-invalid={Boolean(error) && !isUSZip(toZip)} aria-describedby={error ? 'shipping-quote-error' : undefined} />
              </div>
              <div className="service-field">
                <label htmlFor="shipping-weight">Package weight (lb)</label>
                <input id="shipping-weight" ref={weightRef} value={weight} onChange={(event) => setWeight(event.target.value)} type="number" min="0.1" max="150" step="0.1" required aria-invalid={Boolean(error) && (!Number.isFinite(Number(weight)) || Number(weight) < 0.1 || Number(weight) > 150)} aria-describedby={error ? 'shipping-quote-error' : undefined} />
              </div>
            </div>
            {error && <p id="shipping-quote-error" role="alert" className="service-form-error">{error}</p>}
            <div className="service-form-footer">
              <button type="submit" className="brand-button brand-button-orange">Get rates <ArrowRight size={17} aria-hidden="true" /></button>
              <p>Need a live quote? <ExternalLink href="https://www.fedex.com/en-us/online/rating.html">Get rates on fedex.com</ExternalLink></p>
            </div>
          </form>
        </section>

        <section className="service-section" aria-labelledby="shipping-options-title">
          <div className="service-section-heading">
            <div><h2 id="shipping-options-title">Find your shipping option</h2><p>Explore everyday, time-sensitive, and international shipping.</p></div>
          </div>
          <div className="service-card-grid">
            <article className="service-card">
              <BrandImage image={siteImages.ground} className="service-card-image" />
              <div className="service-card-content"><h3>Ground shipping</h3><p>Compare a ground-shipping option for your less time-sensitive packages.</p><Link to="/rate-calculator?service=ground" className="service-text-link">Explore FedEx Ground <ArrowRight size={16} aria-hidden="true" /></Link></div>
            </article>
            <article className="service-card">
              <BrandImage image={siteImages.professional} className="service-card-image" />
              <div className="service-card-content"><h3>Express shipping</h3><p>Review overnight and two-day options when timing matters. Availability depends on your shipment.</p><Link to="/rate-calculator?service=priority" className="service-text-link">Compare express options <ArrowRight size={16} aria-hidden="true" /></Link></div>
            </article>
            <article className="service-card">
              <BrandImage image={siteImages.international} className="service-card-image" />
              <div className="service-card-content"><h3>International shipping</h3><p>Find the FedEx resources you need for shipping across borders, including customs and documentation.</p><ExternalLink href="https://www.fedex.com/en-us/shipping/international.html">Explore international shipping</ExternalLink></div>
            </article>
          </div>
        </section>

        <section className="service-section service-feature" aria-labelledby="packaging-title">
          <BrandImage image={siteImages.packaging} />
          <div className="service-feature-copy">
            <h2 id="packaging-title">The right packaging makes a difference</h2>
            <p>FedEx offers complimentary packaging for qualifying express services with an eligible account. Other boxes and packing supplies may have a cost. Check the current requirements before ordering.</p>
            <div className="service-actions">
              <ExternalLink href="https://www.fedex.com/en-us/shipping/packing/supplies.html" className="brand-button brand-button-outline">Explore packing supplies</ExternalLink>
              <Link to="/store" className="service-text-link">Try the supplies planner</Link>
            </div>
          </div>
        </section>

        <section className="service-section service-panel" aria-labelledby="one-rate-title">
          <div className="service-section-heading">
            <div><h2 id="one-rate-title">Prefer flat-rate shipping?</h2><p>Explore FedEx One Rate packaging, eligible services, and current pricing on fedex.com. Prices shown here are estimates, not offers.</p></div>
            <Truck size={42} color="#4d148c" strokeWidth={1.3} aria-hidden="true" />
          </div>
          <ExternalLink href="https://www.fedex.com/en-us/shipping/one-rate.html" className="brand-button brand-button-outline">Explore FedEx One Rate</ExternalLink>
        </section>
      </div>
    </div>
  );
}
