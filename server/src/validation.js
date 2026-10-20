export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function assert(condition, message, status = 400) {
  if (!condition) throw new HttpError(status, message);
}
export function text(value, label, max, required = true) {
  assert(
    typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0),
    `${label} must be ${required ? '1' : '0'}–${max} characters.`,
  );
  return value.trim();
}
export function email(value) {
  const normalized = text(value, 'Workspace email', 160).toLowerCase();
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized), 'Enter a valid workspace email.');
  return normalized;
}
export function identifier(value) {
  assert(typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value), 'Invalid record identifier.');
  return value;
}
export function addressInput(body) {
  const record = {};
  for (const key of ['label', 'name', 'street', 'city', 'region', 'postalCode', 'country'])
    record[key] = text(body[key], key, 200, key !== 'region');
  assert(typeof body.isDefault === 'boolean', 'Choose whether the address is the default.');
  return { ...record, isDefault: body.isDefault };
}
export const services = ['ground', '2day', 'standard', 'priority', 'overnight', 'sameday'];
export function planInput(body, editing = false) {
  const recipient = text(body.recipient, 'Recipient / project', 100);
  const reference = text(body.reference ?? '', 'Reference', 40, false);
  const notes = text(body.notes ?? '', 'Planning notes', 1000, false);
  const from = text(body.from, 'From ZIP code', 10);
  const to = text(body.to, 'To ZIP code', 10);
  assert(
    /^\d{5}(?:-\d{4})?$/.test(from) && /^\d{5}(?:-\d{4})?$/.test(to),
    'Enter valid U.S. ZIP codes.',
  );
  assert(['string', 'number'].includes(typeof body.weight), 'Enter a package weight.');
  const weight = Number(body.weight);
  assert(
    Number.isFinite(weight) && weight >= 0.1 && weight <= 150,
    'Planned weight must be 0.1–150 lb.',
  );
  assert(services.includes(body.service), 'Choose a valid service to explore.');
  const shipDate = text(body.shipDate, 'Planned date', 10);
  const date = new Date(`${shipDate}T00:00:00Z`);
  assert(
    /^\d{4}-\d{2}-\d{2}$/.test(shipDate) &&
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === shipDate,
    'Choose a valid planned date.',
  );
  // A plan is not a booking. Allow the client's local date across UTC boundaries.
  assert(
    editing || date.getTime() >= Date.now() - 2 * 86400000,
    'Choose today or a future planned date.',
  );
  return { recipient, reference, notes, from, to, weight, service: body.service, shipDate };
}
export function statusInput(value) {
  assert(['draft', 'ready', 'archived'].includes(value), 'Choose a valid planning status.');
  return value;
}

export const publicShipmentStatuses = [
  'label_created',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'exception',
  'on_hold',
  'cancelled',
];

export const publicShipmentHoldReasons = [
  'address_incomplete',
  'address_not_found',
  'address_correction_required',
  'recipient_unavailable',
  'business_closed',
  'access_restricted',
  'signature_required',
  'identity_verification_required',
  'awaiting_customer_pickup',
  'recipient_requested_hold',
  'recipient_requested_future_delivery',
  'customs_documents_missing',
  'customs_inspection',
  'duties_taxes_unpaid',
  'export_documents_incomplete',
  'import_permit_required',
  'restricted_item_review',
  'regulatory_hold',
  'label_unreadable',
  'shipment_documents_missing',
  'weight_dimension_discrepancy',
  'packaging_damaged',
  'package_damaged',
  'safety_inspection',
  'repackaging_required',
  'facility_backlog',
  'sort_delay',
  'missed_connection',
  'vehicle_breakdown',
  'flight_delayed',
  'flight_cancelled',
  'linehaul_delay',
  'remote_area_delay',
  'operational_disruption',
  'severe_weather',
  'natural_disaster',
  'road_closure',
  'public_safety_event',
  'payment_authorization_required',
  'account_information_required',
  'sender_information_required',
  'other_operational_hold',
];

function photoInput(body, status) {
  const photo =
    body.photo === undefined || body.photo === null
      ? ''
      : text(body.photo, 'Shipment photo', 400_000, false);
  assert(
    photo === '' || /^data:image\/(jpeg|png|webp);base64,/.test(photo),
    'Choose a valid shipment photo (JPG, PNG, or WebP).',
  );
  return ['in_transit', 'delivered'].includes(status) ? photo : '';
}

export function autoProgressInput(body) {
  const enabled = body.autoProgressEnabled ?? body.enabled ?? false;
  assert(typeof enabled === 'boolean', 'Choose whether automatic progression is on.');
  const rawInterval = body.autoProgressIntervalMinutes ?? body.intervalMinutes ?? 5;
  const interval = Number(rawInterval);
  assert(
    Number.isFinite(interval) && Number.isInteger(interval) && interval >= 1 && interval <= 1440,
    'Choose an automatic update interval between 1 and 1440 minutes.',
  );
  return { enabled, intervalMinutes: interval };
}

function holdReasonInput(body, status) {
  const holdReason =
    body.holdReason === undefined || body.holdReason === null
      ? ''
      : text(body.holdReason, 'Hold reason', 80, false);
  assert(
    status !== 'on_hold' || publicShipmentHoldReasons.includes(holdReason),
    'Choose the reason this shipment is on hold.',
  );
  return status === 'on_hold' ? holdReason : '';
}

function validDate(value, label, required = true) {
  if (!required && value === '') return '';
  const dateText = text(value, label, 10);
  const date = new Date(`${dateText}T00:00:00Z`);
  assert(
    /^\d{4}-\d{2}-\d{2}$/.test(dateText) &&
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === dateText,
    `Choose a valid ${label.toLowerCase()}.`,
  );
  return dateText;
}

export function publicShipmentInput(body) {
  const enteredTrackingNumber =
    body.trackingNumber === undefined || body.trackingNumber === null
      ? ''
      : text(body.trackingNumber, 'Tracking number', 40, false)
          .toUpperCase()
          .replace(/\s+/g, ' ');
  const compactTrackingNumber = enteredTrackingNumber.replace(/[\s-]+/g, '');
  const trackingNumber =
    /^\d{12}$/.test(compactTrackingNumber) || /^\d{15}$/.test(compactTrackingNumber)
      ? compactTrackingNumber
      : enteredTrackingNumber;
  assert(
    !trackingNumber || /^[A-Z0-9][A-Z0-9 -]{3,39}$/.test(trackingNumber),
    'Use a tracking number from 4–40 characters with letters, numbers, spaces, or hyphens.',
  );
  assert(
    !compactTrackingNumber ||
      !/^\d+$/.test(compactTrackingNumber) ||
      compactTrackingNumber.length === 12 ||
      compactTrackingNumber.length === 15,
    'For a FedEx-style tracking number, use 15 digits for Ground or 12 digits for Express-style services—or leave it blank to generate one.',
  );
  const userId =
    body.userId === undefined || body.userId === null || body.userId === ''
      ? null
      : text(body.userId, 'Workspace customer', 80);
  const recipientLabel = text(body.recipientLabel, 'Recipient / shipment label', 100);
  const originCity = text(body.originCity, 'Origin city', 80);
  const destinationCity = text(body.destinationCity, 'Destination city', 80);
  const originRegion = text(body.originRegion ?? '', 'Origin state / region', 40, false);
  const destinationRegion = text(body.destinationRegion ?? '', 'Destination state / region', 40, false);
  const originPostalCode = text(body.originPostalCode, 'Origin ZIP code', 10);
  const destinationPostalCode = text(body.destinationPostalCode, 'Destination ZIP code', 10);
  assert(/^\d{5}(?:-\d{4})?$/.test(originPostalCode), 'Enter a valid origin ZIP code.');
  assert(/^\d{5}(?:-\d{4})?$/.test(destinationPostalCode), 'Enter a valid destination ZIP code.');
  const destinationStreet = text(body.destinationStreet ?? '', 'Delivery street address', 200, false);
  assert(services.includes(body.service), 'Choose a valid shipping service.');
  const weightText =
    body.weight === undefined || body.weight === null ? '' : String(body.weight).trim();
  const weight = weightText === '' ? null : Number(weightText);
  assert(
    weight === null || (Number.isFinite(weight) && weight >= 0.1 && weight <= 150),
    'Enter a package weight from 0.1–150 lb, or leave it blank.',
  );
  const shipDate = validDate(body.shipDate, 'Ship date');
  const estimatedDelivery = validDate(body.estimatedDelivery ?? '', 'Estimated delivery', false) || null;
  assert(
    !estimatedDelivery || estimatedDelivery >= shipDate,
    'Estimated delivery cannot be before the ship date.',
  );
  assert(publicShipmentStatuses.includes(body.status), 'Choose a valid shipment status.');
  const holdReason = holdReasonInput(body, body.status);
  const photo = photoInput(body, body.status);
  const autoProgress = autoProgressInput(body);
  const currentLocation = text(body.currentLocation, 'Current location', 120);
  const publicNote = text(body.publicNote ?? '', 'Public note', 500, false);
  assert(body.isPublic === undefined || typeof body.isPublic === 'boolean', 'Choose public visibility.');
  return {
    trackingNumber,
    userId,
    recipientLabel,
    originCity,
    originRegion,
    originPostalCode,
    destinationCity,
    destinationRegion,
    destinationPostalCode,
    destinationStreet,
    service: body.service,
    weight,
    shipDate,
    estimatedDelivery,
    status: body.status,
    currentLocation,
    holdReason,
    photo,
    autoProgressEnabled: autoProgress.enabled && body.status !== 'delivered',
    autoProgressIntervalMinutes: autoProgress.intervalMinutes,
    publicNote,
    isPublic: body.isPublic ?? true,
  };
}

export function publicShipmentUpdateInput(body) {
  assert(publicShipmentStatuses.includes(body.status), 'Choose a valid shipment status.');
  const location = text(body.location, 'Update location', 120);
  const note = text(body.note ?? '', 'Public update note', 500, false);
  const holdReason = holdReasonInput(body, body.status);
  const photo = photoInput(body, body.status);
  const parsed = body.at === undefined || body.at === null || body.at === '' ? new Date() : new Date(body.at);
  assert(Number.isFinite(parsed.getTime()), 'Choose a valid update time.');
  return { status: body.status, location, note, holdReason, photo, at: parsed.toISOString() };
}

export function internalNoteInput(body) {
  return text(body.note ?? '', 'Internal note', 1000, false);
}

export function booleanInput(value, label) {
  assert(typeof value === 'boolean', `Choose a valid ${label.toLowerCase()} setting.`);
  return value;
}
