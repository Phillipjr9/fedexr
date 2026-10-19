import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Download,
  FolderOpen,
  LayoutDashboard,
  MapPin,
  Package,
  Pencil,
  Route,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';
import WorkspaceShell, { type WorkspaceSection } from '@/components/workspace/WorkspaceShell';
import PlanCollection from '@/components/workspace/PlanCollection';
import ProfilePanel from '@/components/workspace/ProfilePanel';
import { AddressEditor, ConfirmRemove } from '@/components/workspace/WorkspaceEditors';
import BrandImage from '@/components/BrandImage';
import { ExternalLink, ServiceNotice } from '@/components/ServiceLayout';
import { useWorkspace } from '@/context/workspace';
import { downloadText } from '@/lib/localDownloads';
import { siteImages } from '@/lib/siteAssets';
import { generateSampleAddress } from '@/lib/addressGenerator';
import { holdReasonLabel, placeLabel, shipmentStatusLabel } from '@/lib/publicShipments';
import { type AddressInput, type WorkspaceAddress } from '@/lib/workspace';

const sections: WorkspaceSection[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={19} aria-hidden="true" /> },
  { id: 'plans', label: 'Shipment plans', icon: <Package size={19} aria-hidden="true" /> },
  { id: 'addresses', label: 'Address book', icon: <MapPin size={19} aria-hidden="true" /> },
  { id: 'profile', label: 'Profile & access', icon: <UserRound size={19} aria-hidden="true" /> },
  { id: 'services', label: 'Carrier services', icon: <Settings size={19} aria-hidden="true" /> },
];

export default function UserDashboard() {
  const { data, user, removeAddress, setDefaultAddress, mode } = useWorkspace();
  const [params] = useSearchParams();
  const active = sections.some((section) => section.id === params.get('tab'))
    ? params.get('tab')!
    : 'overview';
  const [editingAddress, setEditingAddress] = useState<WorkspaceAddress | 'new' | null>(null);
  const [generatedAddress, setGeneratedAddress] = useState<AddressInput | null>(null);
  const [deletingAddress, setDeletingAddress] = useState<WorkspaceAddress | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const plans = data.plans.filter((plan) => plan.userId === user?.id);
  const assignedShipments = data.shipments
    .filter((shipment) => shipment.userId === user?.id && !shipment.archivedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const addresses = data.addresses
    .filter((address) => address.userId === user?.id)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  const recent = [...plans].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
  function exportProfile() {
    downloadText(
      'my-workspace-records.json',
      JSON.stringify(
        {
          profile: user && { name: user.name, email: user.email },
          plans,
          addresses,
          note: `${mode === 'server' ? 'Account database' : 'Browser-local'} workspace records. No carrier bookings or payment information.`,
        },
        null,
        2,
      ),
    );
    setMessage('Your workspace records were downloaded without passphrase hashes.');
  }

  return (
    <WorkspaceShell
      title={`Hello, ${user?.name.split(' ')[0] || 'there'}`}
      subtitle="Your plans, addresses, and next steps—all in one place."
      active={active}
      sections={sections}
    >
      {active === 'overview' && (
        <div className="workspace-stack">
          <div className="workspace-stats">
            {[
              { label: 'Saved shipment plans', value: plans.length, icon: Package },
              {
                label: 'Ready to review',
                value: plans.filter((plan) => plan.status === 'ready').length,
                icon: ShieldCheck,
              },
              { label: 'Saved addresses', value: addresses.length, icon: MapPin },
            ].map((stat) => (
              <div className="workspace-stat" key={stat.label}>
                <stat.icon size={25} strokeWidth={1.4} aria-hidden="true" />
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
          {assignedShipments.length > 0 && (
            <section className="workspace-panel" aria-labelledby="assigned-shipments-heading">
              <div className="workspace-panel-heading">
                <div>
                  <h2 id="assigned-shipments-heading">Shipments created for you</h2>
                  <p>These shipments were created for your workspace.</p>
                </div>
                <Route size={27} color="#4d148c" aria-hidden="true" />
              </div>
              <ul className="workspace-recent-list">
                {assignedShipments.slice(0, 4).map((shipment) => (
                  <li key={shipment.id}>
                    <span className="workspace-record-icon">
                      <Package size={20} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{shipment.trackingNumber}</strong>
                      <span>
                        {placeLabel(
                          shipment.originCity,
                          shipment.originRegion,
                          shipment.originPostalCode,
                        )}{' '}
                        →{' '}
                        {placeLabel(
                          shipment.destinationCity,
                          shipment.destinationRegion,
                          shipment.destinationPostalCode,
                        )}
                      </span>
                      {shipment.status === 'on_hold' && (
                        <span className="workspace-hold-issue">
                          Hold issue: {holdReasonLabel(shipment.holdReason)}
                        </span>
                      )}
                      <Link
                        className="workspace-recent-tracking"
                        to={`/tracking?number=${encodeURIComponent(shipment.trackingNumber)}`}
                      >
                        Track publicly <ArrowRight size={13} aria-hidden="true" />
                      </Link>
                    </div>
                    <span className="workspace-status ready">
                      {shipmentStatusLabel(shipment.status)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="workspace-panel">
            <div className="workspace-panel-heading">
              <div>
                <h2>Recent shipment plans</h2>
                <p>
                  {mode === 'server'
                    ? 'Saved to your account—not retrieved from a carrier.'
                    : 'Saved by you in this browser—not retrieved from a carrier.'}
                </p>
              </div>
              <Link to="/dashboard?tab=plans" className="service-text-link">
                View all plans <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="workspace-empty">
                <FolderOpen size={36} strokeWidth={1.3} aria-hidden="true" />
                <h3>A fresh start for your next shipment</h3>
                <p>Your workspace starts empty. Save a plan to see real local activity here.</p>
                <Link className="brand-button brand-button-outline" to="/dashboard?tab=plans&new=1">
                  Create your first plan
                </Link>
              </div>
            ) : (
              <ul className="workspace-recent-list">
                {recent.map((plan) => (
                  <li key={plan.id}>
                    <span className="workspace-record-icon">
                      <Package size={20} aria-hidden="true" />
                    </span>
                    <div>
                      <strong>{plan.recipient}</strong>
                      <span>
                        {plan.from} → {plan.to} · {plan.shipDate}
                      </span>
                      <Link
                        className="workspace-recent-tracking"
                        to={`/tracking${plan.reference ? `?number=${encodeURIComponent(plan.reference)}` : ''}`}
                        aria-label={`View sample tracking for ${plan.recipient}`}
                      >
                        Sample tracking <ArrowRight size={13} aria-hidden="true" />
                      </Link>
                    </div>
                    <span className={`workspace-status ${plan.status}`}>
                      {plan.status === 'ready'
                        ? 'Ready to review'
                        : plan.status === 'draft'
                          ? 'Draft'
                          : 'Archived'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <div className="workspace-quick-grid">
            <Link to="/dashboard?tab=plans&new=1">
              <Package size={23} aria-hidden="true" />
              <strong>Plan a shipment</strong>
              <span>Save package and route details.</span>
            </Link>
            <Link to="/rate-calculator">
              <Settings size={23} aria-hidden="true" />
              <strong>Compare sample rates</strong>
              <span>Explore local price estimates.</span>
            </Link>
            <Link to="/shipping/pickup">
              <MapPin size={23} aria-hidden="true" />
              <strong>Prepare a pickup</strong>
              <span>Review details before official booking.</span>
            </Link>
          </div>
          <section className="workspace-feature">
            <BrandImage image={siteImages.rewards} />
            <div>
              <h2>Your workspace, not your carrier account</h2>
              <p>
                Local plans help organize your next steps. Real labels, billing, delivery
                commitments, and FedEx Rewards stay on the official website.
              </p>
              <ExternalLink href="https://www.fedex.com/en-us/home.html">
                Visit official FedEx services
              </ExternalLink>
            </div>
          </section>
        </div>
      )}
      {active === 'plans' && <PlanCollection plans={plans} />}
      {active === 'addresses' && (
        <section className="workspace-panel">
          <div className="workspace-panel-heading">
            <div>
              <h2>Your address book</h2>
              <p>
                {mode === 'server'
                  ? 'Your addresses are stored in the account database, not synchronized with FedEx.'
                  : 'Only addresses you save here are shown. Stored locally, not synchronized with FedEx.'}
              </p>
            </div>
            <div className="workspace-heading-actions">
              <button
                type="button"
                className="brand-button workspace-primary"
                onClick={() => setEditingAddress('new')}
              >
                <MapPin size={16} aria-hidden="true" />
                Add address
              </button>
              <button
                type="button"
                className="brand-button brand-button-outline"
                onClick={() => setGeneratedAddress(generateSampleAddress())}
              >
                <Sparkles size={16} aria-hidden="true" />
                Generate sample address
              </button>
            </div>
          </div>
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
          {addresses.length === 0 ? (
            <div className="workspace-empty">
              <MapPin size={38} strokeWidth={1.3} aria-hidden="true" />
              <h3>No saved addresses yet</h3>
              <p>Create an address entry and choose your preferred default.</p>
              <button
                type="button"
                className="brand-button brand-button-outline"
                onClick={() => setEditingAddress('new')}
              >
                Add your first address
              </button>
            </div>
          ) : (
            <div className="workspace-address-grid">
              {addresses.map((address) => (
                <article className="workspace-address" key={address.id}>
                  <div>
                    <h3>{address.label}</h3>
                    {address.isDefault && <span className="workspace-status ready">Default</span>}
                  </div>
                  <strong>{address.name}</strong>
                  <address>
                    {address.street}
                    <br />
                    {address.city}
                    {address.region ? `, ${address.region}` : ''} {address.postalCode}
                    <br />
                    {address.country}
                  </address>
                  <div className="workspace-address-actions">
                    <button
                      type="button"
                      className="service-text-link"
                      onClick={() => setEditingAddress(address)}
                    >
                      <Pencil size={14} aria-hidden="true" />
                      Edit<span className="sr-only"> {address.label}</span>
                    </button>
                    {!address.isDefault && (
                      <button
                        type="button"
                        className="service-text-link"
                        onClick={async () => {
                          try {
                            await setDefaultAddress(address.id);
                            setMessage('Default address saved.');
                            setError('');
                          } catch (cause) {
                            setError(
                              cause instanceof Error
                                ? cause.message
                                : 'The default could not be changed.',
                            );
                          }
                        }}
                      >
                        Set default<span className="sr-only"> {address.label}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="service-text-link"
                      aria-label={`Remove address ${address.label}`}
                      onClick={() => setDeletingAddress(address)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {editingAddress && (
            <AddressEditor
              key={editingAddress === 'new' ? 'new' : editingAddress.id}
              record={editingAddress === 'new' ? undefined : editingAddress}
              onClose={() => setEditingAddress(null)}
              onSaved={() => {
                setMessage(
                  mode === 'server'
                    ? 'Address saved to your account.'
                    : 'Address saved in this browser.',
                );
                setError('');
              }}
            />
          )}
          {generatedAddress && (
            <AddressEditor
              key={`generated-${generatedAddress.street}-${generatedAddress.postalCode}`}
              initialInput={generatedAddress}
              onClose={() => setGeneratedAddress(null)}
              onSaved={() => {
                setGeneratedAddress(null);
                setMessage(
                  'Sample address saved. It is generated for this workspace and is not a verified or deliverable address.',
                );
                setError('');
              }}
            />
          )}
          {deletingAddress && (
            <ConfirmRemove
              title="Remove this saved address?"
              description="Only the address in this local workspace is removed. Carrier address books are not affected."
              onClose={() => setDeletingAddress(null)}
              onConfirm={async () => {
                try {
                  await removeAddress(deletingAddress.id);
                  setDeletingAddress(null);
                  setMessage('Saved address removed.');
                } catch (cause) {
                  setError(
                    cause instanceof Error ? cause.message : 'The address could not be removed.',
                  );
                  throw cause;
                }
              }}
            />
          )}
        </section>
      )}
      {active === 'profile' && (
        <>
          <ProfilePanel />
          <section className="workspace-panel workspace-export">
            <h2>Take a copy of your records</h2>
            <p>
              Download only this profile’s plans and addresses. Credential hashes are not included.
            </p>
            <button
              type="button"
              className="brand-button brand-button-outline"
              onClick={exportProfile}
            >
              <Download size={17} aria-hidden="true" />
              Export my records
            </button>
            {message && (
              <p className="workspace-feedback" role="status">
                {message}
              </p>
            )}
          </section>
        </>
      )}
      {active === 'services' && (
        <div className="workspace-stack">
          <section className="workspace-panel">
            <h2>Connect with official carrier services</h2>
            <p className="workspace-panel-intro">
              No payment cards, fabricated invoices, memberships, or rewards balances are stored in
              this workspace.
            </p>
            <div className="workspace-resource-grid">
              <div>
                <h3>Account &amp; billing</h3>
                <p>Use your actual FedEx account for billing, invoices, and carrier preferences.</p>
                <ExternalLink href="https://www.fedex.com/secure-login/en-us/#/login-credentials">
                  Open official account access
                </ExternalLink>
              </div>
              <div>
                <h3>Shipping &amp; labels</h3>
                <p>
                  Confirm current prices and create an actual shipping label on the carrier site.
                </p>
                <ExternalLink href="https://www.fedex.com/en-us/shipping/ship-manager/login.html">
                  Open official shipping tools
                </ExternalLink>
              </div>
              <div>
                <h3>Returns &amp; claims</h3>
                <p>
                  Prepare local notes here, then complete real return or claim actions through
                  official resources.
                </p>
                <Link to="/returns" className="service-text-link">
                  Prepare return or claim notes <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </section>
          <ServiceNotice title="Independent workspace">
            This project is not affiliated with FedEx. Workspace profiles, addresses, and plans do
            not access or modify a live FedEx account.
          </ServiceNotice>
        </div>
      )}
    </WorkspaceShell>
  );
}
