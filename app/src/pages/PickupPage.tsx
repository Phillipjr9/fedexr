import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { ServiceNotice, ExternalLink, ServiceHero } from '@/components/ServiceLayout';
import { siteImages } from '@/lib/siteAssets';
import { isUSZip, localDate } from '@/lib/shipping';

interface PickupPlan {
  zip: string;
  date: string;
  count: string;
  ready: string;
  close: string;
  service: string;
}

function timeMinutes(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function validatePlan(plan: PickupPlan): string {
  if (!isUSZip(plan.zip)) return 'Enter a valid U.S. pickup ZIP code.';
  const date = new Date(`${plan.date}T12:00:00`);
  if (!Number.isFinite(date.getTime()) || localDate(date) !== plan.date || plan.date < localDate()) return 'Choose today or a future pickup date.';
  if (!Number.isInteger(Number(plan.count)) || Number(plan.count) < 1 || Number(plan.count) > 99) return 'For this sample, enter 1 to 99 packages.';
  if (!Number.isFinite(timeMinutes(plan.ready)) || !Number.isFinite(timeMinutes(plan.close)) || timeMinutes(plan.close) <= timeMinutes(plan.ready)) return 'The closing time must be later than the package ready time.';
  return '';
}

export default function PickupPage() {
  const [params] = useSearchParams();
  const [input, setInput] = useState<PickupPlan>({ zip: (params.get('zip') || '').slice(0, 10), date: localDate(), count: '1', ready: '09:00', close: '17:00', service: 'FedEx Ground / Home Delivery' });
  const [plan, setPlan] = useState<PickupPlan | null>(null);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (plan) reviewRef.current?.focus();
  }, [plan]);

  function update(key: keyof PickupPlan, value: string) {
    setInput((previous) => ({ ...previous, [key]: value }));
    setPlan(null);
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextError = validatePlan(input);
    setError(nextError);
    if (nextError) {
      setPlan(null);
      const name = nextError.includes('ZIP') ? 'zip' : nextError.includes('date') ? 'date' : nextError.includes('packages') ? 'count' : 'close';
      formRef.current?.querySelector<HTMLInputElement>(`[name="${name}"]`)?.focus();
      return;
    }
    setPlan({ ...input, zip: input.zip.trim() });
  }

  return (
    <div className="service-page">
      <ServiceHero eyebrow="Pickup planning" title="Schedule a pickup" description="Prepare your pickup details here, then finish your booking on the official FedEx website. Or find a convenient location to drop off your package." image={siteImages.professional}>
        <ExternalLink href="https://www.fedex.com/en-us/shipping/schedule-manage-pickups/login.html" className="brand-button brand-button-orange">Book on fedex.com</ExternalLink>
        <Link to="/locations" className="service-text-link">Find a drop-off location <ArrowRight size={16} aria-hidden="true" /></Link>
      </ServiceHero>
      <div className="site-container">
        <section className="service-section service-panel" aria-labelledby="pickup-plan-title">
          <h2 id="pickup-plan-title">Plan your pickup</h2>
          <p className="service-panel-intro">Have your label and package details ready. Pickup fees and availability are confirmed by FedEx during booking.</p>
          <ServiceNotice>This is a local planning tool. Reviewing a plan does not reserve a pickup, contact a driver, or send your information to FedEx.</ServiceNotice>
          <form ref={formRef} onSubmit={review} noValidate className="mt-7">
            <div className="service-form-grid">
              <div className="service-field"><label htmlFor="pickup-zip">Pickup ZIP code</label><input id="pickup-zip" name="zip" value={input.zip} onChange={(event) => update('zip', event.target.value)} inputMode="numeric" maxLength={10} required aria-describedby={error ? 'pickup-error' : undefined} /></div>
              <div className="service-field"><label htmlFor="pickup-date">Pickup date</label><input id="pickup-date" name="date" value={input.date} onChange={(event) => update('date', event.target.value)} type="date" min={localDate()} required aria-describedby={error ? 'pickup-error' : undefined} /></div>
              <div className="service-field"><label htmlFor="pickup-count">Number of packages</label><input id="pickup-count" name="count" value={input.count} onChange={(event) => update('count', event.target.value)} type="number" min="1" max="99" step="1" required aria-describedby={error ? 'pickup-error' : undefined} /></div>
              <div className="service-field"><label htmlFor="pickup-ready">Packages ready at</label><input id="pickup-ready" name="ready" value={input.ready} onChange={(event) => update('ready', event.target.value)} type="time" required aria-describedby={error ? 'pickup-error' : undefined} /><small>Local time at the pickup address</small></div>
              <div className="service-field"><label htmlFor="pickup-close">Pickup location closes at</label><input id="pickup-close" name="close" value={input.close} onChange={(event) => update('close', event.target.value)} type="time" required aria-describedby={error ? 'pickup-error' : undefined} /></div>
              <div className="service-field"><label htmlFor="pickup-service">Package service</label><select id="pickup-service" value={input.service} onChange={(event) => update('service', event.target.value)}><option>FedEx Ground / Home Delivery</option><option>FedEx Express</option><option>Mixed Ground and Express</option></select></div>
            </div>
            {error && <p id="pickup-error" className="service-form-error" role="alert">{error}</p>}
            <div className="service-form-footer"><button type="submit" className="brand-button brand-button-outline">Review pickup plan <ArrowRight size={17} aria-hidden="true" /></button></div>
          </form>
          {plan && (
            <div className="pickup-review" ref={reviewRef} tabIndex={-1} aria-labelledby="pickup-review-title">
              <h3 id="pickup-review-title"><CheckCircle2 size={23} color="#4d148c" aria-hidden="true" />Your plan is ready—not booked</h3>
              <dl><dt>Pickup area</dt><dd>{plan.zip}</dd><dt>Date</dt><dd>{plan.date}</dd><dt>Packages</dt><dd>{plan.count}</dd><dt>Local time window</dt><dd>{plan.ready}–{plan.close}</dd><dt>Service</dt><dd>{plan.service}</dd></dl>
              <p>No reservation has been made. Open the official booking page and enter these details there to check availability, fees, and confirmation.</p>
              <div className="service-actions"><ExternalLink href="https://www.fedex.com/en-us/shipping/schedule-manage-pickups/login.html" className="brand-button brand-button-orange">Continue to FedEx booking</ExternalLink></div>
            </div>
          )}
        </section>
        <section className="service-section service-form-two-column" aria-label="Pickup resources">
          <div className="service-panel"><h2>Before you book</h2><ol className="list-decimal pl-5 space-y-4 text-sm leading-relaxed mt-5"><li>Create a shipping label and securely pack your shipment.</li><li>Check the pickup options and any fees for your location.</li><li>Keep your packages accessible during your confirmed pickup window.</li></ol><div className="service-actions"><Link to="/shipping/create" className="service-text-link">Try the sample label builder <ArrowRight size={16} aria-hidden="true" /></Link></div></div>
          <div className="service-panel"><h2>Need a recurring pickup?</h2><p className="service-panel-intro mt-5">Explore automated, regularly scheduled, and on-call options on the official site. This sample only prepares a one-time pickup brief.</p><ExternalLink href="https://www.fedex.com/en-us/shipping/schedule-manage-pickups.html">View official pickup options</ExternalLink></div>
        </section>
      </div>
    </div>
  );
}
