import { isUSZip, isSampleService, localDate, type SampleServiceId } from '@/lib/shipping';

export const WORKSPACE_KEY = 'fedexr:workspace:v1';
export const SESSION_KEY = 'fedexr:workspace-session:v1';
export const ACCESS_EVENT = 'fedexr:workspace-access';
export const DEMO_USER_ID = 'demo-workspace-user';
export const DEMO_USER_EMAIL = 'demo@workspace.local';
export const DEMO_ADMIN_USER_ID = 'demo-admin-workspace-user';
export const DEMO_ADMIN_USER_EMAIL = 'demo-admin@workspace.local';
export const DEMO_TRACKING_REFERENCE = 'LOCAL-12345';
export type WorkspaceRole = 'member' | 'admin';
export interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  status: 'active' | 'suspended';
  salt?: string;
  digest?: string;
  emailVerified?: boolean;
  demo?: boolean;
  createdAt: string;
}
export interface WorkspaceAddress {
  id: string;
  userId: string;
  label: string;
  name: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}
export interface ShipmentPlan {
  id: string;
  userId: string;
  reference: string;
  recipient: string;
  from: string;
  to: string;
  weight: string;
  service: SampleServiceId;
  shipDate: string;
  status: 'draft' | 'ready' | 'archived';
  notes: string;
  createdAt: string;
  updatedAt: string;
}
export interface WorkspaceActivity {
  id: string;
  actorId: string;
  action: string;
  at: string;
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
] as const;
export type PublicShipmentStatus = (typeof publicShipmentStatuses)[number];
export interface PublicShipmentEvent {
  id: string;
  status: PublicShipmentStatus;
  location: string;
  note: string;
  holdReason: string;
  /** Public stage photo (compressed data URL) for in_transit/delivered events; '' when none. */
  photo: string;
  at: string;
}
export interface PublicShipment {
  id: string;
  trackingNumber: string;
  userId: string | null;
  recipientLabel: string;
  originCity: string;
  originRegion: string;
  originPostalCode: string;
  destinationCity: string;
  destinationRegion: string;
  destinationPostalCode: string;
  service: SampleServiceId;
  weight: string;
  shipDate: string;
  estimatedDelivery: string;
  status: PublicShipmentStatus;
  currentLocation: string;
  holdReason: string;
  publicNote: string;
  internalNote: string;
  isPublic: boolean;
  archivedAt: string | null;
  /** Automatic route progression (administrator-enabled simulation). */
  autoProgressEnabled: boolean;
  autoProgressIntervalMinutes: number;
  /** ISO time the next automatic stage is due; '' when not scheduled. */
  autoProgressNextAt: string;
  events: PublicShipmentEvent[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
export type PublicShipmentInput = Pick<
  PublicShipment,
  | 'trackingNumber'
  | 'userId'
  | 'recipientLabel'
  | 'originCity'
  | 'originRegion'
  | 'originPostalCode'
  | 'destinationCity'
  | 'destinationRegion'
  | 'destinationPostalCode'
  | 'service'
  | 'weight'
  | 'shipDate'
  | 'estimatedDelivery'
  | 'status'
  | 'currentLocation'
  | 'holdReason'
  | 'publicNote'
  | 'isPublic'
  | 'autoProgressEnabled'
  | 'autoProgressIntervalMinutes'
> & {
  /** Transient stage photo saved onto the status event; not a shipment-level field. */
  photo: string;
};
export interface PublicShipmentUpdateInput {
  status: PublicShipmentStatus;
  location: string;
  note: string;
  holdReason: string;
  /** Public stage photo (compressed data URL) for in_transit/delivered updates; '' when none. */
  photo: string;
  at: string;
}
export interface WorkspaceData {
  stats?: { users: number; activeUsers: number; plans: number; addresses: number };
  truncated?: boolean;
  version: 1;
  users: WorkspaceUser[];
  addresses: WorkspaceAddress[];
  plans: ShipmentPlan[];
  shipments: PublicShipment[];
  activity: WorkspaceActivity[];
  settings: { name: string; announcements: string };
}
export interface WorkspaceSession {
  userId: string;
}
export type AddressInput = Omit<WorkspaceAddress, 'id' | 'userId'>;
export type PlanInput = Pick<
  ShipmentPlan,
  'reference' | 'recipient' | 'from' | 'to' | 'weight' | 'service' | 'shipDate' | 'notes'
>;
export const emptyWorkspace = (): WorkspaceData => ({
  version: 1,
  users: [],
  addresses: [],
  plans: [],
  shipments: [],
  activity: [],
  settings: { name: 'Shipping workspace', announcements: '' },
});
export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
export const timestamp = () => new Date().toISOString();
export function demoWorkspaceSeed(now = new Date()) {
  const createdAt = now.toISOString();
  const futureDate = (days: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    return localDate(date);
  };
  const profile: WorkspaceUser = {
    id: DEMO_USER_ID,
    name: 'Demo User',
    email: DEMO_USER_EMAIL,
    role: 'member',
    status: 'active',
    demo: true,
    createdAt,
  };
  const addresses: WorkspaceAddress[] = [
    {
      id: 'demo-address-home',
      userId: DEMO_USER_ID,
      label: 'Home',
      name: 'Demo User',
      street: '128 Sample Street',
      city: 'Chicago',
      region: 'IL',
      postalCode: '60601',
      country: 'United States',
      isDefault: true,
    },
    {
      id: 'demo-address-office',
      userId: DEMO_USER_ID,
      label: 'Office',
      name: 'Demo User',
      street: '450 Sample Avenue',
      city: 'New York',
      region: 'NY',
      postalCode: '10001',
      country: 'United States',
      isDefault: false,
    },
  ];
  const plans: ShipmentPlan[] = [
    {
      id: 'demo-plan-local-12345',
      userId: DEMO_USER_ID,
      reference: DEMO_TRACKING_REFERENCE,
      recipient: 'Demo recipient — Riverbend order',
      from: '60601',
      to: '10001',
      weight: '4.2',
      service: 'ground',
      shipDate: futureDate(2),
      status: 'ready',
      notes: 'Demo plan for reviewing the dashboard and sample tracking timeline.',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'demo-plan-local-67890',
      userId: DEMO_USER_ID,
      reference: '748512903645',
      recipient: 'Demo recipient — Office restock',
      from: '10001',
      to: '60601',
      weight: '12.5',
      service: '2day',
      shipDate: futureDate(5),
      status: 'draft',
      notes: 'A second demo plan so the dashboard, filters, and tracking links have more than one record to review.',
      createdAt,
      updatedAt: createdAt,
    },
  ];
  const shipments: PublicShipment[] = [
    {
      id: 'demo-shipment-local-12345',
      trackingNumber: DEMO_TRACKING_REFERENCE,
      userId: DEMO_USER_ID,
      recipientLabel: 'Demo recipient — Riverbend order',
      originCity: 'Chicago',
      originRegion: 'IL',
      originPostalCode: '60601',
      destinationCity: 'New York',
      destinationRegion: 'NY',
      destinationPostalCode: '10001',
      service: 'ground',
      weight: '4.2',
      shipDate: '2026-04-01',
      estimatedDelivery: '2026-04-02',
      status: 'delivered',
      currentLocation: 'NEW YORK, NY',
      holdReason: '',
      publicNote: 'Sample public shipment created for the demo workspace.',
      internalNote: 'Demo operations record. Internal notes are never shown on public tracking.',
      isPublic: true,
      archivedAt: null,
      autoProgressEnabled: false,
      autoProgressIntervalMinutes: 5,
      autoProgressNextAt: '',
      events: [
        {
          id: 'demo-shipment-local-12345-label',
          status: 'label_created',
          location: 'CHICAGO, IL',
          note: 'Label created',
          holdReason: '',
          photo: '',
          at: '2026-04-01T13:30:00Z',
        },
        {
          id: 'demo-shipment-local-12345-pickup',
          status: 'picked_up',
          location: 'CHICAGO, IL',
          note: 'Picked up',
          holdReason: '',
          photo: '',
          at: '2026-04-01T14:00:00Z',
        },
        {
          id: 'demo-shipment-local-12345-transit',
          status: 'in_transit',
          location: 'BROOKLYN, NY',
          note: 'Arrived at local facility',
          holdReason: '',
          photo: '',
          at: '2026-04-02T08:15:00Z',
        },
        {
          id: 'demo-shipment-local-12345-out',
          status: 'out_for_delivery',
          location: 'NEW YORK, NY',
          note: 'On vehicle for delivery',
          holdReason: '',
          photo: '',
          at: '2026-04-02T10:30:00Z',
        },
        {
          id: 'demo-shipment-local-12345-delivered',
          status: 'delivered',
          location: 'NEW YORK, NY',
          note: 'Delivered',
          holdReason: '',
          photo: '',
          at: '2026-04-02T12:45:00Z',
        },
      ],
      createdBy: DEMO_ADMIN_USER_ID,
      createdAt,
      updatedAt: '2026-04-02T12:45:00Z',
    },
    {
      id: 'demo-shipment-local-67890',
      trackingNumber: '748512903645',
      userId: DEMO_USER_ID,
      recipientLabel: 'Demo recipient — Office restock',
      originCity: 'New York',
      originRegion: 'NY',
      originPostalCode: '10001',
      destinationCity: 'Chicago',
      destinationRegion: 'IL',
      destinationPostalCode: '60601',
      service: '2day',
      weight: '12.5',
      shipDate: futureDate(0),
      estimatedDelivery: futureDate(2),
      status: 'in_transit',
      currentLocation: 'NEW YORK, NY',
      holdReason: '',
      publicNote: 'Second demo shipment for testing administrator updates.',
      internalNote: '',
      isPublic: true,
      archivedAt: null,
      autoProgressEnabled: false,
      autoProgressIntervalMinutes: 5,
      autoProgressNextAt: '',
      events: [
        {
          id: 'demo-shipment-local-67890-label',
          status: 'label_created',
          location: 'NEW YORK, NY',
          note: 'Label created',
          holdReason: '',
          photo: '',
          at: createdAt,
        },
        {
          id: 'demo-shipment-local-67890-transit',
          status: 'in_transit',
          location: 'NEW YORK, NY',
          note: 'Departed origin facility',
          holdReason: '',
          photo: '',
          at: createdAt,
        },
      ],
      createdBy: DEMO_ADMIN_USER_ID,
      createdAt,
      updatedAt: createdAt,
    },
  ];
  return { profile, addresses, plans, shipments };
}
export function withDemoWorkspace(data: WorkspaceData, now = new Date()): WorkspaceData {
  const seed = demoWorkspaceSeed(now);
  const existing = data.users.find((entry) => entry.id === DEMO_USER_ID);
  const profile: WorkspaceUser = existing
    ? {
        ...existing,
        name: existing.name || seed.profile.name,
        email: DEMO_USER_EMAIL,
        role: 'member',
        demo: true,
      }
    : seed.profile;
  const users = existing
    ? data.users.map((entry) => (entry.id === DEMO_USER_ID ? profile : entry))
    : [...data.users, profile];
  const addresses = [
    ...data.addresses,
    ...seed.addresses.filter(
      (record) => !data.addresses.some((entry) => entry.id === record.id),
    ),
  ].slice(0, 300);
  const plans = [
    ...data.plans,
    ...seed.plans.filter((record) => !data.plans.some((entry) => entry.id === record.id)),
  ].slice(0, 500);
  const shipments = [
    ...data.shipments,
    ...seed.shipments.filter(
      (record) =>
        !data.shipments.some(
          (entry) =>
            entry.id === record.id ||
            entry.trackingNumber.toUpperCase() === record.trackingNumber.toUpperCase(),
        ),
    ),
  ].slice(0, 500);
  return { ...data, users, addresses, plans, shipments };
}
export function demoAdminProfile(now = new Date()): WorkspaceUser {
  return {
    id: DEMO_ADMIN_USER_ID,
    name: 'Demo Administrator',
    email: DEMO_ADMIN_USER_EMAIL,
    role: 'admin',
    status: 'active',
    demo: true,
    createdAt: now.toISOString(),
  };
}
export function withDemoAdminWorkspace(data: WorkspaceData, now = new Date()): WorkspaceData {
  const seeded = withDemoWorkspace(data, now);
  const seed = demoAdminProfile(now);
  const existing = seeded.users.find((entry) => entry.id === DEMO_ADMIN_USER_ID);
  const profile: WorkspaceUser = existing
    ? {
        ...existing,
        name: existing.name || seed.name,
        email: DEMO_ADMIN_USER_EMAIL,
        role: 'admin',
        demo: true,
      }
    : seed;
  return {
    ...seeded,
    users: existing
      ? seeded.users.map((entry) => (entry.id === DEMO_ADMIN_USER_ID ? profile : entry))
      : [...seeded.users, profile],
  };
}
export const validEmail = (value: string) =>
  value.trim().length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max = 1000) => typeof value === 'string' && value.length <= max;

export function readWorkspace(): WorkspaceData {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (!raw || raw.length > 2000000) return emptyWorkspace();
    const value: unknown = JSON.parse(raw);
    if (!object(value) || value.version !== 1 || !Array.isArray(value.users))
      return emptyWorkspace();
    const users = value.users
      .filter((entry): entry is WorkspaceUser => {
        if (
          !object(entry) ||
          !text(entry.id, 80) ||
          !text(entry.name, 60) ||
          !text(entry.email, 160) ||
          (entry.role !== 'member' && entry.role !== 'admin') ||
          (entry.status !== 'active' && entry.status !== 'suspended') ||
          !text(entry.createdAt, 40)
        )
          return false;
        const demoProfile =
          entry.demo === true &&
          ((entry.id === DEMO_USER_ID &&
            entry.email === DEMO_USER_EMAIL &&
            entry.role === 'member') ||
            (entry.id === DEMO_ADMIN_USER_ID &&
              entry.email === DEMO_ADMIN_USER_EMAIL &&
              entry.role === 'admin'));
        return (
          demoProfile ||
          (typeof entry.salt === 'string' &&
            /^[a-f0-9]{32}$/.test(entry.salt) &&
            typeof entry.digest === 'string' &&
            /^[a-f0-9]{64}$/.test(entry.digest))
        );
      })
      .slice(0, 100);
    const known = new Set(users.map((user) => user.id));
    const addresses = Array.isArray(value.addresses)
      ? value.addresses
          .filter(
            (entry): entry is WorkspaceAddress =>
              object(entry) &&
              text(entry.id, 80) &&
              typeof entry.userId === 'string' &&
              known.has(entry.userId) &&
              ['label', 'name', 'street', 'city', 'region', 'postalCode', 'country'].every((key) =>
                text(entry[key], 200),
              ) &&
              typeof entry.isDefault === 'boolean',
          )
          .slice(0, 300)
      : [];
    const plans = Array.isArray(value.plans)
      ? value.plans
          .filter(
            (entry): entry is ShipmentPlan =>
              object(entry) &&
              text(entry.id, 80) &&
              typeof entry.userId === 'string' &&
              known.has(entry.userId) &&
              [
                'reference',
                'recipient',
                'from',
                'to',
                'weight',
                'shipDate',
                'notes',
                'createdAt',
                'updatedAt',
              ].every((key) => text(entry[key])) &&
              typeof entry.service === 'string' &&
              isSampleService(entry.service) &&
              ['draft', 'ready', 'archived'].includes(String(entry.status)),
          )
          .slice(0, 500)
      : [];
    const shipments = Array.isArray(value.shipments)
      ? value.shipments
          .filter((entry): entry is PublicShipment => {
            if (
              !object(entry) ||
              !text(entry.id, 80) ||
              !text(entry.trackingNumber, 40) ||
              !(entry.userId === null || (typeof entry.userId === 'string' && known.has(entry.userId))) ||
              !text(entry.recipientLabel, 100) ||
              !text(entry.originCity, 80) ||
              !text(entry.originRegion, 40) ||
              !text(entry.originPostalCode, 10) ||
              !text(entry.destinationCity, 80) ||
              !text(entry.destinationRegion, 40) ||
              !text(entry.destinationPostalCode, 10) ||
              typeof entry.service !== 'string' ||
              !isSampleService(entry.service) ||
              !text(entry.weight, 20) ||
              !text(entry.shipDate, 10) ||
              !text(entry.estimatedDelivery, 10) ||
              !publicShipmentStatuses.includes(entry.status as PublicShipmentStatus) ||
              !text(entry.currentLocation, 120) ||
              !text(entry.publicNote, 500) ||
              typeof entry.isPublic !== 'boolean' ||
              !Array.isArray(entry.events) ||
              !text(entry.createdBy, 80) ||
              !text(entry.createdAt, 40) ||
              !text(entry.updatedAt, 40)
            )
              return false;
            return entry.events.every(
              (event) =>
                object(event) &&
                text(event.id, 80) &&
                publicShipmentStatuses.includes(event.status as PublicShipmentStatus) &&
                text(event.location, 120) &&
                text(event.note, 500) &&
                text(event.at, 40),
            );
          })
          .map((entry) => ({
            ...entry,
            holdReason:
              typeof entry.holdReason === 'string' && entry.holdReason.length <= 80
                ? entry.holdReason
                : '',
            internalNote:
              typeof entry.internalNote === 'string' && entry.internalNote.length <= 1000
                ? entry.internalNote
                : '',
            archivedAt: typeof entry.archivedAt === 'string' ? entry.archivedAt : null,
            autoProgressEnabled: entry.autoProgressEnabled === true,
            autoProgressIntervalMinutes:
              typeof entry.autoProgressIntervalMinutes === 'number' &&
              Number.isFinite(entry.autoProgressIntervalMinutes)
                ? Math.min(1440, Math.max(1, Math.round(entry.autoProgressIntervalMinutes)))
                : 5,
            autoProgressNextAt:
              typeof entry.autoProgressNextAt === 'string' ? entry.autoProgressNextAt : '',
            events: entry.events.map((event) => ({
              ...event,
              holdReason:
                typeof event.holdReason === 'string' && event.holdReason.length <= 80
                  ? event.holdReason
                  : '',
              photo:
                typeof event.photo === 'string' &&
                /^data:image\/(jpeg|png|webp);base64,/.test(event.photo) &&
                event.photo.length <= 400_000
                  ? event.photo
                  : '',
            })),
          }))
          .slice(0, 500)
      : [];
    const activity = Array.isArray(value.activity)
      ? value.activity
          .filter(
            (entry): entry is WorkspaceActivity =>
              object(entry) &&
              text(entry.id, 80) &&
              text(entry.actorId, 80) &&
              text(entry.action, 300) &&
              text(entry.at, 40),
          )
          .slice(-100)
      : [];
    const settings =
      object(value.settings) &&
      text(value.settings.name, 60) &&
      text(value.settings.announcements, 300)
        ? { name: String(value.settings.name), announcements: String(value.settings.announcements) }
        : emptyWorkspace().settings;
    return { version: 1, users, plans, addresses, shipments, activity, settings };
  } catch {
    return emptyWorkspace();
  }
}
export function writeWorkspace(data: WorkspaceData) {
  try {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(data));
  } catch {
    throw new Error(
      'Browser storage is unavailable or full. Your change was not saved. Export your records or allow storage, then try again.',
    );
  }
}
export function readSession(): WorkspaceSession | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    return object(value) && text(value.userId, 80) ? { userId: String(value.userId) } : null;
  } catch {
    return null;
  }
}
export function storeSession(session: WorkspaceSession | null) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    throw new Error(
      'Tab session storage is unavailable. Allow browser storage to use workspace access.',
    );
  }
}
export function credentialError(
  name: string,
  email: string,
  passphrase: string,
  confirmation?: string,
) {
  if (!name.trim() || name.trim().length > 60)
    return 'Enter a display name from 1 to 60 characters.';
  if (!validEmail(email)) return 'Enter a valid workspace email address.';
  if (passphrase.length < 10 || passphrase.length > 128)
    return 'Use a new workspace passphrase from 10 to 128 characters—not your FedEx password.';
  if (confirmation !== undefined && confirmation !== passphrase)
    return 'The workspace passphrases do not match.';
  return '';
}
function hex(buffer: ArrayBuffer | Uint8Array) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function derive(passphrase: string, salt: string): Promise<string> {
  if (!crypto.subtle)
    throw new Error(
      'A secure browser connection is required for workspace passphrases. Use the HTTPS preview or a local development origin.',
    );
  const bytes = Uint8Array.from(salt.match(/.{2}/g)!.map((part) => parseInt(part, 16)));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return hex(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: bytes, iterations: 210000, hash: 'SHA-256' },
      key,
      256,
    ),
  );
}
export async function makeCredential(passphrase: string) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, digest: await derive(passphrase, salt) };
}
export async function verifyCredential(user: WorkspaceUser, passphrase: string): Promise<boolean> {
  if (!user.salt || !user.digest) return false;
  const digest = await derive(passphrase, user.salt);
  let diff = 0;
  for (let index = 0; index < digest.length; index++)
    diff |= digest.charCodeAt(index) ^ user.digest.charCodeAt(index);
  return diff === 0;
}
export function addressError(input: AddressInput) {
  if (
    ![input.label, input.name, input.street, input.city, input.postalCode, input.country].every(
      (value) => value.trim(),
    )
  )
    return 'Complete the label, recipient, street, city, postal code, and country.';
  if (Object.values(input).some((value) => typeof value === 'string' && value.length > 200))
    return 'Address fields must be no longer than 200 characters.';
  return '';
}
export function planError(input: PlanInput, allowPastDate = false) {
  if (!input.recipient.trim() || input.recipient.length > 100)
    return 'Enter a recipient or project name from 1 to 100 characters.';
  if (!isUSZip(input.from) || !isUSZip(input.to))
    return 'Enter valid U.S. ZIP codes for this parcel-planning tool.';
  if (
    !Number.isFinite(Number(input.weight)) ||
    Number(input.weight) < 0.1 ||
    Number(input.weight) > 150
  )
    return 'Enter a planned package weight from 0.1 to 150 lb.';
  if (!isSampleService(input.service)) return 'Choose a shipping service.';
  const date = new Date(`${input.shipDate}T12:00:00`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.shipDate) ||
    !Number.isFinite(date.getTime()) ||
    localDate(date) !== input.shipDate ||
    (!allowPastDate && input.shipDate < localDate())
  )
    return 'Choose today or a future planned ship date.';
  if (input.reference.length > 40 || input.notes.length > 1000)
    return 'Use at most 40 characters for a reference and 1,000 for notes.';
  return '';
}
export function publicWorkspaceExport(data: WorkspaceData) {
  return {
    version: 1,
    exportedAt: timestamp(),
    settings: data.settings,
    users: data.users.map(({ id, name, email, role, status, createdAt }) => ({
      id,
      name,
      email,
      role,
      status,
      createdAt,
    })),
    plans: data.plans,
    shipments: data.shipments,
    addresses: data.addresses,
    activity: data.activity,
  };
}
