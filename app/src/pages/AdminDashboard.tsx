import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  Settings,
  Truck,
} from 'lucide-react';
import WorkspaceShell, { type WorkspaceSection } from '@/components/workspace/WorkspaceShell';
import PublicShipmentsPanel from '@/components/workspace/PublicShipmentsPanel';
import { useWorkspace } from '@/context/workspace';

const sections: WorkspaceSection[] = [
  { id: 'shipments', label: 'Shipments', icon: <Truck size={19} aria-hidden="true" /> },
  { id: 'quick-stats', label: 'Quick stats', icon: <Package size={19} aria-hidden="true" /> },
];

export default function AdminDashboard() {
  const { data, mode } = useWorkspace();
  const activeShipments = data.shipments.filter((shipment) => !shipment.archivedAt);
  const onHoldShipments = activeShipments.filter((shipment) => shipment.status === 'on_hold');
  const movingShipments = activeShipments.filter((shipment) =>
    ['picked_up', 'in_transit', 'out_for_delivery'].includes(shipment.status),
  );
  const deliveredShipments = activeShipments.filter(
    (shipment) => shipment.status === 'delivered',
  );

  return (
    <WorkspaceShell
      title="Shipment Dashboard"
      subtitle={
        mode === 'server'
          ? 'Create, track, and manage all customer shipments from one place.'
          : 'Create, track, and manage all customer shipments from this browser workspace.'
      }
      active="shipments"
      sections={sections}
      admin
    >
      {/* Quick Stats Bar */}
      <div className="workspace-stats admin-stats" style={{ marginBottom: '1.5rem' }}>
        {[
          {
            label: 'Active shipments',
            value: activeShipments.length,
            icon: Truck,
          },
          {
            label: 'In transit / Out for delivery',
            value: movingShipments.length,
            icon: Package,
          },
          {
            label: 'On hold',
            value: onHoldShipments.length,
            icon: AlertTriangle,
          },
          {
            label: 'Delivered',
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

      {/* On Hold Alert */}
      {onHoldShipments.length > 0 && (
        <div className="workspace-panel" style={{ marginBottom: '1.5rem', borderColor: '#f59e0b' }}>
          <div className="workspace-panel-heading">
            <div>
              <h2>⚠ Needs Attention</h2>
              <p>{onHoldShipments.length} shipment{onHoldShipments.length === 1 ? '' : 's'} currently on hold</p>
            </div>
            <AlertTriangle size={26} color="#f59e0b" aria-hidden="true" />
          </div>
          <ul className="workspace-activity-list">
            {onHoldShipments.slice(0, 5).map((shipment) => (
              <li key={shipment.id}>
                <span className="workspace-activity-dot" aria-hidden="true" />
                <div>
                  <strong>{shipment.trackingNumber}</strong>
                  <span>{shipment.recipientLabel} · {shipment.currentLocation}</span>
                </div>
                <Link
                  className="service-text-link"
                  to={`/tracking?number=${encodeURIComponent(shipment.trackingNumber)}`}
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Primary: Shipments Panel */}
      <PublicShipmentsPanel />

      {/* Quick link to settings */}
      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <Link to="/admin/settings" className="brand-button brand-button-outline">
          <Settings size={17} aria-hidden="true" />
          Workspace Settings
        </Link>
      </div>
    </WorkspaceShell>
  );
}