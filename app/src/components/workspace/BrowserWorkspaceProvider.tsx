import { useEffect, useRef, useState, type ReactNode } from 'react';
import { WorkspaceContext, type WorkspaceContextValue } from '@/context/workspace';
import {
  ACCESS_EVENT,
  DEMO_ADMIN_USER_EMAIL,
  DEMO_ADMIN_USER_ID,
  DEMO_USER_EMAIL,
  DEMO_USER_ID,
  WORKSPACE_KEY,
  addressError,
  credentialError,
  makeCredential,
  newId,
  planError,
  readSession,
  readWorkspace,
  storeSession,
  timestamp,
  validEmail,
  verifyCredential,
  withDemoAdminWorkspace,
  withDemoWorkspace,
  writeWorkspace,
  type AddressInput,
  type PlanInput,
  type PublicShipment,
  type PublicShipmentInput,
  type PublicShipmentUpdateInput,
  type ShipmentPlan,
  type WorkspaceData,
  type WorkspaceRole,
  type WorkspaceSession,
  type WorkspaceUser,
} from '@/lib/workspace';
import {
  applyAutoProgress,
  generateTrackingNumber,
  normalizeAutoProgressInterval,
  normalizeTrackingNumber,
  publicShipmentError,
  publicShipmentEventError,
  shipmentStateFromEvents,
} from '@/lib/publicShipments';

export default function BrowserWorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(readWorkspace);
  const [session, setSession] = useState<WorkspaceSession | null>(readSession);
  const dataRef = useRef(data);
  const sessionRef = useRef(session);
  const user =
    data.users.find((entry) => entry.id === session?.userId && entry.status === 'active') || null;

  useEffect(() => {
    const update = (event: StorageEvent) => {
      if (event.key === WORKSPACE_KEY || event.key === null) {
        const next = readWorkspace();
        const previous = dataRef.current.users.find(
          (entry) => entry.id === sessionRef.current?.userId,
        );
        const current = next.users.find(
          (entry) => entry.id === sessionRef.current?.userId && entry.status === 'active',
        );
        if (sessionRef.current && (!current || (previous && previous.digest !== current.digest))) {
          try {
            storeSession(null);
          } catch {
            /* The inactive profile is still denied access if storage is blocked. */
          }
          sessionRef.current = null;
          setSession(null);
        }
        dataRef.current = next;
        setData(next);
      }
    };
    // Old flags and a plaintext legacy password no longer control access.
    try {
      ['isAdmin', 'isLoggedIn', 'adminPassword'].forEach((key) => localStorage.removeItem(key));
    } catch {
      /* Storage availability is checked on each save/sign-in. */
    }
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);

  function publish(next: WorkspaceData) {
    writeWorkspace(next);
    dataRef.current = next;
    setData(next);
  }

  // Automatic route progression: apply due application-generated stage
  // updates on load and on a short timer while the workspace is open.
  useEffect(() => {
    const applyDue = () => {
      const current = dataRef.current;
      let changed = false;
      const shipments = current.shipments.map((shipment) => {
        const next = applyAutoProgress(shipment, new Date(), () => newId('shipment-event'));
        if (next !== shipment) changed = true;
        return next;
      });
      if (changed) publish({ ...current, shipments });
    };
    applyDue();
    const timer = window.setInterval(applyDue, 15_000);
    return () => window.clearInterval(timer);
  }, []);
  function requireUser(admin = false) {
    const current = dataRef.current.users.find(
      (entry) => entry.id === session?.userId && entry.status === 'active',
    );
    if (!current || (admin && current.role !== 'admin'))
      throw new Error(
        'This action requires an active workspace profile with the appropriate role.',
      );
    return current;
  }
  function activity(next: WorkspaceData, action: string, actorId = user?.id || ''): WorkspaceData {
    return {
      ...next,
      activity: [
        ...next.activity,
        { id: newId('activity'), actorId, action, at: timestamp() },
      ].slice(-100),
    };
  }
  function enter(userId: string) {
    storeSession({ userId });
    sessionRef.current = { userId };
    setSession({ userId });
    window.dispatchEvent(new Event(ACCESS_EVENT));
  }
  async function signIn(email: string, passphrase: string, role?: WorkspaceRole) {
    const profile = dataRef.current.users.find(
      (entry) => entry.email === email.trim().toLowerCase(),
    );
    if (profile?.demo)
      throw new Error(
        profile.role === 'admin'
          ? 'Use the one-click admin login on this page. The admin demo profile has no passphrase.'
          : 'Use the one-click demo login on this page. The demo profile has no passphrase.',
      );
    if (
      !profile ||
      profile.status !== 'active' ||
      (role === 'admin' && profile.role !== 'admin') ||
      !(await verifyCredential(profile, passphrase))
    )
      throw new Error(
        'The workspace email or passphrase is incorrect, or this profile does not have the required access.',
      );
    const latest = dataRef.current.users.find((entry) => entry.id === profile.id);
    if (!latest || latest.status !== 'active' || latest.digest !== profile.digest)
      throw new Error('This profile changed during sign-in. Please try again.');
    enter(profile.id);
  }
  async function register(name: string, email: string, passphrase: string, owner = false) {
    const error = credentialError(name, email, passphrase);
    if (error) throw new Error(error);
    const current = dataRef.current;
    if (current.users.length >= 100)
      throw new Error('This browser workspace has reached its profile limit.');
    if (owner && current.users.some((entry) => entry.role === 'admin' && !entry.demo))
      throw new Error(
        'An administrator already exists in this browser. Use administrator sign-in.',
      );
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail === DEMO_USER_EMAIL)
      throw new Error(
        'That email is reserved for the one-click demo login. Choose another workspace email.',
      );
    if (normalizedEmail === DEMO_ADMIN_USER_EMAIL)
      throw new Error(
        'That email is reserved for the one-click admin login. Choose another workspace email.',
      );
    if (current.users.some((entry) => entry.email === normalizedEmail))
      throw new Error(
        'A workspace profile already uses that email. Sign in to that profile or use a different email.',
      );
    const credential = await makeCredential(passphrase);
    // Re-check after derivation so simultaneous setup cannot add two owners.
    if (dataRef.current.users.length >= 100)
      throw new Error('This browser workspace has reached its profile limit.');
    if (
      dataRef.current.users.some(
        (entry) =>
          entry.email === normalizedEmail || (owner && entry.role === 'admin' && !entry.demo),
      )
    )
      throw new Error('That profile or administrator was created already. Sign in instead.');
    const profile: WorkspaceUser = {
      id: newId('profile'),
      name: name.trim(),
      email: normalizedEmail,
      role: owner ? 'admin' : 'member',
      status: 'active',
      ...credential,
      createdAt: timestamp(),
    };
    const retainedUsers = owner
      ? dataRef.current.users.filter((entry) => entry.id !== DEMO_ADMIN_USER_ID)
      : dataRef.current.users;
    publish(
      activity(
        { ...dataRef.current, users: [...retainedUsers, profile] },
        owner ? 'Administrator workspace initialized' : 'Workspace profile created',
        profile.id,
      ),
    );
    enter(profile.id);
  }
  async function enterDemoAccess() {
    const current = dataRef.current;
    const existing = current.users.find((entry) => entry.id === DEMO_USER_ID);
    if (current.users.some((entry) => entry.email === DEMO_USER_EMAIL && entry.id !== DEMO_USER_ID))
      throw new Error(
        'A browser profile already uses the demo email. Demo login was not opened so that profile stays separate.',
      );
    if (existing && existing.status !== 'active')
      throw new Error(
        'The demo profile is suspended in this browser. An administrator can activate it from workspace settings.',
      );
    if (!existing && current.users.length >= 100)
      throw new Error('This browser workspace has reached its profile limit. Demo login was not opened.');
    publish(
      activity(withDemoWorkspace(current), 'Demo workspace opened', DEMO_USER_ID),
    );
    enter(DEMO_USER_ID);
  }
  async function enterAdminDemoAccess() {
    const current = dataRef.current;
    if (
      current.users.some(
        (entry) => entry.email === DEMO_ADMIN_USER_EMAIL && entry.id !== DEMO_ADMIN_USER_ID,
      )
    )
      throw new Error(
        'A browser profile already uses the admin demo email. Admin demo login was not opened so that profile stays separate.',
      );
    if (current.users.some((entry) => entry.role === 'admin' && !entry.demo))
      throw new Error(
        'One-click admin login is unavailable because a credentialed administrator already exists in this browser. Use administrator sign-in.',
      );
    const existing = current.users.find((entry) => entry.id === DEMO_ADMIN_USER_ID);
    if (existing && existing.status !== 'active')
      throw new Error('The admin demo profile is suspended in this browser.');
    if (!existing && current.users.length >= 100)
      throw new Error(
        'This browser workspace has reached its profile limit. Admin demo login was not opened.',
      );
    publish(
      activity(
        withDemoAdminWorkspace(current),
        'Demo administrator workspace opened',
        DEMO_ADMIN_USER_ID,
      ),
    );
    enter(DEMO_ADMIN_USER_ID);
  }
  function signOut() {
    storeSession(null);
    sessionRef.current = null;
    setSession(null);
    window.dispatchEvent(new Event(ACCESS_EVENT));
  }
  function saveAddress(input: AddressInput, id?: string) {
    const profile = requireUser();
    const error = addressError(input);
    if (error) throw new Error(error);
    const current = dataRef.current;
    if (id && !current.addresses.some((entry) => entry.id === id && entry.userId === profile.id))
      throw new Error('That address does not belong to this workspace profile.');
    if (!id && current.addresses.length >= 300)
      throw new Error('This browser workspace supports at most 300 saved addresses.');
    if (!id && current.addresses.filter((entry) => entry.userId === profile.id).length >= 50)
      throw new Error('Keep at most 50 saved addresses in this local profile.');
    const isDefault =
      input.isDefault ||
      !current.addresses.some(
        (entry) => entry.userId === profile.id && entry.id !== id && entry.isDefault,
      );
    const record = { ...input, id: id || newId('address'), userId: profile.id, isDefault };
    const entries = current.addresses
      .filter((entry) => entry.id !== id)
      .map((entry) =>
        isDefault && entry.userId === profile.id ? { ...entry, isDefault: false } : entry,
      );
    publish(
      activity(
        { ...current, addresses: [...entries, record] },
        id ? 'Saved address updated' : 'Address added',
      ),
    );
    return record;
  }
  function removeAddress(id: string) {
    const profile = requireUser();
    const current = dataRef.current;
    const record = current.addresses.find(
      (entry) => entry.id === id && entry.userId === profile.id,
    );
    if (!record) throw new Error('That address was not found in your profile.');
    let addresses = current.addresses.filter((entry) => entry.id !== id);
    if (record.isDefault) {
      const first = addresses.find((entry) => entry.userId === profile.id);
      if (first)
        addresses = addresses.map((entry) =>
          entry.id === first.id ? { ...entry, isDefault: true } : entry,
        );
    }
    publish(activity({ ...current, addresses }, 'Saved address removed'));
  }
  function setDefaultAddress(id: string) {
    const profile = requireUser();
    const current = dataRef.current;
    if (!current.addresses.some((entry) => entry.id === id && entry.userId === profile.id))
      throw new Error('That address was not found in your profile.');
    publish(
      activity(
        {
          ...current,
          addresses: current.addresses.map((entry) =>
            entry.userId === profile.id ? { ...entry, isDefault: entry.id === id } : entry,
          ),
        },
        'Default address changed',
      ),
    );
  }
  function savePlan(input: PlanInput, id?: string) {
    const profile = requireUser();
    const error = planError(input, Boolean(id));
    if (error) throw new Error(error);
    const current = dataRef.current;
    const existing = current.plans.find((entry) => entry.id === id);
    if (id && (!existing || (existing.userId !== profile.id && profile.role !== 'admin')))
      throw new Error('You do not have access to that shipment plan.');
    if (!id && current.plans.length >= 500)
      throw new Error('This browser workspace supports at most 500 shipment plans.');
    const record: ShipmentPlan = {
      ...input,
      id: existing?.id || newId('plan'),
      userId: existing?.userId || profile.id,
      reference: input.reference.trim(),
      recipient: input.recipient.trim(),
      from: input.from.trim(),
      to: input.to.trim(),
      status: existing?.status || 'draft',
      createdAt: existing?.createdAt || timestamp(),
      updatedAt: timestamp(),
    };
    publish(
      activity(
        { ...current, plans: [...current.plans.filter((entry) => entry.id !== id), record] },
        existing ? 'Shipment plan updated' : 'Shipment plan created',
      ),
    );
    return record;
  }
  function planAccess(id: string) {
    const profile = requireUser();
    const plan = dataRef.current.plans.find((entry) => entry.id === id);
    if (!plan || (plan.userId !== profile.id && profile.role !== 'admin'))
      throw new Error('You do not have access to that shipment plan.');
    return plan;
  }
  function updatePlanStatus(id: string, status: ShipmentPlan['status']) {
    planAccess(id);
    if (!['draft', 'ready', 'archived'].includes(status))
      throw new Error('Choose a valid local planning status.');
    const current = dataRef.current;
    publish(
      activity(
        {
          ...current,
          plans: current.plans.map((entry) =>
            entry.id === id ? { ...entry, status, updatedAt: timestamp() } : entry,
          ),
        },
        `Plan marked ${status}`,
      ),
    );
  }
  function removePlan(id: string) {
    planAccess(id);
    const current = dataRef.current;
    publish(
      activity(
        { ...current, plans: current.plans.filter((entry) => entry.id !== id) },
        'Shipment plan removed',
      ),
    );
  }
  function publicShipmentRecord(id: string) {
    requireUser(true);
    const existing = dataRef.current.shipments.find((entry) => entry.id === id);
    if (!existing) throw new Error('That public shipment was not found.');
    return existing;
  }
  function activePublicShipmentRecord(id: string) {
    const existing = publicShipmentRecord(id);
    if (existing.archivedAt)
      throw new Error('Restore this archived shipment before changing its tracking timeline.');
    return existing;
  }
  function publishPublicShipment(record: PublicShipment, action: string) {
    const current = dataRef.current;
    publish(
      activity(
        {
          ...current,
          shipments: current.shipments.map((entry) => (entry.id === record.id ? record : entry)),
        },
        action,
      ),
    );
  }
  function validatePublicShipmentEvent(input: PublicShipmentUpdateInput) {
    const error = publicShipmentEventError(input);
    if (error) throw new Error(error);
    return {
      status: input.status,
      location: input.location.trim(),
      note: input.note.trim(),
      holdReason: input.status === 'on_hold' ? input.holdReason : '',
      photo: ['in_transit', 'delivered'].includes(input.status) ? input.photo : '',
      at: new Date(input.at).toISOString(),
    };
  }
  function publicNoteAfterEventRemoval(record: PublicShipment, removedNote: string) {
    if (!removedNote || record.publicNote !== removedNote) return record.publicNote;
    return (
      [...record.events]
        .sort((a, b) => a.at.localeCompare(b.at))
        .reverse()
        .find((event) => event.note.trim())?.note || ''
    );
  }
  function savePublicShipment(input: PublicShipmentInput, id?: string) {
    const admin = requireUser(true);
    const error = publicShipmentError(input);
    if (error) throw new Error(error);
    const current = dataRef.current;
    const existing = id ? current.shipments.find((entry) => entry.id === id) : undefined;
    if (id && !existing) throw new Error('That public shipment was not found.');
    if (
      input.userId &&
      !current.users.some((entry) => entry.id === input.userId && entry.status === 'active')
    )
      throw new Error('Choose an active workspace customer for this shipment.');
    let trackingNumber = normalizeTrackingNumber(input.trackingNumber);
    if (!trackingNumber) {
      do {
        trackingNumber = generateTrackingNumber(input.service);
      } while (
        current.shipments.some(
          (entry) => normalizeTrackingNumber(entry.trackingNumber) === trackingNumber,
        )
      );
    }
    if (
      current.shipments.some(
        (entry) =>
          entry.id !== id && normalizeTrackingNumber(entry.trackingNumber) === trackingNumber,
      )
    )
      throw new Error('Another public shipment already uses that tracking number.');
    if (!existing && current.shipments.length >= 500)
      throw new Error('This browser workspace supports at most 500 public shipments.');
    const now = timestamp();
    const stagePhoto = ['in_transit', 'delivered'].includes(input.status) ? input.photo : '';
    const statusChanged =
      existing &&
      (existing.status !== input.status ||
        existing.currentLocation !== input.currentLocation.trim() ||
        (existing.status === 'on_hold' ? existing.holdReason : '') !==
          (input.status === 'on_hold' ? input.holdReason : '') ||
        Boolean(stagePhoto));
    const events = existing
      ? statusChanged
        ? [
            ...existing.events,
            {
              id: newId('shipment-event'),
              status: input.status,
              location: input.currentLocation.trim(),
              note: input.publicNote.trim() || 'Shipment updated',
              holdReason: input.status === 'on_hold' ? input.holdReason : '',
              photo: stagePhoto,
              at: now,
            },
          ]
        : existing.events
      : [
          {
            id: newId('shipment-event'),
            status: input.status,
            location: input.currentLocation.trim(),
            note: input.publicNote.trim() || 'Shipment created',
            holdReason: input.status === 'on_hold' ? input.holdReason : '',
            photo: stagePhoto,
            at: now,
          },
        ];
    const shipmentFields: Omit<PublicShipmentInput, 'photo'> = { ...input };
    delete (shipmentFields as Partial<PublicShipmentInput>).photo;
    const record: PublicShipment = {
      ...shipmentFields,
      id: existing?.id || newId('shipment'),
      trackingNumber,
      recipientLabel: input.recipientLabel.trim(),
      originCity: input.originCity.trim(),
      originRegion: input.originRegion.trim(),
      originPostalCode: input.originPostalCode.trim(),
      destinationCity: input.destinationCity.trim(),
      destinationRegion: input.destinationRegion.trim(),
      destinationPostalCode: input.destinationPostalCode.trim(),
      currentLocation: input.currentLocation.trim(),
      holdReason: input.status === 'on_hold' ? input.holdReason : '',
      publicNote: input.publicNote.trim(),
      internalNote: existing?.internalNote || '',
      archivedAt: existing?.archivedAt || null,
      autoProgressEnabled:
        input.status === 'delivered' ? false : Boolean(input.autoProgressEnabled),
      autoProgressIntervalMinutes: normalizeAutoProgressInterval(
        input.autoProgressIntervalMinutes,
      ),
      autoProgressNextAt:
        input.status !== 'delivered' && input.autoProgressEnabled
          ? existing?.autoProgressEnabled &&
            existing.autoProgressNextAt &&
            normalizeAutoProgressInterval(existing.autoProgressIntervalMinutes) ===
              normalizeAutoProgressInterval(input.autoProgressIntervalMinutes)
            ? existing.autoProgressNextAt
            : new Date(
                Date.now() +
                  normalizeAutoProgressInterval(input.autoProgressIntervalMinutes) * 60_000,
              ).toISOString()
          : '',
      events: events.slice(-100),
      createdBy: existing?.createdBy || admin.id,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    publish(
      activity(
        {
          ...current,
          shipments: [...current.shipments.filter((entry) => entry.id !== id), record],
        },
        existing ? 'Public shipment updated' : 'Public shipment created',
      ),
    );
    return record;
  }
  function addPublicShipmentUpdate(id: string, input: PublicShipmentUpdateInput) {
    const existing = activePublicShipmentRecord(id);
    const update = validatePublicShipmentEvent({
      ...input,
      at: input.at || timestamp(),
    });
    const record: PublicShipment = {
      ...existing,
      status: update.status,
      currentLocation: update.location,
      holdReason: update.holdReason,
      publicNote: update.note || existing.publicNote,
      // A manual status update takes over the route from automatic progression.
      autoProgressEnabled: false,
      autoProgressNextAt: '',
      events: [
        ...existing.events,
        {
          id: newId('shipment-event'),
          ...update,
        },
      ].slice(-100),
      updatedAt: timestamp(),
    };
    publishPublicShipment(record, 'Public shipment tracking update added');
  }
  function updatePublicShipmentEvent(
    id: string,
    eventId: string,
    input: PublicShipmentUpdateInput,
  ) {
    const existing = activePublicShipmentRecord(id);
    if (!existing.events.some((event) => event.id === eventId))
      throw new Error('That tracking event was not found.');
    const update = validatePublicShipmentEvent(input);
    const events = existing.events.map((event) =>
      event.id === eventId ? { ...event, ...update } : event,
    );
    const state = shipmentStateFromEvents(events, existing);
    const latest = [...events].sort((a, b) => a.at.localeCompare(b.at)).at(-1);
    const record: PublicShipment = {
      ...existing,
      ...state,
      publicNote: latest?.id === eventId && latest.note ? latest.note : existing.publicNote,
      // Correcting an event is a manual change; automatic progression pauses.
      autoProgressEnabled: false,
      autoProgressNextAt: '',
      events,
      updatedAt: timestamp(),
    };
    publishPublicShipment(record, 'Public shipment tracking event corrected');
  }
  function removePublicShipmentEvent(id: string, eventId: string) {
    const existing = activePublicShipmentRecord(id);
    const removed = existing.events.find((event) => event.id === eventId);
    if (!removed) throw new Error('That tracking event was not found.');
    if (existing.events.length <= 1)
      throw new Error('Keep at least one tracking event for this shipment.');
    const events = existing.events.filter((event) => event.id !== eventId);
    const state = shipmentStateFromEvents(events, existing);
    const withoutRemoved = { ...existing, events };
    const record: PublicShipment = {
      ...existing,
      ...state,
      publicNote: publicNoteAfterEventRemoval(withoutRemoved, removed.note),
      // Removing an event is a manual correction; automatic progression pauses.
      autoProgressEnabled: false,
      autoProgressNextAt: '',
      events,
      updatedAt: timestamp(),
    };
    publishPublicShipment(record, 'Public shipment tracking event removed');
  }
  function undoPublicShipmentUpdate(id: string) {
    const existing = activePublicShipmentRecord(id);
    if (existing.events.length <= 1)
      throw new Error('There is no later tracking update to undo.');
    const latest = [...existing.events].sort((a, b) => a.at.localeCompare(b.at)).at(-1)!;
    removePublicShipmentEvent(id, latest.id);
  }
  function setPublicShipmentAutoProgress(id: string, enabled: boolean, intervalMinutes: number) {
    const existing = publicShipmentRecord(id);
    if (enabled && existing.status === 'delivered')
      throw new Error('This shipment is already delivered; its route is complete.');
    const interval = normalizeAutoProgressInterval(intervalMinutes);
    publishPublicShipment(
      {
        ...existing,
        autoProgressEnabled: enabled,
        autoProgressIntervalMinutes: interval,
        autoProgressNextAt: enabled
          ? new Date(Date.now() + interval * 60_000).toISOString()
          : '',
        updatedAt: timestamp(),
      },
      enabled
        ? 'Automatic route progression enabled'
        : 'Automatic route progression paused',
    );
  }
  function savePublicShipmentInternalNote(id: string, note: string) {
    const existing = publicShipmentRecord(id);
    if (note.length > 1000)
      throw new Error('Keep the internal note to 1,000 characters or fewer.');
    publishPublicShipment(
      { ...existing, internalNote: note.trim(), updatedAt: timestamp() },
      'Public shipment internal note saved',
    );
  }
  function setPublicShipmentArchived(id: string, archived: boolean) {
    const existing = publicShipmentRecord(id);
    publishPublicShipment(
      {
        ...existing,
        archivedAt: archived ? timestamp() : null,
        updatedAt: timestamp(),
      },
      archived ? 'Public shipment archived' : 'Public shipment restored',
    );
  }
  function setPublicShipmentVisibility(id: string, isPublic: boolean) {
    const existing = publicShipmentRecord(id);
    publishPublicShipment(
      { ...existing, isPublic, updatedAt: timestamp() },
      isPublic ? 'Public shipment tracking enabled' : 'Public shipment tracking hidden',
    );
  }
  function duplicatePublicShipment(id: string) {
    const admin = requireUser(true);
    const current = dataRef.current;
    const existing = publicShipmentRecord(id);
    if (current.shipments.length >= 500)
      throw new Error('This browser workspace supports at most 500 public shipments.');
    let trackingNumber = generateTrackingNumber(existing.service);
    while (
      current.shipments.some(
        (entry) => normalizeTrackingNumber(entry.trackingNumber) === trackingNumber,
      )
    )
      trackingNumber = generateTrackingNumber(existing.service);
    const now = timestamp();
    const shipDate = now.slice(0, 10);
    const originLocation = [existing.originCity, existing.originRegion]
      .filter(Boolean)
      .join(', ');
    const record: PublicShipment = {
      ...existing,
      id: newId('shipment'),
      trackingNumber,
      shipDate,
      estimatedDelivery:
        existing.estimatedDelivery && existing.estimatedDelivery >= shipDate
          ? existing.estimatedDelivery
          : '',
      status: 'label_created',
      currentLocation: originLocation,
      holdReason: '',
      publicNote: '',
      archivedAt: null,
      autoProgressEnabled: false,
      autoProgressNextAt: '',
      events: [
        {
          id: newId('shipment-event'),
          status: 'label_created',
          location: originLocation,
          note: 'Label created for duplicated shipment',
          holdReason: '',
          photo: '',
          at: now,
        },
      ],
      createdBy: admin.id,
      createdAt: now,
      updatedAt: now,
    };
    publish(
      activity({ ...current, shipments: [...current.shipments, record] }, 'Public shipment duplicated'),
    );
    return record;
  }
  function removePublicShipment(id: string) {
    requireUser(true);
    const current = dataRef.current;
    if (!current.shipments.some((entry) => entry.id === id))
      throw new Error('That public shipment was not found.');
    publish(
      activity(
        { ...current, shipments: current.shipments.filter((entry) => entry.id !== id) },
        'Public shipment removed',
      ),
    );
  }
  async function lookupPublicShipment(trackingNumber: string) {
    const normalized = normalizeTrackingNumber(trackingNumber);
    return (
      dataRef.current.shipments.find(
        (entry) =>
          entry.isPublic &&
          !entry.archivedAt &&
          normalizeTrackingNumber(entry.trackingNumber) === normalized,
      ) || null
    );
  }
  function updateProfile(name: string, email: string) {
    const profile = requireUser();
    if (!name.trim() || name.length > 60 || !validEmail(email))
      throw new Error('Enter a display name (1–60 characters) and a valid workspace email.');
    const normalized = email.trim().toLowerCase();
    const current = dataRef.current;
    if (profile.demo && normalized !== profile.email)
      throw new Error(
        'Keep the demo email unchanged so one-click demo login can find this profile. Create your own profile to use another email.',
      );
    if (!profile.demo && normalized === DEMO_USER_EMAIL)
      throw new Error(
        'That email is reserved for the one-click demo login. Choose another workspace email.',
      );
    if (!profile.demo && normalized === DEMO_ADMIN_USER_EMAIL)
      throw new Error(
        'That email is reserved for the one-click admin login. Choose another workspace email.',
      );
    if (current.users.some((entry) => entry.id !== profile.id && entry.email === normalized))
      throw new Error('Another workspace profile uses that email.');
    publish(
      activity(
        {
          ...current,
          users: current.users.map((entry) =>
            entry.id === profile.id ? { ...entry, name: name.trim(), email: normalized } : entry,
          ),
        },
        'Workspace profile updated',
      ),
    );
  }
  async function changePassphrase(currentPhrase: string, next: string, confirmation: string) {
    const profile = requireUser();
    if (profile.demo)
      throw new Error(
        'The demo profile has no passphrase. Sign out and create your own workspace profile to set one.',
      );
    const error = credentialError(profile.name, profile.email, next, confirmation);
    if (error) throw new Error(error);
    if (!(await verifyCredential(profile, currentPhrase)))
      throw new Error('The current workspace passphrase is incorrect.');
    const credential = await makeCredential(next);
    const current = dataRef.current;
    const latest = requireUser();
    if (latest.id !== profile.id || latest.digest !== profile.digest)
      throw new Error('This profile changed while updating the passphrase. Please try again.');
    publish(
      activity(
        {
          ...current,
          users: current.users.map((entry) =>
            entry.id === profile.id ? { ...entry, ...credential } : entry,
          ),
        },
        'Workspace passphrase changed',
      ),
    );
  }
  function setUserStatus(id: string, status: WorkspaceUser['status']) {
    requireUser(true);
    const current = dataRef.current;
    const profile = current.users.find((entry) => entry.id === id);
    if (!profile || profile.role === 'admin')
      throw new Error('Administrator profiles cannot be suspended from this panel.');
    publish(
      activity(
        {
          ...current,
          users: current.users.map((entry) => (entry.id === id ? { ...entry, status } : entry)),
        },
        `Member profile ${status}`,
      ),
    );
  }
  function saveSettings(name: string, announcements: string) {
    requireUser(true);
    if (!name.trim() || name.length > 60 || announcements.length > 300)
      throw new Error(
        'Use a workspace name up to 60 characters and an announcement up to 300 characters.',
      );
    publish(
      activity(
        {
          ...dataRef.current,
          settings: { name: name.trim(), announcements: announcements.trim() },
        },
        'Workspace settings saved',
      ),
    );
  }
  function clearLegacyAccess() {
    requireUser(true);
    try {
      ['isAdmin', 'isLoggedIn', 'adminPassword'].forEach((key) => localStorage.removeItem(key));
    } catch {
      throw new Error('The browser could not clear legacy access data.');
    }
  }
  const value: WorkspaceContextValue = {
    mode: 'browser',
    loading: false,
    serviceError: '',
    data,
    user,
    signIn,
    register,
    enterDemoAccess,
    enterAdminDemoAccess,
    signOut,
    saveAddress,
    removeAddress,
    setDefaultAddress,
    savePlan,
    updatePlanStatus,
    removePlan,
    savePublicShipment,
    addPublicShipmentUpdate,
    updatePublicShipmentEvent,
    removePublicShipmentEvent,
    undoPublicShipmentUpdate,
    savePublicShipmentInternalNote,
    setPublicShipmentAutoProgress,
    setPublicShipmentArchived,
    setPublicShipmentVisibility,
    duplicatePublicShipment,
    removePublicShipment,
    lookupPublicShipment,
    updateProfile,
    changePassphrase,
    setUserStatus,
    saveSettings,
    clearLegacyAccess,
  };
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
