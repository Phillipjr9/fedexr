import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Download,
  MapPin,
  Package,
  Truck,
} from 'lucide-react';
import {
  estimateSampleRates,
  isSampleService,
  isUSZip,
  localDate,
  quoteErrors,
  readQuoteParams,
  type QuoteInput,
} from '@/lib/shipping';
import { useWorkspace } from '@/context/workspace';
import { downloadText } from '@/lib/localDownloads';
import { ExternalLink, ServiceNotice } from '@/components/ServiceLayout';
import LocalPhotoPreview from '@/components/LocalPhotoPreview';
import '@/workspace.css';

const emptyAddress = {
  name: '',
  company: '',
  street: '',
  city: '',
  state: '',
  country: 'US',
  zip: '',
  phone: '',
};
type Address = typeof emptyAddress;
const steps = [
  { label: 'From', icon: MapPin },
  { label: 'To', icon: MapPin },
  { label: 'Package', icon: Package },
  { label: 'Service', icon: Truck },
  { label: 'Review', icon: ClipboardCheck },
];

function AddressFields({
  direction,
  address,
  onChange,
  saved,
}: {
  direction: 'from' | 'to';
  address: Address;
  onChange: (next: Address) => void;
  saved: () => void;
}) {
  return (
    <div>
      <h2 id="shipment-step-title">{direction === 'from' ? 'Ship From' : 'Ship To'}</h2>
      <p className="workspace-panel-intro">
        Use non-sensitive planning details. Sample estimates support U.S. ZIP-code routes only.
      </p>
      <div className="workspace-form-grid">
        {(
          [
            ['name', 'Full Name *', 'Your name', 100],
            ['company', 'Company (optional)', 'Company name', 100],
            ['street', 'Street Address *', 'Street address', 200],
            ['city', 'City *', 'City', 100],
            ['state', 'State (optional)', 'State', 60],
            ['zip', 'ZIP *', 'ZIP code', 10],
            ['phone', 'Phone (optional)', 'Contact number', 30],
          ] as const
        ).map(([key, label, placeholder, max]) => (
          <div
            className={`service-field ${key === 'street' ? 'workspace-field-wide' : ''}`}
            key={key}
          >
            <label htmlFor={`plan-${direction}Address-${key}`}>{label}</label>
            <input
              id={`plan-${direction}Address-${key}`}
              type={key === 'phone' ? 'tel' : 'text'}
              value={address[key]}
              placeholder={placeholder}
              maxLength={max}
              autoComplete="off"
              onChange={(event) => {
                onChange({ ...address, [key]: event.target.value });
                saved();
              }}
              required={['name', 'street', 'city', 'zip'].includes(key)}
            />
          </div>
        ))}
        <div className="service-field">
          <label htmlFor={`plan-${direction}Address-country`}>Country</label>
          <select
            id={`plan-${direction}Address-country`}
            value={address.country}
            onChange={(event) => onChange({ ...address, country: event.target.value })}
          >
            <option value="US">United States</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export default function ShipmentWizard() {
  const [params] = useSearchParams();
  const [seed] = useState(() => {
    const input = readQuoteParams(params);
    const problems = quoteErrors(input);
    return {
      ...input,
      from: isUSZip(input.from) ? input.from.trim() : '',
      to: isUSZip(input.to) ? input.to.trim() : '',
      weight: problems.weight ? '' : input.weight,
      length: problems.length ? '' : input.length,
      width: problems.width ? '' : input.width,
      height: problems.height ? '' : input.height,
      shipDate: problems.shipDate ? localDate() : input.shipDate,
    };
  });
  const { user, data, savePlan, mode } = useWorkspace();
  const [step, setStep] = useState(1);
  const [from, setFrom] = useState<Address>({ ...emptyAddress, zip: seed.from });
  const [to, setTo] = useState<Address>({ ...emptyAddress, zip: seed.to });
  const [weight, setWeight] = useState(seed.weight);
  const [dimensions, setDimensions] = useState({
    length: seed.length,
    width: seed.width,
    height: seed.height,
  });
  const [shipDate, setShipDate] = useState(seed.shipDate);
  const [service, setService] = useState(
    isSampleService(params.get('service')) ? params.get('service')! : '',
  );
  const [packaging, setPackaging] = useState('box');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | undefined>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const imageRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const quote: QuoteInput = { from: from.zip, to: to.zip, weight, ...dimensions, shipDate };
  const problems = quoteErrors(quote);
  const services = estimateSampleRates(quote);
  const selectedService = services.find((entry) => entry.id === service);
  const addresses = data.addresses.filter(
    (entry) => entry.userId === user?.id && ['United States', 'US', 'USA'].includes(entry.country),
  );
  function clearFeedback() {
    setMessage('');
    setError('');
  }
  const addressReady = (address: Address) =>
    [address.name, address.street, address.city].every((value) => value.trim()) &&
    isUSZip(address.zip);
  const isValid =
    step === 1
      ? addressReady(from)
      : step === 2
        ? addressReady(to)
        : step === 3
          ? !(['weight', 'length', 'width', 'height', 'shipDate'] as const).some(
              (key) => problems[key],
            )
          : isSampleService(service);
  function go(next: number) {
    setStep(next);
    clearFeedback();
    window.requestAnimationFrame(() => headingRef.current?.focus());
  }
  function loadAddress(id: string) {
    const entry = addresses.find((address) => address.id === id);
    if (!entry) return;
    const next = {
      ...emptyAddress,
      name: entry.name,
      street: entry.street,
      city: entry.city,
      state: entry.region,
      zip: entry.postalCode,
    };
    if (step === 1) setFrom(next);
    else setTo(next);
    clearFeedback();
  }
  function notes() {
    return [
      `Package: ${packaging}`,
      `Dimensions (in): ${dimensions.length || 'not set'} × ${dimensions.width || 'not set'} × ${dimensions.height || 'not set'}`,
      description && `Contents: ${description}`,
      'Full addresses are included in the separately downloaded brief. Photos are not stored.',
    ]
      .filter(Boolean)
      .join('\n');
  }
  async function save() {
    setError('');
    if (!isSampleService(service) || saving) return;
    setSaving(true);
    try {
      const record = await savePlan(
        {
          reference: '',
          recipient: to.name,
          from: from.zip,
          to: to.zip,
          weight,
          service,
          shipDate,
          notes: notes(),
        },
        savedId,
      );
      setSavedId(record.id);
      setMessage(
        mode === 'server'
          ? 'Shipment plan saved to your account. No shipping label, tracking number, booking, or charge was created.'
          : 'Shipment plan saved in your browser workspace. No shipping label, tracking number, booking, or charge was created.',
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your plan could not be saved.');
    } finally {
      setSaving(false);
    }
  }
  function download() {
    const brief = [
      'LOCAL SHIPMENT PLANNING BRIEF',
      'Not a shipping label, carrier booking, or current carrier quote.',
      `Planned ship date: ${shipDate}`,
      '',
      'FROM',
      from.name,
      from.company,
      from.street,
      `${from.city}, ${from.state} ${from.zip}`,
      from.phone,
      '',
      'TO',
      to.name,
      to.company,
      to.street,
      `${to.city}, ${to.state} ${to.zip}`,
      to.phone,
      '',
      `Planned weight: ${weight} lb`,
      notes(),
      `Service to explore: ${selectedService?.name || 'Not selected'}`,
      `Illustrative local estimate: $${selectedService?.price.toFixed(2) || '0.00'}—not an amount owed`,
      `Local photo filename: ${image?.name || 'None'} (photo contents are not included or uploaded)`,
      '',
      'Confirm prices, restrictions, dates, and labels on the official FedEx website. No payment information is collected here.',
    ]
      .filter((line) => line !== undefined)
      .join('\n');
    downloadText('shipment-planning-brief.txt', brief);
    setMessage('Your planning brief was downloaded. No shipment was booked or payment processed.');
  }

  return (
    <div className="shipment-wizard">
      <p className="text-sm text-gray-600 mb-6">
        Planned ship date: {shipDate}. All prices below are illustrative sample estimates.
      </p>
      <ol className="shipment-progress" aria-label="Shipment planning steps">
        {steps.map((item, index) => (
          <li
            key={item.label}
            aria-current={step === index + 1 ? 'step' : undefined}
            className={step >= index + 1 ? 'is-current' : ''}
          >
            <span>
              <item.icon size={19} aria-hidden="true" />
            </span>
            {item.label}
          </li>
        ))}
      </ol>
      <div
        className="workspace-panel shipment-step"
        ref={headingRef}
        tabIndex={-1}
        aria-labelledby="shipment-step-title"
      >
        {(step === 1 || step === 2) && (
          <>
            {addresses.length > 0 && (
              <div className="service-field shipment-address-picker">
                <label htmlFor="shipment-saved-address">Use an address from your workspace</label>
                <select
                  id="shipment-saved-address"
                  value=""
                  onChange={(event) => loadAddress(event.target.value)}
                >
                  <option value="">Choose a saved U.S. address</option>
                  {addresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.label} · {address.postalCode}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <AddressFields
              direction={step === 1 ? 'from' : 'to'}
              address={step === 1 ? from : to}
              onChange={step === 1 ? setFrom : setTo}
              saved={clearFeedback}
            />
          </>
        )}
        {step === 3 && (
          <div>
            <h2 id="shipment-step-title">Package Details</h2>
            <p className="workspace-panel-intro">
              Add planned dimensions and weight. Any selected photo stays in memory and is never
              uploaded from this form.
            </p>
            <fieldset className="shipment-packaging">
              <legend>Packaging type</legend>
              <div>
                {['box', 'envelope', 'tube', 'pallet'].map((type) => (
                  <button
                    type="button"
                    key={type}
                    aria-pressed={packaging === type}
                    onClick={() => {
                      setPackaging(type);
                      clearFeedback();
                    }}
                  >
                    <Package size={25} aria-hidden="true" />
                    {type}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="workspace-form-grid">
              <div className="service-field">
                <label htmlFor="plan-packageDetails-weight">Weight (lbs) *</label>
                <input
                  id="plan-packageDetails-weight"
                  type="number"
                  min="0.1"
                  max="150"
                  step="0.1"
                  value={weight}
                  onChange={(event) => {
                    setWeight(event.target.value);
                    clearFeedback();
                  }}
                />
              </div>
              <div className="service-field">
                <label htmlFor="plan-ship-date">Planned ship date</label>
                <input
                  id="plan-ship-date"
                  type="date"
                  min={localDate()}
                  value={shipDate}
                  onChange={(event) => {
                    setShipDate(event.target.value);
                    clearFeedback();
                  }}
                />
              </div>
              {(['length', 'width', 'height'] as const).map((key) => (
                <div className="service-field" key={key}>
                  <label htmlFor={`plan-packageDetails-${key}`}>Package {key} (inches)</label>
                  <input
                    id={`plan-packageDetails-${key}`}
                    type="number"
                    min="0.1"
                    max="108"
                    step="0.1"
                    value={dimensions[key]}
                    onChange={(event) => {
                      setDimensions((previous) => ({ ...previous, [key]: event.target.value }));
                      clearFeedback();
                    }}
                  />
                </div>
              ))}
              <div className="service-field workspace-field-wide">
                <label htmlFor="plan-packageDetails-description">Description (optional)</label>
                <textarea
                  id="plan-packageDetails-description"
                  rows={3}
                  value={description}
                  maxLength={300}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    clearFeedback();
                  }}
                />
              </div>
              <div className="service-field workspace-field-wide">
                <label htmlFor="image-upload">
                  Local package photo (optional; JPG/PNG up to 10 MB)
                </label>
                <input
                  id="image-upload"
                  ref={imageRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (
                      !['image/jpeg', 'image/png'].includes(file.type) ||
                      file.size === 0 ||
                      file.size > 10 * 1024 * 1024
                    ) {
                      setImage(null);
                      event.target.value = '';
                      setError('Choose a non-empty JPG or PNG up to 10 MB.');
                    } else {
                      setImage(file);
                      clearFeedback();
                    }
                  }}
                />
                <small>Local preview only. Not included in the saved plan or brief.</small>
              </div>
            </div>
            {image && (
              <div className="workspace-attachment-preview">
                <LocalPhotoPreview key={`${image.name}-${image.lastModified}`} file={image} />
                <button
                  type="button"
                  className="service-text-link"
                  onClick={() => {
                    setImage(null);
                    if (imageRef.current) imageRef.current.value = '';
                    clearFeedback();
                  }}
                >
                  Remove local package photo
                </button>
              </div>
            )}
          </div>
        )}
        {step === 4 && (
          <div>
            <h2 id="shipment-step-title">Choose a Service</h2>
            <p className="workspace-panel-intro">
              Illustrative local estimates only—not carrier tariffs or delivery commitments.
            </p>
            <div className="shipment-service-options">
              {services.map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  aria-pressed={service === entry.id}
                  onClick={() => {
                    setService(entry.id);
                    clearFeedback();
                  }}
                >
                  <span>
                    <strong>{entry.name}</strong>
                    <span>{entry.description} Sample estimate only.</span>
                  </span>
                  <strong>${entry.price.toFixed(2)}</strong>
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 5 && (
          <div>
            <h2 id="shipment-step-title">Review your shipment plan</h2>
            <p className="workspace-panel-intro">
              Save a local record or take a brief to the official carrier tools. Payment details are
              not collected.
            </p>
            <dl className="shipment-review">
              <div>
                <dt>From</dt>
                <dd>
                  {from.name}
                  <br />
                  {from.street}
                  <br />
                  {from.city}, {from.state} {from.zip}
                </dd>
              </div>
              <div>
                <dt>To</dt>
                <dd>
                  {to.name}
                  <br />
                  {to.street}
                  <br />
                  {to.city}, {to.state} {to.zip}
                </dd>
              </div>
              <div>
                <dt>Planned package</dt>
                <dd>
                  {weight} lb · {packaging}
                  <br />
                  {dimensions.length && dimensions.width && dimensions.height
                    ? `${dimensions.length} × ${dimensions.width} × ${dimensions.height} in`
                    : 'No dimensions provided'}
                </dd>
              </div>
              <div>
                <dt>Planned date &amp; service</dt>
                <dd>
                  {shipDate}
                  <br />
                  {selectedService?.name}
                </dd>
              </div>
              <div>
                <dt>Illustrative estimate</dt>
                <dd>
                  ${selectedService?.price.toFixed(2)}
                  <span>Not a current carrier quote or an amount owed.</span>
                </dd>
              </div>
            </dl>
            <ServiceNotice title="What gets saved">
              Workspace records contain the recipient, ZIP codes, weight, service, date, and package
              notes. Download the brief for full address details. Photos are never persisted.
              Nothing is submitted to a carrier.
            </ServiceNotice>
            <div className="shipment-review-actions">
              <button
                type="button"
                className="brand-button brand-button-outline"
                onClick={download}
              >
                <Download size={17} aria-hidden="true" />
                Download planning brief
              </button>
              {user ? (
                <Link to="/dashboard?tab=plans" className="service-text-link">
                  View saved plans
                </Link>
              ) : (
                <p>
                  Sign in before starting a future plan to save it to a workspace.{' '}
                  <Link className="service-text-link" to="/login">
                    Workspace access
                  </Link>
                </p>
              )}
              <ExternalLink href="https://www.fedex.com/en-us/shipping/ship-manager/login.html">
                Continue to official shipping tools
              </ExternalLink>
            </div>
          </div>
        )}
        {error && (
          <p className="workspace-feedback error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="workspace-feedback" role="status">
            {message}
          </p>
        )}
        {!isValid && step < 5 && (
          <p className="shipment-help">
            {step < 3
              ? 'Complete required fields and enter a valid U.S. ZIP code to continue.'
              : step === 3
                ? 'Enter a weight from 0.1–150 lb, a valid future date, and either all dimensions (0.1–108 in) or none.'
                : 'Choose a service to continue.'}
          </p>
        )}
        <div className="shipment-navigation">
          <button
            type="button"
            className="brand-button brand-button-outline"
            onClick={() => go(step - 1)}
            disabled={step === 1}
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Back
          </button>
          {step < 5 ? (
            <button
              type="button"
              className="brand-button workspace-primary"
              onClick={() => go(step + 1)}
              disabled={!isValid}
            >
              Next
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ) : (
            user && (
              <button
                type="button"
                className="brand-button workspace-primary"
                onClick={save}
                disabled={!isValid || saving}
              >
                <CheckCircle size={17} aria-hidden="true" />
                {saving ? 'Saving plan…' : savedId ? 'Update saved plan' : 'Save to my workspace'}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
