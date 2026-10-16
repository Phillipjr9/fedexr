import { useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Ruler } from 'lucide-react';
import { ServiceNotice, ExternalLink, ServiceHero } from '@/components/ServiceLayout';
import { siteImages } from '@/lib/siteAssets';
import { sampleBillableWeight, estimateSampleRates, formatUSD, isSampleService, localDate, quoteErrors, quoteParams, readQuoteParams, type QuoteInput } from '@/lib/shipping';

export default function RateCalculator() {
  const [params] = useSearchParams();
  const [input, setInput] = useState<QuoteInput>(() => ({ ...readQuoteParams(params), weight: params.get('weight') || '1' }));
  const [quote, setQuote] = useState<QuoteInput | null>(() => {
    const seed = readQuoteParams(params);
    return params.has('from') && params.has('to') && Object.keys(quoteErrors(seed)).length === 0 ? seed : null;
  });
  const [errors, setErrors] = useState<Partial<Record<keyof QuoteInput, string>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const preferred = isSampleService(params.get('service')) ? params.get('service') : 'ground';
  const rates = quote ? estimateSampleRates(quote) : [];

  function updateInput(key: keyof QuoteInput, value: string) {
    setInput((previous) => ({ ...previous, [key]: value }));
    setQuote(null);
  }

  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = quoteErrors(input);
    setErrors(nextErrors);
    const firstKey = Object.keys(nextErrors)[0] as keyof QuoteInput | undefined;
    if (firstKey) {
      formRef.current?.querySelector<HTMLInputElement>(`[name="${firstKey}"]`)?.focus();
      setQuote(null);
      return;
    }
    setQuote({ ...input, from: input.from.trim(), to: input.to.trim() });
  }

  function field(key: keyof QuoteInput, label: string, type = 'text', hint?: string) {
    return (
      <div className="service-field" key={key}>
        <label htmlFor={`rate-${key}`}>{label}</label>
        <input
          id={`rate-${key}`} name={key} value={input[key]} type={type}
          onChange={(event) => updateInput(key, event.target.value)}
          inputMode={key === 'from' || key === 'to' ? 'numeric' : undefined}
          autoComplete="off"
          maxLength={key === 'from' || key === 'to' ? 10 : undefined}
          min={type === 'date' ? localDate() : type === 'number' ? '0.1' : undefined}
          max={type === 'number' ? key === 'weight' ? '150' : '108' : undefined}
          step={type === 'number' ? '0.1' : undefined}
          required={!['length', 'width', 'height'].includes(key)}
          aria-invalid={Boolean(errors[key])}
          aria-describedby={errors[key] ? `rate-${key}-error` : hint ? `rate-${key}-hint` : undefined}
        />
        {hint && <small id={`rate-${key}-hint`}>{hint}</small>}
        {errors[key] && <span id={`rate-${key}-error`} className="service-field-error">{errors[key]}</span>}
      </div>
    );
  }

  return (
    <div className="service-page">
      <ServiceHero eyebrow="Rates & delivery times" title="Shipping Rate Calculator" description="Compare sample U.S. shipping options using your package details. For current pricing and delivery commitments, get a live quote on fedex.com." image={siteImages.globalTrade}>
        <ExternalLink href="https://www.fedex.com/en-us/online/rating.html" className="brand-button brand-button-outline">Get a live quote</ExternalLink>
      </ServiceHero>
      <div className="site-container">
        <section className="service-section service-panel" aria-labelledby="rate-details-title">
          <h2 id="rate-details-title">Tell us about your shipment</h2>
          <p className="service-panel-intro">U.S. ZIP codes · pounds · inches · illustrative U.S. dollar estimates</p>
          <form ref={formRef} onSubmit={calculate} noValidate>
            <div className="service-form-grid service-rate-fields">
              {field('from', 'From ZIP code', 'text', '5-digit ZIP or ZIP+4')}
              {field('to', 'To ZIP code', 'text', '5-digit ZIP or ZIP+4')}
              {field('weight', 'Package weight (lb)', 'number')}
              {field('shipDate', 'Planned ship date', 'date', 'For planning only; this does not book a shipment.')}
            </div>
            <fieldset className="service-dimensions">
              <legend><Ruler size={17} className="inline mr-2" aria-hidden="true" />Package dimensions (optional)</legend>
              <div className="service-form-grid">
                {field('length', 'Length (in)', 'number')}
                {field('width', 'Width (in)', 'number')}
                {field('height', 'Height (in)', 'number')}
              </div>
              <p className="service-form-help mt-3">If you enter dimensions, provide all three. They affect the sample billable weight.</p>
            </fieldset>
            {Object.keys(errors).length > 0 && <p className="service-form-error" role="alert">Please correct the highlighted shipment details.</p>}
            <div className="service-form-footer"><button type="submit" className="brand-button brand-button-orange">Calculate sample rates <ArrowRight size={17} aria-hidden="true" /></button></div>
          </form>
          <ServiceNotice>These estimates use a local example formula based on weight, dimensions, and ZIP-prefix bands—not FedEx tariffs, actual distances, taxes, or surcharges. The planned date is included in your brief, not a guaranteed delivery date.</ServiceNotice>
        </section>

        {quote && (
          <section className="service-section" aria-labelledby="rate-results-title">
            <div className="service-section-heading"><div><h2 id="rate-results-title">Your sample shipping estimates</h2><p>Select a service to carry your ZIP codes, package details, and service choice into the existing shipment planning tool.</p></div></div>
            <div className="service-rate-summary" role="status">
              <strong>{quote.from} → {quote.to}</strong> · {quote.weight} lb · Sample billable weight: {sampleBillableWeight(quote)} lb<br />
              Planned ship date: {new Date(`${quote.shipDate}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. No shipment has been booked.
            </div>
            <div className="service-rate-list">
              {rates.map((rate) => (
                <article className="service-rate-row" key={rate.id} data-preferred={rate.id === preferred}>
                  <div><h3>{rate.name}</h3><p>{rate.description} Actual eligibility and timing must be checked with FedEx.</p>{rate.id === preferred && <p className="font-medium text-fedex-purple">Requested service</p>}</div>
                  <div className="service-rate-price">{formatUSD(rate.price)}<span>Sample estimate · USD</span></div>
                  <Link to={`/shipping/create?${quoteParams(quote, rate.id)}`} className="brand-button brand-button-outline" aria-label={`Select ${rate.name} for shipment plan`}>Select service <ArrowRight size={15} aria-hidden="true" /></Link>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="service-section service-panel" aria-labelledby="rate-one-rate-title">
          <h2 id="rate-one-rate-title">Looking for flat-rate packaging?</h2>
          <p className="service-panel-intro">Check eligible services, packaging, and current FedEx One Rate pricing on the official site.</p>
          <ExternalLink href="https://www.fedex.com/en-us/shipping/one-rate.html" className="brand-button brand-button-outline">Explore FedEx One Rate</ExternalLink>
        </section>
      </div>
    </div>
  );
}
