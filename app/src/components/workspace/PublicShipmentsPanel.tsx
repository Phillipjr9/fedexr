import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Copy,
  ExternalLink,
  Eye,
  PackagePlus,
  Pencil,
  PlusCircle,
  Sparkles,
  Trash2,
  Truck,
} from 'lucide-react';
import { useWorkspace } from '@/context/workspace';
import { generateRouteAddresses } from '@/lib/addressGenerator';
import { localDate } from '@/lib/shipping';
import {
  holdReasonLabel,
  placeLabel,
  publicShipmentStatusOptions,
  shipmentStatusLabel,
} from '@/lib/publicShipments';
import type { PublicShipment, PublicShipmentStatus } from '@/lib/workspace';
import { ConfirmRemove } from './WorkspaceEditors';
import PublicShipmentDetails from './PublicShipmentDetails';
import {
  HoldReasonSelect,
  PublicShipmentEditor,
  PublicShipmentUpdateEditor,
  ShipmentPhotoField,
} from './PublicShipmentEditors';

export default function PublicShipmentsPanel() {
  const {
    data,
    savePublicShipment,
    addPublicShipmentUpdate,
    removePublicShipment,
    setPublicShipmentVisibility,
    mode,
  } = useWorkspace();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [archiveFilter, setArchiveFilter] = useState('active');
  const [editing, setEditing] = useState<PublicShipment | 'new' | null>(null);
  const [updating, setUpdating] = useState<PublicShipment | null>(null);
  const [deleting, setDeleting] = useState<PublicShipment | null>(null);
  const [detailsId, setDetailsId] = useState('');
  const [visibilityId, setVisibilityId] = useState('');
  const [statusEdits, setStatusEdits] = useState<Record<string, PublicShipmentStatus>>({});
  const [holdReasonEdits, setHoldReasonEdits] = useState<Record<string, string>>({});
  const [photoEdits, setPhotoEdits] = useState<Record<string, string>>({});
  const [savingStatusId, setSavingStatusId] = useState('');
  const [generatingRoute, setGeneratingRoute] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const filtered = data.shipments
    .filter(
      (shipment) =>
        (status === 'all' || shipment.status === status) &&
        (archiveFilter === 'all' ||
          (archiveFilter === 'archived' ? Boolean(shipment.archivedAt) : !shipment.archivedAt)) &&
        `${shipment.trackingNumber} ${shipment.recipientLabel} ${shipment.originCity} ${shipment.destinationCity}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const detailsShipment = data.shipments.find((shipment) => shipment.id === detailsId);

  function customerName(shipment: PublicShipment) {
    if (!shipment.userId) return 'Guest/customer';
    return data.users.find((profile) => profile.id === shipment.userId)?.name || 'Workspace customer';
  }

  async function copyLink(shipment: PublicShipment) {
    const link = `${window.location.origin}/tracking?number=${encodeURIComponent(shipment.trackingNumber)}`;
    try {
      await navigator.clipboard.writeText(link);
      setMessage(`Public tracking link copied for ${shipment.trackingNumber}.`);
    } catch {
      setMessage(`Public tracking link: ${link}`);
    }
    setError('');
  }

  function manualStatus(shipment: PublicShipment) {
    return statusEdits[shipment.id] || shipment.status;
  }

  function manualHoldReason(shipment: PublicShipment) {
    return (
      holdReasonEdits[shipment.id] ??
      (manualStatus(shipment) === 'on_hold' ? shipment.holdReason : '')
    );
  }

  function manualPhoto(shipment: PublicShipment) {
    return photoEdits[shipment.id] || '';
  }

  function manualStatusDirty(shipment: PublicShipment) {
    const nextStatus = manualStatus(shipment);
    return (
      nextStatus !== shipment.status ||
      (shipment.status === 'on_hold' &&
        nextStatus === 'on_hold' &&
        manualHoldReason(shipment) !== shipment.holdReason) ||
      Boolean(manualPhoto(shipment))
    );
  }

  function clearManualStatusEdit(shipment: PublicShipment) {
    setStatusEdits((previous) => {
      const next = { ...previous };
      delete next[shipment.id];
      return next;
    });
    setHoldReasonEdits((previous) => {
      const next = { ...previous };
      delete next[shipment.id];
      return next;
    });
    setPhotoEdits((previous) => {
      const next = { ...previous };
      delete next[shipment.id];
      return next;
    });
  }

  async function saveManualStatus(shipment: PublicShipment) {
    const nextStatus = manualStatus(shipment);
    const holdReason = nextStatus === 'on_hold' ? manualHoldReason(shipment) : '';
    if (!manualStatusDirty(shipment) || savingStatusId) return;
    if (nextStatus === 'on_hold' && !holdReason) {
      setError(`Choose a hold reason for ${shipment.trackingNumber} before saving On hold.`);
      return;
    }
    setSavingStatusId(shipment.id);
    setError('');
    try {
      await addPublicShipmentUpdate(shipment.id, {
        status: nextStatus,
        location: shipment.currentLocation,
        note: '',
        holdReason,
        photo: manualPhoto(shipment),
        at: new Date().toISOString(),
      });
      clearManualStatusEdit(shipment);
      setMessage(
        nextStatus === 'on_hold'
          ? `Status for ${shipment.trackingNumber} manually updated to On hold: ${holdReasonLabel(holdReason)}.`
          : `Status for ${shipment.trackingNumber} manually updated to ${shipmentStatusLabel(nextStatus)}.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The shipment status could not be updated.');
    } finally {
      setSavingStatusId('');
    }
  }

  async function generateTrackableRoute() {
    if (generatingRoute) return;
    setGeneratingRoute(true);
    setError('');
    try {
      const route = generateRouteAddresses();
      const shipment = await savePublicShipment({
        trackingNumber: '',
        userId: null,
        recipientLabel: `${route.recipientName} (sample route)`,
        originCity: route.origin.city,
        originRegion: route.origin.region,
        originPostalCode: route.origin.postalCode,
        destinationCity: route.destination.city,
        destinationRegion: route.destination.region,
        destinationPostalCode: route.destination.postalCode,
        service: 'ground',
        weight: '2',
        shipDate: localDate(),
        estimatedDelivery: '',
        status: 'in_transit',
        currentLocation: `${route.origin.city}, ${route.origin.region}`,
        holdReason: '',
        publicNote:
          'Sample route generated in this workspace for route monitoring. Not a FedEx shipment.',
        isPublic: true,
        autoProgressEnabled: true,
        autoProgressIntervalMinutes: 5,
        photo: '',
      });
      setMessage(
        `Trackable route created: ${shipment.trackingNumber} — ${route.origin.city}, ${route.origin.region} → ${route.destination.city}, ${route.destination.region}. Automatic progression is on (every 5 minutes); use View public tracking on its row to monitor the route, or pause progression in Shipment operations.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'The trackable route could not be created.',
      );
    } finally {
      setGeneratingRoute(false);
    }
  }

  async function toggleVisibility(shipment: PublicShipment, isPublic: boolean) {
    if (visibilityId) return;
    setVisibilityId(shipment.id);
    setError('');
    try {
      await setPublicShipmentVisibility(shipment.id, isPublic);
      setMessage(
        isPublic
          ? `Public tracking enabled for ${shipment.trackingNumber}.`
          : `Public tracking hidden for ${shipment.trackingNumber}.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Public tracking visibility could not be changed.',
      );
    } finally {
      setVisibilityId('');
    }
  }

  return (
    <section className="workspace-panel">
      <div className="workspace-panel-heading">
        <div>
          <h2>Public shipments</h2>
          <p>
            Create application shipment records for customers, manually change each shipment’s
            status from the table, and open Shipment operations to correct timeline events, save
            internal notes, duplicate or archive a record, and control public tracking. Anyone with
            the tracking number can view the public status; street addresses, emails, internal
            notes, and private attachments are not shown.
          </p>
        </div>
        <div className="workspace-heading-actions">
          <button
            type="button"
            className="brand-button workspace-primary"
            onClick={() => setEditing('new')}
          >
            <PackagePlus size={17} aria-hidden="true" />
            Create shipment
          </button>
          <button
            type="button"
            className="brand-button brand-button-outline"
            disabled={generatingRoute}
            onClick={() => void generateTrackableRoute()}
          >
            <Sparkles size={17} aria-hidden="true" />
            {generatingRoute ? 'Generating route…' : 'Generate trackable route'}
          </button>
        </div>
      </div>

      <div className="workspace-filters workspace-shipment-filters">
        <div className="service-field">
          <label htmlFor="public-shipment-search">Search public shipments</label>
          <input
            id="public-shipment-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tracking number, recipient, or city"
            maxLength={120}
          />
        </div>
        <div className="service-field">
          <label htmlFor="public-shipment-status">Shipment status</label>
          <select
            id="public-shipment-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            {publicShipmentStatusOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="service-field">
          <label htmlFor="public-shipment-archive">Record state</label>
          <select
            id="public-shipment-archive"
            value={archiveFilter}
            onChange={(event) => setArchiveFilter(event.target.value)}
          >
            <option value="active">Active shipments</option>
            <option value="archived">Archived shipments</option>
            <option value="all">All records</option>
          </select>
        </div>
        <span className="workspace-muted">
          {mode === 'browser' ? 'Stored in this browser' : 'Stored in the account database'}
        </span>
      </div>

      <p className="workspace-results" role="status">
        {filtered.length} {filtered.length === 1 ? 'shipment' : 'shipments'} shown
      </p>
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

      {filtered.length === 0 ? (
        <div className="workspace-empty">
          <Truck size={38} strokeWidth={1.3} aria-hidden="true" />
          <h3>{data.shipments.length ? 'No shipments match these filters' : 'No public shipments yet'}</h3>
          <p>
            Create the first shipment, give the customer its tracking number, and publish updates as
            it moves.
          </p>
          <button
            type="button"
            className="brand-button brand-button-outline"
            onClick={() => setEditing('new')}
          >
            Create shipment
          </button>
        </div>
      ) : (
        <>
          <p className="workspace-table-help" id="public-shipment-table-help">
            On smaller screens, scroll the table horizontally to see status and actions.
          </p>
          <div
            className="workspace-table-wrap public-shipments-table-wrap"
            aria-describedby="public-shipment-table-help"
            aria-label="Public shipments table"
            role="region"
            tabIndex={0}
          >
            <table className="workspace-table public-shipments-table">
              <caption className="sr-only">Administrator-created public shipments</caption>
              <colgroup>
                <col />
                <col />
                <col />
                <col />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Tracking / recipient</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Route</th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((shipment) => (
                  <tr key={shipment.id}>
                    <td>
                      <strong>{shipment.trackingNumber}</strong>
                      <span>{shipment.recipientLabel}</span>
                      <span>{shipment.isPublic ? 'Public tracking on' : 'Public tracking off'}</span>
                      {shipment.archivedAt && (
                        <span className="workspace-status archived">Archived</span>
                      )}
                      <label className="workspace-public-toggle">
                        <input
                          type="checkbox"
                          aria-label={`Public tracking for ${shipment.trackingNumber}`}
                          checked={shipment.isPublic}
                          disabled={visibilityId === shipment.id}
                          onChange={(event) =>
                            void toggleVisibility(shipment, event.target.checked)
                          }
                        />
                        Public tracking
                      </label>
                    </td>
                    <td>{customerName(shipment)}</td>
                    <td>
                      {placeLabel(shipment.originCity, shipment.originRegion, shipment.originPostalCode)}
                      <span>
                        to{' '}
                        {placeLabel(
                          shipment.destinationCity,
                          shipment.destinationRegion,
                          shipment.destinationPostalCode,
                        )}
                      </span>
                    </td>
                    <td>
                      <div className="workspace-manual-status">
                        <label
                          className="sr-only"
                          htmlFor={`manual-status-${shipment.id}`}
                        >
                          Manually change status for {shipment.trackingNumber}
                        </label>
                        <select
                          id={`manual-status-${shipment.id}`}
                          value={manualStatus(shipment)}
                          disabled={savingStatusId === shipment.id || Boolean(shipment.archivedAt)}
                          onChange={(event) =>
                            setStatusEdits((previous) => ({
                              ...previous,
                              [shipment.id]: event.target.value as PublicShipmentStatus,
                            }))
                          }
                        >
                          {publicShipmentStatusOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {manualStatus(shipment) === 'on_hold' && (
                          <>
                            <label
                              className="sr-only"
                              htmlFor={`manual-hold-reason-${shipment.id}`}
                            >
                              Hold reason for {shipment.trackingNumber}
                            </label>
                            <HoldReasonSelect
                              id={`manual-hold-reason-${shipment.id}`}
                              value={manualHoldReason(shipment)}
                              onChange={(holdReason) =>
                                setHoldReasonEdits((previous) => ({
                                  ...previous,
                                  [shipment.id]: holdReason,
                                }))
                              }
                            />
                            <small>Shown directly as the public issue.</small>
                          </>
                        )}
                        {(manualStatus(shipment) === 'in_transit' ||
                          manualStatus(shipment) === 'delivered') && (
                          <ShipmentPhotoField
                            id={`manual-photo-${shipment.id}`}
                            label={`Public stage photo for ${shipment.trackingNumber}`}
                            value={manualPhoto(shipment)}
                            onChange={(photo) =>
                              setPhotoEdits((previous) => ({
                                ...previous,
                                [shipment.id]: photo,
                              }))
                            }
                          />
                        )}
                        {manualStatusDirty(shipment) && (
                          <div className="workspace-manual-status-actions">
                            <button
                              type="button"
                              className="workspace-status-save"
                              aria-label={`Save status for ${shipment.trackingNumber}`}
                              disabled={savingStatusId === shipment.id}
                              onClick={() => void saveManualStatus(shipment)}
                            >
                              {savingStatusId === shipment.id ? 'Saving…' : 'Save status'}
                            </button>
                            <button
                              type="button"
                              className="service-text-link"
                              disabled={savingStatusId === shipment.id}
                              onClick={() => clearManualStatusEdit(shipment)}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                      <span>{shipment.currentLocation}</span>
                      {shipment.autoProgressEnabled && (
                        <span className="workspace-status draft">Auto progression on</span>
                      )}
                      {shipment.status === 'on_hold' && (
                        <span className="workspace-hold-issue">
                          Hold issue: {holdReasonLabel(shipment.holdReason)}
                        </span>
                      )}
                    </td>
                    <td>{new Date(shipment.updatedAt).toLocaleString('en-US')}</td>
                    <td>
                      <div className="workspace-row-actions">
                        <button
                          type="button"
                          aria-label={`Open shipment operations for ${shipment.trackingNumber}`}
                          onClick={() => setDetailsId(shipment.id)}
                        >
                          <Eye size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Copy public tracking link for ${shipment.trackingNumber}`}
                          onClick={() => void copyLink(shipment)}
                        >
                          <Copy size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit shipment ${shipment.trackingNumber}`}
                          onClick={() => setEditing(shipment)}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove shipment ${shipment.trackingNumber}`}
                          onClick={() => setDeleting(shipment)}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                      <Link
                        className="service-text-link"
                        to={`/tracking?number=${encodeURIComponent(shipment.trackingNumber)}`}
                      >
                        View public tracking <ExternalLink size={12} aria-hidden="true" />
                      </Link>{' '}
                      <button
                        type="button"
                        className="service-text-link"
                        disabled={Boolean(shipment.archivedAt)}
                        onClick={() => setUpdating(shipment)}
                      >
                        <PlusCircle size={13} aria-hidden="true" /> Modify status
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {detailsShipment && (
        <PublicShipmentDetails
          key={detailsShipment.id}
          shipment={detailsShipment}
          customerName={customerName(detailsShipment)}
          onClose={() => setDetailsId('')}
          onEdit={() => {
            setEditing(detailsShipment);
            setDetailsId('');
          }}
          onChanged={(success) => {
            setMessage(success);
            setError('');
          }}
          onDuplicated={(shipment) => {
            setDetailsId(shipment.id);
            setMessage(
              `Shipment duplicated as ${shipment.trackingNumber}. Review its new Label created timeline before sharing the link.`,
            );
            setError('');
          }}
        />
      )}
      {editing && (
        <PublicShipmentEditor
          key={editing === 'new' ? 'new' : editing.id}
          record={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(shipment) => {
            setMessage(
              `${shipment.trackingNumber} is ready. Share its public tracking link with the customer.`,
            );
            setError('');
          }}
        />
      )}
      {updating && (
        <PublicShipmentUpdateEditor
          key={updating.id}
          shipment={updating}
          onClose={() => setUpdating(null)}
          onSaved={() => {
            setMessage(`Status update published for ${updating.trackingNumber}.`);
            setError('');
          }}
        />
      )}
      {deleting && (
        <ConfirmRemove
          title="Remove this public shipment?"
          description="The public tracking page will no longer find this tracking number. This does not cancel a carrier shipment."
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await removePublicShipment(deleting.id);
              setDeleting(null);
              setMessage('Public shipment removed.');
              setError('');
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'The shipment could not be removed.');
              throw cause;
            }
          }}
        />
      )}
    </section>
  );
}
