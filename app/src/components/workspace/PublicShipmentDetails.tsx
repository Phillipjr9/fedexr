import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  ArchiveRestore,
  Copy,
  ExternalLink,
  Files,
  Pencil,
  PlusCircle,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useWorkspace } from '@/context/workspace';
import { sampleServices } from '@/lib/shipping';
import {
  AUTO_PROGRESS_INTERVAL_OPTIONS,
  holdReasonLabel,
  placeLabel,
  shipmentStatusLabel,
  sortedShipmentEvents,
} from '@/lib/publicShipments';
import type { PublicShipment, PublicShipmentEvent } from '@/lib/workspace';
import { ConfirmRemove, useReturnFocus } from './WorkspaceEditors';
import {
  PublicShipmentEventEditor,
  PublicShipmentUpdateEditor,
} from './PublicShipmentEditors';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDate(value: string) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
    new Date(`${value}T12:00:00`),
  );
}

export default function PublicShipmentDetails({
  shipment,
  customerName,
  onClose,
  onEdit,
  onChanged,
  onDuplicated,
}: {
  shipment: PublicShipment;
  customerName: string;
  onClose: () => void;
  onEdit: () => void;
  onChanged: (message: string) => void;
  onDuplicated: (shipment: PublicShipment) => void;
}) {
  const {
    removePublicShipmentEvent,
    undoPublicShipmentUpdate,
    savePublicShipmentInternalNote,
    setPublicShipmentArchived,
    setPublicShipmentVisibility,
    setPublicShipmentAutoProgress,
    duplicatePublicShipment,
  } = useWorkspace();
  const returnFocus = useReturnFocus();
  const [internalNote, setInternalNote] = useState(shipment.internalNote);
  const [autoInterval, setAutoInterval] = useState(shipment.autoProgressIntervalMinutes || 5);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [addingUpdate, setAddingUpdate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PublicShipmentEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<PublicShipmentEvent | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const events = [...sortedShipmentEvents(shipment)].reverse();
  const latestEvent = sortedShipmentEvents(shipment).at(-1);
  const service = sampleServices.find((entry) => entry.id === shipment.service);
  const publicAvailable = shipment.isPublic && !shipment.archivedAt;

  async function run(action: string, task: () => Promise<void> | void, success: string) {
    if (busy) return;
    setBusy(action);
    setError('');
    try {
      await task();
      setMessage(success);
      onChanged(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The shipment operation could not be completed.');
    } finally {
      setBusy('');
    }
  }

  async function copyLink() {
    const link = `${window.location.origin}/tracking?number=${encodeURIComponent(shipment.trackingNumber)}`;
    try {
      await navigator.clipboard.writeText(link);
      setMessage(`Public tracking link copied for ${shipment.trackingNumber}.`);
    } catch {
      setMessage(`Public tracking link: ${link}`);
    }
    setError('');
  }

  async function duplicate() {
    if (busy) return;
    setBusy('duplicate');
    setError('');
    try {
      const record = await duplicatePublicShipment(shipment.id);
      onDuplicated(record);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The shipment could not be duplicated.');
    } finally {
      setBusy('');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="workspace-dialog workspace-dialog-wide service-page"
        onCloseAutoFocus={returnFocus}
      >
        <DialogTitle>Shipment operations</DialogTitle>
        <DialogDescription>
          Manage the application shipment {shipment.trackingNumber}. Internal notes and archived
          records are administrator-only; public tracking shows only the public fields and events
          below. This is not a live carrier record.
        </DialogDescription>

        {shipment.archivedAt && (
          <p className="workspace-feedback" role="status">
            Archived {formatDateTime(shipment.archivedAt)}. Restore this shipment before changing
            its tracking timeline.
          </p>
        )}
        {message && (
          <p className="workspace-feedback" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="workspace-feedback error" role="alert">
            {error}
          </p>
        )}

        <div className="workspace-operation-actions" aria-label="Shipment actions">
          <button
            type="button"
            className="brand-button workspace-primary"
            disabled={Boolean(shipment.archivedAt) || Boolean(busy)}
            onClick={() => setAddingUpdate(true)}
          >
            <PlusCircle size={16} aria-hidden="true" /> Modify status
          </button>
          <button type="button" className="brand-button brand-button-outline" onClick={onEdit}>
            <Pencil size={16} aria-hidden="true" /> Edit shipment
          </button>
          <button
            type="button"
            className="brand-button brand-button-outline"
            disabled={Boolean(busy)}
            onClick={() => void duplicate()}
          >
            <Files size={16} aria-hidden="true" />
            {busy === 'duplicate' ? 'Duplicating…' : 'Duplicate shipment'}
          </button>
          <button
            type="button"
            className="brand-button brand-button-outline"
            disabled={Boolean(busy)}
            onClick={() =>
              void run(
                'archive',
                () => setPublicShipmentArchived(shipment.id, !shipment.archivedAt),
                shipment.archivedAt
                  ? `Shipment ${shipment.trackingNumber} restored.`
                  : `Shipment ${shipment.trackingNumber} archived and hidden from public tracking.`,
              )
            }
          >
            {shipment.archivedAt ? (
              <ArchiveRestore size={16} aria-hidden="true" />
            ) : (
              <Archive size={16} aria-hidden="true" />
            )}
            {shipment.archivedAt ? 'Restore shipment' : 'Archive shipment'}
          </button>
        </div>

        <section className="workspace-operation-section" aria-labelledby="shipment-summary-heading">
          <h3 id="shipment-summary-heading">Shipment summary</h3>
          <dl className="workspace-operation-summary">
            <div>
              <dt>Tracking number</dt>
              <dd>{shipment.trackingNumber}</dd>
            </div>
            <div>
              <dt>Current status</dt>
              <dd>{shipmentStatusLabel(shipment.status)}</dd>
            </div>
            {shipment.status === 'on_hold' && (
              <div>
                <dt>Public hold issue</dt>
                <dd>{holdReasonLabel(shipment.holdReason)}</dd>
              </div>
            )}
            <div>
              <dt>Current location</dt>
              <dd>{shipment.currentLocation}</dd>
            </div>
            <div>
              <dt>Customer</dt>
              <dd>{customerName}</dd>
            </div>
            <div>
              <dt>Recipient / label</dt>
              <dd>{shipment.recipientLabel}</dd>
            </div>
            <div>
              <dt>Service</dt>
              <dd>{service?.name || shipment.service}</dd>
            </div>
            <div>
              <dt>Route</dt>
              <dd>
                {placeLabel(shipment.originCity, shipment.originRegion, shipment.originPostalCode)}
                {' → '}
                {placeLabel(
                  shipment.destinationCity,
                  shipment.destinationRegion,
                  shipment.destinationPostalCode,
                )}
              </dd>
            </div>
            <div>
              <dt>Ship date</dt>
              <dd>{formatDate(shipment.shipDate)}</dd>
            </div>
            <div>
              <dt>Estimated delivery</dt>
              <dd>{formatDate(shipment.estimatedDelivery)}</dd>
            </div>
            <div>
              <dt>Weight</dt>
              <dd>{shipment.weight ? `${shipment.weight} lb` : 'Not set'}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDateTime(shipment.createdAt)}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{formatDateTime(shipment.updatedAt)}</dd>
            </div>
          </dl>
          {shipment.publicNote && (
            <p className="workspace-operation-note">
              <strong>Public note:</strong> {shipment.publicNote}
            </p>
          )}
        </section>

        <section className="workspace-operation-section" aria-labelledby="shipment-access-heading">
          <h3 id="shipment-access-heading">Public tracking access</h3>
          <label className="workspace-checkbox workspace-operation-checkbox">
            <input
              type="checkbox"
              aria-label={`Public tracking for ${shipment.trackingNumber}`}
              checked={shipment.isPublic}
              disabled={Boolean(busy)}
              onChange={(event) =>
                void run(
                  'visibility',
                  () => setPublicShipmentVisibility(shipment.id, event.target.checked),
                  event.target.checked
                    ? `Public tracking enabled for ${shipment.trackingNumber}.`
                    : `Public tracking hidden for ${shipment.trackingNumber}.`,
                )
              }
            />
            Anyone with the tracking number can view this shipment
          </label>
          <p className="workspace-operation-help">
            {shipment.archivedAt
              ? 'Archived shipments stay hidden from guests and assigned customers until restored.'
              : shipment.isPublic
                ? 'The public page excludes internal notes, account identifiers, street addresses, and private attachments.'
                : 'The tracking number currently returns not found on the public page.'}
          </p>
          <div className="workspace-operation-actions">
            <button
              type="button"
              className="brand-button brand-button-outline"
              onClick={() => void copyLink()}
            >
              <Copy size={16} aria-hidden="true" /> Copy tracking link
            </button>
            {publicAvailable ? (
              <Link
                className="brand-button brand-button-outline"
                to={`/tracking?number=${encodeURIComponent(shipment.trackingNumber)}`}
              >
                View public tracking <ExternalLink size={15} aria-hidden="true" />
              </Link>
            ) : (
              <span className="workspace-muted">Public tracking is not available.</span>
            )}
          </div>
        </section>

        <section className="workspace-operation-section" aria-labelledby="shipment-auto-heading">
          <h3 id="shipment-auto-heading">Automatic route progression</h3>
          <p className="workspace-operation-help">
            When on, this application advances the shipment through Label created → Picked up → In
            transit → Out for delivery → Delivered on the chosen interval. Every automatic update is
            labeled on the public tracking page as generated by this application — not a carrier
            scan. Any manual status update, event removal, or undo pauses it; it also pauses while
            the shipment is on hold and stops permanently at Delivered.
          </p>
          {shipment.status === 'delivered' ? (
            <p className="workspace-operation-help">
              <strong>Route complete.</strong> This shipment is delivered, so automatic progression
              is off.
            </p>
          ) : (
            <>
              <p className="workspace-operation-help" role="status">
                {shipment.autoProgressEnabled
                  ? `On — next automatic update ${shipment.autoProgressNextAt ? `due ${formatDateTime(shipment.autoProgressNextAt)}` : 'scheduled'}.`
                  : 'Off — the route only changes when an administrator updates it.'}
              </p>
              <div className="workspace-operation-actions">
                <div className="service-field">
                  <label htmlFor={`shipment-auto-interval-${shipment.id}`}>
                    Automatic update interval
                  </label>
                  <select
                    id={`shipment-auto-interval-${shipment.id}`}
                    value={autoInterval}
                    disabled={Boolean(busy) || Boolean(shipment.archivedAt)}
                    onChange={(event) => setAutoInterval(Number(event.target.value))}
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
                </div>
                {shipment.autoProgressEnabled ? (
                  <>
                    <button
                      type="button"
                      className="brand-button brand-button-outline"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void run(
                          'auto-progress',
                          () => setPublicShipmentAutoProgress(shipment.id, true, autoInterval),
                          `Automatic progression interval updated for ${shipment.trackingNumber}.`,
                        )
                      }
                    >
                      Apply interval
                    </button>
                    <button
                      type="button"
                      className="brand-button brand-button-outline"
                      disabled={Boolean(busy)}
                      onClick={() =>
                        void run(
                          'auto-progress',
                          () => setPublicShipmentAutoProgress(shipment.id, false, autoInterval),
                          `Automatic progression paused for ${shipment.trackingNumber}.`,
                        )
                      }
                    >
                      Pause progression
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="brand-button workspace-primary"
                    disabled={Boolean(busy) || Boolean(shipment.archivedAt)}
                    onClick={() =>
                      void run(
                        'auto-progress',
                        () => setPublicShipmentAutoProgress(shipment.id, true, autoInterval),
                        `Automatic progression enabled for ${shipment.trackingNumber}.`,
                      )
                    }
                  >
                    Enable automatic progression
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        <section className="workspace-operation-section" aria-labelledby="shipment-internal-heading">
          <h3 id="shipment-internal-heading">Internal administrator note</h3>
          <div className="service-field">
            <label htmlFor={`shipment-internal-note-${shipment.id}`}>
              Internal note (administrators only)
            </label>
            <textarea
              id={`shipment-internal-note-${shipment.id}`}
              rows={4}
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
              maxLength={1000}
              placeholder="Example: Customer asked us to hold the next update until the address is confirmed."
            />
            <small>
              Never shown on the public tracking page or in the assigned customer’s public shipment
              view. Do not store passwords or payment details.
            </small>
          </div>
          <div className="workspace-operation-actions">
            <button
              type="button"
              className="brand-button workspace-primary"
              disabled={Boolean(busy) || internalNote.trim() === shipment.internalNote}
              onClick={() =>
                void run(
                  'internal-note',
                  () => savePublicShipmentInternalNote(shipment.id, internalNote),
                  `Internal note saved for ${shipment.trackingNumber}.`,
                )
              }
            >
              <Save size={16} aria-hidden="true" />
              {busy === 'internal-note' ? 'Saving note…' : 'Save internal note'}
            </button>
          </div>
        </section>

        <section className="workspace-operation-section" aria-labelledby="shipment-timeline-heading">
          <div className="workspace-operation-section-heading">
            <div>
              <h3 id="shipment-timeline-heading">Tracking timeline</h3>
              <p>Correct or remove an event. The current status follows the latest remaining event.</p>
            </div>
            <button
              type="button"
              className="brand-button brand-button-outline"
              disabled={Boolean(shipment.archivedAt) || shipment.events.length <= 1 || Boolean(busy)}
              onClick={() => setConfirmUndo(true)}
            >
              <RotateCcw size={16} aria-hidden="true" /> Undo latest update
            </button>
          </div>
          <ol className="workspace-event-list">
            {events.map((event) => (
              <li key={event.id}>
                <div>
                  <strong>{shipmentStatusLabel(event.status)}</strong>
                  {latestEvent?.id === event.id && (
                    <span className="workspace-status ready">Current event</span>
                  )}
                  <span>
                    {formatDateTime(event.at)} · {event.location}
                  </span>
                  {event.status === 'on_hold' && (
                    <p>
                      <strong>Hold issue:</strong> {holdReasonLabel(event.holdReason)}
                    </p>
                  )}
                  {event.note && <p>{event.note}</p>}
                  {event.photo && (
                    <img
                      className="workspace-event-photo"
                      src={event.photo}
                      alt={`${shipmentStatusLabel(event.status)} public stage photo`}
                    />
                  )}
                </div>
                <div className="workspace-event-actions">
                  <button
                    type="button"
                    aria-label={`Edit tracking event ${shipmentStatusLabel(event.status)} for ${shipment.trackingNumber}`}
                    disabled={Boolean(shipment.archivedAt) || Boolean(busy)}
                    onClick={() => setEditingEvent(event)}
                  >
                    <Pencil size={15} aria-hidden="true" /> Correct event
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove tracking event ${shipmentStatusLabel(event.status)} for ${shipment.trackingNumber}`}
                    disabled={
                      Boolean(shipment.archivedAt) || shipment.events.length <= 1 || Boolean(busy)
                    }
                    onClick={() => setDeletingEvent(event)}
                  >
                    <Trash2 size={15} aria-hidden="true" /> Remove event
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {addingUpdate && (
          <PublicShipmentUpdateEditor
            key={shipment.id}
            shipment={shipment}
            onClose={() => setAddingUpdate(false)}
            onSaved={() => {
              const success = `Status update published for ${shipment.trackingNumber}.`;
              setMessage(success);
              onChanged(success);
            }}
          />
        )}
        {editingEvent && (
          <PublicShipmentEventEditor
            key={editingEvent.id}
            shipment={shipment}
            event={editingEvent}
            onClose={() => setEditingEvent(null)}
            onSaved={() => {
              const success = `Tracking event corrected for ${shipment.trackingNumber}.`;
              setMessage(success);
              onChanged(success);
            }}
          />
        )}
        {deletingEvent && (
          <ConfirmRemove
            title="Remove this tracking event?"
            description={`The ${shipmentStatusLabel(deletingEvent.status)} event will be removed from ${shipment.trackingNumber}. If it is the latest event, the current status and location will be recalculated.`}
            confirmLabel="Remove event"
            cancelLabel="Keep event"
            onClose={() => setDeletingEvent(null)}
            onConfirm={async () => {
              await removePublicShipmentEvent(shipment.id, deletingEvent.id);
              setDeletingEvent(null);
              const success = `Tracking event removed for ${shipment.trackingNumber}.`;
              setMessage(success);
              onChanged(success);
            }}
          />
        )}
        {confirmUndo && (
          <ConfirmRemove
            title="Undo the latest tracking update?"
            description={`The latest event for ${shipment.trackingNumber} will be removed and the previous timeline state will become current.`}
            confirmLabel="Undo latest update"
            cancelLabel="Keep update"
            onClose={() => setConfirmUndo(false)}
            onConfirm={async () => {
              await undoPublicShipmentUpdate(shipment.id);
              setConfirmUndo(false);
              const success = `Latest tracking update undone for ${shipment.trackingNumber}.`;
              setMessage(success);
              onChanged(success);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
