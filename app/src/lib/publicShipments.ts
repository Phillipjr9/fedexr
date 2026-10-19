import { isUSZip, sampleServices } from '@/lib/shipping';
import {
  publicShipmentStatuses,
  type PublicShipment,
  type PublicShipmentEvent,
  type PublicShipmentInput,
  type PublicShipmentStatus,
} from '@/lib/workspace';

export const publicShipmentStatusOptions: Array<{
  id: PublicShipmentStatus;
  label: string;
  description: string;
}> = [
  { id: 'label_created', label: 'Label created', description: 'Shipment record created' },
  { id: 'picked_up', label: 'Picked up', description: 'Package received' },
  { id: 'in_transit', label: 'In transit', description: 'Moving through the network' },
  { id: 'out_for_delivery', label: 'Out for delivery', description: 'On the delivery vehicle' },
  { id: 'delivered', label: 'Delivered', description: 'Final delivery event recorded' },
  { id: 'exception', label: 'Delivery exception', description: 'Attention is needed' },
  { id: 'on_hold', label: 'On hold', description: 'Delivery paused — hold reason required' },
  { id: 'cancelled', label: 'Cancelled', description: 'Shipment was cancelled' },
];

export const publicShipmentHoldReasonGroups: Array<{
  label: string;
  options: Array<{ id: string; label: string }>;
}> = [
  {
    label: 'Address and recipient',
    options: [
      { id: 'address_incomplete', label: 'Address information incomplete' },
      { id: 'address_not_found', label: 'Address could not be found' },
      { id: 'address_correction_required', label: 'Address correction required' },
      { id: 'recipient_unavailable', label: 'Recipient unavailable' },
      { id: 'business_closed', label: 'Business closed during delivery attempt' },
      { id: 'access_restricted', label: 'Building access restricted or security gate closed' },
      { id: 'signature_required', label: 'Signature required and recipient unavailable' },
      { id: 'identity_verification_required', label: 'Identity verification required' },
      { id: 'awaiting_customer_pickup', label: 'Held for customer pickup' },
      { id: 'recipient_requested_hold', label: 'Recipient requested a hold' },
      { id: 'recipient_requested_future_delivery', label: 'Recipient requested a future delivery date' },
    ],
  },
  {
    label: 'Customs and regulatory',
    options: [
      { id: 'customs_documents_missing', label: 'Customs documents missing' },
      { id: 'customs_inspection', label: 'Held for customs inspection' },
      { id: 'duties_taxes_unpaid', label: 'Import duties or taxes unpaid' },
      { id: 'export_documents_incomplete', label: 'Export documents incomplete' },
      { id: 'import_permit_required', label: 'Import permit or licence required' },
      { id: 'restricted_item_review', label: 'Restricted-item review' },
      { id: 'regulatory_hold', label: 'Regulatory or agency hold' },
    ],
  },
  {
    label: 'Package and documents',
    options: [
      { id: 'label_unreadable', label: 'Shipping label unreadable or damaged' },
      { id: 'shipment_documents_missing', label: 'Shipment documents missing' },
      { id: 'weight_dimension_discrepancy', label: 'Weight or dimension discrepancy' },
      { id: 'packaging_damaged', label: 'Packaging damaged — inspection required' },
      { id: 'package_damaged', label: 'Package contents may be damaged' },
      { id: 'safety_inspection', label: 'Contents safety inspection' },
      { id: 'repackaging_required', label: 'Repackaging required before transport' },
    ],
  },
  {
    label: 'Facility and transport operations',
    options: [
      { id: 'facility_backlog', label: 'Facility backlog or processing delay' },
      { id: 'sort_delay', label: 'Sort operation delay' },
      { id: 'missed_connection', label: 'Missed transport connection' },
      { id: 'vehicle_breakdown', label: 'Delivery vehicle breakdown' },
      { id: 'flight_delayed', label: 'Flight delayed' },
      { id: 'flight_cancelled', label: 'Flight cancelled' },
      { id: 'linehaul_delay', label: 'Linehaul transport delay' },
      { id: 'remote_area_delay', label: 'Remote-area delivery delay' },
      { id: 'operational_disruption', label: 'Local operational disruption' },
    ],
  },
  {
    label: 'Weather and external events',
    options: [
      { id: 'severe_weather', label: 'Severe weather delay' },
      { id: 'natural_disaster', label: 'Natural disaster or emergency conditions' },
      { id: 'road_closure', label: 'Road closure or unsafe route' },
      { id: 'public_safety_event', label: 'Public-safety or government restriction' },
    ],
  },
  {
    label: 'Account and other',
    options: [
      { id: 'payment_authorization_required', label: 'Payment or billing authorisation required' },
      { id: 'account_information_required', label: 'Additional account information required' },
      { id: 'sender_information_required', label: 'Additional sender information required' },
      { id: 'other_operational_hold', label: 'Other operational hold' },
    ],
  },
];

export const publicShipmentHoldReasons = publicShipmentHoldReasonGroups.flatMap(
  (group) => group.options,
);

export function holdReasonLabel(holdReason: string) {
  return (
    publicShipmentHoldReasons.find((reason) => reason.id === holdReason)?.label ||
    'Shipment held for review'
  );
}

export function isHoldReason(holdReason: string) {
  return publicShipmentHoldReasons.some((reason) => reason.id === holdReason);
}

export function shipmentStatusLabel(status: PublicShipmentStatus) {
  return publicShipmentStatusOptions.find((option) => option.id === status)?.label || 'In transit';
}

export function normalizeTrackingNumber(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, ' ');
  const compact = normalized.replace(/[\s-]+/g, '');
  // FedEx-style numbers are commonly typed in groups; store and compare the digits.
  return /^\d{12}$/.test(compact) || /^\d{15}$/.test(compact) ? compact : normalized;
}

export function trackingNumberLengthForService(service?: string) {
  return service === 'ground' ? 15 : 12;
}

export function isFedExStyleTrackingNumber(value: string) {
  return /^\d{12}$/.test(value) || /^\d{15}$/.test(value);
}

export function generateTrackingNumber(service?: string) {
  const length = trackingNumberLengthForService(service);
  let number = String(1 + Math.floor(Math.random() * 9));
  for (let index = 1; index < length; index += 1) {
    number += String(Math.floor(Math.random() * 10));
  }
  return number;
}

export function placeLabel(city: string, region: string, postalCode?: string) {
  return [city.trim(), region.trim()].filter(Boolean).join(', ') +
    (postalCode?.trim() ? ` ${postalCode.trim()}` : '');
}

export function sortedShipmentEvents(shipment: PublicShipment) {
  return [...shipment.events].sort((a, b) => a.at.localeCompare(b.at));
}

export function latestShipmentEvent(shipment: PublicShipment) {
  return sortedShipmentEvents(shipment).at(-1);
}

export interface DisplayShipmentEvent extends PublicShipmentEvent {
  /** True when an administrator actually recorded this event; false for a route stage filled in for display. */
  recorded: boolean;
}

const routeStageOrder: PublicShipmentStatus[] = [
  'label_created',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
];

/**
 * Public route view. Administrators can jump a shipment straight from
 * In transit to Delivered, which leaves only two recorded events; a delivered
 * shipment should still show its complete route. Missing standard stages are
 * therefore filled in for display only, anchored to the delivery time and
 * marked as not recorded so no scan time or location is invented.
 */
export function displayShipmentEvents(shipment: PublicShipment): DisplayShipmentEvent[] {
  const recorded: DisplayShipmentEvent[] = sortedShipmentEvents(shipment).map((event) => ({
    ...event,
    recorded: true,
  }));
  if (shipment.status !== 'delivered') return recorded;

  const deliveredEvent = [...recorded].reverse().find((event) => event.status === 'delivered');
  const anchorAt = deliveredEvent?.at || shipment.updatedAt || shipment.createdAt;
  const cityRegion = (city: string, region: string) =>
    [city.trim(), region.trim()].filter(Boolean).join(', ').toUpperCase();
  const origin = cityRegion(shipment.originCity, shipment.originRegion);
  const destination = cityRegion(shipment.destinationCity, shipment.destinationRegion);
  const stageLocation: Partial<Record<PublicShipmentStatus, string>> = {
    label_created: origin,
    picked_up: origin,
    in_transit: deliveredEvent?.location || shipment.currentLocation || destination,
    out_for_delivery: destination,
    delivered: deliveredEvent?.location || shipment.currentLocation || destination,
  };
  const rank = (status: PublicShipmentStatus) => routeStageOrder.indexOf(status);
  const result = [...recorded];
  for (const stage of routeStageOrder) {
    if (result.some((event) => event.status === stage)) continue;
    const inferred: DisplayShipmentEvent = {
      id: `route-stage-${stage}`,
      status: stage,
      location: stageLocation[stage] || shipment.currentLocation,
      note: '',
      holdReason: '',
      photo: '',
      at: anchorAt,
      recorded: false,
    };
    const insertAt = result.findIndex(
      (event) => rank(event.status) > rank(stage) && rank(event.status) !== -1,
    );
    if (insertAt === -1) result.push(inferred);
    else result.splice(insertAt, 0, inferred);
  }
  return result;
}

export function shipmentStateFromEvents(
  events: PublicShipmentEvent[],
  fallback: Pick<PublicShipment, 'status' | 'currentLocation' | 'holdReason'>,
) {
  const latest = [...events].sort((a, b) => a.at.localeCompare(b.at)).at(-1);
  return latest
    ? {
        status: latest.status,
        currentLocation: latest.location,
        holdReason: latest.status === 'on_hold' ? latest.holdReason || '' : '',
      }
    : {
        status: fallback.status,
        currentLocation: fallback.currentLocation,
        holdReason: fallback.status === 'on_hold' ? fallback.holdReason : '',
      };
}

/** Standard forward route used by automatic progression. */
export const autoProgressStages: PublicShipmentStatus[] = [
  'label_created',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
];

export const AUTO_PROGRESS_INTERVAL_OPTIONS = [1, 5, 15, 60, 360, 1440] as const;

export const AUTO_PROGRESS_EVENT_NOTE = 'Automatic update from this site — not a carrier scan.';

export function normalizeAutoProgressInterval(value: unknown) {
  const minutes = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(minutes)) return 5;
  return Math.min(1440, Math.max(1, Math.round(minutes)));
}

export function nextAutoProgressStatus(
  status: PublicShipmentStatus,
): PublicShipmentStatus | null {
  const index = autoProgressStages.indexOf(status);
  if (index < 0 || index >= autoProgressStages.length - 1) return null;
  return autoProgressStages[index + 1];
}

function autoProgressLocation(
  shipment: PublicShipment,
  status: PublicShipmentStatus,
) {
  const destination = status === 'out_for_delivery' || status === 'delivered';
  return destination
    ? `${shipment.destinationCity}, ${shipment.destinationRegion}`
    : `${shipment.originCity}, ${shipment.originRegion}`;
}

/**
 * Apply any automatic stage updates that are due. Pure: returns the original
 * record when nothing changed. Progression pauses for non-route statuses
 * (on hold, exception, cancelled) and stops permanently at Delivered.
 */
export function applyAutoProgress(
  shipment: PublicShipment,
  now: Date = new Date(),
  makeEventId: () => string = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `auto-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
): PublicShipment {
  if (!shipment.autoProgressEnabled || shipment.archivedAt) return shipment;
  if (shipment.status === 'delivered' || !nextAutoProgressStatus(shipment.status)) {
    return { ...shipment, autoProgressEnabled: false, autoProgressNextAt: '' };
  }
  const intervalMs = normalizeAutoProgressInterval(shipment.autoProgressIntervalMinutes) * 60_000;
  const nextAt = new Date(shipment.autoProgressNextAt || now).getTime();
  if (!Number.isFinite(nextAt)) {
    return { ...shipment, autoProgressNextAt: new Date(now.getTime() + intervalMs).toISOString() };
  }
  if (nextAt > now.getTime()) return shipment;
  const events = [...shipment.events];
  let status: PublicShipmentStatus = shipment.status;
  let currentLocation = shipment.currentLocation;
  let dueAt = nextAt;
  let steps = 0;
  while (dueAt <= now.getTime() && steps < 20) {
    const next = nextAutoProgressStatus(status);
    if (!next) break;
    const location = autoProgressLocation(shipment, next);
    events.push({
      id: makeEventId(),
      status: next,
      location,
      note: AUTO_PROGRESS_EVENT_NOTE,
      holdReason: '',
      photo: '',
      at: new Date(dueAt).toISOString(),
    });
    status = next;
    currentLocation = location;
    steps += 1;
    if (next === 'delivered') break;
    dueAt += intervalMs;
  }
  if (steps === 0) return shipment;
  const delivered = status === 'delivered';
  return {
    ...shipment,
    status,
    currentLocation,
    holdReason: '',
    events: events.slice(-100),
    autoProgressEnabled: !delivered,
    autoProgressNextAt: delivered ? '' : new Date(dueAt).toISOString(),
    updatedAt: new Date(dueAt - (delivered ? 0 : intervalMs)).toISOString(),
  };
}

export const SHIPMENT_PHOTO_MAX_LENGTH = 400_000;

export function isShipmentPhoto(value: string) {
  return (
    value === '' ||
    (/^data:image\/(jpeg|png|webp);base64,/.test(value) &&
      value.length <= SHIPMENT_PHOTO_MAX_LENGTH)
  );
}

export function publicShipmentEventError(input: {
  status: PublicShipmentStatus;
  location: string;
  note: string;
  holdReason: string;
  photo: string;
  at: string;
}) {
  if (!publicShipmentStatuses.includes(input.status)) return 'Choose a shipment status.';
  if (!input.location.trim() || input.location.length > 120)
    return 'Enter the event location shown to the customer.';
  if (input.note.length > 500) return 'Keep the public event note to 500 characters or fewer.';
  if (input.status === 'on_hold' && !isHoldReason(input.holdReason))
    return 'Choose the reason this shipment is on hold.';
  if (!isShipmentPhoto(input.photo)) return 'Choose a valid shipment photo (JPG, PNG, or WebP).';
  if (!Number.isFinite(new Date(input.at).getTime())) return 'Choose a valid event time.';
  return '';
}

export function publicShipmentError(input: PublicShipmentInput) {
  const tracking = normalizeTrackingNumber(input.trackingNumber);
  if (tracking && !/^[A-Z0-9][A-Z0-9 -]{3,39}$/.test(tracking))
    return 'Use a tracking number from 4–40 characters with letters, numbers, spaces, or hyphens.';
  const compactTracking = tracking.replace(/[\s-]+/g, '');
  if (tracking && /^\d+$/.test(compactTracking) && !isFedExStyleTrackingNumber(compactTracking))
    return 'For a FedEx-style tracking number, use 15 digits for Ground or 12 digits for Express-style services—or leave it blank to generate one.';
  if (!input.recipientLabel.trim() || input.recipientLabel.length > 100)
    return 'Enter a recipient or shipment label from 1–100 characters.';
  if (!input.originCity.trim() || !input.destinationCity.trim())
    return 'Enter both origin and destination cities.';
  if ([input.originCity, input.destinationCity].some((value) => value.length > 80))
    return 'City names must be no longer than 80 characters.';
  if ([input.originRegion, input.destinationRegion].some((value) => value.length > 40))
    return 'State or region names must be no longer than 40 characters.';
  if (!isUSZip(input.originPostalCode) || !isUSZip(input.destinationPostalCode))
    return 'Enter valid U.S. ZIP codes for the origin and destination.';
  if (!sampleServices.some((service) => service.id === input.service))
    return 'Choose a shipping service.';
  if (
    input.weight.trim() &&
    (!Number.isFinite(Number(input.weight)) || Number(input.weight) < 0.1 || Number(input.weight) > 150)
  )
    return 'Enter a package weight from 0.1–150 lb, or leave it blank.';
  if (!validDate(input.shipDate)) return 'Choose a valid ship date.';
  if (input.estimatedDelivery && !validDate(input.estimatedDelivery))
    return 'Choose a valid estimated delivery date.';
  if (input.estimatedDelivery && input.estimatedDelivery < input.shipDate)
    return 'Estimated delivery cannot be before the ship date.';
  if (!publicShipmentStatuses.includes(input.status)) return 'Choose a shipment status.';
  if (input.status === 'on_hold' && !isHoldReason(input.holdReason))
    return 'Choose the reason this shipment is on hold.';
  if (!isShipmentPhoto(input.photo)) return 'Choose a valid shipment photo (JPG, PNG, or WebP).';
  if (!input.currentLocation.trim() || input.currentLocation.length > 120)
    return 'Enter the current location shown to the customer.';
  if (input.publicNote.length > 500) return 'Keep the public note to 500 characters or fewer.';
  return '';
}

function validDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
