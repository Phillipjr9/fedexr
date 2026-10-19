import { useState, type FormEvent } from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { useWorkspace } from '@/context/workspace';
import { localDate, sampleServices } from '@/lib/shipping';
import { generateRouteAddresses } from '@/lib/addressGenerator';
import { fileToShipmentPhoto } from '@/lib/shipmentPhoto';
import {
  AUTO_PROGRESS_INTERVAL_OPTIONS,
  generateTrackingNumber,
  holdReasonLabel,
  publicShipmentHoldReasonGroups,
  publicShipmentStatusOptions,
} from '@/lib/publicShipments';
import type {
  PublicShipment,
  PublicShipmentEvent,
  PublicShipmentInput,
  PublicShipmentUpdateInput,
} from '@/lib/workspace';
import { useReturnFocus } from './WorkspaceEditors';

function localDateTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function HoldReasonSelect({
  id,
  value,
  onChange,
  required = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <select
      id={id}
      required={required}
      title={value ? holdReasonLabel(value) : 'Choose a hold reason'}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Choose a hold reason…</option>
      {publicShipmentHoldReasonGroups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((reason) => (
            <option key={reason.id} value={reason.id}>
              {reason.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function ShipmentPhotoField({
  id,
  value,
  onChange,
  label = 'Public stage photo (optional)',
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function select(file: File | undefined) {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      onChange(await fileToShipmentPhoto(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The photo could not be prepared.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="service-field workspace-field-wide">
      <label htmlFor={id}>{label}</label>
      <div className="workspace-photo-field">
        {value && (
          <img className="workspace-photo-preview" src={value} alt="Attached shipment stage photo" />
        )}
        <div className="workspace-photo-actions">
          <input
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(change) => {
              void select(change.target.files?.[0]);
              change.target.value = '';
            }}
          />
          {value && (
            <button
              type="button"
              className="brand-button brand-button-outline workspace-photo-remove"
              onClick={() => onChange('')}
            >
              Remove photo
            </button>
          )}
        </div>
      </div>
      {busy && <small role="status">Preparing photo…</small>}
      {error && (
        <p className="service-form-error" role="alert">
          {error}
        </p>
      )}
      <small>
        Shown publicly on the tracking result for this stage — anyone with the tracking number can
        see it. Large photos are resized before they are saved.
      </small>
    </div>
  );
}

export function PublicShipmentEditor({
  record,
  onClose,
  onSaved,
}: {
  record?: PublicShipment;
  onClose: () => void;
  onSaved: (shipment: PublicShipment) => void;
}) {
  const { data, savePublicShipment, mode } = useWorkspace();
  const returnFocus = useReturnFocus();
  const [input, setInput] = useState<PublicShipmentInput>(
    record
      ? { ...record, photo: '' }
      : {
          trackingNumber: '',
          userId: null,
          recipientLabel: '',
          originCity: '',
          originRegion: '',
          originPostalCode: '',
          destinationCity: '',
          destinationRegion: '',
          destinationPostalCode: '',
          service: 'ground',
          weight: '',
          shipDate: localDate(),
          estimatedDelivery: '',
          status: 'label_created',
          currentLocation: '',
          holdReason: '',
          publicNote: '',
          isPublic: true,
          autoProgressEnabled: false,
          autoProgressIntervalMinutes: 5,
          photo: '',
        },
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [trackingGenerated, setTrackingGenerated] = useState(false);
  const [routeSummary, setRouteSummary] = useState('');
  const customers = data.users.filter(
    (profile) => profile.status === 'active' && profile.role === 'member',
  );

  function generateRoute() {
    const route = generateRouteAddresses();
    setInput((previous) => ({
      ...previous,
      recipientLabel: previous.recipientLabel.trim() || route.recipientName,
      originCity: route.origin.city,
      originRegion: route.origin.region,
      originPostalCode: route.origin.postalCode,
      destinationCity: route.destination.city,
      destinationRegion: route.destination.region,
      destinationPostalCode: route.destination.postalCode,
      currentLocation:
        previous.status === 'label_created' || !previous.currentLocation
          ? `${route.origin.city}, ${route.origin.region}`
          : previous.currentLocation,
    }));
    setRouteSummary(
      `${route.origin.city}, ${route.origin.region} ${route.origin.postalCode} → ` +
        `${route.destination.city}, ${route.destination.region} ${route.destination.postalCode}` +
        ` (about ${route.distanceMiles.toLocaleString('en-US')} mi)`,
    );
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const shipment = await savePublicShipment(
        {
          ...input,
          trackingNumber: input.trackingNumber.trim().toUpperCase(),
          userId: input.userId || null,
        },
        record?.id,
      );
      onSaved(shipment);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The public shipment could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof PublicShipmentInput>(key: K, value: PublicShipmentInput[K]) {
    setInput((previous) => ({ ...previous, [key]: value }));
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="workspace-dialog service-page" onCloseAutoFocus={returnFocus}>
        <DialogTitle>{record ? 'Edit public shipment' : 'Create shipment for tracking'}</DialogTitle>
        <DialogDescription>
          This creates a shipment record and its public tracking page.
          {mode === 'browser'
            ? ' In this preview it is stored in this browser.'
            : ' It is stored in the shared account database.'}
        </DialogDescription>
        <form onSubmit={submit} noValidate>
          <div className="workspace-generate-address">
            <button
              type="button"
              className="brand-button brand-button-outline"
              onClick={generateRoute}
            >
              <Sparkles size={16} aria-hidden="true" />
              Auto-fill route (free)
            </button>
            <p className="workspace-muted">
              Fills origin and destination from the bundled city list in your browser. No address
              lookup service is called, so autocomplete and auto-fill stay free with no per-use
              charge.
            </p>
            {routeSummary && (
              <p className="workspace-muted" role="status">
                Route filled in — {routeSummary}. Adjust any field, then save and monitor the
                shipment on the public tracking page.
              </p>
            )}
          </div>
          <div className="workspace-form-grid">
            <div className="service-field">
              <label htmlFor="shipment-user">Workspace customer (optional)</label>
              <select
                id="shipment-user"
                value={input.userId || ''}
                onChange={(event) => {
                  const userId = event.target.value || null;
                  set('userId', userId);
                  const customer = customers.find((profile) => profile.id === userId);
                  if (customer && !input.recipientLabel.trim()) set('recipientLabel', customer.name);
                }}
              >
                <option value="">No assigned account — guest/customer label</option>
                {customers.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} — {profile.email}
                  </option>
                ))}
              </select>
              <small>Assigned customers also see it in their workspace.</small>
            </div>
            <div className="service-field">
              <label htmlFor="shipment-recipient">Recipient / shipment label *</label>
              <input
                id="shipment-recipient"
                value={input.recipientLabel}
                onChange={(event) => set('recipientLabel', event.target.value)}
                maxLength={100}
                required
                autoComplete="off"
              />
              <small>Use a public-safe name or order label. Do not enter a street address.</small>
            </div>
            <div className="service-field workspace-field-wide">
              <label htmlFor="shipment-service">Service</label>
              <select
                id="shipment-service"
                value={input.service}
                onChange={(event) => {
                  const service = event.target.value as PublicShipmentInput['service'];
                  set('service', service);
                  if (trackingGenerated) set('trackingNumber', generateTrackingNumber(service));
                }}
              >
                {sampleServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              <small>Choose the service first so Generate uses the matching number length.</small>
            </div>
            <div className="service-field workspace-field-wide">
              <label htmlFor="shipment-tracking">Tracking number</label>
              <div className="workspace-passphrase-field">
                <input
                  id="shipment-tracking"
                  value={input.trackingNumber}
                  onChange={(event) => {
                    setTrackingGenerated(false);
                    set('trackingNumber', event.target.value);
                  }}
                  maxLength={40}
                  placeholder="Leave blank to generate"
                  autoComplete="off"
                />
                <button
                  type="button"
                  aria-label="Generate tracking number"
                  onClick={() => {
                    setTrackingGenerated(true);
                    set('trackingNumber', generateTrackingNumber(input.service));
                  }}
                >
                  <RefreshCw size={18} aria-hidden="true" />
                </button>
              </div>
              <small>
                Generated application numbers look like FedEx numbers—15 digits for Ground or 12
                digits for Express-style services. They are not issued by FedEx. Customers track
                this exact number on the public tracking page.
              </small>
            </div>
            <div className="service-field">
              <AddressAutocomplete
                id="shipment-origin-city"
                label="Origin city *"
                value={input.originCity}
                required
                placeholder="Start typing a city or ZIP…"
                helpText="Free autocomplete — pick a city to fill in the state and ZIP automatically."
                onChange={(city) => set('originCity', city)}
                onSelect={(place) => {
                  setInput((previous) => ({
                    ...previous,
                    originCity: place.city,
                    originRegion: place.region,
                    originPostalCode: place.postalCode,
                    currentLocation:
                      !previous.currentLocation.trim() ||
                      previous.status === 'label_created'
                        ? `${place.city}, ${place.region}`
                        : previous.currentLocation,
                  }));
                }}
              />
            </div>
            <div className="service-field">
              <AddressAutocomplete
                id="shipment-destination-city"
                label="Destination city *"
                value={input.destinationCity}
                required
                placeholder="Start typing a city or ZIP…"
                helpText="Free autocomplete — pick a city to fill in the state and ZIP automatically."
                onChange={(city) => set('destinationCity', city)}
                onSelect={(place) =>
                  setInput((previous) => ({
                    ...previous,
                    destinationCity: place.city,
                    destinationRegion: place.region,
                    destinationPostalCode: place.postalCode,
                  }))
                }
              />
            </div>
            <div className="service-field">
              <label htmlFor="shipment-origin-region">Origin state / region</label>
              <input
                id="shipment-origin-region"
                value={input.originRegion}
                onChange={(event) => set('originRegion', event.target.value)}
                maxLength={40}
              />
            </div>
            <div className="service-field">
              <label htmlFor="shipment-destination-region">Destination state / region</label>
              <input
                id="shipment-destination-region"
                value={input.destinationRegion}
                onChange={(event) => set('destinationRegion', event.target.value)}
                maxLength={40}
              />
            </div>
            <div className="service-field">
              <label htmlFor="shipment-origin-postal">Origin ZIP code *</label>
              <input
                id="shipment-origin-postal"
                value={input.originPostalCode}
                onChange={(event) => set('originPostalCode', event.target.value)}
                maxLength={10}
                required
              />
            </div>
            <div className="service-field">
              <label htmlFor="shipment-destination-postal">Destination ZIP code *</label>
              <input
                id="shipment-destination-postal"
                value={input.destinationPostalCode}
                onChange={(event) => set('destinationPostalCode', event.target.value)}
                maxLength={10}
                required
              />
            </div>
            <div className="service-field">
              <label htmlFor="shipment-weight">Weight (lb, optional)</label>
              <input
                id="shipment-weight"
                type="number"
                min="0.1"
                max="150"
                step="0.1"
                value={input.weight}
                onChange={(event) => set('weight', event.target.value)}
              />
            </div>
            <div className="service-field">
              <label htmlFor="shipment-ship-date">Ship date *</label>
              <input
                id="shipment-ship-date"
                type="date"
                value={input.shipDate}
                onChange={(event) => set('shipDate', event.target.value)}
                required
              />
            </div>
            <div className="service-field">
              <label htmlFor="shipment-estimated-delivery">Estimated delivery</label>
              <input
                id="shipment-estimated-delivery"
                type="date"
                value={input.estimatedDelivery}
                onChange={(event) => set('estimatedDelivery', event.target.value)}
              />
            </div>
            <div className="service-field">
              <label htmlFor="shipment-status">Current status</label>
              <select
                id="shipment-status"
                value={input.status}
                onChange={(event) => {
                  const status = event.target.value as PublicShipmentInput['status'];
                  setInput((previous) => ({
                    ...previous,
                    status,
                    holdReason: status === 'on_hold' ? previous.holdReason : '',
                  }));
                }}
              >
                {publicShipmentStatusOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {input.status === 'on_hold' && (
              <div className="service-field workspace-field-wide">
                <label htmlFor="shipment-hold-reason">Hold reason *</label>
                <HoldReasonSelect
                  id="shipment-hold-reason"
                  required
                  value={input.holdReason}
                  onChange={(holdReason) => set('holdReason', holdReason)}
                />
                <small>
                  This reason is shown directly as the issue on the public tracking page. Do not put
                  private information in the public note.
                </small>
              </div>
            )}
            <div className="service-field">
              <AddressAutocomplete
                id="shipment-current-location"
                label="Current location *"
                value={input.currentLocation}
                required
                maxLength={120}
                placeholder="Start typing a city or ZIP…"
                onChange={(city) => set('currentLocation', city)}
                onSelect={(place) => set('currentLocation', `${place.city}, ${place.region}`)}
              />
            </div>
            <div className="service-field workspace-field-wide">
              <label htmlFor="shipment-public-note">Public note (optional)</label>
              <textarea
                id="shipment-public-note"
                rows={3}
                value={input.publicNote}
                onChange={(event) => set('publicNote', event.target.value)}
                maxLength={500}
              />
              <small>This note is visible to anyone who has the tracking number.</small>
            </div>
            {(input.status === 'in_transit' || input.status === 'delivered') && (
              <ShipmentPhotoField
                id="shipment-stage-photo"
                value={input.photo}
                onChange={(photo) => set('photo', photo)}
              />
            )}
          </div>
          <label className="workspace-checkbox">
            <input
              type="checkbox"
              checked={input.isPublic}
              onChange={(event) => set('isPublic', event.target.checked)}
            />
            Make this shipment trackable publicly by tracking number
          </label>
          <label className="workspace-checkbox">
            <input
              type="checkbox"
              checked={input.autoProgressEnabled && input.status !== 'delivered'}
              disabled={input.status === 'delivered'}
              onChange={(event) => set('autoProgressEnabled', event.target.checked)}
            />
            Automatically advance this shipment through its route stages
          </label>
          {input.autoProgressEnabled && input.status !== 'delivered' && (
            <div className="service-field">
              <label htmlFor="shipment-auto-progress-interval">Automatic update interval</label>
              <select
                id="shipment-auto-progress-interval"
                value={input.autoProgressIntervalMinutes}
                onChange={(event) =>
                  set('autoProgressIntervalMinutes', Number(event.target.value))
                }
              >
                {AUTO_PROGRESS_INTERVAL_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes === 1
                      ? 'Every minute'
                      : minutes < 60
                        ? `Every ${minutes} minutes`
                        : minutes === 60
                          ? 'Every hour'
                          : minutes === 360
                            ? 'Every 6 hours'
                            : 'Every 24 hours'}
                  </option>
                ))}
              </select>
              <small>
                Each automatic update is labeled on the public tracking page. Any manual status
                change pauses it.
              </small>
            </div>
          )}
          {error && (
            <p className="service-form-error" role="alert">
              {error}
            </p>
          )}
          <div className="workspace-form-actions">
            <button type="button" className="brand-button brand-button-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="brand-button workspace-primary" disabled={saving}>
              {saving ? 'Saving shipment…' : record ? 'Save shipment' : 'Create shipment'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PublicShipmentUpdateEditor({
  shipment,
  onClose,
  onSaved,
}: {
  shipment: PublicShipment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { addPublicShipmentUpdate } = useWorkspace();
  const returnFocus = useReturnFocus();
  const [input, setInput] = useState<PublicShipmentUpdateInput>({
    status: shipment.status,
    location: shipment.currentLocation,
    note: '',
    holdReason: shipment.status === 'on_hold' ? shipment.holdReason : '',
    photo: '',
    at: localDateTime(),
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await addPublicShipmentUpdate(shipment.id, {
        ...input,
        at: new Date(input.at).toISOString(),
      });
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The tracking update could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="workspace-dialog service-page" onCloseAutoFocus={returnFocus}>
        <DialogTitle>Modify shipping status</DialogTitle>
        <DialogDescription>
          Manually set the status, location, and event time. The change appears immediately on the
          public tracking page for {shipment.trackingNumber}.
        </DialogDescription>
        <form onSubmit={submit} noValidate>
          <div className="workspace-form-grid">
            <div className="service-field">
              <label htmlFor="shipment-update-status">New status</label>
              <select
                id="shipment-update-status"
                value={input.status}
                onChange={(event) => {
                  const status = event.target.value as PublicShipmentUpdateInput['status'];
                  setInput((previous) => ({
                    ...previous,
                    status,
                    holdReason: status === 'on_hold' ? previous.holdReason : '',
                  }));
                }}
              >
                {publicShipmentStatusOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {input.status === 'on_hold' && (
              <div className="service-field workspace-field-wide">
                <label htmlFor="shipment-update-hold-reason">Hold reason *</label>
                <HoldReasonSelect
                  id="shipment-update-hold-reason"
                  required
                  value={input.holdReason}
                  onChange={(holdReason) =>
                    setInput((previous) => ({ ...previous, holdReason }))
                  }
                />
                <small>The selected issue appears directly on the public tracking result.</small>
              </div>
            )}
            <div className="service-field">
              <label htmlFor="shipment-update-location">Location *</label>
              <input
                id="shipment-update-location"
                value={input.location}
                onChange={(event) =>
                  setInput((previous) => ({ ...previous, location: event.target.value }))
                }
                maxLength={120}
                required
              />
            </div>
            <div className="service-field">
              <label htmlFor="shipment-update-at">Event date and time</label>
              <input
                id="shipment-update-at"
                type="datetime-local"
                value={input.at}
                onChange={(event) =>
                  setInput((previous) => ({ ...previous, at: event.target.value }))
                }
              />
            </div>
            <div className="service-field workspace-field-wide">
              <label htmlFor="shipment-update-note">Public update note</label>
              <textarea
                id="shipment-update-note"
                rows={3}
                value={input.note}
                onChange={(event) =>
                  setInput((previous) => ({ ...previous, note: event.target.value }))
                }
                maxLength={500}
                placeholder="Example: Arrived at the destination facility"
              />
            </div>
            {(input.status === 'in_transit' || input.status === 'delivered') && (
              <ShipmentPhotoField
                id="shipment-update-photo"
                value={input.photo}
                onChange={(photo) => setInput((previous) => ({ ...previous, photo }))}
              />
            )}
          </div>
          {error && (
            <p className="service-form-error" role="alert">
              {error}
            </p>
          )}
          <div className="workspace-form-actions">
            <button type="button" className="brand-button brand-button-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="brand-button workspace-primary" disabled={saving}>
              {saving ? 'Saving status…' : 'Save status update'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function localDateTimeValue(value: string) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function PublicShipmentEventEditor({
  shipment,
  event,
  onClose,
  onSaved,
}: {
  shipment: PublicShipment;
  event: PublicShipmentEvent;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { updatePublicShipmentEvent } = useWorkspace();
  const returnFocus = useReturnFocus();
  const [input, setInput] = useState<PublicShipmentUpdateInput>({
    status: event.status,
    location: event.location,
    note: event.note,
    holdReason: event.status === 'on_hold' ? event.holdReason || '' : '',
    photo: event.photo || '',
    at: localDateTimeValue(event.at),
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await updatePublicShipmentEvent(shipment.id, event.id, {
        ...input,
        at: new Date(input.at).toISOString(),
      });
      onSaved();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The tracking event could not be corrected.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="workspace-dialog service-page" onCloseAutoFocus={returnFocus}>
        <DialogTitle>Correct tracking event</DialogTitle>
        <DialogDescription>
          Correct the public event for {shipment.trackingNumber}. If this is the latest event, the
          shipment’s current status and location are recalculated from the corrected timeline.
        </DialogDescription>
        <form onSubmit={submit} noValidate>
          <div className="workspace-form-grid">
            <div className="service-field">
              <label htmlFor={`shipment-event-status-${event.id}`}>Event status</label>
              <select
                id={`shipment-event-status-${event.id}`}
                value={input.status}
                onChange={(change) => {
                  const status = change.target.value as PublicShipmentUpdateInput['status'];
                  setInput((previous) => ({
                    ...previous,
                    status,
                    holdReason: status === 'on_hold' ? previous.holdReason : '',
                  }));
                }}
              >
                {publicShipmentStatusOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {input.status === 'on_hold' && (
              <div className="service-field workspace-field-wide">
                <label htmlFor={`shipment-event-hold-reason-${event.id}`}>Hold reason *</label>
                <HoldReasonSelect
                  id={`shipment-event-hold-reason-${event.id}`}
                  required
                  value={input.holdReason}
                  onChange={(holdReason) =>
                    setInput((previous) => ({ ...previous, holdReason }))
                  }
                />
                <small>If this becomes the latest event, this issue is shown publicly.</small>
              </div>
            )}
            <div className="service-field">
              <label htmlFor={`shipment-event-location-${event.id}`}>Location *</label>
              <input
                id={`shipment-event-location-${event.id}`}
                value={input.location}
                onChange={(change) =>
                  setInput((previous) => ({ ...previous, location: change.target.value }))
                }
                maxLength={120}
                required
              />
            </div>
            <div className="service-field">
              <label htmlFor={`shipment-event-at-${event.id}`}>Event date and time</label>
              <input
                id={`shipment-event-at-${event.id}`}
                type="datetime-local"
                value={input.at}
                onChange={(change) =>
                  setInput((previous) => ({ ...previous, at: change.target.value }))
                }
              />
            </div>
            <div className="service-field workspace-field-wide">
              <label htmlFor={`shipment-event-note-${event.id}`}>Public event note</label>
              <textarea
                id={`shipment-event-note-${event.id}`}
                rows={3}
                value={input.note}
                onChange={(change) =>
                  setInput((previous) => ({ ...previous, note: change.target.value }))
                }
                maxLength={500}
              />
            </div>
            {(input.status === 'in_transit' || input.status === 'delivered') && (
              <ShipmentPhotoField
                id={`shipment-event-photo-${event.id}`}
                value={input.photo}
                onChange={(photo) => setInput((previous) => ({ ...previous, photo }))}
              />
            )}
          </div>
          {error && (
            <p className="service-form-error" role="alert">
              {error}
            </p>
          )}
          <div className="workspace-form-actions">
            <button type="button" className="brand-button brand-button-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="brand-button workspace-primary" disabled={saving}>
              {saving ? 'Saving correction…' : 'Save event correction'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
