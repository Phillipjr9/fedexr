import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileDown, PackagePlus, ShieldAlert } from 'lucide-react';
import {
  createCarrierShipment,
  type CarrierPartyInput,
  type CarrierShipmentInput,
  type CarrierShipmentResult,
  type CarrierStatus,
} from '@/lib/carrier';
import { localDate } from '@/lib/shipping';

interface PartyForm {
  name: string;
  phone: string;
  company: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  residential: boolean;
}

const emptyParty = (): PartyForm => ({
  name: '',
  phone: '',
  company: '',
  street: '',
  city: '',
  state: '',
  postalCode: '',
  residential: false,
});

function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  maxLength,
  required = true,
  inputMode,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  maxLength: number;
  required?: boolean;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel';
  autoComplete?: string;
}) {
  return (
    <div className="service-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        required={required}
        inputMode={inputMode}
        autoComplete={autoComplete}
      />
    </div>
  );
}

function PartyFields({
  prefix,
  title,
  value,
  onChange,
}: {
  prefix: 'shipper' | 'recipient';
  title: string;
  value: PartyForm;
  onChange: (value: PartyForm) => void;
}) {
  const update = (key: keyof PartyForm, next: string | boolean) =>
    onChange({ ...value, [key]: next });
  return (
    <fieldset className="workspace-carrier-party">
      <legend>{title}</legend>
      <div className="workspace-form-grid">
        <TextField
          id={`${prefix}-name`}
          label={`${title} name`}
          value={value.name}
          onChange={(next) => update('name', next)}
          maxLength={100}
          autoComplete="name"
        />
        <TextField
          id={`${prefix}-phone`}
          label={`${title} phone`}
          value={value.phone}
          onChange={(next) => update('phone', next)}
          type="tel"
          maxLength={25}
          inputMode="tel"
          autoComplete="tel"
        />
        <TextField
          id={`${prefix}-company`}
          label={`${title} company (optional)`}
          value={value.company}
          onChange={(next) => update('company', next)}
          maxLength={100}
          required={false}
          autoComplete="organization"
        />
        <TextField
          id={`${prefix}-street`}
          label={`${title} street address`}
          value={value.street}
          onChange={(next) => update('street', next)}
          maxLength={100}
          autoComplete="street-address"
        />
        <TextField
          id={`${prefix}-city`}
          label={`${title} city`}
          value={value.city}
          onChange={(next) => update('city', next)}
          maxLength={100}
          autoComplete="address-level2"
        />
        <TextField
          id={`${prefix}-state`}
          label={`${title} state`}
          value={value.state}
          onChange={(next) => update('state', next.toUpperCase())}
          maxLength={2}
          autoComplete="address-level1"
        />
        <TextField
          id={`${prefix}-postal`}
          label={`${title} ZIP code`}
          value={value.postalCode}
          onChange={(next) => update('postalCode', next)}
          maxLength={10}
          inputMode="numeric"
          autoComplete="postal-code"
        />
      </div>
      <label className="workspace-checkbox" htmlFor={`${prefix}-residential`}>
        <input
          id={`${prefix}-residential`}
          type="checkbox"
          checked={value.residential}
          onChange={(event) => update('residential', event.target.checked)}
        />
        {title} address is residential
      </label>
    </fieldset>
  );
}

function partyInput(value: PartyForm): CarrierPartyInput {
  return {
    name: value.name.trim(),
    phone: value.phone.trim(),
    ...(value.company.trim() ? { company: value.company.trim() } : {}),
    street: value.street.trim(),
    city: value.city.trim(),
    state: value.state.trim().toUpperCase(),
    postalCode: value.postalCode.trim(),
    countryCode: 'US',
    residential: value.residential,
  };
}

function downloadEncodedLabel(result: CarrierShipmentResult) {
  const binary = window.atob(result.label.encodedLabel);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const format = result.label.format.toUpperCase();
  const type = format === 'PNG' ? 'image/png' : format === 'ZPLII' ? 'text/plain' : 'application/pdf';
  const extension = format === 'PNG' ? 'png' : format === 'ZPLII' ? 'zpl' : 'pdf';
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `fedex-label-${result.trackingNumber}.${extension}`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CarrierShipmentPanel({
  status,
  mode,
}: {
  status: CarrierStatus;
  mode: 'browser' | 'server';
}) {
  const [open, setOpen] = useState(false);
  const [shipper, setShipper] = useState(emptyParty);
  const [recipient, setRecipient] = useState(emptyParty);
  const [serviceType, setServiceType] = useState('FEDEX_GROUND');
  const [packagingType, setPackagingType] = useState('YOUR_PACKAGING');
  const [pickupType, setPickupType] = useState('DROPOFF_AT_FEDEX_LOCATION');
  const [shipDate, setShipDate] = useState(localDate);
  const [weightLb, setWeightLb] = useState('1');
  const [labelImageType, setLabelImageType] = useState<'PDF' | 'PNG' | 'ZPLII'>('PDF');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CarrierShipmentResult | null>(null);

  if (!status.shipmentCreationEnabled) return null;
  if (mode !== 'server') {
    return (
      <div className="workspace-carrier-create">
        <h3>Official shipment creation</h3>
        <p className="workspace-muted">
          FedEx shipment creation is enabled on the server, but it requires this dashboard to be
          opened in server mode with a verified administrator session. Browser-local administrator
          access cannot submit a FedEx shipment.
        </p>
      </div>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const input: CarrierShipmentInput = {
        serviceType,
        packagingType,
        pickupType,
        shipDate,
        weightLb: Number(weightLb),
        labelImageType,
        shipper: partyInput(shipper),
        recipient: partyInput(recipient),
      };
      const created = await createCarrierShipment(input);
      setResult(created);
      setConfirmed(false);
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : 'FedEx shipment creation failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-carrier-create">
      <div className="workspace-carrier-create-heading">
        <div>
          <h3>Create an official FedEx shipment</h3>
          <p>
            This is separate from application public shipments. Submitting sends the shipment to
            FedEx in the configured {status.environment} environment.
          </p>
        </div>
        <button
          type="button"
          className="brand-button brand-button-outline"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <PackagePlus size={17} aria-hidden="true" />
          {open ? 'Hide shipment form' : 'Create official FedEx shipment'}
        </button>
      </div>
      {status.environment === 'production' && (
        <p className="workspace-carrier-warning">
          <ShieldAlert size={17} aria-hidden="true" /> Production is live. A successful submission
          can create a real, billable FedEx shipment and label on the configured account.
        </p>
      )}
      {open && (
        <form className="workspace-carrier-form" onSubmit={submit}>
          <div className="workspace-form-grid">
            <div className="service-field">
              <label htmlFor="carrier-service-type">FedEx service</label>
              <select
                id="carrier-service-type"
                value={serviceType}
                onChange={(event) => setServiceType(event.target.value)}
              >
                <option value="FEDEX_GROUND">FedEx Ground</option>
                <option value="FEDEX_EXPRESS_SAVER">FedEx Express Saver</option>
                <option value="FEDEX_2_DAY">FedEx 2Day</option>
                <option value="FEDEX_2_DAY_AM">FedEx 2Day A.M.</option>
                <option value="STANDARD_OVERNIGHT">FedEx Standard Overnight</option>
                <option value="PRIORITY_OVERNIGHT">FedEx Priority Overnight</option>
                <option value="FIRST_OVERNIGHT">FedEx First Overnight</option>
              </select>
            </div>
            <div className="service-field">
              <label htmlFor="carrier-packaging-type">Packaging</label>
              <select
                id="carrier-packaging-type"
                value={packagingType}
                onChange={(event) => setPackagingType(event.target.value)}
              >
                <option value="YOUR_PACKAGING">Your packaging</option>
                <option value="FEDEX_BOX">FedEx Box</option>
                <option value="FEDEX_PAK">FedEx Pak</option>
                <option value="FEDEX_TUBE">FedEx Tube</option>
                <option value="FEDEX_ENVELOPE">FedEx Envelope</option>
              </select>
            </div>
            <div className="service-field">
              <label htmlFor="carrier-pickup-type">Pickup</label>
              <select
                id="carrier-pickup-type"
                value={pickupType}
                onChange={(event) => setPickupType(event.target.value)}
              >
                <option value="DROPOFF_AT_FEDEX_LOCATION">Drop off at FedEx location</option>
                <option value="REGULAR_PICKUP">Regular pickup</option>
                <option value="REQUEST_COURIER">Request courier</option>
              </select>
            </div>
            <TextField
              id="carrier-ship-date"
              label="Ship date"
              value={shipDate}
              onChange={setShipDate}
              type="date"
              maxLength={10}
            />
            <TextField
              id="carrier-weight"
              label="Package weight (lb)"
              value={weightLb}
              onChange={setWeightLb}
              type="number"
              maxLength={8}
              inputMode="decimal"
            />
            <div className="service-field">
              <label htmlFor="carrier-label-format">Label format</label>
              <select
                id="carrier-label-format"
                value={labelImageType}
                onChange={(event) => setLabelImageType(event.target.value as 'PDF' | 'PNG' | 'ZPLII')}
              >
                <option value="PDF">PDF</option>
                <option value="PNG">PNG</option>
                <option value="ZPLII">ZPLII</option>
              </select>
            </div>
          </div>
          <div className="workspace-carrier-parties">
            <PartyFields prefix="shipper" title="Shipper" value={shipper} onChange={setShipper} />
            <PartyFields
              prefix="recipient"
              title="Recipient"
              value={recipient}
              onChange={setRecipient}
            />
          </div>
          <label className="workspace-checkbox" htmlFor="carrier-create-confirmation">
            <input
              id="carrier-create-confirmation"
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              required
            />
            {status.environment === 'production'
              ? 'I understand this submits a real shipment to FedEx and may create charges on the configured FedEx account.'
              : 'I understand this submits a test shipment to the FedEx sandbox.'}
          </label>
          {error && (
            <p className="workspace-feedback error" role="alert">
              {error}
            </p>
          )}
          <div className="workspace-form-actions">
            <button
              type="submit"
              className="brand-button workspace-primary"
              disabled={busy || !confirmed}
            >
              {busy ? 'Submitting to FedEx…' : 'Submit shipment to FedEx'}
            </button>
          </div>
        </form>
      )}
      {result && (
        <div className="workspace-carrier-result" role="status">
          <h3>FedEx shipment created</h3>
          <p>
            Tracking number: <strong>{result.trackingNumber}</strong>
            {result.serviceType ? ` · ${result.serviceType}` : ''}
          </p>
          <p>
            This carrier shipment was not automatically added to the application’s public-shipment
            registry. Keep the two records separate unless you intentionally create a public
            application record with this tracking number.
          </p>
          <div className="workspace-form-actions">
            {result.label.url && (
              <a
                className="brand-button brand-button-outline"
                href={result.label.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open FedEx label <ExternalLink size={15} aria-hidden="true" />
              </a>
            )}
            {result.label.encodedLabel && (
              <button
                type="button"
                className="brand-button brand-button-outline"
                onClick={() => downloadEncodedLabel(result)}
              >
                <FileDown size={16} aria-hidden="true" /> Download FedEx label
              </button>
            )}
            <Link
              className="brand-button workspace-primary"
              to={`/tracking?number=${encodeURIComponent(result.trackingNumber)}`}
            >
              Track both sources
            </Link>
            <Link className="brand-button brand-button-outline" to="/admin/settings?tab=shipments">
              Open application shipments
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
