import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Download,
  EyeOff,
  ImagePlus,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Package,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  Users,
} from 'lucide-react';
import WorkspaceShell, { type WorkspaceSection } from '@/components/workspace/WorkspaceShell';
import PlanCollection from '@/components/workspace/PlanCollection';
import ProfilePanel from '@/components/workspace/ProfilePanel';
import TrackingAttachments from '@/components/workspace/TrackingAttachments';
import CarrierShipmentPanel from '@/components/workspace/CarrierShipmentPanel';
import { ServiceNotice } from '@/components/ServiceLayout';
import { useWorkspace } from '@/context/workspace';
import { holdReasonLabel, shipmentStatusLabel } from '@/lib/publicShipments';
import { getCarrierStatus, unavailableCarrierStatus } from '@/lib/carrier';
import { publicWorkspaceExport } from '@/lib/workspace';
import { downloadText } from '@/lib/localDownloads';

const sections: WorkspaceSection[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={19} aria-hidden="true" /> },
  { id: 'plans', label: 'Shipment plans', icon: <Package size={19} aria-hidden="true" /> },
  { id: 'carrier', label: 'FedEx API', icon: <Cloud size={19} aria-hidden="true" /> },
  { id: 'members', label: 'Workspace profiles', icon: <Users size={19} aria-hidden="true" /> },
  {
    id: 'attachments',
    label: 'Image attachments',
    icon: <ImagePlus size={19} aria-hidden="true" />,
  },
  { id: 'settings', label: 'Workspace settings', icon: <Settings size={19} aria-hidden="true" /> },
  {
    id: 'security',
    label: 'Access & security',
    icon: <ShieldCheck size={19} aria-hidden="true" />,
  },
];

export default function AdminSettings() {
  const { data, user, saveSettings, setUserStatus, clearLegacyAccess, mode } = useWorkspace();
  const [params] = useSearchParams();
  const active = sections.some((section) => section.id === params.get('tab'))
    ? params.get('tab')!
    : 'overview';
  const [query, setQuery] = useState('');
  const [profileFilter, setProfileFilter] = useState('all');
  const [name, setName] = useState(data.settings.name);
  const [announcement, setAnnouncement] = useState(data.settings.announcements);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [expandedProfileId, setExpandedProfileId] = useState('');
  const [carrierStatus, setCarrierStatus] = useState(unavailableCarrierStatus);
  useEffect(() => {
    const controller = new AbortController();
    void getCarrierStatus(controller.signal)
      .then((status) => {
        if (!controller.signal.aborted) setCarrierStatus(status);
      })
      .catch(() => {
        /* The unavailable status is shown without blocking local administration. */
      });
    return () => controller.abort();
  }, []);
  const members = data.users.filter(
    (profile) =>
      (profileFilter === 'all' || profile.status === profileFilter) &&
      `${profile.name} ${profile.email}`.toLowerCase().includes(query.toLowerCase().trim()),
  );
  const activeShipments = data.shipments.filter((shipment) => !shipment.archivedAt);
  const archivedShipments = data.shipments.filter((shipment) => shipment.archivedAt);
  const onHoldShipments = activeShipments.filter((shipment) => shipment.status === 'on_hold');
  const movingShipments = activeShipments.filter((shipment) =>
    ['picked_up', 'in_transit', 'out_for_delivery'].includes(shipment.status),
  );
  const deliveredShipments = activeShipments.filter(
    (shipment) => shipment.status === 'delivered',
  );
  const hiddenShipments = activeShipments.filter((shipment) => !shipment.isPublic);
  const recentShipments = [...data.shipments]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);
  function profileCounts(profileId: string) {
    return {
      shipments: data.shipments.filter(
        (shipment) => shipment.userId === profileId && !shipment.archivedAt,
      ).length,
      plans: data.plans.filter((plan) => plan.userId === profileId).length,
      addresses: data.addresses.filter((address) => address.userId === profileId).length,
    };
  }
  function exportRecords() {
    downloadText(
      'workspace-administration.json',
      JSON.stringify(publicWorkspaceExport(data), null, 2),
    );
    setMessage(
      'Workspace records were exported. Passphrase hashes, salts, session data, and upload keys are excluded.',
    );
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      await saveSettings(name, announcement);
      setMessage(
        mode === 'server'
          ? 'Workspace settings saved to the shared database. Carrier services were not changed.'
          : 'Workspace name and announcement saved locally. Carrier services were not changed.',
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Settings could not be saved.');
    }
  }
  async function status(id: string, next: 'active' | 'suspended') {
    setError('');
    try {
      await setUserStatus(id, next);
      setMessage(
        `${mode === 'server' ? 'Workspace account' : 'Local workspace profile'} ${next}. Carrier account permissions were not changed.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Profile status could not be updated.');
    }
  }
  return (
    <WorkspaceShell
      title="Administration"
      subtitle={
        mode === 'server'
          ? 'Manage shared records and server-enforced account access.'
          : 'Manage the records and access controls in this browser workspace.'
      }
      active={active}
      sections={sections}
      admin
    >
      {active === 'overview' && (
        <div className="workspace-stack">
          <div className="workspace-stats admin-stats">
            {[
              {
                label: 'Workspace profiles',
                value: data.stats?.users ?? data.users.length,
                icon: Users,
              },
              {
                label: 'Active profiles',
                value:
                  data.stats?.activeUsers ??
                  data.users.filter((profile) => profile.status === 'active').length,
                icon: ShieldCheck,
              },
              {
                label: mode === 'server' ? 'Saved shipment plans' : 'Local shipment plans',
                value: data.stats?.plans ?? data.plans.length,
                icon: Package,
              },
              {
                label: 'Saved address records',
                value: data.stats?.addresses ?? data.addresses.length,
                icon: MapPin,
              },
              {
                label: 'Active public shipments',
                value: activeShipments.length,
                icon: Truck,
              },
              {
                label: 'In transit or out for delivery',
                value: movingShipments.length,
                icon: Package,
              },
              {
                label: 'Shipments on hold',
                value: onHoldShipments.length,
                icon: AlertTriangle,
              },
              {
                label: 'Delivered shipments',
                value: deliveredShipments.length,
                icon: CheckCircle2,
              },
            ].map((stat) => (
              <div className="workspace-stat" key={stat.label}>
                <stat.icon size={25} strokeWidth={1.4} aria-hidden="true" />
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
          <ServiceNotice title="Metrics from this workspace only">
            {mode === 'server'
              ? 'Totals are calculated from the shared account database. No live carrier activity, financial results, payments, or rewards are represented.'
              : 'Every total above is calculated from records saved in this browser. No live carrier activity, financial results, payments, or reward balances are represented.'}
          </ServiceNotice>
          <section className="workspace-panel" aria-labelledby="carrier-integration-heading">
            <div className="workspace-panel-heading">
              <div>
                <h2 id="carrier-integration-heading">FedEx API</h2>
                <p>
                  Optional server-side carrier integration running beside the application’s own
                  public-shipment records.
                </p>
              </div>
              <Cloud size={26} color="#4d148c" aria-hidden="true" />
            </div>
            <dl className="workspace-carrier-list">
              <div>
                <dt>Connection</dt>
                <dd>{carrierStatus.configured ? 'Configured' : 'Not configured'}</dd>
              </div>
              <div>
                <dt>Environment</dt>
                <dd>
                  {carrierStatus.environment === 'production'
                    ? 'Production (live carrier data)'
                    : 'Sandbox (FedEx test data)'}
                </dd>
              </div>
              <div>
                <dt>Tracking API</dt>
                <dd>{carrierStatus.trackingEnabled ? 'Enabled' : 'Disabled'}</dd>
              </div>
              <div>
                <dt>FedEx account number</dt>
                <dd>{carrierStatus.accountConfigured ? 'Configured privately' : 'Not configured'}</dd>
              </div>
              <div>
                <dt>FedEx shipment creation</dt>
                <dd>
                  {carrierStatus.shipmentCreationEnabled
                    ? 'Enabled for server sessions'
                    : 'Disabled'}
                </dd>
              </div>
            </dl>
            {carrierStatus.missing.length > 0 && (
              <p className="workspace-muted">
                Missing server settings: {carrierStatus.missing.join(', ')}. Set
                FEDEX_CLIENT_ID and FEDEX_CLIENT_SECRET from a FedEx Developer Portal project in
                the private server environment; never enter or expose them in the browser.
              </p>
            )}
            <p className="workspace-muted">
              <KeyRound size={14} aria-hidden="true" /> Shipment creation also requires
              FEDEX_ACCOUNT_NUMBER and FEDEX_CREATE_SHIPMENTS_ENABLED=true. In production it can
              create a real, billable FedEx shipment and label, so it stays off unless explicitly
              enabled.
            </p>
            <div className="workspace-form-actions">
              <Link className="brand-button workspace-primary" to="/admin/settings?tab=carrier">
                Open FedEx API settings
              </Link>
              <Link className="brand-button brand-button-outline" to="/tracking">
                Open side-by-side tracking
              </Link>
            </div>
            <CarrierShipmentPanel status={carrierStatus} mode={mode} />
          </section>
          <section className="workspace-panel">
            <div className="workspace-panel-heading">
              <div>
                <h2>Shipment actions</h2>
                <p>
                  {activeShipments.length} active public shipment
                  {activeShipments.length === 1 ? '' : 's'}
                  {archivedShipments.length > 0
                    ? ` · ${archivedShipments.length} archived`
                    : ''}
                  {hiddenShipments.length > 0
                    ? ` · ${hiddenShipments.length} hidden from public tracking`
                    : ''}
                  .
                </p>
              </div>
              <Truck size={26} color="#4d148c" aria-hidden="true" />
            </div>
            <div className="workspace-form-actions">
              <Link className="brand-button workspace-primary" to="/admin">
                Go to Shipment Dashboard
              </Link>
              <Link
                className="brand-button brand-button-outline"
                to="/admin/settings?tab=members"
              >
                Review workspace profiles
              </Link>
              <Link
                className="brand-button brand-button-outline"
                to="/admin/settings?tab=attachments"
              >
                Review image attachments
              </Link>
            </div>
          </section>
          <section className="workspace-panel">
            <div className="workspace-panel-heading">
              <div>
                <h2>Needs attention</h2>
                <p>Shipments on hold or hidden from public tracking right now.</p>
              </div>
              <AlertTriangle size={26} color="#4d148c" aria-hidden="true" />
            </div>
            {onHoldShipments.length === 0 && hiddenShipments.length === 0 ? (
              <div className="workspace-empty">
                <h3>Nothing needs attention</h3>
                <p>No active shipment is on hold or hidden from public tracking.</p>
              </div>
            ) : (
              <ul className="workspace-activity-list">
                {onHoldShipments.map((shipment) => (
                  <li key={`hold-${shipment.id}`}>
                    <span className="workspace-activity-dot" aria-hidden="true" />
                    <div>
                      <strong>
                        {shipment.trackingNumber} — On hold: {holdReasonLabel(shipment.holdReason)}
                      </strong>
                      <span>
                        {shipment.recipientLabel} · {shipment.currentLocation}
                      </span>
                    </div>
                    <Link
                      className="service-text-link"
                      to="/admin"
                      aria-label={`Open ${shipment.trackingNumber} in Public shipments`}
                    >
                      Manage
                    </Link>
                  </li>
                ))}
                {hiddenShipments.map((shipment) => (
                  <li key={`hidden-${shipment.id}`}>
                    <span className="workspace-activity-dot" aria-hidden="true" />
                    <div>
                      <strong>
                        {shipment.trackingNumber} — public tracking hidden
                      </strong>
                      <span>
                        {shipment.recipientLabel} · {shipmentStatusLabel(shipment.status)}
                      </span>
                    </div>
                    <Link
                      className="service-text-link"
                      to="/admin"
                      aria-label={`Open ${shipment.trackingNumber} in Public shipments`}
                    >
                      Manage
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="workspace-panel">
            <div className="workspace-panel-heading">
              <div>
                <h2>Recently updated shipments</h2>
                <p>The latest changes to public shipment records.</p>
              </div>
              <Package size={26} color="#4d148c" aria-hidden="true" />
            </div>
            {recentShipments.length === 0 ? (
              <div className="workspace-empty">
                <h3>No public shipments yet</h3>
                <p>Create the first public shipment from the Public shipments section.</p>
              </div>
            ) : (
              <ul className="workspace-activity-list">
                {recentShipments.map((shipment) => (
                  <li key={shipment.id}>
                    <span className="workspace-activity-dot" aria-hidden="true" />
                    <div>
                      <strong>
                        {shipment.trackingNumber} — {shipmentStatusLabel(shipment.status)}
                      </strong>
                      <span>
                        {shipment.recipientLabel} · {shipment.currentLocation} · Updated{' '}
                        {new Date(shipment.updatedAt).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    {shipment.isPublic && !shipment.archivedAt ? (
                      <Link
                        className="service-text-link"
                        to={`/tracking?number=${encodeURIComponent(shipment.trackingNumber)}`}
                        aria-label={`View public tracking for ${shipment.trackingNumber}`}
                      >
                        Track
                      </Link>
                    ) : (
                      <span className="workspace-muted">
                        <EyeOff size={15} aria-hidden="true" /> Not public
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="workspace-panel">
            <div className="workspace-panel-heading">
              <div>
                <h2>Recent workspace activity</h2>
                <p>Records of local changes—not carrier tracking events.</p>
              </div>
              <Activity size={26} color="#4d148c" aria-hidden="true" />
            </div>
            <ul className="workspace-activity-list">
              {[...data.activity]
                .reverse()
                .slice(0, showAllActivity ? 50 : 8)
                .map((entry) => (
                  <li key={entry.id}>
                    <span className="workspace-activity-dot" aria-hidden="true" />
                    <div>
                      <strong>{entry.action}</strong>
                      <span>
                        {data.users.find((profile) => profile.id === entry.actorId)?.name ||
                          'Workspace profile'}
                      </span>
                    </div>
                    <time dateTime={entry.at}>
                      {new Date(entry.at).toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </time>
                  </li>
                ))}
            </ul>
            {data.activity.length === 0 && (
              <div className="workspace-empty">
                <h3>No local activity yet</h3>
                <p>Changes to profiles, addresses, plans, and settings appear here when saved.</p>
              </div>
            )}
            {data.activity.length > 8 && (
              <div className="workspace-form-actions">
                <button
                  type="button"
                  className="brand-button brand-button-outline"
                  aria-expanded={showAllActivity}
                  onClick={() => setShowAllActivity((previous) => !previous)}
                >
                  {showAllActivity
                    ? 'Show recent activity only'
                    : `Show all activity (${Math.min(data.activity.length, 50)})`}
                </button>
              </div>
            )}
          </section>
          <section className="workspace-panel workspace-export">
            <h2>Export workspace records</h2>
            <p>
              Download workspace profiles, address records, shipment plans, public shipments
              (including timeline events, stage photos, and private internal notes),
              settings, and activity as JSON. Passphrase hashes, salts, session data, and upload keys
              are never included. Treat the file as private.
            </p>
            <button
              type="button"
              className="brand-button brand-button-outline"
              onClick={exportRecords}
            >
              <Download size={17} aria-hidden="true" />
              Export workspace data
            </button>
            {message && (
              <p className="workspace-feedback" role="status">
                {message}
              </p>
            )}
          </section>
        </div>
      )}
      {active === 'plans' && <PlanCollection plans={data.plans} admin />}
      {active === 'carrier' && (
        <section className="workspace-panel" aria-labelledby="carrier-settings-heading">
          <div className="workspace-panel-heading">
            <div>
              <h2 id="carrier-settings-heading">FedEx API settings</h2>
              <p>
                This page shows the server integration status. FedEx credentials are not entered
                or stored in the browser.
              </p>
            </div>
            <Cloud size={26} color="#4d148c" aria-hidden="true" />
          </div>
          <dl className="workspace-carrier-list">
            <div>
              <dt>Connection</dt>
              <dd>{carrierStatus.configured ? 'Configured' : 'Not configured'}</dd>
            </div>
            <div>
              <dt>Environment</dt>
              <dd>
                {carrierStatus.environment === 'production'
                  ? 'Production (live carrier data)'
                  : 'Sandbox (FedEx test data)'}
              </dd>
            </div>
            <div>
              <dt>Tracking API</dt>
              <dd>{carrierStatus.trackingEnabled ? 'Enabled' : 'Disabled'}</dd>
            </div>
            <div>
              <dt>FedEx account number</dt>
              <dd>{carrierStatus.accountConfigured ? 'Configured privately' : 'Not configured'}</dd>
            </div>
            <div>
              <dt>FedEx shipment creation</dt>
              <dd>
                {carrierStatus.shipmentCreationEnabled
                  ? 'Enabled for server sessions'
                  : 'Disabled'}
              </dd>
            </div>
            <div>
              <dt>Dashboard mode</dt>
              <dd>{mode === 'server' ? 'Server mode' : 'Browser-local mode'}</dd>
            </div>
          </dl>
          <h3>Where the private settings go</h3>
          <p className="workspace-muted">
            Set these in the hosting provider’s private environment variables, or in the
            server’s private root <code>.env</code> file when self-hosting. Never paste the
            values into chat and never prefix them with <code>VITE_</code>.
          </p>
          <ul className="workspace-carrier-env-list">
            <li>
              <code>FEDEX_ENV</code> — <code>sandbox</code> for testing or{' '}
              <code>production</code> for real FedEx shipments
            </li>
            <li>
              <code>FEDEX_CLIENT_ID</code> — FedEx Developer Portal project client ID
            </li>
            <li>
              <code>FEDEX_CLIENT_SECRET</code> — FedEx Developer Portal project client secret
            </li>
            <li>
              <code>FEDEX_ACCOUNT_NUMBER</code> — FedEx shipping account number, required only
              for shipment creation
            </li>
            <li>
              <code>FEDEX_CREATE_SHIPMENTS_ENABLED</code> — set to <code>true</code> only when
              operators should be able to submit FedEx shipments
            </li>
          </ul>
          {carrierStatus.missing.length > 0 && (
            <p className="workspace-feedback" role="status">
              Currently missing: {carrierStatus.missing.join(', ')}
            </p>
          )}
          {mode !== 'server' && (
            <p className="workspace-feedback" role="status">
              You are in browser-local mode. FedEx shipment creation requires server mode and
              a verified server session, so the form stays hidden here.
            </p>
          )}
          <div className="workspace-form-actions">
            <Link className="brand-button brand-button-outline" to="/tracking">
              Open side-by-side tracking
            </Link>
          </div>
          <CarrierShipmentPanel status={carrierStatus} mode={mode} />
        </section>
      )}
      {active === 'members' && (
        <section className="workspace-panel">
          <div className="workspace-panel-heading">
            <div>
              <h2>Workspace profiles</h2>
              <p>
                {mode === 'server'
                  ? 'Accounts are stored in the shared database and permissions are enforced on the server. These controls do not manage FedEx accounts.'
                  : 'These profiles exist only in this browser. These controls do not manage FedEx customer accounts.'}
              </p>
            </div>
            <Users size={28} color="#4d148c" aria-hidden="true" />
          </div>
          <div className="workspace-filters">
            <div className="service-field">
              <label htmlFor="admin-profile-search">Search workspace profiles</label>
              <input
                id="admin-profile-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name or workspace email"
                maxLength={160}
              />
            </div>
            <div className="service-field">
              <label htmlFor="admin-profile-filter">Access status</label>
              <select
                id="admin-profile-filter"
                value={profileFilter}
                onChange={(event) => setProfileFilter(event.target.value)}
              >
                <option value="all">All profiles</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <Search size={22} color="#4d148c" aria-hidden="true" />
          </div>
          <p className="workspace-results" role="status">
            {members.length} {members.length === 1 ? 'profile' : 'profiles'} shown
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
          <div className="workspace-table-wrap">
            <table className="workspace-table">
              <caption className="sr-only">Local workspace profiles and access</caption>
              <thead>
                <tr>
                  <th scope="col">Profile</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Records</th>
                  <th scope="col">Created</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {members.map((profile) => {
                  const counts = profileCounts(profile.id);
                  const assigned = data.shipments
                    .filter((shipment) => shipment.userId === profile.id)
                    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
                  const expanded = expandedProfileId === profile.id;
                  return (
                    <Fragment key={profile.id}>
                      <tr>
                        <td>
                          <strong>{profile.name}</strong>
                          <span>{profile.email}</span>
                          {typeof profile.emailVerified === 'boolean' && (
                            <span>
                              {profile.emailVerified ? 'Email verified' : 'Email not verified'}
                            </span>
                          )}
                        </td>
                        <td>{profile.role === 'admin' ? 'Owner' : 'Member'}</td>
                        <td>
                          <span
                            className={`workspace-status ${profile.status === 'active' ? 'ready' : 'archived'}`}
                          >
                            {profile.status === 'active' ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td>
                          {counts.shipments} shipment{counts.shipments === 1 ? '' : 's'} ·{' '}
                          {counts.plans} plan{counts.plans === 1 ? '' : 's'} · {counts.addresses}{' '}
                          address{counts.addresses === 1 ? '' : 'es'}
                        </td>
                        <td>{new Date(profile.createdAt).toLocaleDateString('en-US')}</td>
                        <td>
                          <div className="workspace-profile-actions">
                            <button
                              type="button"
                              className="service-text-link"
                              aria-expanded={expanded}
                              aria-label={`${expanded ? 'Hide' : 'View'} shipments assigned to ${profile.name}`}
                              onClick={() => setExpandedProfileId(expanded ? '' : profile.id)}
                            >
                              {expanded ? 'Hide shipments' : 'View shipments'}
                            </button>
                            {profile.role === 'admin' ? (
                              <span className="workspace-muted">Owner access</span>
                            ) : (
                              <button
                                type="button"
                                className="service-text-link"
                                aria-label={`${profile.status === 'active' ? 'Suspend' : 'Activate'} profile ${profile.name}`}
                                onClick={() =>
                                  status(
                                    profile.id,
                                    profile.status === 'active' ? 'suspended' : 'active',
                                  )
                                }
                              >
                                {profile.status === 'active' ? 'Suspend access' : 'Activate access'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="workspace-profile-detail">
                          <td colSpan={6}>
                            {assigned.length === 0 ? (
                              <p className="workspace-muted">
                                No public shipments are assigned to this profile yet.
                              </p>
                            ) : (
                              <ul className="workspace-activity-list">
                                {assigned.slice(0, 5).map((shipment) => (
                                  <li key={shipment.id}>
                                    <span
                                      className="workspace-activity-dot"
                                      aria-hidden="true"
                                    />
                                    <div>
                                      <strong>
                                        {shipment.trackingNumber} —{' '}
                                        {shipmentStatusLabel(shipment.status)}
                                        {shipment.archivedAt ? ' (archived)' : ''}
                                      </strong>
                                      <span>
                                        {shipment.recipientLabel} · {shipment.currentLocation}
                                      </span>
                                    </div>
                                    {shipment.isPublic && !shipment.archivedAt && (
                                      <Link
                                        className="service-text-link"
                                        to={`/tracking?number=${encodeURIComponent(shipment.trackingNumber)}`}
                                        aria-label={`View public tracking for ${shipment.trackingNumber}`}
                                      >
                                        Track
                                      </Link>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {assigned.length > 5 && (
                              <p className="workspace-muted">
                                Showing the 5 most recently updated of {assigned.length} assigned
                                shipments. Open Public shipments to manage them all.
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {members.length === 0 && (
            <div className="workspace-empty">
              <h3>No profiles match these filters</h3>
              <button
                type="button"
                className="brand-button brand-button-outline"
                onClick={() => {
                  setQuery('');
                  setProfileFilter('all');
                }}
              >
                Clear profile filters
              </button>
            </div>
          )}
        </section>
      )}
      {active === 'attachments' && <TrackingAttachments />}
      {active === 'settings' && (
        <section className="workspace-panel">
          <h2>Workspace settings</h2>
          <p className="workspace-panel-intro">
            Configure the workspace name and announcement. These do not alter FedEx services or send
            messages externally.
          </p>
          <form onSubmit={save} noValidate>
            <div className="service-field">
              <label htmlFor="admin-workspace-name">Workspace name</label>
              <input
                id="admin-workspace-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                required
              />
            </div>
            <div className="service-field mt-6">
              <label htmlFor="admin-announcement">Workspace announcement (optional)</label>
              <textarea
                id="admin-announcement"
                value={announcement}
                onChange={(event) => setAnnouncement(event.target.value)}
                rows={4}
                maxLength={300}
              />
              <small>
                {mode === 'server'
                  ? 'Shown to accounts in this application. No announcement email is sent.'
                  : 'Shown to local profiles in this browser. No email is sent.'}
              </small>
            </div>
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
            <div className="workspace-form-actions">
              <button type="submit" className="brand-button workspace-primary">
                Save workspace settings
              </button>
            </div>
          </form>
        </section>
      )}
      {active === 'security' && (
        <div className="workspace-stack">
          <ProfilePanel key={user?.id} />
          <section className="workspace-panel">
            <h2>Clear obsolete browser access data</h2>
            <p className="workspace-panel-intro">
              The old plaintext admin password and simple access flags are not used for this
              workspace. Clear those legacy keys without deleting saved profiles, plans, or
              addresses.
            </p>
            <button
              type="button"
              className="brand-button brand-button-outline"
              onClick={() => {
                try {
                  clearLegacyAccess();
                  setMessage(
                    'Obsolete browser access flags and the old plaintext admin password were removed.',
                  );
                  setError('');
                } catch (cause) {
                  setError(
                    cause instanceof Error ? cause.message : 'Legacy data could not be cleared.',
                  );
                }
              }}
            >
              Clear legacy access data
            </button>
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
          </section>
        </div>
      )}
    </WorkspaceShell>
  );
}
